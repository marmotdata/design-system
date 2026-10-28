import { LitElement, css, html, nothing, svg } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { getIcon, onRegistryChange } from './registry.js';

/**
 * An interface icon from the bundled Material Symbols Outlined subset. Icons are 16px by default and
 * take the current text colour. Decorative unless `label` is set.
 *
 * @summary Interface icon (Material Symbols Outlined), never fetched at runtime.
 * @csspart svg - The SVG element.
 * @cssprop --mm-icon-size - Overrides the size attribute.
 */
export class MmIcon extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      flex: none;
      width: var(--mm-icon-size, var(--_size));
      height: var(--mm-icon-size, var(--_size));
      color: inherit;
      vertical-align: -0.2em;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;

  /** Material Symbols name, e.g. `search`, `smart-toy`, `person`. The outlined variant is used when one exists. */
  @property({ reflect: true }) accessor name = '';
  /** Accessible label. Without it the icon is hidden from assistive technology. */
  @property() accessor label = '';
  /** Pixel size: 14, 16 (default), 20 or 24. */
  @property({ type: Number }) accessor size = 16;

  #unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unsubscribe = onRegistryChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
  }

  override render() {
    this.style.setProperty('--_size', `${this.size}px`);
    const icon = getIcon(this.name);
    if (!icon) return nothing;
    return html`<svg
      part="svg"
      viewBox="0 0 ${icon.width} ${icon.height}"
      role=${this.label ? 'img' : 'presentation'}
      aria-hidden=${this.label ? 'false' : 'true'}
      aria-label=${this.label || nothing}
      fill="currentColor"
    >${svg`${unsafeSVG(icon.body)}`}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-icon': MmIcon;
  }
}
