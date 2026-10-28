import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { emit } from '../../core/events.js';
import { deepActive } from '../../core/floating.js';
import { formatBytes, formatCount } from '../../core/format.js';
import { uid } from '../../core/id.js';
import { isRtl } from '../../core/roving.js';
import { t, tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../copy-button/define.js';
import '../tooltip/define.js';
import '../search-field/define.js';
import '../empty-state/define.js';
import '../code-sample/define.js';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

interface Row {
  path: string;
  key: string;
  /** Array index rows show `[0]` instead of a key. */
  index: boolean;
  value: unknown;
  level: number;
  setsize: number;
  posinset: number;
  parentPath: string;
  expandable: boolean;
  expanded: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const TYPEAHEAD_MS = 500;

const isContainer = (v: unknown): v is Record<string, unknown> | unknown[] => typeof v === 'object' && v !== null;
const isSimpleList = (v: unknown): v is unknown[] => Array.isArray(v) && v.every((x) => !isContainer(x));
const entriesOf = (v: Record<string, unknown> | unknown[]): [string, unknown][] =>
  Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;inset-block-start:0;opacity:0;pointer-events:none';
    document.body.append(ta);
    const active = deepActive() as HTMLElement | null;
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    active?.focus?.({ preventScroll: true });
    return ok;
  }
}

/**
 * The metadata viewer shows the key and value metadata a plugin recorded for an asset: Snowflake
 * clustering keys and retention, dbt materialisation and dependencies, Kafka topic config. Top-level
 * keys read as a description list, keys in quiet mono (people copy them) and values beside them;
 * nested objects and lists of objects fold away behind a preview of their keys, and clicking anywhere
 * on such a row opens it. Every value uses the text face and ink: URLs as links (underlined on hover
 * and focus), ISO dates formatted with the raw value in a tooltip, numbers with tabular figures,
 * true and false as "Yes" and "No", null as "Not set". Lists of plain values read inline, comma
 * separated. Every row offers "Copy value" and "Copy path"
 * (e.g. `metadata.config.materialized`) on hover and focus. Search filters keys and values and
 * opens the path to each match. "View raw JSON" swaps the list for the pretty-printed JSON on the
 * code ground.
 *
 * It is a tree (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) with a roving tab stop: Down
 * and Up move, Right expands or moves to the first child, Left collapses or moves to the parent
 * (flipped in right-to-left), Home and End jump, Enter toggles a nested value or follows a link,
 * `*` expands siblings and typing a key name moves to it. Tab moves to the focused row's copy
 * buttons.
 *
 * @tagname mm-metadata-viewer
 * @summary JSON-aware key and value metadata.
 * @csspart toolbar - The search, raw toggle and key count row.
 * @csspart tree - The element with role tree.
 * @csspart row - Each row.
 * @csspart raw - The raw JSON code sample.
 * @cssprop --mm-metadata-key-width - Width of the key column. Defaults to 12rem.
 * @fires mm-copy - {{ value: string, kind: 'value' | 'path' }} A value or path was copied.
 * @fires mm-toggle-raw - {{ raw: boolean }} The raw JSON view was turned on or off.
 */
export class MmMetadataViewer extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        font: var(--text-dense);
        color: var(--mm-text);
        --_key: var(--mm-metadata-key-width, 12rem);
        --_indent: var(--space-4);
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
      .end {
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .readout {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .tree {
        display: flex;
        flex-direction: column;
      }
      .row {
        display: grid;
        grid-template-columns: var(--_key) minmax(0, 1fr) auto;
        align-items: start;
        gap: var(--space-4);
        min-height: calc(var(--mm-row, var(--row-default)) - var(--space-2));
        padding-block: var(--space-1);
        padding-inline: var(--space-1);
        border-radius: var(--radius-sm);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .row + .row {
        border-block-start: 1px solid var(--mm-rule);
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      .row[aria-expanded] {
        cursor: pointer;
      }
      .row:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: -2px;
      }
      .key {
        display: flex;
        align-items: flex-start;
        gap: var(--space-1);
        min-width: 0;
        padding-inline-start: calc((var(--_level, 1) - 1) * var(--_indent));
        padding-block-start: 3px;
      }
      .k {
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
        padding-block-start: 1px;
      }
      .k.index {
        color: var(--mm-text-3);
      }
      .twisty {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        color: var(--mm-text-2);
        cursor: pointer;
      }
      .twisty mm-icon {
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      .twisty:dir(rtl) mm-icon {
        transform: scaleX(-1);
      }
      .row[aria-expanded='true'] .twisty mm-icon {
        transform: rotate(90deg);
      }
      .v {
        min-width: 0;
        padding-block-start: 3px;
        overflow-wrap: anywhere;
      }
      .mono {
        font: var(--text-mono-dense);
      }
      /* One text face and ink for every value; keys are the only mono, because people copy them. */
      .num {
        font-variant-numeric: tabular-nums;
      }
      .null {
        color: var(--mm-text-3);
      }
      .sep {
        color: var(--mm-text-3);
      }
      .preview {
        color: var(--mm-text-2);
        margin-inline-start: var(--space-2);
        font: var(--text-caption);
      }
      .aside {
        color: var(--mm-text-3);
        margin-inline-start: var(--space-2);
      }
      /* Links in rows are ink, underlined on hover and focus. */
      a {
        color: var(--mm-text);
        text-decoration: none;
      }
      a:hover,
      a:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      mark {
        background: none;
        color: inherit;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .actions {
        display: inline-flex;
        gap: 2px;
        visibility: hidden;
        margin-block: -2px;
      }
      .row:hover .actions,
      .row:focus .actions,
      .row:focus-within .actions {
        visibility: visible;
      }
      .message {
        padding: var(--space-3) var(--space-1);
        color: var(--mm-text-2);
      }
      @media (max-width: 40rem) {
        .row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .v {
          grid-column: 1;
          padding-inline-start: calc((var(--_level, 1) - 1) * var(--_indent) + 20px);
        }
        .actions {
          grid-row: 1;
          grid-column: 2;
        }
      }
    `,
  ];

  /** The metadata object (or any JSON value). */
  @property({ attribute: false }) accessor metadata: unknown = {};
  /** Accessible name, e.g. "Metadata of shop.public.orders". */
  @property() accessor label = '';
  /** Prefix for copied paths. */
  @property({ attribute: 'root-path' }) accessor rootPath = 'metadata';
  /** Show the pretty-printed JSON instead of the list. */
  @property({ type: Boolean, reflect: true }) accessor raw = false;
  /** Search text that filters keys and values. */
  @property() accessor search = '';
  /** Hides the search, raw toggle and readout. */
  @property({ type: Boolean, attribute: 'hide-toolbar' }) accessor hideToolbar = false;
  /** Sentence for the empty state. */
  @property({ attribute: 'empty-text' }) accessor emptyText = '';
  /** Nested values open on first render down to this depth (0 keeps everything folded). */
  @property({ type: Number, attribute: 'expand-depth' }) accessor expandDepth = 0;

  @state() accessor #expanded = new Set<string>();
  @state() accessor #activePath = '';
  @state() accessor #copiedPath = '';
  #collapsedWhileSearching = new Set<string>();
  #focusPending = false;
  #prefix = uid('mm-md');
  #ids = new Map<string, string>();
  #typeahead = '';
  #typeaheadTimer?: ReturnType<typeof setTimeout>;
  #copiedTimer?: ReturnType<typeof setTimeout>;

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.#typeaheadTimer);
    clearTimeout(this.#copiedTimer);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('metadata') || changed.has('expandDepth')) {
      const open = new Set<string>();
      const walk = (v: unknown, path: string, depth: number) => {
        if (!isContainer(v) || depth >= this.expandDepth) return;
        open.add(path);
        for (const [k, x] of entriesOf(v)) walk(x, this.#join(path, k, Array.isArray(v)), depth + 1);
      };
      if (isContainer(this.metadata)) for (const [k, x] of entriesOf(this.metadata)) walk(x, this.#join(this.rootPath, k, Array.isArray(this.metadata)), 0);
      this.#expanded = open;
    }
    if (changed.has('search')) this.#collapsedWhileSearching.clear();
    const rows = this.#rows();
    if (!rows.some((r) => r.path === this.#activePath)) this.#activePath = rows[0]?.path ?? '';
  }

  protected override updated() {
    if (this.#focusPending) {
      this.#focusPending = false;
      this.renderRoot.querySelector<HTMLElement>('[role=treeitem][tabindex="0"]')?.focus();
    }
  }

  #join(parent: string, key: string, index: boolean): string {
    if (index) return `${parent}[${key}]`;
    return IDENT.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
  }

  #id(path: string): string {
    let id = this.#ids.get(path);
    if (!id) {
      id = `${this.#prefix}-${this.#ids.size}`;
      this.#ids.set(path, id);
    }
    return id;
  }

  // ---- data ---------------------------------------------------------------

  #text(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'string') return v;
    if (isContainer(v)) return '';
    return String(v);
  }

  #rows(): Row[] {
    const q = this.search.trim().toLowerCase();
    const root = this.metadata;
    if (!isContainer(root)) return [];
    const keep = new Set<string>();
    const forced = new Set<string>();
    const selfHit = new Set<string>();
    if (q) {
      const visit = (key: string, v: unknown, path: string): boolean => {
        let below = false;
        if (isContainer(v)) for (const [k, x] of entriesOf(v)) if (visit(k, x, this.#join(path, k, Array.isArray(v)))) below = true;
        const self = key.toLowerCase().includes(q) || this.#text(v).toLowerCase().includes(q);
        if (self) selfHit.add(path);
        if (below) forced.add(path);
        if (self || below) keep.add(path);
        return self || below;
      };
      for (const [k, x] of entriesOf(root)) visit(k, x, this.#join(this.rootPath, k, Array.isArray(root)));
    }
    const rows: Row[] = [];
    const walk = (v: Record<string, unknown> | unknown[], parentPath: string, level: number, filtered: boolean) => {
      const index = Array.isArray(v);
      const all = entriesOf(v).map(([k, x]) => ({ k, x, path: this.#join(parentPath, k, index) }));
      const shown = filtered ? all.filter((e) => keep.has(e.path)) : all;
      shown.forEach(({ k, x, path }, i) => {
        const expandable = isContainer(x) && !isSimpleList(x) && entriesOf(x).length > 0;
        const expanded =
          expandable && (q && forced.has(path) ? !this.#collapsedWhileSearching.has(path) : this.#expanded.has(path));
        rows.push({ path, key: k, index, value: x, level, setsize: shown.length, posinset: i + 1, parentPath: level > 1 ? parentPath : '', expandable, expanded });
        // Under a match, show its contents unfiltered; above one, keep filtering.
        if (expanded) walk(x as Record<string, unknown> | unknown[], path, level + 1, filtered && !selfHit.has(path));
      });
    };
    walk(root, this.rootPath, 1, !!q);
    return rows;
  }

  #toggle(row: Row, open = !row.expanded) {
    if (!row.expandable || row.expanded === open) return;
    const next = new Set(this.#expanded);
    if (open) {
      next.add(row.path);
      this.#collapsedWhileSearching.delete(row.path);
    } else {
      next.delete(row.path);
      if (this.search.trim()) this.#collapsedWhileSearching.add(row.path);
    }
    this.#expanded = next;
  }

  // ---- keyboard -----------------------------------------------------------

  #onKeydown = (e: KeyboardEvent) => {
    const item = e.target as HTMLElement;
    if (item.getAttribute?.('role') !== 'treeitem' || e.ctrlKey || e.metaKey || e.altKey) return;
    const rows = this.#rows();
    const i = rows.findIndex((r) => r.path === item.dataset.path);
    const row = rows[i];
    if (!row) return;
    const rtl = isRtl(this);
    const go = (path: string | undefined) => {
      if (path === undefined) return;
      this.#activePath = path;
      this.#focusPending = true;
    };
    const at = (n: number) => rows[Math.max(0, Math.min(rows.length - 1, n))]?.path;
    switch (e.key) {
      case 'ArrowDown':
        go(at(i + 1));
        break;
      case 'ArrowUp':
        go(at(i - 1));
        break;
      case 'Home':
        go(at(0));
        break;
      case 'End':
        go(at(rows.length - 1));
        break;
      case rtl ? 'ArrowLeft' : 'ArrowRight':
        if (row.expandable && !row.expanded) this.#toggle(row, true);
        else if (row.expanded) go(at(i + 1));
        break;
      case rtl ? 'ArrowRight' : 'ArrowLeft':
        if (row.expanded) this.#toggle(row, false);
        else if (row.parentPath) go(row.parentPath);
        break;
      case 'Enter':
        if (row.expandable) this.#toggle(row);
        else item.querySelector<HTMLAnchorElement>('a')?.click();
        break;
      case '*':
        rows.filter((r) => r.parentPath === row.parentPath && r.level === row.level).forEach((r) => this.#toggle(r, true));
        break;
      default:
        if (e.key.length === 1 && e.key.trim()) {
          this.#onTypeahead(rows, i, e.key.toLowerCase());
          break;
        }
        return;
    }
    e.preventDefault();
  };

  #onTypeahead(rows: Row[], i: number, ch: string) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), TYPEAHEAD_MS);
    this.#typeahead += ch;
    const needle = this.#typeahead;
    const start = needle.length === 1 ? i + 1 : i;
    for (let k = 0; k < rows.length; k++) {
      const r = rows[(start + k) % rows.length]!;
      if (r.key.toLowerCase().startsWith(needle)) {
        this.#activePath = r.path;
        this.#focusPending = true;
        return;
      }
    }
  }

  #onClick = (e: MouseEvent) => {
    const item = (e.target as Element).closest<HTMLElement>('[role=treeitem]');
    const path = item?.dataset.path;
    if (path === undefined) return;
    this.#activePath = path;
    // Anywhere on a group row opens or closes it, except its links and copy buttons.
    if ((e.target as Element).closest('a, .actions')) return;
    const row = this.#rows().find((r) => r.path === path);
    if (row?.expandable) this.#toggle(row);
    this.#focusPending = true;
  };

  #onFocusin = (e: FocusEvent) => {
    const path = (e.target as Element).closest?.<HTMLElement>('[role=treeitem]')?.dataset.path;
    if (path !== undefined) this.#activePath = path;
  };

  async #copyPath(path: string) {
    if (!(await writeClipboard(path))) return;
    this.#copiedPath = path;
    clearTimeout(this.#copiedTimer);
    this.#copiedTimer = setTimeout(() => (this.#copiedPath = ''), 1500);
    emit(this, 'mm-copy', { value: path, kind: 'path' });
  }

  // ---- render -------------------------------------------------------------

  #mark(text: string): TemplateResult | string {
    const q = this.search.trim().toLowerCase();
    if (!q) return text;
    const at = text.toLowerCase().indexOf(q);
    if (at < 0) return text;
    return html`${text.slice(0, at)}<mark>${text.slice(at, at + q.length)}</mark>${text.slice(at + q.length)}`;
  }

  #formatDate(raw: string): string {
    const d = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
    if (Number.isNaN(d.getTime())) return raw;
    const dateOnly = raw.length === 10;
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }),
      ...(dateOnly ? { timeZone: 'UTC' } : {}),
    }).format(d);
  }

  #value(row: Row, active: boolean): TemplateResult {
    const v = row.value;
    if (isSimpleList(v)) {
      // A list of plain values reads inline, so it never needs opening.
      if (!v.length) return html`<span class="null">${tr('metadataEmptyList', 'None')}</span>`;
      return html`${v.map((x, i) => html`${i ? html`<span class="sep">, </span>` : nothing}${this.#leaf(x, row.key, active)}`)}`;
    }
    if (isContainer(v)) {
      if (row.expanded) return html``;
      const n = entriesOf(v).length;
      const count = Array.isArray(v)
        ? n === 1
          ? tr('metadataOneItem', '1 item')
          : tr('metadataItems', '{count} items', { count: formatCount(n) })
        : n === 1
          ? tr('metadataOneKey', '1 key')
          : tr('metadataKeys', '{count} keys', { count: formatCount(n) });
      // A closed object previews its keys; the count is for screen readers only. The preview is
      // visible, so it is part of the row's name too (a visible label must be in the name).
      const preview = Array.isArray(v) ? '' : Object.keys(v).join(', ');
      // The count comes after the preview, so the row's name starts with exactly what is shown.
      return html`${preview
        ? html`<span class="preview">${this.#mark(preview.length > 80 ? `${preview.slice(0, 80)}…` : preview)}</span>`
        : nothing}<span class="visually-hidden">${preview ? `, ${count}` : count}</span>`;
    }
    return this.#leaf(v, row.key, active);
  }

  /** One plain value, coloured by its type. */
  #leaf(v: unknown, key: string, active: boolean): TemplateResult {
    if (v === null) return html`<span class="null">${tr('metadataNotSet', 'Not set')}</span>`;
    if (typeof v === 'boolean') return html`<span>${v ? tr('yes', 'Yes') : tr('no', 'No')}</span>`;
    if (typeof v === 'number') {
      const bytes = /bytes$/i.test(key) && Number.isFinite(v) && v >= 1000;
      return html`<span class="num">${this.#mark(Number.isInteger(v) ? formatCount(v) : String(v))}</span>${bytes
          ? html`<span class="aside">${formatBytes(v)}</span>`
          : nothing}`;
    }
    const s = String(v);
    if (URL_RE.test(s)) {
      return html`<a href=${s} target="_blank" rel="noopener noreferrer" tabindex=${active ? '0' : '-1'}>${this.#mark(s)}</a>`;
    }
    if (ISO_DATE.test(s)) {
      return html`<mm-tooltip content=${s}><time datetime=${s}>${this.#mark(this.#formatDate(s))}</time></mm-tooltip>`;
    }
    return html`<span>${this.#mark(s)}</span>`;
  }

  #copyValue(v: unknown): string {
    return isContainer(v) ? JSON.stringify(v, null, 2) : this.#text(v);
  }

  #renderRow(row: Row, active: boolean): TemplateResult {
    const id = this.#id(row.path);
    const keyText = row.index ? tr('metadataItem', 'Item {n}', { n: Number(row.key) + 1 }) : row.key;
    const copied = this.#copiedPath === row.path;
    return html`<div
      role="treeitem"
      part="row"
      class="row"
      id=${id}
      data-path=${row.path}
      tabindex=${active ? '0' : '-1'}
      aria-level=${row.level}
      aria-setsize=${row.setsize}
      aria-posinset=${row.posinset}
      aria-expanded=${ifDefined(row.expandable ? String(row.expanded) : undefined)}
      aria-labelledby="${id}-k ${id}-v"
      style="--_level:${row.level}"
    >
      <span class="key">
        <span class="twisty" aria-hidden="true">${row.expandable ? html`<mm-icon name="chevron-right"></mm-icon>` : nothing}</span>
        <span class="k ${row.index ? 'index' : ''}" id="${id}-k">${this.#mark(keyText)}</span>
      </span>
      <span class="v" id="${id}-v">${this.#value(row, active)}</span>
      <span class="actions">
        <mm-copy-button
          size="sm"
          label=${tr('metadataCopyValue', 'Copy value')}
          .value=${this.#copyValue(row.value)}
          @mm-copy=${(e: CustomEvent<{ value: string }>) => {
            e.stopPropagation();
            emit(this, 'mm-copy', { value: e.detail.value, kind: 'value' });
          }}
        ></mm-copy-button>
        <mm-button
          variant="ghost"
          size="sm"
          icon=${copied ? 'check' : 'link'}
          label=${copied ? t('copied') : tr('metadataCopyPath', 'Copy path')}
          tabindex=${active ? '0' : '-1'}
          @click=${() => this.#copyPath(row.path)}
        ></mm-button>
      </span>
    </div>`;
  }

  #renderToolbar(count: number) {
    return html`<div class="toolbar" part="toolbar">
      ${this.raw
        ? nothing
        : html`<mm-search-field
            label=${tr('metadataSearch', 'Search metadata')}
            hide-label
            placeholder=${tr('metadataSearchPlaceholder', 'Search keys and values')}
            .value=${this.search}
            @mm-input=${(e: CustomEvent<{ value: string }>) => (this.search = e.detail.value)}
          ></mm-search-field>`}
      <div class="end">
        <span class="readout">${count === 1 ? tr('metadataCountOne', '1 key') : tr('metadataCount', '{count} keys', { count: formatCount(count) })}</span>
        <mm-button
          variant="secondary"
          size="sm"
          icon="data-object"
          pressed=${this.raw ? 'true' : 'false'}
          @click=${() => {
            this.raw = !this.raw;
            emit(this, 'mm-toggle-raw', { raw: this.raw });
          }}
          >${tr('metadataViewRaw', 'View raw JSON')}</mm-button
        >
      </div>
    </div>`;
  }

  override render() {
    const root = this.metadata;
    const count = isContainer(root) ? entriesOf(root).length : 0;
    if (!count) {
      return html`<mm-empty-state
        compact
        heading=${tr('metadataEmptyHeading', 'No metadata')}
        description=${this.emptyText || tr('metadataEmpty', 'Plugins add metadata on their next run.')}
      ></mm-empty-state>`;
    }
    const toolbar = this.hideToolbar ? nothing : this.#renderToolbar(count);
    // One template for both views, so the toolbar (and the focused raw toggle) survives the switch.
    return html`${toolbar}${this.raw ? this.#renderRaw(root) : this.#renderTree()}`;
  }

  #renderRaw(root: unknown) {
    return html`<mm-code-sample part="raw" language="json" label=${tr('metadataRawLabel', 'Raw metadata JSON')} .code=${JSON.stringify(root as Json, null, 2)}></mm-code-sample>`;
  }

  #renderTree() {
    const rows = this.#rows();
    const q = this.search.trim();
    return html`<div
        part="tree"
        class="tree"
        role="tree"
        aria-label=${this.label || tr('metadataLabel', 'Metadata')}
        ?hidden=${!rows.length}
        @keydown=${this.#onKeydown}
        @click=${this.#onClick}
        @focusin=${this.#onFocusin}
      >
        ${rows.map((r) => this.#renderRow(r, r.path === this.#activePath))}
      </div>
      ${q && !rows.length ? html`<p class="message">${tr('metadataNoMatches', 'No keys or values match “{search}”.', { search: q })}</p>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-metadata-viewer': MmMetadataViewer;
  }
}
