import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { describedBy, fieldStyles, helpAndError, str } from './field.js';
import { MmListboxControl, boxStyles, listboxStyles } from './listbox-control.js';
import type { MmOption } from './option.js';
import '@marmotdata/icons/define.js';

export { MmOption, MmOptionGroup, type MmOptionData } from './option.js';
export type { MmOptionLoader } from './listbox-control.js';

/**
 * Selects pick one value from a known, short list: a provider, an owner team, a sort order. The
 * field is a select-only combobox (a 36px surface box with the control border) that opens a raised
 * listbox; the selected option is drawn in `mm-selected` with a check. Use `mm-combobox` when
 * people need to type to find the value, and `mm-segmented-control` for two to four modes.
 *
 * Keyboard follows the WAI-ARIA select-only combobox pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/): Enter, Space,
 * Down and Up open the list; arrows, Home, End, Page Up and Page Down move; typing jumps to a
 * matching option; Enter or Space selects; Escape closes; Tab selects and moves on.
 *
 * @tagname mm-select
 * @summary Pick one value from a short list.
 * @slot - `mm-option` and `mm-option-group` elements.
 * @csspart control - The combobox box.
 * @csspart popup - The floating panel.
 * @csspart listbox - The listbox.
 * @csspart help - The help line.
 * @csspart error - The error line.
 * @fires mm-change - {{ value: string }} The selected value changed by user action.
 * @fires mm-input - {{ value: string }} Fired with mm-change, for parity with text inputs.
 * @fires change - Native-style change event, for `bind:value`-style code.
 */
export class MmSelect extends MmListboxControl {
  static override styles = [
    base,
    fieldStyles,
    boxStyles,
    listboxStyles,
    css`
      :host {
        display: inline-block;
        width: 240px;
        max-width: 100%;
        vertical-align: top;
      }
      .box {
        cursor: pointer;
        user-select: none;
      }
      .value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lead {
        display: inline-flex;
        color: var(--mm-text-2);
        flex: none;
      }
    `,
  ];

  /** The selected value. */
  @property() accessor value = '';
  /** Visually hide the label (it is still announced). */
  @property({ type: Boolean, attribute: 'hide-label' }) accessor hideLabel = false;

  @query('[role="combobox"]') accessor #trigger!: HTMLElement | null;
  #initial: string | null = null;
  #typed = '';
  #typedAt = 0;

  protected get comboboxEl() {
    return this.#trigger;
  }
  protected get anchorEl() {
    return this.#trigger;
  }
  protected isSelected(v: string) {
    return v === this.value;
  }

  override focus(options?: FocusOptions) {
    this.#trigger?.focus(options);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.#initial === null) this.#initial = this.value;
    if (changed.has('value')) this.setFormValue(this.value || null);
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('required')) {
      if (this.required && !this.value) this.setValidity({ valueMissing: true }, str('chooseOption'));
      else this.setValidity({});
    }
  }

  formResetCallback(): void {
    this.value = this.#initial ?? '';
    this.closeList(false);
  }

  protected pick(o: MmOption): void {
    this.#typedAt = 0;
    const changed = o.optionValue !== this.value;
    this.value = o.optionValue;
    this.closeList(true);
    if (changed) this.#fire();
  }
  #fire() {
    emit(this, 'mm-input', { value: this.value });
    this.fireChange(this.value);
  }

  #typeahead(ch: string) {
    const now = performance.now();
    this.#typed = now - this.#typedAt > 500 ? ch : this.#typed + ch;
    this.#typedAt = now;
    const list = this.navigable;
    const buf = this.#typed.toLowerCase();
    const same = [...buf].every((c) => c === buf[0]);
    const start = this.activeOption ? list.indexOf(this.activeOption) : -1;
    const ordered = [...list.slice(start + 1), ...list.slice(0, start + 1)];
    const match =
      ordered.find((o) => o.optionLabel.toLowerCase().startsWith(buf)) ??
      (same ? ordered.find((o) => o.optionLabel.toLowerCase().startsWith(buf[0]!)) : undefined);
    if (match) this.setActive(match);
  }

  #onKeydown = async (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    const k = e.key;
    if (!this.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(k)) {
        e.preventDefault();
        this.#typedAt = 0;
        await this.openList();
        if (k === 'Home') this.move('first');
        else if (k === 'End') this.move('last');
        else this.activateSelectedOrFirst();
        return;
      }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        await this.openList();
        this.activateSelectedOrFirst();
        this.#typedAt = 0;
        this.#typeahead(k);
      }
      return;
    }
    switch (k) {
      case 'ArrowDown':
        e.preventDefault();
        this.move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) {
          if (this.activeOption) this.pick(this.activeOption);
          else this.closeList();
        } else this.move(-1);
        break;
      case 'Home':
        e.preventDefault();
        this.move('first');
        break;
      case 'End':
        e.preventDefault();
        this.move('last');
        break;
      case 'PageDown':
        e.preventDefault();
        this.move(10);
        break;
      case 'PageUp':
        e.preventDefault();
        this.move(-10);
        break;
      case 'Enter':
        e.preventDefault();
        if (this.activeOption) this.pick(this.activeOption);
        else this.closeList();
        break;
      case ' ':
        e.preventDefault();
        if (performance.now() - this.#typedAt < 500) this.#typeahead(' ');
        else if (this.activeOption) this.pick(this.activeOption);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.closeList();
        break;
      case 'Tab':
        if (this.activeOption && !this.activeOption.selected) {
          const o = this.activeOption;
          this.value = o.optionValue;
          this.#fire();
        }
        this.closeList(false);
        break;
      default:
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          this.#typeahead(k);
        }
    }
  };

  #onClick = () => {
    if (this.isDisabled) return;
    if (this.open) this.closeList();
    else void this.openList().then(() => this.activateSelectedOrFirst());
  };

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.error;
    const data = this.value ? this.dataFor(this.value) : null;
    return html`<div class="field">
      <span class="label ${this.hideLabel ? 'visually-hidden' : ''}" id="label" part="label" @click=${() => this.focus()}
        >${this.label}</span
      >
      <div
        class="box ${this.open ? 'open' : ''} ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''}"
        part="control"
        role="combobox"
        data-anchor
        tabindex=${disabled ? '-1' : '0'}
        aria-labelledby="label"
        aria-controls="listbox"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-disabled=${disabled ? 'true' : nothing}
        aria-required=${this.required ? 'true' : nothing}
        aria-invalid=${invalid ? 'true' : nothing}
        aria-describedby=${ifDefined(describedBy(this.help, this.error))}
        @click=${this.#onClick}
        @keydown=${this.#onKeydown}
      >
        ${data?.provider
          ? html`<span class="lead"><mm-provider-logo provider=${data.provider} decorative></mm-provider-logo></span>`
          : data?.icon
            ? html`<span class="lead"><mm-icon name=${data.icon}></mm-icon></span>`
            : nothing}
        <span class="value ${data ? '' : 'placeholder'}">${data ? data.label : this.placeholder || str('selectPlaceholder')}</span>
        <mm-icon class="chevron" name="unfold-more"></mm-icon>
      </div>
      ${helpAndError(this.help, this.error)} ${this.renderPopup()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-select': MmSelect;
  }
}
