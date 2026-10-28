import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { formatCount } from '../../core/format.js';
import { onStringsChange, t, tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../select/define.js';

export interface MmPageChangeDetail {
  page: number;
  pageSize: number;
}

type PageItem = number | 'gap-start' | 'gap-end';

/** Page numbers to show: always the first and last, the current page with `siblings` either side, and ellipses for the gaps. */
export function pageRange(page: number, pages: number, siblings = 1): PageItem[] {
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  const slots = siblings * 2 + 5;
  if (pages <= slots) return range(1, pages);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pages);
  const gapStart = left > 2;
  const gapEnd = right < pages - 2;
  const edge = 3 + siblings * 2;
  if (!gapStart && gapEnd) return [...range(1, edge), 'gap-end', pages];
  if (gapStart && !gapEnd) return [1, 'gap-start', ...range(pages - edge + 1, pages)];
  return [1, 'gap-start', ...range(left, right), 'gap-end', pages];
}

/**
 * Pagination moves through long result sets: Discover results, the query audit log, run history.
 * It is a `nav` landmark labelled "Pagination" with previous and next buttons, page numbers with
 * ellipses, and a "Showing 1–50 of 1,284,019" readout in tabular figures. The current page carries
 * `aria-current="page"` and the selection tint with ink text. An optional page-size select offers
 * 25, 50 and 100 rows; changing it keeps the first visible row on screen.
 *
 * `variant="compact"` shows only previous, "Page 3 of 26" and next, for blades and narrow panels.
 * Leave `total` unset for cursor pagination, where the total is unknown: only previous and next
 * show, and `has-next` says whether there is another page.
 *
 * Every control is a native button in the tab order (there is no composite keyboard model): Tab
 * moves through them and Enter or Space activates. Previous and next stay focusable when disabled
 * (`aria-disabled`), so focus is not lost on the first or last page.
 *
 * @tagname mm-pagination
 * @summary Moves through pages of results.
 * @csspart nav - The nav landmark.
 * @csspart summary - The "Showing 1–50 of 1,284,019" readout.
 * @csspart pages - The list of page buttons.
 * @csspart page - Each page button.
 * @csspart page-size - The page-size select.
 * @fires mm-page-change - {MmPageChangeDetail} The page or page size changed by user action.
 */
export class MmPagination extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
      }
      .summary,
      .position {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .summary strong {
        font-weight: 600;
        color: var(--mm-text);
      }
      .controls {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        margin-inline-start: auto;
      }
      :host([variant='compact']) .controls {
        margin-inline-start: 0;
      }
      ol {
        display: flex;
        align-items: center;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .page {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: var(--control-h-sm);
        height: var(--control-h-sm);
        padding: 0 6px;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        font: var(--text-button);
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .page:hover {
        background: var(--mm-sunken);
        color: var(--mm-text);
      }
      .page[aria-current='page'] {
        background: var(--mm-selected);
        color: var(--mm-text);
        cursor: default;
      }
      .gap {
        display: inline-flex;
        justify-content: center;
        min-width: 20px;
        color: var(--mm-text-2);
      }
      .position {
        padding-inline: var(--space-2);
        color: var(--mm-text);
      }
      .size {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
      }
      .size mm-select {
        width: 84px;
        --mm-control: var(--control-h-sm);
      }
      :host(:dir(rtl)) mm-button::part(icon) {
        transform: scaleX(-1);
      }
      @media (pointer: coarse) {
        .page {
          min-width: var(--target-touch);
          height: var(--target-touch);
        }
      }
    `,
  ];

  /** The current page, from 1. */
  @property({ type: Number, reflect: true }) accessor page = 1;
  /** Rows per page. */
  @property({ type: Number, attribute: 'page-size' }) accessor pageSize = 50;
  /** Total rows. Leave unset (or negative) for cursor pagination with an unknown total. */
  @property({ type: Number }) accessor total: number | undefined;
  /** With an unknown total, whether there is a next page. */
  @property({ type: Boolean, attribute: 'has-next' }) accessor hasNext = false;
  /** `default` (page numbers) or `compact` (previous, "Page 3 of 26", next). */
  @property({ reflect: true }) accessor variant: 'default' | 'compact' = 'default';
  /** Page sizes offered in the page-size select, comma separated. Empty hides the select. */
  @property({ attribute: 'page-sizes' }) accessor pageSizes = '';
  /** Pages shown either side of the current one before an ellipsis. */
  @property({ type: Number }) accessor siblings = 1;
  /** Accessible name of the landmark, when a page has more than one paginated list. Defaults to "Pagination". */
  @property() accessor label = '';
  /** Disables every control, for example while a page loads. */
  @property({ type: Boolean, reflect: true }) accessor disabled = false;

  #offStrings?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#offStrings = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#offStrings?.();
  }

  get #known(): boolean {
    return typeof this.total === 'number' && Number.isFinite(this.total) && this.total >= 0;
  }

  /** Number of pages, or undefined when the total is unknown. */
  get pageCount(): number | undefined {
    if (!this.#known) return undefined;
    return Math.max(1, Math.ceil(this.total! / Math.max(1, this.pageSize)));
  }

  get #page(): number {
    const p = Math.max(1, Math.floor(Number(this.page) || 1));
    const count = this.pageCount;
    return count ? Math.min(p, count) : p;
  }

  get #sizes(): number[] {
    return this.pageSizes
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  /** Goes to a page as if the user had chosen it, and fires `mm-page-change`. */
  goTo(page: number): void {
    const count = this.pageCount;
    const next = Math.max(1, count ? Math.min(page, count) : page);
    if (next === this.#page || this.disabled) return;
    this.page = next;
    emit<MmPageChangeDetail>(this, 'mm-page-change', { page: next, pageSize: this.pageSize });
  }

  async #pick(p: number) {
    this.goTo(p);
    // Buttons are reused by position, so keep focus on the page now current.
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>('.page[aria-current="page"]')?.focus();
  }

  #onSize(e: CustomEvent<{ value: string }>) {
    e.stopPropagation();
    const size = Number(e.detail.value);
    if (!size || size === this.pageSize) return;
    // Keep the first visible row on screen.
    const first = (this.#page - 1) * this.pageSize;
    this.pageSize = size;
    this.page = Math.floor(first / size) + 1;
    emit<MmPageChangeDetail>(this, 'mm-page-change', { page: this.page, pageSize: size });
  }

  #summary() {
    const page = this.#page;
    const start = (page - 1) * this.pageSize + 1;
    if (this.#known) {
      const total = this.total!;
      if (total === 0) return tr('paginationNone', 'No results');
      const end = Math.min(total, page * this.pageSize);
      return tr('paginationShowing', 'Showing {start}–{end} of {total}', {
        start: formatCount(start),
        end: formatCount(end),
        total: formatCount(total),
      });
    }
    return tr('paginationShowingUnknown', 'Showing {start}–{end}', { start: formatCount(start), end: formatCount(page * this.pageSize) });
  }

  #position() {
    const count = this.pageCount;
    return count
      ? tr('paginationPageOf', 'Page {page} of {pages}', { page: formatCount(this.#page), pages: formatCount(count) })
      : tr('paginationPage', 'Page {page}', { page: formatCount(this.#page) });
  }

  override render() {
    const page = this.#page;
    const count = this.pageCount;
    const known = this.#known;
    const prevOff = this.disabled || page <= 1;
    const nextOff = this.disabled || (known ? page >= (count ?? 1) : !this.hasNext);
    const compact = this.variant === 'compact' || !known;
    const sizes = this.#sizes;
    const prev = html`<mm-button
      variant="ghost"
      size="sm"
      icon="chevron-left"
      label=${t('previousPage')}
      ?disabled=${prevOff}
      @click=${() => !prevOff && this.goTo(page - 1)}
    ></mm-button>`;
    const next = html`<mm-button
      variant="ghost"
      size="sm"
      icon="chevron-right"
      label=${t('nextPage')}
      ?disabled=${nextOff}
      @click=${() => !nextOff && this.goTo(page + 1)}
    ></mm-button>`;
    const pages = compact
      ? html`<span class="position" aria-live="polite">${this.#position()}</span>`
      : html`<ol part="pages">
          ${pageRange(page, count ?? 1, Math.max(0, this.siblings)).map((p) =>
            typeof p === 'number'
              ? html`<li>
                  <button
                    part="page"
                    class="page"
                    type="button"
                    aria-label=${tr('paginationGoTo', 'Page {page}', { page: formatCount(p) })}
                    aria-current=${p === page ? 'page' : nothing}
                    ?disabled=${this.disabled}
                    @click=${() => this.#pick(p)}
                  >
                    ${formatCount(p)}
                  </button>
                </li>`
              : html`<li class="gap" aria-hidden="true">…</li>`,
          )}
        </ol>`;
    const showSummary = this.variant !== 'compact';
    return html`<nav part="nav" aria-label=${this.label || t('pagination')}>
      ${showSummary ? html`<span part="summary" class="summary">${this.#summary()}</span>` : nothing}
      ${sizes.length && showSummary
        ? html`<span part="page-size" class="size"
            ><mm-select
              label=${tr('rowsPerPage', 'Rows per page')}
              hide-label
              value=${String(this.pageSize)}
              ?disabled=${this.disabled}
              @mm-change=${this.#onSize}
              @mm-input=${(e: Event) => e.stopPropagation()}
              @change=${(e: Event) => e.stopPropagation()}
              >${sizes.map((s) => html`<mm-option value=${String(s)}>${formatCount(s)}</mm-option>`)}</mm-select
            ><span aria-hidden="true">${tr('perPage', 'per page')}</span></span
          >`
        : nothing}
      <div class="controls">${prev}${pages}${next}</div>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-pagination': MmPagination;
  }
}
