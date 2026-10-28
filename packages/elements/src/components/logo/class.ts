import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { base } from '../../core/styles.js';
import { wordmark } from './artwork.js';

/** Clear space around the logo, as a share of the wordmark's height (its cap height, rounded up). */
export const CLEAR_SPACE_RATIO = 0.65;
/** The wordmark's "M" occupies the first 46 units of its 177.75-unit-wide artwork. */
const MONOGRAM_WIDTH = 46;

/**
 * The Marmot logo is the wordmark, rendered from the fixed artwork in the Logos asset group. It is
 * used as supplied, so the wordmark font is not loaded. It takes ink (`mm-text`): dark
 * ink on Light and paper-coloured ink on Peat. The monogram is the wordmark's own "M", cropped from
 * the same artwork, for places too narrow for the full name such as the collapsed sidebar rail. There
 * is no pictorial mark. Keep clear space of at least `CLEAR_SPACE_RATIO` of the height around it, and
 * never place it in a tile or on a gradient.
 *
 * @tagname mm-logo
 * @summary The Marmot wordmark, or its "M" monogram, as fixed artwork.
 * @csspart logo - The element carrying the accessible name.
 * @csspart wordmark - The artwork.
 * @cssprop --mm-logo-monogram - Set to `1` to crop to the monogram from CSS, as the collapsed sidebar rail does. Default `0`.
 */
export class MmLogo extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        color: var(--mm-text);
        line-height: 0;
      }
      .logo {
        display: inline-flex;
        align-items: center;
        /* Fixed artwork: never mirrored in right-to-left pages. */
        direction: ltr;
      }
      :host([clear-space]) .logo {
        padding: calc(var(--_size) * ${CLEAR_SPACE_RATIO});
      }
      .wordmark {
        display: block;
        flex: none;
        overflow: hidden;
        height: var(--_size);
        /* Full width, or the "M" alone when --mm-logo-monogram is 1. */
        --_crop: var(--mm-logo-monogram, 0);
        width: calc(var(--_size) * (${wordmark.width / wordmark.height} - var(--_crop) * ${(wordmark.width - MONOGRAM_WIDTH) / wordmark.height}));
      }
      :host([variant='monogram']) .wordmark {
        --_crop: 1;
      }
      .wordmark svg {
        display: block;
        /* The artwork has no fill of its own: set it in ink. */
        fill: currentColor;
        height: var(--_size);
        width: calc(var(--_size) * ${wordmark.width / wordmark.height});
      }
    `,
  ];

  /** `wordmark` (default) or `monogram`, the wordmark's "M" alone. */
  @property({ reflect: true }) accessor variant: 'wordmark' | 'monogram' = 'wordmark';
  /** Height in pixels of the artwork box. */
  @property({ type: Number }) accessor size = 24;
  /** Accessible name. Set it to an empty string when the logo sits beside the visible name "Marmot". */
  @property() accessor label = 'Marmot';
  /** Pads the logo by its minimum clear space. */
  @property({ type: Boolean, reflect: true, attribute: 'clear-space' }) accessor clearSpace = false;

  override render() {
    const size = Number.isFinite(this.size) && this.size > 0 ? this.size : 24;
    const named = this.label.trim() !== '';
    return html`<span
      part="logo"
      class="logo"
      style="--_size:${size}px"
      role=${named ? 'img' : 'presentation'}
      aria-label=${named ? this.label : nothing}
      aria-hidden=${named ? nothing : 'true'}
    >
      <span part="wordmark" class="wordmark" aria-hidden="true">${unsafeHTML(wordmark.svg)}</span>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-logo': MmLogo;
  }
}
