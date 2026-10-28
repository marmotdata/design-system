import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * Base class for form controls. Form-associated through ElementInternals, so controls submit with
 * native <form>s and SvelteKit form actions, take part in validation, reset and fieldset disabling.
 * Subclasses call `setFormValue()` whenever their value changes and `setValidity()` after validating;
 * the shadow element marked `data-anchor` receives the browser's validation bubble.
 */
export abstract class MmFormControl extends LitElement {
  static formAssociated = true;
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  protected readonly internals: ElementInternals = this.attachInternals();

  /** Name submitted with the form. */
  @property({ reflect: true }) accessor name = '';
  /** Disables the control and excludes it from submission. */
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Requires a value before the form submits. */
  @property({ type: Boolean, reflect: true }) accessor required = false;

  #formDisabled = false;

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }
  /** True when disabled directly or by a disabled ancestor fieldset. */
  get isDisabled(): boolean {
    return this.disabled || this.#formDisabled;
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }
  setCustomValidity(message: string): void {
    if (message) this.internals.setValidity({ customError: true }, message, this.validationAnchor());
    else this.internals.setValidity({});
  }

  protected setFormValue(value: string | FormData | null, state?: string | FormData | null): void {
    this.internals.setFormValue(value, state ?? value);
  }
  protected setValidity(flags: ValidityStateFlags, message?: string): void {
    this.internals.setValidity(flags, message, this.validationAnchor());
  }
  /** The element browser validation bubbles point at. */
  protected validationAnchor(): HTMLElement | undefined {
    return this.renderRoot?.querySelector?.<HTMLElement>('[data-anchor]') ?? undefined;
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled;
    this.requestUpdate();
  }
  /** Restore the initial value when the owning form resets. */
  abstract formResetCallback(): void;
}
