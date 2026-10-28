import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { rovingKeydown } from '../../core/roving.js';
import { formatShortcut, isApple } from '../../core/platform.js';
import '@marmotdata/icons/define.js';

/** A point or box to open a menu against, such as the pointer position for a context menu. */
export interface MenuVirtualAnchor {
  getBoundingClientRect(): DOMRect;
  contextElement?: Element;
}

export interface MenuShowOptions {
  /** Element or virtual point to position against. Defaults to `anchor`. */
  anchor?: Element | MenuVirtualAnchor;
  /** Which item receives focus: `first` (default), `last` or `none`. */
  focus?: 'first' | 'last' | 'none';
  /** Skip the open transition. Keyboard opens are always instant. */
  instant?: boolean;
  /** Where focus goes when the menu closes with Escape, Tab or a selection. */
  returnFocus?: HTMLElement | null;
}

export interface MenuSelectDetail {
  item: MmMenuItem;
  value: string;
}

const deepActive = (): HTMLElement | null => {
  let el = document.activeElement as HTMLElement | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
  return el;
};

/**
 * Menus hold secondary actions behind a "More" button or a right-click. A menu is a raised layer
 * with `radius-md` and `shadow-float`. Opened from the keyboard it appears instantly; opened with
 * the pointer it fades in over `--mm-dur-menu`. Destructive items come last, after a separator,
 * in crimson with an icon and a word naming what is destroyed ("Delete asset").
 *
 * Without `anchor` the menu renders inline as a static list. With `anchor` (an element or the id of
 * one in the same root) it becomes a light-dismiss popover positioned against it, opened with `open`
 * or `show()`. Keyboard model: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ (arrow keys
 * wrap, Home and End, typeahead, Enter and Space activate, Escape closes and returns focus to the
 * trigger, Tab closes).
 *
 * @tagname mm-menu
 * @summary A list of actions, inline or floating.
 * @slot - `mm-menu-item`, `mm-menu-separator` and `mm-menu-group` elements.
 * @csspart menu - The list wrapper.
 * @cssprop --mm-menu-min-width - Minimum width of the menu (default 220px).
 * @fires mm-select - {MenuSelectDetail} An item was activated. Cancel it to keep a floating menu open.
 * @fires mm-open - {} The floating menu opened.
 * @fires mm-close - {} The floating menu closed.
 */
export class MmMenu extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: var(--mm-menu-min-width, 220px);
        max-width: min(360px, calc(100vw - var(--space-4)));
        padding: var(--space-1);
        background: var(--mm-raised);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        font: var(--text-dense);
        overflow: auto;
        overscroll-behavior: contain;
      }
      :host([popover]) {
        inset: auto;
        margin: 0;
        box-shadow: var(--shadow-float);
        z-index: var(--mm-z-popover);
      }
      :host(:popover-open) {
        opacity: 1;
        transform: scale(1);
        transition:
          opacity var(--mm-dur-menu) var(--mm-ease),
          transform var(--mm-dur-menu) var(--mm-ease);
      }
      @starting-style {
        :host(:popover-open) {
          opacity: 0;
          transform: scale(0.97);
        }
      }
      :host([data-instant]:popover-open) {
        transition: none;
      }
      :host([data-placement^='bottom']) { transform-origin: top; }
      :host([data-placement^='top']) { transform-origin: bottom; }
      :host([data-placement$='-start']) { transform-origin: top left; }
      :host([data-placement^='top'][data-placement$='-start']) { transform-origin: bottom left; }
      :host([data-placement$='-end']) { transform-origin: top right; }
      :host([data-placement^='top'][data-placement$='-end']) { transform-origin: bottom right; }
      @media (prefers-reduced-motion: reduce) {
        :host(:popover-open) {
          transform: none;
        }
      }
      .list {
        display: grid;
      }
    `,
  ];

  /** Opens and closes a floating menu (one with an `anchor`). */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** The trigger: an element, or the id of an element in the same document or shadow root. Makes the menu float. */
  @property() accessor anchor: string | Element | null = null;
  /** Floating UI placement against the anchor. */
  @property({ reflect: true }) accessor placement: Placement = 'bottom-start';
  /** Accessible name of the menu. Menu buttons fill this from their label. */
  @property() accessor label = '';

  #cleanup?: () => void;
  #pending: MenuShowOptions = {};
  #returnTo: HTMLElement | null = null;
  #shown = false;
  #typed = '';
  #typedTimer?: ReturnType<typeof setTimeout>;
  #focusOnClose = false;

  constructor() {
    super();
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
    this.addEventListener('click', (e) => this.#onClick(e));
    this.addEventListener('pointerover', (e) => this.#onPointerOver(e));
    this.addEventListener('toggle', (e) => this.#onToggle(e as ToggleEvent));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'menu');
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#cleanup?.();
    this.#cleanup = undefined;
  }

  /** Every item that belongs to this menu, in order. */
  get items(): MmMenuItem[] {
    return [...this.querySelectorAll<MmMenuItem>('mm-menu-item')].filter((el) => el.closest('mm-menu') === this);
  }

  /** True when the menu floats over the page rather than sitting inline. */
  get floating(): boolean {
    return this.anchor != null && this.anchor !== '';
  }

  /** Opens the floating menu. */
  show(options: MenuShowOptions = {}): void {
    this.#pending = options;
    if (this.open && this.#shown) {
      this.#reveal();
      return;
    }
    this.open = true;
  }

  /** Closes the floating menu. With `returnFocus`, focus goes back to the trigger. */
  hide(returnFocus = false): void {
    this.#focusOnClose = returnFocus;
    this.open = false;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('label')) {
      if (this.label) this.setAttribute('aria-label', this.label);
      else if (changed.get('label')) this.removeAttribute('aria-label');
    }
    if (changed.has('anchor') && this.floating && !this.hasAttribute('popover')) this.setAttribute('popover', 'auto');
    if (changed.has('open')) {
      if (this.open) this.#reveal();
      else if (this.#shown) this.#conceal();
    }
  }

  protected override firstUpdated(): void {
    this.#resetTabStops();
  }

  #resolveAnchor(): Element | MenuVirtualAnchor | null {
    if (this.#pending.anchor) return this.#pending.anchor;
    if (this.anchor instanceof Element) return this.anchor;
    if (typeof this.anchor === 'string' && this.anchor) {
      const root = this.getRootNode() as Document | ShadowRoot;
      return root.getElementById?.(this.anchor) ?? null;
    }
    return null;
  }

  #reveal() {
    const opts = this.#pending;
    const anchor = this.#resolveAnchor();
    if (!anchor || !this.isConnected) {
      // Inline menus have nothing to open.
      if (!this.floating && !opts.anchor) this.open = false;
      return;
    }
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'auto');
    this.toggleAttribute('data-instant', !!opts.instant || openedFromKeyboard());
    this.#returnTo =
      opts.returnFocus ?? (anchor instanceof HTMLElement ? anchor : (deepActive() as HTMLElement | null));
    this.#cleanup?.();
    try {
      if (!this.matches(':popover-open')) this.showPopover();
    } catch {
      this.open = false;
      return;
    }
    const contextElement = anchor instanceof Element ? anchor : (anchor.contextElement ?? this);
    const reference = anchor instanceof Element ? anchor : ({ getBoundingClientRect: () => anchor.getBoundingClientRect(), contextElement } as unknown as Element);
    this.#cleanup = float(reference, this, { placement: this.placement, offset: 4 });
    const wasShown = this.#shown;
    this.#shown = true;
    const items = this.#enabled();
    const target = opts.focus === 'last' ? items[items.length - 1] : opts.focus === 'none' ? undefined : items[0];
    this.items.forEach((el) => (el.tabIndex = -1));
    if (target) {
      target.tabIndex = 0;
      target.focus({ preventScroll: true });
    }
    if (!wasShown) emit(this, 'mm-open', {});
  }

  #conceal() {
    this.#shown = false;
    this.#cleanup?.();
    this.#cleanup = undefined;
    try {
      if (this.matches(':popover-open')) this.hidePopover();
    } catch {
      /* already closed */
    }
    const back = this.#returnTo;
    const refocus = this.#focusOnClose;
    this.#focusOnClose = false;
    this.#pending = {};
    emit(this, 'mm-close', {});
    if (refocus && back?.isConnected) back.focus({ preventScroll: true });
  }

  #onToggle(e: ToggleEvent) {
    // Light dismiss (click outside, or another popover opening) closes the popover without us.
    if (e.newState === 'closed' && this.open && !this.matches(':popover-open')) this.open = false;
  }

  #enabled() {
    return this.items.filter((el) => !el.disabled);
  }

  #resetTabStops() {
    if (this.floating) return;
    const items = this.items;
    const first = items.find((el) => !el.disabled);
    if (items.some((el) => el.tabIndex === 0 && !el.disabled)) return;
    items.forEach((el) => (el.tabIndex = el === first ? 0 : -1));
  }

  #itemFrom(e: Event): MmMenuItem | null {
    for (const node of e.composedPath()) {
      if (node === this) return null;
      if (node instanceof MmMenuItem) return node.closest('mm-menu') === this ? node : null;
    }
    return null;
  }

  #onClick(e: MouseEvent) {
    const item = this.#itemFrom(e);
    if (item) this.activate(item);
  }

  #onPointerOver(e: PointerEvent) {
    if (!this.open || e.pointerType === 'touch') return;
    const item = this.#itemFrom(e);
    if (!item || item.disabled || item === document.activeElement) return;
    this.items.forEach((el) => (el.tabIndex = el === item ? 0 : -1));
    item.focus({ preventScroll: true });
  }

  /** Activates an item as if it had been clicked: toggles checkable items, fires `mm-select` and closes a floating menu. */
  activate(item: MmMenuItem): void {
    if (item.disabled) return;
    if (item.type === 'checkbox') item.checked = !item.checked;
    else if (item.type === 'radio') {
      const scope = item.closest('mm-menu-group') ?? this;
      scope.querySelectorAll<MmMenuItem>('mm-menu-item[type="radio"]').forEach((el) => {
        if (el.closest('mm-menu') === this) el.checked = el === item;
      });
    }
    const ok = emit<MenuSelectDetail>(this, 'mm-select', { item, value: item.value || item.text }, { cancelable: true });
    if (ok && this.open && item.type === 'normal') this.hide(true);
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    const items = this.items;
    const active = this.#itemFrom(e);
    const current = active ? items.indexOf(active) : -1;
    switch (e.key) {
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          e.stopPropagation();
          this.hide(true);
        }
        return;
      case 'Tab':
        if (this.open) {
          // Return focus to the trigger without preventing default, so Tab carries on from there.
          this.#returnTo?.focus({ preventScroll: true });
          this.open = false;
        }
        return;
      case 'Enter':
      case ' ':
        if (active) {
          e.preventDefault();
          this.activate(active);
        }
        return;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        if (current < 0 && (e.key === 'ArrowDown' || e.key === 'Home')) {
          e.preventDefault();
          this.#focus(this.#enabled()[0]);
          return;
        }
        if (current < 0) {
          e.preventDefault();
          this.#focus(this.#enabled().at(-1));
          return;
        }
        rovingKeydown(e, items, current, { orientation: 'vertical', wrap: true });
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      e.preventDefault();
      this.#typeahead(e.key, current);
    }
  }

  #focus(item: MmMenuItem | undefined) {
    if (!item) return;
    this.items.forEach((el) => (el.tabIndex = el === item ? 0 : -1));
    item.focus();
  }

  #typeahead(char: string, current: number) {
    clearTimeout(this.#typedTimer);
    this.#typedTimer = setTimeout(() => (this.#typed = ''), 500);
    this.#typed += char.toLowerCase();
    const items = this.items;
    const repeat = [...this.#typed].every((c) => c === this.#typed[0]);
    const query = repeat ? this.#typed[0]! : this.#typed;
    // A fresh search, or the same letter repeated, starts after the current item; a longer prefix may match it.
    const start = query.length === 1 ? current + 1 : Math.max(current, 0);
    for (let n = 0; n < items.length; n++) {
      const item = items[(start + n) % items.length]!;
      if (!item.disabled && item.text.toLowerCase().startsWith(query)) {
        this.#focus(item);
        return;
      }
    }
  }

  override render() {
    return html`<div class="list" part="menu"><slot @slotchange=${() => this.#resetTabStops()}></slot></div>`;
  }
}

/**
 * One action in an `mm-menu`: 32px (`--mm-menu-row`), an optional 16px icon, a sentence-case label
 * of a verb and an object, and an optional keyboard shortcut drawn as a keycap. Use `type` for
 * checkable items, `danger` for destructive actions (always with an icon and a word naming what is
 * destroyed) and `description` for a short second line.
 *
 * @tagname mm-menu-item
 * @summary An action in a menu.
 * @slot - The label.
 * @slot icon - A custom leading icon, instead of the `icon` attribute.
 * @csspart icon - The leading icon.
 * @csspart check - The check mark of a checkable item.
 * @csspart label - The label.
 * @csspart description - The second line.
 * @csspart shortcut - The keycap.
 */
export class MmMenuItem extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: var(--mm-menu-row, 32px);
        padding: var(--space-1) 10px;
        border-radius: var(--radius-sm);
        font: var(--text-dense);
        color: var(--mm-text);
        cursor: pointer;
        user-select: none;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host(:hover),
      :host(:focus) {
        background: var(--mm-sunken);
        outline: none;
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: -2px;
      }
      :host([danger]) {
        color: var(--mm-danger);
      }
      :host([disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
      }
      :host([disabled]:hover) {
        background: transparent;
      }
      .icon,
      ::slotted([slot='icon']) {
        flex: none;
        color: var(--mm-text-2);
      }
      :host([danger]) .icon {
        color: var(--mm-danger);
      }
      .check {
        flex: none;
        width: 16px;
        height: 16px;
        color: var(--mm-text);
      }
      .text {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .label {
        overflow-wrap: anywhere;
      }
      .description {
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .kbd {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        margin-inline-start: var(--space-3);
        font: var(--text-keycap);
        letter-spacing: var(--tracking-keycap);
        color: var(--mm-text-2);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-bottom-width: 2px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
      }
      @media (pointer: coarse) {
        :host {
          min-height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** `normal` (default), `checkbox` (menuitemcheckbox) or `radio` (menuitemradio, one per group). */
  @property({ reflect: true }) accessor type: 'normal' | 'checkbox' | 'radio' = 'normal';
  /** Checked state of a checkbox or radio item. */
  @property({ type: Boolean, reflect: true }) accessor checked = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Destructive action, shown in crimson. Pair it with an icon and a word naming what is destroyed. */
  @property({ type: Boolean, reflect: true }) accessor danger = false;
  /** Leading Material Symbols icon name. */
  @property() accessor icon = '';
  /** Shortcut such as `mod+c` or `shift+del`, drawn as a keycap for the current platform. */
  @property() accessor shortcut = '';
  /** A short second line in `--mm-text-2`. */
  @property() accessor description = '';
  /** Value sent in `mm-select`. Defaults to the label text. */
  @property() accessor value = '';

  /** The label text, used for typeahead. */
  get text(): string {
    // Only text and element nodes: Lit's comment markers carry template text that would break typeahead.
    return [...this.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && !n.slot))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
  }

  protected override updated(): void {
    const role = this.type === 'checkbox' ? 'menuitemcheckbox' : this.type === 'radio' ? 'menuitemradio' : 'menuitem';
    this.setAttribute('role', role);
    if (this.type === 'normal') this.removeAttribute('aria-checked');
    else this.setAttribute('aria-checked', String(this.checked));
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    if (this.description) this.setAttribute('aria-description', this.description);
    else this.removeAttribute('aria-description');
    if (this.shortcut) this.setAttribute('aria-keyshortcuts', ariaShortcut(this.shortcut));
    else this.removeAttribute('aria-keyshortcuts');
  }

  override render() {
    const checkable = this.type !== 'normal';
    return html`
      ${checkable
        ? html`<mm-icon part="check" class="check" name="check" style=${this.checked ? '' : 'visibility:hidden'}></mm-icon>`
        : nothing}
      ${this.icon ? html`<mm-icon part="icon" class="icon" name=${this.icon}></mm-icon>` : html`<slot name="icon"></slot>`}
      <span class="text">
        <span part="label" class="label"><slot></slot></span>
        ${this.description ? html`<span part="description" class="description" aria-hidden="true">${this.description}</span>` : nothing}
      </span>
      ${this.shortcut
        ? html`<kbd part="shortcut" class="kbd" aria-hidden="true">${formatShortcut(this.shortcut).join(' ')}</kbd>`
        : nothing}
    `;
  }
}

function ariaShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((k) => {
      const key = k.trim().toLowerCase();
      if (key === 'mod') return isApple() ? 'Meta' : 'Control';
      if (key === 'shift') return 'Shift';
      if (key === 'alt') return 'Alt';
      if (key === 'del') return 'Delete';
      if (key === 'esc') return 'Escape';
      return key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
    })
    .join('+');
}

/**
 * A hairline between groups of menu items. Destructive items sit after one.
 *
 * @tagname mm-menu-separator
 * @summary A rule between menu items.
 */
export class MmMenuSeparator extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 1px;
      margin: var(--space-1) 0;
      background: var(--mm-rule);
    }
  `;
  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'separator');
  }
}

/**
 * A labelled set of related menu items. Radio items in a group are mutually exclusive.
 *
 * @tagname mm-menu-group
 * @summary A labelled group of menu items.
 * @slot - `mm-menu-item` elements.
 * @csspart label - The visible group label.
 */
export class MmMenuGroup extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: grid;
      }
      .label {
        padding: var(--space-2) 10px var(--space-1);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
    `,
  ];
  /** Group label, shown above the items and used as the accessible name. */
  @property() accessor label = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'group');
  }
  protected override updated(): void {
    if (this.label) this.setAttribute('aria-label', this.label);
    else this.removeAttribute('aria-label');
  }
  override render() {
    return html`${this.label ? html`<div part="label" class="label" aria-hidden="true">${this.label}</div>` : nothing}<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-menu': MmMenu;
    'mm-menu-item': MmMenuItem;
    'mm-menu-separator': MmMenuSeparator;
    'mm-menu-group': MmMenuGroup;
  }
}
