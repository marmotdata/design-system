import { LitElement, css, html, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import '@marmotdata/icons/define.js';

/**
 * A disclosure shows and hides one region of secondary content behind a button: advanced plugin
 * settings, the raw JSON of a run, a long column description. The button carries a chevron that
 * turns when it opens (instantly under reduced motion) and states `aria-expanded`. Nothing is
 * boxed; inside `mm-accordion` disclosures are separated by hairlines.
 *
 * Set `heading-level` when the disclosure titles a section (always inside an accordion), so the
 * button sits in a real heading and the content becomes a labelled region.
 *
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 *
 * @tagname mm-disclosure
 * @summary A button that shows and hides a region.
 * @slot - The content shown when open.
 * @slot summary - The button text, if it needs markup. Otherwise use `summary`.
 * @csspart button - The native button.
 * @csspart chevron - The chevron icon.
 * @csspart content - The region.
 * @fires mm-toggle - {{ open: boolean }} The disclosure was opened or closed by the person.
 */
export class MmDisclosure extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .h {
        margin: 0;
        font: inherit;
      }
      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        inline-size: 100%;
        min-block-size: var(--mm-control, var(--control-h));
        padding-block: var(--space-2);
        font: var(--text-dense);
        font-weight: 600;
        color: var(--mm-text);
        cursor: pointer;
        border-radius: var(--radius-sm);
        overflow-wrap: anywhere;
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      button:hover .chev {
        color: var(--mm-text);
      }
      button[aria-disabled='true'] {
        cursor: not-allowed;
        color: var(--mm-text-3);
      }
      .label {
        flex: 1;
        min-width: 0;
      }
      .chev {
        flex: none;
        color: var(--mm-text-2);
        transform: rotate(-90deg);
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host([data-rtl]) .chev {
        transform: rotate(90deg);
      }
      :host([open]) .chev {
        transform: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .chev {
          transition: none;
        }
      }
      .content {
        padding-block: var(--space-1) var(--space-4);
        padding-inline-start: calc(16px + var(--space-2));
        font: var(--text-dense);
        color: var(--mm-text);
      }
      :host([flush]) .content {
        padding-inline-start: 0;
      }
    `,
  ];

  /** Whether the content is shown. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** The button text. */
  @property() accessor summary = '';
  /** Wraps the button in a heading of this level (1 to 6) and makes the content a labelled region. 0 for none. */
  @property({ type: Number, attribute: 'heading-level' }) accessor headingLevel = 0;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Aligns the content with the chevron rather than the label. */
  @property({ type: Boolean, reflect: true }) accessor flush = false;

  @query('button') accessor #button!: HTMLButtonElement;
  #id = uid('disclosure');

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined') this.toggleAttribute('data-rtl', getComputedStyle(this).direction === 'rtl');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && typeof window !== 'undefined' && this.isConnected) {
      this.toggleAttribute('data-rtl', getComputedStyle(this).direction === 'rtl');
    }
  }

  override focus(options?: FocusOptions): void {
    this.#button?.focus(options);
  }

  /** Opens or closes the disclosure and fires `mm-toggle`, as if the button were pressed. */
  toggle(force?: boolean): void {
    const next = force ?? !this.open;
    if (next === this.open) return;
    this.open = next;
    emit(this, 'mm-toggle', { open: next });
  }

  #onClick = () => {
    if (this.disabled) return;
    this.toggle();
  };

  override render() {
    const button = html`<button
      part="button"
      type="button"
      id="${this.#id}-button"
      data-disclosure-trigger
      aria-expanded=${this.open ? 'true' : 'false'}
      aria-controls="${this.#id}-content"
      aria-disabled=${this.disabled ? 'true' : 'false'}
      @click=${this.#onClick}
    >
      <mm-icon class="chev" part="chevron" name="expand-more" aria-hidden="true"></mm-icon>
      <span class="label"><slot name="summary">${this.summary}</slot></span>
    </button>`;
    const level = Math.round(this.headingLevel);
    let head;
    switch (level) {
      case 1:
        head = html`<h1 class="h">${button}</h1>`;
        break;
      case 2:
        head = html`<h2 class="h">${button}</h2>`;
        break;
      case 3:
        head = html`<h3 class="h">${button}</h3>`;
        break;
      case 4:
        head = html`<h4 class="h">${button}</h4>`;
        break;
      case 5:
        head = html`<h5 class="h">${button}</h5>`;
        break;
      case 6:
        head = html`<h6 class="h">${button}</h6>`;
        break;
      default:
        head = button;
    }
    const region = level >= 1 && level <= 6;
    return html`${head}
      <div
        class="content"
        part="content"
        id="${this.#id}-content"
        role=${region ? 'region' : 'group'}
        aria-labelledby="${this.#id}-button"
        ?hidden=${!this.open}
      >
        <slot></slot>
      </div>`;
  }
}

/**
 * An accordion stacks related disclosures under one another, separated by hairlines: the sections
 * of a plugin's configuration or the FAQs on a docs page. With `single`, opening one closes the
 * others. Give each disclosure a `heading-level` that fits the page outline; the accordion sets
 * level 3 on any that have none.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/): Tab moves through the headers and
 * any open content. Enter or Space toggles a header. Down and Up move to the next and previous
 * header, wrapping; Home and End move to the first and last.
 *
 * @tagname mm-accordion
 * @summary Grouped disclosures with header keyboard navigation.
 * @slot - `mm-disclosure` items.
 */
export class MmAccordion extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      ::slotted(mm-disclosure) {
        border-block-start: 1px solid var(--mm-rule);
      }
      ::slotted(mm-disclosure:last-child) {
        border-block-end: 1px solid var(--mm-rule);
      }
    `,
  ];

  /** Only one disclosure may be open at a time. */
  @property({ type: Boolean, reflect: true }) accessor single = false;

  get #items(): MmDisclosure[] {
    return Array.from(this.querySelectorAll<MmDisclosure>(':scope > mm-disclosure'));
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('mm-toggle', this.#onToggle as EventListener);
  }

  #onSlotChange = () => {
    for (const d of this.#items) if (!d.headingLevel) d.headingLevel = 3;
  };

  #onToggle = (e: CustomEvent<{ open: boolean }>) => {
    const src = e.target as MmDisclosure;
    if (!this.single || !e.detail.open || src.parentElement !== this) return;
    for (const d of this.#items) if (d !== src && d.open) d.toggle(false);
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const origin = e.composedPath()[0] as Element | undefined;
    if (!origin?.hasAttribute?.('data-disclosure-trigger')) return;
    const items = this.#items.filter((d) => !d.disabled);
    if (!items.length) return;
    const current = items.indexOf(e.target as MmDisclosure);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    e.preventDefault();
    items[next]!.focus();
  };

  override render() {
    return html`<slot @slotchange=${this.#onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-disclosure': MmDisclosure;
    'mm-accordion': MmAccordion;
  }
}
