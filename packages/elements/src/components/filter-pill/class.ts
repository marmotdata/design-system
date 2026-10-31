import { LitElement, css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { formatCount } from '../../core/format.js';
import { str } from '../select/field.js';
import '@marmotdata/icons/define.js';

/**
 * Filter pills toggle facets in Discover and list views, such as a provider or a tag. They are round,
 * `mm-surface` with an `mm-rule` border that darkens on hover; a pressed pill is inverted ink. The
 * optional count sits in the text face with tabular figures. With `removable`, the pill shows an applied filter
 * (“Provider: Snowflake”) with a remove button, for active-filter rows above results; move focus to
 * the next pill or the search field when you remove it.
 *
 * Keyboard follows the WAI-ARIA toggle button pattern (https://www.w3.org/WAI/ARIA/apg/patterns/button/):
 * Enter and Space toggle.
 *
 * @tagname mm-filter-pill
 * @summary Toggle a facet filter, or show an applied one.
 * @slot - The label.
 * @slot start - A leading `<mm-provider-logo>` or `<mm-icon>`.
 * @csspart pill - The pill (the toggle button, or the wrapper when removable).
 * @csspart count - The count.
 * @csspart remove - The remove button.
 * @fires mm-change - {{ pressed: boolean }} The pill was toggled.
 * @fires mm-remove - {{}} The remove button of a removable pill was activated.
 */
export class MmFilterPill extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        max-width: 100%;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        height: 28px;
        padding: 0 12px;
        border-radius: var(--radius-full);
        border: 1px solid var(--mm-rule);
        background: var(--mm-surface);
        color: var(--mm-text);
        font: var(--text-label);
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        /* Only the hover border eases. Toggling is a state change, often from the keyboard, so it is instant (guidelines: motion drops for keyboard actions). */
        transition: border-color var(--mm-dur-press) var(--mm-ease);
      }
      button.pill:hover,
      .removable:hover {
        border-color: var(--mm-control-border);
      }
      .pill[aria-pressed='true'] {
        background: var(--mm-text);
        color: var(--mm-on-inverse);
        border-color: var(--mm-text);
      }
      .pill[aria-disabled='true'] {
        cursor: not-allowed;
        color: var(--mm-text-3);
        border-color: var(--mm-rule);
      }
      .pill[aria-pressed='true'][aria-disabled='true'] {
        background: var(--mm-text-2);
        border-color: var(--mm-text-2);
        color: var(--mm-on-inverse);
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .facet {
        color: var(--mm-text-2);
        font-weight: 400;
      }
      .n {
        font: var(--text-caption);
        line-height: 1;
        font-variant-numeric: tabular-nums;
        color: var(--mm-text-2);
      }
      .pill[aria-pressed='true'] .n {
        color: inherit;
      }
      .removable {
        cursor: default;
        padding-inline-end: 4px;
      }
      .x {
        all: unset;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 20px;
        height: 20px;
        border-radius: var(--radius-full);
        color: var(--mm-text-2);
        cursor: pointer;
      }
      .x::after {
        content: '';
        position: absolute;
        inset: -2px;
      }
      .x:hover {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
      .x:focus-visible {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: 1px;
      }
      ::slotted([slot='start']) {
        flex: none;
      }
    `,
  ];

  /** Whether the facet is applied (toggle mode). */
  @property({ type: Boolean, reflect: true }) accessor pressed = false;
  /** Number of matching results, shown with tabular figures. */
  @property({ type: Number }) accessor count: number | undefined;
  /** Facet name shown before the value in a removable pill, such as “Provider”. */
  @property() accessor facet = '';
  /** Shows an applied filter with a remove button instead of a toggle. */
  @property({ type: Boolean, reflect: true }) accessor removable = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;

  @query('button') accessor #button!: HTMLButtonElement | null;

  override focus(options?: FocusOptions) {
    this.#button?.focus(options);
  }

  #toggle = () => {
    if (this.disabled) return;
    this.pressed = !this.pressed;
    emit(this, 'mm-change', { pressed: this.pressed });
  };
  #remove = () => {
    if (this.disabled) return;
    emit(this, 'mm-remove', {});
  };

  #text(): string {
    const value = (this.textContent ?? '').replace(/\s+/g, ' ').trim();
    return this.facet ? `${this.facet}: ${value}` : value;
  }

  override render() {
    const count =
      this.count === undefined || this.count === null || Number.isNaN(this.count)
        ? nothing
        : html`<span class="n" part="count">${formatCount(this.count)}</span>`;
    const label = html`<slot name="start"></slot
      ><span class="label">${this.facet ? html`<span class="facet">${this.facet}: </span>` : nothing}<slot></slot></span>`;
    if (this.removable) {
      return html`<span class="pill removable" part="pill">
        ${label}${count}
        <button
          class="x"
          part="remove"
          type="button"
          aria-label=${str('removeValue', { label: this.#text() })}
          aria-disabled=${this.disabled ? 'true' : 'false'}
          @click=${this.#remove}
        >
          <mm-icon name="close" size="14"></mm-icon>
        </button>
      </span>`;
    }
    return html`<button
      class="pill"
      part="pill"
      type="button"
      aria-pressed=${this.pressed ? 'true' : 'false'}
      aria-disabled=${this.disabled ? 'true' : 'false'}
      @click=${this.#toggle}
    >
      ${label}${count}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-filter-pill': MmFilterPill;
  }
}
