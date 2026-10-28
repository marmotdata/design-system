import { LitElement, css, html } from 'lit';
import { base } from '../../core/styles.js';
import '../menu/define.js';
import type { MmMenu } from '../menu/class.js';

const deepActive = (): HTMLElement | null => {
  let el = document.activeElement as HTMLElement | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
  return el;
};

/**
 * A context menu offers the actions for whatever was right-clicked: a row in an assets table, a
 * node on the lineage canvas. It wraps that content and opens its `mm-menu` (in the `menu` slot)
 * at the pointer, or at the focused element when opened with Shift+F10 or the Menu key. Context
 * menus always appear instantly. Every action in one must also be reachable another way, such as
 * a row's "More" menu button, because right-click is not discoverable.
 *
 * Keyboard: Shift+F10 or the ContextMenu key opens the menu; inside it, the menu keyboard model
 * applies (https://www.w3.org/WAI/ARIA/apg/patterns/menu/), and Escape returns focus to where it was.
 *
 * @tagname mm-context-menu
 * @summary Opens a menu on right-click or Shift+F10.
 * @slot - The content the menu belongs to.
 * @slot menu - One `mm-menu`.
 */
export class MmContextMenu extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      ::slotted(mm-menu:not(:popover-open)) {
        display: none;
      }
    `,
  ];

  #menu: MmMenu | null = null;
  #target: Element | null = null;
  #suppressUntil = 0;

  constructor() {
    super();
    this.addEventListener('contextmenu', (e) => this.#onContextMenu(e));
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
  }

  /** The slotted menu. */
  get menu(): MmMenu | null {
    return this.#menu;
  }

  /** The element the menu was last opened on: the right-clicked or focused element. Read it in `mm-select` to know which row to act on. */
  get target(): Element | null {
    return this.#target;
  }

  /** Opens the menu at a viewport point. */
  openAt(x: number, y: number, target: Element | null = null): void {
    const menu = this.#menu;
    if (!menu) return;
    this.#target = target;
    const rect = new DOMRect(x, y, 0, 0);
    menu.show({ anchor: { getBoundingClientRect: () => rect, contextElement: this }, instant: true, returnFocus: deepActive() });
  }

  /** Opens the menu against an element, as the keyboard does. */
  openOn(el: Element): void {
    const menu = this.#menu;
    if (!menu) return;
    this.#target = el;
    menu.show({ anchor: el, instant: true, returnFocus: deepActive() });
  }

  #inMenu(e: Event) {
    return !!this.#menu && e.composedPath().includes(this.#menu);
  }

  #onContextMenu(e: MouseEvent) {
    if (this.#inMenu(e) || !this.#menu) return;
    e.preventDefault();
    if (performance.now() < this.#suppressUntil) return;
    const target = (e.composedPath()[0] as Element | undefined) ?? null;
    // Keyboard-generated contextmenu events (Menu key) carry no pointer position.
    if (e.clientX === 0 && e.clientY === 0 && target) {
      this.openOn(target);
      return;
    }
    this.openAt(e.clientX, e.clientY, target);
  }

  #onKeydown(e: KeyboardEvent) {
    if (this.#inMenu(e) || !this.#menu) return;
    if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
      e.preventDefault();
      const el = deepActive();
      if (!el || !this.contains(el.getRootNode() instanceof ShadowRoot ? (el.getRootNode() as ShadowRoot).host : el)) return;
      // The browser may still fire a contextmenu event for this key press; ignore it.
      this.#suppressUntil = performance.now() + 300;
      this.openOn(el);
    }
  }

  #onSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this.#menu = (slot.assignedElements().find((el) => el.localName === 'mm-menu') as MmMenu | undefined) ?? null;
  }

  override render() {
    return html`<slot></slot><slot name="menu" @slotchange=${this.#onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-context-menu': MmContextMenu;
  }
}
