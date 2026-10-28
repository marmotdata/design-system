import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { formatCompact, formatCount } from '../../core/format.js';
import { uid } from '../../core/id.js';
import { fmtDelta, MINUS, NBSP } from '../chart-core/format.js';
import '../sparkline/define.js';
import '../skeleton/define.js';

/**
 * KPI tiles show one number with its context, on Insights and Home: a 12px sentence-case label,
 * the value in `display-kpi` (Geist 600, tabular), and one context
 * caption line: the delta and the context together ("+1,244 on the day before · from 5 sources"),
 * never two lines. A delta is written with its sign and coloured only when it is good
 * or bad news (`trend="good"` in moss, `trend="bad"` in crimson); it never gets an arrow. An
 * optional 64×16 sparkline sits beside the value.
 *
 * Put tiles in an `mm-kpi-row`, which lays them in one panel separated by rules rather than as
 * separate cards.
 *
 * @tagname mm-kpi-tile
 * @summary One number with a label, a context sentence and an optional sparkline.
 * @slot context - A richer context sentence, replacing `context`.
 * @csspart label - The label.
 * @csspart value - The number.
 * @csspart context - The context sentence.
 * @csspart delta - The signed delta.
 */
export class MmKpiTile extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-inline-size: 0;
      }
      .tile {
        padding: var(--space-4) var(--space-5);
      }
      .label {
        margin: 0;
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
        margin: var(--space-1) 0 2px;
        min-block-size: 36px;
      }
      .value {
        font: var(--text-display-kpi);
        letter-spacing: var(--tracking-display-kpi);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text);
        white-space: nowrap;
      }
      .value.none {
        color: var(--mm-text-3);
      }
      .unit {
        font: var(--text-label);
        color: var(--mm-text-2);
      }
      mm-skeleton {
        --mm-skeleton-width: 96px;
        --mm-skeleton-height: 36px;
      }
      .ctx {
        margin: 0;
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .delta {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .good {
        color: var(--mm-success);
        font-weight: 600;
      }
      .bad {
        color: var(--mm-danger);
        font-weight: 600;
      }
      .err {
        color: var(--mm-text-2);
      }
    `,
  ];

  /** Sentence-case label, e.g. "Queries in last 24h". */
  @property() accessor label = '';
  /** The number. Numbers are grouped ("12,480"), or compact with `compact` ("1.28M"); strings show as given ("87%"). */
  @property() accessor value: string | number = '';
  /** Unit after the value, e.g. "ms". */
  @property() accessor unit = '';
  /** Formats numeric values compactly ("1.28M"). */
  @property({ type: Boolean }) accessor compact = false;
  /** Signed change, printed with its sign ("+214", "−12"). */
  @property({ type: Number }) accessor delta: number | undefined;
  /** Unit after the delta, e.g. "points". */
  @property({ attribute: 'delta-unit' }) accessor deltaUnit = '';
  /** The rest of the context sentence, e.g. "this week" or "from 9 sources". */
  @property() accessor context = '';
  /** `good` or `bad` colours the delta (moss or crimson); `neutral` (default) leaves it uncoloured. */
  @property({ reflect: true }) accessor trend: 'good' | 'bad' | 'neutral' = 'neutral';
  /** Values for a 64×16 sparkline beside the number, oldest first. */
  @property({ type: Array }) accessor spark: number[] = [];
  /** Shows a skeleton in place of the value. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error sentence shown in place of the context. */
  @property() accessor error = '';

  #id = uid('mm-kpi');

  #value(): string {
    const v = this.value;
    if (v === '' || v === null || v === undefined) return '–';
    const n = typeof v === 'number' ? v : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
    if (Number.isNaN(n)) return String(v);
    const abs = Math.abs(n);
    const body = this.compact ? formatCompact(abs) : formatCount(abs);
    return `${n < 0 ? MINUS : ''}${body}`;
  }

  override render() {
    const value = this.#value();
    const hasDelta = typeof this.delta === 'number' && Number.isFinite(this.delta);
    const tone = this.trend === 'good' || this.trend === 'bad' ? this.trend : '';
    const toneWord = tone === 'good' ? tr('kpiGood', 'good news') : tone === 'bad' ? tr('kpiBad', 'needs attention') : '';
    return html`<div class="tile" role="group" aria-labelledby="${this.#id}-l" aria-busy=${this.loading ? 'true' : 'false'}>
      <p class="label" part="label" id="${this.#id}-l">${this.label}</p>
      <div class="row">
        <mm-skeleton shape="rect" ?loading=${this.loading}>
          <span class="value ${this.error ? 'none' : ''}" part="value">${this.error ? '–' : value}${this.unit ? html`<span class="unit">${NBSP}${this.unit}</span>` : nothing}</span>
        </mm-skeleton>
        ${this.spark?.length && !this.loading && !this.error
          ? html`<mm-sparkline .values=${this.spark} hide-value label=${tr('kpiTrend', '{label}, trend', { label: this.label })}></mm-sparkline>`
          : nothing}
      </div>
      <p class="ctx" part="context">
        ${this.error
          ? html`<span class="err">${this.error}</span>`
          : html`<slot name="context"
              >${hasDelta
                ? html`<span class="delta ${tone}" part="delta">${fmtDelta(this.delta!, this.deltaUnit)}</span>${toneWord
                      ? html`<span class="visually-hidden"> (${toneWord})</span>`
                      : nothing} `
                : nothing}${this.context}</slot
            >`}
      </p>
    </div>`;
  }
}

/**
 * A KPI row lays `mm-kpi-tile`s side by side inside one panel, separated by vertical hairline
 * rules, never as separate cards. On narrow screens the tiles wrap and the rules between rows
 * become horizontal.
 *
 * @tagname mm-kpi-row
 * @summary KPI tiles in one ruled panel.
 * @slot - `mm-kpi-tile` elements.
 * @csspart panel - The panel.
 * @cssprop --mm-kpi-min - Narrowest a tile gets before the row wraps. Defaults to 200px.
 */
export class MmKpiRow extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .panel {
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--mm-kpi-min, 200px)), 1fr));
        margin-block-start: -1px;
        margin-inline-start: -1px;
      }
      ::slotted(*) {
        border-inline-start: 1px solid var(--mm-rule);
        border-block-start: 1px solid var(--mm-rule);
      }
    `,
  ];

  /** Names the group of figures for assistive technology, e.g. "Last 24 hours". */
  @property() accessor label = '';

  override render() {
    return html`<div class="panel" part="panel" role=${this.label ? 'group' : nothing} aria-label=${this.label || nothing}>
      <div class="grid"><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-kpi-tile': MmKpiTile;
    'mm-kpi-row': MmKpiRow;
  }
}
