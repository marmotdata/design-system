import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../text/define.js';
import '../count/define.js';
import '../copy-button/define.js';

/**
 * The page header names the object or list a view is about. The title is the one display title in
 * the view (`display-title`), optionally led by a provider logo or an
 * icon. Under it sit, in order and only when given: a quiet sentence-case `caption` in the text face
 * and `mm-text-2` for facts shown nowhere else on the page ("1,284 rows · Updated 5 hours ago", a
 * hostname), leaving out the kind the breadcrumbs already give; the MRN
 * in mono with a copy button, the one place an MRN is set in mono; a one-sentence description;
 * then labelled rows for Owners, Tags and Links (places to go next, such as the source's own docs
 * or a runbook a rule added), each only when slotted. Actions sit at the end of the title row, with the primary last; when
 * there is no room beside the title they wrap onto their own row, aligned to the start under the
 * caption and MRN. Breadcrumbs or a back link go above.
 *
 * Actions: one primary button and at most one secondary. A personal toggle such as Subscribe is an
 * icon-only ghost button with `pressed`, not a labelled secondary. Occasional and destructive
 * actions go into a "More" menu (`mm-menu-button` with icon `more-horiz` and the label "More
 * actions") as the first slotted action; places to go belong in the Links row, not in More. The header does not manage its actions, so this is yours to follow: slot at most three
 * things (More, secondary, primary).
 *
 * Long identifiers such as `orders_daily_by_customer_region_rollup_v2` wrap anywhere rather than
 * widening the page. `compact` is for list pages and workspaces: the title (28px `display-section`,
 * still the page title), a count and the actions on one line, with the caption (if any) under the
 * title.
 *
 * @tagname mm-page-header
 * @summary The title block of a view: title, caption, MRN, description, tags, owners and actions.
 * @slot heading - The title, if it needs markup. Otherwise use `heading`.
 * @slot leading - Leading media, if `provider` or `icon` is not enough.
 * @slot breadcrumbs - Breadcrumbs above the title.
 * @slot description - The description with markup. Otherwise use `description`.
 * @slot tags - `mm-tag` elements, in a row labelled "Tags".
 * @slot owners - Owners, such as owner chips, in a row labelled "Owners".
 * @slot links - Places to go next, such as the source's own docs or a runbook, as small `mm-button external` buttons with the link's icon, in a row labelled "Links".
 * @slot actions - Up to one primary (last) and one secondary button; anything else in a "More" `mm-menu-button` before them.
 * @csspart header - The header element.
 * @csspart back - The back link.
 * @csspart heading - The `mm-heading`.
 * @csspart caption - The caption (subtitle) line.
 * @csspart mrn - The MRN line.
 * @csspart description - The description.
 * @csspart actions - The actions wrapper.
 */
export class MmPageHeader extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .header {
        display: grid;
        gap: var(--space-3);
        min-width: 0;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        justify-self: start;
        font: var(--text-label);
        color: var(--mm-text-2);
        text-decoration: none;
        border-radius: var(--radius-sm);
        min-block-size: 24px;
      }
      .back:hover,
      .back:focus-visible {
        color: var(--mm-text);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      :host([data-rtl]) .back mm-icon {
        transform: scaleX(-1);
      }
      .top {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: var(--space-3) var(--space-6);
      }
      .titleblock {
        flex: 1 1 32ch;
        min-width: 0;
        display: grid;
        gap: var(--space-2);
      }
      .titlerow {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-width: 0;
      }
      .lead {
        display: inline-flex;
        flex: none;
        color: var(--mm-text-2);
      }
      mm-heading {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        /* The growing title block pushes the actions to the end of the title row. When they do not
           fit and wrap, they start their own row at the inline start, under the readout and MRN. */
      }
      .mrn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
      }
      .mrn code {
        font: inherit;
        overflow-wrap: anywhere;
        min-width: 0;
      }
      .caption {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      .desc {
        margin: 0;
        font: var(--text-body);
        color: var(--mm-text-2);
        max-inline-size: 75ch;
      }
      /* Owners, tags and links sit in labelled rows, so each reads as one thing at a glance. */
      .meta {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        align-items: center;
        gap: var(--space-2) var(--space-4);
      }
      .meta-label {
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      .meta-value {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        min-width: 0;
      }
      :host([compact]) .top {
        align-items: center;
      }
      :host([compact]) .titleblock {
        flex-basis: 20ch;
      }
      [hidden] {
        display: none !important;
      }
    `,
  ];

  /** The title. Write identifiers exactly as they are. */
  @property() accessor heading = '';
  /** Outline level of the title. */
  @property({ type: Number }) accessor level = 1;
  /** Provider key for a leading logo, such as `postgresql` or `kafka`. */
  @property() accessor provider = '';
  /** Leading Material Symbols icon, when there is no provider. */
  @property() accessor icon = '';
  /** A quiet line under the title for facts shown nowhere else, such as "1,284 rows · Updated 5 hours ago" or a hostname. Sentence case, text face, `mm-text-2`. */
  @property() accessor caption = '';
  /** The asset's MRN, shown in mono with a copy button. */
  @property() accessor mrn = '';
  /** One or two sentences about the object. */
  @property() accessor description = '';
  /** Shows a back link above the title. */
  @property({ attribute: 'back-href' }) accessor backHref = '';
  /** Text of the back link, such as "Discover". Defaults to "Back". */
  @property({ attribute: 'back-label' }) accessor backLabel = '';
  /** List page layout: a smaller title, a count and actions on one line. */
  @property({ type: Boolean, reflect: true }) accessor compact = false;
  /** Count shown after the title in `compact` layout, such as the number of pipelines. */
  @property({ type: Number }) accessor count: number | undefined;

  @state() accessor #slotted = new Set<string>();

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined') this.toggleAttribute('data-rtl', getComputedStyle(this).direction === 'rtl');
  }

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const next = new Set(this.#slotted);
    if (slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim())) next.add(slot.name);
    else next.delete(slot.name);
    this.#slotted = next;
  };

  #lead() {
    if (this.provider) return html`<mm-provider-logo provider=${this.provider} size=${this.compact ? 24 : 32}></mm-provider-logo>`;
    if (this.icon) return html`<mm-icon name=${this.icon} size="24" aria-hidden="true"></mm-icon>`;
    return nothing;
  }

  override render() {
    const has = (s: string) => this.#slotted.has(s);
    const hasLead = !!this.provider || !!this.icon || has('leading');
    const hasDesc = !!this.description || has('description');
    return html`<div class="header" part="header">
      <div ?hidden=${!has('breadcrumbs')}><slot name="breadcrumbs" @slotchange=${this.#onSlot}></slot></div>
      ${this.backHref
        ? html`<a class="back" part="back" href=${this.backHref}
            ><mm-icon name="arrow-back" aria-hidden="true"></mm-icon>${this.backLabel || tr('back', 'Back')}</a
          >`
        : nothing}
      <div class="top">
        <div class="titleblock">
          <div class="titlerow">
            <span class="lead" ?hidden=${!hasLead}><slot name="leading" @slotchange=${this.#onSlot}>${this.#lead()}</slot></span>
            <mm-heading part="heading" level=${this.level} variant=${this.compact ? 'display-section' : 'display-title'}
              ><slot name="heading">${this.heading}</slot></mm-heading
            >
            ${this.compact && this.count !== undefined && this.count !== null
              ? html`<mm-count value=${this.count}></mm-count>`
              : nothing}
          </div>
          ${this.caption ? html`<p class="caption" part="caption">${this.caption}</p>` : nothing}
          ${this.compact
            ? nothing
            : html`${this.mrn
                  ? html`<div class="mrn" part="mrn">
                      <code>${this.mrn}</code>
                      <mm-copy-button value=${this.mrn} label=${tr('copyMrn', 'Copy MRN')} size="sm"></mm-copy-button>
                    </div>`
                  : nothing}`}
        </div>
        <div class="actions" part="actions" ?hidden=${!has('actions')}><slot name="actions" @slotchange=${this.#onSlot}></slot></div>
      </div>
      <p class="desc" part="description" ?hidden=${!hasDesc}>
        <slot name="description" @slotchange=${this.#onSlot}>${this.description || nothing}</slot>
      </p>
      <div class="meta" part="meta" ?hidden=${!has('owners') && !has('tags') && !has('links')}>
        <span class="meta-label" ?hidden=${!has('owners')}>${tr('headerOwners', 'Owners')}</span>
        <div class="meta-value" ?hidden=${!has('owners')}><slot name="owners" @slotchange=${this.#onSlot}></slot></div>
        <span class="meta-label" ?hidden=${!has('tags')}>${tr('headerTags', 'Tags')}</span>
        <div class="meta-value" ?hidden=${!has('tags')}><slot name="tags" @slotchange=${this.#onSlot}></slot></div>
        <span class="meta-label" ?hidden=${!has('links')}>${tr('headerLinks', 'Links')}</span>
        <div class="meta-value" ?hidden=${!has('links')}><slot name="links" @slotchange=${this.#onSlot}></slot></div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-page-header': MmPageHeader;
  }
}
