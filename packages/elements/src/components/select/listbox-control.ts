import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { MmFormControl } from '../../core/form-control.js';
import { emit } from '../../core/events.js';
import { str } from './field.js';
import { MmOption, MmOptionGroup, type MmOptionData } from './option.js';
import { define } from '../../core/define.js';
import '@marmotdata/icons/define.js';

define('mm-option', MmOption);
define('mm-option-group', MmOptionGroup);

export type MmOptionLoader = (query: string, signal: AbortSignal) => Promise<MmOptionData[]>;

/** Popup, option and status styles shared by every listbox control. */
export const listboxStyles = css`
  .popup {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 4px;
    border: 1px solid var(--mm-rule);
    border-radius: var(--radius-md);
    background: var(--mm-raised);
    color: var(--mm-text);
    box-shadow: var(--shadow-float);
    min-width: 200px;
    max-width: min(560px, calc(100vw - 16px));
    overflow: hidden;
    flex-direction: column;
  }
  .popup:popover-open {
    display: flex;
  }
  .popup.animate:popover-open {
    transition:
      opacity var(--mm-dur-menu) var(--mm-ease),
      transform var(--mm-dur-menu) var(--mm-ease);
    @starting-style {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  .scroll {
    overflow: auto;
    max-height: 320px;
    min-height: 0;
    overscroll-behavior: contain;
  }
  [role='listbox'][hidden] {
    display: none;
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--mm-menu-row);
    padding: 6px 10px;
    font: var(--text-dense);
    color: var(--mm-text-2);
  }
  .status.error {
    color: var(--mm-danger);
  }
  .status .grow {
    flex: 1;
  }
  .retry {
    font: var(--text-button);
    color: var(--mm-text);
    background: var(--mm-surface);
    border: 1px solid var(--mm-control-border);
    border-radius: var(--radius-md);
    height: var(--control-h-sm);
    padding: 0 10px;
    cursor: pointer;
  }
  .retry:hover {
    border-color: var(--mm-text);
  }
  .spinner {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    animation: spin 700ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-right-color: currentColor;
      opacity: 0.6;
    }
  }
`;

/** Listbox-specific additions to the shared form-field `.box`. */
export const boxStyles = css`
  .box {
    height: auto;
    min-height: var(--mm-control, var(--control-h));
  }
  .box.open {
    border-color: var(--mm-text);
  }
  .chevron {
    flex: none;
    color: var(--mm-text-2);
    margin-inline-start: auto;
  }
  .placeholder {
    color: var(--mm-text-3);
  }
  @media (pointer: coarse) {
    .box {
      font-size: 16px;
    }
  }
`;

/**
 * Base for `mm-select`, `mm-combobox` and `mm-multiselect`: the listbox popup, option tracking,
 * keyboard highlight (aria-activedescendant through element reflection, so slotted options in light
 * DOM can be referenced from the shadow combobox), async loading, outside dismissal and the field chrome.
 */
export abstract class MmListboxControl extends MmFormControl {
  /** Visible label above the control. Required for accessibility. */
  @property() accessor label = '';
  /** Help text under the control. */
  @property() accessor help = '';
  /** Error sentence under the control. Marks the control invalid. */
  @property() accessor error = '';
  /** Text shown when nothing is selected. */
  @property() accessor placeholder = '';
  /**
   * Loads options for a query. Called 150ms after typing stops, with an AbortSignal that aborts when
   * a newer query starts. Overrides slotted options.
   */
  @property({ attribute: false }) accessor loader: MmOptionLoader | undefined;

  @state() protected accessor open = false;
  @state() protected accessor query = '';
  @state() protected accessor loaded: MmOptionData[] = [];
  @state() protected accessor loadState: 'idle' | 'loading' | 'error' | 'done' = 'idle';
  @state() protected accessor fromKeyboard = false;

  protected activeOption: MmOption | null = null;
  protected readonly loadingVisibility = new DelayedVisibility(this);
  /** Labels of values chosen from loaded options, kept after the options change. */
  protected readonly knownLabels = new Map<string, MmOptionData>();
  #cleanupFloat?: () => void;
  #debounce?: ReturnType<typeof setTimeout>;
  #abort?: AbortController;
  #lastLoadedQuery: string | null = null;

  /** The element with role=combobox. */
  protected abstract get comboboxEl(): HTMLElement | null;
  /** The element the popup is positioned against. */
  protected abstract get anchorEl(): HTMLElement | null;
  /** Whether a value is currently selected. */
  protected abstract isSelected(value: string): boolean;
  /** Called when the user picks an option. */
  protected abstract pick(option: MmOption): void;

  get popupEl(): HTMLElement | null {
    return this.renderRoot?.querySelector?.<HTMLElement>('.popup') ?? null;
  }

  /** Every option, slotted or loaded, in order. */
  get options(): MmOption[] {
    if (this.loader) return [...(this.renderRoot?.querySelectorAll?.('mm-option') ?? [])] as MmOption[];
    return [...this.querySelectorAll('mm-option')];
  }
  protected get navigable(): MmOption[] {
    return this.options.filter((o) => !o.hidden && !o.disabled);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof document !== 'undefined') document.addEventListener('pointerdown', this.#onDocPointer, true);
    this.addEventListener('focusout', this.#onFocusOut);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.#onDocPointer, true);
    this.removeEventListener('focusout', this.#onFocusOut);
    this.#cleanupFloat?.();
    this.#abort?.abort();
    clearTimeout(this.#debounce);
  }

  #onDocPointer = (e: PointerEvent) => {
    if (this.open && !e.composedPath().includes(this)) this.closeList(false);
  };
  #onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (to === this || this.contains(to) || this.shadowRoot?.contains(to))) return;
    this.onBlur();
  };
  /** Focus left the control. */
  protected onBlur(): void {
    this.closeList(false);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncOptions();
  }

  /** Marks options selected and keeps the highlight valid. */
  protected syncOptions(): void {
    for (const o of this.options) {
      const sel = this.isSelected(o.optionValue);
      if (o.selected !== sel) o.selected = sel;
      if (o.active !== (o === this.activeOption)) o.active = o === this.activeOption;
    }
    if (this.activeOption && (!this.activeOption.isConnected || this.activeOption.hidden)) this.setActive(null);
  }

  /** Label for a value from the options or the loader cache. */
  protected labelFor(value: string): string {
    const o = this.options.find((x) => x.optionValue === value);
    return o?.optionLabel ?? this.knownLabels.get(value)?.label ?? value;
  }
  protected dataFor(value: string): Partial<MmOptionData> {
    const o = this.options.find((x) => x.optionValue === value);
    if (o) return { label: o.optionLabel, icon: o.icon, provider: o.providerKey };
    return this.knownLabels.get(value) ?? { label: value };
  }
  protected remember(o: MmOption): void {
    this.knownLabels.set(o.optionValue, { value: o.optionValue, label: o.optionLabel, icon: o.icon, provider: o.providerKey });
  }

  // Highlight -------------------------------------------------------------

  protected setActive(o: MmOption | null, scroll = true): void {
    if (this.activeOption && this.activeOption !== o) this.activeOption.active = false;
    this.activeOption = o;
    if (o) {
      o.active = true;
      if (scroll && this.open) o.scrollIntoView({ block: 'nearest' });
    }
    const cb = this.comboboxEl as (HTMLElement & { ariaActiveDescendantElement?: Element | null }) | null;
    if (cb) cb.ariaActiveDescendantElement = o && this.open ? o : null;
  }
  /** Moves the highlight by a step, or to `first`/`last`. Does not wrap, per APG. */
  protected move(step: number | 'first' | 'last'): void {
    const list = this.navigable;
    if (!list.length) return;
    let i = this.activeOption ? list.indexOf(this.activeOption) : -1;
    if (step === 'first') i = 0;
    else if (step === 'last') i = list.length - 1;
    else if (i < 0) i = step > 0 ? 0 : list.length - 1;
    else i = Math.min(list.length - 1, Math.max(0, i + step));
    this.setActive(list[i]!);
  }
  /** Highlights the first selected option, or the first option. */
  protected activateSelectedOrFirst(): void {
    const list = this.navigable;
    this.setActive(list.find((o) => o.selected) ?? list[0] ?? null);
  }

  // Popup -----------------------------------------------------------------

  protected async openList(): Promise<void> {
    if (this.open || this.isDisabled) return;
    this.fromKeyboard = openedFromKeyboard();
    this.open = true;
    if (this.loader && this.#lastLoadedQuery !== this.query) this.scheduleLoad(0);
    await this.updateComplete;
    const popup = this.popupEl;
    const anchor = this.anchorEl;
    if (!popup || !anchor) return;
    try {
      popup.showPopover();
    } catch {
      /* already open or unsupported */
    }
    this.#cleanupFloat?.();
    this.#cleanupFloat = float(anchor, popup, { matchWidth: true });
    if (this.activeOption) this.setActive(this.activeOption);
  }
  protected closeList(restoreFocus = true): void {
    if (!this.open) return;
    this.open = false;
    this.#cleanupFloat?.();
    this.#cleanupFloat = undefined;
    try {
      this.popupEl?.hidePopover();
    } catch {
      /* not open */
    }
    this.setActive(null);
    if (restoreFocus) this.comboboxEl?.focus();
  }

  // Loading ---------------------------------------------------------------

  /** Runs the loader for the current query after `delay` ms, aborting any request in flight. */
  protected scheduleLoad(delay = 150): void {
    if (!this.loader) return;
    clearTimeout(this.#debounce);
    this.#debounce = setTimeout(() => void this.#load(), delay);
  }
  async #load() {
    const loader = this.loader;
    if (!loader) return;
    this.#abort?.abort();
    const ctrl = new AbortController();
    this.#abort = ctrl;
    const q = this.query;
    this.loadState = 'loading';
    this.loadingVisibility.set(true);
    try {
      const result = await loader(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      this.loaded = result;
      for (const d of result) if (this.isSelected(d.value)) this.knownLabels.set(d.value, d);
      this.#lastLoadedQuery = q;
      this.loadState = 'done';
    } catch (err) {
      if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return;
      this.loaded = [];
      this.#lastLoadedQuery = null;
      this.loadState = 'error';
    } finally {
      if (this.#abort === ctrl) this.loadingVisibility.set(false);
    }
    await this.updateComplete;
    if (this.open && !this.activeOption && this.autoHighlight()) this.activateSelectedOrFirst();
  }
  /** Whether new results highlight the first option automatically. */
  protected autoHighlight(): boolean {
    return false;
  }
  /** Retry after a failed load. */
  retry(): void {
    this.scheduleLoad(0);
    this.comboboxEl?.focus();
  }

  /** Filters slotted options by the query (client-side), and emphasises the match. */
  protected filterSlotted(q: string): void {
    if (this.loader) return;
    const needle = q.trim().toLowerCase();
    for (const o of this.querySelectorAll('mm-option')) {
      o.hidden = !!needle && !o.optionLabel.toLowerCase().includes(needle);
      o.highlight = needle ? q.trim() : '';
    }
    for (const g of this.querySelectorAll('mm-option-group')) {
      g.hidden = ![...g.querySelectorAll('mm-option')].some((o) => !o.hidden);
    }
  }

  // Rendering -------------------------------------------------------------

  #onPopupClick = (e: Event) => {
    const o = e.composedPath().find((n): n is MmOption => n instanceof MmOption);
    if (!o || o.disabled) return;
    this.setActive(o, false);
    this.pick(o);
  };
  #onPopupPointerMove = (e: PointerEvent) => {
    const o = e.composedPath().find((n): n is MmOption => n instanceof MmOption);
    if (o && !o.disabled && o !== this.activeOption) this.setActive(o, false);
  };

  protected renderStatus(): TemplateResult | typeof nothing {
    const visible = this.hasVisibleOptions();
    if (this.loader && this.loadState === 'error') {
      return html`<div class="status error" role="alert">
        <mm-icon name="error" size="16"></mm-icon><span class="grow">${str('loadFailed')}</span>
        <button class="retry" type="button" @click=${() => this.retry()}>${str('retry')}</button>
      </div>`;
    }
    if (this.loader && this.loadingVisibility.visible) {
      return html`<div class="status" role="status"><span class="spinner" aria-hidden="true"></span>${this.query ? str('searching') : str('loading')}…</div>`;
    }
    if (!visible && (!this.loader || this.loadState === 'done')) {
      return html`<div class="status" role="status">${this.renderEmpty()}</div>`;
    }
    return nothing;
  }
  protected hasVisibleOptions(): boolean {
    if (this.loader) return this.loaded.length > 0;
    return [...this.querySelectorAll('mm-option')].some((o) => !o.hidden);
  }
  protected renderEmpty(): unknown {
    return str('noResults');
  }

  protected renderLoaded(): unknown {
    const q = this.query.trim();
    return this.loaded.map(
      (d) => html`<mm-option
        value=${d.value}
        label=${d.label}
        description=${d.description ?? ''}
        ?mono=${!!d.mono}
        meta=${d.meta ?? ''}
        icon=${d.icon ?? ''}
        provider=${d.provider ?? ''}
        ?disabled=${!!d.disabled}
        .highlight=${q}
        >${d.label}</mm-option
      >`,
    );
  }

  protected renderPopup(multiselectable = false): TemplateResult {
    const hasOptions = this.hasVisibleOptions();
    return html`<div
      class="popup ${this.fromKeyboard ? '' : 'animate'}"
      part="popup"
      popover="manual"
      @mousedown=${(e: Event) => {
        if (!(e.composedPath()[0] as HTMLElement).closest?.('button')) e.preventDefault();
      }}
      @click=${this.#onPopupClick}
      @pointermove=${this.#onPopupPointerMove}
    >
      <div class="scroll">
        <div
          role="listbox"
          id="listbox"
          part="listbox"
          aria-labelledby="label"
          aria-multiselectable=${multiselectable ? 'true' : nothing}
          ?hidden=${!hasOptions}
        >
          ${this.loader ? this.renderLoaded() : html`<slot @slotchange=${() => this.requestUpdate()}></slot>`}
        </div>
      </div>
      ${this.open ? this.renderStatus() : nothing}
    </div>`;
  }

  /** Emits the change events. */
  protected fireChange(value: unknown): void {
    emit(this, 'mm-change', { value });
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
