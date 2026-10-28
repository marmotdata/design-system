import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { deepActive, openedFromKeyboard } from '../../core/floating.js';
import { isModKey } from '../../core/platform.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

/** Under this width the sidebar becomes an off-canvas drawer and the page gutters shrink to space-4. */
export const SHELL_NARROW = 720;

export interface SidebarToggleDetail {
  /** The collapsed state the sidebar is about to take. */
  collapsed: boolean;
}

export interface DrawerToggleDetail {
  open: boolean;
}

/** Elements that can take sidebar state from the shell (`mm-sidebar-nav`). */
type SidebarLike = HTMLElement & { collapsed?: boolean };

/**
 * Every tabbable element under `root`, in flat-tree order, through shadow roots and slots. Used to
 * keep Tab inside the open navigation drawer.
 */
export function tabbables(root: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (node: Element) => {
    if (node instanceof HTMLElement && (node.hidden || node.inert)) return;
    if (node instanceof HTMLSlotElement) {
      node.assignedElements({ flatten: true }).forEach(visit);
      return;
    }
    if (node instanceof HTMLElement) {
      const disabled = (node as HTMLElement & { disabled?: boolean }).disabled === true;
      const focusable = node.tabIndex >= 0 && !disabled && (node.shadowRoot ? node.hasAttribute('tabindex') : true);
      if (focusable && (node.checkVisibility ? node.checkVisibility() : true)) out.push(node);
      if (node.shadowRoot) {
        [...node.shadowRoot.children].forEach(visit);
        return;
      }
    }
    [...node.children].forEach(visit);
  };
  visit(root);
  return out;
}

/**
 * The app shell lays out a Marmot screen: an optional full-width system banner, the sidebar on the
 * start edge, the top bar, the scrolling main area with page gutters (`space-8`, or `space-4` under
 * 720px) and an optional details blade on the end edge. The page is paper; the sidebar sits on
 * `mm-chrome` behind a hairline (paper on Light, sunken on Peat), so the chrome stays quieter than the data it frames.
 *
 * The shell provides the landmarks: the top bar is wrapped in a `header`, the content in `main` and
 * the blade in a labelled `aside`; slot an `mm-sidebar-nav` (a `nav`) into `sidebar`. A "Skip to
 * content" link is the first thing Tab reaches.
 *
 * ⌘B (Ctrl+B elsewhere) collapses the sidebar to a 56px rail and back, and the shell passes the state
 * to the slotted sidebar as `collapsed`. Under 720px the sidebar becomes an off-canvas drawer, opened
 * by the menu button an `mm-top-bar` shows at that width (or `openDrawer()`): a modal dialog that
 * keeps Tab inside it, closes on Escape, the scrim or a link, and returns focus to the button.
 *
 * @tagname mm-app-shell
 * @summary The app layout: banner, sidebar, top bar, main area and blade.
 * @slot - The page: a heading and the content.
 * @slot banner - One `mm-banner`, full width above everything else.
 * @slot sidebar - One `mm-sidebar-nav`.
 * @slot topbar - One `mm-top-bar`.
 * The blade column sizes to the blade it holds (an `mm-details-blade` is 36rem, or its 3rem rail
 * when folded), capped at half the shell. Full-bleed pages (a lineage canvas, a split workspace) set
 * `bleed` to drop the main area's gutters and fill it edge to edge; `data-bleed` is also honoured.
 *
 * @slot blade - A details blade on the end edge; the column takes the blade's own width. The `aside` is only shown when filled.
 * @csspart skip-link - The "Skip to content" link.
 * @csspart sidebar - The sidebar column, and the drawer under 720px.
 * @csspart topbar - The `header` around the top bar.
 * @csspart main - The scrolling `main` area.
 * @csspart blade - The `aside` around the blade.
 * @csspart scrim - The scrim behind the open drawer.
 * @cssprop --mm-shell-height - Height of the shell (default `100dvh`).
 * @fires mm-sidebar-toggle - {SidebarToggleDetail} ⌘B or the sidebar's toggle button is about to collapse or expand the sidebar. Cancel it to keep the current state.
 * @fires mm-drawer-toggle - {DrawerToggleDetail} The navigation drawer opened or closed (narrow screens).
 */
export class MmAppShell extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: grid;
        grid-template-areas:
          'banner banner banner'
          'sidebar topbar topbar'
          'sidebar main blade';
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-rows: auto auto minmax(0, 1fr);
        height: var(--mm-shell-height, 100dvh);
        position: relative;
        overflow: hidden;
        background: var(--mm-paper);
        color: var(--mm-text);
        font: var(--text-body);
        container: mm-shell / inline-size;
      }
      .skip {
        position: absolute;
        inset-block-start: var(--space-2);
        inset-inline-start: var(--space-2);
        z-index: var(--mm-z-popover);
        padding: var(--space-2) var(--space-3);
        background: var(--mm-raised);
        color: var(--mm-text);
        font: var(--text-button);
        letter-spacing: var(--tracking-button);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        text-decoration: none;
        /* Hidden off the top edge. The shadow only comes with focus, so nothing bleeds into the corner. */
        transform: translateY(calc(-100% - var(--space-4)));
      }
      .skip:focus,
      .skip:focus-visible {
        transform: none;
        box-shadow: var(--shadow-float);
      }
      .banner {
        grid-area: banner;
        min-width: 0;
      }
      .sidebar {
        grid-area: sidebar;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: auto;
        background: var(--mm-chrome);
        border-inline-end: 1px solid var(--mm-rule);
      }
      .sidebar ::slotted(*) {
        flex: 1;
        min-height: 0;
      }
      .drawer-head {
        display: none;
      }
      header {
        grid-area: topbar;
        min-width: 0;
      }
      main {
        grid-area: main;
        min-width: 0;
        overflow: auto;
        padding: var(--space-8);
        scroll-padding-block: var(--space-8);
      }
      :host([bleed]) main,
      :host([data-bleed]) main {
        padding: 0;
        scroll-padding-block: 0;
      }
      main:focus,
      main:focus-visible {
        outline: none;
      }
      aside {
        grid-area: blade;
        max-width: 50cqi;
        min-height: 0;
        overflow: auto;
        background: var(--mm-chrome);
        border-inline-start: 1px solid var(--mm-rule);
      }
      aside ::slotted(*) {
        box-sizing: border-box;
        max-inline-size: 100%;
      }
      aside[hidden] {
        display: none;
      }
      .scrim {
        display: none;
      }

      @container mm-shell (max-width: 719.98px) {
        main {
          padding: var(--space-4);
          scroll-padding-block: var(--space-4);
        }
        :host([bleed]) main,
        :host([data-bleed]) main {
          padding: 0;
          scroll-padding-block: 0;
        }
        aside {
          grid-area: 3 / 1 / 4 / -1;
          width: auto;
          max-width: none;
          /* Over the page at full width: the blade's own width must not widen the grid. */
          contain: inline-size;
          border-inline-start: 0;
          z-index: var(--mm-z-blade);
        }
        .sidebar {
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          z-index: var(--mm-z-dialog);
          width: min(280px, 85cqi);
          box-shadow: var(--shadow-dialog);
          visibility: hidden;
          transform: translateX(-100%);
          transition:
            transform var(--mm-dur-dialog) var(--mm-ease),
            visibility 0s linear var(--mm-dur-dialog);
        }
        .drawer-head {
          display: flex;
          justify-content: flex-end;
          padding: var(--space-2) var(--space-2) 0;
        }
        .scrim {
          display: block;
          position: absolute;
          inset: 0;
          z-index: var(--mm-z-dialog);
          /* No scrim token yet: ink at low opacity, from tokens only. */
          background: color-mix(in oklab, var(--mm-text) 32%, transparent);
          opacity: 0;
          visibility: hidden;
          transition:
            opacity var(--mm-dur-dialog) var(--mm-ease),
            visibility 0s linear var(--mm-dur-dialog);
        }
      }
      @container mm-shell (max-width: 719.98px) {
        :host(:dir(rtl)) .sidebar {
          transform: translateX(100%);
        }
        :host([drawer-open]) .sidebar,
        :host([drawer-open]:dir(rtl)) .sidebar {
          visibility: visible;
          transform: none;
          transition: transform var(--mm-dur-dialog) var(--mm-ease);
        }
        :host([drawer-open]) .scrim {
          visibility: visible;
          opacity: 1;
          transition: opacity var(--mm-dur-dialog) var(--mm-ease);
        }
        :host([data-instant]) .sidebar,
        :host([data-instant]) .scrim {
          transition: none;
        }
      }
      .close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--mm-control, var(--control-h));
        height: var(--mm-control, var(--control-h));
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--mm-text-2);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .close:hover {
        background: var(--mm-surface);
        color: var(--mm-text);
      }
      @media (pointer: coarse) {
        .close {
          width: var(--target-touch, 44px);
          height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** Collapses the sidebar to a 56px icon rail. Toggled by ⌘B (Ctrl+B); reflected so apps can persist it. */
  @property({ type: Boolean, reflect: true, attribute: 'sidebar-collapsed' }) accessor sidebarCollapsed = false;
  /** Whether the navigation drawer is open. Only applies under 720px. */
  @property({ type: Boolean, reflect: true, attribute: 'drawer-open' }) accessor drawerOpen = false;
  /** Turns off the ⌘B (Ctrl+B) shortcut, for example while a rich text editor that uses it has focus. */
  @property({ type: Boolean, attribute: 'no-shortcut' }) accessor noShortcut = false;
  /** Removes the main area's page gutters so the content fills it to its edges (lineage, query, glossary). The content then manages its own padding. */
  @property({ type: Boolean, reflect: true }) accessor bleed = false;
  /** Accessible name of the blade `aside`. Defaults to "Details". */
  @property({ attribute: 'blade-label' }) accessor bladeLabel = '';

  /** True under 720px, where the sidebar is a drawer. Read-only; reflected as `narrow`. */
  @state() accessor narrow = false;
  @state() accessor #hasBlade = false;

  @query('main') accessor #main!: HTMLElement | null;
  @query('.sidebar') accessor #sidebar!: HTMLElement | null;
  @query('.close') accessor #close!: HTMLElement | null;

  #ro?: ResizeObserver;
  #returnTo: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.#onGlobalKey);
    this.addEventListener('mm-nav-toggle', this.#onNavToggle);
    this.#ro = new ResizeObserver(() => this.#measure());
    this.#ro.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onGlobalKey);
    this.removeEventListener('mm-nav-toggle', this.#onNavToggle);
    this.#ro?.disconnect();
  }

  /** The `main` element, for scrolling it or moving focus to it. */
  get mainElement(): HTMLElement | null {
    return this.#main;
  }

  /** Collapses or expands the sidebar rail (or opens and closes the drawer on narrow screens), as ⌘B does. */
  toggleSidebar(): void {
    if (this.narrow) {
      if (this.drawerOpen) this.closeDrawer();
      else this.openDrawer();
      return;
    }
    const next = !this.sidebarCollapsed;
    if (emit<SidebarToggleDetail>(this, 'mm-sidebar-toggle', { collapsed: next }, { cancelable: true })) this.sidebarCollapsed = next;
  }

  /** Opens the navigation drawer (narrow screens) and moves focus into it. */
  openDrawer(returnFocus?: HTMLElement | null): void {
    if (this.drawerOpen) return;
    this.#returnTo = returnFocus ?? (deepActive() as HTMLElement | null);
    this.toggleAttribute('data-instant', openedFromKeyboard());
    this.drawerOpen = true;
  }

  /** Closes the drawer and returns focus to whatever opened it. */
  closeDrawer(returnFocus = true): void {
    if (!this.drawerOpen) return;
    this.toggleAttribute('data-instant', openedFromKeyboard());
    this.drawerOpen = false;
    const back = this.#returnTo;
    this.#returnTo = null;
    // The rest of the shell is inert until the next render, so return focus after it.
    if (returnFocus && back) void this.updateComplete.then(() => back.isConnected && back.focus({ preventScroll: true }));
  }

  #measure() {
    const narrow = this.getBoundingClientRect().width < SHELL_NARROW;
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      if (!narrow && this.drawerOpen) this.closeDrawer(false);
    }
  }

  #onGlobalKey = (e: KeyboardEvent) => {
    if (this.noShortcut || e.defaultPrevented || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== 'b' || !isModKey(e)) return;
    e.preventDefault();
    this.toggleSidebar();
  };

  #onNavToggle = () => {
    if (this.drawerOpen) this.closeDrawer();
    else this.openDrawer(deepActive() as HTMLElement | null);
  };

  #skip(e: Event) {
    e.preventDefault();
    if (this.drawerOpen) this.closeDrawer(false);
    this.#main?.focus();
  }

  #onSidebarKeydown(e: KeyboardEvent) {
    if (!this.narrow || !this.drawerOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeDrawer();
      return;
    }
    if (e.key !== 'Tab' || !this.#sidebar) return;
    const items = tabbables(this.#sidebar);
    if (!items.length) return;
    const active = deepActive();
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  #onSidebarClick(e: MouseEvent) {
    if (!this.narrow || !this.drawerOpen) return;
    // Following a link in the drawer closes it.
    const link = e.composedPath().find((n) => n instanceof HTMLAnchorElement && n.hasAttribute('href'));
    if (link) this.closeDrawer(false);
  }

  #sync() {
    const sidebar = this.renderRoot?.querySelector<HTMLSlotElement>('slot[name="sidebar"]');
    sidebar?.assignedElements().forEach((el) => {
      const s = el as SidebarLike;
      el.toggleAttribute('drawer', this.narrow);
      if ('collapsed' in s) s.collapsed = this.sidebarCollapsed && !this.narrow;
    });
    const topbar = this.renderRoot?.querySelector<HTMLSlotElement>('slot[name="topbar"]');
    topbar?.assignedElements().forEach((el) => {
      if ('navExpanded' in el) (el as HTMLElement & { navExpanded: boolean }).navExpanded = this.drawerOpen && this.narrow;
    });
  }

  #onBladeSlot(e: Event) {
    this.#hasBlade = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || !!n.textContent?.trim());
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('narrow')) this.toggleAttribute('narrow', this.narrow);
    if (changed.has('sidebarCollapsed') || changed.has('narrow') || changed.has('drawerOpen')) this.#sync();
    if (changed.has('drawerOpen') && changed.get('drawerOpen') !== undefined) {
      if (this.drawerOpen && this.narrow) {
        this.#close?.focus({ preventScroll: true });
      }
      emit<DrawerToggleDetail>(this, 'mm-drawer-toggle', { open: this.drawerOpen });
    }
  }

  override render() {
    const modal = this.narrow && this.drawerOpen;
    return html`<a part="skip-link" class="skip" href="#main" ?inert=${modal} @click=${this.#skip}>${tr('skipToContent', 'Skip to content')}</a>
      <div class="banner" ?inert=${modal}><slot name="banner"></slot></div>
      <div class="scrim" part="scrim" @click=${() => this.closeDrawer()}></div>
      <div
        class="sidebar"
        part="sidebar"
        role=${modal ? 'dialog' : nothing}
        aria-modal=${modal ? 'true' : nothing}
        aria-label=${modal ? tr('navigation', 'Navigation') : nothing}
        @keydown=${this.#onSidebarKeydown}
        @click=${this.#onSidebarClick}
      >
        ${this.narrow
          ? html`<div class="drawer-head">
              <button class="close" type="button" aria-label=${tr('closeNavigation', 'Close navigation')} @click=${() => this.closeDrawer()}>
                <mm-icon name="close"></mm-icon>
              </button>
            </div>`
          : nothing}
        <slot name="sidebar" @slotchange=${() => this.#sync()}></slot>
      </div>
      <header part="topbar" ?inert=${modal}><slot name="topbar" @slotchange=${() => this.#sync()}></slot></header>
      <main id="main" part="main" tabindex="-1" ?inert=${modal}><slot></slot></main>
      <aside part="blade" aria-label=${this.bladeLabel || tr('details', 'Details')} ?hidden=${!this.#hasBlade} ?inert=${modal}>
        <slot name="blade" @slotchange=${this.#onBladeSlot}></slot>
      </aside>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-app-shell': MmAppShell;
  }
}
