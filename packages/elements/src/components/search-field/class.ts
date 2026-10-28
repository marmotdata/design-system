import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { emit } from '../../core/events.js';
import { formatShortcut, isApple, isModKey } from '../../core/platform.js';
import { t } from '../../core/strings.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, nativeValidity, type MmValueDetail } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

const isEditable = (el: EventTarget | undefined): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type);
  return el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'searchbox' || el.getAttribute('role') === 'combobox';
};

/** Parses "mod+k", "/" or "shift+?" into parts; the last part is the key. */
const parse = (shortcut: string) => {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.pop() ?? '';
  return { key, mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') };
};

/**
 * Search fields filter or find: a leading search icon, the query, and a keycap hint for the
 * shortcut that focuses them (`/` or `mod+k`, shown as ⌘ K on Apple and Ctrl K elsewhere). With
 * `global-shortcut` the shortcut works from anywhere on the page, except while someone is typing in
 * another field (unless the shortcut uses the mod key). Enter fires `mm-search`; Escape clears the
 * query, and a second Escape leaves the field. A clear button appears once there is a query.
 *
 * Form-associated, so a search field in a GET form submits its query under `name`, and Enter
 * submits the form unless `mm-search` is cancelled.
 *
 * @tagname mm-search-field
 * @summary A query field with a search icon and a shortcut hint.
 * @csspart label - The label.
 * @csspart control - The bordered input box.
 * @csspart input - The native input (role searchbox).
 * @csspart keys - The keycap hint.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-input - {MmValueDetail} On every edit, and when Escape or the clear button empties the field.
 * @fires mm-change - {MmValueDetail} When the query is committed (blur after editing, or clearing).
 * @fires mm-search - {MmValueDetail} On Enter. Cancel it to stop the owning form submitting.
 * @fires input - Native, composed; on every edit.
 * @fires change - Native, re-dispatched on the host when the query is committed.
 */
export class MmSearchField extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .input::-webkit-search-cancel-button,
      .input::-webkit-search-decoration {
        appearance: none;
      }
      .keys {
        display: inline-flex;
        gap: var(--space-1);
        flex: none;
      }
      .box:focus-within .keys {
        display: none;
      }
      kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        font: var(--text-keycap);
        letter-spacing: var(--tracking-keycap);
        color: var(--mm-text-2);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-bottom-width: 2px;
        border-radius: var(--radius-sm);
      }
    `,
  ];

  /** The current query. The `value` attribute is the default the form resets to. */
  @property() accessor value = '';
  @property() accessor placeholder = '';
  /** Shortcut shown as keycaps, such as `/` or `mod+k` (⌘ K on Apple, Ctrl K elsewhere). */
  @property() accessor shortcut = '';
  /** Registers `shortcut` on the window so it focuses this field from anywhere on the page. */
  @property({ type: Boolean, reflect: true, attribute: 'global-shortcut' }) accessor globalShortcut = false;
  @property({ type: Number }) accessor minlength: number | undefined;
  @property({ type: Number }) accessor maxlength: number | undefined;

  @query('input') private accessor input!: HTMLInputElement | null;

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }
  override blur(): void {
    this.input?.blur();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.#onGlobalKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.#onGlobalKey);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) this.setFormValue(this.value);
  }
  protected override computeValidity() {
    return nativeValidity(this.input);
  }
  formResetCallback(): void {
    this.value = this.getAttribute('value') ?? '';
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  #onGlobalKey = (e: KeyboardEvent) => {
    if (!this.globalShortcut || !this.shortcut || e.defaultPrevented || this.isDisabled) return;
    const s = parse(this.shortcut);
    if (s.mod !== isModKey(e) || s.alt !== e.altKey || (s.shift && !e.shiftKey)) return;
    if (!s.mod && (e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() !== s.key) return;
    const origin = e.composedPath()[0];
    if (origin === this.input) return;
    if (!s.mod && isEditable(origin)) return;
    e.preventDefault();
    this.focus();
    this.input?.select();
  };

  #clear(focus: boolean) {
    this.value = '';
    if (this.input) this.input.value = '';
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: '' }, true);
    this.emitChange<MmValueDetail>({ value: '' });
    if (focus) this.input?.focus();
  }

  #onInput = () => {
    this.value = this.input!.value;
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: this.value });
  };
  #onChange = () => this.emitChange<MmValueDetail>({ value: this.value });
  #onKeydown = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.value) {
        e.stopPropagation();
        this.#clear(false);
      } else this.input?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (emit<MmValueDetail>(this, 'mm-search', { value: this.value }, { cancelable: true })) this.implicitSubmit();
    }
  };

  #ariaShortcut(): string | undefined {
    if (!this.globalShortcut || !this.shortcut) return undefined;
    const s = parse(this.shortcut);
    const mods = [s.mod && (isApple() ? 'Meta' : 'Control'), s.alt && 'Alt', s.shift && 'Shift'].filter(Boolean);
    return [...mods, s.key.length === 1 ? s.key.toUpperCase() : s.key].join('+');
  }

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const keys = this.shortcut && !this.value && !disabled ? formatShortcut(this.shortcut) : [];
    return html`<div class="field">
      ${this.label ? this.renderLabel() : nothing}
      <div part="control" class=${classMap({ box: true, invalid, disabled })} @click=${(e: Event) => e.target === e.currentTarget && this.input?.focus()}>
        <mm-icon name="search" aria-hidden="true"></mm-icon>
        <input
          part="input"
          class="input"
          id=${this.ids.control}
          data-anchor
          type="search"
          role="searchbox"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck="false"
          .value=${live(this.value)}
          placeholder=${ifDefined(this.placeholder || undefined)}
          minlength=${ifDefined(this.minlength)}
          maxlength=${ifDefined(this.maxlength)}
          aria-label=${ifDefined(this.label ? undefined : t('search'))}
          aria-keyshortcuts=${ifDefined(this.#ariaShortcut())}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          ?required=${this.required}
          ?disabled=${disabled}
          @input=${this.#onInput}
          @change=${this.#onChange}
          @keydown=${this.#onKeydown}
        />
        ${this.value && !disabled
          ? html`<button type="button" class="icon-btn" aria-label=${t('clear')} @click=${() => this.#clear(true)}><mm-icon name="close"></mm-icon></button>`
          : nothing}
        ${keys.length ? html`<span part="keys" class="keys" aria-hidden="true">${keys.map((k) => html`<kbd>${k}</kbd>`)}</span>` : nothing}
      </div>
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-search-field': MmSearchField;
  }
}
