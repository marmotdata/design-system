import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';

/**
 * Content for screen readers only: it stays in the accessibility tree but takes no space on screen.
 * Use it to name icon-only controls that cannot take a label, to add context such as "(opens in a new
 * tab)", or to give a table a caption that sighted readers get from the layout.
 *
 * With `focusable`, the content appears when something inside it takes keyboard focus, for skip links:
 * it shows as a small raised panel at the inline-start corner of the nearest positioned ancestor.
 *
 * @tagname mm-visually-hidden
 * @summary Content for screen readers only, or shown on focus for skip links.
 * @slot - The hidden content.
 */
export class MmVisuallyHidden extends LitElement {
  static override styles = [
    base,
    css`
      :host(:not(:focus-within)),
      :host(:not([focusable])) {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      :host([focusable]:focus-within) {
        position: absolute;
        inset-block-start: var(--space-2);
        inset-inline-start: var(--space-2);
        z-index: var(--mm-z-toast);
        display: block;
        padding: var(--space-2) var(--space-3);
        background: var(--mm-raised);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-float);
        font: var(--text-dense);
      }
    `,
  ];

  /** Shows the content while something inside it has focus, for skip links. */
  @property({ type: Boolean, reflect: true }) accessor focusable = false;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-visually-hidden': MmVisuallyHidden;
  }
}
