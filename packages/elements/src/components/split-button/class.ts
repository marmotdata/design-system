import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t } from '../../core/strings.js';
import '../button/define.js';
import '../menu-button/define.js';
import type { MmButton } from '../button/class.js';
import type { MmMenuButton } from '../menu-button/class.js';

/**
 * A split button pairs one primary action with a chevron menu of close alternatives: "Run query"
 * with "Run and export CSV" and "Explain query". The two parts share one border and join with
 * square inner corners; each has its own focus ring and tab stop. Use it only when the main action
 * is clearly the common case. If the alternatives are equally likely, use a menu button instead.
 *
 * The chevron follows the menu button keyboard model
 * (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/).
 *
 * @tagname mm-split-button
 * @summary A primary action with a menu of alternatives.
 * @slot - One `mm-menu` holding the alternatives.
 * @csspart action - The primary `mm-button`.
 * @csspart toggle - The chevron `mm-menu-button`.
 * @fires mm-action - {} The primary part was activated.
 */
export class MmSplitButton extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .group {
        display: inline-flex;
      }
      .action,
      .toggle {
        position: relative;
      }
      ::slotted(mm-menu:not(:popover-open)) {
        display: none;
      }
      .action:focus-within,
      .toggle:focus-within,
      .action:hover,
      .toggle:hover {
        z-index: 1;
      }
      .action::part(button) {
        border-start-end-radius: 0;
        border-end-end-radius: 0;
      }
      .toggle::part(button) {
        border-start-start-radius: 0;
        border-end-start-radius: 0;
        padding-inline: 0;
      }
      /* Secondary: the parts overlap by one pixel so they share a single border. */
      :host([variant='secondary']) .toggle {
        margin-inline-start: -1px;
      }
      /* Primary: a divider in the pressed shade separates the two parts on the filled ground. */
      :host([variant='primary']) .toggle::part(button) {
        border-inline-start-color: var(--mm-primary-hover);
      }
    `,
  ];

  /** `primary` (default) or `secondary`. */
  @property({ reflect: true }) accessor variant: 'primary' | 'secondary' = 'primary';
  /** `md` (default) or `sm`. */
  @property({ reflect: true }) accessor size: 'md' | 'sm' = 'md';
  /** Text of the primary action, a verb and an object. */
  @property() accessor label = '';
  /** Leading icon of the primary action. */
  @property() accessor icon = '';
  /** Accessible name of the chevron. Defaults to "More actions"; name the alternatives where you can ("More run options"). */
  @property({ attribute: 'menu-label' }) accessor menuLabel = '';
  /** Accessible name of the group. Defaults to `label`. */
  @property({ attribute: 'group-label' }) accessor groupLabel = '';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Shows a spinner on the primary part and blocks it; the menu stays available. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;

  @query('.action') accessor #action!: MmButton | null;
  @query('.toggle') accessor #toggle!: MmMenuButton | null;

  override focus(options?: FocusOptions): void {
    this.#action?.focus(options);
  }

  /** The chevron menu button. */
  get toggle(): MmMenuButton | null {
    return this.#toggle;
  }

  #onAction = () => {
    if (this.disabled || this.loading) return;
    emit(this, 'mm-action', {});
  };

  override render() {
    return html`<div class="group" role="group" aria-label=${this.groupLabel || this.label}>
      <mm-button
        part="action"
        class="action"
        variant=${this.variant}
        size=${this.size}
        icon=${this.icon}
        ?disabled=${this.disabled}
        ?loading=${this.loading}
        @click=${this.#onAction}
        >${this.label}</mm-button
      ><mm-menu-button
        part="toggle"
        class="toggle"
        variant=${this.variant}
        size=${this.size}
        icon="expand-more"
        icon-only
        placement="bottom-end"
        label=${this.menuLabel || t('moreActions')}
        ?disabled=${this.disabled}
        ><slot></slot
      ></mm-menu-button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-split-button': MmSplitButton;
  }
}
