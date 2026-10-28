import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { formatCompact, formatCount } from '../../core/format.js';
import { base, visuallyHidden } from '../../core/styles.js';

/**
 * Compact numbers in the guidelines are `1.28M` and `4.1K`, but en-GB compact notation gives `1.28m` and `1.2bn`.
 * Normalise the suffix until core/format does (reported).
 */
const readmeCompact = (s: string): string =>
  s.replace(/(\d)\s?(k|m|bn|tn)$/i, (_, d: string, u: string) => d + ({ k: 'K', m: 'M', bn: 'B', tn: 'T' }[u.toLowerCase()] ?? u));

/**
 * The count used by tabs, filter pills and badge counts: a number in the text face with tabular
 * figures, quieter than the label it sits beside, and always numerals. Over `max` it shows `99+`; with
 * `compact` large numbers shorten to `1.28M`. On an ink-filled selected filter pill use the `inverse`
 * tone.
 *
 * A bare count reads as just a number. When the number is not explained by the text beside it (a
 * badge on a bell, for example), give `label` the full sentence, such as "12 unread notifications".
 *
 * @tagname mm-count
 * @summary A small tabular count for tabs, filter pills and badges.
 * @cssprop --mm-count-color - Overrides the colour, for example `var(--mm-text-2)` inside a selected row or on a raised layer.
 * @csspart count - The visible number.
 */
export class MmCount extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        vertical-align: baseline;
        /* Caption face at 13px; no count token exists yet. */
        font: var(--text-caption);
        font-size: 13px;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--mm-count-color, var(--mm-text-3));
        white-space: nowrap;
      }
      :host([tone='inverse']) {
        color: var(--mm-count-color, var(--mm-on-inverse));
      }
      :host([tone='inverse']) .n {
        opacity: 0.8;
      }
    `,
  ];

  /** The number to show. Nothing renders when it is not a number. */
  @property({ type: Number }) accessor value: number | undefined;
  /** Above this, shows `max+` (for example `99+`). */
  @property({ type: Number }) accessor max: number | undefined;
  /** Shortens large numbers: 1284019 becomes `1.28M`. */
  @property({ type: Boolean, reflect: true }) accessor compact = false;
  /** `default` (muted ink) or `inverse` (on an ink-filled selected filter pill). */
  @property({ reflect: true }) accessor tone: 'default' | 'inverse' = 'default';
  /** Full accessible text, such as "12 unread notifications". The visible number is then hidden from assistive technology. */
  @property() accessor label = '';

  /** The text shown, for example `1,284`, `1.28M` or `99+`. */
  get display(): string {
    const v = Number(this.value);
    if (this.value === undefined || this.value === null || !Number.isFinite(v)) return '';
    const max = this.max === undefined || this.max === null ? NaN : Number(this.max);
    if (Number.isFinite(max) && v > max) return `${formatCount(max)}+`;
    return this.compact ? readmeCompact(formatCompact(v)) : formatCount(v);
  }

  override render() {
    const text = this.display;
    if (!text) return nothing;
    if (this.label) {
      return html`<span part="count" class="n" aria-hidden="true">${text}</span><span class="visually-hidden">${this.label}</span>`;
    }
    return html`<span part="count" class="n">${text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-count': MmCount;
  }
}
