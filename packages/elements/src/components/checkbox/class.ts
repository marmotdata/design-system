import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, nativeValidity } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

/** Detail for checkbox `mm-input` and `mm-change`. */
export interface MmCheckedDetail {
  checked: boolean;
  value: string;
}

/**
 * Checkboxes turn one option on or off: "Notify me when this pipeline fails", "Include
 * deprecated assets". The label sits beside the 16px box and is clickable, with an optional
 * description line under it. `indeterminate` shows a dash for a parent whose children are mixed.
 *
 * The checked box is filled with ink (`mm-text`) and carries an `mm-on-inverse` tick. It is not
 * burnt sienna: the guidelines reserves burnt sienna for the primary action, links, the active tab and the
 * current selection, at most once per row. A settings list can hold a dozen ticked boxes, which
 * would spend the accent many times over and read as a row of selections. Ink keeps the state
 * unmistakable at 17:1 while leaving the accent for what it marks.
 *
 * Keyboard: Space toggles (https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/). The control is a
 * native checkbox inside the shadow root, so it is announced as mixed when indeterminate.
 *
 * Form-associated: submits `value` (default `on`) under `name` only while checked, as a native
 * checkbox does. `required` means it must be ticked. The `checked` attribute is the default the
 * form resets to.
 *
 * @tagname mm-checkbox
 * @summary Turns one option on or off.
 * @csspart control - The native checkbox drawn as the box.
 * @csspart label - The label beside the box.
 * @csspart description - The description line.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-input - {MmCheckedDetail} When the box is toggled.
 * @fires mm-change - {MmCheckedDetail} When the box is toggled.
 * @fires input - Native, composed; when the box is toggled.
 * @fires change - Native, re-dispatched on the host when the box is toggled.
 */
export class MmCheckbox extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        min-height: 24px;
        padding-block: 2px;
      }
      .control {
        position: relative;
        display: grid;
        place-items: center;
        flex: none;
        width: 16px;
        height: 16px;
        margin-top: 1.5px;
      }
      .native {
        appearance: none;
        grid-area: 1 / 1;
        width: 16px;
        height: 16px;
        margin: 0;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          border-color var(--mm-dur-press) var(--mm-ease);
      }
      .row:hover .native,
      .native:hover {
        border-color: var(--mm-text);
      }
      .native:checked,
      .native:indeterminate {
        background: var(--mm-text);
        border-color: var(--mm-text);
      }
      .glyph {
        grid-area: 1 / 1;
        color: var(--mm-on-inverse);
        pointer-events: none;
        opacity: 0;
      }
      .native:checked + .glyph,
      .native:indeterminate + .glyph {
        opacity: 1;
      }
      .invalid .native:not(:checked) {
        border-color: var(--mm-danger);
      }
      .native:disabled {
        cursor: not-allowed;
        background: var(--mm-sunken);
        border-color: var(--mm-rule);
      }
      .native:disabled:checked,
      .native:disabled:indeterminate {
        background: var(--mm-text-3);
        border-color: var(--mm-text-3);
      }
      .text {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0 var(--space-2);
        min-width: 0;
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
        color: var(--mm-text);
        overflow-wrap: anywhere;
        cursor: pointer;
      }
      .disabled .text {
        color: var(--mm-text-3);
        cursor: not-allowed;
      }
      .description,
      .messages,
      .error {
        margin: 0;
        padding-inline-start: calc(16px + var(--space-2));
      }
      .description {
        font: var(--text-caption);
        color: var(--mm-text-3);
        overflow-wrap: anywhere;
      }
      .field {
        gap: 2px;
      }
    `,
  ];

  @property({ type: Boolean }) accessor checked = false;
  /** Shows a dash for a mixed state; cleared when the user toggles. */
  @property({ type: Boolean, reflect: true }) accessor indeterminate = false;
  /** Submitted under `name` while checked. Default `on`. */
  @property() accessor value = 'on';
  /** A second line under the label. */
  @property() accessor description = '';

  @query('input') private accessor input!: HTMLInputElement | null;

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }
  override blur(): void {
    this.input?.blur();
  }
  /** Toggles like a click. */
  override click(): void {
    this.input ? this.input.click() : super.click();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('checked') || changed.has('value')) this.setFormValue(this.checked ? this.value : null, this.checked ? 'on' : 'off');
  }
  protected override computeValidity() {
    return nativeValidity(this.input);
  }
  formResetCallback(): void {
    this.checked = this.hasAttribute('checked');
    this.indeterminate = false;
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.checked = state === 'on';
  }

  #onInput = () => {
    this.checked = this.input!.checked;
    this.indeterminate = false;
    this.touched = true;
    this.updateValidity();
    this.emitInput<MmCheckedDetail>({ checked: this.checked, value: this.value });
  };
  #onChange = () => this.emitChange<MmCheckedDetail>({ checked: this.checked, value: this.value });

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const describedBy = this.describedBy(!!this.description && this.ids.desc);
    return html`<div class=${classMap({ field: true, invalid, disabled })}>
      <div class="row">
        <span class="control">
          <input
            part="control"
            class="native"
            type="checkbox"
            id=${this.ids.control}
            data-anchor
            .checked=${live(this.checked)}
            .indeterminate=${this.indeterminate}
            ?required=${this.required}
            ?disabled=${disabled}
            aria-invalid=${invalid ? 'true' : 'false'}
            aria-describedby=${ifDefined(describedBy)}
            @input=${this.#onInput}
            @change=${this.#onChange}
          />
          <mm-icon class="glyph" name=${this.indeterminate ? 'remove' : 'check'} size="14" aria-hidden="true"></mm-icon>
        </span>
        <label part="label" class=${classMap({ text: true, 'visually-hidden': this.hideLabel })} for=${this.ids.control} id=${this.ids.label}
          ><span>${this.label}</span>${this.renderMarker()}</label
        >
      </div>
      ${this.description ? html`<p part="description" class="description" id=${this.ids.desc}>${this.description}</p>` : nothing}
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-checkbox': MmCheckbox;
  }
}
