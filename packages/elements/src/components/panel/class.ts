import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../text/define.js';
import '../count/define.js';
import '../skeleton/define.js';

let warnedNested = false;

/** True when `el` sits inside another `mm-panel`, through slots and shadow roots. */
function insidePanel(el: Element): boolean {
  let node: Node | null = el.parentNode;
  while (node) {
    if (node instanceof Element && node.localName === 'mm-panel') return true;
    node = node instanceof ShadowRoot ? node.host : node.parentNode;
  }
  return false;
}

/**
 * Panels group one subject on a page, such as Needs attention, Pipelines or Activity on Home. A
 * panel is `mm-surface` with a 1px `mm-rule` border and `radius-md`, and no shadow: the step from
 * paper to surface is enough. The head has an optional 16px `mm-text-3` icon, a 13px/650 title in a
 * real heading (text face, never display), an optional count and one right-aligned "View all" link
 * in ink, underlined on hover and focus.
 *
 * The body is usually an `mm-list` or a table, edge to edge (`padding="none"`, the default). Use
 * `padding="default"` for prose or a form. Never put cards or other panels inside a panel: separate
 * its parts with hairlines or spacing. Nesting one panel in another warns in the console.
 *
 * `loading` shows skeleton lines (after 200ms, for at least 400ms) and marks the body busy. `empty`
 * swaps the body for the `empty` slot, usually a compact `mm-empty-state`.
 *
 * @tagname mm-panel
 * @summary A bordered surface for one subject, with a head and a body.
 * @slot - The body: an `mm-list`, a table or content.
 * @slot heading - The title, if it needs markup. Otherwise use `heading`.
 * @slot link - One link at the end of the head, if `link-href` is not enough.
 * @slot actions - Small buttons in the head, before the link.
 * @slot empty - Shown instead of the body when `empty` is set.
 * @slot footer - A footer under a hairline.
 * @csspart panel - The outer box.
 * @csspart head - The head row.
 * @csspart icon - The head icon.
 * @csspart heading - The `mm-heading`.
 * @csspart count - The count.
 * @csspart link - The built-in "View all" link.
 * @csspart body - The body.
 * @csspart footer - The footer.
 */
export class MmPanel extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .panel {
        background: var(--mm-surface);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        min-width: 0;
        overflow: hidden;
      }
      .head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: calc(var(--space-12) - 1px);
        padding: var(--space-2) var(--space-4);
        border-block-end: 1px solid var(--mm-rule);
      }
      .icon {
        color: var(--mm-text-3);
        flex: none;
      }
      .title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        flex: 1;
        min-width: 0;
      }
      mm-heading {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      mm-count {
        flex: none;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex: none;
      }
      .link,
      ::slotted([slot='link']) {
        flex: none;
        font: var(--text-label);
        color: var(--mm-text);
        text-decoration: none;
        border-radius: var(--radius-sm);
        white-space: nowrap;
      }
      .link:hover,
      .link:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .body {
        min-width: 0;
      }
      :host([padding='default']) .body {
        padding: var(--space-4) var(--space-5);
      }
      :host(:not([padding='default'])) mm-skeleton::part(placeholder) {
        padding: var(--space-4) var(--space-5);
      }
      .footer {
        border-block-start: 1px solid var(--mm-rule);
        padding: var(--space-3) var(--space-4);
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      [hidden] {
        display: none !important;
      }
    `,
  ];

  /** The title, rendered in a real heading. */
  @property() accessor heading = '';
  /** Outline level of the title, 1 to 6. */
  @property({ type: Number }) accessor level = 2;
  /** Leading Material Symbols icon for the head. */
  @property() accessor icon = '';
  /** A count shown after the title, such as the number of items needing attention. */
  @property({ type: Number }) accessor count: number | undefined;
  /** Href of the head link. */
  @property({ attribute: 'link-href' }) accessor linkHref = '';
  /** Text of the head link. Defaults to "View all". */
  @property({ attribute: 'link-label' }) accessor linkLabel = '';
  /** `none` (default, for lists and tables) or `default` (space-4 by space-5). */
  @property({ reflect: true }) accessor padding: 'none' | 'default' = 'none';
  /** Shows skeleton lines in the body and marks it busy. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** Shows the `empty` slot instead of the body. */
  @property({ type: Boolean, reflect: true }) accessor empty = false;

  @state() accessor #slotted = new Set<string>();

  override connectedCallback(): void {
    super.connectedCallback();
    if (!warnedNested && insidePanel(this)) {
      warnedNested = true;
      console.warn('mm-panel: panels are never nested. Separate the parts of one panel with hairlines or spacing instead.', this);
    }
  }

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const next = new Set(this.#slotted);
    if (slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim())) next.add(slot.name);
    else next.delete(slot.name);
    this.#slotted = next;
  };

  #link() {
    if (!this.linkHref) return nothing;
    const label = this.linkLabel || tr('viewAll', 'View all');
    return html`<a class="link" part="link" href=${this.linkHref}
      >${label}${this.heading ? html`<span class="visually-hidden">: ${this.heading}</span>` : nothing}</a
    >`;
  }

  override render() {
    const hasHead = !!this.heading || ['heading', 'actions', 'link'].some((s) => this.#slotted.has(s)) || !!this.linkHref;
    return html`<div class="panel" part="panel">
      <div class="head" part="head" ?hidden=${!hasHead}>
        ${this.icon ? html`<mm-icon class="icon" part="icon" name=${this.icon} aria-hidden="true"></mm-icon>` : nothing}
        <div class="title">
          <mm-heading part="heading" level=${this.level} variant="panel-title"
            ><slot name="heading" @slotchange=${this.#onSlot}>${this.heading}</slot></mm-heading
          >
          ${this.count !== undefined && this.count !== null ? html`<mm-count part="count" value=${this.count}></mm-count>` : nothing}
        </div>
        <div class="actions" ?hidden=${!this.#slotted.has('actions')}><slot name="actions" @slotchange=${this.#onSlot}></slot></div>
        <slot name="link" @slotchange=${this.#onSlot}>${this.#link()}</slot>
      </div>
      <div class="body" part="body" aria-busy=${this.loading ? 'true' : 'false'}>
        <mm-skeleton ?loading=${this.loading} shape="text" count="3">
          <div ?hidden=${this.empty}><slot></slot></div>
          <div ?hidden=${!this.empty}><slot name="empty"></slot></div>
        </mm-skeleton>
      </div>
      <div class="footer" part="footer" ?hidden=${!this.#slotted.has('footer')}><slot name="footer" @slotchange=${this.#onSlot}></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-panel': MmPanel;
  }
}
