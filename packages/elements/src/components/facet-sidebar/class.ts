import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { formatCount } from '../../core/format.js';
import { onStringsChange, t, tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../filter-pill/define.js';
import '../search-field/define.js';

/** One option in a facet. */
export interface MmFacetOption {
  value: string;
  label: string;
  /** Number of matching assets. */
  count?: number;
  /** Material Symbols icon, such as `table` or `smart-toy`. */
  icon?: string;
  /** Provider key for `mm-provider-logo`, such as `postgresql` or `snowflake`. */
  provider?: string;
}

export interface MmFacetChangeDetail {
  name: string;
  value: string[];
}

export interface MmFilterChangeDetail {
  facets: Record<string, string[]>;
}

const hostStrings = (host: LitElement) => {
  let off: (() => void) | undefined;
  return {
    connect: () => (off = onStringsChange(() => host.requestUpdate())),
    disconnect: () => off?.(),
  };
};

/**
 * One group of filters in the Discover filter column: Type, Provider, Tags or Owner. The heading is
 * a disclosure button that collapses the group. Options are checkboxes with an optional icon or
 * provider logo and a count aligned to the end, in the text face with tabular figures. Past `limit` options a "Show 8 more"
 * button reveals the rest (selected options always stay visible); past `filter-threshold` options an
 * inline field filters the list. "Clear" resets the group.
 *
 * Checkboxes are native, drawn like `mm-checkbox` (ink fill, never burnt sienna), so Space toggles them
 * and Tab moves between them (https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/). The heading
 * button follows the disclosure pattern (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/):
 * Enter or Space toggles, and `aria-expanded` reports the state.
 *
 * @tagname mm-facet
 * @summary One collapsible group of filter checkboxes.
 * @csspart heading - The disclosure button.
 * @csspart clear - The "Clear" button.
 * @csspart options - The option list.
 * @csspart option - Each option row.
 * @csspart more - The "Show more" button.
 * @fires mm-facet-change - {MmFacetChangeDetail} The selected values changed by user action.
 */
export class MmFacet extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        padding-block: var(--space-4);
        border-top: 1px solid var(--mm-rule);
        color: var(--mm-text);
      }
      .head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 24px;
      }
      .heading {
        flex: 1;
        min-width: 0;
        margin: 0;
        font: inherit;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        width: 100%;
        min-height: 24px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--mm-text);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        text-align: start;
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .toggle mm-icon {
        color: var(--mm-text-2);
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host([collapsed]) .toggle mm-icon {
        transform: rotate(-90deg);
      }
      :host([collapsed]:dir(rtl)) .toggle mm-icon {
        transform: rotate(90deg);
      }
      .selected-n {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .text-btn {
        flex: none;
        min-height: 24px;
        padding: 0 var(--space-1);
        border: 0;
        background: none;
        color: var(--mm-text-2);
        font: var(--text-caption);
        text-decoration: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .text-btn:hover,
      .text-btn:focus-visible {
        color: var(--mm-text);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
      }
      .text-btn:hover {
        color: var(--mm-text);
        text-decoration-thickness: 2px;
      }
      .body {
        display: grid;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .body[hidden] {
        display: none;
      }
      mm-search-field {
        width: 100%;
        --mm-control: var(--control-h-sm);
      }
      ul {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .opt {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 28px;
        padding-inline: var(--space-1);
        margin-inline: calc(-1 * var(--space-1));
        border-radius: var(--radius-sm);
        font: var(--text-dense);
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .opt:hover {
        background: var(--mm-sunken);
      }
      .box {
        position: relative;
        display: grid;
        place-items: center;
        flex: none;
        width: 16px;
        height: 16px;
      }
      .native {
        appearance: none;
        grid-area: 1 / 1;
        width: 16px;
        height: 16px;
        margin: 0;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          border-color var(--mm-dur-press) var(--mm-ease);
      }
      .opt:hover .native {
        border-color: var(--mm-text);
      }
      .native:checked {
        background: var(--mm-text);
        border-color: var(--mm-text);
      }
      .glyph {
        grid-area: 1 / 1;
        color: var(--mm-on-inverse);
        pointer-events: none;
        opacity: 0;
      }
      .native:checked + .glyph {
        opacity: 1;
      }
      .lead {
        display: inline-flex;
        flex: none;
        color: var(--mm-text-2);
      }
      .name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .count {
        flex: none;
        margin-inline-start: auto;
        text-align: end;
        /* The mm-count style (the text face at 13px, tabular figures), inline so the count is part of the checkbox's name. Counts are never mono. */
        font: var(--text-caption);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: var(--mm-text-2);
      }
      .more {
        justify-self: start;
        padding: 0;
      }
      .none {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      @media (pointer: coarse) {
        .opt {
          min-height: var(--target-touch);
        }
      }
    `,
  ];

  /** Key for this facet in the sidebar's `facets` record, such as `type` or `provider`. */
  @property({ reflect: true }) accessor name = '';
  /** Heading, such as "Type" or "Provider". */
  @property() accessor label = '';
  /** The options. Set as a property, or as a JSON attribute. */
  @property({ type: Array }) accessor options: MmFacetOption[] = [];
  /** Selected option values. */
  @property({ type: Array }) accessor value: string[] = [];
  /** Options shown before "Show more". */
  @property({ type: Number }) accessor limit = 5;
  /** More options than this shows an inline filter field. */
  @property({ type: Number, attribute: 'filter-threshold' }) accessor filterThreshold = 12;
  /** Collapses the group to its heading. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;
  /** Heading level for the group heading. */
  @property({ type: Number, attribute: 'heading-level' }) accessor headingLevel = 3;

  @state() accessor #expanded = false;
  @state() accessor #query = '';
  #ids = { body: uid('mm-facet-body'), list: uid('mm-facet-list') };
  #strings = hostStrings(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.#strings.connect();
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#strings.disconnect();
  }

  /** Sets the selection and fires `mm-facet-change`, as a user change would. */
  setValue(value: string[]): void {
    this.value = [...value];
    emit<MmFacetChangeDetail>(this, 'mm-facet-change', { name: this.name, value: this.value });
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    // Keep the sidebar's applied-filters summary in step with programmatic changes.
    if (changed.has('value') || changed.has('options') || changed.has('label')) (this.parentElement as LitElement | null)?.requestUpdate?.();
  }

  #toggle(opt: MmFacetOption, on: boolean) {
    const set = new Set(this.value);
    if (on) set.add(opt.value);
    else set.delete(opt.value);
    // Keep option order, not click order.
    this.setValue(this.options.map((o) => o.value).filter((v) => set.has(v)));
  }

  #clear() {
    this.setValue([]);
    // The Clear button disappears with the selection; keep focus in the group.
    this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.toggle')?.focus());
  }

  async #showMore() {
    const firstHidden = this.#visible().length;
    this.#expanded = !this.#expanded;
    await this.updateComplete;
    // Move focus to the first newly shown option so keyboard users carry on where they were.
    if (this.#expanded) this.renderRoot.querySelectorAll<HTMLInputElement>('.native')[firstHidden]?.focus();
  }

  #visible(): MmFacetOption[] {
    const q = this.#query.trim().toLowerCase();
    if (q) return this.options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    if (this.#expanded) return this.options;
    const selected = new Set(this.value);
    return this.options.filter((o, i) => i < this.limit || selected.has(o.value));
  }

  override render() {
    const label = this.label || this.name;
    const selected = new Set(this.value);
    const visible = this.#visible();
    const filtering = !!this.#query.trim();
    const hiddenCount = filtering ? 0 : this.options.length - this.#visible().length;
    const canCollapse = !filtering && this.#expanded && this.options.length > this.limit;
    const level = Math.min(6, Math.max(1, this.headingLevel));
    return html`<div class="head">
        <div class="heading" role="heading" aria-level=${level}>
          <button
            part="heading"
            class="toggle"
            type="button"
            aria-expanded=${this.collapsed ? 'false' : 'true'}
            aria-controls=${this.#ids.body}
            @click=${() => (this.collapsed = !this.collapsed)}
          >
            <mm-icon name="expand-more"></mm-icon><span>${label}</span>
            ${this.value.length
              ? html`<span class="selected-n">${tr('facetSelected', '{n} selected', { n: formatCount(this.value.length) })}</span>`
              : nothing}
          </button>
        </div>
        ${this.value.length
          ? html`<button
              part="clear"
              class="text-btn"
              type="button"
              aria-label=${tr('facetClear', 'Clear {facet} filters', { facet: label })}
              @click=${this.#clear}
            >
              ${t('clear')}
            </button>`
          : nothing}
      </div>
      <div class="body" id=${this.#ids.body} ?hidden=${this.collapsed}>
        ${this.options.length > this.filterThreshold
          ? html`<mm-search-field
              label=${tr('facetFilter', 'Filter {facet}', { facet: label.toLowerCase() })}
              hide-label
              placeholder=${tr('facetFilter', 'Filter {facet}', { facet: label.toLowerCase() })}
              .value=${this.#query}
              @mm-input=${(e: CustomEvent<{ value: string }>) => {
                e.stopPropagation();
                this.#query = e.detail.value;
              }}
              @mm-change=${(e: Event) => e.stopPropagation()}
              @mm-search=${(e: Event) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            ></mm-search-field>`
          : nothing}
        <ul part="options" id=${this.#ids.list} aria-label=${label}>
          ${repeat(
            visible,
            (o) => o.value,
            (o) => html`<li>
              <label part="option" class="opt">
                <span class="box"
                  ><input
                    class="native"
                    type="checkbox"
                    name=${this.name || nothing}
                    value=${o.value}
                    .checked=${selected.has(o.value)}
                    @change=${(e: Event) => {
                      e.stopPropagation();
                      this.#toggle(o, (e.target as HTMLInputElement).checked);
                    }} /><mm-icon class="glyph" name="check" size="14"></mm-icon
                ></span>
                ${o.provider
                  ? html`<mm-provider-logo class="lead" provider=${o.provider} decorative></mm-provider-logo>`
                  : o.icon
                    ? html`<mm-icon class="lead" name=${o.icon}></mm-icon>`
                    : nothing}
                <span class="name" title=${o.label}>${o.label}</span>
                ${o.count !== undefined && o.count !== null ? html`<span class="count">${formatCount(o.count)}</span>` : nothing}
              </label>
            </li>`,
          )}
        </ul>
        ${filtering && !visible.length
          ? html`<p class="none" role="status">${tr('facetNoMatches', 'No {facet} match “{query}”.', { facet: label.toLowerCase(), query: this.#query.trim() })}</p>`
          : nothing}
        ${hiddenCount > 0 || canCollapse
          ? html`<button part="more" class="text-btn more" type="button" aria-expanded=${this.#expanded ? 'true' : 'false'} aria-controls=${this.#ids.list} @click=${this.#showMore}>
              ${this.#expanded ? tr('showFewer', 'Show fewer') : tr('showMore', 'Show {n} more', { n: formatCount(hiddenCount) })}
            </button>`
          : nothing}
      </div>`;
  }
}

/**
 * The Discover filter column: a "Filters" heading with "Clear all", a summary of applied filters as
 * removable pills, then one `mm-facet` per facet (Type, Provider, Tags, Owner). Facets are separated
 * by hairlines and spacing, never cards. Any change fires one `mm-filter-change` with every facet's
 * selection, ready to put in the URL or the search request.
 *
 * The column is a labelled region. Removing an applied pill moves focus to the next pill, or to
 * the heading when none are left, so focus is never lost.
 *
 * @tagname mm-facet-sidebar
 * With `hide-applied`, the summary is left to the search bar, whose tokens show the same filters.
 *
 * @summary The filter column with facets, applied filters and Clear all.
 * @slot - `mm-facet` elements.
 * @slot footer - Anything after the facets, such as a "Save as view" button.
 * @csspart heading - The "Filters" heading.
 * @csspart clear-all - The "Clear all" button.
 * @csspart applied - The applied-filters summary.
 * @fires mm-filter-change - {MmFilterChangeDetail} Any facet's selection changed by user action.
 */
export class MmFacetSidebar extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        color: var(--mm-text);
      }
      section {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding-bottom: var(--space-3);
      }
      h2 {
        margin: 0;
        font: var(--text-heading-sm);
        letter-spacing: var(--tracking-heading-sm);
      }
      h2:focus-visible {
        outline-offset: 2px;
      }
      .text-btn {
        min-height: 24px;
        padding: 0 var(--space-1);
        border: 0;
        background: none;
        color: var(--mm-text);
        font: var(--text-caption);
        font-weight: 600;
        text-decoration: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .text-btn:hover,
      .text-btn:focus-visible {
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
      }
      .text-btn[hidden] {
        display: none;
      }
      .applied {
        display: grid;
        gap: var(--space-2);
        padding-bottom: var(--space-4);
      }
      .applied-n {
        margin: 0 0 var(--space-2);
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .pills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .pills li {
        max-width: 100%;
      }
    `,
  ];

  /** Heading text. Defaults to "Filters". */
  @property() accessor heading = '';
  /** Hides the applied-filters summary when another place already shows it, such as `mm-search-bar` tokens. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-applied' }) accessor hideApplied = false;

  #ids = { heading: uid('mm-filters') };
  #strings = hostStrings(this);

  constructor() {
    super();
    this.addEventListener('mm-facet-change', (e) => {
      if ((e.target as Element).parentElement !== this) return;
      this.requestUpdate();
      this.#emit();
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#strings.connect();
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#strings.disconnect();
  }

  /** The facets, in order. */
  get facetElements(): MmFacet[] {
    return [...this.children].filter((el): el is MmFacet => el.localName === 'mm-facet');
  }

  /** Every facet's selection, keyed by facet `name`. */
  get facets(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const f of this.facetElements) out[f.name || f.label] = [...f.value];
    return out;
  }

  /** Clears every facet and fires one `mm-filter-change`. */
  clearAll(): void {
    for (const f of this.facetElements) f.value = [];
    this.requestUpdate();
    this.#emit();
  }

  #emit() {
    emit<MmFilterChangeDetail>(this, 'mm-filter-change', { facets: this.facets });
  }

  #applied() {
    return this.facetElements.flatMap((f) =>
      f.value.map((v) => ({ facet: f, value: v, option: f.options.find((o) => o.value === v) })),
    );
  }

  async #remove(facet: MmFacet, value: string, index: number) {
    facet.value = facet.value.filter((v) => v !== value);
    this.requestUpdate();
    this.#emit();
    await this.updateComplete;
    const pills = [...this.renderRoot.querySelectorAll<HTMLElement>('mm-filter-pill')];
    const next = pills[Math.min(index, pills.length - 1)];
    if (next) next.focus();
    else this.#focusHeading();
  }

  #focusHeading() {
    this.renderRoot.querySelector<HTMLElement>('h2')?.focus();
  }

  async #clearAll() {
    this.clearAll();
    await this.updateComplete;
    this.#focusHeading();
  }

  override render() {
    const applied = this.#applied();
    return html`<section aria-labelledby=${this.#ids.heading}>
      <div class="head">
        <h2 part="heading" id=${this.#ids.heading} tabindex="-1">${this.heading || tr('filters', 'Filters')}</h2>
        <button part="clear-all" class="text-btn" type="button" ?hidden=${!applied.length} @click=${this.#clearAll}>
          ${tr('clearAll', 'Clear all')}
        </button>
      </div>
      <p class=${applied.length && !this.hideApplied ? 'applied-n' : 'visually-hidden'} role="status">
        ${applied.length === 0
          ? ''
          : applied.length === 1
            ? tr('filtersAppliedOne', '1 filter applied')
            : tr('filtersApplied', '{n} filters applied', { n: formatCount(applied.length) })}
      </p>
      ${applied.length && !this.hideApplied
        ? html`<div part="applied" class="applied">
            <ul class="pills" aria-label=${tr('appliedFilters', 'Applied filters')}>
              ${applied.map(
                (a, i) => html`<li>
                  <mm-filter-pill removable facet=${a.facet.label || a.facet.name} @mm-remove=${() => this.#remove(a.facet, a.value, i)}
                    >${a.option?.provider
                      ? html`<mm-provider-logo slot="start" provider=${a.option.provider} decorative></mm-provider-logo>`
                      : nothing}${a.option?.label ?? a.value}</mm-filter-pill
                  >
                </li>`,
              )}
            </ul>
          </div>`
        : nothing}
      <slot @slotchange=${() => this.requestUpdate()}></slot>
      <slot name="footer"></slot>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-facet': MmFacet;
    'mm-facet-sidebar': MmFacetSidebar;
  }
}
