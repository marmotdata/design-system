import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';

/**
 * A list of records separated by hairlines: the body of a Needs attention or Pipelines panel, a
 * run history, the members of a team. Rows are `--mm-row` tall (40px, 36px in compact density or
 * with `dense`) and grow for a secondary line. Use a table when people need to compare columns.
 *
 * When items are interactive (`href` or `interactive`), the list is one tab stop. Up and Down move
 * between interactive items, Home and End jump to the first and last, and Tab leaves the list.
 * Nothing is selected by moving: Enter follows the link or activates the item. This is listbox-like
 * navigation without selection, so the items stay links and buttons to assistive technology.
 *
 * @tagname mm-list
 * @summary Hairline-separated rows with keyboard navigation between interactive items.
 * @slot - `mm-list-item` elements.
 * @cssprop --mm-list-inset - Inline padding of rows. Defaults to `space-4`, to line up with a panel head.
 * @cssprop --mm-list-lead-size - Smallest inline size of every item's `start` slot, so leads of different widths (status pills) still start the text at one x. Defaults to `auto`.
 */
export class MmList extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      :host([dense]) {
        --mm-list-row: var(--row-compact);
      }
      ::slotted(mm-list-item:not(:first-child)) {
        border-block-start: 1px solid var(--mm-rule);
      }
    `,
  ];

  /** 36px rows regardless of density. */
  @property({ type: Boolean, reflect: true }) accessor dense = false;

  get #items(): MmListItem[] {
    return Array.from(this.querySelectorAll<MmListItem>(':scope > mm-list-item'));
  }

  get #navigable(): MmListItem[] {
    return this.#items.filter((i) => i.isInteractive && !i.disabled);
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('focusin', this.#onFocusIn);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'list');
  }

  /** Keeps exactly one interactive item in the tab order: the selected one, else the first. */
  #syncTabStops = (current?: MmListItem) => {
    const nav = this.#navigable;
    const stop = current && nav.includes(current) ? current : (nav.find((i) => i.selected) ?? nav[0]);
    for (const item of this.#items) item.tabStop = item === stop;
  };

  #onFocusIn = (e: FocusEvent) => {
    const item = e.target as MmListItem;
    if (item.parentElement === this && item.isInteractive) this.#syncTabStops(item);
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const origin = e.composedPath()[0] as Element | undefined;
    if (!origin?.hasAttribute?.('data-list-main')) return;
    const nav = this.#navigable;
    const current = nav.indexOf(e.target as MmListItem);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowDown') next = Math.min(nav.length - 1, current + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, current - 1);
    else if (e.key === 'Home') next = 0;
    else next = nav.length - 1;
    e.preventDefault();
    const target = nav[next]!;
    this.#syncTabStops(target);
    target.focus();
  };

  override render() {
    return html`<slot @slotchange=${() => this.#syncTabStops()}></slot>`;
  }
}

/**
 * One row of an `mm-list`: an optional `start` element (an icon, provider logo or avatar), the main
 * text, an optional secondary line in `mm-text-2` and an `end` slot for a status pill, a time
 * (text face, tabular figures) or a row action. With `href` the main text is an ink link, underlined
 * on hover and focus; with `interactive` it is a button that
 * fires `mm-activate`. Either way the whole row is the target, it turns `mm-sunken` on hover and
 * draws the ink focus ring around the row. Controls in the `end` slot stay separately clickable.
 *
 * `selected` marks the current item with `mm-selected` and `aria-current`.
 *
 * @tagname mm-list-item
 * @summary A row with leading media, text, secondary line and trailing content.
 * @slot - The main text.
 * @slot start - An icon, provider logo, avatar or status pill. Its smallest width follows `--mm-list-lead-size` (set on the `mm-list`), so the text lines up when leads differ in width.
 * @slot secondary - A secondary line, if it needs markup. Otherwise use `secondary`.
 * @slot end - A status pill (only when something needs attention), a time (`mm-text` with `numeric`) or actions.
 * @csspart row - The row.
 * @csspart main - The link, button or text wrapper.
 * @csspart secondary - The secondary line.
 * @fires mm-activate - {{}} An `interactive` item without `href` was activated by click, Enter or Space.
 */
export class MmListItem extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
        position: relative;
      }
      .row {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-block-size: var(--mm-list-row, var(--mm-row, var(--row-default)));
        padding-block: var(--space-2);
        padding-inline: var(--mm-list-inset, var(--space-4));
        font: var(--text-dense);
        color: var(--mm-text);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host([data-interactive]:not([disabled])) .row:hover {
        background: var(--mm-sunken);
      }
      /* Tertiary text inside a selected item switches to ink-2 for contrast on the tint (Peat). */
      :host([selected]) {
        --mm-text-3: var(--mm-text-2);
      }
      :host([selected]) .row,
      :host([selected]) .row:hover {
        background: var(--mm-selected);
      }
      .row:has(.main:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        z-index: 1;
      }
      .start {
        display: inline-flex;
        align-items: center;
        flex: none;
        min-inline-size: var(--mm-list-lead-size, auto);
        color: var(--mm-text-3);
      }
      :host([selected]) .start {
        color: var(--mm-text-2);
      }
      .text {
        flex: 1;
        min-width: 0;
        display: grid;
      }
      .main {
        all: unset;
        min-width: 0;
        overflow-wrap: anywhere;
        color: inherit;
        text-align: start;
        cursor: pointer;
      }
      span.main {
        cursor: auto;
      }
      /* Stretch the link or button over the whole row; end-slot controls sit above it. */
      a.main::after,
      button.main::after {
        content: '';
        position: absolute;
        inset: 0;
      }
      .main:focus-visible {
        outline: none;
      }
      a.main:hover,
      a.main:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .secondary {
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .end {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        flex: none;
        color: var(--mm-text-3);
        font-variant-numeric: tabular-nums;
      }
      :host([selected]) .end {
        color: var(--mm-text-2);
      }
      /* Disabled rows go quieter in ink-3 rather than fading, so they stay legible (5.2:1). */
      :host([disabled]) .row,
      :host([disabled]) .secondary {
        color: var(--mm-text-3);
      }
      :host([disabled]) .main {
        cursor: not-allowed;
      }
      [hidden] {
        display: none !important;
      }
    `,
  ];

  /** Makes the main text a link to this URL. */
  @property({ reflect: true }) accessor href = '';
  @property() accessor target = '';
  /** Makes the row a button that fires `mm-activate`. */
  @property({ type: Boolean, reflect: true }) accessor interactive = false;
  /** Marks the current item: `mm-selected` and `aria-current`. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** The secondary line. */
  @property() accessor secondary = '';
  /** Whether this item is the list's single tab stop. Managed by `mm-list`. */
  @property({ type: Boolean, attribute: false }) accessor tabStop = true;

  @state() accessor #slotted = new Set<string>();
  @query('.main') accessor #main!: HTMLElement | null;

  get isInteractive(): boolean {
    return !!this.href || this.interactive;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  protected override willUpdate(): void {
    this.toggleAttribute('data-interactive', this.isInteractive);
  }

  override focus(options?: FocusOptions): void {
    this.#main?.focus(options);
  }

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const next = new Set(this.#slotted);
    if (slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim())) next.add(slot.name);
    else next.delete(slot.name);
    this.#slotted = next;
  };

  #onActivate = (e: Event) => {
    if (this.disabled) {
      e.preventDefault();
      return;
    }
    emit(this, 'mm-activate', {});
  };

  override render() {
    const label = html`<slot></slot>`;
    const tabindex = this.tabStop ? 0 : -1;
    const current = this.selected ? 'true' : undefined;
    let main;
    if (this.href && !this.disabled) {
      main = html`<a
        class="main"
        part="main"
        data-list-main
        href=${this.href}
        target=${ifDefined(this.target || undefined)}
        rel=${ifDefined(this.target === '_blank' ? 'noopener noreferrer' : undefined)}
        tabindex=${tabindex}
        aria-current=${ifDefined(current)}
        >${label}</a
      >`;
    } else if (this.isInteractive) {
      main = html`<button
        class="main"
        part="main"
        type="button"
        data-list-main
        tabindex=${tabindex}
        aria-disabled=${this.disabled ? 'true' : 'false'}
        aria-current=${ifDefined(current)}
        @click=${this.#onActivate}
      >
        ${label}
      </button>`;
    } else {
      main = html`<span class="main" part="main">${label}</span>`;
    }
    const hasSecondary = !!this.secondary || this.#slotted.has('secondary');
    return html`<div class="row" part="row">
      <span class="start" ?hidden=${!this.#slotted.has('start')}><slot name="start" @slotchange=${this.#onSlot}></slot></span>
      <span class="text">
        ${main}
        <span class="secondary" part="secondary" ?hidden=${!hasSecondary}
          ><slot name="secondary" @slotchange=${this.#onSlot}>${this.secondary || nothing}</slot></span
        >
      </span>
      <span class="end" ?hidden=${!this.#slotted.has('end')}><slot name="end" @slotchange=${this.#onSlot}></slot></span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-list': MmList;
    'mm-list-item': MmListItem;
  }
}
