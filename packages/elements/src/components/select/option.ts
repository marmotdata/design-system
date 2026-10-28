import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import '@marmotdata/icons/define.js';

/** Data shape for options supplied by a `loader` or the `options` property. */
export interface MmOptionData {
  value: string;
  label: string;
  /** Second line under the label, such as an MRN or a short explanation. */
  description?: string;
  /** Set the description in mono, for machine strings such as MRNs. */
  mono?: boolean;
  /** Trailing metadata, such as the asset type (`Table`, `Topic`), as a quiet caption. */
  meta?: string;
  /** Material Symbols icon name. */
  icon?: string;
  /** Provider key for `<mm-provider-logo>`, e.g. `snowflake`. */
  provider?: string;
  disabled?: boolean;
}

/**
 * One choice inside `mm-select`, `mm-combobox` or `mm-multiselect`. The text content is the label.
 * Options can carry a leading icon, a provider logo in the `logo` slot, a description line (mono
 * only with `mono`, for an MRN people compare) and trailing metadata such as the kind ("Table") in
 * a quiet caption. The selected option is drawn in `mm-selected` with a check; the
 * keyboard-highlighted option in `mm-sunken`.
 *
 * @tagname mm-option
 * @summary A choice in a listbox.
 * @slot - The label.
 * @slot logo - A leading `<mm-provider-logo>`.
 * @slot description - Rich description, if the `description` attribute is not enough.
 * @csspart row - The option row.
 * @csspart check - The selected check.
 * @csspart description - The description line.
 */
export class MmOption extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        cursor: pointer;
        user-select: none;
        border-radius: var(--radius-sm);
        color: var(--mm-text);
      }
      :host([hidden]) {
        display: none !important;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: var(--mm-menu-row);
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        font: var(--text-dense);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host(:hover) .row,
      :host([active]) .row {
        background: var(--mm-sunken);
      }
      :host([selected]) .row {
        background: var(--mm-selected);
        color: var(--mm-text);
      }
      :host([selected][active]) .row {
        box-shadow: inset 0 0 0 1px var(--mm-text-2);
      }
      :host([disabled]) {
        cursor: not-allowed;
      }
      :host([disabled]) .row {
        color: var(--mm-text-3);
        background: transparent;
      }
      .lead {
        display: inline-flex;
        align-items: center;
        flex: none;
        color: var(--mm-text-2);
      }
      .lead:not(:has(*)) {
        display: none;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      mark {
        background: transparent;
        color: inherit;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .desc {
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .desc.mono {
        font: var(--text-mono-dense);
      }
      .meta {
        flex: none;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .check {
        flex: none;
        width: 16px;
        height: 16px;
        color: var(--mm-text);
      }
      ::slotted([slot='logo']) {
        flex: none;
      }
    `,
  ];

  /** Value submitted with the form. Defaults to the label text. */
  @property({ reflect: true }) accessor value = '';
  /** Text shown in the field when selected, if different from the content. */
  @property() accessor label = '';
  /** Second line under the label. */
  @property() accessor description = '';
  /** Set the description in mono (for MRNs and other machine strings). */
  @property({ type: Boolean }) accessor mono = false;
  /** Trailing metadata, such as the asset type, as a quiet caption. */
  @property() accessor meta = '';
  /** Leading Material Symbols icon. */
  @property() accessor icon = '';
  /** Leading provider logo key, if you are not slotting `<mm-provider-logo slot="logo">`. */
  @property() accessor provider = '';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Set by the parent control. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;
  /** Keyboard highlight, set by the parent control. */
  @property({ type: Boolean, reflect: true }) accessor active = false;
  /** Substring to emphasise in the label (set by comboboxes while filtering). */
  @property({ attribute: false }) accessor highlight = '';

  /** The value, falling back to the label text. */
  get optionValue(): string {
    return this.value || this.optionLabel;
  }
  /** The display label. */
  get optionLabel(): string {
    return this.label || (this.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  /** Provider key from the attribute or a slotted logo. */
  get providerKey(): string {
    return this.provider || (this.querySelector('mm-provider-logo')?.getAttribute('provider') ?? '');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'option');
    this.syncAria();
  }
  protected override updated(): void {
    this.syncAria();
  }
  private syncAria() {
    this.setAttribute('aria-selected', String(this.selected));
    if (this.disabled) this.setAttribute('aria-disabled', 'true');
    else this.removeAttribute('aria-disabled');
  }

  #label() {
    const text = this.optionLabel;
    const q = this.highlight.trim();
    const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
    if (i < 0) return html`<slot></slot>`;
    return html`<slot hidden></slot>${text.slice(0, i)}<mark>${text.slice(i, i + q.length)}</mark>${text.slice(i + q.length)}`;
  }

  override render() {
    return html`<div class="row" part="row">
      <span class="lead"
        ><slot name="logo"></slot>${this.provider
          ? html`<mm-provider-logo provider=${this.provider} decorative></mm-provider-logo>`
          : nothing}${this.icon ? html`<mm-icon name=${this.icon}></mm-icon>` : nothing}</span
      >
      <span class="text">
        <span class="label">${this.#label()}</span>
        ${this.description
          ? html`<span class="desc ${this.mono ? 'mono' : ''}" part="description">${this.description}</span>`
          : html`<slot name="description" class="desc"></slot>`}
      </span>
      ${this.meta ? html`<span class="meta">${this.meta}</span>` : nothing}
      ${this.selected ? html`<mm-icon class="check" part="check" name="check"></mm-icon>` : html`<span class="check"></span>`}
    </div>`;
  }
}

/**
 * Groups options under a heading inside a select, combobox or multiselect.
 *
 * @tagname mm-option-group
 * @summary A labelled group of options.
 * @slot - `mm-option` elements.
 */
export class MmOptionGroup extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      :host(:not(:first-child)) {
        border-top: 1px solid var(--mm-rule);
        margin-top: 4px;
        padding-top: 4px;
      }
      .heading {
        padding: 6px 10px 2px;
        font: var(--text-label);
        color: var(--mm-text-2);
      }
    `,
  ];
  /** The group heading. */
  @property({ reflect: true }) accessor label = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'group');
  }
  protected override updated(): void {
    this.setAttribute('aria-label', this.label);
  }
  override render() {
    return html`<div class="heading" aria-hidden="true">${this.label}</div><slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-option': MmOption;
    'mm-option-group': MmOptionGroup;
  }
}
