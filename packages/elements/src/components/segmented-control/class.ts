import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { MmFormControl } from '../../core/form-control.js';
import { isRtl, rovingKeydown } from '../../core/roving.js';
import { describedBy, fieldStyles, helpAndError, str } from '../select/field.js';
import '@marmotdata/icons/define.js';

/**
 * One option in a segmented control. The text content is the label; keep it short and sentence
 * case (“24h”, “Table”). Icon-only segments need `label`, which becomes the accessible name.
 *
 * @tagname mm-segment
 * @summary One option in a segmented control.
 * @slot - The label.
 * @csspart icon - The leading icon.
 */
export class MmSegment extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 0;
        height: calc(var(--mm-control, var(--control-h)) - 8px);
        padding: 0 10px;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        font: var(--text-label);
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      :host(:hover) {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
      :host([checked]) {
        background: var(--mm-text);
        color: var(--mm-on-inverse);
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
      :host([disabled]) {
        cursor: not-allowed;
        color: var(--mm-text-3);
        background: transparent;
      }
      :host([checked][disabled]) {
        background: var(--mm-text-2);
        color: var(--mm-on-inverse);
      }
      :host([icon-only]) {
        padding: 0;
        width: calc(var(--mm-control, var(--control-h)) - 8px);
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  /** Value submitted with the form. Defaults to the label text. */
  @property({ reflect: true }) accessor value = '';
  /** Leading Material Symbols icon. */
  @property() accessor icon = '';
  /** The segment's text when nothing is slotted; for an icon-only segment, its accessible name. */
  @property() accessor label = '';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Set by the parent control. */
  @property({ type: Boolean, reflect: true }) accessor checked = false;

  get segmentValue(): string {
    return this.value || this.label || (this.textContent ?? '').trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'radio');
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
  }
  get #slotted(): boolean {
    return !!(this.textContent ?? '').trim();
  }
  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    this.toggleAttribute('icon-only', !!this.icon && !this.#slotted);
  }
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.setAttribute('aria-checked', String(this.checked));
    // The label is visible text unless the segment is icon-only, where it becomes the name.
    if (this.label && this.icon && !this.#slotted) this.setAttribute('aria-label', this.label);
    else this.removeAttribute('aria-label');
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  override render() {
    return html`${this.icon ? html`<mm-icon part="icon" name=${this.icon}></mm-icon>` : nothing}<span class="label"
        ><slot @slotchange=${() => this.requestUpdate()}>${this.icon ? nothing : this.label}</slot
      ></span>`;
  }
}

/**
 * Segmented controls pick one of two to four modes, such as a time range (“24h”, “7d”, “30d”) or a
 * view (“Table”, “List”). The track is `mm-surface` with the control border; the selected segment is
 * inverted ink. Labels are short and sentence case. It is a radio group: one tab stop, arrow keys
 * move and select (flipped in right-to-left), and it submits its value with a form.
 *
 * Keyboard follows the WAI-ARIA radio group pattern (https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
 *
 * @tagname mm-segmented-control
 * @summary Pick one of two to four modes.
 * @slot - `mm-segment` elements.
 * @csspart track - The radio group track.
 * @fires mm-change - {{ value: string }} The selected segment changed by user action.
 * @fires mm-input - {{ value: string }} Fired with mm-change.
 * @fires change - Native-style change event.
 */
export class MmSegmentedControl extends MmFormControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: inline-block;
        max-width: 100%;
        vertical-align: top;
      }
      .track {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        max-width: 100%;
        justify-self: start;
        min-height: var(--mm-control, var(--control-h));
        padding: 3px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-md);
      }
      .track.invalid {
        border-color: var(--mm-danger);
      }
      .track.disabled {
        background: var(--mm-sunken);
      }
      ::slotted(mm-segment) {
        flex: 0 1 auto;
      }
      @media (pointer: coarse) {
        .track {
          min-height: var(--target-touch);
        }
      }
    `,
  ];

  /** The selected value. */
  @property() accessor value = '';
  /** Group label, shown above the track unless `hide-label` is set. */
  @property() accessor label = '';
  /** Visually hide the label (it is still announced). Common in toolbars. */
  @property({ type: Boolean, attribute: 'hide-label' }) accessor hideLabel = false;
  @property() accessor help = '';
  @property() accessor error = '';

  #initial: string | null = null;

  get segments(): MmSegment[] {
    return [...this.querySelectorAll('mm-segment')];
  }

  override focus(options?: FocusOptions) {
    const segs = this.segments;
    (segs.find((s) => s.tabIndex === 0) ?? segs[0])?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.#initial === null) this.#initial = this.value;
    if (changed.has('value')) this.setFormValue(this.value || null);
  }
  protected override updated(changed: PropertyValues): void {
    this.#sync();
    if (changed.has('value') || changed.has('required')) {
      if (this.required && !this.value) this.setValidity({ valueMissing: true }, str('chooseOption'));
      else this.setValidity({});
    }
  }

  #sync() {
    const segs = this.segments;
    const disabled = this.isDisabled;
    const current = segs.find((s) => s.segmentValue === this.value && !s.disabled);
    const tabbable = current ?? segs.find((s) => !s.disabled);
    for (const s of segs) {
      s.checked = s.segmentValue === this.value;
      s.tabIndex = !disabled && s === tabbable ? 0 : -1;
      if (disabled) s.setAttribute('aria-disabled', 'true');
      else if (!s.disabled) s.removeAttribute('aria-disabled');
    }
  }

  formResetCallback(): void {
    this.value = this.#initial ?? '';
  }

  #select(seg: MmSegment) {
    if (this.isDisabled || seg.disabled) return;
    const v = seg.segmentValue;
    if (v === this.value) return;
    this.value = v;
    emit(this, 'mm-input', { value: v });
    emit(this, 'mm-change', { value: v });
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    const segs = this.segments;
    const i = segs.indexOf(e.target as MmSegment);
    if (i < 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.#select(segs[i]!);
      return;
    }
    const next = rovingKeydown(e, segs, i, { orientation: 'both', wrap: true, rtl: isRtl(this) });
    if (next !== null) this.#select(segs[next]!);
  };

  #onClick = (e: MouseEvent) => {
    const seg = e.composedPath().find((n): n is MmSegment => n instanceof MmSegment);
    if (!seg || seg.disabled || this.isDisabled) return;
    seg.focus();
    this.#select(seg);
  };

  override render() {
    const invalid = !!this.error;
    const disabled = this.isDisabled;
    return html`<div class="field">
      <span class="label ${this.hideLabel ? 'visually-hidden' : ''}" id="label" part="label">${this.label}</span>
      <div
        class="track ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''}"
        part="track"
        role="radiogroup"
        data-anchor
        aria-labelledby="label"
        aria-describedby=${ifDefined(describedBy(this.help, this.error))}
        aria-required=${this.required ? 'true' : nothing}
        aria-invalid=${invalid ? 'true' : nothing}
        aria-disabled=${disabled ? 'true' : nothing}
        @keydown=${this.#onKeydown}
        @click=${this.#onClick}
      >
        <slot @slotchange=${() => this.#sync()}></slot>
      </div>
      ${helpAndError(this.help, this.error)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-segmented-control': MmSegmentedControl;
    'mm-segment': MmSegment;
  }
}
