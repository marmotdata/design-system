import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import type { ThemeChangeDetail } from '../top-bar/class.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../logo/define.js';

/** One place in the site header's navigation. */
export interface SiteNavItem {
  /** The visible name, such as "Docs". */
  label: string;
  /** Where it goes. Absolute URLs work on every site; a site may pass its own relative paths. */
  href: string;
  /** Leaves the Marmot sites (Discord, say): opens in a new tab with the open-in-new icon. */
  external?: boolean;
}

export interface SiteMenuToggleDetail {
  /** Whether the menu is asked to open (`true`) or close (`false`). */
  open: boolean;
}

export interface SiteNavigateDetail {
  /** The link's `href`. */
  href: string;
  /** The link's label, or "Marmot home" for the wordmark. */
  label: string;
}

const SITE = 'https://marmotdata.io';
const CLOUD = 'https://cloud.marmotdata.io';

/** The public sites' navigation, with absolute URLs so the same list works on every site. */
export const defaultSiteNavItems = (): SiteNavItem[] => [
  { label: tr('siteNavDocs', 'Docs'), href: `${SITE}/docs/introduction` },
  { label: tr('siteNavPlugins', 'Plugins'), href: 'https://plugins.marmotdata.io' },
  { label: tr('siteNavPricing', 'Pricing'), href: `${SITE}/pricing` },
  { label: tr('siteNavResources', 'Resources'), href: `${SITE}/resources` },
  { label: tr('siteNavBlog', 'Blog'), href: `${SITE}/blog` },
  { label: tr('siteNavCommunity', 'Community'), href: 'https://discord.gg/TWCk7hVFN4', external: true },
];

const darkFromDocument = (): boolean => {
  if (typeof document === 'undefined') return false;
  const set = document.documentElement.dataset.theme;
  if (set === 'dark' || set === 'light') return set === 'dark';
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * The header shared by Marmot's public sites: marmotdata.io and its docs, the plugin directory and
 * Marmot Cloud's signed-out pages. It is the public counterpart of `mm-top-bar`, so it is chrome and
 * stays quiet: `mm-chrome` with a hairline below, `mm-text-2` links that turn ink on hover, and one
 * primary button at the end. The wordmark links home; the current section (`current`) is ink with the
 * active tab's 2px burnt-sienna rule, sitting flush on the header's bottom hairline.
 *
 * Layout is the same on every site: the header spans the full width and its content starts at the
 * page gutter (`space-8`, `space-4` under 720px, as `.mm-container` does) with no centred maximum
 * width, so the wordmark never drifts inwards on a wide screen. It is sticky and 57px tall (a 56px
 * bar and the hairline); give the page `scroll-padding-top: 57px` so anchors and focused elements are
 * never hidden under it.
 *
 * Under 880px, or whenever the full row does not fit (a wide search, a long translation), the links,
 * GitHub and Sign in move into a menu: a disclosure button at the end opens a
 * panel under the bar (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). Escape closes it and
 * returns focus to the button. A site with its own narrow-screen navigation (Docusaurus's sidebar)
 * cancels `mm-menu-toggle` and sets `nav-expanded` instead. Under 440px the wordmark crops to its "M".
 *
 * The theme button switches between Light and Peat the way `setTheme` from `@marmotdata/svelte` does:
 * it sets `data-theme` on the document element and stores the choice under `mm-theme`. It fires
 * `mm-theme-change` first; cancel it to apply the theme yourself (Docusaurus's colour mode). The
 * button follows `data-theme` however it changes.
 *
 * Signed out, the end shows Sign in and Start for free; with `signed-in`, Open console. Internal link
 * clicks fire a cancelable `mm-navigate` so a single-page app can route instead of loading a page.
 *
 * @tagname mm-site-header
 * @summary The public sites' header: wordmark, sections, search, GitHub, theme and sign-in actions.
 * @slot search - The site's search, such as Docusaurus's search bar. Stays in the bar at every width.
 * @csspart bar - The bar.
 * @csspart brand - The wordmark link.
 * @csspart nav - The navigation in the bar.
 * @csspart link - Each navigation link, in the bar and in the menu panel.
 * @csspart github - The GitHub button.
 * @csspart theme - The theme button.
 * @csspart sign-in - The Sign in button.
 * @csspart primary - Start for free, or Open console when signed in.
 * @csspart menu-button - The narrow-screen menu button.
 * @csspart panel - The narrow-screen menu panel.
 * @fires mm-theme-change - {ThemeChangeDetail} The theme button was activated. Cancel it to stop the document's `data-theme` and the stored `mm-theme` changing.
 * @fires mm-menu-toggle - {SiteMenuToggleDetail} The menu button was activated. Cancel it to open your own narrow-screen navigation instead of the panel.
 * @fires mm-navigate - {SiteNavigateDetail} An internal link or the wordmark was clicked without a modifier key. Cancel it to route in a single-page app.
 */
export class MmSiteHeader extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        --_bar: calc(var(--space-12) + var(--space-2));
        --_gutter: var(--space-8);
        display: block;
        position: sticky;
        inset-block-start: 0;
        z-index: var(--mm-z-sticky);
        background: var(--mm-chrome);
        color: var(--mm-text-2);
        border-block-end: 1px solid var(--mm-rule);
      }
      .bar {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-6);
        block-size: var(--_bar);
        padding-inline: var(--_gutter);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        flex: none;
        color: var(--mm-text);
        border-radius: var(--radius-sm);
      }
      .nav {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        min-inline-size: 0;
      }
      .link {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        block-size: var(--control-h);
        font: var(--text-button);
        letter-spacing: var(--tracking-button);
        color: var(--mm-text-2);
        text-decoration: none;
        white-space: nowrap;
        border-radius: var(--radius-sm);
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      .link:hover,
      .link[aria-current='page'] {
        color: var(--mm-text);
      }
      /* The current section reads like the active tab: an ink word over a 2px burnt-sienna rule that
         sits on the header's own hairline, whatever the link's height. */
      .nav .link[aria-current='page']::after {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block-end: calc((var(--control-h) - var(--_bar)) / 2 - 1px);
        block-size: 2px;
        background: var(--mm-primary);
      }
      .link mm-icon {
        color: var(--mm-text-3);
      }
      .end {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        margin-inline-start: auto;
        min-inline-size: 0;
      }
      .search {
        display: flex;
        align-items: center;
        min-inline-size: 0;
      }
      .search:not(.filled) {
        display: none;
      }
      .sign-in {
        margin-inline-start: var(--space-1);
      }
      .menu-button {
        display: none;
        align-items: center;
        justify-content: center;
        inline-size: var(--control-h);
        block-size: var(--control-h);
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--mm-text-2);
        cursor: pointer;
        flex: none;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .menu-button:hover,
      .menu-button:active {
        background: var(--mm-sunken);
        color: var(--mm-text);
      }
      .panel {
        display: none;
      }
      /* Measured at their natural width, so #measure knows what the full row needs. */
      .nav,
      .end {
        flex: none;
      }
      /* Narrow: under 880px, or whenever the full row does not fit (see #measure). */
      .narrow .bar {
        gap: var(--space-3);
      }
      .narrow .nav,
      .narrow .wide {
        display: none;
      }
      .narrow .menu-button {
        display: inline-flex;
      }
      .narrow .panel:not([hidden]) {
        display: grid;
        position: absolute;
        inset-inline: 0;
        inset-block-start: 100%;
        /* Down over the hairline, so the panel continues the bar. */
        margin-block-start: 1px;
        padding: var(--space-2) var(--_gutter) var(--space-4);
        background: var(--mm-chrome);
        border-block-end: 1px solid var(--mm-rule);
        max-block-size: calc(100dvh - var(--_bar) - 1px);
        overflow-y: auto;
      }
      .narrow .panel nav,
      .narrow .panel .more {
        display: grid;
      }
      .narrow .panel .more {
        margin-block-start: var(--space-2);
        padding-block-start: var(--space-2);
        border-block-start: 1px solid var(--mm-rule);
      }
      .narrow .panel .link {
        block-size: auto;
        min-block-size: var(--target-touch);
        padding-inline: var(--space-2);
        font: var(--text-body);
        letter-spacing: normal;
      }
      .narrow .panel .link:hover {
        background: var(--mm-sunken);
      }
      .narrow .panel .link[aria-current='page'] {
        background: var(--mm-selected);
        font: var(--text-body-strong);
      }
      @media (max-width: 719.98px) {
        :host {
          --_gutter: var(--space-4);
        }
      }
      @media (max-width: 439.98px) {
        .brand mm-logo {
          --mm-logo-monogram: 1;
        }
      }
      @media (pointer: coarse) {
        .menu-button {
          min-inline-size: var(--target-touch);
          min-block-size: var(--target-touch);
        }
      }
    `,
  ];

  /** The navigation links, as `{ label, href, external? }`. Defaults to Docs, Plugins, Pricing, Resources, Blog and Community on marmotdata.io. */
  @property({ attribute: false }) accessor items: SiteNavItem[] | undefined;
  /** The current section, by its label (case-insensitive) or href, such as `Plugins`. Marked with `aria-current="page"`. */
  @property({ reflect: true }) accessor current = '';
  /** Shows Open console in place of Sign in and Start for free. */
  @property({ type: Boolean, reflect: true, attribute: 'signed-in' }) accessor signedIn = false;
  /** Hides the primary action (Start for free or Open console), where the page's own hero carries it. */
  @property({ type: Boolean, reflect: true, attribute: 'no-cta' }) accessor noCta = false;
  /** Where the wordmark goes. */
  @property({ attribute: 'home-href' }) accessor homeHref = SITE;
  /** Where Sign in goes. */
  @property({ attribute: 'sign-in-href' }) accessor signInHref = `${CLOUD}/login`;
  /** Where Start for free goes. */
  @property({ attribute: 'sign-up-href' }) accessor signUpHref = `${CLOUD}/signup`;
  /** Where Open console goes. */
  @property({ attribute: 'console-href' }) accessor consoleHref = `${CLOUD}/console`;
  /** The GitHub repository. */
  @property({ attribute: 'github-href' }) accessor githubHref = 'https://github.com/marmotdata/marmot';
  /** Accessible name of the navigation. Defaults to "Main". */
  @property() accessor label = '';
  /** Whether the built-in menu panel is open (narrow screens). */
  @property({ type: Boolean, reflect: true, attribute: 'menu-open' }) accessor menuOpen = false;
  /** Whether your own narrow-screen navigation is open, for the menu button's `aria-expanded`. Set it when you cancel `mm-menu-toggle`. */
  @property({ type: Boolean, reflect: true, attribute: 'nav-expanded' }) accessor navExpanded = false;

  @state() accessor #dark = false;
  @state() accessor #hasSearch = false;
  @state() accessor #narrow = false;
  @query('.menu-button') accessor #menuButton!: HTMLButtonElement | null;
  @query('.bar') accessor #bar!: HTMLElement | null;

  #observer: MutationObserver | undefined;
  #media: MediaQueryList | undefined;
  #narrowMedia: MediaQueryList | undefined;
  #resize: ResizeObserver | undefined;
  /** The width the full row needs, measured whenever it is shown. */
  #needed = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window === 'undefined') return;
    this.#dark = darkFromDocument();
    this.#observer = new MutationObserver(this.#syncTheme);
    this.#observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    this.#media = matchMedia('(prefers-color-scheme: dark)');
    this.#media.addEventListener('change', this.#syncTheme);
    this.#narrowMedia = matchMedia('(max-width: 879.98px)');
    this.#narrowMedia.addEventListener('change', this.#measure);
    this.#narrow = this.#narrowMedia.matches;
    this.addEventListener('keydown', this.#onKeydown);
  }

  protected override firstUpdated(): void {
    if (typeof ResizeObserver === 'undefined') return;
    // The bar for the space there is; the nav and the end (with the slotted search) for what the row needs.
    this.#resize = new ResizeObserver(this.#measure);
    for (const el of this.renderRoot.querySelectorAll('.bar, .nav, .end')) this.#resize.observe(el);
    // Decide before the first paint rather than on the observer's first callback, once the buttons and icons inside have rendered.
    this.#measure();
    const inner = [...this.renderRoot.querySelectorAll('*')].filter((el): el is LitElement => el instanceof LitElement);
    void Promise.all(inner.map((el) => el.updateComplete)).then(this.#measure);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#media?.removeEventListener('change', this.#syncTheme);
    this.#narrowMedia?.removeEventListener('change', this.#measure);
    this.#resize?.disconnect();
    this.#resize = undefined;
    this.removeEventListener('keydown', this.#onKeydown);
    window.removeEventListener('keydown', this.#onWindowKeydown);
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('menuOpen')) {
      // While the panel is open, Escape anywhere closes it, as the guidelines ask of every popup.
      if (this.menuOpen) window.addEventListener('keydown', this.#onWindowKeydown);
      else window.removeEventListener('keydown', this.#onWindowKeydown);
    }
  }

  /** The menu button, for returning focus after closing your own narrow-screen navigation. */
  get menuButton(): HTMLButtonElement | null {
    return this.#menuButton;
  }

  /** Switches to the given theme as the theme button does. */
  setTheme(theme: 'light' | 'dark'): void {
    if (!emit<ThemeChangeDetail>(this, 'mm-theme-change', { theme }, { cancelable: true })) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('mm-theme', theme);
    } catch {
      /* storage unavailable */
    }
    this.#dark = theme === 'dark';
  }

  /** Closes the menu panel, returning focus to the menu button when asked. */
  closeMenu(returnFocus = false): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    if (returnFocus) this.#menuButton?.focus();
  }

  /** Collapses into the menu under 880px or when the full row is wider than the bar. The row is only measured while it is shown, so the two states cannot flip back and forth. */
  #measure = () => {
    const bar = this.#bar;
    if (!bar) return;
    if (!this.#narrow) {
      const root = this.renderRoot;
      const w = (sel: string) => (root.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect().width ?? 0;
      const cs = getComputedStyle(bar);
      const gap = parseFloat(cs.columnGap) || 0;
      this.#needed = w('.brand') + w('.nav') + w('.end') + 2 * gap + (parseFloat(cs.paddingInlineStart) || 0) + (parseFloat(cs.paddingInlineEnd) || 0);
    }
    const was = this.#narrow;
    this.#narrow = !!this.#narrowMedia?.matches || Math.ceil(this.#needed) > bar.getBoundingClientRect().width;
    // Back to the full row: the panel has nothing left to show.
    if (was && !this.#narrow) this.menuOpen = false;
  };

  #syncTheme = () => {
    this.#dark = darkFromDocument();
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.menuOpen) return;
    e.stopPropagation();
    this.closeMenu(true);
  };

  #onWindowKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.menuOpen || e.defaultPrevented) return;
    this.closeMenu(true);
  };

  #toggleMenu = () => {
    const open = !(this.menuOpen || this.navExpanded);
    if (!emit<SiteMenuToggleDetail>(this, 'mm-menu-toggle', { open }, { cancelable: true })) return;
    this.menuOpen = open;
  };

  #onLinkClick(e: MouseEvent, href: string, label: string) {
    if (this.menuOpen) this.menuOpen = false;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!emit<SiteNavigateDetail>(this, 'mm-navigate', { href, label }, { cancelable: true })) e.preventDefault();
  }

  #isCurrent(item: SiteNavItem): boolean {
    const c = this.current.trim().toLowerCase();
    return !!c && (item.label.toLowerCase() === c || item.href.toLowerCase() === c);
  }

  #link(item: SiteNavItem) {
    if (item.external) {
      return html`<a part="link" class="link" href=${item.href} target="_blank" rel="noopener noreferrer"
        >${item.label}<mm-icon name="open-in-new" size="14" aria-hidden="true"></mm-icon
        ><span class="visually-hidden"> ${tr('opensInNewTab', '(opens in a new tab)')}</span></a
      >`;
    }
    return html`<a
      part="link"
      class="link"
      href=${item.href}
      aria-current=${ifDefined(this.#isCurrent(item) ? 'page' : undefined)}
      @click=${(e: MouseEvent) => this.#onLinkClick(e, item.href, item.label)}
      >${item.label}</a
    >`;
  }

  override render() {
    const items = this.items ?? defaultSiteNavItems();
    const navLabel = this.label || tr('mainNavigation', 'Main');
    const homeLabel = tr('siteHome', 'Marmot home');
    const github = tr('siteGitHub', 'Marmot on GitHub');
    const expanded = this.menuOpen || this.navExpanded;
    const primary = this.noCta
      ? nothing
      : this.signedIn
        ? html`<mm-button part="primary" variant="primary" href=${this.consoleHref}>${tr('siteOpenConsole', 'Open console')}</mm-button>`
        : html`<mm-button part="primary" variant="primary" href=${this.signUpHref}>${tr('siteStartFree', 'Start for free')}</mm-button>`;
    return html`<div class=${this.#narrow ? 'root narrow' : 'root'}><div part="bar" class="bar">
        <a part="brand" class="brand" href=${this.homeHref} aria-label=${homeLabel} @click=${(e: MouseEvent) => this.#onLinkClick(e, this.homeHref, homeLabel)}>
          <mm-logo size="22" label=""></mm-logo>
        </a>
        <nav part="nav" class="nav" aria-label=${navLabel}>${items.map((i) => this.#link(i))}</nav>
        <div class="end">
          <div class=${this.#hasSearch ? 'search filled' : 'search'}>
            <slot name="search" @slotchange=${(e: Event) => (this.#hasSearch = (e.target as HTMLSlotElement).assignedNodes().length > 0)}></slot>
          </div>
          <mm-button part="github" class="wide" variant="ghost" href=${this.githubHref} target="_blank" label=${`${github} ${tr('opensInNewTab', '(opens in a new tab)')}`}>
            <mm-provider-logo slot="icon" provider="github" size="16" decorative></mm-provider-logo>
          </mm-button>
          <mm-button part="theme" variant="ghost" icon="dark-mode" label=${tr('siteDarkTheme', 'Dark theme')} pressed=${this.#dark ? 'true' : 'false'} @click=${() => this.setTheme(this.#dark ? 'light' : 'dark')}></mm-button>
          ${this.signedIn
            ? nothing
            : html`<mm-button part="sign-in" class="sign-in wide" variant="ghost" href=${this.signInHref}>${tr('siteSignIn', 'Sign in')}</mm-button>`}
          ${primary}
          <button
            part="menu-button"
            class="menu-button"
            type="button"
            aria-label=${tr('siteMenu', 'Menu')}
            aria-expanded=${expanded ? 'true' : 'false'}
            aria-controls=${ifDefined(this.navExpanded ? undefined : 'panel')}
            @click=${this.#toggleMenu}
          >
            <mm-icon name=${this.menuOpen ? 'close' : 'menu'}></mm-icon>
          </button>
        </div>
      </div>
      <div part="panel" class="panel" id="panel" ?hidden=${!this.menuOpen}>
        <nav aria-label=${navLabel}>${items.map((i) => this.#link(i))}</nav>
        <div class="more">
          <a part="link" class="link" href=${this.githubHref} target="_blank" rel="noopener noreferrer"
            >GitHub<mm-icon name="open-in-new" size="14" aria-hidden="true"></mm-icon
            ><span class="visually-hidden"> ${tr('opensInNewTab', '(opens in a new tab)')}</span></a
          >
          ${this.signedIn ? nothing : html`<a part="link" class="link" href=${this.signInHref}>${tr('siteSignIn', 'Sign in')}</a>`}
        </div>
      </div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-site-header': MmSiteHeader;
  }
}
