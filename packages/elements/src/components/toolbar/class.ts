import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { isRtl, rovingKeydown } from '../../core/roving.js';

/** Controls the toolbar treats as one stop each. Other elements are searched for these. */
const ITEM = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  'mm-button',
  'mm-menu-button',
  'mm-split-button',
  'mm-copy-button',
  'mm-segmented-control',
  'mm-select',
  'mm-combobox',
  'mm-multiselect',
  'mm-text-field',
  'mm-search-field',
  'mm-number-field',
  'mm-checkbox',
  'mm-switch',
  'mm-filter-pill',
  'mm-link',
  '[data-toolbar-item]',
].join(',');

/** Text entry keeps Left, Right, Home and End for the caret. */
const keepsKeys = (target: EventTarget | undefined): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(target.type);
  return target.isContentEditable;
};

/**
 * A vertical hairline between groups of toolbar controls. It is a `separator` oriented across the
 * toolbar.
 *
 * @tagname mm-toolbar-separator
 * @summary Separates groups of toolbar controls.
 */
export class MmToolbarSeparator extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        flex: none;
        align-self: center;
        width: 1px;
        height: var(--space-5);
        margin-inline: var(--space-1);
        background: var(--mm-rule);
      }
      :host([aria-orientation='horizontal']) {
        width: var(--space-5);
        height: 1px;
        margin-inline: 0;
        margin-block: var(--space-1);
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'separator');
    const bar = this.closest('mm-toolbar');
    this.setAttribute('aria-orientation', bar?.getAttribute('orientation') === 'vertical' ? 'horizontal' : 'vertical');
  }
}

/**
 * Toolbars group the controls that act on one surface, such as the query editor's source select,
 * "Read only" status, row limit and Run query. They are chrome, so they stay quieter than the content
 * they frame: no fill, no border, controls separated by `space-2` and hairline separators.
 *
 * Keyboard follows the WAI-ARIA toolbar pattern (https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/):
 * the toolbar is one tab stop; Left and Right (Up and Down when vertical) move between controls,
 * flipped in right-to-left, and Home and End go to the first and last. Focus returns to the last
 * control used. Controls that use arrow keys themselves keep them: text fields keep Left, Right, Home
 * and End for the caret, an `mm-select` opens on Home and End, and an `mm-segmented-control` moves
 * its own selection with arrows, so place a segmented control at either end of a toolbar where you
 * can. Disabled controls are skipped.
 *
 * Put controls in the default slot (start) and the `end` slot; the gap between them flexes.
 * `dense` sets 30px controls through `--mm-control`. `label` is required: it names the toolbar.
 *
 * @tagname mm-toolbar
 * @summary A row of controls that act on one surface.
 * @slot - Controls at the start.
 * @slot end - Controls at the end, such as the primary action.
 * @csspart start - The start group.
 * @csspart end - The end group.
 */
export class MmToolbar extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
        flex-wrap: wrap;
      }
      :host([dense]) {
        --mm-control: var(--control-h-sm);
      }
      :host([orientation='vertical']) {
        flex-direction: column;
        align-items: stretch;
        flex-wrap: nowrap;
      }
      .start,
      .end {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
        flex-wrap: wrap;
      }
      .start {
        flex: 1 1 auto;
      }
      .end {
        flex: 0 1 auto;
        margin-inline-start: auto;
      }
      :host([orientation='vertical']) .start,
      :host([orientation='vertical']) .end {
        flex-direction: column;
        align-items: stretch;
        margin-inline-start: 0;
      }
      :host([orientation='vertical']) .end {
        margin-block-start: auto;
      }
    `,
  ];

  /** Accessible name, such as "Query editor". Required. */
  @property() accessor label = '';
  /** `horizontal` (default) or `vertical`. */
  @property({ reflect: true }) accessor orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** 30px controls. */
  @property({ type: Boolean, reflect: true }) accessor dense = false;

  #current: HTMLElement | null = null;

  constructor() {
    super();
    this.addEventListener('keydown', (e) => this.#onKeydown(e));
    this.addEventListener('focusin', (e) => this.#onFocusIn(e));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'toolbar');
  }

  /** The controls the toolbar moves between, in order. */
  get items(): HTMLElement[] {
    const slots = [...this.renderRoot.querySelectorAll('slot')];
    const out: HTMLElement[] = [];
    const visit = (el: Element) => {
      if (!(el instanceof HTMLElement) || el.hidden || el.localName === 'mm-toolbar-separator') return;
      if (el.matches(ITEM)) out.push(el);
      else for (const child of el.children) visit(child);
    };
    for (const slot of slots) for (const el of slot.assignedElements({ flatten: true })) visit(el);
    return out;
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('label')) {
      if (this.label) this.setAttribute('aria-label', this.label);
      else this.removeAttribute('aria-label');
    }
    if (changed.has('orientation')) {
      this.setAttribute('aria-orientation', this.orientation);
      const across = this.orientation === 'vertical' ? 'horizontal' : 'vertical';
      this.querySelectorAll('mm-toolbar-separator').forEach((s) => s.setAttribute('aria-orientation', across));
    }
  }

  #isDisabled(el: HTMLElement) {
    return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
  }

  /** Makes exactly one control tabbable: the current one, or the first enabled one. */
  #resetStops = () => {
    const items = this.items;
    if (!items.length) return;
    let current = this.#current && items.includes(this.#current) && !this.#isDisabled(this.#current) ? this.#current : null;
    current ??= items.find((el) => !this.#isDisabled(el)) ?? items[0]!;
    this.#current = current;
    for (const el of items) el.tabIndex = el === current ? 0 : -1;
  };

  #itemFrom(e: Event): HTMLElement | null {
    const items = this.items;
    for (const node of e.composedPath()) {
      if (node === this) break;
      if (items.includes(node as HTMLElement)) return node as HTMLElement;
    }
    return null;
  }

  #onFocusIn(e: FocusEvent) {
    const item = this.#itemFrom(e);
    if (!item || item === this.#current) return;
    this.#current = item;
    this.#resetStops();
  }

  #onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const item = this.#itemFrom(e);
    if (!item) return;
    if (keepsKeys(e.composedPath()[0]) && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const items = this.items;
    const next = rovingKeydown(e, items, items.indexOf(item), {
      orientation: this.orientation,
      wrap: true,
      rtl: this.orientation === 'horizontal' && isRtl(this),
    });
    if (next !== null) this.#current = items[next]!;
  }

  override render() {
    return html`<div part="start" class="start"><slot @slotchange=${this.#resetStops}></slot></div>
      <div part="end" class="end"><slot name="end" @slotchange=${this.#resetStops}></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-toolbar': MmToolbar;
    'mm-toolbar-separator': MmToolbarSeparator;
  }
}
