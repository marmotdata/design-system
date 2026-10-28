import { LitElement, css, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { containsDeep } from '../dialog/focus.js';
import { panelStyles, type PopoverToggleDetail } from '../popover/class.js';

/**
 * Hover cards preview what a link points to (an asset, a person, an agent) without leaving the
 * page, so people scanning a lineage list or an audit log can check an owner or a row count in
 * place. Put `mm-asset-card` or `mm-person-card` inside, or any short read-only content.
 *
 * The card appears 300ms after the pointer rests on the trigger or the trigger receives focus, not
 * instantly: moving the pointer across a dense table, or tabbing along a row of links, would
 * otherwise flash a card for every item passed over. It hides 150ms after both the pointer and
 * focus have left the trigger and the card, so the pointer can travel into the card. Touch input
 * doesn't open it. Escape hides it. It leaves focus where it is: the content follows the trigger
 * in the tab order while it is showing, and the trigger keeps its own name and destination, so the
 * card is never the only way to reach information. Shown from the keyboard, it appears without
 * a transition once the delay has passed.
 *
 * Wrap the trigger (usually a link) in the `trigger` slot, or point `for` at its id.
 *
 * @tagname mm-hover-card
 * @summary A delayed preview card for a link.
 * @slot - The card content, such as `mm-asset-card` or `mm-person-card`.
 * @slot trigger - The link or button the card previews.
 * @csspart panel - The floating panel.
 * @cssprop --mm-popover-padding - Panel padding. Defaults to `--space-4`.
 * @cssprop --mm-popover-max-width - Maximum width. Defaults to 360px.
 * @fires mm-toggle - {PopoverToggleDetail} The card was shown or hidden.
 */
export class MmHoverCard extends LitElement {
  static override styles = [
    base,
    panelStyles,
    css`
      .panel {
        min-width: 0;
        width: max-content;
      }
    `,
  ];

  /** The id of the trigger, in the same document or shadow root. */
  @property({ attribute: 'for' }) accessor htmlFor = '';
  /** Floating UI placement against the trigger. */
  @property({ reflect: true }) accessor placement: Placement = 'bottom-start';
  /** Delay before showing, in milliseconds. */
  @property({ type: Number, attribute: 'open-delay' }) accessor openDelay = 300;
  /** Delay before hiding once pointer and focus have left, in milliseconds. */
  @property({ type: Number, attribute: 'close-delay' }) accessor closeDelay = 150;
  /** Whether the card is showing. Reflects. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  @query('.panel') accessor #panel!: HTMLElement | null;

  #trigger: HTMLElement | null = null;
  #slotted: HTMLElement | null = null;
  #cleanup?: () => void;
  #timer?: ReturnType<typeof setTimeout>;
  #shown = false;
  #viaFocus = false;

  /** The element the card previews. */
  get trigger(): HTMLElement | null {
    return this.#trigger;
  }

  /** Shows the card now, without the delay. */
  show(): void {
    clearTimeout(this.#timer);
    this.open = true;
  }
  /** Hides the card now. */
  hide(): void {
    clearTimeout(this.#timer);
    this.open = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
    this.#unfloat();
    this.#attach(null);
    document.removeEventListener('keydown', this.#onDocKeydown, true);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#resolveTrigger();
  }

  protected override firstUpdated(): void {
    this.#resolveTrigger();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('htmlFor') && changed.get('htmlFor') !== undefined) this.#resolveTrigger();
    if (changed.has('open')) {
      if (this.open) this.#reveal();
      else if (this.#shown) this.#conceal();
    }
  }

  #resolveTrigger() {
    let el: HTMLElement | null = null;
    if (this.htmlFor) {
      const root = this.getRootNode() as Document | ShadowRoot;
      el = (root.getElementById?.(this.htmlFor) as HTMLElement | null) ?? null;
    }
    this.#attach(el ?? this.#slotted);
  }

  #onSlotChange = (e: Event) => {
    this.#slotted = ((e.target as HTMLSlotElement).assignedElements()[0] as HTMLElement | undefined) ?? null;
    this.#resolveTrigger();
  };

  #attach(el: HTMLElement | null) {
    if (el === this.#trigger) return;
    const old = this.#trigger;
    if (old) {
      old.removeEventListener('pointerenter', this.#onEnter);
      old.removeEventListener('pointerleave', this.#onLeave);
      old.removeEventListener('focusin', this.#onFocusIn);
      old.removeEventListener('focusout', this.#onFocusOut);
    }
    this.#trigger = el;
    if (!el) return;
    el.addEventListener('pointerenter', this.#onEnter);
    el.addEventListener('pointerleave', this.#onLeave);
    el.addEventListener('focusin', this.#onFocusIn);
    el.addEventListener('focusout', this.#onFocusOut);
  }

  #schedule(open: boolean) {
    clearTimeout(this.#timer);
    if (open === this.open) return;
    this.#timer = setTimeout(() => (this.open = open), open ? this.openDelay : this.closeDelay);
  }

  #onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.#viaFocus = false;
    this.#schedule(true);
  };

  #onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    if (this.#focusInside()) return;
    this.#schedule(false);
  };

  #onFocusIn = () => {
    this.#viaFocus = true;
    this.#schedule(true);
  };

  #onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && this.#contains(to)) return;
    this.#schedule(false);
  };

  #contains(node: Node): boolean {
    const panel = this.#panel;
    return (!!panel && containsDeep(panel, node)) || (!!this.#trigger && containsDeep(this.#trigger, node)) || containsDeep(this, node);
  }

  #focusInside(): boolean {
    let el = document.activeElement as Element | null;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return !!el && el !== document.body && this.#contains(el);
  }

  #onDocKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.open) return;
    // Escape hides the card first; a dialog around it stays open.
    e.preventDefault();
    e.stopPropagation();
    this.hide();
  };

  #reveal() {
    const panel = this.#panel;
    const trigger = this.#trigger;
    if (!panel || !trigger || !this.isConnected) {
      this.open = false;
      return;
    }
    panel.toggleAttribute('data-instant', this.#viaFocus && openedFromKeyboard());
    try {
      if (!panel.matches(':popover-open')) panel.showPopover();
    } catch {
      this.open = false;
      return;
    }
    this.#unfloat();
    this.#cleanup = float(trigger, panel, { placement: this.placement, offset: 6 });
    this.#shown = true;
    document.addEventListener('keydown', this.#onDocKeydown, true);
    emit<PopoverToggleDetail>(this, 'mm-toggle', { open: true });
  }

  #conceal() {
    this.#shown = false;
    this.#unfloat();
    document.removeEventListener('keydown', this.#onDocKeydown, true);
    try {
      if (this.#panel?.matches(':popover-open')) this.#panel.hidePopover();
    } catch {
      /* already closed */
    }
    emit<PopoverToggleDetail>(this, 'mm-toggle', { open: false });
  }

  #unfloat() {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }

  override render() {
    return html`<slot name="trigger" @slotchange=${this.#onSlotChange}></slot
      ><div
        part="panel"
        class="panel"
        popover="manual"
        @pointerenter=${() => clearTimeout(this.#timer)}
        @pointerleave=${(e: PointerEvent) => !this.#focusInside() && e.pointerType !== 'touch' && this.#schedule(false)}
        @focusin=${() => clearTimeout(this.#timer)}
        @focusout=${this.#onFocusOut}
      >
        <slot></slot>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-hover-card': MmHoverCard;
  }
}
