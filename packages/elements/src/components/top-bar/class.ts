import { LitElement, css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { isApple, isModKey } from '../../core/platform.js';
import { t, tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../count/define.js';
import '../kbd/define.js';
import '../menu/define.js';
import type { MmMenu, MenuSelectDetail } from '../menu/class.js';

export interface OpenSearchDetail {
  /** `click` for the trigger, `shortcut` for ⌘K. */
  source: 'click' | 'shortcut';
}

export type ThemeChoice = 'light' | 'dark' | 'system';
export interface ThemeChangeDetail {
  theme: ThemeChoice;
}

/**
 * The top bar runs across the main column of the app shell: 52px on paper with a hairline below. It
 * holds page context on the start side (breadcrumbs), the global search trigger in the centre, and
 * notifications, help and the avatar menu on the end side. It is chrome, so it stays quiet: no fills,
 * no burnt sienna, `mm-text-2` icons.
 *
 * The search trigger looks like a search field, reads "Search the catalog" and shows the ⌘K keycap.
 * It does not take text: it fires `mm-open-search` so the app can open its command palette. With
 * `global-shortcut`, ⌘K (Ctrl+K elsewhere) fires it from anywhere on the page.
 *
 * Inside `mm-app-shell` under 720px a menu button appears at the start to open the navigation drawer.
 *
 * @tagname mm-top-bar
 * @summary The app's top bar: page context, global search, notifications and the avatar menu.
 * @slot start - Page context, usually `mm-breadcrumbs`.
 * @slot search - Replaces the built-in search trigger.
 * @slot end - Extra actions and the `mm-avatar-menu`, after the bell and help buttons.
 * @csspart bar - The bar.
 * @csspart nav-toggle - The menu button that opens the navigation drawer on narrow screens.
 * @csspart search - The search trigger.
 * @csspart notifications - The bell button.
 * @fires mm-open-search - {OpenSearchDetail} The search trigger was activated or ⌘K pressed.
 * @fires mm-open-notifications - {} The bell was activated.
 * @fires mm-nav-toggle - {} The narrow-screen menu button was activated. `mm-app-shell` opens its drawer.
 */
export class MmTopBar extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
      }
      .bar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        /* 52px: a 36px control with space-2 above and below. */
        height: calc(var(--control-h) + 2 * var(--space-2));
        padding-inline: var(--space-4);
        background: var(--mm-paper);
        color: var(--mm-text-2);
        border-bottom: 1px solid var(--mm-rule);
        font: var(--text-dense);
      }
      .start,
      .end {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .end {
        justify-content: flex-end;
      }
      .start ::slotted(*) {
        min-width: 0;
      }
      .search {
        flex: 0 1 420px;
        min-width: 0;
        display: flex;
        justify-content: center;
      }
      .trigger {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        height: var(--mm-control, var(--control-h));
        padding: 0 var(--space-1) 0 10px;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-sm);
        background: var(--mm-sunken);
        color: var(--mm-text-2);
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
        text-align: start;
        cursor: pointer;
        transition:
          border-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .trigger:hover,
      .trigger:active {
        border-color: var(--mm-control-border);
        color: var(--mm-text);
      }
      .trigger .ph {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .icon-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-1);
        min-width: var(--mm-control, var(--control-h));
        height: var(--mm-control, var(--control-h));
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--mm-text-2);
        font: inherit;
        cursor: pointer;
        flex: none;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .icon-btn:hover,
      .icon-btn:active {
        background: var(--mm-sunken);
        color: var(--mm-text);
      }
      .icon-btn mm-count {
        --mm-count-color: var(--mm-text-2);
      }
      .nav-toggle {
        display: none;
      }
      :host([nav-toggle]) .nav-toggle {
        display: inline-flex;
      }
      @container mm-shell (max-width: 719.98px) {
        .nav-toggle {
          display: inline-flex;
        }
        .bar {
          gap: var(--space-2);
          padding-inline: var(--space-2);
        }
        .search {
          flex: none;
        }
        .trigger {
          width: var(--mm-control, var(--control-h));
          padding: 0;
          justify-content: center;
          border-color: transparent;
          background: transparent;
        }
        .trigger mm-kbd {
          display: none;
        }
        .trigger .ph {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
        }
      }
      @media (pointer: coarse) {
        .icon-btn,
        .trigger {
          min-height: var(--target-touch, 44px);
          min-width: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** Placeholder text of the search trigger. Defaults to "Search the catalog". */
  @property() accessor placeholder = '';
  /** Registers ⌘K (Ctrl+K) on the window to fire `mm-open-search`. Use on one top bar per page. */
  @property({ type: Boolean, reflect: true, attribute: 'global-shortcut' }) accessor globalShortcut = false;
  /** Hides the built-in search trigger. */
  @property({ type: Boolean, reflect: true, attribute: 'no-search' }) accessor noSearch = false;
  /** Shows the notifications bell. */
  @property({ type: Boolean, reflect: true }) accessor notifications = false;
  /** Unread notifications, shown as a count beside the bell. */
  @property({ type: Number }) accessor unread = 0;
  /** URL of the help and documentation link. Shows a help button when set. */
  @property({ attribute: 'help-href' }) accessor helpHref = '';
  /** Whether the navigation drawer is open, for the menu button's `aria-expanded`. Set by `mm-app-shell`. */
  @property({ type: Boolean, attribute: 'nav-expanded' }) accessor navExpanded = false;

  @query('.trigger') accessor #trigger!: HTMLButtonElement | null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.#onGlobalKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.#onGlobalKey);
  }

  /** The search trigger, for returning focus after the palette closes. */
  get searchTrigger(): HTMLButtonElement | null {
    return this.#trigger;
  }

  #onGlobalKey = (e: KeyboardEvent) => {
    if (!this.globalShortcut || e.defaultPrevented || e.altKey || e.shiftKey) return;
    if (e.key.toLowerCase() !== 'k' || !isModKey(e)) return;
    e.preventDefault();
    emit<OpenSearchDetail>(this, 'mm-open-search', { source: 'shortcut' });
  };

  override render() {
    const unread = Number(this.unread) > 0 ? Number(this.unread) : 0;
    const placeholder = this.placeholder || tr('searchCatalog', 'Search the catalog');
    return html`<div part="bar" class="bar">
      <div class="start">
        <button
          part="nav-toggle"
          class="icon-btn nav-toggle"
          type="button"
          aria-label=${tr('openNavigation', 'Open navigation')}
          aria-expanded=${this.navExpanded ? 'true' : 'false'}
          @click=${() => emit(this, 'mm-nav-toggle', {})}
        >
          <mm-icon name="menu"></mm-icon>
        </button>
        <slot name="start"></slot>
      </div>
      <div class="search">
        <slot name="search"
          >${this.noSearch
            ? nothing
            : html`<button
                part="search"
                class="trigger"
                type="button"
                aria-haspopup="dialog"
                aria-keyshortcuts=${ifDefined(this.globalShortcut ? (isApple() ? 'Meta+K' : 'Control+K') : undefined)}
                @click=${() => emit<OpenSearchDetail>(this, 'mm-open-search', { source: 'click' })}
              >
                <mm-icon name="search"></mm-icon>
                <span class="ph">${placeholder}</span>
                ${this.globalShortcut ? html`<mm-kbd keys="mod+k" aria-hidden="true"></mm-kbd>` : nothing}
              </button>`}</slot
        >
      </div>
      <div class="end">
        ${this.notifications
          ? html`<button
              part="notifications"
              class="icon-btn"
              type="button"
              @click=${() => emit(this, 'mm-open-notifications', {})}
            >
              <mm-icon name="notifications"></mm-icon>
              <span class="visually-hidden">${t('notifications')}</span>
              ${unread
                ? html`<mm-count .value=${unread} max="99" label=${tr('unreadCount', '{count} unread', { count: unread.toLocaleString('en-GB') })}></mm-count>`
                : nothing}
            </button>`
          : nothing}
        ${this.helpHref
          ? html`<mm-button variant="ghost" icon="help" href=${this.helpHref} label=${tr('helpAndDocs', 'Help and documentation')}></mm-button>`
          : nothing}
        <slot name="end"></slot>
      </div>
    </div>`;
  }
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
};

/**
 * The avatar menu at the end of the top bar. The avatar is a person, so it is the person's initials
 * on `mm-info-soft` (or their picture) in a full circle. It opens an `mm-menu` with Account, the theme
 * (Light, Peat or System, so the toggle is no longer buried in the profile page), Language and Sign
 * out.
 *
 * Choosing a theme sets `data-theme` on the document element (System removes it so
 * `prefers-color-scheme` applies) and fires `mm-theme-change`; cancel it to apply the theme yourself.
 * Account, Language and Sign out fire `mm-select` from the menu with the values `account`,
 * `language` and `sign-out`.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/): Enter, Space and ArrowDown open
 * the menu on the first item, ArrowUp on the last; Escape closes it and returns focus to the avatar.
 *
 * @tagname mm-avatar-menu
 * @summary The signed-in person's avatar and account menu.
 * @csspart avatar - The avatar button.
 * @csspart menu - The `mm-menu`.
 * @fires mm-theme-change - {ThemeChangeDetail} A theme was chosen. Cancel it to stop the document's `data-theme` changing.
 * @fires mm-select - {MenuSelectDetail} A menu item was chosen (from the inner `mm-menu`).
 */
export class MmAvatarMenu extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--mm-control, var(--control-h));
        height: var(--mm-control, var(--control-h));
        padding: 0;
        border: 0;
        border-radius: var(--radius-full);
        background: transparent;
        cursor: pointer;
      }
      .face {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--radius-full);
        background: var(--mm-info-soft);
        color: var(--mm-text);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        overflow: hidden;
        transition: box-shadow var(--mm-dur-press) var(--mm-ease);
      }
      .avatar:hover .face,
      .avatar[aria-expanded='true'] .face {
        box-shadow: 0 0 0 2px var(--mm-control-border);
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      mm-menu:not(:popover-open) {
        display: none;
      }
      .who {
        display: grid;
        padding: var(--space-2) 10px;
        border-bottom: 1px solid var(--mm-rule);
        margin-bottom: var(--space-1);
      }
      .who b {
        font: var(--text-dense);
        font-weight: 600;
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      .who span {
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      @media (pointer: coarse) {
        .avatar {
          width: var(--target-touch, 44px);
          height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** The person's full name, used for the initials and the accessible name. */
  @property() accessor name = '';
  /** Email shown at the top of the menu. */
  @property() accessor email = '';
  /** Picture URL. Initials are shown when absent or while it loads. */
  @property() accessor src = '';
  /** The theme preference: `light`, `dark` (Peat) or `system`. Read from the document when not set. */
  @property({ reflect: true }) accessor theme: ThemeChoice | '' = '';
  /** The current language, shown as the Language item's second line, e.g. "English (UK)". */
  @property() accessor language = '';
  /** Whether the menu is open. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  @query('.avatar') accessor #button!: HTMLButtonElement | null;
  @query('mm-menu') accessor #menu!: MmMenu | null;
  #wasOpen = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.theme && typeof document !== 'undefined') {
      const current = document.documentElement.dataset.theme;
      this.theme = current === 'dark' ? 'dark' : current === 'light' ? 'light' : 'system';
    }
  }

  override focus(options?: FocusOptions): void {
    this.#button?.focus(options);
  }

  /** The inner menu. */
  get menu(): MmMenu | null {
    return this.#menu;
  }

  show(focus: 'first' | 'last' = 'first'): void {
    const menu = this.#menu;
    if (!menu || !this.#button) return;
    menu.anchor = this.#button;
    menu.show({ focus, returnFocus: this.#button });
  }

  hide(returnFocus = false): void {
    this.#menu?.hide(returnFocus);
  }

  /** Applies a theme as the menu does. */
  setTheme(theme: ThemeChoice): void {
    this.theme = theme;
    if (!emit<ThemeChangeDetail>(this, 'mm-theme-change', { theme }, { cancelable: true })) return;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }

  #onSelect(e: CustomEvent<MenuSelectDetail>) {
    const v = e.detail.value;
    if (v === 'theme-light' || v === 'theme-dark' || v === 'theme-system') this.setTheme(v.slice(6) as ThemeChoice);
  }

  #onPointerDown = () => {
    this.#wasOpen = !!this.#menu?.open;
  };

  #onClick = () => {
    const wasOpen = this.#wasOpen || !!this.#menu?.open;
    this.#wasOpen = false;
    if (wasOpen) this.hide(true);
    else this.show('first');
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show(e.key === 'ArrowUp' ? 'last' : 'first');
    }
  };

  override render() {
    const name = this.name || tr('account', 'Account');
    const label = tr('accountMenuFor', 'Account menu for {name}', { name });
    const theme = this.theme || 'system';
    return html`<button
        part="avatar"
        class="avatar"
        type="button"
        aria-haspopup="menu"
        aria-expanded=${this.open ? 'true' : 'false'}
        @pointerdown=${this.#onPointerDown}
        @click=${this.#onClick}
        @keydown=${this.#onKeydown}
      >
        <span class="face" aria-hidden="true">${this.src ? html`<img src=${this.src} alt="" />` : initials(this.name)}</span>
        <span class="visually-hidden">${label}</span>
      </button>
      <mm-menu
        part="menu"
        label=${label}
        placement="bottom-end"
        @mm-select=${this.#onSelect}
        @mm-open=${() => (this.open = true)}
        @mm-close=${() => (this.open = false)}
      >
        ${this.name || this.email
          ? html`<div class="who" aria-hidden="true">
              ${this.name ? html`<b>${this.name}</b>` : nothing}${this.email ? html`<span>${this.email}</span>` : nothing}
            </div>`
          : nothing}
        <mm-menu-item icon="account-circle" value="account" .textContent=${tr('account', 'Account')}></mm-menu-item>
        <mm-menu-separator></mm-menu-separator>
        <mm-menu-group label=${tr('theme', 'Theme')}>
          <mm-menu-item type="radio" value="theme-light" ?checked=${theme === 'light'} .textContent=${tr('themeLight', 'Light')}></mm-menu-item>
          <mm-menu-item type="radio" value="theme-dark" ?checked=${theme === 'dark'} .textContent=${tr('themePeat', 'Peat')}></mm-menu-item>
          <mm-menu-item type="radio" value="theme-system" ?checked=${theme === 'system'} .textContent=${tr('themeSystem', 'System')}></mm-menu-item>
        </mm-menu-group>
        <mm-menu-separator></mm-menu-separator>
        <mm-menu-item icon="translate" value="language" description=${ifDefined(this.language || undefined)} .textContent=${tr('language', 'Language')}></mm-menu-item>
        <mm-menu-item icon="logout" value="sign-out" .textContent=${tr('signOut', 'Sign out')}></mm-menu-item>
      </mm-menu>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-top-bar': MmTopBar;
    'mm-avatar-menu': MmAvatarMenu;
  }
}
