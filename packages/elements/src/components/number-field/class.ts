import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, nativeValidity, str, type MmValueDetail, type ValidityResult } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

const NBSP = '\u00a0';

/**
 * Number fields take a quantity: a retention period, a row limit, a timeout. Numbers are set in
 * tabular figures and right-aligned so they line up with the tables they configure. An optional
 * `unit` follows the number after a non-breaking space ("500 ms", "10,000 rows").
 *
 * Keyboard follows the WAI-ARIA spinbutton pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/): ArrowUp and ArrowDown change the value
 * by `step`, PageUp and PageDown by ten steps, Home and End jump to `min` and `max` when set. Steps
 * count from `step-base` (default 0), not from `min`, so `min="1" step="100"` gives 1, 100, 200 and
 * so on; `min` and `max` themselves are always valid. The
 * stepper buttons are labelled for assistive technology and stay out of the tab order, since the
 * arrow keys do the same job.
 *
 * Form-associated: submits the number as text under `name`, validates `required`, `min`, `max` and
 * `step`, resets with the form and is disabled by a disabled fieldset.
 *
 * @tagname mm-number-field
 * @summary A number with a unit, steppers and spinbutton keys.
 * @csspart label - The label.
 * @csspart control - The bordered box.
 * @csspart input - The native number input.
 * @csspart unit - The unit suffix.
 * @csspart stepper - Each stepper button.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-input - {MmValueDetail} On every edit and every step.
 * @fires mm-change - {MmValueDetail} When the value is committed (blur after typing, or a step).
 * @fires input - Native, composed; on every edit and step.
 * @fires change - Native, re-dispatched on the host when the value is committed.
 */
export class MmNumberField extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .input {
        text-align: end;
        font-variant-numeric: tabular-nums;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .input::-webkit-inner-spin-button,
      .input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .unit {
        flex: none;
        margin-inline-start: calc(-1 * var(--space-2));
        color: var(--mm-text-2);
        white-space: pre;
      }
      .steppers {
        display: inline-flex;
        flex: none;
        margin-inline-end: -6px;
        padding-inline-start: var(--space-1);
        border-inline-start: 1px solid var(--mm-rule);
      }
      .steppers .icon-btn {
        margin: 0;
      }
    `,
  ];

  /** The current value as text, as it submits. The `value` attribute is the default the form resets to. */
  @property() accessor value = '';
  @property({ type: Number }) accessor min: number | undefined;
  @property({ type: Number }) accessor max: number | undefined;
  /** Step for the arrow keys and steppers; PageUp and PageDown move ten steps. Default 1. */
  @property({ type: Number }) accessor step: number | undefined;
  /**
   * The value the step grid counts from. Default 0, so steps stay round numbers whatever `min` is.
   * Unlike a native number input, `min` is not the base.
   */
  @property({ type: Number, attribute: 'step-base' }) accessor stepBase: number | undefined;
  /** Unit shown after the number, such as `ms` or `rows`. */
  @property() accessor unit = '';
  @property() accessor placeholder = '';
  @property({ type: Boolean, reflect: true }) accessor readonly = false;
  /** Hides the stepper buttons; the arrow keys still work. */
  @property({ type: Boolean, reflect: true, attribute: 'no-steppers' }) accessor noSteppers = false;

  @query('input') private accessor input!: HTMLInputElement | null;

  /** The value as a number, or NaN when empty. */
  get valueAsNumber(): number {
    return this.value.trim() === '' ? NaN : Number(this.value);
  }
  set valueAsNumber(n: number) {
    this.value = Number.isFinite(n) ? String(n) : '';
  }

  override focus(options?: FocusOptions): void {
    this.input?.focus(options);
  }
  override blur(): void {
    this.input?.blur();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) this.setFormValue(this.value);
  }
  protected override computeValidity(): ValidityResult {
    // The native input gets step="any" (it would count steps from min), so step is checked here.
    const r = nativeValidity(this.input);
    if (Object.values(r.flags).some(Boolean)) return r;
    const mismatch = this.#stepMismatch();
    if (!mismatch) return r;
    const fmt = (n: number) => n.toLocaleString(this.lang || undefined);
    return {
      flags: { stepMismatch: true },
      message: str('numberStepMismatch', 'Enter a valid value. The nearest are {lower} and {upper}.')
        .replace('{lower}', fmt(mismatch[0]))
        .replace('{upper}', fmt(mismatch[1])),
    };
  }

  /** The two nearest valid values when the current value is off the step grid, else null. */
  #stepMismatch(): [number, number] | null {
    const step = this.step;
    const v = this.valueAsNumber;
    if (!step || step <= 0 || !Number.isFinite(v) || v === this.min || v === this.max) return null;
    const stepBase = this.stepBase ?? 0;
    const k = (v - stepBase) / step;
    // Tolerate float error, so 0.1 + 0.2 on a 0.1 grid still counts as on it.
    if (Math.abs(k - Math.round(k)) < 1e-9) return null;
    const decimals = (String(step).split('.')[1] ?? '').length;
    let lower = Number((stepBase + Math.floor(k) * step).toFixed(decimals));
    let upper = Number((stepBase + Math.ceil(k) * step).toFixed(decimals));
    if (this.min !== undefined) lower = Math.max(this.min, lower);
    if (this.max !== undefined) upper = Math.min(this.max, upper);
    return [lower, upper];
  }
  formResetCallback(): void {
    this.value = this.getAttribute('value') ?? '';
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  /** Moves the value by `n` steps, clamped to min and max. */
  stepBy(n: number): void {
    if (this.isDisabled || this.readonly) return;
    const step = this.step && this.step > 0 ? this.step : 1;
    const decimals = Math.max((String(step).split('.')[1] ?? '').length, (this.value.split('.')[1] ?? '').length);
    const cur = this.valueAsNumber;
    const stepBase = this.stepBase ?? 0;
    let next = Number.isNaN(cur) ? (this.min ?? (this.max !== undefined ? Math.min(0, this.max) : 0)) : cur + n * step;
    // Snap to the grid from step-base (not min), then clamp, so a step never lands on an invalid value.
    next = stepBase + Math.round((next - stepBase) / step) * step;
    if (this.min !== undefined) next = Math.max(this.min, next);
    if (this.max !== undefined) next = Math.min(this.max, next);
    next = Number(next.toFixed(decimals));
    this.#commit(String(next));
  }

  #commit(value: string) {
    if (value === this.value) return;
    this.value = value;
    if (this.input) this.input.value = value;
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value }, true);
    this.emitChange<MmValueDetail>({ value });
  }

  #onInput = () => {
    this.value = this.input!.value;
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: this.value });
  };
  #onChange = () => {
    this.touched = true;
    this.emitChange<MmValueDetail>({ value: this.value });
  };
  #onKeydown = (e: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    const n = steps[e.key];
    if (n !== undefined) {
      e.preventDefault();
      this.stepBy(n);
    } else if (e.key === 'Home' && this.min !== undefined) {
      e.preventDefault();
      this.#commit(String(this.min));
    } else if (e.key === 'End' && this.max !== undefined) {
      e.preventDefault();
      this.#commit(String(this.max));
    } else if (e.key === 'Enter' && !e.isComposing) {
      this.implicitSubmit();
    }
  };
  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const num = this.valueAsNumber;
    const atMin = this.min !== undefined && num <= this.min;
    const atMax = this.max !== undefined && num >= this.max;
    const keepFocus = (e: Event) => e.preventDefault();
    return html`<div class="field">
      ${this.renderLabel()}
      <div part="control" class=${classMap({ box: true, invalid, disabled })} @click=${(e: Event) => e.target === e.currentTarget && this.input?.focus()}>
        <input
          part="input"
          class="input"
          id=${this.ids.control}
          data-anchor
          type="number"
          inputmode="decimal"
          autocomplete="off"
          .value=${live(this.value)}
          min=${ifDefined(this.min)}
          max=${ifDefined(this.max)}
          step="any"
          placeholder=${ifDefined(this.placeholder || undefined)}
          aria-valuetext=${ifDefined(this.unit && this.value ? `${this.value}${NBSP}${this.unit}` : undefined)}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          ?required=${this.required}
          ?readonly=${this.readonly}
          ?disabled=${disabled}
          @input=${this.#onInput}
          @change=${this.#onChange}
          @keydown=${this.#onKeydown}
        />
        ${this.unit ? html`<span part="unit" class="unit" aria-hidden="true">${NBSP}${this.unit}</span>` : nothing}
        ${this.noSteppers || this.readonly
          ? nothing
          : html`<span class="steppers">
              <button part="stepper" type="button" class="icon-btn" tabindex="-1" aria-label=${str('decrease', 'Decrease')} aria-controls=${this.ids.control}
                ?disabled=${disabled || atMin} @mousedown=${keepFocus} @click=${() => this.stepBy(-1)}><mm-icon name="remove"></mm-icon></button>
              <button part="stepper" type="button" class="icon-btn" tabindex="-1" aria-label=${str('increase', 'Increase')} aria-controls=${this.ids.control}
                ?disabled=${disabled || atMax} @mousedown=${keepFocus} @click=${() => this.stepBy(1)}><mm-icon name="add"></mm-icon></button>
            </span>`}
      </div>
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-number-field': MmNumberField;
  }
}
