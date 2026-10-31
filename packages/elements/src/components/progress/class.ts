import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { formatCount } from '../../core/format.js';
import { prefersReducedMotion } from '../../core/platform.js';
import { t } from '../../core/strings.js';

/**
 * Progress shows how far a long operation has got: a 4px bar on `mm-sunken` filled in
 * `mm-text-2`, and a real count ("412 / 1,280 assets") or a percentage in the text face with
 * tabular figures. The bar is never burnt sienna. Prefer counts for long operations: a number people can check beats an
 * open-ended animation. `indeterminate` exists for the moments you genuinely cannot count.
 *
 * The bar is a `progressbar` named by `label`, with `aria-valuetext` matching the readout.
 *
 * @tagname mm-progress
 * @summary Bar plus a count for long operations.
 * @csspart label - The visible label.
 * @csspart readout - The count or percentage (text face, tabular figures).
 * @csspart track - The bar track (the progressbar).
 * @csspart fill - The bar fill.
 * @cssprop --mm-progress-width - Width of the element. Defaults to 100% of its container.
 */
export class MmProgress extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: grid;
        gap: 6px;
        inline-size: var(--mm-progress-width, 100%);
        min-inline-size: 0;
      }
      .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .label {
        font: var(--text-label);
        color: var(--mm-text-2);
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .readout {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        margin-inline-start: auto;
      }
      :host([readout-position='below']) .head {
        order: 2;
        justify-content: center;
      }
      :host([readout-position='below']) .readout {
        margin-inline-start: 0;
      }
      .track {
        position: relative;
        block-size: 4px;
        background: var(--mm-sunken);
        border-radius: var(--radius-full);
        overflow: hidden;
      }
      .fill {
        position: absolute;
        inset: 0;
        background: var(--mm-text-2);
        transform-origin: left center;
        transform: scaleX(var(--_v, 0));
        transition: transform var(--mm-dur-dialog) var(--mm-ease);
      }
      :host(:dir(rtl)) .fill {
        transform-origin: right center;
      }
      .indeterminate .fill {
        transform: none;
        inline-size: 30%;
        inset-inline-end: auto;
        animation: sweep 1400ms var(--mm-ease) infinite;
      }
      :host(:dir(rtl)) .indeterminate .fill {
        animation-name: sweep-rtl;
      }
      @keyframes sweep {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(340%);
        }
      }
      @keyframes sweep-rtl {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(-340%);
        }
      }
      /* Reduced motion: no loop. The bar holds a faint full track so it still reads as working. */
      :host([data-still]) .indeterminate .fill {
        animation: none;
        inline-size: 100%;
        opacity: 0.35;
      }
      @media (prefers-reduced-motion: reduce) {
        .indeterminate .fill {
          animation: none;
          inline-size: 100%;
          opacity: 0.35;
        }
      }
    `,
  ];

  /** Current value. */
  @property({ type: Number }) accessor value = 0;
  /** Maximum value, e.g. the total asset count. */
  @property({ type: Number }) accessor max = 100;
  /** What is progressing, e.g. "Cataloguing assets". Names the progressbar; shown unless `hide-label`. */
  @property() accessor label = '';
  /** Visually hide the label (it still names the bar). */
  @property({ type: Boolean, attribute: 'hide-label', reflect: true }) accessor hideLabel = false;
  /** Unit for the count readout, e.g. "assets". Plural is your job. */
  @property() accessor unit = '';
  /** `count` ("412 / 1,280 assets", default), `percent` ("32%") or `none`. */
  @property() accessor readout: 'count' | 'percent' | 'none' = 'count';
  /** `inline` (default, opposite the label) or `below` the bar, centred, as in the loading state. */
  @property({ attribute: 'readout-position', reflect: true }) accessor readoutPosition: 'inline' | 'below' = 'inline';
  /** No known total. Prefer counts for anything long. */
  @property({ type: Boolean, reflect: true }) accessor indeterminate = false;
  /** Locale for number formatting. */
  @property() accessor locale = 'en-GB';

  protected override willUpdate(): void {
    if (typeof window !== 'undefined') this.toggleAttribute('data-still', prefersReducedMotion());
  }

  #ratio(): number {
    const max = this.max > 0 ? this.max : 100;
    return Math.min(1, Math.max(0, (this.value || 0) / max));
  }

  #readoutText(): string {
    if (this.indeterminate || this.readout === 'none') return '';
    if (this.readout === 'percent') return `${Math.round(this.#ratio() * 100)}%`;
    const unit = this.unit ? ` ${this.unit}` : '';
    return `${formatCount(this.value || 0, this.locale)} / ${formatCount(this.max, this.locale)}${unit}`;
  }

  override render() {
    const ratio = this.#ratio();
    const readout = this.#readoutText();
    const of = t('of');
    const valuetext = this.indeterminate
      ? t('loading')
      : this.readout === 'percent'
        ? readout
        : `${formatCount(this.value || 0, this.locale)} ${of} ${formatCount(this.max, this.locale)}${this.unit ? ` ${this.unit}` : ''}`;
    const showLabel = this.label && !this.hideLabel;
    return html`${showLabel || readout
        ? html`<div class="head">
            ${showLabel ? html`<span part="label" class="label" aria-hidden="true">${this.label}</span>` : nothing}
            ${readout ? html`<span part="readout" class="readout" aria-hidden="true">${readout}</span>` : nothing}
          </div>`
        : nothing}
      <div
        part="track"
        class="track ${this.indeterminate ? 'indeterminate' : ''}"
        role="progressbar"
        aria-label=${this.label || t('loading')}
        aria-valuemin="0"
        aria-valuemax=${this.indeterminate ? nothing : this.max}
        aria-valuenow=${this.indeterminate ? nothing : Math.min(this.max, Math.max(0, this.value || 0))}
        aria-valuetext=${valuetext}
        style="--_v:${ratio}"
      >
        <div part="fill" class="fill"></div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-progress': MmProgress;
  }
}
