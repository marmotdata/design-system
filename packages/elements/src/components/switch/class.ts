import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, str, type ValidityResult } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

/** Detail for switch `mm-input` and `mm-change`. */
export interface MmSwitchDetail {
  checked: boolean;
  value: string;
}

/**
 * Switches turn a setting on or off with immediate effect: "Run this pipeline on a schedule",
 * "Mask PII in query results". Use a checkbox instead when the choice only applies after a form is
 * saved alongside other fields.
 *
 * State never relies on colour alone: when on, the track fills with ink and the thumb moves to the
 * end and carries a tick; when off, the track is open and the thumb is empty. Set `state-label` to
 * also print "On" or "Off" beside the label. The track is a 4px-radius control, not a pill: the
 * The guidelines keep full radius for avatars, status pills and filter pills.
 *
 * Keyboard: Space and Enter toggle (https://www.w3.org/WAI/ARIA/apg/patterns/switch/). The control
 * is a native button with `role="switch"` and `aria-checked`.
 *
 * Form-associated: submits `value` (default `on`) under `name` only while on. `required` means it
 * must be on. The `checked` attribute is the default the form resets to.
 *
 * @tagname mm-switch
 * @summary Turns a setting on or off.
 * @csspart control - The switch button (track).
 * @csspart thumb - The moving thumb.
 * @csspart label - The label beside the switch.
 * @csspart description - The description line.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-input - {MmSwitchDetail} When the switch is toggled.
 * @fires mm-change - {MmSwitchDetail} When the switch is toggled.
 * @fires input - When the switch is toggled.
 * @fires change - When the switch is toggled.
 */
export class MmSwitch extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
      }
      .field {
        gap: 2px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 24px;
      }
      .track {
        position: relative;
        flex: none;
        width: 40px;
        height: 24px;
        padding: 0;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          border-color var(--mm-dur-press) var(--mm-ease);
      }
      .track:hover {
        border-color: var(--mm-text);
      }
      .thumb {
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        display: grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 2px;
        background: var(--mm-control-border);
        color: var(--mm-text);
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      .thumb mm-icon {
        opacity: 0;
      }
      .track[aria-checked='true'] {
        background: var(--mm-text);
        border-color: var(--mm-text);
      }
      .track[aria-checked='true'] .thumb {
        background: var(--mm-on-inverse);
        transform: translateX(16px);
      }
      :host(:dir(rtl)) .track[aria-checked='true'] .thumb {
        transform: translateX(-16px);
      }
      .track[aria-checked='true'] .thumb mm-icon {
        opacity: 1;
      }
      .invalid .track[aria-checked='false'] {
        border-color: var(--mm-danger);
      }
      .track:disabled {
        cursor: not-allowed;
        background: var(--mm-sunken);
        border-color: var(--mm-rule);
      }
      .track:disabled[aria-checked='true'] {
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
      .state {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-weight: 600;
      }
      .disabled .text {
        color: var(--mm-text-3);
        cursor: not-allowed;
      }
      .description,
      .messages,
      .error {
        margin: 0;
        padding-inline-start: calc(40px + var(--space-2));
      }
      .description {
        font: var(--text-caption);
        color: var(--mm-text-3);
        overflow-wrap: anywhere;
      }
    `,
  ];

  @property({ type: Boolean }) accessor checked = false;
  /** Submitted under `name` while on. Default `on`. */
  @property() accessor value = 'on';
  /** A second line under the label. */
  @property() accessor description = '';
  /** Also prints "On" or "Off" beside the label. */
  @property({ type: Boolean, reflect: true, attribute: 'state-label' }) accessor stateLabel = false;

  @query('button') private accessor button!: HTMLButtonElement | null;

  override focus(options?: FocusOptions): void {
    this.button?.focus(options);
  }
  override blur(): void {
    this.button?.blur();
  }

  /** Flips the switch, as a click or Space does. */
  toggle(): void {
    if (this.isDisabled) return;
    this.checked = !this.checked;
    this.touched = true;
    this.updateValidity();
    const detail = { checked: this.checked, value: this.value };
    this.emitInput<MmSwitchDetail>(detail, true);
    this.emitChange<MmSwitchDetail>(detail);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('checked') || changed.has('value')) this.setFormValue(this.checked ? this.value : null, this.checked ? 'on' : 'off');
  }
  protected override computeValidity(): ValidityResult {
    if (this.required && !this.checked) return { flags: { valueMissing: true }, message: str('switchRequired', 'Turn this on to continue.') };
    return { flags: {}, message: '' };
  }
  formResetCallback(): void {
    this.checked = this.hasAttribute('checked');
    this.resetField();
  }
  formStateRestoreCallback(state: string | null): void {
    this.checked = state === 'on';
  }

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    return html`<div class=${classMap({ field: true, invalid, disabled })}>
      <div class="row">
        <button
          part="control"
          class="track"
          type="button"
          role="switch"
          id=${this.ids.control}
          data-anchor
          aria-checked=${this.checked ? 'true' : 'false'}
          aria-required=${ifDefined(this.required ? 'true' : undefined)}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy(!!this.description && this.ids.desc))}
          ?disabled=${disabled}
          @click=${() => this.toggle()}
        >
          <span part="thumb" class="thumb"><mm-icon name="check" size="14" aria-hidden="true"></mm-icon></span>
        </button>
        <label part="label" class=${classMap({ text: true, 'visually-hidden': this.hideLabel })} for=${this.ids.control} id=${this.ids.label}
          ><span>${this.label}</span>${this.renderMarker()}</label
        >
        ${this.stateLabel ? html`<span class="state" aria-hidden="true">${this.checked ? str('on', 'On') : str('off', 'Off')}</span>` : nothing}
      </div>
      ${this.description ? html`<p part="description" class="description" id=${this.ids.desc}>${this.description}</p>` : nothing}
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-switch': MmSwitch;
  }
}
