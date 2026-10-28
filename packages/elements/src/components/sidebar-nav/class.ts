import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { isApple } from '../../core/platform.js';
import { t, tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import '@marmotdata/icons/define.js';
import '../count/define.js';
import '../tooltip/define.js';

export interface NavGroupToggleDetail {
  open: boolean;
}
export interface NavToggleDetail {
  collapsed: boolean;
}

const RAIL = 56;

/**
 * The app's main navigation, on `mm-chrome` (paper on Light, sunken on Peat) down the start edge of the app shell. Destinations sit in
 * `mm-nav-group`s with sentence-case labels (Catalog, Work, Operate), with Settings and the Cloud
 * organisation switcher in the `footer` slot. The current page is the one place the navigation
 * carries colour: the burnt-sienna tint with ink text. Everything else is `mm-text-2` so the chrome stays
 * quieter than the page.
 *
 * With `collapsed` the navigation becomes a 56px icon rail: labels become tooltips, group labels
 * become hairlines and counts become dots. Inside `mm-app-shell` the shell sets `collapsed` (⌘B), and
 * the toggle button at the foot asks the shell to switch.
 *
 * Keyboard: items are links, so Tab moves through them in order (the APG disclosure navigation
 * pattern, https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/).
 * As a shortcut, ArrowUp and ArrowDown also move between items and group headings, and Home and End
 * jump to the first and last. This is deliberately not a roving tabindex: every destination stays one
 * Tab away, as links in a landmark should.
 *
 * @tagname mm-sidebar-nav
 * @summary The grouped sidebar navigation, with a collapsed rail.
 * @slot - `mm-nav-group` and `mm-nav-item` elements.
 * @slot header - The logo, usually `<mm-logo>`. An `mm-logo` shows its "M" monogram in the rail.
 * @slot footer - Settings and the organisation switcher.
 * @csspart nav - The `nav` landmark.
 * @csspart header - The header area.
 * @csspart groups - The scrolling list of groups.
 * @csspart footer - The footer area.
 * @csspart toggle - The collapse button.
 * @cssprop --mm-sidebar-width - Expanded width (default 240px).
 * @fires mm-sidebar-toggle - {NavToggleDetail} The toggle button changed `collapsed` (only when not inside `mm-app-shell`, which fires its own).
 */
export class MmSidebarNav extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: var(--mm-sidebar-width, 240px);
        min-height: 100%;
        background: var(--mm-chrome);
        color: var(--mm-text-2);
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
      }
      :host([collapsed]) {
        width: ${RAIL}px;
      }
      :host([drawer]) {
        width: auto;
        background: transparent;
      }
      nav {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }
      .header {
        display: flex;
        align-items: center;
        min-height: calc(var(--control-h) + 2 * var(--space-2));
        padding: var(--space-2) var(--space-4);
        overflow: hidden;
      }
      :host([collapsed]) .header {
        padding-inline: var(--space-2);
        justify-content: center;
      }
      :host([collapsed]) ::slotted(mm-logo) {
        --mm-logo-monogram: 1;
      }
      .header.empty {
        display: none;
      }
      .groups {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: grid;
        align-content: start;
        gap: var(--space-4);
        padding: var(--space-2);
      }
      :host([collapsed]) .groups {
        gap: var(--space-2);
      }
      .footer {
        display: grid;
        gap: var(--space-1);
        padding: var(--space-2);
        border-top: 1px solid var(--mm-rule);
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        height: calc(var(--mm-menu-row, 32px) + var(--space-1));
        font: var(--text-dense);
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        cursor: pointer;
        justify-self: start;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      :host([collapsed]) .toggle {
        width: 40px;
        justify-content: center;
        padding: 0;
      }
      .toggle:hover {
        background: color-mix(in oklab, var(--mm-text) 4%, var(--mm-chrome));
        color: var(--mm-text);
      }
      :host([drawer]) .toggle,
      :host([no-toggle]) .toggle {
        display: none;
      }
      .toggle mm-icon {
        flex: none;
      }
      :host(:dir(rtl)) .toggle mm-icon {
        transform: scaleX(-1);
      }
      @media (pointer: coarse) {
        .toggle {
          min-height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** Shows the 56px icon rail. Set by `mm-app-shell` when the sidebar is collapsed. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;
  /** Accessible name of the `nav` landmark. Defaults to "Main". */
  @property() accessor label = '';
  /** Hides the collapse button at the foot. */
  @property({ type: Boolean, reflect: true, attribute: 'no-toggle' }) accessor noToggle = false;

  @state() accessor #hasHeader = false;
  @query('mm-tooltip') accessor #tip!: (HTMLElement & { placement: string }) | null;

  constructor() {
    super();
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
  }

  /** Every item and group heading Up and Down move between, in order. */
  #targets(): HTMLElement[] {
    const out: HTMLElement[] = [];
    for (const el of this.querySelectorAll<HTMLElement>('mm-nav-group, mm-nav-item')) {
      if (el.closest('mm-sidebar-nav') !== this) continue;
      const group = el.parentElement?.closest('mm-nav-group') as MmNavGroup | null;
      if (group && !this.collapsed && !group.open) continue;
      if (el instanceof MmNavGroup) {
        if (el.collapsible && !this.collapsed && el.toggleButton) out.push(el);
      } else if (el instanceof MmNavItem && !el.disabled) out.push(el);
    }
    return out;
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const targets = this.#targets();
    const path = e.composedPath();
    const current = targets.findIndex((el) => (el instanceof MmNavGroup ? path.includes(el.toggleButton!) : path.includes(el)));
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowDown') next = Math.min(targets.length - 1, current + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, current - 1);
    else if (e.key === 'Home') next = 0;
    else next = targets.length - 1;
    e.preventDefault();
    const el = targets[next]!;
    if (el instanceof MmNavGroup) el.toggleButton?.focus();
    else el.focus();
  }

  /** Passes the rail state to every group, item and organisation switcher inside. */
  #propagate() {
    for (const el of this.querySelectorAll<HTMLElement & { collapsed?: boolean }>('mm-nav-group, mm-nav-item, mm-org-switcher')) {
      if ('collapsed' in el) el.collapsed = this.collapsed;
    }
  }

  #toggle() {
    const shell = this.closest('mm-app-shell') as (HTMLElement & { toggleSidebar(): void }) | null;
    if (shell && typeof shell.toggleSidebar === 'function') {
      shell.toggleSidebar();
      return;
    }
    const next = !this.collapsed;
    if (emit<NavToggleDetail>(this, 'mm-sidebar-toggle', { collapsed: next }, { cancelable: true })) this.collapsed = next;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('collapsed')) this.#propagate();
    if (this.#tip && typeof window !== 'undefined') this.#tip.placement = getComputedStyle(this).direction === 'rtl' ? 'left' : 'right';
  }

  override render() {
    const label = this.collapsed ? t('expandSidebar') : t('collapseSidebar');
    const keys = isApple() ? 'Meta+B' : 'Control+B';
    const button = html`<button
      part="toggle"
      class="toggle"
      type="button"
      aria-expanded=${this.collapsed ? 'false' : 'true'}
      aria-keyshortcuts=${keys}
      @click=${() => this.#toggle()}
    >
      <mm-icon name=${this.collapsed ? 'left-panel-open' : 'left-panel-close'}></mm-icon>
      <span class=${this.collapsed ? 'visually-hidden' : ''}>${label}</span>
    </button>`;
    return html`<nav part="nav" aria-label=${this.label || tr('mainNavigation', 'Main')}>
      <div part="header" class="header ${this.#hasHeader ? '' : 'empty'}">
        <slot name="header" @slotchange=${(e: Event) => (this.#hasHeader = (e.target as HTMLSlotElement).assignedElements().length > 0)}></slot>
      </div>
      <div part="groups" class="groups"><slot @slotchange=${() => this.#propagate()}></slot></div>
      <div part="footer" class="footer">
        <slot name="footer" @slotchange=${() => this.#propagate()}></slot>
        ${this.collapsed ? html`<mm-tooltip placement="right" content=${label}>${button}</mm-tooltip>` : button}
      </div>
    </nav>`;
  }
}

/**
 * A labelled group of destinations in `mm-sidebar-nav`, such as Catalog, Work or Operate. The label is
 * sentence case in `--text-label` and `mm-text-2`, never uppercase. With `collapsible` the label is a
 * disclosure button that shows and hides the items. In the rail the label becomes a hairline.
 *
 * @tagname mm-nav-group
 * @summary A labelled, optionally collapsible group of navigation items.
 * @slot - `mm-nav-item` elements.
 * @csspart label - The label, or the disclosure button when collapsible.
 * @csspart list - The list of items.
 * @fires mm-toggle - {NavGroupToggleDetail} A collapsible group opened or closed.
 */
export class MmNavGroup extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: grid;
        gap: 2px;
      }
      .label {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-height: 24px;
        padding: 0 var(--space-2);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      button.label {
        width: 100%;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        text-align: start;
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      button.label:hover {
        color: var(--mm-text);
        background: color-mix(in oklab, var(--mm-text) 4%, var(--mm-chrome));
      }
      .label span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .chevron {
        flex: none;
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host(:not([open])) .chevron {
        transform: rotate(-90deg);
      }
      :host(:dir(rtl):not([open])) .chevron {
        transform: rotate(90deg);
      }
      .list {
        display: grid;
        gap: 2px;
      }
      .list[hidden] {
        display: none;
      }
      :host([collapsed]) .rule {
        display: block;
        height: 1px;
        margin: 0 var(--space-2) var(--space-1);
        background: var(--mm-rule);
      }
      :host([collapsed]:first-of-type) .rule {
        display: none;
      }
      .rule {
        display: none;
      }
      @media (pointer: coarse) {
        button.label {
          min-height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** Group label, such as "Catalog". Sentence case. */
  @property() accessor label = '';
  /** Makes the label a disclosure button. */
  @property({ type: Boolean, reflect: true }) accessor collapsible = false;
  /** Whether a collapsible group shows its items. */
  @property({ type: Boolean, reflect: true }) accessor open = true;
  /** Set by `mm-sidebar-nav` for the rail. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;

  @query('button.label') accessor #button!: HTMLButtonElement | null;
  #id = uid('mm-nav-group');

  /** The disclosure button of a collapsible group. */
  get toggleButton(): HTMLButtonElement | null {
    return this.#button;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const nav = this.closest('mm-sidebar-nav') as MmSidebarNav | null;
    if (nav) this.collapsed = nav.collapsed;
  }

  #toggle() {
    this.open = !this.open;
    emit<NavGroupToggleDetail>(this, 'mm-toggle', { open: this.open });
  }

  override render() {
    const showItems = this.open || !this.collapsible || this.collapsed;
    const labelId = `${this.#id}-label`;
    let label: unknown = nothing;
    if (this.label) {
      if (this.collapsed) label = html`<span id=${labelId} class="visually-hidden">${this.label}</span>`;
      else if (this.collapsible)
        label = html`<button
          part="label"
          class="label"
          id=${labelId}
          type="button"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls="list"
          @click=${() => this.#toggle()}
        >
          <span>${this.label}</span><mm-icon class="chevron" name="expand-more"></mm-icon>
        </button>`;
      else label = html`<div part="label" class="label" id=${labelId}><span>${this.label}</span></div>`;
    }
    return html`<span class="rule" aria-hidden="true"></span>${label}
      <div part="list" class="list" id="list" role="list" aria-labelledby=${ifDefined(this.label ? labelId : undefined)} ?hidden=${!showItems}>
        <slot></slot>
      </div>`;
  }
}

/**
 * One destination in `mm-sidebar-nav`: a 16px icon, a sentence-case label, and optionally a count
 * (`mm-count`) and an attention dot. Give `href` and it is a real link; without one it is a button.
 * `current` marks the page you are on with `aria-current="page"` and the burnt-sienna tint with ink text.
 *
 * The attention dot is ochre and always carries words for assistive technology ("2 need attention").
 * In the rail the label becomes an `mm-tooltip`, and the count and attention become dots: a hollow ring
 * for a count, a filled ochre dot for attention, so they differ in shape as well as colour.
 *
 * @tagname mm-nav-item
 * @summary A link in the sidebar navigation.
 * @slot - The label.
 * @slot icon - A custom 16px icon instead of `icon`.
 * @csspart link - The link or button.
 * @csspart icon - The icon.
 * @csspart label - The label.
 * @csspart count - The count.
 * @csspart dot - The attention dot.
 */
export class MmNavItem extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      mm-tooltip {
        display: block;
      }
      .link {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        /* Slightly taller rows than menus, so the app is easy to find your way around. */
        min-height: calc(var(--mm-menu-row, 32px) + var(--space-1));
        padding: 0 var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
        text-align: start;
        text-decoration: none;
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .link:hover {
        background: color-mix(in oklab, var(--mm-text) 4%, var(--mm-chrome));
        color: var(--mm-text);
      }
      .link:active {
        background: color-mix(in oklab, var(--mm-text) 4%, var(--mm-chrome));
        color: var(--mm-text);
      }
      .link:focus-visible {
        outline-offset: -2px;
      }
      :host([current]) .link {
        background: var(--mm-selected);
        color: var(--mm-text);
        font-weight: 600;
        --mm-count-color: var(--mm-text-2);
      }
      :host([disabled]) .link {
        opacity: 0.5;
        cursor: not-allowed;
      }
      :host([disabled]) .link:hover {
        background: transparent;
        color: var(--mm-text-2);
      }
      .icon,
      ::slotted([slot='icon']) {
        flex: none;
        width: 16px;
        height: 16px;
      }
      .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .end {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: none;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: var(--radius-full);
        background: var(--mm-warning);
        flex: none;
      }
      .ring {
        width: 7px;
        height: 7px;
        border-radius: var(--radius-full);
        border: 1.5px solid var(--mm-text-2);
        flex: none;
      }
      :host([collapsed]) .link {
        width: 40px;
        justify-content: center;
        padding: 0;
      }
      :host([collapsed]) .end {
        position: absolute;
        inset-block-start: 5px;
        inset-inline-end: 7px;
        gap: 2px;
      }
      @media (pointer: coarse) {
        .link {
          min-height: var(--target-touch, 44px);
        }
      }
    `,
  ];

  /** Destination URL. Without it the item is a button. */
  @property() accessor href = '';
  @property() accessor target = '';
  /** Material Symbols icon name. */
  @property() accessor icon = '';
  /** Marks the current page: `aria-current="page"` and the selection tint. */
  @property({ type: Boolean, reflect: true }) accessor current = false;
  /** A neutral count shown at the end, such as the number of failed runs. */
  @property({ type: Number }) accessor count: number | undefined;
  /** Words for the count, read out instead of the bare number ("12 failed runs"). */
  @property({ attribute: 'count-label' }) accessor countLabel = '';
  /** How many things need attention. Shows an ochre dot and reads "{n} need attention". */
  @property({ type: Number }) accessor attention: number | undefined;
  /** Words for the attention dot, instead of "{n} need attention". */
  @property({ attribute: 'attention-label' }) accessor attentionLabel = '';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Set by `mm-sidebar-nav` for the rail. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;

  @query('.link') accessor #link!: HTMLElement | null;
  @state() accessor #rtl = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.parentElement?.localName === 'mm-nav-group') this.setAttribute('role', 'listitem');
    const nav = this.closest('mm-sidebar-nav') as MmSidebarNav | null;
    if (nav) this.collapsed = nav.collapsed;
  }

  override focus(options?: FocusOptions): void {
    this.#link?.focus(options);
  }

  /** The label text. */
  get text(): string {
    return [...this.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && !n.slot))
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
  }

  get #attentionText(): string {
    if (this.attention === undefined || this.attention === null || !(Number(this.attention) > 0)) return '';
    return this.attentionLabel || tr('needsAttention', '{count} need attention', { count: Number(this.attention) });
  }

  get #hasCount(): boolean {
    return this.count !== undefined && this.count !== null && Number.isFinite(Number(this.count));
  }

  #hadFocus = false;

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('collapsed') || typeof window === 'undefined' || !this.isConnected) return;
    this.#rtl = getComputedStyle(this).direction === 'rtl';
    this.#hadFocus = this.matches(':focus-within');
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    // The link is re-created when the rail wraps it in a tooltip; keep focus on it.
    if (changed.has('collapsed') && this.#hadFocus) {
      this.#hadFocus = false;
      this.#link?.focus({ preventScroll: true });
    }
  }

  override render() {
    const attention = this.#attentionText;
    const hasCount = this.#hasCount;
    const countWords = hasCount ? this.countLabel || String(this.count) : '';
    const icon = this.icon ? html`<mm-icon part="icon" class="icon" name=${this.icon}></mm-icon>` : html`<slot name="icon"></slot>`;
    const end = this.collapsed
      ? html`<span class="end">
          ${hasCount && Number(this.count) > 0 ? html`<span class="ring" aria-hidden="true"></span>` : nothing}
          ${attention ? html`<span part="dot" class="dot" aria-hidden="true"></span>` : nothing}
        </span>`
      : html`<span class="end">
          ${attention ? html`<span part="dot" class="dot" aria-hidden="true"></span>` : nothing}
          ${hasCount ? html`<mm-count part="count" .value=${Number(this.count)} max="999" label=${ifDefined(this.countLabel || undefined)}></mm-count>` : nothing}
        </span>`;
    const hiddenWords = [this.collapsed && hasCount ? countWords : '', attention].filter(Boolean);
    const inner = html`${icon}<span part="label" class=${this.collapsed ? 'visually-hidden' : 'label'}><slot></slot></span>${end}${hiddenWords.length
        ? html`<span class="visually-hidden">, ${hiddenWords.join(', ')}</span>`
        : nothing}`;
    let link;
    if (this.disabled) {
      link = html`<a part="link" class="link" role="link" aria-disabled="true">${inner}</a>`;
    } else if (this.href) {
      link = html`<a
        part="link"
        class="link"
        href=${this.href}
        target=${ifDefined(this.target || undefined)}
        rel=${ifDefined(this.target === '_blank' ? 'noopener noreferrer' : undefined)}
        aria-current=${ifDefined(this.current ? 'page' : undefined)}
        >${inner}</a
      >`;
    } else {
      link = html`<button part="link" class="link" type="button" aria-current=${ifDefined(this.current ? 'page' : undefined)}>${inner}</button>`;
    }
    if (!this.collapsed) return link;
    const tip = [this.text, attention].filter(Boolean).join(', ');
    return html`<mm-tooltip placement=${this.#rtl ? 'left' : 'right'} content=${tip}>${link}</mm-tooltip>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-sidebar-nav': MmSidebarNav;
    'mm-nav-group': MmNavGroup;
    'mm-nav-item': MmNavItem;
  }
}
