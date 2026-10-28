import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { Virtualizer, defaultRangeExtractor, elementScroll, observeElementOffset, observeElementRect, type Range } from '@tanstack/virtual-core';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import { formatCount, formatDuration } from '../../core/format.js';
import { isModKey } from '../../core/platform.js';
import { isRtl } from '../../core/roving.js';
import { openedFromKeyboard } from '../../core/floating.js';
import { cellFromPath, clamp, csvField, downloadText, plain, tsvField, writeClipboard } from '../data-table/shared.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../copy-button/define.js';
import '../segmented-control/define.js';

/** A result column: its name and database type (`int8`, `varchar`, `timestamptz`, `jsonb`). */
export interface ResultColumn {
  name: string;
  type?: string;
}

export interface ResultsGridExportDetail {
  format: 'csv' | 'json';
}
export interface ResultsGridCopyDetail {
  value: string;
  rows: number;
  columns: number;
}
export interface ResultsGridColumnResizeDetail {
  index: number;
  name: string;
  width: number;
}
export interface ResultsGridInspectDetail {
  row: number;
  column: number;
  value: unknown;
}

const ROW_H = 28;
const HEAD_H = 46;
const MIN_W = 56;
const MAX_W = 1200;
/** Strings longer than this are cut before rendering; the inspector shows the full value. */
const RENDER_CHARS = 400;

const NUMERIC = /^(int|integer|bigint|smallint|tinyint|serial|bigserial|numeric|decimal|float|double|real|money|number|uint|hugeint)/i;
const JSONISH = /^(json|jsonb|variant|object|struct|map|array|record)/i;

type Cell = { r: number; c: number };

function defaultWidth(type = ''): number {
  if (/^bool/i.test(type)) return 88;
  if (/^(int2|int4|smallint|integer|int)$/i.test(type)) return 104;
  if (NUMERIC.test(type)) return 128;
  if (/^(timestamp|timestamptz|datetime)/i.test(type)) return 216;
  if (/^(uuid)/i.test(type)) return 300;
  if (JSONISH.test(type)) return 280;
  return 168;
}

/** Display text and kind for a value. NULL is a word, booleans are true/false, objects are JSON. */
function show(v: unknown): { text: string; kind: 'null' | 'num' | 'bool' | 'text' } {
  if (v === null || v === undefined) return { text: 'NULL', kind: 'null' };
  if (typeof v === 'boolean') return { text: v ? 'true' : 'false', kind: 'bool' };
  if (typeof v === 'number' || typeof v === 'bigint') return { text: String(v), kind: 'num' };
  if (v instanceof Date) return { text: v.toISOString(), kind: 'text' };
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return { text: s.length > RENDER_CHARS ? `${s.slice(0, RENDER_CHARS)}…` : s, kind: 'text' };
}

/** Pretty-prints JSON values and JSON strings; everything else as plain text. */
function pretty(v: unknown, type = ''): { text: string; json: boolean } {
  if (v === null || v === undefined) return { text: 'NULL', json: false };
  if (typeof v === 'object' && !(v instanceof Date)) return { text: JSON.stringify(v, null, 2), json: true };
  if (typeof v === 'string' && (JSONISH.test(type) || /^\s*[[{]/.test(v))) {
    try {
      return { text: JSON.stringify(JSON.parse(v), null, 2), json: true };
    } catch {
      /* not JSON */
    }
  }
  return { text: plain(v), json: false };
}

/**
 * The results grid shows SQL output: often hundreds of columns and up to a million rows,
 * virtualised in both directions with fixed-size cells. Every cell is mono (`text-mono-dense`),
 * numbers are right-aligned and tabular, NULL is the word "NULL" in `mm-text-3`, booleans read
 * `true` and `false`, and long strings end in an ellipsis. The row number gutter and the header,
 * which gives each column's name and type on two lines, stay put while you scroll.
 *
 * Select a cell, or a range with Shift and the arrow keys (or Shift+click, or a drag), and
 * Ctrl+C (⌘C) copies it as tab-separated values that paste into a spreadsheet. Enter or a
 * double-click opens the cell inspector with the full value, JSON pretty-printed, and a copy
 * button; Escape closes it. The status line states rows, columns and run time, and a truncated
 * result is marked with a warning icon and the word. A Table, CSV and JSON switch in the footer
 * shows the same result as text, with Copy and Download beside it; the text is built in the
 * browser, and cancelling `mm-export` skips the client-side download so the server can export.
 *
 * Give `rows` as an array of arrays, or stream with `getRow(i)` and `rowCount`, calling
 * `refresh()` as rows arrive.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/grid/): one tab stop. Arrow keys move,
 * Home and End go to the row's first and last column, Ctrl+Home and Ctrl+End to the first and
 * last cell, Page Up and Page Down move a screen. Shift with any of these extends the selection.
 * On a header, Enter or F2 moves to the resize handle, where Left and Right resize and Escape
 * returns.
 *
 * @tagname mm-results-grid
 * @summary SQL results, virtualised in both directions.
 * @slot actions - Extra footer actions beside the view switch.
 * @csspart base - The bordered surface.
 * @csspart scroller - The scroll container.
 * @csspart grid - The element with `role="grid"`.
 * @csspart status - The status line.
 * @csspart inspector - The cell inspector panel.
 * @cssprop --mm-results-grid-height - Height of the scrolling area. Defaults to 420px.
 * @fires mm-export - {ResultsGridExportDetail} Download was activated in the CSV or JSON view. Cancelable: cancel it to skip the client-side download.
 * @fires mm-view-change - {{ view: 'table' | 'csv' | 'json' }} The view switch changed.
 * @fires mm-copy - {ResultsGridCopyDetail} The selection was copied as TSV.
 * @fires mm-column-resize - {ResultsGridColumnResizeDetail} A column was resized.
 * @fires mm-inspect - {ResultsGridInspectDetail} The cell inspector opened.
 */
export class MmResultsGrid extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-inline-size: 0;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
        overflow: hidden;
        block-size: 100%;
      }
      .text {
        margin: 0;
        block-size: var(--mm-results-grid-height, 420px);
        overflow: auto;
        padding: var(--space-3) var(--space-4);
        font: var(--text-mono);
        color: var(--mm-text);
        white-space: pre;
        tab-size: 2;
      }
      .area {
        position: relative;
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
      }
      .scroller {
        position: relative;
        flex: 1 1 auto;
        min-inline-size: 0;
        block-size: var(--mm-results-grid-height, 420px);
        overflow: auto;
        overscroll-behavior: contain;
        scroll-padding-block-start: ${HEAD_H}px;
        scroll-padding-inline-start: var(--_gw);
        font: var(--text-mono-dense);
        font-variant-numeric: tabular-nums;
      }
      .grid {
        position: relative;
      }
      .head {
        position: sticky;
        inset-block-start: 0;
        z-index: 3;
        block-size: ${HEAD_H}px;
        background: var(--mm-sunken);
        border-block-end: 1px solid var(--mm-rule);
      }
      .hrow,
      .row {
        position: relative;
        block-size: 100%;
      }
      .rows {
        position: relative;
      }
      .row {
        position: absolute;
        inset-inline-start: 0;
        block-size: ${ROW_H}px;
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      .cell,
      .hcell {
        position: absolute;
        inset-block: 0;
        display: flex;
        align-items: center;
        padding-inline: var(--space-2);
        border-inline-end: 1px solid var(--mm-rule);
        border-block-end: 1px solid var(--mm-rule);
        overflow: hidden;
        white-space: nowrap;
        cursor: cell;
      }
      .cell:focus-visible,
      .hcell:focus-visible {
        outline-offset: -2px;
      }
      .cell .v {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cell.num {
        justify-content: flex-end;
      }
      .cell.null .v {
        color: var(--mm-text-3);
      }
      .cell[aria-selected='true'] {
        background: var(--mm-selected);
        --mm-text-3: var(--mm-text-2);
      }
      .cell.active {
        box-shadow: inset 0 0 0 1px var(--mm-text);
      }
      .bone {
        display: block;
        inline-size: 60%;
        block-size: 8px;
        border-radius: var(--radius-sm);
        background: var(--mm-sunken);
      }
      .cell.num .bone {
        inline-size: 40%;
      }
      .hcell {
        flex-direction: column;
        align-items: stretch;
        justify-content: center;
        gap: 0;
        cursor: default;
        user-select: none;
      }
      .hcell.num {
        text-align: end;
      }
      .hcell .name {
        font-weight: 600;
        color: var(--mm-text);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hcell .type {
        color: var(--mm-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .gutter {
        position: sticky;
        inset-inline-start: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        block-size: 100%;
        inline-size: var(--_gw);
        padding-inline: var(--space-2);
        background: var(--mm-sunken);
        color: var(--mm-text-2);
        border-inline-end: 1px solid var(--mm-rule);
        border-block-end: 1px solid var(--mm-rule);
      }
      .row.in-range .gutter {
        color: var(--mm-text);
        font-weight: 600;
      }
      .resize {
        position: absolute;
        inset-block: 0;
        inset-inline-end: 0;
        inline-size: 9px;
        cursor: col-resize;
        touch-action: none;
        z-index: 1;
      }
      .resize::after {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-end: 3px;
        inline-size: 2px;
        background: transparent;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .resize:hover::after,
      .resize:focus-visible::after,
      .resize.active::after {
        background: var(--mm-text);
      }
      .resize:focus-visible {
        outline-offset: -2px;
      }
      .footer {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-2) var(--space-3);
        border-block-start: 1px solid var(--mm-rule);
        min-block-size: var(--space-12);
      }
      .status {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        flex: 1 1 auto;
        min-inline-size: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
        margin: 0;
      }
      .sep {
        color: var(--mm-text-3);
      }
      .warn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--mm-warning-soft);
        color: var(--mm-warning-text);
        font-weight: 600;
      }
      .warn mm-icon {
        color: var(--mm-warning);
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        align-items: center;
      }
      .empty {
        position: sticky;
        inset-inline-start: 0;
        padding: var(--space-8) var(--space-4);
        font: var(--text-dense);
        color: var(--mm-text-2);
        text-align: center;
      }
      .inspector {
        position: absolute;
        inset-block: 0;
        inset-inline-end: 0;
        z-index: 5;
        inline-size: min(28rem, 85%);
        display: flex;
        flex-direction: column;
        background: var(--mm-raised);
        border-inline-start: 1px solid var(--mm-rule);
        box-shadow: var(--shadow-float);
        animation: in var(--mm-dur-menu) var(--mm-ease);
      }
      .inspector.instant {
        animation: none;
      }
      @keyframes in {
        from {
          opacity: 0;
        }
      }
      .inspector .grid-head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
        border-block-end: 1px solid var(--mm-rule);
      }
      .inspector h2 {
        flex: 1;
        min-inline-size: 0;
        margin: 0;
        font: var(--text-mono-dense);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .inspector .meta {
        display: block;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
        font-weight: 400;
      }
      .inspector .meta code {
        font: var(--text-mono-dense);
      }
      .inspector pre {
        flex: 1;
        margin: 0;
        padding: var(--space-3) var(--space-4);
        overflow: auto;
        font: var(--text-mono-dense);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--mm-text);
      }
      .inspector pre.null {
        color: var(--mm-text-2);
      }
      .inspector pre:focus-visible {
        outline-offset: -2px;
      }
      .inspector .grid-foot {
        display: flex;
        justify-content: flex-end;
        padding: var(--space-2) var(--space-3);
        border-block-start: 1px solid var(--mm-rule);
      }
      @media (prefers-reduced-motion: reduce) {
        .inspector {
          animation: none;
        }
      }
      @media (pointer: coarse) {
        .resize {
          inline-size: 24px;
        }
      }
    `,
  ];

  /** Result columns: `{ name, type }`. */
  @property({ attribute: false }) accessor columns: ResultColumn[] = [];
  /** Result rows as arrays, in column order. Ignored when `getRow` is set. */
  @property({ attribute: false }) accessor rows: readonly (readonly unknown[])[] = [];
  /** Streaming source: returns row `i`, or undefined while it is still loading. Needs `rowCount`. */
  @property({ attribute: false }) accessor getRow: ((i: number) => readonly unknown[] | undefined) | undefined;
  /** Row count when streaming with `getRow`. */
  @property({ type: Number, attribute: 'row-count' }) accessor rowCount: number | undefined;
  /** Query run time in milliseconds, for the status line. */
  @property({ type: Number }) accessor duration: number | undefined;
  /** The result was cut off at the row limit. */
  @property({ type: Boolean, reflect: true }) accessor truncated = false;
  /** Accessible name for the grid. Defaults to "Query results". */
  @property() accessor label = '';
  /** File name (without extension) for exports. */
  @property() accessor filename = 'results';
  /** Hides the CSV and JSON views. */
  @property({ type: Boolean, attribute: 'no-export' }) accessor noExport = false;
  /** Shows the result as a grid, or as CSV or JSON text. */
  @property({ reflect: true }) accessor view: 'table' | 'csv' | 'json' = 'table';

  @query('.scroller') accessor #scroller!: HTMLElement | null;

  #widths: number[] = [];
  #active: Cell = { r: 0, c: 0 };
  #anchor: Cell | null = null;
  #inspect: Cell | null = null;
  #inspectInstant = false;
  #resizing = -1;
  #dragSel = false;
  #rtl = false;
  #announce = '';
  #rowV?: Virtualizer<HTMLElement, HTMLElement>;
  #colV?: Virtualizer<HTMLElement, HTMLElement>;
  #unmount: (() => void)[] = [];

  constructor() {
    super();
    if (typeof window !== 'undefined') {
      this.#rowV = new Virtualizer<HTMLElement, HTMLElement>(this.#rowOpts());
      this.#colV = new Virtualizer<HTMLElement, HTMLElement>(this.#colOpts());
    }
  }

  get #count(): number {
    return this.getRow ? (this.rowCount ?? 0) : this.rows.length;
  }

  #row(i: number): readonly unknown[] | undefined {
    return this.getRow ? this.getRow(i) : this.rows[i];
  }

  /** Re-renders visible rows, e.g. after more streamed rows arrive. */
  refresh(): void {
    this.requestUpdate();
  }

  /** Moves focus to the active cell. */
  override focus(options?: FocusOptions): void {
    void this.#focusActive(options);
  }

  get #gutterW(): number {
    return Math.max(48, Math.ceil(String(this.#count).length * 7.5) + 24);
  }

  #rowOpts() {
    return {
      count: this.#count,
      getScrollElement: () => this.#scroller ?? null,
      estimateSize: () => ROW_H,
      overscan: 6,
      scrollMargin: HEAD_H,
      scrollPaddingStart: HEAD_H,
      initialRect: { width: 960, height: 420 },
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      rangeExtractor: (range: Range) => this.#keep(defaultRangeExtractor(range), this.#active.r - 1, range.count),
      onChange: () => this.requestUpdate(),
    };
  }

  #colOpts() {
    return {
      horizontal: true,
      isRtl: this.#rtl,
      count: this.columns.length,
      getScrollElement: () => this.#scroller ?? null,
      estimateSize: (i: number) => this.#widths[i] ?? 160,
      overscan: 3,
      scrollMargin: this.#gutterW,
      scrollPaddingStart: this.#gutterW,
      initialRect: { width: 960, height: 420 },
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      rangeExtractor: (range: Range) => this.#keep(defaultRangeExtractor(range), this.#active.c, range.count),
      onChange: () => this.requestUpdate(),
    };
  }

  /** Keeps the focused row or column rendered so focus survives scrolling. */
  #keep(out: number[], i: number, count: number): number[] {
    if (i >= 0 && i < count && !out.includes(i)) {
      out.push(i);
      out.sort((a, b) => a - b);
    }
    return out;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#mount();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unmount.forEach((u) => u());
    this.#unmount = [];
  }

  #mount() {
    this.#rtl = isRtl(this);
    this.#colV?.setOptions(this.#colOpts());
    for (const v of [this.#rowV, this.#colV]) {
      if (!v) continue;
      this.#unmount.push(v._didMount());
      v._willUpdate();
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns')) {
      this.#widths = this.columns.map((c) => defaultWidth(c.type));
      this.#colV?.measure();
      this.#inspect = null;
    }
    const maxR = this.#count;
    const maxC = Math.max(0, this.columns.length - 1);
    if (this.#active.r > maxR || this.#active.c > maxC) this.#active = { r: Math.min(this.#active.r, maxR), c: Math.min(this.#active.c, maxC) };
    this.#rowV?.setOptions(this.#rowOpts());
    this.#colV?.setOptions(this.#colOpts());
  }

  protected override firstUpdated(): void {
    this.#mount();
  }

  protected override updated(): void {
    this.#rowV?._willUpdate();
    this.#colV?._willUpdate();
  }

  // ---- Focus and selection ----

  #cellEl(r: number, c: number): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
  }

  async #focusActive(options?: FocusOptions) {
    await this.updateComplete;
    let el = this.#cellEl(this.#active.r, this.#active.c);
    if (!el) {
      if (this.#active.r > 0) this.#rowV?.scrollToIndex(this.#active.r - 1, { align: 'auto' });
      this.requestUpdate();
      await this.updateComplete;
      el = this.#cellEl(this.#active.r, this.#active.c);
    }
    if (!el) return;
    if (!options?.preventScroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.focus({ preventScroll: true });
  }

  #moveTo(r: number, c: number, extend: boolean) {
    const next = { r: clamp(r, 0, this.#count), c: clamp(c, 0, Math.max(0, this.columns.length - 1)) };
    if (extend && next.r > 0 && this.#active.r > 0) this.#anchor ??= { ...this.#active };
    else this.#anchor = null;
    this.#active = next;
    this.requestUpdate();
    void this.#focusActive();
  }

  /** The selected rectangle in data coordinates (rows 0-based), or null for the header. */
  #range(): { r1: number; r2: number; c1: number; c2: number } | null {
    const a = this.#active;
    if (a.r === 0) return null;
    const b = this.#anchor ?? a;
    return { r1: Math.min(a.r, b.r) - 1, r2: Math.max(a.r, b.r) - 1, c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) };
  }

  /** The current selection as tab-separated values. */
  selectionText(): string {
    const rg = this.#range();
    if (!rg) return this.columns[this.#active.c]?.name ?? '';
    const lines: string[] = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const row = this.#row(r);
      const cells: string[] = [];
      for (let c = rg.c1; c <= rg.c2; c++) cells.push(tsvField(row?.[c]));
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }

  async #copy() {
    const rg = this.#range();
    const value = this.selectionText();
    await writeClipboard(value);
    const rows = rg ? rg.r2 - rg.r1 + 1 : 0;
    const columns = rg ? rg.c2 - rg.c1 + 1 : 1;
    const cells = rows * columns;
    this.#announce = cells > 1 ? tr('copiedCells', 'Copied {count} cells', { count: formatCount(cells) }) : t('copied');
    this.requestUpdate();
    emit<ResultsGridCopyDetail>(this, 'mm-copy', { value, rows, columns });
  }

  // ---- Inspector ----

  /** Opens the cell inspector for a data cell (row and column 0-based). */
  inspect(row: number, column: number): void {
    if (row < 0 || row >= this.#count || column < 0 || column >= this.columns.length) return;
    this.#inspectInstant = openedFromKeyboard();
    this.#inspect = { r: row + 1, c: column };
    this.#active = { r: row + 1, c: column };
    this.requestUpdate();
    emit<ResultsGridInspectDetail>(this, 'mm-inspect', { row, column, value: this.#row(row)?.[column] });
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.inspector pre')?.focus());
  }

  /** Closes the inspector and returns focus to the cell. */
  closeInspector(): void {
    if (!this.#inspect) return;
    this.#inspect = null;
    this.requestUpdate();
    void this.#focusActive();
  }

  // ---- Export ----

  #text(format: 'csv' | 'json'): string {
    const n = this.#count;
    const names = this.columns.map((c) => c.name);
    if (format === 'csv') {
      const lines = [names.map(csvField).join(',')];
      for (let i = 0; i < n; i++) {
        const row = this.#row(i);
        if (row) lines.push(names.map((_, c) => csvField(row[c])).join(','));
      }
      return `${lines.join('\r\n')}\r\n`;
    }
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < n; i++) {
      const row = this.#row(i);
      if (!row) continue;
      const o: Record<string, unknown> = {};
      names.forEach((name, c) => (o[name] = row[c] ?? null));
      out.push(o);
    }
    return JSON.stringify(out, null, 2);
  }

  #download(format: 'csv' | 'json', text: string) {
    if (!emit<ResultsGridExportDetail>(this, 'mm-export', { format }, { cancelable: true })) return;
    downloadText(`${this.filename}.${format}`, text, format === 'csv' ? 'text/csv' : 'application/json');
  }

  // ---- Resize ----

  #setWidth(c: number, w: number): number {
    const width = Math.round(clamp(w, MIN_W, MAX_W));
    this.#widths[c] = width;
    this.#colV?.measure();
    this.requestUpdate();
    return width;
  }

  #emitResize(c: number, width: number) {
    emit<ResultsGridColumnResizeDetail>(this, 'mm-column-resize', { index: c, name: this.columns[c]?.name ?? '', width });
  }

  #onResizeDown(e: PointerEvent, c: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = this.#widths[c] ?? 160;
    const dir = this.#rtl ? -1 : 1;
    let width = startW;
    this.#resizing = c;
    const move = (ev: PointerEvent) => (width = this.#setWidth(c, startW + (ev.clientX - startX) * dir));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      this.#resizing = -1;
      this.requestUpdate();
      this.#emitResize(c, width);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  #onResizeKey(e: KeyboardEvent, c: number) {
    const step = e.shiftKey ? 50 : 10;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    if (this.#rtl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) delta = -delta;
    if (delta) {
      e.preventDefault();
      e.stopPropagation();
      this.#emitResize(c, this.#setWidth(c, (this.#widths[c] ?? 160) + delta));
    } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'F2' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.#moveTo(0, c, false);
    }
  }

  // ---- Events ----

  #onFocusIn(e: FocusEvent) {
    const cell = cellFromPath(e);
    if (!cell || e.composedPath()[0] !== cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (r !== this.#active.r || c !== this.#active.c) {
      this.#active = { r, c };
      this.requestUpdate();
    }
  }

  #onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const cell = cellFromPath(e);
    if (!cell || e.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('resize'))) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (e.shiftKey && r > 0 && this.#active.r > 0) {
      e.preventDefault();
      this.#anchor ??= { ...this.#active };
    } else {
      this.#anchor = null;
      this.#dragSel = r > 0;
    }
    this.#active = { r, c };
    this.requestUpdate();
    if (e.shiftKey) void this.#focusActive({ preventScroll: true });
  }

  #onPointerMove(e: PointerEvent) {
    if (!this.#dragSel || !(e.buttons & 1)) {
      this.#dragSel = false;
      return;
    }
    const cell = cellFromPath(e);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (r < 1 || (r === this.#active.r && c === this.#active.c)) return;
    this.#anchor ??= { ...this.#active };
    this.#active = { r, c };
    this.requestUpdate();
  }

  #onKeydown(e: KeyboardEvent) {
    const path = e.composedPath();
    const cell = cellFromPath(e);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    if (path.some((n) => n instanceof HTMLElement && n.classList.contains('resize'))) {
      this.#onResizeKey(e, c);
      return;
    }
    if (path[0] !== cell) return;
    const key = e.key;
    const rtl = this.#rtl;
    const mod = e.ctrlKey || e.metaKey;
    const lastC = this.columns.length - 1;
    const lastR = this.#count;
    const page = Math.max(1, Math.floor(((this.#scroller?.clientHeight ?? 420) - HEAD_H) / ROW_H) - 1);

    if (isModKey(e) && (key === 'c' || key === 'C')) {
      e.preventDefault();
      void this.#copy();
      return;
    }

    let next: Cell | null = null;
    switch (key) {
      case 'ArrowDown':
        next = { r: r + 1, c };
        break;
      case 'ArrowUp':
        next = { r: r - 1, c };
        break;
      case 'ArrowRight':
        next = { r, c: c + (rtl ? -1 : 1) };
        break;
      case 'ArrowLeft':
        next = { r, c: c + (rtl ? 1 : -1) };
        break;
      case 'Home':
        next = mod ? { r: e.shiftKey ? 1 : 0, c: 0 } : { r, c: 0 };
        break;
      case 'End':
        next = mod ? { r: lastR, c: lastC } : { r, c: lastC };
        break;
      case 'PageDown':
        next = { r: Math.min(lastR, Math.max(1, r) + page), c };
        break;
      case 'PageUp':
        next = { r: r <= 1 ? 0 : Math.max(1, r - page), c };
        break;
    }
    if (next) {
      e.preventDefault();
      if (e.shiftKey && next.r === 0) next.r = 1;
      this.#moveTo(next.r, next.c, e.shiftKey);
      return;
    }
    if (key === 'Escape' && this.#anchor) {
      e.preventDefault();
      this.#anchor = null;
      this.requestUpdate();
      return;
    }
    if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      if (r === 0) {
        const handle = cell.querySelector<HTMLElement>('.resize');
        handle?.focus();
      } else this.inspect(r - 1, c);
    }
  }

  #onInspectorKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeInspector();
    }
  }

  // ---- Rendering ----

  #renderInspector() {
    const at = this.#inspect;
    if (!at) return nothing;
    const col = this.columns[at.c];
    const value = this.#row(at.r - 1)?.[at.c];
    const { text, json } = pretty(value, col?.type);
    const isNull = value === null || value === undefined;
    return html`<section
      class="inspector ${this.#inspectInstant ? 'instant' : ''}"
      part="inspector"
      role="dialog"
      aria-labelledby="inspector-title"
      @keydown=${this.#onInspectorKey}
    >
      <div class="grid-head">
        <h2 id="inspector-title">
          ${col?.name}
          <span class="meta"
            >${tr('rowNumber', 'Row {n}', { n: formatCount(at.r) })}${col?.type ? html` · <code>${col.type}</code>` : nothing}${json
              ? html` · ${tr('jsonFormatted', 'JSON, formatted')}`
              : nothing}</span
          >
        </h2>
        <mm-button variant="ghost" size="sm" icon="close" label=${t('close')} @click=${() => this.closeInspector()}></mm-button>
      </div>
      <pre class=${isNull ? 'null' : ''} tabindex="0" aria-label=${tr('cellValue', 'Cell value')}>${text}</pre>
      <div class="grid-foot">
        <mm-copy-button size="sm" icon-only="false" label=${tr('copyValue', 'Copy value')} .value=${isNull ? '' : json ? text : plain(value)}></mm-copy-button>
      </div>
    </section>`;
  }

  #renderStatus() {
    const n = this.#count;
    const cols = this.columns.length;
    const parts: unknown[] = [
      n === 1 ? tr('resultRow', '1 row') : tr('resultRows', '{count} rows', { count: formatCount(n) }),
      cols === 1 ? tr('resultColumn', '1 column') : tr('resultColumns', '{count} columns', { count: formatCount(cols) }),
    ];
    if (this.duration !== undefined) parts.push(formatDuration(this.duration));
    return html`<p class="status" part="status">
      ${parts.map((p, i) => html`${i ? html`<span class="sep" aria-hidden="true">·</span>` : nothing}<span>${p}</span>`)}
      ${this.truncated
        ? html`<span class="sep" aria-hidden="true">·</span
            ><span class="warn"><mm-icon name="warning" size="14"></mm-icon>${tr('truncatedAt', 'Truncated at {count} rows', { count: formatCount(n) })}</span>`
        : nothing}
    </p>`;
  }

  override render() {
    const cols = this.columns;
    const n = this.#count;
    const gw = this.#gutterW;
    const rowItems = this.#rowV?.getVirtualItems() ?? [];
    const colItems = this.#colV?.getVirtualItems() ?? [];
    const totalW = gw + (this.#colV?.getTotalSize() ?? 0);
    const totalH = this.#rowV?.getTotalSize() ?? 0;
    const rg = this.#range();
    const multi = !!this.#anchor && !!rg && (rg.r1 !== rg.r2 || rg.c1 !== rg.c2);
    const a = this.#active;
    const numeric = cols.map((c) => NUMERIC.test(c.type ?? ''));
    const textView = this.view !== 'table' && !this.noExport ? this.view : null;
    const text = textView ? this.#text(textView) : '';
    return html`<div class="wrap" part="base">
      ${textView
        ? html`<pre class="text" part="text" tabindex="0" aria-label=${`${this.label || tr('queryResults', 'Query results')}, ${textView.toUpperCase()}`}>${text}</pre>`
        : nothing}
      <div class="area" ?hidden=${!!textView}>
        <div class="scroller" part="scroller" tabindex="-1" style="--_gw:${gw}px">
          <div
            class="grid"
            part="grid"
            role="grid"
            aria-label=${this.label || tr('queryResults', 'Query results')}
            aria-rowcount=${n + 1}
            aria-colcount=${cols.length + 1}
            aria-multiselectable="true"
            style="inline-size:${totalW}px;block-size:${HEAD_H + totalH}px"
            @keydown=${this.#onKeydown}
            @focusin=${this.#onFocusIn}
            @pointerdown=${this.#onPointerDown}
            @pointermove=${this.#onPointerMove}
            @dblclick=${(e: MouseEvent) => {
              const cell = cellFromPath(e);
              if (cell && Number(cell.dataset.r) > 0) this.inspect(Number(cell.dataset.r) - 1, Number(cell.dataset.c));
            }}
          >
            <div class="head" role="rowgroup">
              <div class="hrow" role="row" aria-rowindex="1">
                <div class="gutter" role="columnheader" aria-colindex="1"><span class="visually-hidden">${tr('rowNumberHeader', 'Row number')}</span></div>
                ${repeat(colItems, (ci) => ci.index, (ci) => {
                  const col = cols[ci.index]!;
                  const c = ci.index;
                  return html`<div
                    class="hcell ${numeric[c] ? 'num' : ''}"
                    role="columnheader"
                    aria-colindex=${c + 2}
                    data-r="0"
                    data-c=${c}
                    tabindex=${a.r === 0 && a.c === c ? 0 : -1}
                    style="inset-inline-start:${ci.start}px;inline-size:${ci.size}px"
                  >
                    <span class="name">${col.name}</span>
                    ${col.type ? html`<span class="type">${col.type}</span>` : nothing}
                    <div
                      class="resize ${this.#resizing === c ? 'active' : ''}"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label=${tr('resizeColumn', 'Resize {column} column', { column: col.name })}
                      aria-valuenow=${ci.size}
                      aria-valuemin=${MIN_W}
                      aria-valuemax=${MAX_W}
                      tabindex="-1"
                      @pointerdown=${(e: PointerEvent) => this.#onResizeDown(e, c)}
                    ></div>
                  </div>`;
                })}
              </div>
            </div>
            <div class="rows" role="rowgroup" style="block-size:${totalH}px">
              ${repeat(rowItems, (ri) => ri.index, (ri) => {
                const i = ri.index;
                const row = this.#row(i);
                const r = i + 1;
                const rowInRange = !!rg && i >= rg.r1 && i <= rg.r2;
                return html`<div
                  class="row ${rowInRange && multi ? 'in-range' : ''}"
                  role="row"
                  aria-rowindex=${r + 1}
                  style="inset-block-start:${ri.start - HEAD_H}px;inline-size:${totalW}px"
                >
                  <div class="gutter" role="rowheader" aria-colindex="1">${formatCount(r)}</div>
                  ${repeat(colItems, (ci) => ci.index, (ci) => {
                    const c = ci.index;
                    const v = row?.[c];
                    const sel = multi && rowInRange && c >= rg!.c1 && c <= rg!.c2;
                    const isActive = a.r === r && a.c === c;
                    if (!row) {
                      return html`<div
                        class="cell ${numeric[c] ? 'num' : ''}"
                        role="gridcell"
                        aria-colindex=${c + 2}
                        aria-busy="true"
                        data-r=${r}
                        data-c=${c}
                        tabindex=${isActive ? 0 : -1}
                        style="inset-inline-start:${ci.start}px;inline-size:${ci.size}px"
                      ><span class="bone"></span></div>`;
                    }
                    const s = show(v);
                    const num = s.kind === 'num' || (numeric[c] && s.kind !== 'null');
                    return html`<div
                      class="cell ${num ? 'num' : ''} ${s.kind === 'null' ? 'null' : ''} ${isActive && multi ? 'active' : ''}"
                      role="gridcell"
                      aria-colindex=${c + 2}
                      aria-selected=${sel || isActive ? 'true' : 'false'}
                      data-r=${r}
                      data-c=${c}
                      tabindex=${isActive ? 0 : -1}
                      style="inset-inline-start:${ci.start}px;inline-size:${ci.size}px"
                    ><span class="v">${s.text}</span></div>`;
                  })}
                </div>`;
              })}
            </div>
          </div>
          ${n === 0 && cols.length ? html`<p class="empty">${tr('noRowsReturned', 'The query ran and returned no rows.')}</p>` : nothing}
        </div>
        ${this.#renderInspector()}
      </div>
      <div class="footer">
        ${this.#renderStatus()}
        <div class="actions">
          <slot name="actions"></slot>
          ${textView
            ? html`<mm-copy-button size="sm" value=${text} label=${tr('copyResults', 'Copy {format}', { format: textView.toUpperCase() })}></mm-copy-button>
                <mm-button size="sm" variant="secondary" icon="download" @click=${() => this.#download(textView, text)}>${tr('download', 'Download')}</mm-button>`
            : nothing}
          ${this.noExport
            ? nothing
            : html`<mm-segmented-control
                label=${tr('resultsView', 'Results view')}
                hide-label
                value=${this.view}
                @mm-change=${(e: CustomEvent<{ value: 'table' | 'csv' | 'json' }>) => {
                  e.stopPropagation();
                  this.view = e.detail.value;
                  emit(this, 'mm-view-change', { view: this.view });
                }}
              >
                <mm-segment value="table">${tr('viewTable', 'Table')}</mm-segment>
                <mm-segment value="csv">CSV</mm-segment>
                <mm-segment value="json">JSON</mm-segment>
              </mm-segmented-control>`}
        </div>
      </div>
      <span class="visually-hidden" role="status">${this.#announce}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-results-grid': MmResultsGrid;
  }
}
