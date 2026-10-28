import { LitElement, css, html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { tr } from '../../core/strings.js';

export type DescriptionLayout = 'columns' | 'stacked' | 'inline-grid';

/**
 * A description list sets out an object's metadata as label and value pairs: the Details section
 * of the asset blade, a pipeline's configuration, a member's profile. Labels are the sentence-case
 * `label` style in `mm-text-2`; values are dense text that wraps anywhere, so long MRNs never push
 * the layout wider. Nothing is boxed: pairs are separated by spacing alone.
 *
 * `layout="columns"` (default) puts a 120px label column beside the values. `stacked` puts each
 * label above its value, for narrow places. `inline-grid` lays pairs across 2 to 4 columns
 * (`columns`), for short KPI-like metadata such as rows, size and freshness.
 *
 * The list is exposed as a list of term and definition pairs, since native `dl` semantics cannot
 * cross shadow roots.
 *
 * @tagname mm-description-list
 * @summary Label and value pairs for metadata.
 * @slot - `mm-description` items.
 * @csspart list - The grid.
 */
export class MmDescriptionList extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .dl {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr);
        gap: var(--space-2) var(--space-4);
        margin: 0;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      :host([layout='stacked']) .dl {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-3);
      }
      :host([layout='inline-grid']) .dl {
        grid-template-columns: repeat(var(--_cols, 3), minmax(0, 1fr));
        gap: var(--space-4) var(--space-5);
      }
    `,
  ];

  /** `columns` (label column beside values, default), `stacked` or `inline-grid`. */
  @property({ reflect: true }) accessor layout: DescriptionLayout = 'columns';
  /** Number of columns for `inline-grid`, 2 to 4. */
  @property({ type: Number }) accessor columns = 3;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'list');
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('layout')) this.#sync();
  }

  #sync = () => {
    for (const el of this.querySelectorAll(':scope > mm-description')) el.setAttribute('data-layout', this.layout);
  };

  override render() {
    const cols = Math.min(4, Math.max(2, Math.round(this.columns) || 3));
    return html`<div class="dl" part="list" style="--_cols:${cols}"><slot @slotchange=${this.#sync}></slot></div>`;
  }
}

/**
 * One label and value pair inside `mm-description-list`. Set the label with `term` (or the `term`
 * slot) and the value as content. Use `mono` only for IDs and keys people copy. An empty
 * value shows "Not set" in `mm-text-3`, never a dash.
 *
 * @tagname mm-description
 * @summary A label and value pair.
 * @slot - The value.
 * @slot term - The label, if it needs markup. Otherwise use `term`.
 * @csspart term - The label.
 * @csspart details - The value.
 */
export class MmDescription extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        min-width: 0;
      }
      :host([data-layout='stacked']),
      :host([data-layout='inline-grid']) {
        grid-column: auto;
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
        align-content: start;
      }
      .term {
        font: var(--text-label);
        color: var(--mm-text-2);
        /* Align the 12px label with the 13px value's first line. */
        padding-block-start: 1px;
        overflow-wrap: anywhere;
      }
      .details {
        min-width: 0;
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      :host([mono]) .details {
        font: var(--text-mono-dense);
      }
      .empty {
        color: var(--mm-text-3);
        font: var(--text-dense);
      }
    `,
  ];

  /** The label. */
  @property() accessor term = '';
  /** Sets the value in mono, for IDs, keys and hashes people copy. Never for timestamps, counts or names. */
  @property({ type: Boolean, reflect: true }) accessor mono = false;

  @state() accessor #empty = true;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
    const layout = this.parentElement?.getAttribute('layout');
    if (this.parentElement?.localName === 'mm-description-list') this.setAttribute('data-layout', layout || 'columns');
    this.#empty = !this.#hasValue();
  }

  #hasValue(): boolean {
    return Array.from(this.childNodes).some((n) =>
      n.nodeType === Node.ELEMENT_NODE ? (n as Element).getAttribute('slot') !== 'term' : !!n.textContent?.trim(),
    );
  }

  #onSlotChange = () => {
    this.#empty = !this.#hasValue();
  };

  override render() {
    return html`<span class="term" part="term" role="term"><slot name="term">${this.term}</slot></span
      ><span class="details" part="details" role="definition"
        ><slot @slotchange=${this.#onSlotChange}></slot>${this.#empty ? html`<span class="empty">${tr('notSet', 'Not set')}</span>` : ''}</span
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-description-list': MmDescriptionList;
    'mm-description': MmDescription;
  }
}
