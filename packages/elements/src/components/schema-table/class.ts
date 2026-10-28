import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { emit } from '../../core/events.js';
import { formatCount } from '../../core/format.js';
import { isRtl } from '../../core/roving.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../copy-button/define.js';
import '../tag/define.js';
import '../search-field/define.js';
import '../filter-pill/define.js';
import '../skeleton/define.js';
import '../empty-state/define.js';
import '../segmented-control/define.js';
import '../code-sample/define.js';

export interface SchemaColumnStats {
  distinct?: number;
  /** 0 to 100. */
  nullPercent?: number;
  min?: string | number;
  max?: string | number;
  /** Relative bucket heights, drawn as a small histogram in the field panel. */
  distribution?: number[];
}

/** One column or nested field. */
export interface SchemaColumn {
  name: string;
  /** The type as the source states it: `varchar(255)`, `int8`, `record<Customer>`, `array<record<LineItem>>`. */
  type: string;
  /** An everyday name for the type that replaces the derived one, such as "Money (GBP)". */
  semantic?: string;
  description?: string;
  /** `plugin` when a plugin wrote the description, `user` when a person did (marked "Edited"). */
  descriptionSource?: 'plugin' | 'user';
  tags?: string[];
  glossaryTerms?: string[];
  pii?: boolean;
  certified?: boolean;
  /** True for nullable (shown as "Optional"), false for not null. Leave undefined when the source does not say. */
  nullable?: boolean;
  primaryKey?: boolean;
  /** The allowed values of an enum. */
  symbols?: string[];
  /** The default value, when the source declares one. */
  default?: string | number | boolean | null;
  /** Who can see this field's values, such as "Masked for agents without pii-read". */
  access?: string;
  stats?: SchemaColumnStats;
  /** Nested fields of a struct, record or list of records. */
  fields?: SchemaColumn[];
}

const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** The type in everyday words, so anyone can read the schema; the exact type stays in the field panel. */
export function plainType(c: SchemaColumn): string {
  if (c.semantic) return c.semantic;
  const t = c.type.trim().toLowerCase();
  const raw = c.type.trim();
  const list = /^(array|list)<(.+)>$/i.exec(raw);
  if (list) {
    const inner = list[2]!;
    const rec = /^(record|struct)<(\w+)>$/i.exec(inner);
    if (rec) return tr('schemaListOf', 'List of {item}', { item: words(rec[2]!).toLowerCase() });
    return tr('schemaListOf', 'List of {item}', { item: plainType({ name: '', type: inner }).toLowerCase() });
  }
  if (c.fields?.length || /^(record|struct|object)/.test(t)) return tr('schemaGroup', 'Group of {n} fields', { n: c.fields?.length ?? 0 });
  if (/^enum/.test(t) || c.symbols?.length) {
    const sym = c.symbols ?? [];
    if (!sym.length) return tr('schemaChoice', 'One of a set of values');
    return sym.length <= 5
      ? tr('schemaOneOfList', 'One of {n} values: {values}', { n: sym.length, values: sym.join(', ') })
      : tr('schemaOneOf', 'One of {n} values', { n: sym.length });
  }
  if (/timestamp|datetime/.test(t)) return tr('schemaDateTime', 'Date and time');
  if (/^date/.test(t)) return tr('schemaDate', 'Date');
  if (/^time/.test(t)) return tr('schemaTime', 'Time');
  if (/^bool/.test(t)) return tr('schemaBoolean', 'Yes or no');
  if (/^(int|bigint|smallint|tinyint|integer|long|short|serial)/.test(t)) return tr('schemaWhole', 'Whole number');
  if (/^(numeric|decimal|number|float|double|real)/.test(t)) return tr('schemaDecimal', 'Decimal number');
  if (/^uuid/.test(t)) return tr('schemaId', 'ID');
  if (/^(char|varchar|text|string|nvarchar|nchar|citext)/.test(t)) return tr('schemaText', 'Text');
  if (/^(json|jsonb|variant|map)/.test(t)) return tr('schemaJson', 'JSON');
  return raw;
}

/** A small YAML writer for schema documents: maps, lists, strings, numbers, booleans and null. */
export function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const scalar = (v: unknown): string => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return v === '' || /^[\s-?:,[\]{}#&*!|>'"%@`]|: |\s#|^(true|false|null|yes|no|~|[\d.+-]+)$/i.test(v) ? JSON.stringify(v) : v;
    return String(v);
  };
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]`;
    return value
      .map((x) => {
        if (x !== null && typeof x === 'object') {
          const body = toYaml(x, indent + 1).trimStart();
          return `${pad}- ${body}`;
        }
        return `${pad}- ${scalar(x)}`;
      })
      .join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return `${pad}{}`;
    return entries
      .map(([k, v]) => {
        const key = /^[\w.-]+$/.test(k) ? k : JSON.stringify(k);
        if (v !== null && typeof v === 'object' && (Array.isArray(v) ? v.length : Object.keys(v).length)) return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
        return `${pad}${key}: ${Array.isArray(v) ? '[]' : v !== null && typeof v === 'object' ? '{}' : scalar(v)}`;
      })
      .join('\n');
  }
  return pad + scalar(value);
}

export interface MmEditDescriptionDetail {
  column: SchemaColumn;
  /** Dotted path of the field, e.g. `shipping_address.city`. */
  path: string;
}

export interface MmSelectFieldDetail {
  column: SchemaColumn;
  path: string;
}

interface Row {
  key: string;
  column: SchemaColumn;
  level: number;
  setsize: number;
  posinset: number;
  parentKey: string;
  expandable: boolean;
  expanded: boolean;
}

/**
 * The schema outline is the Schema tab of an asset, for flat SQL tables and deep Avro or JSON
 * schemas alike. Each field reads as two lines: its name, its type in everyday words ("Text",
 * "Money (GBP)", "List of line item", "One of 3 values: WEB, IOS, ANDROID") and markers (Key,
 * PII, Certified), then its description with glossary terms beside it. Only exceptions are
 * marked: "Optional" for a nullable field, "Edited" for a description a person changed, and the
 * filled share when a field has gaps. Groups fold into a tree only where nesting exists, with a
 * hairline guide per level; top-level groups start open. `density="compact"` shows one line per
 * field for wide tables.
 *
 * Selecting a field opens a side panel with the exact type, its values (filled share, distinct
 * count, range, histogram, allowed values, default), who can see it, glossary terms and a copyable
 * path. A Structure, JSON and YAML switch shows the schema as text with a copy button, from
 * `source` (the original Avro or JSON Schema document) when given, or from `columns`.
 *
 * It is an ARIA treegrid (https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) with row focus: one
 * tab stop; Down and Up move between rows, Home and End go to the first and last; Right expands a
 * group or moves to its first field, Left collapses it or moves to its parent (flipped in
 * right-to-left); Enter opens the field panel and Escape closes it, returning focus to the row.
 *
 * @tagname mm-schema-table
 * @summary The fields of an asset's schema as a readable outline, with a field panel and JSON/YAML views.
 * @csspart toolbar - The find, filter and view row.
 * @csspart outline - The treegrid.
 * @csspart panel - The field panel.
 * @csspart text - The JSON or YAML view.
 * @cssprop --mm-schema-table-height - Height at which the outline scrolls. Defaults to none.
 * @fires mm-select-field - {MmSelectFieldDetail} A field was opened in the panel.
 * @fires mm-edit-description - {MmEditDescriptionDetail} The person asked to edit a field's description.
 * @fires mm-retry - {null} The retry button in the error state was activated.
 */
export class MmSchemaTable extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        font: var(--text-dense);
        color: var(--mm-text);
        container-type: inline-size;
        --_indent: 20px;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        margin-block-end: var(--space-3);
      }
      .toolbar mm-search-field {
        flex: 0 1 18rem;
        min-width: 12rem;
      }
      .toolbar .end {
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-4);
        align-items: start;
      }
      .layout.with-panel {
        grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
      }
      @container (max-width: 760px) {
        .layout.with-panel {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .outline {
        border-block: 1px solid var(--mm-rule);
        max-block-size: var(--mm-schema-table-height, none);
        overflow: auto;
      }
      .row {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        column-gap: var(--space-2);
        row-gap: 2px;
        padding: var(--space-3) var(--space-3) var(--space-3) calc(var(--space-2) + (var(--_level) - 1) * var(--_indent));
        border-block-start: 1px solid var(--mm-rule);
        cursor: default;
        outline: none;
      }
      .row:first-child {
        border-block-start: 0;
      }
      /* One hairline guide per nesting level. */
      .row::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: calc(var(--space-2) + 11px);
        inline-size: calc((var(--_level) - 1) * var(--_indent));
        background: repeating-linear-gradient(to right, var(--mm-rule) 0 1px, transparent 1px var(--_indent));
        pointer-events: none;
      }
      :host(:dir(rtl)) .row::before {
        background: repeating-linear-gradient(to left, var(--mm-rule) 0 1px, transparent 1px var(--_indent));
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      .row.selected {
        background: var(--mm-selected);
      }
      .row:focus-visible {
        box-shadow: inset 0 0 0 2px var(--mm-text);
      }
      .twisty {
        grid-row: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        block-size: 24px;
        margin-block: -2px;
        color: var(--mm-text-2);
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .twisty mm-icon {
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      :host(:dir(rtl)) .twisty mm-icon {
        transform: scaleX(-1);
      }
      .row[aria-expanded='true'] .twisty mm-icon {
        transform: rotate(90deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .twisty mm-icon {
          transition: none;
        }
      }
      .line1 {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1) var(--space-3);
        min-width: 0;
      }
      .name {
        font: var(--text-mono-dense);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .type {
        color: var(--mm-text-2);
      }
      .markers {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .key {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--mm-text-2);
        font: var(--text-caption);
      }
      .end {
        grid-row: 1;
        grid-column: 3;
        color: var(--mm-text-3);
        font: var(--text-caption);
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .line2 {
        grid-column: 2 / 4;
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        min-width: 0;
      }
      .desc {
        flex: 1;
        min-width: 0;
        color: var(--mm-text);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .desc.none,
      /* mm-text-2: mm-text-3 drops below 4.5:1 on a selected row. */
      .edited {
        color: var(--mm-text-2);
      }
      .edited {
        font: var(--text-caption);
      }
      .terms {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: end;
        gap: var(--space-1);
        flex: none;
        max-inline-size: 45%;
      }
      .filled {
        flex: none;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      :host([density='compact']) .row {
        padding-block: var(--space-2);
        grid-template-columns: auto minmax(0, auto) minmax(0, 1fr) auto;
      }
      :host([density='compact']) .line2 {
        grid-row: 1;
        grid-column: 3;
      }
      :host([density='compact']) .desc {
        -webkit-line-clamp: 1;
      }
      :host([density='compact']) .end {
        grid-column: 4;
      }
      :host([density='compact']) .terms {
        display: none;
      }
      .panel {
        position: sticky;
        inset-block-start: 0;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
      }
      .panel-head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
        border-block-end: 1px solid var(--mm-rule);
      }
      .panel-head h3 {
        flex: 1;
        min-width: 0;
        margin: 0;
        font: var(--text-mono-dense);
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .panel section {
        padding: var(--space-4);
      }
      .panel section + section {
        border-block-start: 1px solid var(--mm-rule);
      }
      .panel h4 {
        margin: 0 0 var(--space-2);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      dl {
        display: grid;
        grid-template-columns: max-content minmax(0, 1fr);
        gap: var(--space-2) var(--space-4);
        margin: 0;
      }
      dt {
        color: var(--mm-text-2);
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
        font-variant-numeric: tabular-nums;
      }
      .mono {
        font: var(--text-mono-dense);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
      }
      .path {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .path code {
        flex: 1;
        min-width: 0;
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .hist {
        display: block;
        color: var(--mm-text-3);
        margin-block-start: var(--space-2);
      }
      .message {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      .message .why {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--mm-danger);
      }
      .no-match {
        margin: 0;
        padding: var(--space-6) var(--space-4);
        text-align: center;
        color: var(--mm-text-2);
      }
      @media (pointer: coarse) {
        .twisty {
          inline-size: var(--target-touch);
          block-size: var(--target-touch);
        }
      }
    `,
  ];

  /** The fields. */
  @property({ attribute: false }) accessor columns: SchemaColumn[] = [];
  /** The schema as its source wrote it (an Avro or JSON Schema document, as an object or a JSON string), for the JSON and YAML views. Without it they show `columns`. */
  @property({ attribute: false }) accessor source: unknown;
  /** The outline, or the schema as JSON or YAML text with a copy button. */
  @property({ reflect: true }) accessor view: 'structure' | 'json' | 'yaml' = 'structure';
  /** `compact` shows one line per field, for wide tables. */
  @property({ reflect: true }) accessor density: 'comfortable' | 'compact' = 'comfortable';
  /** Accessible name. Defaults to "Schema". */
  @property() accessor label = '';
  /** Shows "Edit description" in the field panel. */
  @property({ type: Boolean, reflect: true }) accessor editable = false;
  /** Finds fields by name, including nested ones. */
  @property() accessor filter = '';
  /** Shows only fields that hold personal data. */
  @property({ type: Boolean, attribute: 'pii-only', reflect: true }) accessor piiOnly = false;
  /** Shows only key fields. */
  @property({ type: Boolean, attribute: 'keys-only', reflect: true }) accessor keysOnly = false;
  /** The path of the field open in the panel. */
  @property() accessor selected = '';
  @property({ type: Boolean, attribute: 'hide-toolbar' }) accessor hideToolbar = false;
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** Error text; shows a retry button. */
  @property() accessor error = '';
  /** Empty state sentence. */
  @property({ attribute: 'empty-text' }) accessor emptyText = '';

  @state() accessor #expanded = new Set<string>();
  @state() accessor #activeKey = '';
  #focusPending = false;
  #collapsedWhileFiltering = new Set<string>();

  /** Expands every group. */
  expandAll() {
    const all = new Set<string>();
    const walk = (cols: SchemaColumn[], prefix: string) =>
      cols.forEach((c) => {
        const key = prefix ? `${prefix}.${c.name}` : c.name;
        if (c.fields?.length) {
          all.add(key);
          walk(c.fields, key);
        }
      });
    walk(this.columns, '');
    this.#expanded = all;
  }
  /** Collapses every group. */
  collapseAll() {
    this.#expanded = new Set();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    // Top-level groups start open, deeper ones closed.
    if (changed.has('columns')) this.#expanded = new Set(this.columns.filter((c) => c.fields?.length).map((c) => c.name));
    const { rows } = this.#rows();
    if (!rows.some((r) => r.key === this.#activeKey)) this.#activeKey = rows[0]?.key ?? '';
  }

  protected override updated() {
    if (this.#focusPending) {
      this.#focusPending = false;
      this.renderRoot.querySelector<HTMLElement>('.row[tabindex="0"]')?.focus();
    }
  }

  // ---- data ---------------------------------------------------------------

  #find(key: string): SchemaColumn | undefined {
    let cols = this.columns;
    let found: SchemaColumn | undefined;
    for (const part of key.split('.')) {
      found = cols.find((c) => c.name === part);
      if (!found) return undefined;
      cols = found.fields ?? [];
    }
    return found;
  }

  #rows(): { rows: Row[]; shownTop: number } {
    const q = this.filter.trim().toLowerCase();
    const filtering = !!q || this.piiOnly || this.keysOnly;
    const hit = (c: SchemaColumn) => (!q || c.name.toLowerCase().includes(q)) && (!this.piiOnly || !!c.pii) && (!this.keysOnly || !!c.primaryKey);
    const keep = new Set<string>();
    const forced = new Set<string>();
    if (filtering) {
      const visit = (c: SchemaColumn, key: string): boolean => {
        let below = false;
        for (const f of c.fields ?? []) if (visit(f, `${key}.${f.name}`)) below = true;
        if (below) forced.add(key);
        const self = hit(c);
        if (self || below) keep.add(key);
        return self || below;
      };
      this.columns.forEach((c) => visit(c, c.name));
    }
    const rows: Row[] = [];
    const walk = (cols: SchemaColumn[], level: number, parentKey: string) => {
      const keyed = cols.map((c) => ({ c, key: parentKey ? `${parentKey}.${c.name}` : c.name }));
      const shown = filtering ? keyed.filter((k) => keep.has(k.key)) : keyed;
      shown.forEach(({ c, key }, i) => {
        const expandable = !!c.fields?.length;
        const expanded = expandable && (this.#expanded.has(key) || (forced.has(key) && !this.#collapsedWhileFiltering.has(key)));
        rows.push({ key, column: c, level, setsize: shown.length, posinset: i + 1, parentKey, expandable, expanded });
        if (expanded) walk(c.fields!, level + 1, key);
      });
    };
    walk(this.columns, 1, '');
    return { rows, shownTop: rows.filter((r) => r.level === 1).length };
  }

  #toggle(row: Row, open = !row.expanded) {
    if (!row.expandable || row.expanded === open) return;
    const next = new Set(this.#expanded);
    if (open) {
      next.add(row.key);
      this.#collapsedWhileFiltering.delete(row.key);
    } else {
      next.delete(row.key);
      this.#collapsedWhileFiltering.add(row.key);
    }
    this.#expanded = next;
  }

  #open(row: Row) {
    this.selected = row.key;
    emit<MmSelectFieldDetail>(this, 'mm-select-field', { column: row.column, path: row.key });
  }

  #closePanel() {
    if (!this.selected) return;
    this.#activeKey = this.selected;
    this.selected = '';
    this.#focusPending = true;
  }

  // ---- keyboard -----------------------------------------------------------

  #onKeydown = (e: KeyboardEvent) => {
    const rowEl = (e.target as Element).closest?.('.row') as HTMLElement | null;
    if (!rowEl || e.target !== rowEl || e.ctrlKey || e.metaKey || e.altKey) return;
    const { rows } = this.#rows();
    const i = rows.findIndex((r) => r.key === rowEl.dataset.key);
    const row = rows[i];
    if (!row) return;
    const rtl = isRtl(this);
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const go = (n: number) => {
      const r = rows[Math.max(0, Math.min(rows.length - 1, n))];
      if (!r) return;
      this.#activeKey = r.key;
      this.#focusPending = true;
    };
    switch (e.key) {
      case 'ArrowDown':
        go(i + 1);
        break;
      case 'ArrowUp':
        go(i - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(rows.length - 1);
        break;
      case 'PageDown':
        go(i + 10);
        break;
      case 'PageUp':
        go(i - 10);
        break;
      case fwd:
        if (row.expandable && !row.expanded) this.#toggle(row, true);
        else if (row.expanded) go(i + 1);
        break;
      case back:
        if (row.expanded) this.#toggle(row, false);
        else if (row.parentKey) {
          this.#activeKey = row.parentKey;
          this.#focusPending = true;
        }
        break;
      case 'Enter':
        this.#open(row);
        break;
      case 'Escape':
        if (!this.selected) return;
        this.#closePanel();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  #onPanelKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    this.#closePanel();
  };

  #onClick = (e: MouseEvent) => {
    const key = ((e.target as Element).closest('.row') as HTMLElement | null)?.dataset.key;
    if (key === undefined) return;
    this.#activeKey = key;
    const row = this.#rows().rows.find((r) => r.key === key);
    if (!row) return;
    if ((e.target as Element).closest('.twisty')) this.#toggle(row);
    else this.#open(row);
    this.#focusPending = true;
  };

  #onFocusin = (e: FocusEvent) => {
    const key = ((e.target as Element).closest?.('.row') as HTMLElement | null)?.dataset.key;
    if (key !== undefined) this.#activeKey = key;
  };

  // ---- render -------------------------------------------------------------

  #filled(c: SchemaColumn): number | undefined {
    const n = c.stats?.nullPercent;
    return n === undefined ? undefined : Math.max(0, Math.min(100, 100 - n));
  }

  #fmtPct(v: number): string {
    return `${v >= 99.95 || v === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
  }

  #histogram(values: number[]): TemplateResult {
    const max = Math.max(...values, 1);
    const w = 160;
    const h = 28;
    const bw = w / values.length;
    return html`<svg class="hist" width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">
      ${values.map((v, i) => {
        const bh = Math.max(1, (v / max) * h);
        return svg`<rect x=${i * bw + 0.5} y=${h - bh} width=${Math.max(1, bw - 1)} height=${bh} fill="currentColor"></rect>`;
      })}
    </svg>`;
  }

  #renderRow(row: Row, active: boolean): TemplateResult {
    const c = row.column;
    const filled = this.#filled(c);
    return html`<div
      class="row ${this.selected === row.key ? 'selected' : ''}"
      role="row"
      data-key=${row.key}
      style="--_level:${row.level}"
      tabindex=${active ? '0' : '-1'}
      aria-level=${row.level}
      aria-setsize=${row.setsize}
      aria-posinset=${row.posinset}
      aria-selected=${this.selected === row.key ? 'true' : 'false'}
      aria-expanded=${ifDefined(row.expandable ? String(row.expanded) : undefined)}
    >
      <span class="twisty" aria-hidden="true">${row.expandable ? html`<mm-icon name="chevron-right"></mm-icon>` : nothing}</span>
      <span class="line1" role="gridcell">
        <span class="name">${c.name}</span>
        <span class="type">${plainType(c)}</span>
        <span class="markers">
          ${c.primaryKey ? html`<span class="key"><mm-icon name="key" size="14" aria-hidden="true"></mm-icon>${tr('schemaKey', 'Key')}</span>` : nothing}
          ${c.pii ? html`<mm-tag variant="pii"></mm-tag>` : nothing}
          ${c.certified ? html`<mm-tag variant="certified"></mm-tag>` : nothing}
        </span>
      </span>
      <span class="end" role="gridcell">${c.nullable ? tr('schemaOptional', 'Optional') : nothing}</span>
      <span class="line2" role="gridcell">
        <span class="desc ${c.description ? '' : 'none'}"
          >${c.description || tr('schemaNoDescription', 'No description yet')}${c.description && c.descriptionSource === 'user'
            ? html` <span class="edited">${tr('schemaEdited', 'Edited')}</span>`
            : nothing}</span
        >
        ${filled !== undefined && filled < 100 ? html`<span class="filled">${tr('schemaFilledShort', '{pct} filled', { pct: this.#fmtPct(filled) })}</span>` : nothing}
        ${c.glossaryTerms?.length || c.tags?.length
          ? html`<span class="terms">${(c.glossaryTerms ?? []).map((g) => html`<mm-tag>${g}</mm-tag>`)}${(c.tags ?? []).map((g) => html`<mm-tag>${g}</mm-tag>`)}</span>`
          : nothing}
      </span>
    </div>`;
  }

  #renderPanel(c: SchemaColumn, path: string): TemplateResult {
    const s = c.stats;
    const filled = this.#filled(c);
    const fmt = (v: string | number | undefined) => (v === undefined ? '' : typeof v === 'number' ? formatCount(v) : v);
    const hasValues = !!s || !!c.symbols?.length || c.default !== undefined;
    return html`<aside class="panel" part="panel" aria-label=${tr('schemaFieldPanel', 'Field {name}', { name: c.name })} @keydown=${this.#onPanelKeydown}>
      <div class="panel-head">
        <h3>${c.name}</h3>
        <mm-button variant="ghost" size="sm" icon="close" label=${tr('close', 'Close')} @click=${() => this.#closePanel()}></mm-button>
      </div>
      <section>
        <dl>
          <dt>${tr('schemaType', 'Type')}</dt><dd>${plainType(c)}</dd>
          <dt>${tr('schemaExactType', 'Exact type')}</dt><dd class="mono">${c.type}</dd>
          ${c.nullable === undefined ? nothing : html`<dt>${tr('schemaRequired', 'Required')}</dt><dd>${c.nullable ? tr('no', 'No') : tr('yes', 'Yes')}</dd>`}
          ${c.primaryKey ? html`<dt>${tr('schemaKey', 'Key')}</dt><dd>${tr('schemaPrimaryKey', 'Primary key')}</dd>` : nothing}
          <dt>${tr('schemaPersonalData', 'Personal data')}</dt><dd>${c.pii ? html`<mm-tag variant="pii"></mm-tag>` : tr('none', 'None')}</dd>
        </dl>
      </section>
      <section>
        <h4>${tr('schemaAbout', 'About')}</h4>
        <div class=${c.description ? '' : 'edited'}>${c.description || tr('schemaNoDescription', 'No description yet')}</div>
        ${this.editable
          ? html`<mm-button style="margin-block-start: var(--space-3)" size="sm" icon="edit" @click=${() => emit<MmEditDescriptionDetail>(this, 'mm-edit-description', { column: c, path })}
              >${tr('schemaEditDescriptionShort', 'Edit description')}</mm-button
            >`
          : nothing}
      </section>
      ${c.glossaryTerms?.length || c.tags?.length
        ? html`<section>
            <h4>${tr('schemaMeaning', 'What it means')}</h4>
            <div class="chips">${(c.glossaryTerms ?? []).map((g) => html`<mm-tag>${g}</mm-tag>`)}${(c.tags ?? []).map((g) => html`<mm-tag>${g}</mm-tag>`)}</div>
          </section>`
        : nothing}
      ${hasValues
        ? html`<section>
            <h4>${tr('schemaValues', 'Values')}</h4>
            <dl>
              ${filled !== undefined ? html`<dt>${tr('schemaFilled', 'Filled')}</dt><dd>${this.#fmtPct(filled)}</dd>` : nothing}
              ${s?.distinct !== undefined ? html`<dt>${tr('schemaDistinct', 'Distinct')}</dt><dd>${formatCount(s.distinct)}</dd>` : nothing}
              ${s?.min !== undefined ? html`<dt>${tr('schemaRange', 'Range')}</dt><dd>${fmt(s.min)} to ${fmt(s.max)}</dd>` : nothing}
              ${c.symbols?.length ? html`<dt>${tr('schemaAllowed', 'Allowed')}</dt><dd class="mono">${c.symbols.join(', ')}</dd>` : nothing}
              ${c.default !== undefined ? html`<dt>${tr('schemaDefault', 'Default')}</dt><dd class="mono">${String(c.default)}</dd>` : nothing}
            </dl>
            ${s?.distribution?.length ? this.#histogram(s.distribution) : nothing}
          </section>`
        : nothing}
      ${c.access
        ? html`<section>
            <h4>${tr('schemaAccess', 'Who can see it')}</h4>
            <div>${c.access}</div>
          </section>`
        : nothing}
      <section>
        <h4>${tr('schemaPath', 'Path')}</h4>
        <div class="path"><code>${path}</code><mm-copy-button size="sm" value=${path} label=${tr('schemaCopyPath', 'Copy path')}></mm-copy-button></div>
      </section>
    </aside>`;
  }

  /** The document behind the JSON and YAML views. */
  #document(): unknown {
    if (typeof this.source === 'string') {
      try {
        return JSON.parse(this.source);
      } catch {
        return this.source;
      }
    }
    if (this.source !== undefined) return this.source;
    const plain = (c: SchemaColumn): Record<string, unknown> => ({
      name: c.name,
      type: c.type,
      ...(c.nullable ? { nullable: true } : {}),
      ...(c.symbols?.length ? { symbols: c.symbols } : {}),
      ...(c.description ? { description: c.description } : {}),
      ...(c.fields?.length ? { fields: c.fields.map(plain) } : {}),
    });
    return this.columns.map(plain);
  }

  #viewSwitch() {
    return html`<mm-segmented-control
      label=${tr('schemaView', 'Schema view')}
      hide-label
      value=${this.view}
      @mm-change=${(e: CustomEvent<{ value: 'structure' | 'json' | 'yaml' }>) => {
        e.stopPropagation();
        this.view = e.detail.value;
      }}
    >
      <mm-segment value="structure">${tr('schemaStructure', 'Structure')}</mm-segment>
      <mm-segment value="json">JSON</mm-segment>
      <mm-segment value="yaml">YAML</mm-segment>
    </mm-segmented-control>`;
  }

  #renderToolbar() {
    if (this.view !== 'structure') return html`<div class="toolbar" part="toolbar"><div class="end">${this.#viewSwitch()}</div></div>`;
    const anyPii = (cols: SchemaColumn[]): boolean => cols.some((c) => c.pii || anyPii(c.fields ?? []));
    const anyKey = (cols: SchemaColumn[]): boolean => cols.some((c) => c.primaryKey || anyKey(c.fields ?? []));
    const nested = this.columns.some((c) => c.fields?.length);
    const anyExpanded = this.#expanded.size > 0;
    return html`<div class="toolbar" part="toolbar">
      <mm-search-field
        label=${tr('schemaFind', 'Find a field')}
        hide-label
        placeholder=${tr('schemaFindPlaceholder', 'Find a field')}
        .value=${this.filter}
        @mm-input=${(e: CustomEvent<{ value: string }>) => {
          this.filter = e.detail.value;
          this.#collapsedWhileFiltering.clear();
        }}
      ></mm-search-field>
      ${anyPii(this.columns)
        ? html`<mm-filter-pill ?pressed=${this.piiOnly} @mm-change=${(e: CustomEvent<{ pressed: boolean }>) => ((this.piiOnly = e.detail.pressed), this.#collapsedWhileFiltering.clear())}
            >${tr('schemaPersonalData', 'Personal data')}</mm-filter-pill
          >`
        : nothing}
      ${anyKey(this.columns)
        ? html`<mm-filter-pill ?pressed=${this.keysOnly} @mm-change=${(e: CustomEvent<{ pressed: boolean }>) => ((this.keysOnly = e.detail.pressed), this.#collapsedWhileFiltering.clear())}
            >${tr('schemaKeys', 'Keys')}</mm-filter-pill
          >`
        : nothing}
      <div class="end">
        ${nested
          ? html`<mm-button variant="ghost" size="sm" icon=${anyExpanded ? 'unfold-less' : 'unfold-more'} @click=${() => (anyExpanded ? this.collapseAll() : this.expandAll())}
              >${anyExpanded ? tr('schemaCollapseAll', 'Collapse all') : tr('schemaExpandAll', 'Expand all')}</mm-button
            >`
          : nothing}
        <mm-button
          variant="ghost"
          size="sm"
          icon="density-small"
          pressed=${this.density === 'compact' ? 'true' : 'false'}
          @click=${() => (this.density = this.density === 'compact' ? 'comfortable' : 'compact')}
          >${tr('schemaCompact', 'Compact')}</mm-button
        >
        ${this.#viewSwitch()}
      </div>
    </div>`;
  }

  override render() {
    if (this.loading) return html`<mm-skeleton loading shape="table-row" count="6" columns="3"></mm-skeleton>`;
    if (this.error) {
      return html`<div class="message" role="alert">
        <span class="why"><mm-icon name="error" aria-hidden="true"></mm-icon>${this.error}</span>
        <mm-button size="sm" icon="refresh" @click=${() => emit(this, 'mm-retry', null)}>${tr('retry', 'Retry')}</mm-button>
      </div>`;
    }
    if (!this.columns.length) {
      return html`<mm-empty-state
        compact
        heading=${tr('schemaEmptyHeading', 'No schema yet')}
        description=${this.emptyText || tr('schemaEmpty', 'Plugins that read schemas fill this in on their next run.')}
      ></mm-empty-state>`;
    }
    const toolbar = this.hideToolbar ? nothing : this.#renderToolbar();
    if (this.view !== 'structure') {
      const doc = this.#document();
      const code = this.view === 'json' ? (typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2)) : toYaml(doc);
      return html`${toolbar}<mm-code-sample part="text" language=${this.view} label=${`${this.label || tr('schemaLabel', 'Schema')}, ${this.view.toUpperCase()}`} .code=${code}></mm-code-sample>`;
    }
    const { rows } = this.#rows();
    const sel = this.selected ? this.#find(this.selected) : undefined;
    return html`${toolbar}
      <div class="layout ${sel ? 'with-panel' : ''}">
        <div>
          <div
            class="outline"
            part="outline"
            role="treegrid"
            aria-label=${this.label || tr('schemaLabel', 'Schema')}
            @keydown=${this.#onKeydown}
            @click=${this.#onClick}
            @focusin=${this.#onFocusin}
          >
            ${rows.map((r) => this.#renderRow(r, r.key === this.#activeKey))}
          </div>
          ${rows.length
            ? nothing
            : html`<p class="no-match" role="status">${this.filter.trim()
                ? tr('schemaNoMatches', 'No fields match “{filter}”.', { filter: this.filter.trim() })
                : tr('schemaNoFiltered', 'No fields match these filters.')}</p>`}
        </div>
        ${sel ? this.#renderPanel(sel, this.selected) : nothing}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-schema-table': MmSchemaTable;
  }
}
