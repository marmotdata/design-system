import { LitElement, css, html, nothing, svg, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import type { MmTooltip, TooltipItem } from '../tooltip/class.js';
import { chartStyles, hatchDef, rangeX, rangeY } from '../chart-core/svg.js';
import { fmtNum, monoWidth, periodPhrase, xFormatter, xLongFormatter, xNum, type XValue } from '../chart-core/format.js';
import '../tooltip/define.js';
import '../loading/define.js';

export interface Sheet {
  /** Sentence-case title, e.g. "PostgreSQL". */
  title: string;
  /** A stable key for the sheet, e.g. "postgresql". Not shown; `highlight` matches it as well as the title. */
  ref?: string;
  /** One value per x, oldest first. `null` leaves a gap. */
  values: (number | null)[];
  /** The whole sheet is stale: drawn hatched instead of tinted, and marked "Stale". */
  stale?: boolean;
}

type Num = number | null;
const isNum = (v: Num | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

const SHEET_H = 76;
const GAP = 0;

/**
 * Small multiples show per-source or per-domain health as a grid of small line or area charts on
 * one shared y scale, laid out like the sheets of a survey map: hairline sheet edges and the series
 * title above each plot. Plots in a grid row share one baseline, whatever their titles.
 * Every sheet's y axis is a range frame spanning only that sheet's own minimum to maximum on the
 * shared scale, so the extremes are labelled without repeating a full axis. Times are labelled
 * along the bottom row. Lines are grey; `highlight` draws one sheet in the key colour.
 *
 * Each sheet is focusable: Left and Right move between its points and show the tooltip, Home and
 * End jump to the ends and Escape hides it. A visually hidden table carries every value.
 *
 * @tagname mm-small-multiples
 * @summary A map-sheet grid of mini charts on a shared scale.
 * @csspart grid - The sheet grid.
 * @csspart sheet - Each sheet.
 * @csspart title - Each sheet title.
 * @cssprop --mm-chart-key - Colour of the highlighted sheet.
 */
export class MmSmallMultiples extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    chartStyles,
    css`
      :host {
        display: block;
        min-inline-size: 0;
        --_key: var(--mm-chart-key, var(--mm-primary));
      }
      :host([tone='info']) {
        --_key: var(--mm-chart-key, var(--mm-info));
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-2);
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .sheetwrap {
        position: relative;
      }
      .clip {
        overflow: hidden;
      }
      .sheets {
        display: grid;
        margin-block-start: -1px;
        margin-inline-start: -1px;
      }
      /* A column whose plot is pushed to the end, so every plot in a grid row (the cells stretch to
         the row's height) sits on the same baseline. */
      .sheet {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: var(--space-3) var(--space-3) var(--space-2);
        border-block-start: 1px solid var(--mm-rule);
        border-inline-start: 1px solid var(--mm-rule);
        min-inline-size: 0;
      }
      .title {
        margin: 0 0 var(--space-1);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .title .stale {
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .frame {
        display: block;
        margin-block-start: auto;
        border-radius: var(--radius-sm);
      }
      .none {
        display: grid;
        place-items: center;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .state {
        display: grid;
        place-items: center;
        min-block-size: 200px;
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      .state strong {
        color: var(--mm-danger);
        font-weight: 600;
      }
    `,
  ];

  /** The sheets, in reading order. */
  @property({ type: Array }) accessor sheets: Sheet[] = [];
  /** Shared x values for every sheet: Dates, ISO strings or numbers. */
  @property({ type: Array }) accessor x: XValue[] = [];
  /** What is measured, e.g. "Freshness lag". Used in readouts, summaries and the table. */
  @property() accessor label = '';
  /** Unit after values, e.g. "min". */
  @property() accessor unit = '';
  /** `line` (default) or `area` (flat 10% tint). */
  @property({ reflect: true }) accessor type: 'line' | 'area' = 'line';
  /** Title or ref of the one sheet drawn in the key colour. */
  @property() accessor highlight = '';
  /** Key colour: `primary` (default) or `info`. */
  @property({ reflect: true }) accessor tone: 'primary' | 'info' = 'primary';
  /** Narrowest a sheet gets before the grid drops a column, in px. */
  @property({ type: Number, attribute: 'min-sheet-width' }) accessor minSheetWidth = 260;
  /** Width used before the first measurement and on the server, in px. */
  @property({ type: Number, attribute: 'default-width' }) accessor defaultWidth = 720;
  /** IANA time zone for time labels. UTC by default. */
  @property({ attribute: 'time-zone' }) accessor timeZone = 'UTC';
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error sentence shown instead of the sheets. */
  @property() accessor error = '';

  @state() private accessor measured = 0;
  @state() private accessor activeSheet = -1;
  @state() private accessor activeIndex = -1;
  @state() private accessor liveText = '';
  #ro?: ResizeObserver;
  #hatch = uid('mm-hatch');
  #points: { x: number; y: number }[][] = [];
  #sheetW = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver === 'undefined') return;
    this.#ro = new ResizeObserver((e) => {
      const w = Math.round(e[0]?.contentRect.width ?? 0);
      if (w > 0 && w !== this.measured) this.measured = w;
    });
    this.#ro.observe(this);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
  }

  #isKey(s: Sheet) {
    return !!this.highlight && (s.title === this.highlight || s.ref === this.highlight);
  }

  #describe(s: Sheet): string {
    const vals = s.values;
    const fx = xFormatter(this.x, this.timeZone);
    let maxI = -1;
    vals.forEach((v, i) => {
      if (isNum(v) && (maxI < 0 || v > (vals[maxI] as number))) maxI = i;
    });
    if (maxI < 0) return `${s.title}: ${tr('chartEmpty', 'No data for this period yet.')}`;
    const lastI = vals.findLastIndex(isNum);
    let t = tr('chartSummaryPeak', '{label} over {period}, peaking at {max} at {at}', {
      label: `${s.title}, ${(this.label || '').toLowerCase()}`.replace(/, $/, ''),
      period: periodPhrase(this.x),
      max: fmtNum(vals[maxI] as number, this.unit),
      at: fx(this.x[maxI]!),
    });
    if (lastI !== maxI) t += `, ${tr('chartLatest', 'latest {value}', { value: fmtNum(vals[lastI] as number, this.unit) })}`;
    if (s.stale) t += `, ${tr('chartStale', 'Stale').toLowerCase()}`;
    return `${t}.`;
  }

  #onKeydown(si: number, e: KeyboardEvent) {
    const n = this.x.length;
    if (e.key === 'Escape') {
      this.activeIndex = -1;
      return;
    }
    const cur = this.activeSheet === si ? this.activeIndex : -1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = cur < 0 ? 0 : Math.min(n - 1, cur + 1);
    else if (e.key === 'ArrowLeft') next = cur < 0 ? n - 1 : Math.max(0, cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null || !n) return;
    e.preventDefault();
    this.activeSheet = si;
    this.activeIndex = next;
    const s = this.sheets[si]!;
    const fl = xLongFormatter(this.x, this.timeZone);
    const v = s.values[next];
    this.liveText = `${s.title}, ${fl(this.x[next]!)}: ${isNum(v) ? fmtNum(v, this.unit) : '–'}`;
  }

  #onMove(si: number, e: PointerEvent) {
    const svgEl = (e.currentTarget as HTMLElement).querySelector('svg');
    const pts = this.#points[si];
    if (!svgEl || !pts?.length) return;
    const r = svgEl.getBoundingClientRect();
    const sx = (e.clientX - r.left) * (this.#sheetW / r.width);
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.x - sx) < Math.abs(pts[best]!.x - sx)) best = i;
    });
    this.activeSheet = si;
    this.activeIndex = best;
  }

  #clear = () => {
    this.activeSheet = -1;
    this.activeIndex = -1;
  };

  protected override updated(): void {
    const tip = this.renderRoot.querySelector<MmTooltip>('mm-tooltip');
    if (!tip) return;
    const p = this.#points[this.activeSheet]?.[this.activeIndex];
    const svgEl = this.renderRoot.querySelectorAll('.frame svg')[this.activeSheet];
    if (!p || !svgEl) {
      if (tip.open) tip.hide();
      return;
    }
    const r = svgEl.getBoundingClientRect();
    const s = r.width / this.#sheetW || 1;
    tip.showAt(r.left + p.x * s, r.top + p.y * s - 6);
  }

  #items(): TooltipItem[] {
    const s = this.sheets[this.activeSheet];
    if (!s || this.activeIndex < 0) return [];
    const fl = xLongFormatter(this.x, this.timeZone);
    const v = s.values[this.activeIndex];
    return [
      { label: tr('sheet', 'Sheet').toLowerCase(), value: s.title },
      { label: tr('chartTime', 'Time').toLowerCase(), value: fl(this.x[this.activeIndex]!) },
      { label: (this.label || tr('chartValue', 'Value')).toLowerCase(), value: isNum(v) ? fmtNum(v, this.unit) : '–' },
      ...(s.stale ? [{ label: tr('chartStatus', 'status'), value: tr('chartStale', 'Stale') }] : []),
    ];
  }

  #table(): TemplateResult {
    const fl = xLongFormatter(this.x, this.timeZone);
    return html`<table class="visually-hidden">
      <caption>${this.label}</caption>
      <thead><tr><th scope="col">${tr('chartTime', 'Time')}</th>${this.sheets.map((s) => html`<th scope="col">${s.title}${s.stale ? ` (${tr('chartStale', 'Stale').toLowerCase()})` : ''}</th>`)}</tr></thead>
      <tbody>${this.x.map((xv, i) => html`<tr><th scope="row">${fl(xv)}</th>${this.sheets.map((s) => html`<td>${isNum(s.values[i]) ? fmtNum(s.values[i] as number, this.unit) : ''}</td>`)}</tr>`)}</tbody>
    </table>`;
  }

  override render() {
    if (this.loading) {
      return html`<div class="state" aria-busy="true"><mm-loading caption=${tr('chartLoading', 'Loading chart')} width="120" height="64"></mm-loading></div>`;
    }
    if (this.error) return html`<div class="state"><p><strong>${tr('chartError', 'Could not load this chart.')}</strong> ${this.error}</p></div>`;
    const sheets = this.sheets ?? [];
    if (!sheets.length || !this.x.length) return html`<div class="state"><p>${tr('chartEmpty', 'No data for this period yet.')}</p></div>`;

    const W = (this.measured || this.defaultWidth) - 12;
    const cols = Math.max(1, Math.min(sheets.length, Math.floor((W + GAP) / this.minSheetWidth)));
    const sheetW = Math.max(80, Math.floor(W / cols) - 2 * 12);
    this.#sheetW = sheetW;
    const rows = Math.ceil(sheets.length / cols);
    const all = sheets.flatMap((s) => s.values.filter(isNum));
    let min = Math.min(...all);
    const max = Math.max(...all);
    if (this.type === 'area') min = Math.min(0, min);
    const lo = min === max ? min - 1 : min;
    const hi = min === max ? max + 1 : max;
    const n = this.x.length;
    const xs = this.x.map(xNum);
    const fx = xFormatter(this.x, this.timeZone);
    // Each sheet's range frame labels its own extremes, or one "2.9–5.5 min" label when they sit too close.
    const rangeLabels = sheets.map((s) => {
      const nums = s.values.filter(isNum);
      if (!nums.length) return { w: 0, merged: '' };
      const a = Math.min(...nums);
      const b = Math.max(...nums);
      const close = (Math.abs(b - a) / (hi - lo)) * (SHEET_H - 8) < 11 && fmtNum(a) !== fmtNum(b);
      const merged = `${fmtNum(a)}–${fmtNum(b, this.unit)}`;
      return { w: close ? monoWidth(merged) : Math.max(monoWidth(fmtNum(a, this.unit)), monoWidth(fmtNum(b, this.unit))), merged };
    });
    const labelW = Math.max(...rangeLabels.map((r) => r.w));
    const valueW = Math.max(...sheets.map((s) => monoWidth(fmtNum((s.values.filter(isNum).at(-1) ?? 0) as number, this.unit))));
    const left = Math.ceil(labelW) + 14;
    const right = sheetW - Math.ceil(valueW) - 8;
    const top = 6;
    const bottomRow = (i: number) => Math.floor(i / cols) === rows - 1;
    const X = n === 1 ? () => (left + right) / 2 : scaleLinear().domain([xs[0]!, xs[n - 1]!]).range([left, right]);
    const xi = (i: number) => X(xs[i]!);
    this.#points = [];

    const sheetSvg = (s: Sheet, si: number) => {
      const h = SHEET_H + (bottomRow(si) ? 22 : 0);
      const bottom = top + SHEET_H - 8;
      const Y = scaleLinear().domain([lo, hi]).range([bottom, top]);
      const vals = s.values;
      const nums = vals.filter(isNum);
      const key = this.#isKey(s);
      this.#points[si] = this.x.map((_, i) => ({ x: xi(i), y: isNum(vals[i]) ? Y(vals[i] as number) : bottom }));
      // Same height as a drawn sheet, so an empty one keeps the row even.
      if (!nums.length) return html`<div class="none" style="block-size:${h}px">${tr('chartEmpty', 'No data for this period yet.')}</div>`;
      const smin = Math.min(...nums);
      const smax = Math.max(...nums);
      const line = d3line<Num>().defined(isNum).x((_, i) => xi(i)).y((v) => Y(v as number))(vals) ?? '';
      const ar = d3area<Num>().defined(isNum).x((_, i) => xi(i)).y0(Y(lo)).y1((v) => Y(v as number))(vals) ?? '';
      const lastI = vals.findLastIndex(isNum);
      const p = this.activeSheet === si ? this.#points[si]![this.activeIndex] : undefined;
      return html`<svg class="plot" width="100%" height=${h} viewBox="0 0 ${sheetW} ${h}" aria-hidden="true" focusable="false">
        <defs>${hatchDef(`${this.#hatch}-${si}`)}</defs>
        ${rangeY(left - 6, { at: Y(smax), label: fmtNum(smax, this.unit) }, { at: Y(smin), label: fmtNum(smin, this.unit) }, rangeLabels[si]!.merged)}
        ${s.stale
          ? svg`<path class="hatch" fill="url(#${this.#hatch}-${si})" d=${ar}></path>`
          : this.type === 'area'
            ? svg`<path class=${key ? 'key-area' : 'ctx-area'} d=${ar} style=${key ? '' : 'fill:var(--mm-text-3);opacity:0.1'}></path>`
            : nothing}
        ${n === 1
          ? svg`<circle class=${key ? 'key-dot' : ''} cx=${xi(0)} cy=${Y(vals[0] as number)} r="2.5" fill=${key ? nothing : 'var(--mm-text-3)'}></circle>`
          : svg`<path class=${key ? 'key' : 'ctx'} d=${line}></path>`}
        <text class=${key ? 'key-label' : 'strong'} x=${right + 6} y=${Y(vals[lastI] as number) + 4}>${fmtNum(vals[lastI] as number, this.unit)}</text>
        ${bottomRow(si) ? rangeX(bottom + 8, { at: xi(0), label: fx(this.x[0]!) }, { at: xi(n - 1), label: fx(this.x[n - 1]!) }) : nothing}
        ${p
          ? svg`<line class="cursor" x1=${p.x} x2=${p.x} y1=${top} y2=${bottom}></line><circle class="marker" cx=${p.x} cy=${p.y} r="3.5"></circle>`
          : nothing}
      </svg>`;
    };


    return html`${this.label
        ? html`<div class="head" aria-hidden="true"><span>${this.label}</span><span>${tr('sharedScale', 'Shared scale')} ${fmtNum(lo)}–${fmtNum(hi, this.unit)}</span></div>`
        : nothing}
      <div class="sheetwrap">
        <div class="clip">
          <div class="sheets" part="grid" role="group" aria-label=${this.label || nothing} style="grid-template-columns:repeat(${cols}, minmax(0, 1fr))">
            ${sheets.map(
              (s, si) => html`<figure class="sheet" part="sheet">
                <figcaption class="title" part="title" aria-hidden="true">${s.title}${s.stale
                    ? html`<span class="stale"> · ${tr('chartStale', 'Stale')}</span>`
                    : nothing}</figcaption>
                <div
                  class="frame"
                  tabindex="0"
                  role="img"
                  aria-label=${this.#describe(s)}
                  @keydown=${(e: KeyboardEvent) => this.#onKeydown(si, e)}
                  @pointermove=${(e: PointerEvent) => this.#onMove(si, e)}
                  @pointerleave=${this.#clear}
                  @blur=${this.#clear}
                >
                  ${sheetSvg(s, si)}
                </div>
              </figure>`,
            )}
          </div>
        </div>
      </div>
      <div class="visually-hidden" aria-live="polite">${this.liveText}</div>
      ${this.#table()}
      <mm-tooltip variant="data" placement="top" .items=${this.#items()}></mm-tooltip>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-small-multiples': MmSmallMultiples;
  }
}
