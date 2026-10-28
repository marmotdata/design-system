import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { isRtl, rovingKeydown } from '../../core/roving.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, str, type MmValueDetail, type ValidityResult } from '../form-field/class.js';

/**
 * One option in an `mm-radio-group`. The slotted text is the label; `description` adds a second
 * line. The group manages `checked`, focus and keyboard.
 *
 * @tagname mm-radio
 * @summary One option in a radio group.
 * @slot - The option label.
 * @csspart control - The circle.
 * @csspart label - The label wrapper.
 * @csspart description - The description line.
 */
export class MmRadio extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        min-height: 24px;
        padding-block: 2px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
        color: var(--mm-text);
        outline: none;
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
      :host([aria-disabled='true']) {
        cursor: not-allowed;
        color: var(--mm-text-3);
      }
      .circle {
        position: relative;
        flex: none;
        width: 16px;
        height: 16px;
        margin-top: 1.5px;
        /* A radio is round by definition; this is the shape, not the pill radius. */
        border-radius: 50%;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        transition: border-color var(--mm-dur-press) var(--mm-ease);
      }
      .circle::after {
        content: '';
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        background: var(--mm-text);
        transform: scale(0);
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host(:hover) .circle {
        border-color: var(--mm-text);
      }
      :host([aria-checked='true']) .circle {
        border-color: var(--mm-text);
      }
      :host([aria-checked='true']) .circle::after {
        transform: scale(1);
      }
      :host([data-invalid]) .circle {
        border-color: var(--mm-danger);
      }
      :host([aria-disabled='true']) .circle {
        background: var(--mm-sunken);
        border-color: var(--mm-rule);
      }
      :host([aria-disabled='true']) .circle::after {
        background: var(--mm-text-3);
      }
      .text {
        display: grid;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .description {
        font: var(--text-caption);
        color: var(--mm-text-3);
      }
    `,
  ];

  /** Submitted by the group when this option is chosen. */
  @property() accessor value = '';
  /** Set by the group. The `checked` attribute marks the default option the form resets to. */
  @property({ type: Boolean }) accessor checked = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** A second line under the label. */
  @property() accessor description = '';
  /** Set by the group when the whole group is disabled. */
  @property({ attribute: false }) accessor groupDisabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'radio');
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
  }

  protected override willUpdate(): void {
    this.setAttribute('aria-checked', this.checked ? 'true' : 'false');
    if (this.disabled || this.groupDisabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
    if (this.description) this.setAttribute('aria-description', this.description);
    else this.removeAttribute('aria-description');
  }

  override render() {
    return html`<span part="control" class="circle"></span
      ><span class="text"
        ><span part="label"><slot></slot></span
        >${this.description ? html`<span part="description" class="description" aria-hidden="true">${this.description}</span>` : nothing}</span
      >`;
  }
}

/**
 * Radio groups pick exactly one of a few options that are all worth seeing at once: a refresh
 * schedule, a sampling strategy, a lineage depth. For more than five options, use a select. The
 * group label works as a legend: it names the group and sits above it in the label style.
 *
 * Keyboard follows the WAI-ARIA radio group pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/radio/): Tab enters the group on the chosen option (or
 * the first), arrow keys move and choose (Left and Right swap in right-to-left), Space chooses the
 * focused option, and Tab leaves the group. `orientation` only changes the layout.
 *
 * Form-associated: submits the chosen `value` under `name`. `required` means one must be chosen.
 * The `value` attribute, or the `checked` attribute on an `mm-radio`, is the default the form
 * resets to.
 *
 * @tagname mm-radio-group
 * @summary Pick one of a few options.
 * @slot - `mm-radio` options.
 * @csspart label - The group label (legend).
 * @csspart group - The radiogroup wrapper.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-input - {MmValueDetail} When an option is chosen.
 * @fires mm-change - {MmValueDetail} When an option is chosen.
 * @fires input - When an option is chosen.
 * @fires change - When an option is chosen.
 */
export class MmRadioGroup extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .group {
        display: grid;
        gap: 6px;
        min-width: 0;
      }
      .options {
        display: grid;
        gap: var(--space-1);
      }
      :host([orientation='horizontal']) .options {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-5);
      }
    `,
  ];

  /** The chosen option's value. */
  @property() accessor value = '';
  /** `vertical` (default) or `horizontal` layout. Arrow keys work in both directions either way. */
  @property({ reflect: true }) accessor orientation: 'vertical' | 'horizontal' = 'vertical';

  /** The options, in order. */
  get radios(): MmRadio[] {
    return Array.from(this.querySelectorAll('mm-radio'));
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('click', this.#onClick);
  }

  override focus(options?: FocusOptions): void {
    const radios = this.radios;
    (radios.find((r) => r.tabIndex === 0) ?? radios[0])?.focus(options);
  }

  protected override validationAnchor(): HTMLElement | undefined {
    return this.radios.find((r) => r.tabIndex === 0) ?? this.radios[0];
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) this.setFormValue(this.value || null);
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.#sync();
  }
  protected override computeValidity(): ValidityResult {
    if (this.required && !this.value) return { flags: { valueMissing: true }, message: str('selectOption', 'Select an option.') };
    return { flags: {}, message: '' };
  }

  #defaultValue(): string {
    return this.getAttribute('value') ?? this.radios.find((r) => r.hasAttribute('checked'))?.value ?? '';
  }
  formResetCallback(): void {
    this.value = this.#defaultValue();
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  #onSlotChange = () => {
    if (!this.value) {
      const d = this.#defaultValue();
      if (d) this.value = d;
    }
    this.#sync();
  };

  #sync() {
    const radios = this.radios;
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const chosen = this.value ? radios.find((r) => r.value === this.value) : undefined;
    const stop = chosen && !chosen.disabled ? chosen : radios.find((r) => !r.disabled);
    for (const r of radios) {
      r.checked = r === chosen;
      r.groupDisabled = disabled;
      r.toggleAttribute('data-invalid', invalid);
      r.tabIndex = !disabled && r === stop ? 0 : -1;
    }
  }

  #choose(r: MmRadio) {
    if (this.isDisabled || r.disabled || r.value === this.value) return;
    this.value = r.value;
    this.touched = true;
    this.updateValidity();
    this.emitInput<MmValueDetail>({ value: this.value }, true);
    this.emitChange<MmValueDetail>({ value: this.value });
  }

  #onClick = (e: MouseEvent) => {
    const r = (e.target as Element).closest?.('mm-radio');
    if (!r || !this.contains(r) || r.disabled || this.isDisabled) return;
    this.#choose(r);
    r.focus();
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    const radios = this.radios;
    const current = radios.indexOf(e.target as MmRadio);
    if (current < 0) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.#choose(radios[current]!);
      return;
    }
    if (e.key === 'Home' || e.key === 'End') return;
    const next = rovingKeydown(e, radios, current, { orientation: 'both', rtl: isRtl(this), wrap: true });
    if (next !== null) this.#choose(radios[next]!);
  };

  override render() {
    const invalid = !!this.errorText;
    return html`<div class="field">
      <div
        part="group"
        class="group"
        role="radiogroup"
        aria-labelledby=${this.ids.label}
        aria-describedby=${ifDefined(this.describedBy())}
        aria-required=${ifDefined(this.required ? 'true' : undefined)}
        aria-invalid=${invalid ? 'true' : 'false'}
        aria-disabled=${ifDefined(this.isDisabled ? 'true' : undefined)}
      >
        ${this.renderLabel(false)}
        <div class=${classMap({ options: true })}><slot @slotchange=${this.#onSlotChange}></slot></div>
      </div>
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-radio-group': MmRadioGroup;
    'mm-radio': MmRadio;
  }
}
