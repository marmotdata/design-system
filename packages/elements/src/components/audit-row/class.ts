import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import { formatCount, formatDuration, formatTimestamp } from '../../core/format.js';
import type { AvatarKind } from '../avatar/class.js';
import { parseTime } from '../activity-feed/time.js';
import { tokenize, renderTokens } from '../code-sample/highlight.js';
import { STATUS_STATES, isHappyPath, type StatusState } from '../status-pill/class.js';
import '../owner-chip/define.js';
import '../status-pill/define.js';
import '../button/define.js';
import '../copy-button/define.js';
import '../empty-state/define.js';
import '../skeleton/define.js';
import '@marmotdata/icons/define.js';

export type AuditOutcome = 'allowed' | 'denied' | 'failed';
export type AuditClient = 'api' | 'cli' | 'mcp' | 'editor' | (string & {});

export interface AuditQueryDetail {
  query: string;
  source: string;
  queryId: string;
}

const CLIENTS: Record<string, string> = { api: 'API', cli: 'CLI', mcp: 'MCP', editor: 'Editor' };

/** Splits `tables` given as an attribute: commas, spaces or new lines. */
const toList = (v: string | null): string[] => (v ?? '').split(/[\s,]+/).filter(Boolean);

/**
 * The query audit log records every query run through Marmot: who ran it (a person, or an agent and
 * the service account it runs as), from which client, against which source, what it asked, how many
 * rows came back and whether it was allowed. Rows are 36px and dense; the header band is sticky
 * inside the log's scroll area (set `--mm-audit-max-height` for long views).
 *
 * It is an ARIA table, not a grid: the log is read-only data, so screen readers keep their table
 * commands (moving by row and column, hearing headers), and the only control per record is a
 * disclosure button. A grid would force cell-by-cell arrow keys onto people who only want to move
 * between records and open one. Each `mm-audit-row` is a row group holding its row and, when
 * expanded, a full-width detail row, like a `tbody` per record. Columns are shared through
 * `--mm-audit-columns`.
 *
 * Keyboard: the log is one tab stop. Up and Down move between records, Home and End jump to the
 * first and last, Enter or Space expands or collapses the focused record, and Escape collapses it
 * from anywhere inside and returns focus to its row. Tab moves into an expanded record's actions.
 * Disclosure pattern: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 *
 * @tagname mm-audit-log
 * @summary The query audit log as a dense, expandable table.
 * @slot - `mm-audit-row` elements, newest first.
 * @slot empty-action - An action for the empty state, such as widening the time range.
 * @csspart table - The table.
 * @csspart header - The sticky header row.
 * @cssprop --mm-audit-columns - The grid columns shared by the header and rows.
 * @cssprop --mm-audit-max-height - Height at which the log scrolls under its sticky header. Defaults to none.
 * @fires mm-retry - {{}} The retry button on the error was activated.
 */
export class MmAuditLog extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        /* Wide enough for a full UTC timestamp, an agent name with its service account, the
           client word and the longest outcome pill without truncating them. */
        --mm-audit-columns: 2.25rem 11.75rem minmax(19.5rem, 2fr) 5.5rem minmax(8.5rem, 1fr) 6.5rem 7.5rem;
      }
      .wrap {
        container: mm-audit / inline-size;
        overflow: auto;
        max-block-size: var(--mm-audit-max-height, none);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      .table {
        min-inline-size: 61.5rem;
      }
      /* With no records there is nothing to scroll to, and nothing to focus in a scroll area. */
      .wrap.bare {
        overflow: hidden;
      }
      .wrap.bare .table {
        min-inline-size: 0;
      }
      .header {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
        background: var(--mm-sunken);
        border-block-end: 1px solid var(--mm-rule);
      }
      .hrow {
        display: grid;
        grid-template-columns: var(--mm-audit-columns);
        align-items: center;
        block-size: var(--mm-table-head-h, 32px);
      }
      .th {
        padding-inline: var(--space-3);
        font: var(--text-label);
        color: var(--mm-text-2);
        white-space: nowrap;
        text-align: start;
      }
      .th.num {
        text-align: end;
      }
      .state {
        padding: var(--space-4);
      }
      .error {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        margin: 0;
        font: var(--text-dense);
      }
      .error mm-icon {
        color: var(--mm-danger);
      }
    `,
  ];

  /** Names the table. Defaults to "Query audit log". */
  @property() accessor label = '';
  /** Placeholder rows while the first page loads. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message with a retry button, shown when there are no rows. */
  @property() accessor error = '';
  /** Empty-state title. */
  @property({ attribute: 'empty-heading' }) accessor emptyHeading = '';
  /** Empty-state sentence. */
  @property({ attribute: 'empty-description' }) accessor emptyDescription = '';

  @state() accessor #count = 0;

  get #rows(): MmAuditRow[] {
    return Array.from(this.querySelectorAll<MmAuditRow>(':scope > mm-audit-row'));
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('focusin', this.#onFocusIn);
  }

  #sync = (current?: MmAuditRow) => {
    const rows = this.#rows;
    this.#count = rows.length;
    const stop = current && rows.includes(current) ? current : rows[0];
    for (const r of rows) r.tabStop = r === stop;
  };

  #onFocusIn = (e: FocusEvent) => {
    const row = e.target as MmAuditRow;
    if (row.parentElement === this && row instanceof MmAuditRow) this.#sync(row);
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const origin = e.composedPath()[0] as Element | undefined;
    if (!origin?.hasAttribute?.('data-audit-toggle')) return;
    const rows = this.#rows;
    const i = rows.indexOf(e.target as MmAuditRow);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = rows.length - 1;
    e.preventDefault();
    const target = rows[next]!;
    this.#sync(target);
    target.focus();
  };

  #state() {
    if (this.#count) return nothing;
    if (this.error)
      return html`<div class="state">
        <p class="error" role="alert">
          <mm-icon name="error"></mm-icon><span>${this.error}</span>
          <mm-button size="sm" variant="secondary" icon="refresh" @click=${() => emit(this, 'mm-retry', {})}>${tr('tryAgain', 'Try again')}</mm-button>
        </p>
      </div>`;
    if (this.loading)
      return html`<div class="state"><mm-skeleton loading shape="table-row" count="6" columns="6"></mm-skeleton></div>`;
    return html`<mm-empty-state
      compact
      heading=${this.emptyHeading || tr('auditEmptyHeading', 'No queries recorded')}
      description=${this.emptyDescription ||
      tr('auditEmptyDescription', 'Queries will appear here once someone runs one.')}
    ><slot name="empty-action" slot="action"></slot></mm-empty-state>`;
  }

  override render() {
    const cols: [string, boolean][] = [
      [tr('auditColTime', 'Time (UTC)'), false],
      [tr('auditColWho', 'Who'), false],
      [tr('auditColClient', 'Client'), false],
      [tr('auditColSource', 'Source'), false],
      [tr('auditColRows', 'Rows'), true],
      [tr('auditColOutcome', 'Outcome'), false],
    ];
    return html`<div class=${this.#count ? 'wrap' : 'wrap bare'}>
      <div class="table" part="table" role="table" aria-label=${this.label || tr('auditLabel', 'Query audit log')} aria-busy=${this.loading ? 'true' : 'false'}>
        <div class="header" role="rowgroup">
          <div class="hrow" part="header" role="row">
            <div class="th" role="columnheader"><span class="visually-hidden">${tr('auditColDetails', 'Details')}</span></div>
            ${cols.map(([label, num]) => html`<div class=${num ? 'th num' : 'th'} role="columnheader">${label}</div>`)}
          </div>
        </div>
        <slot @slotchange=${() => this.#sync()}></slot>
      </div>
      ${this.#state()}
    </div>`;
  }
}

/**
 * One record in the query audit log. The row shows the time in UTC (text face, tabular figures), who
 * ran it (an agent by its robot avatar, never an "AGENT" tag), the client as a plain word (API, CLI,
 * MCP, never a coloured badge), the source with its provider logo, the rows returned (right-aligned
 * and tabular, with "Truncated" when the result was cut off) and the outcome. The statement is not
 * previewed in the row; it appears, in mono, only when the record is expanded. Don't badge the happy path: only
 * `denied` and `failed` show a status pill; an `allowed` record leaves the cell empty, with the
 * word for screen readers.
 *
 * Expanded, it shows the full statement, highlighted as SQL on the code ground (the same highlighter
 * and edge as `mm-code-sample`), with a copy button in its own column, the decision ("Denied
 * because svc-support has no grant on shop.public.customers"), the duration, the tables read as
 * MRNs with copy buttons (mono, since people copy them), and "Open in editor" and "Run again".
 *
 * @tagname mm-audit-row
 * @summary One query in the audit log, expandable.
 * @slot actions - Extra actions for the expanded record.
 * @csspart row - The row.
 * @csspart toggle - The disclosure button.
 * @csspart detail - The expanded detail.
 * @fires mm-toggle - {{ expanded: boolean }} The record was expanded or collapsed by the person.
 * @fires mm-open-in-editor - {AuditQueryDetail} "Open in editor" was activated.
 * @fires mm-run-again - {AuditQueryDetail} "Run again" was activated.
 */
export class MmAuditRow extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
      }
      .row {
        position: relative;
        display: grid;
        grid-template-columns: var(--mm-audit-columns);
        align-items: center;
        min-block-size: var(--row-compact);
        border-block-end: 1px solid var(--mm-rule);
        font: var(--text-dense);
        color: var(--mm-text);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host(:last-child:not([expanded])) .row {
        border-block-end: 0;
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      :host([expanded]) .row {
        background: var(--mm-sunken);
      }
      :host([selected]) .row {
        background: var(--mm-selected);
        --mm-text-3: var(--mm-text-2);
      }
      .row:has(.toggle:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        z-index: 1;
      }
      .td {
        min-width: 0;
        padding-inline: var(--space-3);
        padding-block: var(--space-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .td:first-child {
        padding-inline: var(--space-2) 0;
        overflow: visible;
      }
      .toggle {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-sm);
        color: var(--mm-text-2);
        cursor: pointer;
      }
      .toggle::after {
        content: '';
        position: absolute;
        inset: 0;
      }
      .toggle:focus-visible {
        outline: none;
      }
      .chev {
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host(:dir(rtl)) .chev {
        transform: scaleX(-1);
      }
      :host([expanded]) .chev {
        transform: rotate(90deg);
      }
      /* Mono only for what people copy: the statement, query IDs, service accounts and MRNs. */
      .mono {
        font: var(--text-mono-dense);
      }
      .muted {
        color: var(--mm-text-2);
      }
      .tnum {
        font-variant-numeric: tabular-nums;
      }
      .client {
        color: var(--mm-text-2);
      }
      .source {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .source span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .num {
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .trunc {
        display: block;
        font: var(--text-caption);
        font-weight: 600;
        color: var(--mm-warning-text);
      }
      .none {
        color: var(--mm-text-3);
      }
      mm-owner-chip {
        max-inline-size: 100%;
      }
      /* Detail */
      .detail {
        border-block-end: 1px solid var(--mm-rule);
        background: var(--mm-sunken);
      }
      :host(:last-child) .detail {
        border-block-end: 0;
      }
      .cell {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
        /* The statement sizes to its lines rather than stretching to the facts beside it. */
        align-items: start;
        gap: var(--space-4) var(--space-6);
        padding: var(--space-3) var(--space-4) var(--space-4);
        padding-inline-start: calc(2.25rem + var(--space-3));
        font: var(--text-dense);
      }
      .code {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        min-width: 0;
        background: var(--mm-code-bg);
        color: var(--mm-code-text);
        border-radius: var(--radius-md);
        /* The same edge as mm-code-sample, so the block stands off the sunken detail on Peat too. */
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--mm-code-text) 12%, var(--mm-code-bg));
      }
      .code pre {
        margin: 0;
        padding: 14px 16px;
        overflow: auto;
        max-block-size: 18rem;
        font: var(--text-mono-editor);
        letter-spacing: var(--tracking-mono-editor, 0);
        white-space: pre;
        tab-size: 2;
        border-radius: inherit;
      }
      .code code {
        font: inherit;
      }
      /* Token colours shared with mm-code-sample's highlighter. */
      .code .k {
        color: var(--mm-syn-keyword);
      }
      .code .f {
        color: var(--mm-syn-function);
      }
      .code .s {
        color: var(--mm-syn-string);
      }
      .code .n {
        color: var(--mm-syn-number);
      }
      .code .c {
        color: var(--mm-syn-comment);
        font-style: italic;
      }
      .code mm-copy-button {
        margin-block-start: var(--space-2);
        margin-inline-end: var(--space-2);
      }
      .decision {
        display: flex;
        gap: var(--space-2);
        align-items: flex-start;
        margin: 0 0 var(--space-3);
        color: var(--mm-text);
      }
      .decision mm-icon {
        margin-block-start: 2px;
      }
      .decision.denied mm-icon,
      .decision.failed mm-icon {
        color: var(--mm-danger);
      }
      .decision.allowed mm-icon {
        color: var(--mm-success);
      }
      dl {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-1) var(--space-4);
        margin: 0;
      }
      dt {
        font: var(--text-label);
        color: var(--mm-text-2);
      }
      dd {
        margin: 0;
        min-width: 0;
      }
      dd.mono {
        overflow-wrap: anywhere;
      }
      .tables {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 2px;
      }
      .tables li {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
      }
      .tables .mono {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .actions {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      /* The table scrolls sideways when narrow, so the detail follows the log's visible width (its
         scroll container), not the 66rem table or the viewport: one column, pinned to the visible area. */
      @container mm-audit (max-width: 720px) {
        .cell {
          position: sticky;
          inset-inline-start: 0;
          inline-size: 100cqi;
          grid-template-columns: minmax(0, 1fr);
          padding-inline-start: var(--space-4);
        }
      }
    `,
  ];

  /** When the query ran, as an ISO timestamp. Shown in UTC. */
  @property({ reflect: true }) accessor time = '';
  /** Who ran it: a person's name or an agent's identifier. */
  @property() accessor actor = '';
  /** `person` (default) or `agent`. */
  @property({ attribute: 'actor-kind' }) accessor actorKind: AvatarKind = 'person';
  /** For agents: the service account it runs as, such as `svc-support`. */
  @property({ attribute: 'service-account' }) accessor serviceAccount = '';
  /** `api`, `cli`, `mcp` or `editor`. */
  @property() accessor client: AuditClient = 'editor';
  /** The source's name, such as `postgres-shop`. */
  @property() accessor source = '';
  /** The source's provider key for its logo, such as `postgresql`. */
  @property() accessor provider = '';
  /** The full SQL statement, shown when the record is expanded. */
  @property() accessor query = '';
  /** Rows returned. Leave unset when the query did not run. */
  @property({ type: Number }) accessor rows: number | undefined;
  /** The result was cut off at the row limit. */
  @property({ type: Boolean }) accessor truncated = false;
  /** `allowed`, `denied` or `failed`. Only `denied` and `failed` show a pill; `allowed` is the default and is not badged. */
  @property({ reflect: true }) accessor outcome: AuditOutcome = 'allowed';
  /** The decision or error in a sentence: "Denied because svc-support has no grant on shop.public.customers". */
  @property() accessor reason = '';
  /** Run time in milliseconds. */
  @property({ type: Number }) accessor duration: number | undefined;
  /** MRNs of the tables read. As an attribute, separate them with commas or spaces. */
  @property({ converter: { fromAttribute: toList, toAttribute: (v: string[]) => v.join(',') } }) accessor tables: string[] = [];
  /** The query's ID, shown in the detail with a copy button. */
  @property({ attribute: 'query-id' }) accessor queryId = '';
  /** Shows the detail. */
  @property({ type: Boolean, reflect: true }) accessor expanded = false;
  /** Marks the record as the current one: `mm-selected`. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;
  /** Whether this row is the log's tab stop. Managed by `mm-audit-log`. */
  @property({ type: Boolean, attribute: false }) accessor tabStop = true;

  @query('.toggle') accessor #toggle!: HTMLButtonElement | null;
  #id = uid('mm-audit');

  constructor() {
    super();
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.expanded) {
        e.preventDefault();
        e.stopPropagation();
        this.#set(false);
        this.focus();
      }
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'rowgroup');
  }

  override focus(options?: FocusOptions): void {
    this.#toggle?.focus(options);
  }

  #set(open: boolean) {
    if (this.expanded === open) return;
    this.expanded = open;
    emit(this, 'mm-toggle', { expanded: open });
  }

  #detail(): AuditQueryDetail {
    return { query: this.query, source: this.source, queryId: this.queryId };
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('tables') && typeof this.tables === 'string') this.tables = toList(this.tables as unknown as string);
  }

  #renderDetail(stamp: string) {
    const outcomeIcon = this.outcome === 'allowed' ? 'check-circle' : this.outcome === 'denied' ? 'block' : 'error';
    const clientWord = CLIENTS[this.client] ?? this.client;
    return html`<div class="detail" role="row" part="detail" id=${`${this.#id}-d`}>
      <div class="cell" role="cell" aria-colspan="7">
        <div class="code" dir="ltr" translate="no">
          <pre role="group" aria-label=${tr('auditStatement', 'Statement')} tabindex="0"><code>${renderTokens(tokenize(this.query, 'sql'))}</code></pre>
          <mm-copy-button tone="code" size="sm" value=${this.query} label=${tr('auditCopyStatement', 'Copy statement')}></mm-copy-button>
        </div>
        <div>
          ${this.reason
            ? html`<p class=${`decision ${this.outcome}`}><mm-icon name=${outcomeIcon}></mm-icon><span>${this.reason}</span></p>`
            : nothing}
          <dl>
            <dt>${tr('auditRan', 'Ran at')}</dt>
            <dd class="tnum">${stamp}</dd>
            ${this.duration !== undefined
              ? html`<dt>${tr('auditDuration', 'Duration')}</dt>
                  <dd class="tnum">${formatDuration(this.duration)}</dd>`
              : nothing}
            <dt>${tr('auditColClient', 'Client')}</dt>
            <dd>${clientWord}</dd>
            ${this.actorKind === 'agent' && this.serviceAccount
              ? html`<dt>${tr('runsAs', 'Runs as')}</dt>
                  <dd class="mono">${this.serviceAccount}</dd>`
              : nothing}
            ${this.queryId
              ? html`<dt>${tr('auditQueryId', 'Query ID')}</dt>
                  <dd class="mono">${this.queryId}</dd>`
              : nothing}
            ${this.tables.length
              ? html`<dt>${tr('auditTablesRead', 'Tables read')}</dt>
                  <dd>
                    <ul class="tables">
                      ${this.tables.map(
                        (mrn) =>
                          html`<li>
                            <span class="mono">${mrn}</span
                            ><mm-copy-button size="sm" value=${mrn} label=${tr('copyMrnNamed', 'Copy MRN {mrn}', { mrn })}></mm-copy-button>
                          </li>`,
                      )}
                    </ul>
                  </dd>`
              : nothing}
          </dl>
        </div>
        <div class="actions">
          <mm-button size="sm" variant="secondary" icon="code" @click=${() => emit(this, 'mm-open-in-editor', this.#detail())}
            >${tr('auditOpenInEditor', 'Open in editor')}</mm-button
          >
          <mm-button size="sm" variant="ghost" icon="refresh" @click=${() => emit(this, 'mm-run-again', this.#detail())}
            >${tr('auditRunAgain', 'Run again')}</mm-button
          >
          <slot name="actions"></slot>
        </div>
      </div>
    </div>`;
  }

  override render() {
    const d = parseTime(this.time);
    const stamp = d ? formatTimestamp(d) : '';
    const clientWord = CLIENTS[this.client] ?? this.client;
    return html`<div class="row" part="row" role="row">
        <div class="td" role="cell">
          <button
            part="toggle"
            class="toggle"
            type="button"
            data-audit-toggle
            tabindex=${this.tabStop ? 0 : -1}
            aria-expanded=${this.expanded ? 'true' : 'false'}
            aria-controls=${ifDefined(this.expanded ? `${this.#id}-d` : undefined)}
            aria-label=${tr('auditDetailsFor', 'Details for the query at {time}', { time: stamp })}
            @click=${() => this.#set(!this.expanded)}
          >
            <mm-icon class="chev" name="chevron-right"></mm-icon>
          </button>
        </div>
        <div class="td tnum muted" role="cell">${d ? html`<time datetime=${d.toISOString()}>${stamp.replace(/\s?UTC$/, '')}</time>` : nothing}</div>
        <div class="td" role="cell">
          <mm-owner-chip name=${this.actor} kind=${this.actorKind} service-account=${this.serviceAccount || nothing}></mm-owner-chip>
        </div>
        <div class="td" role="cell"><span class="client">${clientWord}</span></div>
        <div class="td" role="cell">
          <span class="source"
            >${this.provider ? html`<mm-provider-logo provider=${this.provider} size="16" decorative></mm-provider-logo>` : nothing}<span
              >${this.source}</span
            ></span
          >
        </div>
        <div class="td num" role="cell">
          ${this.rows === undefined || this.rows === null
            ? html`<span class="none">${tr('auditNotRun', 'Not run')}</span>`
            : html`<span>${formatCount(this.rows)}</span>${this.truncated
                  ? html`<span class="trunc">${tr('truncated', 'Truncated')}</span>`
                  : nothing}`}
        </div>
        <div class="td" role="cell">
          ${isHappyPath(this.outcome)
            ? html`<span class="visually-hidden">${STATUS_STATES[this.outcome as StatusState]?.word() ?? this.outcome}</span>`
            : html`<mm-status-pill state=${this.outcome}></mm-status-pill>`}
        </div>
      </div>
      ${this.expanded ? this.#renderDetail(stamp) : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-audit-log': MmAuditLog;
    'mm-audit-row': MmAuditRow;
  }
}
