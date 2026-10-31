import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { t } from '../../core/strings.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, nativeValidity, str, type MmValueDetail } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

/**
 * Text fields take one line of text: a label above, the field, then help or error text. Use `mono`
 * for machine strings such as MRNs, asset IDs and connection strings, and never for prose.
 * Passwords get a show and hide toggle, `maxlength` adds a character counter, and `clearable`
 * adds a clear button once there is a value.
 *
 * Form-associated: submits `value` under `name` with a native form or a SvelteKit form action,
 * takes part in constraint validation (`required`, `pattern`, `minlength`, `maxlength`, and the
 * email and URL types), resets with the form and is disabled by a disabled fieldset. Enter submits
 * the owning form, as a native input does.
 *
 * @tagname mm-text-field
 * @summary One line of text with a label, help and error.
 * @slot prefix - Content before the input, such as an icon or a fixed scheme like `mrn://`.
 * @slot suffix - Content after the input, such as a unit or a domain.
 * @csspart label - The label.
 * @csspart control - The bordered input box.
 * @csspart input - The native input.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @csspart counter - The character counter.
 * @fires mm-input - {MmValueDetail} On every edit.
 * @fires mm-change - {MmValueDetail} When the value is committed (blur after editing, or clearing).
 * @fires input - Native, composed; on every edit.
 * @fires change - Native, re-dispatched on the host when the value is committed.
 */
export class MmTextField extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      ::slotted([slot='prefix']),
      ::slotted([slot='suffix']) {
        flex: none;
        color: var(--mm-text-3);
      }
    `,
  ];

  /** `text` (default), `email`, `url`, `password` or `tel`. */
  @property({ reflect: true }) accessor type: 'text' | 'email' | 'url' | 'password' | 'tel' = 'text';
  /** The current value. The `value` attribute is the default the form resets to. */
  @property() accessor value = '';
  @property() accessor placeholder = '';
  /** A regular expression the whole value must match. */
  @property() accessor pattern = '';
  @property({ type: Number }) accessor minlength: number | undefined;
  /** Maximum length; also shows a counter. */
  @property({ type: Number }) accessor maxlength: number | undefined;
  @property() accessor autocomplete: string | undefined;
  @property() accessor inputmode: string | undefined;
  @property({ type: Boolean, reflect: true }) accessor readonly = false;
  /** Sets the value in mono, for machine strings (IDs, MRNs, keys). */
  @property({ type: Boolean, reflect: true }) accessor mono = false;
  /** Shows a clear button when there is a value. */
  @property({ type: Boolean, reflect: true }) accessor clearable = false;

  @state() private accessor revealed = false;
  @query('input') private accessor input!: HTMLInputElement | null;

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }
  override blur(): void {
    this.input?.blur();
  }
  /** Selects all text in the field. */
  select(): void {
    this.input?.select();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) this.setFormValue(this.value);
  }

  protected override computeValidity() {
    return nativeValidity(this.input);
  }

  formResetCallback(): void {
    this.value = this.getAttribute('value') ?? '';
    this.revealed = false;
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  #onInput = () => {
    this.value = this.input!.value;
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: this.value });
  };
  #onChange = () => {
    if (this.value) this.touched = true;
    this.emitChange<MmValueDetail>({ value: this.value });
  };
  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing && !e.defaultPrevented) this.implicitSubmit();
  };
  #clear = () => {
    this.value = '';
    this.input!.value = '';
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: '' }, true);
    this.emitChange<MmValueDetail>({ value: '' });
    this.input!.focus();
  };

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const max = this.maxlength;
    const len = this.value.length;
    const remaining = max !== undefined ? max - len : undefined;
    const counter =
      max !== undefined
        ? html`<span part="counter" class=${classMap({ counter: true, over: len > max })} aria-hidden="true">${len}/${max}</span
            ><span class="visually-hidden" aria-live="polite">${remaining !== undefined && remaining <= 10 ? `${remaining} ${str('charactersRemaining', 'characters remaining')}` : ''}</span>`
        : nothing;
    const type = this.type === 'password' && this.revealed ? 'text' : this.type;
    return html`<div class="field">
      ${this.renderLabel()}
      <div part="control" class=${classMap({ box: true, invalid, disabled, mono: this.mono })} @click=${(e: Event) => e.target === e.currentTarget && this.input?.focus()}>
        <slot name="prefix"></slot>
        <input
          part="input"
          class="input"
          id=${this.ids.control}
          data-anchor
          .value=${live(this.value)}
          type=${type}
          name=${ifDefined(this.name || undefined)}
          placeholder=${ifDefined(this.placeholder || undefined)}
          pattern=${ifDefined(this.pattern || undefined)}
          minlength=${ifDefined(this.minlength)}
          maxlength=${ifDefined(this.maxlength)}
          autocomplete=${ifDefined(this.autocomplete as AutoFill | undefined)}
          inputmode=${ifDefined(this.inputmode)}
          spellcheck=${this.mono || this.type !== 'text' ? 'false' : 'true'}
          autocapitalize=${this.mono || this.type !== 'text' ? 'off' : 'sentences'}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${disabled}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          @input=${this.#onInput}
          @change=${this.#onChange}
          @keydown=${this.#onKeydown}
        />
        ${this.clearable && this.value && !disabled && !this.readonly
          ? html`<button type="button" class="icon-btn" aria-label=${t('clear')} @click=${this.#clear}><mm-icon name="close"></mm-icon></button>`
          : nothing}
        ${this.type === 'password'
          ? html`<button
              type="button"
              class="icon-btn"
              aria-label=${str('showPassword', 'Show password')}
              aria-pressed=${this.revealed ? 'true' : 'false'}
              aria-controls=${this.ids.control}
              ?disabled=${disabled}
              @click=${() => (this.revealed = !this.revealed)}
            >
              <mm-icon name=${this.revealed ? 'visibility-off' : 'visibility'}></mm-icon>
            </button>`
          : nothing}
        <slot name="suffix"></slot>
      </div>
      ${this.renderMessages(counter)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-text-field': MmTextField;
  }
}
