import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { MmFormControl } from '../../core/form-control.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { t, type StringKey } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';

/**
 * A built-in string with a local fallback, for keys not yet in `defaultStrings`.
 * @internal
 */
export function str(key: string, fallback: string): string {
  return (t(key as StringKey) as string | undefined) ?? fallback;
}

/**
 * Shared field CSS for every Marmot form element: the label (12px, 600, sentence case, `mm-text-2`),
 * required and optional markers in words, help and error lines, and the 36px input box.
 *
 * Classes: `.field` (label, control, messages stacked 6px apart), `.label` (`.marker` inside),
 * `.box` (the bordered input shell; add `.invalid`, `.disabled`, `.mono`), `.input` (a native
 * input or textarea inside `.box`), `.icon-btn` (24px ghost button inside `.box`), `.messages`,
 * `.help`, `.error` (crimson line with an icon), `.counter` and `.visually-hidden`.
 */
export const fieldStyles = css`
    ${visuallyHidden}
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .label {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 var(--space-2);
      font: var(--text-label);
      letter-spacing: var(--tracking-label);
      color: var(--mm-text-2);
      margin: 0;
      padding: 0;
    }
    .marker {
      font: var(--text-caption);
      letter-spacing: var(--tracking-caption);
      color: var(--mm-text-3);
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      height: var(--mm-control, var(--control-h));
      padding-inline: 10px;
      background: var(--mm-surface);
      color: var(--mm-text);
      border: 1px solid var(--mm-control-border);
      border-radius: var(--radius-sm);
      font: var(--text-dense);
      letter-spacing: var(--tracking-dense);
      cursor: text;
      transition: border-color var(--mm-dur-press) var(--mm-ease);
    }
    .box:hover {
      border-color: var(--mm-text-2);
    }
    .box:focus-within {
      border-color: var(--mm-text);
    }
    .box:has(.input:focus-visible) {
      outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
      outline-offset: var(--mm-focus-ring-offset, 2px);
    }
    .box.invalid,
    .box.invalid:hover {
      border-color: var(--mm-danger);
    }
    .box.disabled {
      background: var(--mm-sunken);
      color: var(--mm-text-3);
      border-color: var(--mm-rule);
      cursor: not-allowed;
    }
    .input {
      all: unset;
      flex: 1;
      min-width: 0;
      height: 100%;
      font: inherit;
      letter-spacing: inherit;
      color: inherit;
      text-overflow: ellipsis;
    }
    .input:focus-visible {
      outline: none;
    }
    .input::placeholder {
      color: var(--mm-text-3);
      opacity: 1;
    }
    .input:disabled {
      cursor: not-allowed;
    }
    .box.mono .input {
      font: var(--text-mono-dense);
      letter-spacing: var(--tracking-mono-dense);
    }
    .box > mm-icon,
    .box ::slotted(mm-icon) {
      color: var(--mm-text-3);
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 24px;
      height: 24px;
      margin-inline-end: -6px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--mm-text-2);
      cursor: pointer;
      transition:
        background-color var(--mm-dur-press) var(--mm-ease),
        color var(--mm-dur-press) var(--mm-ease);
    }
    .icon-btn:hover {
      color: var(--mm-text);
      background: var(--mm-sunken);
    }
    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .icon-btn + .icon-btn {
      margin-inline-start: -6px;
    }
    .messages {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .help,
    .error {
      margin: 0;
      font: var(--text-caption);
      letter-spacing: var(--tracking-caption);
      color: var(--mm-text-3);
      overflow-wrap: anywhere;
    }
    .error {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: var(--mm-danger);
    }
    .error mm-icon {
      margin-top: 1px;
      flex: none;
    }
    .counter {
      margin-inline-start: auto;
      font: var(--text-caption);
      color: var(--mm-text-3);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .counter.over {
      color: var(--mm-danger);
    }
    @media (pointer: coarse) {
      .box,
      .box .input,
      .box.mono .input {
        font-size: 16px;
      }
    }
  `;

export interface ValidityResult {
  flags: ValidityStateFlags;
  message: string;
}

/** Copies a native control's validity, so the browser's localised messages are reused. */
export function nativeValidity(el: HTMLInputElement | HTMLTextAreaElement | null | undefined): ValidityResult {
  if (!el) return { flags: {}, message: '' };
  const v = el.validity;
  return {
    flags: {
      valueMissing: v.valueMissing,
      typeMismatch: v.typeMismatch,
      patternMismatch: v.patternMismatch,
      tooLong: v.tooLong,
      tooShort: v.tooShort,
      rangeUnderflow: v.rangeUnderflow,
      rangeOverflow: v.rangeOverflow,
      stepMismatch: v.stepMismatch,
      badInput: v.badInput,
    },
    message: el.validationMessage,
  };
}

/**
 * Shared base for Marmot form controls that render their own label, help and error. Adds `label`,
 * `help`, `error`, `hide-label` and `optional` to `MmFormControl`, wires `aria-describedby` and
 * `aria-invalid` inside the shadow root, and shows the browser's validation message inline (instead
 * of the native bubble) once the form has tried to submit.
 */
export abstract class MmFieldControl extends MmFormControl {
  /** Field label. Rendered above the control unless `hide-label`, and always the accessible name. */
  @property() accessor label = '';
  /** Help text under the control. */
  @property() accessor help = '';
  /** Error text: a sentence saying what to fix. Shows the crimson border, an icon and sets aria-invalid. */
  @property() accessor error = '';
  /** Hides the label visually; it stays the accessible name. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-label' }) accessor hideLabel = false;
  /** Marks the field as optional, in words. */
  @property({ type: Boolean, reflect: true }) accessor optional = false;

  /** True once the user has submitted the form or committed a value, so validation messages show. */
  @state() protected accessor touched = false;
  /** The current validation message (empty when valid). */
  @state() protected accessor validationText = '';

  protected readonly ids = { control: uid('mm-ctl'), label: uid('mm-label'), help: uid('mm-help'), error: uid('mm-error'), desc: uid('mm-desc') };
  #custom = '';

  constructor() {
    super();
    this.addEventListener('invalid', this.#onInvalid);
  }

  /** The visible error: the `error` attribute, or the validation message after a submit attempt. */
  protected get errorText(): string {
    if (this.error) return this.error;
    return this.touched && !this.isDisabled ? this.validationText : '';
  }

  override setCustomValidity(message: string): void {
    this.#custom = message;
    this.updateValidity();
  }

  /** Subclasses report their own validity; the default is always valid. */
  protected computeValidity(): ValidityResult {
    return { flags: {}, message: '' };
  }

  protected updateValidity(): void {
    const r = this.#custom ? { flags: { customError: true }, message: this.#custom } : this.computeValidity();
    const invalid = Object.values(r.flags).some(Boolean);
    if (invalid) this.internals.setValidity(r.flags, r.message || ' ', this.validationAnchor());
    else this.internals.setValidity({});
    const text = invalid ? r.message : '';
    if (text !== this.validationText) this.validationText = text;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.updateValidity();
  }

  #onInvalid = (e: Event) => {
    e.preventDefault();
    this.touched = true;
    const form = this.form;
    if (!form) return;
    const first = Array.from(form.elements).find((el) => !(el instanceof HTMLFieldSetElement) && el.matches(':invalid'));
    if (first === this) this.focus();
  };

  /** Clears the touched state; call from `formResetCallback`. */
  protected resetField(): void {
    this.touched = false;
  }

  /** Dispatches `mm-input` and, when the change was not made by a native control, a composed `input`. */
  protected emitInput<T>(detail: T, native = false): void {
    if (native) this.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    emit(this, 'mm-input', detail);
  }
  /** Dispatches `mm-change` and a bubbling native `change` on the host (native `change` is not composed). */
  protected emitChange<T>(detail: T): void {
    emit(this, 'mm-change', detail);
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Native implicit submission: Enter in a single-line field submits the owning form. */
  protected implicitSubmit(): void {
    const form = this.form;
    if (!form) return;
    const hasSubmit = form.querySelector('button:not([type]), button[type="submit"], input[type="submit"], input[type="image"], mm-button[type="submit"]');
    const fields = Array.from(form.elements).filter((el) => !(el instanceof HTMLButtonElement) && !(el instanceof HTMLFieldSetElement) && !(el as HTMLElement).hidden);
    if (hasSubmit || fields.length === 1) form.requestSubmit();
  }

  protected describedBy(...extra: Array<string | false | undefined>): string | undefined {
    const ids = [this.errorText && this.ids.error, this.help && this.ids.help, ...extra].filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
  }

  protected renderMarker() {
    if (this.required) return html`<span class="marker" aria-hidden="true">${t('required')}</span>`;
    if (this.optional) return html`<span class="marker">${t('optional')}</span>`;
    return nothing;
  }

  /** The label above the control. Pass `false` to render a plain element for groups (named with aria-labelledby). */
  protected renderLabel(forControl = true) {
    const cls = classMap({ label: true, 'visually-hidden': this.hideLabel });
    if (!forControl) return html`<span part="label" id=${this.ids.label} class=${cls}><span>${this.label}</span>${this.renderMarker()}</span>`;
    return html`<label part="label" id=${this.ids.label} for=${this.ids.control} class=${cls}><span>${this.label}</span>${this.renderMarker()}</label>`;
  }

  /** The error line, then the help line with an optional trailing element (a counter). */
  protected renderMessages(trailing: unknown = nothing) {
    const err = this.errorText;
    return html`${err
      ? html`<p class="error" part="error" id=${this.ids.error}><mm-icon name="error" aria-hidden="true"></mm-icon><span>${err}</span></p>`
      : nothing}${this.help || trailing !== nothing
      ? html`<div class="messages">${this.help ? html`<p class="help" part="help" id=${this.ids.help}>${this.help}</p>` : nothing}${trailing}</div>`
      : nothing}`;
  }
}

const managed = new WeakMap<Element, Set<string>>();
function setManaged(el: Element, attr: string, value: string | null) {
  let set = managed.get(el);
  if (!set) managed.set(el, (set = new Set()));
  if (el.hasAttribute(attr) && !set.has(attr)) return; // the author set it; leave it alone
  if (value === null) {
    if (set.has(attr)) el.removeAttribute(attr);
    set.delete(attr);
  } else {
    el.setAttribute(attr, value);
    set.add(attr);
  }
}

const CONTROL = 'input, select, textarea, button, [role], [tabindex], [contenteditable]';

/**
 * A layout wrapper that gives any slotted control the Marmot field furniture: a label above, then
 * the control, then an error line and help text. Use it when composing a custom control; the
 * built-in controls (`mm-text-field`, `mm-select` and so on) render their own.
 *
 * The label and messages live in the shadow root, so the field names the slotted control with
 * `aria-label` and describes it with `aria-description`, and sets `aria-invalid` and
 * `aria-required`. Elements slotted into `label`, `help` and `error` stay in the light DOM and are
 * wired with `aria-labelledby` and `aria-describedby` instead. Attributes the author set are never
 * overwritten. Clicking the label focuses the control.
 *
 * @tagname mm-form-field
 * @summary Label, help and error layout for a slotted control.
 * @slot - The control.
 * @slot label - A rich label, in place of the `label` attribute.
 * @slot help - Rich help text, in place of the `help` attribute.
 * @slot error - Rich error text, in place of the `error` attribute.
 * @csspart label - The label.
 * @csspart control - The wrapper around the slotted control.
 * @csspart help - The help line.
 * @csspart error - The error line.
 */
export class MmFormField extends LitElement {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .label {
        cursor: default;
      }
      .control {
        display: grid;
        min-width: 0;
      }
      .help:not(.has) {
        display: none;
      }
    `,
  ];

  /** Field label; the accessible name of the slotted control. */
  @property() accessor label = '';
  /** Help text under the control. */
  @property() accessor help = '';
  /** Error text: a sentence saying what to fix. */
  @property() accessor error = '';
  /** Shows "Required" beside the label and sets aria-required on the control. */
  @property({ type: Boolean, reflect: true }) accessor required = false;
  /** Shows "Optional" beside the label. */
  @property({ type: Boolean, reflect: true }) accessor optional = false;
  /** Hides the label visually; it stays the accessible name. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-label' }) accessor hideLabel = false;

  @state() private accessor slotted = { label: false, help: false, error: false };

  /** The slotted control that receives the label and description. */
  get control(): HTMLElement | null {
    const first = Array.from(this.children).find((c) => !c.hasAttribute('slot')) as HTMLElement | undefined;
    if (!first) return null;
    return first.matches(CONTROL) ? first : (first.querySelector<HTMLElement>(CONTROL) ?? first);
  }

  #onSlot = () => {
    const has = (n: string) => !!this.querySelector(`:scope > [slot="${n}"]`);
    this.slotted = { label: has('label'), help: has('help'), error: has('error') };
    this.#wire();
  };

  protected override updated(): void {
    this.#wire();
  }

  #wire() {
    const ctl = this.control;
    if (!ctl) return;
    const slotEl = (n: string) => {
      const el = this.querySelector<HTMLElement>(`:scope > [slot="${n}"]`);
      if (el && !el.id) el.id = uid(`mm-${n}`);
      return el;
    };
    const lbl = slotEl('label');
    setManaged(ctl, 'aria-labelledby', lbl ? lbl.id : null);
    setManaged(ctl, 'aria-label', !lbl && this.label ? this.label : null);
    const err = slotEl('error');
    const help = slotEl('help');
    const ids = [err?.id, help?.id].filter(Boolean).join(' ');
    setManaged(ctl, 'aria-describedby', ids || null);
    const text = [this.error, this.help].filter(Boolean).join(' ');
    setManaged(ctl, 'aria-description', text || null);
    setManaged(ctl, 'aria-invalid', this.error || err ? 'true' : null);
    setManaged(ctl, 'aria-required', this.required ? 'true' : null);
  }

  #focusControl = () => this.control?.focus();

  override render() {
    const marker = this.required
      ? html`<span class="marker" aria-hidden="true">${t('required')}</span>`
      : this.optional
        ? html`<span class="marker">${t('optional')}</span>`
        : nothing;
    const hasError = !!this.error || this.slotted.error;
    return html`<div class="field">
      <div part="label" class=${classMap({ label: true, 'visually-hidden': this.hideLabel })} @click=${this.#focusControl}>
        <slot name="label" @slotchange=${this.#onSlot}>${this.label}</slot>${marker}
      </div>
      <div part="control" class="control"><slot @slotchange=${this.#onSlot}></slot></div>
      <p part="error" class="error" ?hidden=${!hasError} aria-hidden=${this.slotted.error ? 'false' : 'true'}>
        <mm-icon name="error"></mm-icon><span><slot name="error" @slotchange=${this.#onSlot}>${this.error}</slot></span>
      </p>
      <p part="help" class=${classMap({ help: true, has: !!this.help || this.slotted.help })} aria-hidden=${this.slotted.help ? 'false' : 'true'}>
        <slot name="help" @slotchange=${this.#onSlot}>${this.help}</slot>
      </p>
    </div>`;
  }
}

/** Detail for `mm-input` and `mm-change` on text controls. */
export interface MmValueDetail {
  value: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-form-field': MmFormField;
  }
}
