import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { describedBy, fieldStyles, helpAndError, str } from '../select/field.js';
import { MmListboxControl, boxStyles, listboxStyles } from '../select/listbox-control.js';
import type { MmOption } from '../select/option.js';
import '@marmotdata/icons/define.js';

export { MmOption, MmOptionGroup, type MmOptionData } from '../select/option.js';
export type { MmOptionLoader } from '../select/listbox-control.js';

/** Styles for the text input inside a combobox box, shared with mm-multiselect. */
export const comboInputStyles = css`
  .box {
    cursor: text;
  }
  .lead {
    display: inline-flex;
    flex: none;
    color: var(--mm-text-2);
  }
  .clear {
    all: unset;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    color: var(--mm-text-2);
    cursor: pointer;
  }
  .clear::after {
    content: '';
    position: absolute;
    inset: -2px;
  }
  .clear:hover {
    color: var(--mm-text);
    background: var(--mm-sunken);
  }
  .chevron {
    margin-inline-start: 0;
  }
`;

/**
 * Comboboxes let people type to find one value in a long or remote list: an asset, an owner, a
 * glossary term. Typing filters the list (list autocomplete, manual selection) and emphasises the
 * matched text. Options come from slotted `mm-option` elements or from an async `loader`, which is
 * debounced by 150ms, aborts stale requests, shows a loading row only after 200ms and offers a retry
 * when it fails. With `allow-custom`, free text is accepted as the value.
 *
 * Keyboard follows the WAI-ARIA editable combobox with list autocomplete pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/): Down and
 * Up open and move, Alt+Down opens without moving, Enter selects, Escape closes and then clears,
 * Home and End move the caret.
 *
 * @tagname mm-combobox
 * @summary Type to find one value, with async search.
 * @slot - `mm-option` and `mm-option-group` elements, when not using `loader`.
 * @csspart control - The field box.
 * @csspart input - The text input.
 * @csspart popup - The floating panel.
 * @csspart listbox - The listbox.
 * @fires mm-change - {{ value: string }} The value changed by user action.
 * @fires mm-input - {{ query: string }} The typed text changed.
 * @fires change - Native-style change event.
 */
export class MmCombobox extends MmListboxControl {
  static override styles = [
    base,
    fieldStyles,
    boxStyles,
    listboxStyles,
    comboInputStyles,
    css`
      :host {
        display: inline-block;
        width: 320px;
        max-width: 100%;
        vertical-align: top;
      }
    `,
  ];

  /** The selected value, or the typed text with `allow-custom`. */
  @property() accessor value = '';
  /** Label shown for the initial value when options come from a loader. */
  @property({ attribute: 'value-label' }) accessor valueLabel = '';
  /** Accept free text that matches no option. */
  @property({ type: Boolean, attribute: 'allow-custom' }) accessor allowCustom = false;
  /** Visually hide the label (it is still announced). */
  @property({ type: Boolean, attribute: 'hide-label' }) accessor hideLabel = false;

  @state() private accessor text = '';
  @query('input') accessor #input!: HTMLInputElement | null;
  #initial: string | null = null;
  #initialLabel = '';

  protected get comboboxEl() {
    return this.#input;
  }
  protected get anchorEl() {
    return this.renderRoot?.querySelector?.<HTMLElement>('.box') ?? null;
  }
  protected isSelected(v: string) {
    return v === this.value && this.value !== '';
  }

  override focus(options?: FocusOptions) {
    this.#input?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.#initial === null) {
      this.#initial = this.value;
      this.#initialLabel = this.valueLabel;
    }
    if (changed.has('valueLabel') && this.valueLabel && this.value) {
      this.knownLabels.set(this.value, { value: this.value, label: this.valueLabel });
    }
    if (changed.has('value')) {
      this.text = this.value ? this.labelFor(this.value) : '';
      this.setFormValue(this.value || null);
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('required')) {
      if (this.required && !this.value) this.setValidity({ valueMissing: true }, str(this.allowCustom ? 'fillField' : 'chooseOption'));
      else this.setValidity({});
    }
  }
  override firstUpdated(): void {
    // Options may upgrade after the first render, so resolve the label again.
    if (this.value) this.text = this.labelFor(this.value);
  }

  formResetCallback(): void {
    this.valueLabel = this.#initialLabel;
    if (this.#initialLabel && this.#initial) this.knownLabels.set(this.#initial, { value: this.#initial, label: this.#initialLabel });
    this.value = this.#initial ?? '';
    this.text = this.value ? this.labelFor(this.value) : '';
    this.#setQuery('');
    this.closeList(false);
  }

  #setQuery(q: string) {
    this.filterSlotted(q);
    this.query = q;
  }

  #commit(value: string, label: string) {
    const changed = value !== this.value;
    this.value = value;
    this.text = label;
    if (changed) this.fireChange(value);
  }

  protected pick(o: MmOption): void {
    this.remember(o);
    this.#commit(o.optionValue, o.optionLabel);
    this.#setQuery('');
    this.closeList(true);
  }

  /** Free text or a typed label: resolve to an option or keep as custom text. */
  #commitText() {
    const t = this.text.trim();
    if (!t) {
      this.#commit('', '');
      return;
    }
    const match = this.options.find((o) => o.optionLabel.toLowerCase() === t.toLowerCase() && !o.disabled);
    if (match) {
      this.remember(match);
      this.#commit(match.optionValue, match.optionLabel);
    } else if (this.allowCustom) this.#commit(t, t);
  }

  protected override onBlur(): void {
    this.closeList(false);
    this.#settle();
  }
  /** After leaving the field, the text either becomes the value or reverts to it. */
  #settle() {
    if (this.text === (this.value ? this.labelFor(this.value) : '')) return;
    this.#commitText();
    if (!this.allowCustom) this.text = this.value ? this.labelFor(this.value) : '';
    this.#setQuery('');
  }

  #onInput = (e: Event) => {
    this.text = (e.target as HTMLInputElement).value;
    this.#setQuery(this.text);
    this.setActive(null);
    emit(this, 'mm-input', { query: this.text });
    if (!this.open) void this.openList();
    if (this.loader) this.scheduleLoad(150);
  };

  #onKeydown = async (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) {
          await this.openList();
          if (!e.altKey) this.activateSelectedOrFirst();
        } else this.move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) {
          await this.openList();
          this.move('last');
        } else this.move(-1);
        break;
      case 'PageDown':
        if (this.open) {
          e.preventDefault();
          this.move(10);
        }
        break;
      case 'PageUp':
        if (this.open) {
          e.preventDefault();
          this.move(-10);
        }
        break;
      case 'Enter':
        if (this.open && this.activeOption) {
          e.preventDefault();
          this.pick(this.activeOption);
        } else if (this.loader && this.loadState === 'error') {
          e.preventDefault();
          this.retry();
        } else {
          if (this.open) e.preventDefault();
          this.#commitText();
          if (this.allowCustom || !this.text) this.closeList(false);
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          e.stopPropagation();
          this.closeList(false);
        } else if (this.text) {
          e.preventDefault();
          this.text = '';
          this.#setQuery('');
          this.#commit('', '');
        }
        break;
      case 'Tab':
        this.closeList(false);
        this.#settle();
        break;
    }
  };

  #clear = () => {
    this.text = '';
    this.#setQuery('');
    this.#commit('', '');
    this.focus();
    if (this.loader) this.scheduleLoad(0);
  };

  protected override renderEmpty(): unknown {
    const t = this.text.trim();
    if (this.allowCustom && t) return `${str('noResults')}. ${str('useCustom', { text: t })}`;
    return str('noResults');
  }

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.error;
    const data = this.value && this.text === this.labelFor(this.value) ? this.dataFor(this.value) : null;
    return html`<div class="field">
      <label class="label ${this.hideLabel ? 'visually-hidden' : ''}" id="label" for="input" part="label">${this.label}</label>
      <div
        class="box ${this.open ? 'open' : ''} ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''}"
        part="control"
        @click=${(e: Event) => {
          if (disabled) return;
          if ((e.composedPath()[0] as Element).closest?.('.clear')) return;
          this.focus();
          if (!this.open) void this.openList();
        }}
      >
        <span class="lead">
          ${data?.provider
            ? html`<mm-provider-logo provider=${data.provider} decorative></mm-provider-logo>`
            : html`<mm-icon name=${data?.icon || 'search'}></mm-icon>`}
        </span>
        <input
          id="input"
          class="input"
          part="input"
          data-anchor
          type="text"
          role="combobox"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-autocomplete="list"
          aria-controls="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-invalid=${invalid ? 'true' : nothing}
          aria-describedby=${ifDefined(describedBy(this.help, this.error))}
          placeholder=${this.placeholder}
          ?disabled=${disabled}
          ?required=${this.required}
          .value=${live(this.text)}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
        />
        ${this.text && !disabled
          ? html`<button class="clear" type="button" tabindex="-1" aria-label=${str('clear')} @click=${this.#clear}>
              <mm-icon name="close" size="14"></mm-icon>
            </button>`
          : nothing}
        <mm-icon class="chevron" name="unfold-more"></mm-icon>
      </div>
      ${helpAndError(this.help, this.error)} ${this.renderPopup()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-combobox': MmCombobox;
  }
}
