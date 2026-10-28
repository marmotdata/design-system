import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import '../text/define.js';

/**
 * A section is one major region of a page: Schema, Run history, Members. It is structure felt
 * rather than seen: a heading, an optional sentence of description and actions at the end of the
 * heading row, then the content. Sections are spaced `space-12` apart; `divider` adds a hairline
 * above when spacing alone is not enough. Sections are never boxed; use `mm-panel` for a bounded
 * subject on a dashboard.
 *
 * The heading is the 20px `heading` style in the text face. Section headings never use the display
 * face, which is kept for the page title.
 *
 * @tagname mm-section
 * @summary A titled page region with optional description and actions.
 * @slot - The content.
 * @slot heading - The heading, if it needs markup. Otherwise use `heading`.
 * @slot description - A description with markup. Otherwise use `description`.
 * @slot actions - Buttons at the end of the heading row; at most one primary.
 * @csspart section - The section element.
 * @csspart head - The heading row.
 * @csspart heading - The `mm-heading`.
 * @csspart description - The description.
 * @csspart actions - The actions wrapper.
 * @csspart body - The content wrapper.
 */
export class MmSection extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      :host(:not(:first-child)) {
        margin-block-start: var(--space-12);
      }
      :host([divider]) section {
        border-block-start: 1px solid var(--mm-rule);
        padding-block-start: var(--space-6);
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: var(--space-2) var(--space-4);
        margin-block-end: var(--space-4);
      }
      .text {
        flex: 1 1 24ch;
        min-width: 0;
        display: grid;
        gap: var(--space-1);
      }
      mm-heading {
        overflow-wrap: anywhere;
      }
      .desc {
        margin: 0;
        font: var(--text-dense);
        color: var(--mm-text-2);
        max-inline-size: 75ch;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-inline-start: auto;
      }
      [hidden] {
        display: none !important;
      }
    `,
  ];

  /** The heading text. */
  @property() accessor heading = '';
  /** Outline level of the heading, 1 to 6. */
  @property({ type: Number }) accessor level = 2;
  /** One sentence under the heading. */
  @property() accessor description = '';
  /** Draws a hairline above the section. */
  @property({ type: Boolean, reflect: true }) accessor divider = false;

  @state() accessor #slotted = new Set<string>();

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const next = new Set(this.#slotted);
    if (slot.assignedNodes({ flatten: true }).length) next.add(slot.name);
    else next.delete(slot.name);
    this.#slotted = next;
  };

  override render() {
    const hasHeading = !!this.heading || this.#slotted.has('heading');
    const hasDesc = !!this.description || this.#slotted.has('description');
    const hasActions = this.#slotted.has('actions');
    return html`<section part="section">
      <div class="head" part="head" ?hidden=${!hasHeading && !hasDesc && !hasActions}>
        <div class="text">
          <mm-heading part="heading" level=${this.level} variant="heading" ?hidden=${!hasHeading}
            ><slot name="heading" @slotchange=${this.#onSlot}>${this.heading}</slot></mm-heading
          >
          <p class="desc" part="description" ?hidden=${!hasDesc}>
            <slot name="description" @slotchange=${this.#onSlot}>${this.description || nothing}</slot>
          </p>
        </div>
        <div class="actions" part="actions" ?hidden=${!hasActions}><slot name="actions" @slotchange=${this.#onSlot}></slot></div>
      </div>
      <div part="body"><slot></slot></div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-section': MmSection;
  }
}
