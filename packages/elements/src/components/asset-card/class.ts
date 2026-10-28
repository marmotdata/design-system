import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { formatCount, formatRelative, formatTimestamp } from '../../core/format.js';
import '@marmotdata/icons/define.js';
import '../readout/define.js';
import '../tag/define.js';
import '../skeleton/define.js';

const list = {
  fromAttribute: (v: string | null) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  toAttribute: (v: string[]) => v.join(', '),
};

/** Shared card layout for the asset and person cards. */
export const cardStyles = css`
  :host {
    display: block;
    inline-size: var(--mm-card-width, 320px);
    max-inline-size: 100%;
    color: var(--mm-text);
    font: var(--text-dense);
    letter-spacing: var(--tracking-dense);
  }
  :host([framed]) {
    padding: var(--space-4);
    background: var(--mm-surface);
    border: 1px solid var(--mm-rule);
    border-radius: var(--radius-md);
  }
  .card {
    display: grid;
    gap: var(--space-3);
    min-inline-size: 0;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-inline-size: 0;
  }
  .titles {
    display: grid;
    gap: 2px;
    min-inline-size: 0;
    flex: 1;
  }
  .name {
    font: var(--text-body-strong);
    color: var(--mm-text);
    overflow-wrap: anywhere;
    margin: 0;
  }
  /* Links in cards are ink, underlined on hover and focus. Burnt sienna is for links in prose. */
  a.name {
    color: var(--mm-text);
    text-decoration: none;
  }
  a.name:hover,
  a.name:focus-visible {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
  .caption {
    font: var(--text-caption);
    color: var(--mm-text-2);
    overflow-wrap: anywhere;
    margin: 0;
  }
  .muted {
    color: var(--mm-text-2);
    margin: 0;
  }
  dl {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--space-1) var(--space-4);
    margin: 0;
  }
  dt {
    font: var(--text-label);
    letter-spacing: var(--tracking-label);
    color: var(--mm-text-2);
    padding-block-start: 1px;
  }
  dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }
  .error {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    color: var(--mm-danger);
    margin: 0;
  }
  .error mm-icon {
    margin-block-start: 1px;
  }
`;

/**
 * Asset cards summarise one catalog asset: its provider logo and name (an ink link with `href`,
 * underlined on hover and focus), a sentence-case caption of real metadata ("Table · 14 cols"),
 * the MRN as a quiet caption in the text face (mono is kept for the one MRN in the page header),
 * the description clamped to two lines, owners, tags (with `pii` and `certified` in their
 * own colours), the row count in tabular figures and when it was last updated. They are built for
 * `mm-hover-card` and also work on their own; set `framed` for a bordered surface when the card
 * is not already inside a panel or popover, since cards never nest in cards.
 *
 * `loading` holds the shape with a skeleton (after the usual 200ms delay); `error` replaces the
 * content with the message, in crimson with an icon. An asset with no description says so rather
 * than leaving a gap.
 *
 * @tagname mm-asset-card
 * @summary A compact summary of one asset.
 * @csspart card - The content grid.
 * @csspart name - The asset name, a link when `href` is set.
 * @csspart mrn - The MRN.
 * @csspart description - The description.
 * @cssprop --mm-card-width - Card width. Defaults to 320px.
 */
export class MmAssetCard extends LitElement {
  static override styles = [
    base,
    cardStyles,
    css`
      .desc {
        margin: 0;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        overflow-wrap: anywhere;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      mm-provider-logo {
        margin-block-start: 2px;
      }
    `,
  ];

  /** Asset name, e.g. `orders_daily`. */
  @property() accessor name = '';
  /** Link to the asset page. Makes the name a link. */
  @property() accessor href = '';
  /** Provider key for the logo, e.g. `postgresql`, `kafka`, `snowflake`. */
  @property() accessor provider = '';
  /** Asset type for the metadata caption, e.g. "Table", "Topic", "Dashboard". */
  @property() accessor type = '';
  /** Column count, added to the metadata caption when known. */
  @property({ type: Number }) accessor columns: number | undefined;
  /** The asset's MRN, e.g. `mrn://postgresql/table/shop.public.orders`. */
  @property() accessor mrn = '';
  /** Description, clamped to two lines. */
  @property() accessor description = '';
  /** Owners: an array, or a comma-separated attribute. */
  @property({ converter: list }) accessor owners: string[] = [];
  /** Tags: an array, or a comma-separated attribute. `pii` and `certified` get their own styles. */
  @property({ converter: list }) accessor tags: string[] = [];
  /** Row count, shown in full with tabular figures. */
  @property({ type: Number }) accessor rows: number | undefined;
  /** When the asset last changed: an ISO timestamp, shown relative with the exact time on hover. */
  @property({ attribute: 'updated' }) accessor updatedAt = '';
  /** Shows a skeleton while the asset loads. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message in place of the content. */
  @property() accessor error = '';
  /** A bordered surface for use outside a panel or popover. */
  @property({ type: Boolean, reflect: true }) accessor framed = false;

  #readout(): string[] {
    const items: string[] = [];
    if (this.type) items.push(this.type);
    if (Number.isFinite(this.columns)) items.push(tr('assetColumns', '{n} cols', { n: formatCount(this.columns!) }));
    return items;
  }

  #tag(tag: string) {
    const key = tag.toLowerCase();
    if (key === 'pii') return html`<mm-tag variant="pii"></mm-tag>`;
    if (key === 'certified') return html`<mm-tag variant="certified"></mm-tag>`;
    return html`<mm-tag>${tag}</mm-tag>`;
  }

  #updated() {
    const d = new Date(this.updatedAt);
    if (Number.isNaN(d.getTime())) return html`${this.updatedAt}`;
    return html`<time datetime=${d.toISOString()} title=${formatTimestamp(d)}>${formatRelative(d)}</time>`;
  }

  override render() {
    if (this.error) {
      return html`<div part="card" class="card">
        <p class="error" role="alert"><mm-icon name="error"></mm-icon><span>${this.error}</span></p>
      </div>`;
    }
    if (this.loading) {
      return html`<div part="card" class="card"><mm-skeleton loading shape="text" count="4"></mm-skeleton></div>`;
    }
    const readout = this.#readout();
    return html`<div part="card" class="card">
      <div class="head">
        ${this.provider ? html`<mm-provider-logo provider=${this.provider} size="20"></mm-provider-logo>` : nothing}
        <div class="titles">
          ${this.href
            ? html`<a part="name" class="name" href=${this.href}>${this.name}</a>`
            : html`<p part="name" class="name">${this.name}</p>`}
          ${readout.length ? html`<mm-readout .items=${readout}></mm-readout>` : nothing}
        </div>
      </div>
      ${this.mrn ? html`<p part="mrn" class="caption">${this.mrn}</p>` : nothing}
      ${this.description
        ? html`<p part="description" class="desc" title=${this.description}>${this.description}</p>`
        : html`<p part="description" class="muted">${tr('noDescription', 'No description yet.')}</p>`}
      <dl>
        <dt>${tr('owners', 'Owners')}</dt>
        <dd>${this.owners.length ? this.owners.join(', ') : html`<span class="muted">${tr('noOwners', 'No owners')}</span>`}</dd>
        ${Number.isFinite(this.rows) ? html`<dt>${tr('rows', 'Rows')}</dt><dd class="num">${formatCount(this.rows!)}</dd>` : nothing}
        ${this.updatedAt ? html`<dt>${tr('updated', 'Updated')}</dt><dd>${this.#updated()}</dd>` : nothing}
      </dl>
      ${this.tags.length ? html`<div class="tags">${this.tags.map((t) => this.#tag(t))}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-asset-card': MmAssetCard;
  }
}
