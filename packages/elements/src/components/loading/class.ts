import { LitElement, css, html, nothing, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { prefersReducedMotion } from '../../core/platform.js';
import { t } from '../../core/strings.js';
import { FIELD_H, FIELD_W, topographyLines } from '../topography/field.js';

/**
 * The loading state is a survey being drawn: a patch of the abstract topography field, cropped and
 * dissolving at its edges, whose hairlines ink themselves in behind the caption. It appears after a
 * 200ms delay so fast loads never flash, and then stays for at least 400ms. Under reduced motion the
 * lines appear at once. The field is background, never an icon: the caption (and its live
 * announcement) carries the meaning. For long operations, slot an `mm-progress` with a real count
 * ("412 / 1,280 assets") rather than leaving people with an open-ended drawing.
 *
 * Toggle `active` to finish loading rather than removing the element, so the 400ms minimum holds.
 *
 * @tagname mm-loading
 * @summary Topographic draw-in loading state.
 * @slot - Optional progress, usually an `mm-progress` with a count.
 * @csspart drawing - The background field SVG.
 * @csspart caption - The caption text.
 * @cssprop --mm-loading-gap - Space between caption and progress.
 */
export class MmLoading extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        position: relative;
        isolation: isolate;
        display: grid;
        justify-items: center;
        align-content: center;
        gap: var(--mm-loading-gap, var(--space-2));
        color: var(--mm-text-2);
      }
      .field {
        position: absolute;
        inset: 0;
        z-index: -1;
        display: block;
        inline-size: 100%;
        block-size: 100%;
        pointer-events: none;
        color: var(--mm-text);
        /* Dissolves at every edge, so the patch never reads as a framed object. */
        mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, currentColor 35%, transparent 100%);
      }
      .field path {
        fill: none;
        stroke: color-mix(in oklab, var(--mm-rule) 85%, transparent);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: draw 1200ms var(--mm-ease) forwards;
        animation-delay: calc(var(--i, 0) * 50ms);
      }
      .field path.index {
        stroke: color-mix(in oklab, var(--mm-rule), var(--mm-text-3) 30%);
      }
      @keyframes draw {
        to {
          stroke-dashoffset: 0;
        }
      }
      :host([data-still]) .field path {
        animation: none;
        stroke-dashoffset: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        .field path {
          animation: none;
          stroke-dashoffset: 0;
        }
      }
      .sizer {
        display: grid;
        place-content: center;
        justify-items: center;
        gap: inherit;
        min-inline-size: min(var(--w), 100%);
        min-block-size: var(--h);
      }
      .caption {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        text-align: center;
        max-inline-size: 46ch;
        overflow-wrap: anywhere;
      }
      ::slotted(*) {
        inline-size: min(240px, 100%);
      }
    `,
  ];

  /** Whether something is loading. The field appears 200ms after this turns on and stays at least 400ms. */
  @property({ type: Boolean, reflect: true }) accessor active = true;
  /** Visible caption, e.g. "Surveying shop.orders.v2…". Also the announced text; defaults to "Loading". */
  @property() accessor caption = '';
  /** Ground seed. The same seed always draws the same field. */
  @property({ type: Number }) accessor seed = 7;
  /** `sparse` (the default) or `normal` line density. */
  @property() accessor density: 'sparse' | 'normal' = 'sparse';
  /** Minimum width of the field patch in px. */
  @property({ type: Number }) accessor width = 160;
  /** Minimum height of the field patch in px. */
  @property({ type: Number }) accessor height = 96;

  #delayed = new DelayedVisibility(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.#delayed.set(this.active);
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('active') && this.isConnected) this.#delayed.set(this.active);
    if (typeof window !== 'undefined') this.toggleAttribute('data-still', prefersReducedMotion());
  }

  override render() {
    const label = this.caption || t('loading');
    const lines = topographyLines(this.seed, this.density === 'normal' ? 'normal' : 'sparse');
    // The live region stays rendered so the announcement is reliable once the field appears.
    return html`<div role="status" class="visually-hidden">${this.#delayed.visible ? label : nothing}</div>
      ${this.#delayed.visible
        ? html`<svg part="drawing" class="field" viewBox="0 0 ${FIELD_W} ${FIELD_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              ${lines.map((l, i) => svg`<path d=${l.d} class=${l.index ? 'index' : nothing} pathLength="1" style="--i:${i}"></path>`)}
            </svg>
            <div class="sizer" style="--w:${this.width}px;--h:${this.height}px">
              ${this.caption ? html`<p part="caption" class="caption" aria-hidden="true">${this.caption}</p>` : nothing}
              <slot></slot>
            </div>`
        : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-loading': MmLoading;
  }
}
