import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../menu/define.js';
import type { MmButton } from '../button/class.js';
import type { MmMenu } from '../menu/class.js';

/**
 * A menu button opens a menu of secondary actions: the "More" button on an asset row or page
 * header. The trigger is an `mm-button` with `aria-haspopup="menu"` and `aria-expanded`; the menu
 * is a slotted `mm-menu`. Use an icon-only ghost button (`icon="more-horiz"` with `label`) for row
 * actions, or a labelled button with a chevron where the menu needs naming.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/): Enter, Space and ArrowDown open
 * the menu and focus its first item; ArrowUp opens it on the last item. Escape closes it and returns
 * focus to the button.
 *
 * @tagname mm-menu-button
 * @summary A button that opens a menu.
 * @slot - One `mm-menu`.
 * @csspart trigger - The `mm-button` trigger.
 * @csspart button - The trigger's native button, for joining it to other buttons.
 */
export class MmMenuButton extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      mm-button {
        flex: 1;
      }
      ::slotted(mm-menu:not(:popover-open)) {
        display: none;
      }
      .chevron {
        margin-inline-end: -4px;
      }
    `,
  ];

  /** Trigger variant: `secondary` (default), `ghost` or `primary`. */
  @property({ reflect: true }) accessor variant: 'primary' | 'secondary' | 'ghost' = 'secondary';
  /** `md` (default) or `sm`. */
  @property({ reflect: true }) accessor size: 'md' | 'sm' = 'md';
  /** Leading icon. With `icon-only`, the only thing shown. */
  @property() accessor icon = '';
  /** The button text, or the accessible name and tooltip when `icon-only`. Defaults to "More actions". */
  @property() accessor label = '';
  /** Shows only the icon; `label` becomes the accessible name. */
  @property({ type: Boolean, reflect: true, attribute: 'icon-only' }) accessor iconOnly = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Placement of the menu against the button. */
  @property() accessor placement: Placement = 'bottom-start';
  /** Whether the menu is open. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  @query('mm-button') accessor #trigger!: MmButton | null;
  #menu: MmMenu | null = null;
  #wasOpen = false;

  constructor() {
    super();
    this.addEventListener('mm-open', (e) => {
      if (e.target === this.#menu) this.open = true;
    });
    this.addEventListener('mm-close', (e) => {
      if (e.target === this.#menu) this.open = false;
    });
  }

  /** The slotted menu. */
  get menu(): MmMenu | null {
    return this.#menu;
  }

  override focus(options?: FocusOptions): void {
    this.#trigger?.focus(options);
  }

  /** Opens the menu and focuses its first (or last) item. */
  show(focus: 'first' | 'last' = 'first'): void {
    if (this.disabled || !this.#menu) return;
    this.#wire();
    this.#menu.show({ focus, returnFocus: this.#trigger });
  }

  hide(returnFocus = false): void {
    this.#menu?.hide(returnFocus);
  }

  #wire() {
    const menu = this.#menu;
    const trigger = this.#trigger;
    if (!menu || !trigger) return;
    menu.anchor = trigger;
    menu.placement = this.placement;
    if (!menu.label) menu.label = this.#name;
  }

  get #name() {
    return this.label || t('moreActions');
  }

  #onSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this.#menu = (slot.assignedElements({ flatten: true }).find((el) => el.localName === 'mm-menu') as MmMenu | undefined) ?? null;
    this.#wire();
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('placement') || changed.has('label')) this.#wire();
    if (changed.has('open') && this.#menu && this.#menu.open !== this.open) {
      if (this.open) this.show();
      else this.hide();
    }
  }

  #onPointerDown = () => {
    // A press on the trigger light-dismisses the open popover before the click arrives; remember it so the click does not reopen.
    this.#wasOpen = !!this.#menu?.open;
  };

  #onClick = () => {
    if (this.disabled) return;
    const wasOpen = this.#wasOpen || !!this.#menu?.open;
    this.#wasOpen = false;
    if (wasOpen) this.hide(true);
    else this.show('first');
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (this.disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show(e.key === 'ArrowUp' ? 'last' : 'first');
    }
  };

  override render() {
    const name = this.#name;
    return html`<mm-button
        part="trigger"
        exportparts="button"
        variant=${this.variant}
        size=${this.size}
        icon=${this.icon}
        label=${this.iconOnly ? name : ''}
        haspopup="menu"
        expanded=${this.open ? 'true' : 'false'}
        ?disabled=${this.disabled}
        @pointerdown=${this.#onPointerDown}
        @click=${this.#onClick}
        @keydown=${this.#onKeydown}
        >${this.iconOnly ? '' : html`${name}<mm-icon class="chevron" name="expand-more"></mm-icon>`}</mm-button
      ><slot @slotchange=${this.#onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-menu-button': MmMenuButton;
  }
}
