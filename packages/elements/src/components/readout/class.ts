import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';

/** Splits a `·`-separated attribute into items. */
const toItems = (value: string | null): string[] =>
  (value ?? '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * A readout is a strip of real metadata separated by middle dots, such as
 * "Table · Snowflake · 9 columns · 1.28M rows" under an asset name in a row, card, node or tile.
 * By default it is a sentence-case caption in `mm-text-2` with tabular figures, in the text face.
 * Each value is real metadata; the middle dot is not read by assistive technology.
 *
 * Write items in sentence case with everyday words and relative times ("9 columns", "Updated 5 hours
 * ago"). There is no uppercase variant: the design system has no uppercase text.
 *
 * @tagname mm-readout
 * @summary A sentence-case metadata strip separated by middle dots.
 * @slot - Plain readout text, used when `items` is empty. Use a middle dot only between real values.
 * @csspart list - The list of items.
 * @csspart item - Each item.
 */
export class MmReadout extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      :host([inline]) {
        display: inline-block;
      }
      ul {
        display: flex;
        flex-wrap: wrap;
        margin: 0;
        padding: 0;
        list-style: none;
        row-gap: 0;
      }
      li {
        white-space: nowrap;
      }
      li + li::before {
        content: '·';
        content: '·' / '';
        padding-inline: 0.5em;
      }
    `,
  ];

  /**
   * The metadata values: an array as a property, or a `·`-separated string as an attribute
   * (`items="Table · 14 cols · 1.28M rows"`).
   */
  @property({ converter: { fromAttribute: toItems, toAttribute: (v: string[]) => v.join(' · ') } })
  accessor items: string[] | string = [];
  /** Names the strip for assistive technology, for example "Asset metadata". */
  @property() accessor label = '';
  /** Sits inline with text instead of on its own line. */
  @property({ type: Boolean, reflect: true }) accessor inline = false;

  override render() {
    const items = Array.isArray(this.items) ? this.items.filter((s) => String(s).trim()) : toItems(this.items);
    if (!items.length) {
      return html`<span part="list"><slot></slot></span>`;
    }
    return html`<ul part="list" role="list" aria-label=${this.label || nothing}>
      ${items.map((item) => html`<li part="item">${item}</li>`)}
    </ul>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-readout': MmReadout;
  }
}
