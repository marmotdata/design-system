import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, nativeValidity, str, type MmValueDetail } from '../form-field/class.js';

/**
 * Textareas take several lines: descriptions, documentation notes, review comments. `autosize`
 * grows the field with its content instead of scrolling, `maxlength` adds a character counter,
 * and `mono` sets the text in mono for machine strings such as a list of MRNs or a JSON payload.
 *
 * Form-associated: submits `value` under `name`, validates `required`, `minlength` and
 * `maxlength`, resets with the form and is disabled by a disabled fieldset.
 *
 * @tagname mm-textarea
 * @summary Several lines of text with a label, help and error.
 * @csspart label - The label.
 * @csspart control - The bordered box.
 * @csspart textarea - The native textarea.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @csspart counter - The character counter.
 * @fires mm-input - {MmValueDetail} On every edit.
 * @fires mm-change - {MmValueDetail} When the value is committed (blur after editing).
 * @fires input - Native, composed; on every edit.
 * @fires change - Native, re-dispatched on the host when the value is committed.
 */
export class MmTextarea extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .box {
        height: auto;
        padding: 0;
        align-items: stretch;
      }
      .input {
        display: block;
        padding: 7px 10px;
        min-height: calc(var(--mm-control, var(--control-h)) - 2px);
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        resize: vertical;
        overflow: auto;
      }
      .input:disabled {
        resize: none;
      }
      :host([autosize]) .input {
        resize: none;
        overflow: hidden;
      }
    `,
  ];

  /** The current value. The `value` attribute is the default the form resets to. */
  @property() accessor value = '';
  @property() accessor placeholder = '';
  /** Visible rows; the minimum height when `autosize` is set. */
  @property({ type: Number }) accessor rows = 3;
  /** Grows with the content instead of scrolling. */
  @property({ type: Boolean, reflect: true }) accessor autosize = false;
  @property({ type: Number }) accessor minlength: number | undefined;
  /** Maximum length; also shows a counter. */
  @property({ type: Number }) accessor maxlength: number | undefined;
  @property({ type: Boolean, reflect: true }) accessor readonly = false;
  /** Sets the text in mono, for machine strings. */
  @property({ type: Boolean, reflect: true }) accessor mono = false;

  @query('textarea') private accessor textarea!: HTMLTextAreaElement | null;

  override focus(options?: FocusOptions): void {
    this.textarea?.focus(options);
  }
  override blur(): void {
    this.textarea?.blur();
  }

  get #defaultValue(): string {
    return this.getAttribute('value') ?? '';
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) this.setFormValue(this.value);
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('autosize') || changed.has('rows')) this.#resize();
  }
  protected override computeValidity() {
    return nativeValidity(this.textarea);
  }
  formResetCallback(): void {
    this.value = this.#defaultValue;
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  #resize() {
    const ta = this.textarea;
    if (!ta || !this.autosize) {
      if (ta) ta.style.height = '';
      return;
    }
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }

  #onInput = () => {
    this.value = this.textarea!.value;
    this.#resize();
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: this.value });
  };
  #onChange = () => {
    if (this.value) this.touched = true;
    this.emitChange<MmValueDetail>({ value: this.value });
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
            ><span class="visually-hidden" aria-live="polite">${remaining !== undefined && remaining <= 20 ? `${remaining} ${str('charactersRemaining', 'characters remaining')}` : ''}</span>`
        : nothing;
    return html`<div class="field">
      ${this.renderLabel()}
      <div part="control" class=${classMap({ box: true, invalid, disabled, mono: this.mono })}>
        <textarea
          part="textarea"
          class="input"
          id=${this.ids.control}
          data-anchor
          .value=${live(this.value)}
          rows=${this.rows}
          placeholder=${ifDefined(this.placeholder || undefined)}
          minlength=${ifDefined(this.minlength)}
          maxlength=${ifDefined(this.maxlength)}
          spellcheck=${this.mono ? 'false' : 'true'}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${disabled}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          @input=${this.#onInput}
          @change=${this.#onChange}
        ></textarea>
      </div>
      ${this.renderMessages(counter)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-textarea': MmTextarea;
  }
}
