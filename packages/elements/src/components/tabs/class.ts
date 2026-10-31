import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { isRtl, rovingKeydown } from '../../core/roving.js';
import { onStringsChange, t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../count/define.js';
import '../menu/define.js';
import '../menu-button/define.js';
import type { MmMenuButton } from '../menu-button/class.js';
import type { MenuSelectDetail } from '../menu/class.js';

export interface MmTabChangeDetail {
  value: string;
}

/**
 * One tab in an `mm-tabs` strip: a 13px label with an optional 16px icon and a count. Inactive
 * tabs are `mm-text-2`; the selected tab is ink with the 2px burnt-sienna underline.
 *
 * Without `href` the tab is an ARIA tab (`role="tab"`) that shows the `mm-tab-panel` with the same
 * `value`. With `href` it renders a link and the strip becomes navigation: see `mm-tabs`.
 *
 * @tagname mm-tab
 * @summary One tab in a tab strip.
 * @slot - The label.
 * @csspart tab - The inner wrapper (a link when `href` is set).
 * @csspart icon - The leading icon.
 * @csspart label - The label wrapper, which truncates long labels.
 * @csspart count - The count.
 */
export class MmTab extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: relative;
        display: inline-flex;
        flex: 0 1 auto;
        min-width: 0;
        max-width: 20rem;
        color: var(--mm-text-2);
        cursor: pointer;
        user-select: none;
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      :host(:hover),
      :host([selected]) {
        color: var(--mm-text);
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        border-radius: var(--radius-sm);
      }
      :host([disabled]) {
        color: var(--mm-text-3);
        cursor: not-allowed;
      }
      :host([data-overflow]) {
        display: none;
      }
      .tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        min-height: var(--mm-control, var(--control-h));
        padding: 10px 2px;
        font: var(--text-button);
        color: inherit;
        text-decoration: none;
        white-space: nowrap;
      }
      a.tab:focus-visible {
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        border-radius: var(--radius-sm);
      }
      :host([selected]) .tab::after {
        content: '';
        position: absolute;
        inset-inline: 2px;
        bottom: -1px;
        height: 2px;
        background: var(--mm-primary);
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      mm-icon {
        flex: none;
      }
      mm-count {
        flex: none;
      }
      :host([selected]) mm-count {
        --mm-count-color: var(--mm-text-2);
      }
      @media (pointer: coarse) {
        .tab {
          min-height: var(--target-touch);
        }
      }
    `,
  ];

  /** Matches the `value` of the panel this tab shows, and is the value `mm-tabs` reports. */
  @property({ reflect: true }) accessor value = '';
  /** Leading Material Symbols icon, such as `description`, `schema`, `account-tree` or `history`. */
  @property() accessor icon = '';
  /** A count shown after the label (text face, tabular figures), such as the number of columns or runs. */
  @property({ type: Number }) accessor count: number | undefined;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Makes the tab a link. The strip then becomes navigation rather than an ARIA tablist. */
  @property() accessor href = '';
  /** Set by `mm-tabs`. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.slot) this.slot = 'tab';
    if (!this.id) this.id = uid('mm-tab');
  }

  /** The label text without the count, as listed in the overflow menu. */
  get text(): string {
    return this.textContent?.trim() ?? '';
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (this.href) {
      this.removeAttribute('role');
      this.removeAttribute('aria-selected');
      this.removeAttribute('aria-disabled');
      this.removeAttribute('tabindex');
    } else {
      this.setAttribute('role', 'tab');
      this.setAttribute('aria-selected', String(this.selected));
      if (this.disabled) this.setAttribute('aria-disabled', 'true');
      else this.removeAttribute('aria-disabled');
    }
    if (changed.has('count') || changed.has('icon') || changed.has('href') || changed.has('disabled')) {
      (this.parentElement as MmTabs | null)?.requestLayout?.();
    }
  }

  override focus(options?: FocusOptions): void {
    if (this.href) this.renderRoot.querySelector<HTMLElement>('a')?.focus(options);
    else super.focus(options);
  }

  override render() {
    const inner = html`${this.icon ? html`<mm-icon part="icon" name=${this.icon}></mm-icon>` : nothing}<span part="label" class="label"
        ><slot @slotchange=${() => (this.parentElement as MmTabs | null)?.requestLayout?.()}></slot></span
      >${this.count !== undefined && this.count !== null ? html`<mm-count part="count" .value=${this.count}></mm-count>` : nothing}`;
    if (this.href) {
      return html`<a part="tab" class="tab" href=${this.disabled ? nothing : this.href} aria-current=${this.selected ? 'page' : nothing} aria-disabled=${this.disabled ? 'true' : nothing}
        >${inner}</a
      >`;
    }
    return html`<span part="tab" class="tab">${inner}</span>`;
  }
}

/**
 * The content for one tab. Hidden unless its `value` matches the selected tab. It is a focusable
 * `tabpanel` labelled by its tab, so keyboard users can Tab from the strip straight into it.
 *
 * @tagname mm-tab-panel
 * @summary The content shown by one tab.
 * @slot - The panel content.
 */
export class MmTabPanel extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        padding-block: var(--space-4);
      }
      :host(:not([selected])) {
        display: none;
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
    `,
  ];

  /** Matches the `value` of its `mm-tab`. */
  @property({ reflect: true }) accessor value = '';
  /** Set by `mm-tabs`. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.slot) this.slot = 'panel';
    if (!this.id) this.id = uid('mm-tab-panel');
  }

  override render() {
    return html`<slot></slot>`;
  }
}

/**
 * Tabs switch between views of one object, such as an asset's documentation, metadata, schema,
 * lineage and run history. Labels are 13px with a 16px icon, `mm-text-2` when inactive; the active
 * tab is ink with a 2px burnt-sienna underline inset from its edges. Counts sit in the text face, muted
 * and tabular. Switching is instant: there is no sliding indicator.
 *
 * Keyboard follows the WAI-ARIA tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): the
 * strip is one tab stop; Left and Right move between tabs (flipped in right-to-left), Home and End go
 * to the first and last. With `activation="auto"` (default) moving focus selects the tab. With
 * `activation="manual"` focus moves without selecting, and Enter or Space selects: use it for heavy
 * panels such as lineage, so arrowing past them does not render them.
 *
 * Overflow: when there are more than `max-visible` tabs (default 6), or the tabs do not fit the
 * width, the rest move into a "More" menu button at the end of the strip. Choosing one selects it
 * and swaps it into the strip, so the selected tab is always visible. The More button is its own tab
 * stop after the tablist, outside the tablist so the tablist only contains tabs.
 *
 * Link tabs: give each `mm-tab` an `href` for URL-driven tabs (for example `/assets/orders_daily/schema`).
 * The strip then renders as a `nav` of links with `aria-current="page"` on the selected one, not as an
 * ARIA tablist. This is a deliberate trade-off: link tabs are navigation. Each link is a tab stop,
 * arrow keys do nothing, the page changes on activation, and screen readers announce links rather
 * than "tab 3 of 9". Use them when each view needs its own URL; use ARIA tabs for in-page views.
 * Set `value` from the current route so the right link is marked.
 *
 * @tagname mm-tabs
 * @summary Switches between views of one object.
 * @slot - `mm-tab` and `mm-tab-panel` elements, in any order. They place themselves.
 * @csspart bar - The strip with its bottom hairline.
 * @csspart tablist - The tablist (or the link list in link mode).
 * @csspart more - The overflow menu button.
 * @fires mm-tab-change - {MmTabChangeDetail} The selected tab changed by user action.
 */
export class MmTabs extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .bar {
        display: flex;
        align-items: flex-end;
        gap: var(--space-2);
        border-bottom: 1px solid var(--mm-rule);
      }
      .list {
        display: flex;
        flex: 1 1 auto;
        min-width: 0;
        gap: var(--space-5);
      }
      :host([data-measuring]) ::slotted(mm-tab) {
        flex: none;
      }
      .more {
        flex: none;
        margin-block-end: var(--space-1);
      }
      .more[hidden] {
        display: none;
      }
    `,
  ];

  /** The selected tab's `value`. Defaults to the first enabled tab. */
  @property({ reflect: true }) accessor value = '';
  /** `auto` (default) selects on focus; `manual` selects on Enter or Space. */
  @property({ reflect: true }) accessor activation: 'auto' | 'manual' = 'auto';
  /** Accessible name for the tablist, such as "Asset views". Required in link mode, where it names the `nav`. */
  @property() accessor label = '';
  /** Most tabs shown before the rest move into the More menu. */
  @property({ type: Number, attribute: 'max-visible' }) accessor maxVisible = 6;

  @state() accessor #hidden: MmTab[] = [];
  @query('.list') accessor #list!: HTMLElement | null;
  @query('.bar') accessor #bar!: HTMLElement | null;
  @query('.more') accessor #more!: MmMenuButton | null;
  #ro?: ResizeObserver;
  #frame = 0;
  #moreWidth = 0;
  #offStrings?: () => void;

  constructor() {
    super();
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
    this.addEventListener('click', (e) => this.#onClick(e));
    this.addEventListener('focusout', (e) => this.#onFocusOut(e));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#offStrings = onStringsChange(() => this.requestUpdate());
    if (typeof ResizeObserver !== 'undefined') {
      this.#ro = new ResizeObserver(() => this.requestLayout());
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#offStrings?.();
    cancelAnimationFrame(this.#frame);
  }

  /** Every tab, in order. */
  get tabs(): MmTab[] {
    return [...this.children].filter((el): el is MmTab => el.localName === 'mm-tab');
  }

  /** Every panel. */
  get panels(): MmTabPanel[] {
    return [...this.children].filter((el): el is MmTabPanel => el.localName === 'mm-tab-panel');
  }

  get #linkMode(): boolean {
    return this.tabs.some((tab) => !!tab.href);
  }

  /** Re-measures the strip and moves tabs into or out of the More menu. Called for you on resize and content changes. */
  requestLayout(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#layout());
  }

  /** Selects a tab by value, as if the user had chosen it, and fires `mm-tab-change`. */
  select(value: string, focus = false): void {
    const tab = this.tabs.find((el) => this.#valueOf(el) === value);
    if (!tab || tab.disabled) return;
    const changed = this.value !== value;
    this.value = value;
    this.#sync();
    if (focus) {
      // The tab may be moving out of the More menu; focus it once the strip has re-laid out.
      this.#layout();
      tab.focus();
    }
    if (changed) emit<MmTabChangeDetail>(this, 'mm-tab-change', { value });
  }

  #valueOf(tab: MmTab): string {
    if (!tab.value) tab.value = `tab-${this.tabs.indexOf(tab) + 1}`;
    return tab.value;
  }

  #visibleTabs(): MmTab[] {
    return this.tabs.filter((el) => !el.hasAttribute('data-overflow'));
  }

  #sync() {
    const tabs = this.tabs;
    if (!tabs.length) return;
    const values = tabs.map((el) => this.#valueOf(el));
    if (!values.includes(this.value)) {
      const first = tabs.find((el) => !el.disabled);
      if (first && !this.#linkMode) this.value = this.#valueOf(first);
    }
    const panels = this.panels;
    const link = this.#linkMode;
    for (const tab of tabs) {
      const sel = this.#valueOf(tab) === this.value;
      tab.selected = sel;
      if (!link) {
        tab.tabIndex = sel ? 0 : -1;
        const panel = panels.find((p) => p.value === tab.value);
        if (panel) tab.setAttribute('aria-controls', panel.id);
        else tab.removeAttribute('aria-controls');
      }
    }
    for (const panel of panels) {
      panel.selected = panel.value === this.value;
      const tab = tabs.find((el) => el.value === panel.value);
      if (link) {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
        panel.removeAttribute('tabindex');
      } else {
        panel.setAttribute('role', 'tabpanel');
        panel.tabIndex = 0;
        if (tab) panel.setAttribute('aria-labelledby', tab.id);
      }
    }
  }

  #layout() {
    const tabs = this.tabs;
    const list = this.#list;
    const bar = this.#bar;
    if (!list || !bar || !tabs.length) return;
    tabs.forEach((el) => el.removeAttribute('data-overflow'));
    // Measure natural widths: tabs may shrink (with an ellipsis) only once the visible set is chosen.
    this.setAttribute('data-measuring', '');
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const widths = tabs.map((el) => el.getBoundingClientRect().width);
    this.removeAttribute('data-measuring');
    const avail = bar.clientWidth;
    const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, tabs.length - 1);
    const max = Math.max(1, Number(this.maxVisible) || 6);
    let hidden: MmTab[] = [];
    if (tabs.length > max || total > avail + 0.5) {
      const more = this.#more;
      if (more && !more.hidden) this.#moreWidth = more.getBoundingClientRect().width || this.#moreWidth;
      const room = avail - (this.#moreWidth || 88) - 8;
      const selIndex = Math.max(0, tabs.findIndex((el) => el.selected));
      let n = Math.min(max, tabs.length);
      let shown: number[] = [];
      for (; n >= 1; n--) {
        shown = [...Array(n).keys()];
        if (selIndex >= n) shown[n - 1] = selIndex;
        const w = shown.reduce((sum, i) => sum + widths[i]!, 0) + gap * (n - 1);
        if (w <= room || n === 1) break;
      }
      hidden = tabs.filter((_, i) => !shown.includes(i));
    }
    hidden.forEach((el) => {
      el.setAttribute('data-overflow', '');
      if (!this.#linkMode) el.tabIndex = -1;
    });
    const same = hidden.length === this.#hidden.length && hidden.every((el, i) => el === this.#hidden[i]);
    if (!same) this.#hidden = hidden;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('value') || changed.has('activation')) this.#sync();
    if (changed.has('value') || changed.has('maxVisible')) this.requestLayout();
    // The More button is only measurable once shown; re-fit once its real width is known.
    if (this.#hidden.length && this.#more && !this.#more.hidden) {
      const w = this.#more.getBoundingClientRect().width;
      if (w && Math.abs(w - this.#moreWidth) > 0.5) {
        this.#moreWidth = w;
        this.requestLayout();
      }
    }
  }

  #onSlotChange() {
    this.#sync();
    this.requestLayout();
    this.requestUpdate();
  }

  #tabFrom(e: Event): MmTab | null {
    for (const el of e.composedPath()) {
      if (el === this) return null;
      if (el instanceof HTMLElement && el.localName === 'mm-tab' && el.parentElement === this) return el as MmTab;
    }
    return null;
  }

  #onClick(e: MouseEvent) {
    const tab = this.#tabFrom(e);
    if (!tab) return;
    if (tab.disabled) {
      e.preventDefault();
      return;
    }
    if (tab.href) {
      // Navigation happens through the link; record the selection so the strip updates without a reload.
      const changed = this.value !== tab.value;
      this.value = this.#valueOf(tab);
      if (changed) emit<MmTabChangeDetail>(this, 'mm-tab-change', { value: this.value });
      return;
    }
    this.select(this.#valueOf(tab), true);
  }

  #onKeydown(e: KeyboardEvent) {
    const tab = this.#tabFrom(e);
    if (!tab || tab.href || e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.select(this.#valueOf(tab));
      return;
    }
    const items = this.#visibleTabs();
    const next = rovingKeydown(e, items, items.indexOf(tab), { orientation: 'horizontal', rtl: isRtl(this) });
    if (next === null) return;
    if (this.activation === 'auto') this.select(this.#valueOf(items[next]!));
  }

  #onFocusOut(e: FocusEvent) {
    // Leaving the strip: the tab stop returns to the selected tab (manual activation can leave it elsewhere).
    const to = e.relatedTarget as Node | null;
    if (to && this.tabs.some((el) => el === to || el.contains(to))) return;
    if (!this.#linkMode) this.tabs.forEach((el) => (el.tabIndex = el.selected && !el.hasAttribute('data-overflow') ? 0 : -1));
  }

  #onMoreSelect(e: CustomEvent<MenuSelectDetail>) {
    e.stopPropagation();
    const value = e.detail.value;
    const tab = this.tabs.find((el) => el.value === value);
    if (!tab) return;
    if (tab.href) {
      e.preventDefault();
      this.#more?.hide();
      tab.removeAttribute('data-overflow');
      tab.renderRoot.querySelector('a')?.click();
      return;
    }
    // Keep the menu from returning focus to the More button: focus goes to the chosen tab instead.
    e.preventDefault();
    this.#more?.hide(false);
    this.select(value, true);
  }

  override render() {
    const link = this.#linkMode;
    const hidden = this.#hidden;
    const list = link
      ? html`<nav part="tablist" class="list" aria-label=${this.label || nothing}><slot name="tab" @slotchange=${this.#onSlotChange}></slot></nav>`
      : html`<div part="tablist" class="list" role="tablist" aria-label=${this.label || nothing} aria-orientation="horizontal">
          <slot name="tab" @slotchange=${this.#onSlotChange}></slot>
        </div>`;
    return html`<div part="bar" class="bar">
        ${list}
        <mm-menu-button
          part="more"
          class="more"
          variant="ghost"
          size="sm"
          label=${t('more')}
          placement="bottom-end"
          ?hidden=${!hidden.length}
          @mm-select=${this.#onMoreSelect}
        >
          <mm-menu label=${t('more')}>
            ${hidden.map(
              (tab) => html`<mm-menu-item value=${tab.value} icon=${tab.icon || nothing} ?disabled=${tab.disabled}
                >${tab.text}${tab.count !== undefined && tab.count !== null
                  ? html` <mm-count .value=${tab.count} style="--mm-count-color:var(--mm-text-2)"></mm-count>`
                  : nothing}</mm-menu-item
              >`,
            )}
          </mm-menu>
        </mm-menu-button>
      </div>
      <slot name="panel" @slotchange=${this.#onSlotChange}></slot>
      <slot hidden></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-tabs': MmTabs;
    'mm-tab': MmTab;
    'mm-tab-panel': MmTabPanel;
  }
}
