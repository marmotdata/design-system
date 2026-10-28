import { LitElement, css, html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { uid } from '../../core/id.js';
import { tr } from '../../core/strings.js';
import type { MmTooltip, TooltipItem } from '../tooltip/class.js';
import { chartStyles, hatchDef } from './svg.js';
import '../tooltip/define.js';
import '../loading/define.js';

/** One keyboard- and pointer-reachable data point in a chart, in SVG user units. */
export interface ChartPoint {
  x: number;
  y: number;
  /** Tooltip rows: mono key and value pairs. */
  items: TooltipItem[];
  /** One sentence announced when the point takes keyboard focus. */
  text: string;
}

/** The visually hidden data table every chart renders, so values are reachable without vision. */
export interface ChartTable {
  caption: string;
  head: string[];
  rows: string[][];
}

export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The shared behaviour of every focusable Marmot chart. Not an element on its own.
 *
 * The plot is one focusable `role="img"` region named by a summary sentence generated from the
 * data. Left and Right move a focus marker between data points and show the ink data tooltip;
 * Home and End jump to the ends; Escape hides it. Pointer hover does the same without moving
 * focus. A visually hidden table carries every value. The width follows the container through a
 * ResizeObserver; before the first measurement (and on the server) the chart draws at
 * `default-width` and scales to fit, so it renders without JavaScript measurement.
 *
 * Plots are drawn left to right in every direction, as time and number lines are in Arabic and
 * Hebrew dashboards, so the arrow keys always follow the screen.
 *
 * @csspart frame - The focusable plot region.
 * @csspart plot - The SVG drawing.
 * @csspart message - The empty or error sentence.
 * @cssprop --mm-chart-key - Colour of the key series. Defaults to `--mm-primary`, or `--mm-info` with `tone="info"`.
 * @cssprop --mm-chart-ground - The ground behind the chart, used for label halos. Defaults to `--mm-paper`.
 */
export abstract class MmChartBase extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    chartStyles,
    css`
      :host {
        display: block;
        position: relative;
        min-inline-size: 0;
        --_key: var(--mm-chart-key, var(--mm-primary));
        color: var(--mm-text);
      }
      :host([tone='info']) {
        --_key: var(--mm-chart-key, var(--mm-info));
      }
      .frame {
        position: relative;
        display: block;
        border-radius: var(--radius-sm);
        touch-action: pan-y;
      }
      .state {
        position: relative;
        display: grid;
        place-items: center;
      }
      .state svg {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
      }
      .message {
        position: relative;
        margin: 0;
        max-inline-size: 44ch;
        padding-inline: var(--space-4);
        text-align: center;
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      .message strong {
        font-weight: 600;
        color: var(--mm-danger);
      }
      .frame-line {
        stroke: var(--mm-rule);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
    `,
  ];

  /** What is measured, in sentence case, e.g. "Queries per hour". Starts the summary sentence and names the table. */
  @property() accessor label = '';
  /** Replaces the generated summary sentence read by screen readers. */
  @property() accessor summary = '';
  /** Plot height in px. */
  @property({ type: Number }) accessor height = 240;
  /** Width used before the first measurement and on the server, in px. */
  @property({ type: Number, attribute: 'default-width' }) accessor defaultWidth = 640;
  /** Shows the topographic loading field (after 200ms, for at least 400ms). */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error sentence. When set, the chart draws its empty frame with this sentence. */
  @property() accessor error = '';
  /** Sentence shown when there is no data. */
  @property({ attribute: 'empty-text' }) accessor emptyText = '';
  /** Key series colour: `primary` (burnt sienna, default) or `info` (slate). The only colour on the chart. */
  @property({ reflect: true }) accessor tone: 'primary' | 'info' = 'primary';

  /** Measured width in px. */
  @state() protected accessor measured = 0;
  /** Index of the point under the keyboard focus marker or pointer, or -1. */
  @state() protected accessor active = -1;
  @state() private accessor liveText = '';

  /** Points of the last render, in SVG user units. Set by `renderPlot`. */
  protected pointList: ChartPoint[] = [];
  /** Plot area of the last render, for the focus cursor. */
  protected box: PlotBox = { left: 0, right: 0, top: 0, bottom: 0 };
  protected readonly hatchId = uid('mm-hatch');
  #ro?: ResizeObserver;

  /** Current drawing width. */
  protected get w(): number {
    return this.measured || this.defaultWidth;
  }

  /** Index of the focused or hovered data point, or -1. */
  get activeIndex(): number {
    return this.active;
  }

  protected abstract isEmpty(): boolean;
  /** Draws the plot for the current width and sets `pointList` and `box`. */
  protected abstract renderPlot(): SVGTemplateResult;
  protected abstract describe(): string;
  protected abstract dataTable(): ChartTable;

  /** Drawing height; charts whose height follows their data override this. */
  protected plotHeight(): number {
    return this.height;
  }

  /** Text measured with a fallback font is wrong once the real font arrives, so lay out again then. */
  #onFonts = () => this.fontsChanged();
  /** Called when web fonts finish loading. Charts that cache text measurements clear them here. */
  protected fontsChanged(): void {
    this.requestUpdate();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof document !== 'undefined') document.fonts?.addEventListener?.('loadingdone', this.#onFonts);
    if (typeof ResizeObserver === 'undefined') return;
    this.#ro = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0 && Math.abs(width - this.measured) >= 1) this.measured = width;
    });
    this.#ro.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    if (typeof document !== 'undefined') document.fonts?.removeEventListener?.('loadingdone', this.#onFonts);
  }

  /** Nearest point to a pointer position in SVG units. Defaults to nearest by x. */
  protected hitTest(x: number, _y: number): number {
    let best = -1;
    let dist = Infinity;
    this.pointList.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  /** Maps a key to the next active index, or null if the key is not handled. */
  protected moveKey(e: KeyboardEvent, current: number): number | null {
    const n = this.pointList.length;
    if (!n) return null;
    switch (e.key) {
      case 'ArrowRight':
        return current < 0 ? 0 : Math.min(n - 1, current + 1);
      case 'ArrowLeft':
        return current < 0 ? n - 1 : Math.max(0, current - 1);
      case 'Home':
        return 0;
      case 'End':
        return n - 1;
    }
    return null;
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.active >= 0) this.active = -1;
      return;
    }
    const next = this.moveKey(e, this.active);
    if (next === null) return;
    e.preventDefault();
    this.active = next;
    this.liveText = this.pointList[next]?.text ?? '';
  };

  #toSvg(e: PointerEvent): [number, number] | null {
    const el = this.renderRoot.querySelector('svg.plot');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const h = this.plotHeight();
    const s = Math.min(r.width / this.w, r.height / h) || 1;
    const ox = r.left + (r.width - this.w * s) / 2;
    const oy = r.top + (r.height - h * s) / 2;
    return [(e.clientX - ox) / s, (e.clientY - oy) / s];
  }

  #onPointerMove = (e: PointerEvent) => {
    const p = this.#toSvg(e);
    if (!p) return;
    this.active = this.hitTest(p[0], p[1]);
  };
  #onPointerLeave = () => {
    if (this.matches(':focus-within')) return;
    this.active = -1;
  };
  #onBlur = () => {
    this.active = -1;
  };

  protected override updated(_changed: PropertyValues): void {
    const tip = this.renderRoot.querySelector<MmTooltip>('mm-tooltip');
    if (!tip) return;
    const p = this.pointList[this.active];
    const el = this.renderRoot.querySelector('svg.plot');
    if (!p || !el) {
      if (tip.open) tip.hide();
      return;
    }
    const r = el.getBoundingClientRect();
    const h = this.plotHeight();
    const s = Math.min(r.width / this.w, r.height / h) || 1;
    const ox = r.left + (r.width - this.w * s) / 2;
    const oy = r.top + (r.height - h * s) / 2;
    tip.showAt(ox + p.x * s, oy + p.y * s - 6);
  }

  /** The default focus marker: a 1px cursor through the plot and an ink ring on the point. */
  protected renderMarker(p: ChartPoint): SVGTemplateResult {
    return svg`<g class="focus" aria-hidden="true">
      <line class="cursor" x1=${p.x} x2=${p.x} y1=${this.box.top} y2=${this.box.bottom}></line>
      <circle class="marker" cx=${p.x} cy=${p.y} r="4"></circle>
    </g>`;
  }

  /** The empty and error states: the axes frame drawn in rule, with one sentence. */
  protected renderMessage(text: TemplateResult | string, h = this.plotHeight()): TemplateResult {
    return html`<div class="state" style="block-size:${h}px">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <line class="frame-line" x1="6" x2="6" y1="8" y2="86" vector-effect="non-scaling-stroke"></line>
        <line class="frame-line" x1="8" x2="98" y1="92" y2="92" vector-effect="non-scaling-stroke"></line>
        <line class="grid" x1="8" x2="98" y1="33" y2="33" vector-effect="non-scaling-stroke"></line>
        <line class="grid" x1="8" x2="98" y1="62" y2="62" vector-effect="non-scaling-stroke"></line>
      </svg>
      <p class="message" part="message">${text}</p>
    </div>`;
  }

  protected renderTable(): TemplateResult {
    const t = this.dataTable();
    return html`<table class="visually-hidden">
      <caption>${t.caption}</caption>
      <thead><tr>${t.head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
      <tbody>${t.rows.map((r) => html`<tr>${r.map((c, i) => (i === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody>
    </table>`;
  }

  override render(): TemplateResult {
    const h = this.plotHeight();
    if (this.loading) {
      return html`<div class="state" style="block-size:${h}px" aria-busy="true">
        <mm-loading caption=${tr('chartLoading', 'Loading chart')} width="120" height="64"></mm-loading>
      </div>`;
    }
    if (this.error) {
      return this.renderMessage(html`<strong>${tr('chartError', 'Could not load this chart.')}</strong> ${this.error}`);
    }
    if (this.isEmpty()) {
      return this.renderMessage(this.emptyText || tr('chartEmpty', 'No data for this period yet.'));
    }
    const plot = this.renderPlot();
    const p = this.pointList[this.active];
    const items = p?.items ?? [];
    return html`<div
        class="frame"
        part="frame"
        tabindex="0"
        role="img"
        aria-label=${this.summary || this.describe()}
        @keydown=${this.#onKeydown}
        @pointermove=${this.#onPointerMove}
        @pointerleave=${this.#onPointerLeave}
        @blur=${this.#onBlur}
      >
        <svg class="plot" part="plot" width="100%" height=${h} viewBox="0 0 ${this.w} ${h}" aria-hidden="true" focusable="false">
          <defs>${hatchDef(this.hatchId)}</defs>
          ${plot} ${p ? this.renderMarker(p) : nothing}
        </svg>
      </div>
      <div class="visually-hidden" aria-live="polite">${this.liveText}</div>
      ${this.renderTable()}
      <mm-tooltip variant="data" placement="top" .items=${items}></mm-tooltip>`;
  }
}
