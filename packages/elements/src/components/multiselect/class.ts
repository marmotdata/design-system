import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { isRtl } from '../../core/roving.js';
import { describedBy, fieldStyles, helpAndError, str } from '../select/field.js';
import { MmListboxControl, boxStyles, listboxStyles } from '../select/listbox-control.js';
import type { MmOption } from '../select/option.js';
import { comboInputStyles } from '../combobox/class.js';
import '@marmotdata/icons/define.js';

export { MmOption, MmOptionGroup, type MmOptionData } from '../select/option.js';
export type { MmOptionLoader } from '../select/listbox-control.js';

const listConverter = {
  fromAttribute: (v: string | null) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  toAttribute: (v: string[]) => v.join(','),
};

/**
 * Multiselects pick several values, such as tags (`pii`, `finance`, `certified`), owners or
 * providers for a filter. Chosen values sit inside the field as removable tags (sunken, radius-sm,
 * like `mm-tag`); after `max-tags` the rest collapse to “+3” until the field has focus. Each value
 * submits as its own FormData entry under the same name, like a native `<select multiple>`.
 * Options can come from slotted `mm-option` elements or an async `loader`.
 *
 * Keyboard follows the WAI-ARIA editable combobox pattern with a multi-selectable listbox: Down and
 * Up open and move, Enter toggles the highlighted option and keeps the list open, Escape closes and
 * then clears the text, Backspace in an empty field removes the last value. Left arrow from the
 * start of the field moves through the tags; Backspace or Delete removes the focused tag.
 *
 * @tagname mm-multiselect
 * @summary Pick several values, shown as removable tags.
 * @slot - `mm-option` and `mm-option-group` elements, when not using `loader`.
 * @csspart control - The field box.
 * @csspart tag - Each value tag.
 * @csspart input - The text input.
 * @csspart popup - The floating panel.
 * @csspart listbox - The listbox.
 * @fires mm-change - {{ value: string[] }} The values changed by user action.
 * @fires mm-input - {{ query: string }} The typed text changed.
 * @fires change - Native-style change event.
 */
export class MmMultiselect extends MmListboxControl {
  static override styles = [
    base,
    fieldStyles,
    boxStyles,
    listboxStyles,
    comboInputStyles,
    css`
      :host {
        display: inline-block;
        width: 360px;
        max-width: 100%;
        vertical-align: top;
      }
      .box {
        flex-wrap: wrap;
        gap: 4px;
        padding-block: 3px;
        padding-inline: 6px 10px;
      }
      .input {
        min-width: 80px;
        height: 28px;
        padding-inline-start: 4px;
      }
      .tag {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 22px;
        max-width: 100%;
        padding-inline: 7px 2px;
        border-radius: var(--radius-sm);
        background: var(--mm-sunken);
        color: var(--mm-text-2);
        font: var(--text-caption);
        line-height: 1;
        min-width: 0;
      }
      .tag-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--mm-text);
      }
      .tag mm-provider-logo,
      .tag mm-icon {
        flex: none;
        margin-inline-end: 2px;
      }
      .tag-x {
        all: unset;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: var(--radius-sm);
        color: var(--mm-text-2);
        cursor: pointer;
      }
      .tag-x::after {
        content: '';
        position: absolute;
        inset: -3px;
      }
      .tag-x:hover {
        color: var(--mm-text);
        background: var(--mm-rule);
      }
      .tag-x:focus-visible {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: 0;
      }
      .more {
        font: var(--text-caption);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text-2);
        padding-inline: 4px;
      }
      .box.disabled .tag-x {
        display: none;
      }
      .box.disabled .tag {
        background: var(--mm-surface);
        padding-inline-end: 7px;
      }
    `,
  ];

  /** The selected values. As an attribute, a comma-separated list. */
  @property({ converter: listConverter }) accessor value: string[] = [];
  /** Tags shown before the rest collapse to “+N” (all show while the field has focus). */
  @property({ type: Number, attribute: 'max-tags' }) accessor maxTags = 3;
  /** Visually hide the label (it is still announced). */
  @property({ type: Boolean, attribute: 'hide-label' }) accessor hideLabel = false;

  @state() private accessor text = '';
  @state() private accessor focused = false;
  @query('input') accessor #input!: HTMLInputElement | null;
  #initial: string[] | null = null;

  protected get comboboxEl() {
    return this.#input;
  }
  protected get anchorEl() {
    return this.renderRoot?.querySelector?.<HTMLElement>('.box') ?? null;
  }
  protected isSelected(v: string) {
    return this.value.includes(v);
  }
  protected override autoHighlight(): boolean {
    return false;
  }

  override focus(options?: FocusOptions) {
    this.#input?.focus(options);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this.#onFocusIn);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('focusin', this.#onFocusIn);
  }
  #onFocusIn = () => {
    this.focused = true;
  };
  protected override onBlur(): void {
    this.focused = false;
    this.closeList(false);
    this.text = '';
    this.#setQuery('');
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.#initial === null) this.#initial = [...this.value];
    if (changed.has('value') || changed.has('name')) {
      const fd = new FormData();
      for (const v of this.value) fd.append(this.name || 'value', v);
      this.setFormValue(this.value.length ? fd : null);
    }
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('required')) {
      if (this.required && !this.value.length) this.setValidity({ valueMissing: true }, str('chooseOption'));
      else this.setValidity({});
    }
  }

  formResetCallback(): void {
    this.value = [...(this.#initial ?? [])];
    this.text = '';
    this.#setQuery('');
    this.closeList(false);
  }

  #setQuery(q: string) {
    this.filterSlotted(q);
    this.query = q;
  }

  #setValue(next: string[]) {
    this.value = next;
    this.fireChange([...next]);
  }

  protected pick(o: MmOption): void {
    this.remember(o);
    const v = o.optionValue;
    this.#setValue(this.value.includes(v) ? this.value.filter((x) => x !== v) : [...this.value, v]);
    if (this.text) {
      this.text = '';
      this.#setQuery('');
      if (this.loader) this.scheduleLoad(0);
    }
    this.focus();
  }

  #remove(v: string, focusAfter?: 'prev' | 'input') {
    const i = this.value.indexOf(v);
    this.#setValue(this.value.filter((x) => x !== v));
    void this.updateComplete.then(() => {
      const btns = this.#tagButtons();
      if (focusAfter === 'prev' && btns.length) btns[Math.max(0, i - 1)]!.focus();
      else this.focus();
    });
  }

  #tagButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.tag-x')];
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
    const input = e.target as HTMLInputElement;
    const back = isRtl(this) ? 'ArrowRight' : 'ArrowLeft';
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
        } else if (this.open) e.preventDefault();
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
        }
        break;
      case 'Backspace':
        if (!input.value && this.value.length) {
          e.preventDefault();
          this.#setValue(this.value.slice(0, -1));
        }
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (e.key === back && input.selectionStart === 0 && input.selectionEnd === 0 && this.value.length) {
          e.preventDefault();
          this.closeList(false);
          await this.updateComplete;
          this.#tagButtons().at(-1)?.focus();
        }
        break;
      case 'Tab':
        this.closeList(false);
        break;
    }
  };

  #onTagKeydown = (e: KeyboardEvent, v: string) => {
    const btns = this.#tagButtons();
    const i = btns.indexOf(e.target as HTMLButtonElement);
    const rtl = isRtl(this);
    const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
    const next = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === prev) {
      e.preventDefault();
      btns[Math.max(0, i - 1)]?.focus();
    } else if (e.key === next) {
      e.preventDefault();
      if (i < btns.length - 1) btns[i + 1]!.focus();
      else this.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      btns[0]?.focus();
    } else if (e.key === 'End' || e.key === 'Escape') {
      e.preventDefault();
      this.focus();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      this.#remove(v, e.key === 'Backspace' ? 'prev' : 'input');
    }
  };

  override render() {
    const disabled = this.isDisabled;
    const invalid = !!this.error;
    const showAll = this.focused || this.value.length <= this.maxTags + 1;
    const shown = showAll ? this.value : this.value.slice(0, this.maxTags);
    const hidden = this.value.length - shown.length;
    return html`<div class="field">
      <label class="label ${this.hideLabel ? 'visually-hidden' : ''}" id="label" for="input" part="label">${this.label}</label>
      <div
        class="box ${this.open ? 'open' : ''} ${invalid ? 'invalid' : ''} ${disabled ? 'disabled' : ''}"
        part="control"
        @click=${(e: Event) => {
          if (disabled) return;
          if ((e.composedPath()[0] as Element).closest?.('.tag-x')) return;
          this.focus();
          if (!this.open) void this.openList();
        }}
      >
        ${shown.map((v) => {
          const d = this.dataFor(v);
          const label = d.label ?? v;
          return html`<span class="tag" part="tag">
            ${d.provider
              ? html`<mm-provider-logo provider=${d.provider} size="14" decorative></mm-provider-logo>`
              : d.icon
                ? html`<mm-icon name=${d.icon} size="14"></mm-icon>`
                : nothing}
            <span class="tag-label">${label}</span>
            <button
              class="tag-x"
              type="button"
              tabindex="-1"
              aria-label=${str('removeValue', { label })}
              ?disabled=${disabled}
              @click=${() => this.#remove(v, 'input')}
              @keydown=${(e: KeyboardEvent) => this.#onTagKeydown(e, v)}
            >
              <mm-icon name="close" size="14"></mm-icon>
            </button>
          </span>`;
        })}
        ${hidden > 0
          ? html`<span class="more"><span aria-hidden="true">+${hidden}</span><span class="visually-hidden">${str('moreSelected', { n: hidden })}</span></span>`
          : nothing}
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
          placeholder=${this.value.length ? '' : this.placeholder}
          ?disabled=${disabled}
          .value=${live(this.text)}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
        />
        <mm-icon class="chevron" name="unfold-more"></mm-icon>
      </div>
      ${helpAndError(this.help, this.error)} ${this.renderPopup(true)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-multiselect': MmMultiselect;
  }
}
