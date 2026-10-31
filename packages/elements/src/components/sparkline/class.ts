import { LitElement, css, html, nothing, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { fmtNum } from '../chart-core/format.js';

/**
 * Sparklines are word-sized trend lines, 64×16, that sit beside a number in a KPI tile, a table
 * cell or a sentence. The line is grey; only the last point is marked, with a 3px dot in the key
 * colour, and its value is printed beside it in the text face with tabular figures. There are no axes, gridlines or tooltips: a
 * sparkline shows a shape, and the exact values belong to the table or chart it summarises.
 *
 * It is one image to assistive technology, named by a sentence giving the low, high and latest
 * values, with every value listed after it for screen readers.
 *
 * @tagname mm-sparkline
 * @summary A 64×16 word-sized trend line with its latest value.
 * @csspart svg - The line drawing.
 * @csspart value - The printed latest value.
 * @cssprop --mm-chart-key - Colour of the last-point dot.
 */
export class MmSparkline extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        --_key: var(--mm-chart-key, var(--mm-primary));
      }
      :host([tone='info']) {
        --_key: var(--mm-chart-key, var(--mm-info));
      }
      .spark {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      svg {
        display: block;
        overflow: visible;
        flex: none;
      }
      .line {
        fill: none;
        stroke: var(--mm-text-3);
        stroke-width: 1.25;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      .empty {
        stroke: var(--mm-rule);
        stroke-dasharray: 1 3;
      }
      .zero {
        stroke: var(--mm-rule);
        stroke-width: 1;
      }
      .dot {
        fill: var(--_key);
      }
      .value {
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text);
        white-space: nowrap;
      }
      .value.none {
        color: var(--mm-text-3);
      }
    `,
  ];

  /** The values, oldest first. Accepts a JSON array in the attribute. `null` leaves a gap. */
  @property({ type: Array }) accessor values: (number | null)[] = [];
  /** What is measured, e.g. "Queries per hour, last 24 hours". Starts the accessible summary. */
  @property() accessor label = '';
  /** Unit printed after the value, after a non-breaking space, e.g. "ms". */
  @property() accessor unit = '';
  /** Hides the printed value, for KPI tiles where the number is already shown large. */
  @property({ type: Boolean, attribute: 'hide-value', reflect: true }) accessor hideValue = false;
  /** Colour of the last-point dot: `primary` (default) or `info`. */
  @property({ reflect: true }) accessor tone: 'primary' | 'info' = 'primary';
  /** Width in px. Keep it word-sized. */
  @property({ type: Number }) accessor width = 64;
  /** Height in px. */
  @property({ type: Number }) accessor height = 16;

  #summary(nums: number[], last: number): string {
    const lead = this.label || tr('sparklineTrend', 'Trend');
    if (!nums.length) return `${lead}: ${tr('chartEmptyShort', 'no data')}`;
    if (nums.length === 1) return `${lead}: ${fmtNum(last, this.unit)}`;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return tr('sparklineSummary', '{label}: low {min}, high {max}, latest {last}', {
      label: lead,
      min: fmtNum(min, this.unit),
      max: fmtNum(max, this.unit),
      last: fmtNum(last, this.unit),
    });
  }

  override render() {
    const w = this.width;
    const h = this.height;
    const vals = this.values ?? [];
    const nums = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const lastIdx = vals.findLastIndex((v) => typeof v === 'number' && Number.isFinite(v));
    const last = lastIdx >= 0 ? (vals[lastIdx] as number) : NaN;
    const summary = this.#summary(nums, last);
    if (!nums.length) {
      return html`<span class="spark" role="img" aria-label=${summary}>
        <svg part="svg" width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">
          <line class="line empty" x1="0" x2=${w} y1=${h / 2} y2=${h / 2}></line>
        </svg>
        ${this.hideValue ? nothing : html`<span part="value" class="value none" aria-hidden="true">${tr('noValue', 'n/a')}</span>`}
      </span>`;
    }
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const pad = 1.5;
    const y = (v: number) => (max === min ? h / 2 : pad + (1 - (v - min) / (max - min)) * (h - pad * 2));
    const x = (i: number) => (vals.length === 1 ? w : (i / (vals.length - 1)) * w);
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${Math.round(x(i) * 10) / 10},${Math.round(y(v) * 10) / 10}`;
      pen = true;
    });
    const zero = min < 0 && max > 0 ? y(0) : null;
    return html`<span class="spark" role="img" aria-label=${summary}>
        <svg part="svg" width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">
          ${zero !== null ? svg`<line class="zero" x1="0" x2=${w} y1=${zero} y2=${zero}></line>` : nothing}
          <path class="line" d=${d}></path>
          <circle class="dot" cx=${x(lastIdx)} cy=${y(last)} r="1.5"></circle>
        </svg>
        ${this.hideValue ? nothing : html`<span part="value" class="value" aria-hidden="true">${fmtNum(last, this.unit)}</span>`}
      </span>
      ${nums.length > 1
        ? html`<span class="visually-hidden">${tr('chartValues', 'Values')}: ${nums.map((v) => fmtNum(v, this.unit)).join(', ')}</span>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-sparkline': MmSparkline;
  }
}
