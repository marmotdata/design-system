import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';
import { Virtualizer, defaultRangeExtractor, elementScroll, observeElementOffset, observeElementRect, type Range } from '@tanstack/virtual-core';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import { formatCount, formatRelative, formatTimestamp } from '../../core/format.js';
import { isModKey } from '../../core/platform.js';
import { isRtl } from '../../core/roving.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { STATUS_STATES, isHappyPath, type StatusState } from '../status-pill/class.js';
import { cellContentStyles, cellFromPath, clamp, focusablesIn, readPx, setCellContentTabbable } from './shared.js';
import '@marmotdata/icons/define.js';
import '../checkbox/define.js';
import '../button/define.js';
import '../status-pill/define.js';
import '../empty-state/define.js';

export type DataTableColumnType = 'text' | 'number' | 'mono' | 'date' | 'status' | 'custom';
export type DataTableSortDirection = 'ascending' | 'descending';

/** One column. `render`, `value`, `href` and `compare` receive the row object. */
export interface DataTableColumn<R = any> {
  /** Field read from each row, and the column's identity for sorting, resizing and reordering. */
  key: string;
  /** Sentence-case header label. Put units in `unit`, not in the label. */
  header: string;
  /** Cell style: `text` (default), `number` (right-aligned, tabular, formatted), `mono` (types and IDs only), `date` (relative time, text face), `status` (an `mm-status-pill` state; no pill for `succeeded` or `allowed`) or `custom` (use `render`). */
  type?: DataTableColumnType;
  /** Unit shown in the header, e.g. `MB` gives "Size (MB)". */
  unit?: string;
  /**
   * Preferred width in px. Columns share the table's width in proportion to their preferred widths
   * (160 for a column without one) and never shrink below `minWidth`; the table scrolls sideways only
   * when the minimums do not fit. A width set by resizing is kept exactly.
   */
  width?: number;
  /** Smallest width in px, for layout and resizing. Default 120 (64 for numbers). */
  minWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  /** Overrides the type's alignment. */
  align?: 'start' | 'end' | 'center';
  /** Custom cell content (any Lit template). */
  render?(row: R): unknown;
  /** The value used for display and sorting, if not `row[key]`. */
  value?(row: R): unknown;
  /** Makes the cell a link to this URL: the row link that Enter activates. */
  href?(row: R): string | undefined;
  /** Custom sort comparison (ascending). */
  compare?(a: R, b: R): number;
  /**
   * Text shown in `mm-text-3` when the cell's value is `null`, `undefined` or an empty string, e.g.
   * `'Never'` for a "Last used" date or `'None'` for owners. Applies before `render`, so a custom
   * cell only renders for rows that have a value. Without it, empty cells stay blank.
   */
  empty?: string;
}

export interface DataTableSort {
  key: string;
  direction: DataTableSortDirection;
}

export interface DataTableSortChangeDetail {
  key: string;
  direction: DataTableSortDirection | null;
}
export interface DataTableSelectionChangeDetail {
  selected: unknown[];
  rows: object[];
}
export interface DataTableRowActivateDetail {
  row: object;
  index: number;
}
export interface DataTableColumnResizeDetail {
  key: string;
  width: number;
}
export interface DataTableColumnReorderDetail {
  key: string;
  from: number;
  to: number;
  order: string[];
}

const SELECT_W = 44;
const DEFAULT_MIN = 120;
const NUMBER_MIN = 64;
const MAX_W = 1200;
/** Share weight of a column with no preferred width, in the same units as `width`. */
const FLEX_W = 160;

type Cell = { r: number; c: number };

/**
 * Data tables are the default way to show many records: schemas, members, audit logs, assets.
 * The header band is `mm-sunken` with 12px sentence-case `mm-text-2` labels and stays put while
 * you scroll. Rows are separated by hairlines, never zebra stripes; hover uses `mm-sunken` and
 * selected rows `mm-selected`, where tertiary text steps up to `mm-text-2`. Numbers are
 * right-aligned and tabular with units in the header; dates are relative, in the text face with
 * tabular figures; only types and IDs use mono cells. Links in cells are ink, underlined on hover
 * and focus. Status cells show a pill only when something needs attention: `succeeded` and
 * `allowed` are a plain quiet word. Rows follow
 * `--mm-row` (40px, or 36px under `data-density="compact"` or `density="compact"`): reduce row
 * height, never font size.
 *
 * Rows are virtualised, so 100,000 records scroll smoothly while the markup stays an ARIA grid
 * with `aria-rowcount`, `aria-rowindex`, `aria-colcount` and `aria-colindex`.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/grid/): the grid is one tab stop. Arrow keys
 * move between cells, Home and End go to the start and end of the row, Ctrl+Home and Ctrl+End to
 * the first and last cell, Page Up and Page Down move a screen at a time. On a header, Enter or
 * Space sorts, Alt+Shift+Left and Right move the column (`reorderable`), and F2 moves to the
 * resize handle, where Left and Right resize (Shift for bigger steps) and Escape returns. In the
 * body, Space toggles the row's selection (Shift+Space selects the range from the last toggled
 * row, as Shift+click does), Enter follows the row link or fires `mm-row-activate`, and on a
 * cell with buttons or links Enter (or F2) moves into it, Tab cycles its controls and Escape
 * returns to the cell. Ctrl+A (⌘A) selects every row.
 *
 * Cells render inside the table's shadow root, so page stylesheets do not reach templates from a
 * column's `render`. Prefer elements (`mm-link`, `mm-text`, `mm-tag`, `mm-status-pill`), which
 * carry their own styles. The table also styles this set of classes inside cells, matching
 * `@marmotdata/css`: `mm-link` (ink in cells, underlined on hover and focus), `mm-code-inline` and
 * `code`, `mm-kbd`, `mm-dense`, `mm-label`, `mm-caption`, plus two cell helpers: `mm-mono` (mono
 * dense, for IDs and keys only) and `mm-muted` (`mm-text-3`, which steps up to `mm-text-2` in a selected
 * row). Number columns align their header with their values.
 *
 * @tagname mm-data-table
 * @summary Many records in a sortable, selectable, virtualised grid.
 * @slot empty - Shown when there are no rows. Defaults to an `mm-empty-state` built from `empty-heading` and `empty-text`.
 * @slot error-actions - Replaces the default retry button in the error state.
 * @csspart base - The bordered surface.
 * @csspart scroller - The scroll container.
 * @csspart grid - The element with `role="grid"`.
 * @csspart header - The header row.
 * @csspart row - Each body row.
 * @csspart cell - Each body cell.
 * @cssprop --mm-data-table-max-height - Height at which the table scrolls. Defaults to 560px. To fill a fixed-height container, give the element a height and set this to `none`.
 * @fires mm-sort-change - {DataTableSortChangeDetail} A sortable header was activated. `direction` is null when sorting was cleared.
 * @fires mm-selection-change - {DataTableSelectionChangeDetail} Rows were selected or deselected.
 * @fires mm-row-activate - {DataTableRowActivateDetail} A row was clicked or Enter was pressed on it.
 * @fires mm-column-resize - {DataTableColumnResizeDetail} A column was resized by pointer or keyboard.
 * @fires mm-column-reorder - {DataTableColumnReorderDetail} A column was moved.
 * @fires mm-retry - {{}} The retry button in the error state was activated.
 */
export class MmDataTable extends LitElement {
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
      :host([density='compact']) {
        --mm-row: var(--row-compact);
      }
      :host([density='default']) {
        --mm-row: var(--row-default);
      }
      .wrap {
        position: relative;
        block-size: 100%;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .scroller {
        position: relative;
        flex: 1 1 auto;
        min-block-size: 0;
        max-block-size: var(--mm-data-table-max-height, 560px);
        overflow: auto;
        overscroll-behavior: contain;
        scroll-padding-block-start: var(--_head-h, 32px);
        scroll-padding-inline-start: var(--_sticky-w, 0px);
      }
      .grid {
        inline-size: max(100%, var(--_minw, 0px));
      }
      .row {
        display: grid;
        grid-template-columns: var(--_cols);
        background: var(--mm-surface);
      }
      .head {
        position: sticky;
        inset-block-start: 0;
        z-index: 2;
      }
      .head .row {
        background: var(--mm-sunken);
        border-block-end: 1px solid var(--mm-rule);
      }
      .body {
        position: relative;
      }
      .body .row {
        position: absolute;
        inset-inline: 0;
        block-size: var(--mm-row, var(--row-default));
        border-block-end: 1px solid var(--mm-rule);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .body .row:hover {
        background: var(--mm-sunken);
      }
      .body .row[aria-selected='true'] {
        background: var(--mm-selected);
        /* Peat contrast: tertiary text inside a selected row steps up to text-2. */
        --mm-text-3: var(--mm-text-2);
      }
      .body .row[aria-disabled='true'] {
        color: var(--mm-text-3);
        cursor: not-allowed;
      }
      .body .row.last {
        border-block-end-color: transparent;
      }
      .cell {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
        padding-inline: var(--space-3);
        overflow: hidden;
        background: inherit;
      }
      .cell:focus-visible {
        outline-offset: -2px;
      }
      .head .cell {
        block-size: var(--space-8);
        font: var(--text-label);
        color: var(--mm-text-2);
        white-space: nowrap;
        user-select: none;
      }
      .head .cell.sortable {
        cursor: pointer;
      }
      .head .cell.sortable:hover,
      .head .cell[aria-sort] {
        color: var(--mm-text);
      }
      .head .cell.end {
        /* row-reverse puts the sort icon before the label; flex-start then packs to the end edge. */
        flex-direction: row-reverse;
        justify-content: flex-start;
        text-align: end;
      }
      .head .cell.center {
        justify-content: center;
      }
      .head .label {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sort {
        flex: none;
        color: var(--mm-text-3);
      }
      .head .cell[aria-sort] .sort {
        color: var(--mm-text);
      }
      .head .cell.sortable:not([aria-sort]) .sort {
        opacity: 0;
        transition: opacity var(--mm-dur-press) var(--mm-ease);
      }
      .head .cell.sortable:not([aria-sort]):hover .sort,
      .head .cell.sortable:not([aria-sort]):focus-visible .sort {
        opacity: 1;
      }
      .head .cell.dragging {
        opacity: 0.5;
      }
      .head .cell.drop-before::before,
      .head .cell.drop-after::after {
        content: '';
        position: absolute;
        inset-block: 4px;
        inline-size: 2px;
        background: var(--mm-text);
      }
      .head .cell.drop-before::before {
        inset-inline-start: 0;
      }
      .head .cell.drop-after::after {
        inset-inline-end: 0;
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
        inset-block: 8px;
        inset-inline-end: 4px;
        inline-size: 1px;
        background: var(--mm-rule);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .resize:hover::after,
      .resize:focus-visible::after,
      .resize.active::after {
        inset-block: 0;
        inline-size: 2px;
        inset-inline-end: 3px;
        background: var(--mm-text);
      }
      .resize:focus-visible {
        outline-offset: -2px;
      }
      .body .cell {
        block-size: 100%;
      }
      .text {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cell.end {
        justify-content: flex-end;
        text-align: end;
      }
      .cell.center {
        justify-content: center;
        text-align: center;
      }
      .number,
      .date {
        font-variant-numeric: tabular-nums;
      }
      .mono {
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
      }
      .row[aria-disabled='true'] .mono {
        color: var(--mm-text-3);
      }
      .happy {
        color: var(--mm-text-2);
      }
      .date {
        color: var(--mm-text-2);
      }
      .cell .empty {
        font: var(--text-dense);
        color: var(--mm-text-3);
      }
    `,
    cellContentStyles,
    css`
      .select {
        justify-content: center;
        padding-inline: 0;
        cursor: pointer;
      }
      .select mm-checkbox {
        pointer-events: none;
      }
      .sticky {
        position: sticky;
        z-index: 1;
      }
      .sticky.edge {
        box-shadow: inset -1px 0 0 var(--mm-rule);
      }
      :host(:dir(rtl)) .sticky.edge {
        box-shadow: inset 1px 0 0 var(--mm-rule);
      }
      /* Links in tables are ink, underlined on hover and focus. Burnt sienna is for links in prose. */
      a.link {
        color: var(--mm-text);
        text-decoration: none;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      a.link:hover,
      a.link:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .state {
        position: sticky;
        inset-inline-start: 0;
      }
      .state-error {
        display: grid;
        justify-items: center;
        gap: var(--space-3);
        padding: var(--space-8) var(--space-6);
        text-align: center;
      }
      .state-error mm-icon {
        color: var(--mm-danger);
      }
      .state-error h2 {
        margin: 0;
        font: var(--text-heading-sm);
      }
      .state-error p {
        margin: 0;
        color: var(--mm-text-2);
        max-inline-size: 60ch;
      }
      .skeleton {
        animation: breathe 1600ms var(--mm-ease) infinite alternate;
      }
      .skeleton .row {
        position: static;
        block-size: var(--mm-row, var(--row-default));
        border-block-end: 1px solid var(--mm-rule);
        align-items: center;
      }
      .bone {
        display: block;
        block-size: 10px;
        margin-inline: var(--space-3);
        border-radius: var(--radius-sm);
        background: var(--mm-sunken);
      }
      .bone.end {
        justify-self: end;
      }
      @keyframes breathe {
        to {
          opacity: 0.6;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton {
          animation: none;
        }
      }
      .probe {
        position: absolute;
        inline-size: 0;
        block-size: var(--mm-row, var(--row-default));
        visibility: hidden;
        pointer-events: none;
      }
      @media (pointer: coarse) {
        .resize {
          inline-size: 24px;
        }
      }
    `,
  ];

  /** Column definitions, in their initial order. */
  @property({ attribute: false }) accessor columns: DataTableColumn<any>[] = [];
  /** Row objects. */
  @property({ attribute: false }) accessor rows: readonly object[] = [];
  /** Field that uniquely identifies a row, used for selection. */
  @property({ attribute: 'row-key' }) accessor rowKey = 'id';
  /** Accessible name for the grid, e.g. "Assets". */
  @property() accessor label = '';
  /** Adds a checkbox column and row selection. */
  @property({ type: Boolean, reflect: true }) accessor selectable = false;
  /** Keys (`row-key` values) of the selected rows. */
  @property({ attribute: false }) accessor selected: unknown[] = [];
  /** Current sort. Set it to sort initially; it updates as headers are activated. */
  @property({ attribute: false }) accessor sort: DataTableSort | null = null;
  /** Do not sort `rows` locally: only update `sort` and fire `mm-sort-change` (server-side sorting). */
  @property({ type: Boolean, attribute: 'manual-sort' }) accessor manualSort = false;
  /** Lets people drag headers (or press Alt+Shift+Left/Right) to reorder columns. */
  @property({ type: Boolean, reflect: true }) accessor reorderable = false;
  /** Keeps the first data column (and the checkbox column) in view while scrolling sideways. */
  @property({ type: Boolean, reflect: true, attribute: 'sticky-first-column' }) accessor stickyFirstColumn = false;
  /** `compact` (36px rows) or `default` (40px). Unset follows `data-density` on an ancestor. */
  @property({ reflect: true }) accessor density: 'default' | 'compact' | undefined;
  /** Shows skeleton rows (after 200ms, for at least 400ms) and marks the grid busy. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message. Shows the error state with a retry button instead of rows. */
  @property() accessor error = '';
  /** Empty state title. */
  @property({ attribute: 'empty-heading' }) accessor emptyHeading = '';
  /** Empty state sentence: what is missing and what to do about it. */
  @property({ attribute: 'empty-text' }) accessor emptyText = '';
  /** Rows for which this returns true are shown disabled: not selectable or activatable. */
  @property({ attribute: false }) accessor rowDisabled: ((row: any) => boolean) | undefined;
  /** Accessible name of a row's checkbox. Defaults to "Select row". */
  @property({ attribute: false }) accessor rowLabel: ((row: any) => string) | undefined;

  @query('.scroller') accessor #scroller!: HTMLElement | null;
  @query('.head') accessor #head!: HTMLElement | null;
  @query('.probe') accessor #probe!: HTMLElement | null;

  #view: object[] = [];
  #index = new Map<object, number>();
  #selectableKeys: unknown[] = [];
  #sel = new Set<unknown>();
  #order: string[] = [];
  #widths = new Map<string, number>();
  #active: Cell = { r: 0, c: 0 };
  #editing = false;
  #anchor: number | null = null;
  #rowH = 40;
  #headH = 32;
  #delayed = new DelayedVisibility(this);
  #v?: Virtualizer<HTMLElement, HTMLElement>;
  #unmount?: () => void;
  #ro?: ResizeObserver;
  #resizing: string | null = null;
  #drag: { key: string; x: number; active: boolean; drop: number | null; pointer: number } | null = null;
  #suppressClick = false;

  constructor() {
    super();
    if (typeof window !== 'undefined') this.#v = new Virtualizer<HTMLElement, HTMLElement>(this.#vopts());
  }

  /** Rows in display order (after local sorting). */
  get viewRows(): readonly object[] {
    return this.#view;
  }

  /** Moves focus to the active cell (the grid's tab stop). */
  override focus(options?: FocusOptions): void {
    void this.#focusActive(options);
  }

  /** Scrolls a row (by display index) into view. */
  scrollToRow(index: number): void {
    this.#v?.scrollToIndex(index, { align: 'auto' });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#delayed.set(this.loading);
    if (this.hasUpdated && this.#v) {
      this.#unmount = this.#v._didMount();
      this.#v._willUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unmount?.();
    this.#unmount = undefined;
    this.#ro?.disconnect();
  }

  #vopts() {
    return {
      count: this.#view.length,
      getScrollElement: () => this.#scroller ?? null,
      estimateSize: () => this.#rowH,
      overscan: 8,
      scrollMargin: this.#headH,
      scrollPaddingStart: this.#headH,
      initialRect: { width: 960, height: 480 },
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      rangeExtractor: (range: Range) => {
        const out = defaultRangeExtractor(range);
        // Keep the focused row rendered so focus is never lost when it scrolls away.
        const a = this.#active.r - 1;
        if (a >= 0 && a < range.count && !out.includes(a)) {
          out.push(a);
          out.sort((x, y) => x - y);
        }
        return out;
      },
      onChange: () => this.requestUpdate(),
    };
  }

  /** Columns in display order. */
  #columns(): DataTableColumn[] {
    const byKey = new Map(this.columns.map((c) => [c.key, c]));
    const out: DataTableColumn[] = [];
    for (const k of this.#order) {
      const c = byKey.get(k);
      if (c) {
        out.push(c);
        byKey.delete(k);
      }
    }
    return [...out, ...byKey.values()];
  }

  get #off() {
    return this.selectable ? 1 : 0;
  }

  #key(row: object): unknown {
    const k = (row as Record<string, unknown>)[this.rowKey];
    return k === undefined ? this.#index.get(row) : k;
  }

  #val(col: DataTableColumn, row: object): unknown {
    return col.value ? col.value(row) : (row as Record<string, unknown>)[col.key];
  }

  #disabled(row: object | undefined): boolean {
    return !!row && !!this.rowDisabled?.(row);
  }

  #min(col: DataTableColumn): number {
    return col.minWidth ?? (col.type === 'number' ? NUMBER_MIN : DEFAULT_MIN);
  }

  #align(col: DataTableColumn): 'start' | 'end' | 'center' {
    return col.align ?? (col.type === 'number' ? 'end' : 'start');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('columns')) {
      const keys = this.columns.map((c) => c.key);
      this.#order = [...this.#order.filter((k) => keys.includes(k)), ...keys.filter((k) => !this.#order.includes(k))];
    }
    if (changed.has('selected')) this.#sel = new Set(this.selected);
    if (changed.has('rows')) this.#index = new Map(this.rows.map((r, i) => [r, i]));
    if (changed.has('rows') || changed.has('sort') || changed.has('columns') || changed.has('manualSort')) this.#computeView();
    if (this.selectable && (changed.has('rows') || changed.has('sort') || changed.has('columns') || changed.has('rowDisabled') || changed.has('selectable') || changed.has('rowKey')))
      this.#computeSelectable();
    if (changed.has('loading') && this.isConnected) this.#delayed.set(this.loading);
    const maxR = this.#view.length;
    if (this.#active.r > maxR) this.#active = { ...this.#active, r: maxR };
    const maxC = this.#columns().length + this.#off - 1;
    if (this.#active.c > maxC) this.#active = { ...this.#active, c: Math.max(0, maxC) };
    this.#v?.setOptions(this.#vopts());
  }

  #computeView() {
    const rows = [...this.rows];
    const s = this.sort;
    const col = s && this.columns.find((c) => c.key === s.key);
    if (!s || !col || this.manualSort) {
      this.#view = rows;
      return;
    }
    const dir = s.direction === 'descending' ? -1 : 1;
    if (col.compare) {
      this.#view = rows.sort((a, b) => dir * col.compare!(a, b));
      return;
    }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const keyed = rows.map((row) => {
      let v = this.#val(col, row);
      if (col.type === 'date' && v != null) v = new Date(v as string).getTime();
      return { row, v };
    });
    keyed.sort((a, b) => {
      const x = a.v;
      const y = b.v;
      // Empty values sort last in both directions.
      if (x == null || x === '') return y == null || y === '' ? 0 : 1;
      if (y == null || y === '') return -1;
      if (typeof x === 'number' && typeof y === 'number') return dir * (x - y);
      return dir * collator.compare(String(x), String(y));
    });
    this.#view = keyed.map((k) => k.row);
  }

  protected override firstUpdated(): void {
    this.#measure();
    if (this.#v) {
      this.#unmount = this.#v._didMount();
      this.#v._willUpdate();
    }
    this.#ro = new ResizeObserver(() => this.#measure());
    if (this.#probe) this.#ro.observe(this.#probe);
    if (this.#head) this.#ro.observe(this.#head);
  }

  #measure() {
    const rowH = readPx(this.#probe, 40);
    const headH = readPx(this.#head, 32);
    if (rowH !== this.#rowH || headH !== this.#headH) {
      this.#rowH = rowH;
      this.#headH = headH;
      this.#v?.setOptions(this.#vopts());
      this.#v?.measure();
      this.requestUpdate();
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#v?._willUpdate();
    if (changed.has('density')) this.#measure();
    // The grid is one tab stop: interactive content in cells is reachable with Enter, not Tab.
    for (const cell of this.renderRoot.querySelectorAll<HTMLElement>('.body .cell.interactive')) {
      const isActive = this.#editing && Number(cell.dataset.r) === this.#active.r && Number(cell.dataset.c) === this.#active.c;
      setCellContentTabbable(cell, isActive);
    }
  }

  #cellEl(r: number, c: number): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`);
  }

  async #focusActive(options?: FocusOptions) {
    await this.updateComplete;
    let el = this.#cellEl(this.#active.r, this.#active.c);
    if (!el) {
      // The row may only appear after the virtualiser scrolls to it.
      if (this.#active.r > 0) this.#v?.scrollToIndex(this.#active.r - 1, { align: 'auto' });
      this.requestUpdate();
      await this.updateComplete;
      el = this.#cellEl(this.#active.r, this.#active.c);
    }
    if (!el) return;
    if (!options?.preventScroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    el.focus({ preventScroll: true });
  }

  #moveTo(r: number, c: number) {
    const cols = this.#columns().length + this.#off;
    this.#active = { r: clamp(r, 0, this.#view.length), c: clamp(c, 0, Math.max(0, cols - 1)) };
    this.#editing = false;
    this.requestUpdate();
    void this.#focusActive();
  }

  #pageSize(): number {
    const h = (this.#scroller?.clientHeight ?? 480) - this.#headH;
    return Math.max(1, Math.floor(h / this.#rowH) - 1);
  }

  // ---- Sorting ----

  #toggleSort(col: DataTableColumn) {
    if (!col.sortable) return;
    const cur = this.sort?.key === col.key ? this.sort.direction : null;
    const next: DataTableSortDirection | null = cur === null ? 'ascending' : cur === 'ascending' ? 'descending' : null;
    this.sort = next ? { key: col.key, direction: next } : null;
    emit<DataTableSortChangeDetail>(this, 'mm-sort-change', { key: col.key, direction: next });
  }

  // ---- Selection ----

  #emitSelection() {
    this.selected = [...this.#sel];
    const rows = this.rows.filter((r) => this.#sel.has(this.#key(r)));
    emit<DataTableSelectionChangeDetail>(this, 'mm-selection-change', { selected: [...this.#sel], rows });
  }

  #toggleRow(index: number, range: boolean) {
    const row = this.#view[index];
    if (!row || this.#disabled(row) || !this.selectable) return;
    const key = this.#key(row);
    if (range && this.#anchor !== null) {
      const anchorRow = this.#view[this.#anchor];
      const on = anchorRow ? this.#sel.has(this.#key(anchorRow)) : true;
      const [a, b] = this.#anchor < index ? [this.#anchor, index] : [index, this.#anchor];
      for (let i = a; i <= b; i++) {
        const r = this.#view[i]!;
        if (this.#disabled(r)) continue;
        const k = this.#key(r);
        if (on) this.#sel.add(k);
        else this.#sel.delete(k);
      }
    } else {
      if (this.#sel.has(key)) this.#sel.delete(key);
      else this.#sel.add(key);
      this.#anchor = index;
    }
    this.#emitSelection();
  }

  #computeSelectable() {
    const out: unknown[] = [];
    for (const r of this.#view) if (!this.#disabled(r)) out.push(this.#key(r));
    this.#selectableKeys = out;
  }

  #toggleAll(force?: boolean) {
    if (!this.selectable) return;
    const keys = this.#selectableKeys;
    const all = keys.length > 0 && keys.every((k) => this.#sel.has(k));
    const on = force ?? !all;
    if (on) keys.forEach((k) => this.#sel.add(k));
    else keys.forEach((k) => this.#sel.delete(k));
    this.#emitSelection();
  }

  // ---- Column resize and reorder ----

  #widthOf(col: DataTableColumn): number {
    const w = this.#widths.get(col.key);
    if (w) return w;
    const c = this.#columns().indexOf(col) + this.#off;
    return Math.round(this.#cellEl(0, c)?.getBoundingClientRect().width ?? this.#min(col));
  }

  #setWidth(col: DataTableColumn, w: number) {
    const width = Math.round(clamp(w, this.#min(col), MAX_W));
    this.#widths.set(col.key, width);
    this.requestUpdate();
    return width;
  }

  #onResizeDown(e: PointerEvent, col: DataTableColumn) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = this.#widthOf(col);
    const dir = isRtl(this) ? -1 : 1;
    this.#resizing = col.key;
    this.requestUpdate();
    let width = startW;
    const move = (ev: PointerEvent) => {
      width = this.#setWidth(col, startW + (ev.clientX - startX) * dir);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      this.#resizing = null;
      this.#suppressClick = true;
      setTimeout(() => (this.#suppressClick = false), 0);
      this.requestUpdate();
      emit<DataTableColumnResizeDetail>(this, 'mm-column-resize', { key: col.key, width });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  #onResizeKey(e: KeyboardEvent, col: DataTableColumn, c: number) {
    const rtl = isRtl(this);
    const step = e.shiftKey ? 50 : 10;
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -step;
    if (rtl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) delta = -delta;
    if (delta) {
      e.preventDefault();
      e.stopPropagation();
      const width = this.#setWidth(col, this.#widthOf(col) + delta);
      emit<DataTableColumnResizeDetail>(this, 'mm-column-resize', { key: col.key, width });
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      const width = this.#setWidth(col, this.#min(col));
      emit<DataTableColumnResizeDetail>(this, 'mm-column-resize', { key: col.key, width });
      return;
    }
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'F2' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.#moveTo(0, c);
    }
  }

  #reorder(key: string, to: number) {
    const from = this.#order.indexOf(key);
    if (from < 0) return;
    const target = clamp(to, 0, this.#order.length - 1);
    if (target === from) return;
    const order = [...this.#order];
    order.splice(from, 1);
    order.splice(target, 0, key);
    this.#order = order;
    this.requestUpdate();
    emit<DataTableColumnReorderDetail>(this, 'mm-column-reorder', { key, from, to: target, order: [...order] });
  }

  #onHeaderDown(e: PointerEvent, col: DataTableColumn) {
    if (!this.reorderable || e.button !== 0) return;
    const cell = e.currentTarget as HTMLElement;
    this.#drag = { key: col.key, x: e.clientX, active: false, drop: null, pointer: e.pointerId };
    const move = (ev: PointerEvent) => {
      const d = this.#drag;
      if (!d) return;
      if (!d.active && Math.abs(ev.clientX - d.x) < 5) return;
      if (!d.active) {
        d.active = true;
        cell.setPointerCapture(d.pointer);
      }
      d.drop = this.#dropIndex(ev.clientX);
      this.requestUpdate();
    };
    const up = () => {
      cell.removeEventListener('pointermove', move);
      cell.removeEventListener('pointerup', up);
      cell.removeEventListener('pointercancel', up);
      const d = this.#drag;
      this.#drag = null;
      if (d?.active) {
        this.#suppressClick = true;
        setTimeout(() => (this.#suppressClick = false), 0);
        if (d.drop !== null) {
          const from = this.#order.indexOf(d.key);
          this.#reorder(d.key, d.drop > from ? d.drop - 1 : d.drop);
        }
      }
      this.requestUpdate();
    };
    cell.addEventListener('pointermove', move);
    cell.addEventListener('pointerup', up);
    cell.addEventListener('pointercancel', up);
  }

  /** Insertion index (0..n) among data columns for a pointer x position. */
  #dropIndex(x: number): number {
    const cells = [...this.renderRoot.querySelectorAll<HTMLElement>('.head .cell.data')];
    const rtl = isRtl(this);
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i]!.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (rtl ? x > mid : x < mid) return i;
    }
    return cells.length;
  }

  // ---- Events ----

  #onFocusIn(e: FocusEvent) {
    const cell = cellFromPath(e);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const inner = e.composedPath()[0] !== cell;
    if (r !== this.#active.r || c !== this.#active.c || inner !== this.#editing) {
      this.#active = { r, c };
      this.#editing = inner;
      this.requestUpdate();
    }
  }

  #onFocusOut(e: FocusEvent) {
    if (!this.#editing) return;
    const to = e.relatedTarget as Node | null;
    const cell = this.#cellEl(this.#active.r, this.#active.c);
    if (cell && to && (cell.contains(to) || cell === to)) return;
    // relatedTarget is retargeted across shadow roots; check the composed tree too.
    if (cell && to instanceof Element && to.getRootNode() !== this.renderRoot) {
      let n: Node | null = to;
      while (n) {
        if (n === cell) return;
        n = n.parentNode ?? (n as ShadowRoot).host ?? null;
      }
    }
    this.#editing = false;
    this.requestUpdate();
  }

  #onClick(e: MouseEvent) {
    if (this.#suppressClick) {
      this.#suppressClick = false;
      return;
    }
    const cell = cellFromPath(e);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const cols = this.#columns();
    if (r === 0) {
      if (e.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('resize'))) return;
      if (this.selectable && c === 0) this.#toggleAll();
      else {
        const col = cols[c - this.#off];
        if (col) this.#toggleSort(col);
      }
      return;
    }
    const row = this.#view[r - 1];
    if (!row) return;
    if (this.selectable && c === 0) {
      this.#toggleRow(r - 1, e.shiftKey);
      return;
    }
    const path = e.composedPath();
    const interactive = focusablesIn(cell).some((el) => path.includes(el));
    if (interactive || this.#disabled(row)) return;
    if (e.shiftKey && this.selectable) {
      this.#toggleRow(r - 1, true);
      return;
    }
    emit<DataTableRowActivateDetail>(this, 'mm-row-activate', { row, index: r - 1 });
  }

  #onKeydown(e: KeyboardEvent) {
    const path = e.composedPath();
    const handle = path.find((n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('resize'));
    const cell = cellFromPath(e);
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const cols = this.#columns();
    const col = cols[c - this.#off];
    if (handle && col) {
      this.#onResizeKey(e, col, c);
      return;
    }
    if (this.#editing) {
      if (e.key === 'Escape' || e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        this.#moveTo(r, c);
      } else if (e.key === 'Tab') {
        const els = focusablesIn(cell);
        if (els.length) {
          e.preventDefault();
          const current = els.findIndex((el) => path.includes(el));
          const next = (current + (e.shiftKey ? -1 : 1) + els.length) % els.length;
          els[next]!.focus();
        }
      }
      return;
    }
    if (path[0] !== cell) return;
    const rtl = isRtl(this);
    const lastC = cols.length + this.#off - 1;
    const lastR = this.#view.length;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (r === 0 && e.altKey && e.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight') && this.reorderable && col) {
      e.preventDefault();
      const forward = (key === 'ArrowRight') !== rtl;
      const from = this.#order.indexOf(col.key);
      this.#reorder(col.key, from + (forward ? 1 : -1));
      this.#active = { r: 0, c: this.#columns().indexOf(col) + this.#off };
      void this.#focusActive();
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
        next = mod ? { r: 0, c: 0 } : { r, c: 0 };
        break;
      case 'End':
        next = mod ? { r: lastR, c: lastC } : { r, c: lastC };
        break;
      case 'PageDown':
        next = { r: Math.min(lastR, Math.max(1, r) + this.#pageSize()), c };
        break;
      case 'PageUp':
        next = { r: r <= 1 ? 0 : Math.max(1, r - this.#pageSize()), c };
        break;
    }
    if (next) {
      e.preventDefault();
      this.#moveTo(next.r, next.c);
      return;
    }

    if ((key === 'a' || key === 'A') && isModKey(e) && this.selectable) {
      e.preventDefault();
      this.#toggleAll(true);
      return;
    }

    if (r === 0) {
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        if (this.selectable && c === 0) this.#toggleAll();
        else if (col?.sortable) this.#toggleSort(col);
        else if (col && key === 'Enter') this.#focusHandle(c);
      } else if (key === 'F2' && col) {
        e.preventDefault();
        this.#focusHandle(c);
      }
      return;
    }

    const row = this.#view[r - 1];
    if (!row) return;
    if (key === ' ') {
      e.preventDefault();
      this.#toggleRow(r - 1, e.shiftKey);
      return;
    }
    if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      if (this.selectable && c === 0) {
        if (key === 'Enter') this.#toggleRow(r - 1, e.shiftKey);
        return;
      }
      const els = focusablesIn(cell);
      if (key === 'Enter' && els.length === 1 && els[0] instanceof HTMLAnchorElement) {
        els[0].click();
        return;
      }
      if (els.length) {
        this.#editing = true;
        setCellContentTabbable(cell, true);
        els[0]!.focus();
        this.requestUpdate();
        return;
      }
      if (key === 'Enter' && !this.#disabled(row)) emit<DataTableRowActivateDetail>(this, 'mm-row-activate', { row, index: r - 1 });
    }
  }

  #focusHandle(c: number) {
    const handle = this.#cellEl(0, c)?.querySelector<HTMLElement>('.resize');
    if (!handle) return;
    this.#editing = true;
    handle.focus();
  }

  // ---- Rendering ----

  #template(cols: DataTableColumn[]) {
    const tracks: string[] = [];
    let min = 0;
    if (this.selectable) {
      tracks.push(`${SELECT_W}px`);
      min += SELECT_W;
    }
    for (const col of cols) {
      const resized = this.#widths.get(col.key);
      if (resized) {
        tracks.push(`${resized}px`);
        min += resized;
      } else {
        // Preferred widths are weights, so a table never overflows while its columns can still shrink.
        const m = this.#min(col);
        tracks.push(`minmax(${m}px, ${col.width ?? FLEX_W}fr)`);
        min += m;
      }
    }
    return { tracks: tracks.join(' '), min };
  }

  #stickyStyle(c: number, cols: DataTableColumn[]): { cls: string; style: string } {
    if (!this.stickyFirstColumn) return { cls: '', style: '' };
    if (this.selectable && c === 0) return { cls: 'sticky', style: 'inset-inline-start:0' };
    if (c === this.#off && cols.length) {
      return { cls: 'sticky edge', style: `inset-inline-start:${this.selectable ? SELECT_W : 0}px` };
    }
    return { cls: '', style: '' };
  }

  #stickyWidth(cols: DataTableColumn[]): number {
    if (!this.stickyFirstColumn || !cols[0]) return 0;
    // The first column only sticks while the table scrolls, which is when columns sit at their minimum.
    const w = this.#widths.get(cols[0].key) ?? this.#min(cols[0]);
    return w + (this.selectable ? SELECT_W : 0);
  }

  #tab(r: number, c: number) {
    return r === this.#active.r && c === this.#active.c ? 0 : -1;
  }

  #headerCell(col: DataTableColumn, i: number, cols: DataTableColumn[]) {
    const c = i + this.#off;
    const dir = this.sort?.key === col.key ? this.sort.direction : undefined;
    const align = this.#align(col);
    const label = col.unit ? `${col.header} (${col.unit})` : col.header;
    const st = this.#stickyStyle(c, cols);
    const d = this.#drag;
    let drop = '';
    if (d?.active && d.drop !== null) {
      if (d.drop === i) drop = 'drop-before';
      else if (d.drop === cols.length && i === cols.length - 1) drop = 'drop-after';
    }
    const w = this.#widths.get(col.key) ?? col.width;
    return html`<div
      role="columnheader"
      class="cell data ${align} ${col.sortable ? 'sortable' : ''} ${st.cls} ${drop} ${d?.active && d.key === col.key ? 'dragging' : ''}"
      style=${st.style}
      aria-colindex=${c + 1}
      aria-sort=${ifDefined(dir)}
      data-r="0"
      data-c=${c}
      tabindex=${this.#tab(0, c)}
      @pointerdown=${(e: PointerEvent) => this.#onHeaderDown(e, col)}
    >
      <span class="label">${label}</span>
      ${col.sortable
        ? html`<mm-icon class="sort" size="14" name=${dir === 'descending' ? 'arrow-downward' : dir ? 'arrow-upward' : 'unfold-more'}></mm-icon>${dir
              ? html`<span class="visually-hidden">${t(dir === 'ascending' ? 'sortAscending' : 'sortDescending')}</span>`
              : nothing}`
        : nothing}
      ${col.resizable
        ? html`<div
            class="resize ${this.#resizing === col.key ? 'active' : ''}"
            role="separator"
            aria-orientation="vertical"
            aria-label=${tr('resizeColumn', 'Resize {column} column', { column: col.header })}
            aria-valuenow=${w ?? this.#min(col)}
            aria-valuemin=${this.#min(col)}
            aria-valuemax=${MAX_W}
            tabindex="-1"
            @pointerdown=${(e: PointerEvent) => this.#onResizeDown(e, col)}
          ></div>`
        : nothing}
    </div>`;
  }

  #cellContent(col: DataTableColumn, row: object) {
    let content: unknown;
    const raw = col.empty === undefined ? undefined : this.#val(col, row);
    if (col.empty !== undefined && (raw === null || raw === undefined || raw === '')) return html`<span class="text empty">${col.empty}</span>`;
    if (col.render) content = col.render(row);
    else {
      const v = this.#val(col, row);
      switch (col.type) {
        case 'number':
          content = html`<span class="text">${typeof v === 'number' ? formatCount(v) : v == null ? '' : String(v)}</span>`;
          break;
        case 'date':
          if (v == null || v === '') content = nothing;
          else {
            const d = new Date(v as string | number);
            content = html`<time class="text" datetime=${d.toISOString()} title=${formatTimestamp(d)}>${formatRelative(d)}</time>`;
          }
          break;
        case 'status': {
          const s = String(v ?? '');
          // Don't badge the happy path: succeeded and allowed are a plain quiet word.
          content = isHappyPath(s)
            ? html`<span class="text happy">${STATUS_STATES[s as StatusState].word()}</span>`
            : s in STATUS_STATES
              ? html`<mm-status-pill state=${s as StatusState}></mm-status-pill>`
              : s
                ? html`<mm-status-pill>${s}</mm-status-pill>`
                : nothing;
          break;
        }
        case 'mono': {
          const s = v == null ? '' : String(v);
          content = html`<span class="text" title=${ifDefined(s.length > 32 ? s : undefined)}>${s}</span>`;
          break;
        }
        default:
          content = html`<span class="text">${v == null ? '' : String(v)}</span>`;
      }
    }
    const href = col.href?.(row);
    if (href) return html`<a class="link" href=${href} tabindex="-1" data-grid-tab>${content}</a>`;
    return content;
  }

  #bodyRow(index: number, start: number, cols: DataTableColumn[], last: boolean) {
    const row = this.#view[index]!;
    const key = this.#key(row);
    const selected = this.#sel.has(key);
    const disabled = this.#disabled(row);
    const r = index + 1;
    return html`<div
      role="row"
      part="row"
      class="row ${last ? 'last' : ''}"
      aria-rowindex=${r + 1}
      aria-selected=${this.selectable ? (selected ? 'true' : 'false') : nothing}
      aria-disabled=${disabled ? 'true' : nothing}
      style="inset-block-start:${start}px"
    >
      ${this.selectable
        ? html`<div role="gridcell" part="cell" class="cell select ${this.#stickyStyle(0, cols).cls}" style=${this.#stickyStyle(0, cols).style} aria-colindex="1" data-r=${r} data-c="0" tabindex=${this.#tab(r, 0)}>
            <mm-checkbox hide-label tabindex="-1" label=${this.rowLabel?.(row) ?? t('selectRow')} .checked=${selected} ?disabled=${disabled}></mm-checkbox>
          </div>`
        : nothing}
      ${cols.map((col, i) => {
        const c = i + this.#off;
        const st = this.#stickyStyle(c, cols);
        const interactive = !!(col.render || col.href);
        return html`<div
          role="gridcell"
          part="cell"
          class="cell ${col.type ?? 'text'} ${this.#align(col)} ${st.cls} ${interactive ? 'interactive' : ''}"
          style=${st.style}
          aria-colindex=${c + 1}
          data-r=${r}
          data-c=${c}
          tabindex=${this.#tab(r, c)}
        >${this.#cellContent(col, row)}</div>`;
      })}
    </div>`;
  }

  #renderState(cols: DataTableColumn[]) {
    if (this.error) {
      return html`<div class="state state-error" role="alert">
        <mm-icon name="error" size="24"></mm-icon>
        <h2>${tr('tableErrorHeading', 'These records could not be loaded')}</h2>
        <p>${this.error}</p>
        <slot name="error-actions"
          ><mm-button variant="secondary" icon="refresh" @click=${() => emit(this, 'mm-retry', {})}>${tr('retry', 'Retry')}</mm-button></slot
        >
      </div>`;
    }
    if (this.#delayed.visible) {
      const n = cols.length + this.#off;
      return html`<div class="state" role="status">
        <span class="visually-hidden">${t('loading')}</span>
        <div class="skeleton" aria-hidden="true">
          ${Array.from(
            { length: 8 },
            (_, r) => html`<div class="row">
              ${Array.from({ length: n }, (_, c) => {
                const col = cols[c - this.#off];
                const end = col && this.#align(col) === 'end';
                const w = [62, 40, 74, 28, 56, 46][(r + c) % 6]!;
                return html`<span class="bone ${end ? 'end' : ''}" style="inline-size:${this.selectable && c === 0 ? 16 : end ? 40 : w}%"></span>`;
              })}
            </div>`,
          )}
        </div>
      </div>`;
    }
    if (!this.loading && this.#view.length === 0) {
      return html`<div class="state">
        <slot name="empty">
          <mm-empty-state
            compact
            level="2"
            heading=${this.emptyHeading || tr('tableEmptyHeading', 'Nothing to show yet')}
            description=${this.emptyText || tr('tableEmpty', 'Records will appear here once they are added.')}
          ></mm-empty-state>
        </slot>
      </div>`;
    }
    return nothing;
  }

  override render() {
    const cols = this.#columns();
    const { tracks, min } = this.#template(cols);
    const showRows = !this.error && !this.#delayed.visible;
    const items = showRows && this.#v ? this.#v.getVirtualItems() : [];
    const total = showRows && this.#v ? this.#v.getTotalSize() : 0;
    const n = this.#view.length;
    const keys = this.selectable ? this.#selectableKeys : [];
    const selCount = keys.filter((k) => this.#sel.has(k)).length;
    const all = keys.length > 0 && selCount === keys.length;
    const some = selCount > 0 && !all;
    const margin = this.#headH;
    return html`<div class="wrap" part="base">
      <span class="probe" aria-hidden="true"></span>
      <div
        class="scroller"
        part="scroller"
        style="--_cols:${tracks};--_minw:${min}px;--_head-h:${this.#headH}px;--_sticky-w:${this.#stickyWidth(cols)}px"
      >
        <div
          class="grid"
          part="grid"
          role="grid"
          aria-label=${ifDefined(this.label || undefined)}
          aria-rowcount=${n + 1}
          aria-colcount=${cols.length + this.#off}
          aria-multiselectable=${this.selectable ? 'true' : nothing}
          aria-busy=${this.loading ? 'true' : 'false'}
          @keydown=${this.#onKeydown}
          @focusin=${this.#onFocusIn}
          @focusout=${this.#onFocusOut}
          @click=${this.#onClick}
        >
          <div class="head" role="rowgroup">
            <div class="row" role="row" part="header" aria-rowindex="1">
              ${this.selectable
                ? html`<div role="columnheader" class="cell select ${this.#stickyStyle(0, cols).cls}" style=${this.#stickyStyle(0, cols).style} aria-colindex="1" data-r="0" data-c="0" tabindex=${this.#tab(0, 0)}>
                    <span class="visually-hidden">${tr('selection', 'Selection')}</span>
                    <mm-checkbox hide-label tabindex="-1" label=${t('selectAll')} .checked=${all} .indeterminate=${some} ?disabled=${keys.length === 0}></mm-checkbox>
                  </div>`
                : nothing}
              ${cols.map((col, i) => this.#headerCell(col, i, cols))}
            </div>
          </div>
          <div class="body" role="rowgroup" style="block-size:${total}px">
            ${repeat(items, (it) => it.index, (it) => this.#bodyRow(it.index, it.start - margin, cols, it.index === n - 1))}
          </div>
        </div>
        ${this.#renderState(cols)}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-data-table': MmDataTable;
  }
}
