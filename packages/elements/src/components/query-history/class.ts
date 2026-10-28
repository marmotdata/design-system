import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { rovingKeydown } from '../../core/roving.js';
import { formatCount, formatDuration, formatRelative } from '../../core/format.js';
import { onStringsChange, tr } from '../../core/strings.js';
import '../status-pill/define.js';
import { STATUS_STATES, isHappyPath, type StatusState } from '../status-pill/class.js';
import '../filter-pill/define.js';
import '../button/define.js';
import '../copy-button/define.js';
import '@marmotdata/icons/define.js';

export type QueryStatus = 'succeeded' | 'failed' | 'denied' | 'running' | 'cancelled';

/** One past query. */
export interface QueryHistoryItem {
  id: string;
  sql: string;
  status: QueryStatus;
  /** The source the query ran against. `provider` is the MRN provider key, such as `postgresql`. */
  source: { name: string; provider: string };
  /** Rows returned, when the query succeeded. */
  rows?: number | null;
  /** Wall-clock duration in milliseconds. */
  durationMs?: number | null;
  /** When the query started: ISO string, Date or epoch milliseconds. */
  startedAt: string | number | Date;
  /** Why it failed or was denied, shown under the SQL. */
  reason?: string;
}

export type QueryHistoryFilter = 'all' | 'succeeded' | 'failed' | 'denied';

/** The first non-empty, non-comment line of a statement, collapsed to one line of text. */
export function firstLine(sql: string): string {
  const lines = sql.split('\n').map((l) => l.trim());
  return lines.find((l) => l && !l.startsWith('--')) ?? lines.find(Boolean) ?? '';
}

/**
 * Query history lists the queries someone has run, newest first: a status pill only when the run
 * needs attention (failed or denied, always with the word; a succeeded run gets none), the first
 * line of SQL in mono, the source with its provider logo,
 * rows returned, duration and when it ran. Each row opens the query in the editor; "Run again" and
 * "Copy SQL" sit at the end of the row. Status filter pills above the list narrow it down.
 *
 * Keyboard: the list is one tab stop. Up and Down arrows, Home and End move between queries, Enter
 * opens the focused query, and Tab moves on to that row's actions.
 *
 * @tagname mm-query-history
 * @summary Past queries with status, source, rows and duration.
 * @csspart filters - The row of status filter pills.
 * @csspart list - The list of queries.
 * @csspart row - Each query row.
 * @csspart sql - The first line of SQL.
 * @csspart empty - The empty message.
 * @fires mm-open-query - {{ query: QueryHistoryItem }} Open this query in the editor.
 * @fires mm-run - {{ sql: string, query: QueryHistoryItem }} Run this query again.
 * @fires mm-filter - {{ filter: 'all' | 'succeeded' | 'failed' | 'denied' }} The status filter changed.
 * @fires mm-copy - {{ value: string }} The SQL was copied (from the inner `mm-copy-button`).
 */
export class MmQueryHistory extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        container-type: inline-size;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-end: var(--space-3);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: grid;
        grid-template-columns: 6.5rem minmax(0, 1fr) 7rem 4.5rem 8rem auto;
        align-items: center;
        column-gap: var(--space-3);
        min-height: var(--mm-row, var(--row-default));
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--mm-rule);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      li:last-child {
        border-block-end: 0;
      }
      li:hover {
        background: var(--mm-sunken);
      }
      .status {
        justify-self: start;
      }
      .main {
        min-width: 0;
        display: grid;
        gap: 2px;
      }
      .open {
        display: block;
        min-width: 0;
        min-height: 24px;
        padding: 0;
        margin: 0;
        border: 0;
        background: none;
        color: inherit;
        text-align: start;
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .sql {
        display: block;
        font: var(--text-mono-dense);
        letter-spacing: var(--tracking-mono-dense, 0);
        color: var(--mm-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .open:hover .sql {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .source {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .source span,
      .reason {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .reason {
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .facts {
        display: contents;
      }
      .num {
        font-variant-numeric: tabular-nums;
        text-align: end;
        color: var(--mm-text-2);
        white-space: nowrap;
      }
      .time {
        color: var(--mm-text-2);
        white-space: nowrap;
        text-align: end;
      }
      .actions {
        display: flex;
        gap: var(--space-1);
        justify-content: flex-end;
      }
      .empty {
        margin: 0;
        padding: var(--space-6) var(--space-3);
        color: var(--mm-text-2);
        font: var(--text-dense);
      }
      @container (max-width: 640px) {
        li {
          grid-template-columns: minmax(0, 1fr) auto;
          row-gap: var(--space-1);
        }
        .status {
          grid-column: 1 / -1;
        }
        .facts {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          grid-column: 1;
          font: var(--text-caption);
        }
        .num,
        .time {
          text-align: start;
        }
        .actions {
          grid-row: 2;
          grid-column: 2;
        }
      }
    `,
  ];

  /** Past queries, newest first. */
  @property({ attribute: false }) accessor queries: QueryHistoryItem[] = [];
  /** `all` (default), `succeeded`, `failed` or `denied`. */
  @property({ reflect: true }) accessor filter: QueryHistoryFilter = 'all';
  /** Accessible name of the list. Defaults to "Query history". */
  @property() accessor label = '';
  /** Hides the status filter pills. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-filters' }) accessor hideFilters = false;
  /** Reference time for relative times, in epoch milliseconds. Defaults to now. */
  @property({ type: Number }) accessor now: number | undefined;

  @state() accessor #current = 0;
  #id = uid('mm-qh');
  #unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unsubscribe = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
  }

  /** The queries that pass the current filter. */
  get visibleQueries(): QueryHistoryItem[] {
    return this.filter === 'all' ? this.queries : this.queries.filter((q) => q.status === this.filter);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('queries') || changed.has('filter')) this.#current = Math.min(this.#current, Math.max(0, this.visibleQueries.length - 1));
  }

  /** Moves focus to the query at `index` in the visible list. */
  focusQuery(index = this.#current): void {
    this.#current = index;
    void this.updateComplete.then(() => this.#openButtons()[index]?.focus());
  }

  #openButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.open')];
  }

  #onKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Enter' || e.key === ' ') return;
    const next = rovingKeydown(e, this.#openButtons(), index, { orientation: 'vertical', wrap: false });
    if (next !== null) this.#current = next;
  }

  #setFilter(filter: QueryHistoryFilter) {
    if (filter === this.filter) return;
    this.filter = filter;
    emit(this, 'mm-filter', { filter });
  }

  #renderFilters() {
    const count = (s: QueryStatus) => this.queries.filter((q) => q.status === s).length;
    const pills: [QueryHistoryFilter, string][] = [
      ['succeeded', tr('statusSucceeded', 'Succeeded')],
      ['failed', tr('statusFailed', 'Failed')],
      ['denied', tr('statusDenied', 'Denied')],
    ];
    return html`<div class="filters" part="filters" role="group" aria-label=${tr('filterByStatus', 'Filter by status')}>
      ${pills.map(
        ([f, word]) =>
          html`<mm-filter-pill
            ?pressed=${this.filter === f}
            .count=${count(f as QueryStatus)}
            @mm-change=${(e: CustomEvent<{ pressed: boolean }>) => this.#setFilter(e.detail.pressed ? f : 'all')}
            >${word}</mm-filter-pill
          >`,
      )}
    </div>`;
  }

  #renderRow(q: QueryHistoryItem, i: number, now: number) {
    const current = i === this.#current;
    const rowId = `${this.#id}-${i}`;
    const line = firstLine(q.sql);
    const rows = q.rows ?? null;
    const time = new Date(q.startedAt);
    const tabbable = current ? '0' : '-1';
    return html`<li part="row">
      <span class="status" id="${rowId}-status"
        >${isHappyPath(q.status)
          ? html`<span class="visually-hidden">${STATUS_STATES[q.status as StatusState]?.word() ?? q.status}</span>`
          : html`<mm-status-pill state=${q.status}></mm-status-pill>`}</span
      >
      <div class="main">
        <button
          type="button"
          class="open"
          tabindex=${tabbable}
          aria-describedby="${rowId}-status ${rowId}-meta"
          title=${tr('openInEditor', 'Open in editor')}
          @click=${() => {
            this.#current = i;
            emit(this, 'mm-open-query', { query: q });
          }}
          @focus=${() => (this.#current = i)}
          @keydown=${(e: KeyboardEvent) => this.#onKeydown(e, i)}
        >
          <span class="sql" part="sql" dir="ltr" translate="no">${line}</span>
        </button>
        <div class="source" id="${rowId}-meta">
          <mm-provider-logo provider=${q.source.provider} size="14" decorative aria-hidden="true"></mm-provider-logo>
          <span>${q.source.name}</span>
        </div>
        ${q.reason ? html`<div class="reason">${q.reason}</div>` : nothing}
      </div>
      <div class="facts">
        <span class="num">${rows !== null ? tr('rowCount', '{count} rows', { count: formatCount(rows) }) : ''}</span>
        <span class="num">${q.durationMs != null ? formatDuration(q.durationMs) : ''}</span>
        <time class="time" datetime=${time.toISOString()} title=${time.toISOString().slice(0, 19).replace('T', ' ') + ' UTC'}
          >${formatRelative(time, now)}</time
        >
      </div>
      <div class="actions">
        <mm-button
          variant="ghost"
          size="sm"
          icon="refresh"
          label=${tr('runAgain', 'Run again')}
          tabindex=${tabbable}
          @click=${() => emit(this, 'mm-run', { sql: q.sql, query: q })}
        ></mm-button>
        <mm-copy-button size="sm" label=${tr('copySql', 'Copy SQL')} .value=${q.sql} tabindex=${tabbable}></mm-copy-button>
      </div>
    </li>`;
  }

  override render() {
    const visible = this.visibleQueries;
    const now = this.now ?? Date.now();
    const label = this.label || tr('queryHistory', 'Query history');
    const empty = !this.queries.length
      ? tr('queryHistoryEmpty', 'No queries yet. Run one from the editor and it will appear here.')
      : tr('queryHistoryFilteredEmpty', 'No queries match this filter. Clear it to see the full history.');
    return html`${this.hideFilters || !this.queries.length ? nothing : this.#renderFilters()}
      ${visible.length
        ? html`<ul part="list" aria-label=${label}>
            ${visible.map((q, i) => this.#renderRow(q, i, now))}
          </ul>`
        : html`<p class="empty" part="empty" role="status">${empty}</p>`}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-query-history': MmQueryHistory;
  }
}
