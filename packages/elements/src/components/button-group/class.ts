import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';

/*
 * Joining buttons means squaring the inner corners of each button's own shadow part, which only a
 * stylesheet in the tree that contains the buttons can reach (`::slotted()` cannot be followed by
 * `::part()`). The group adopts this small sheet into its root node once.
 */
const joinCss = `
mm-button-group[attached]:not([orientation='vertical']) > :is(mm-button, mm-menu-button):not(:first-child)::part(button) {
  border-start-start-radius: 0; border-end-start-radius: 0;
}
mm-button-group[attached]:not([orientation='vertical']) > :is(mm-button, mm-menu-button):not(:last-child)::part(button) {
  border-start-end-radius: 0; border-end-end-radius: 0;
}
mm-button-group[attached][orientation='vertical'] > :is(mm-button, mm-menu-button):not(:first-child)::part(button) {
  border-start-start-radius: 0; border-start-end-radius: 0;
}
mm-button-group[attached][orientation='vertical'] > :is(mm-button, mm-menu-button):not(:last-child)::part(button) {
  border-end-start-radius: 0; border-end-end-radius: 0;
}
`;
let joinSheet: CSSStyleSheet | undefined;

/**
 * A button group gathers related buttons under one label: view switches in a toolbar, zoom
 * controls on the lineage canvas. Spaced groups sit `space-2` apart; `attached` groups join the
 * buttons edge to edge with one shared border and square inner corners, and each button keeps its
 * own focus ring and tab stop. For one choice among options, use a segmented control instead.
 *
 * https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ covers arrow-key toolbars; a button group is a
 * plain `role="group"` and every button stays in the tab order.
 *
 * @tagname mm-button-group
 * @summary Groups related buttons, spaced or attached.
 * @slot - `mm-button` and `mm-menu-button` elements.
 */
export class MmButtonGroup extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        vertical-align: middle;
      }
      :host([orientation='vertical']) {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      :host([attached]) {
        gap: 0;
        flex-wrap: nowrap;
      }
      ::slotted(*) {
        position: relative;
      }
      :host([attached]:not([orientation='vertical'])) ::slotted(:not(:first-child)) {
        margin-inline-start: -1px;
      }
      :host([attached][orientation='vertical']) ::slotted(:not(:first-child)) {
        margin-block-start: -1px;
      }
      ::slotted(:hover),
      ::slotted(:focus-within) {
        z-index: 1;
      }
    `,
  ];

  /** Accessible name of the group, such as "Zoom" or "Lineage view". */
  @property() accessor label = '';
  /** `horizontal` (default) or `vertical`. */
  @property({ reflect: true }) accessor orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** Joins the buttons edge to edge with one shared border. */
  @property({ type: Boolean, reflect: true }) accessor attached = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'group');
    this.#adopt();
  }

  #adopt() {
    if (typeof CSSStyleSheet === 'undefined') return;
    const root = this.getRootNode() as Document | ShadowRoot;
    if (!('adoptedStyleSheets' in root)) return;
    if (!joinSheet) {
      joinSheet = new CSSStyleSheet();
      joinSheet.replaceSync(joinCss);
    }
    if (!root.adoptedStyleSheets.includes(joinSheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, joinSheet];
  }

  protected override updated(): void {
    if (this.label) this.setAttribute('aria-label', this.label);
    else this.removeAttribute('aria-label');
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-button-group': MmButtonGroup;
  }
}
