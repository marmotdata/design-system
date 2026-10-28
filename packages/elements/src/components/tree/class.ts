import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { virtualize, virtualizerRef, type VirtualizerHostElement } from '@lit-labs/virtualizer/virtualize.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { isRtl } from '../../core/roving.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import type { TagVariant } from '../tag/class.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../tag/define.js';
import '../search-field/define.js';
import '../skeleton/define.js';
import '../empty-state/define.js';

/** A small tag on a node, such as "PII" or "View". */
export interface TreeBadge {
  label: string;
  variant?: TagVariant;
}

/** An action offered on a node on hover and focus, such as "Insert into editor". */
export interface TreeAction {
  id: string;
  label: string;
  /** Material Symbols icon name. */
  icon: string;
}

/** One node. Give `children` for a static tree, or `hasChildren` and a `loadChildren` on the tree to load them on expand. */
export interface TreeNode {
  id: string;
  label: string;
  /** Material Symbols icon name. Ignored when `provider` is set. */
  icon?: string;
  /** Provider key for a full-colour logo, e.g. `postgresql`. */
  provider?: string;
  /** Secondary text after the label: a column type or a row count. */
  secondary?: string;
  /** Set the secondary text in mono, for a column type. Defaults to false: counts are in the text face with tabular figures. */
  secondaryMono?: boolean;
  badges?: TreeBadge[];
  children?: TreeNode[];
  /** The node has children that `loadChildren` will fetch. */
  hasChildren?: boolean;
  disabled?: boolean;
  /** Per-node actions. Overrides the tree's `actions`. */
  actions?: TreeAction[];
  /** Anything you need back in events. */
  data?: unknown;
}

export type TreeLoader = (node: TreeNode, signal: AbortSignal) => Promise<TreeNode[]>;

export interface MmTreeNodeDetail {
  node: TreeNode;
}
export interface MmTreeSelectDetail {
  node: TreeNode;
  /** Every selected node id, in selection order. */
  selected: string[];
}
export interface MmTreeExpandDetail {
  node: TreeNode;
  expanded: boolean;
}
export interface MmTreeActionDetail {
  action: string;
  node: TreeNode;
}

type NodeRow = {
  kind: 'node';
  key: string;
  node: TreeNode;
  level: number;
  setsize: number;
  posinset: number;
  parent: TreeNode | null;
  expandable: boolean;
  expanded: boolean;
};
type StatusRow = { kind: 'loading' | 'error'; key: string; parent: TreeNode; level: number; message?: string };
type Row = NodeRow | StatusRow;

interface LoadState {
  status: 'loading' | 'error';
  controller: AbortController;
  /** The loading row is shown only after 200ms, then kept at least 400ms. */
  visibleAt: number;
  timer?: ReturnType<typeof setTimeout>;
  message?: string;
}

const TYPEAHEAD_MS = 500;

/**
 * Trees show nested things one level at a time: the query source browser (source, database,
 * schema, table, column), a dbt project, folders of dashboards. Rows are dense (32px, 28px in
 * compact density), with a chevron, a provider logo or icon, the label, quiet secondary text (a row
 * count in tabular figures, or a column type in mono with `secondaryMono`), optional tags, and
 * actions that appear on hover and focus.
 *
 * Nodes may be static (`children`) or loaded on expand: give a node `hasChildren` and set
 * `loadChildren(node, signal)` on the tree. A "Loading" row appears only if loading takes longer
 * than 200ms; a failure shows an error row that retries on Enter, Space or click. With
 * `filterable`, a filter field above the tree highlights matching labels and expands their
 * ancestors (among loaded nodes).
 *
 * Only visible rows are rendered (`@lit-labs/virtualizer`), so 50,000 nodes stay fast. The tree
 * grows with its content up to `--mm-tree-height` and then scrolls.
 *
 * Keyboard follows the WAI-ARIA tree view pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/):
 * focus stays on the tree and the active row is `aria-activedescendant`. Down and Up move; Right
 * expands, or moves to the first child; Left collapses, or moves to the parent (both flipped in
 * right-to-left); Home and End go to the first and last row; Enter activates (`mm-activate`);
 * Space selects (`mm-select`; with `selection="multiple"` it toggles); `*` expands every sibling;
 * typing a few letters moves to the next row starting with them. Tab moves to the active row's
 * actions, then out of the tree. Clicking a row selects it, clicking the chevron toggles it, and
 * double-clicking activates it.
 *
 * @tagname mm-tree
 * @summary A virtualised, lazy-loading tree view.
 * @slot empty - Shown when there are no nodes. Defaults to a compact empty state using `empty-text`.
 * @csspart filter - The filter field.
 * @csspart tree - The element with role tree.
 * @csspart row - Each row.
 * @cssprop --mm-tree-height - The height at which the tree stops growing and scrolls. Defaults to 24rem; use 100% to fill a sized parent.
 * @fires mm-select - {MmTreeSelectDetail} A node was selected or deselected with Space or a click.
 * @fires mm-activate - {MmTreeNodeDetail} A node was activated with Enter or a double-click.
 * @fires mm-expand - {MmTreeExpandDetail} A node was expanded or collapsed by the person.
 * @fires mm-action - {MmTreeActionDetail} A row action was clicked.
 * @fires mm-retry - {null} The retry button in the error state was activated.
 */
export class MmTree extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-height: 0;
        min-width: 0;
        font: var(--text-dense);
        color: var(--mm-text);
        --_row: calc(var(--mm-row, var(--row-default)) - var(--space-2));
        --_indent: var(--space-4);
      }
      mm-search-field {
        flex: none;
      }
      .tree {
        position: relative;
        flex: 0 1 auto;
        min-height: 0;
        height: min(calc(var(--_n, 1) * var(--_row)), var(--mm-tree-height, 24rem));
        overflow: auto;
        overscroll-behavior: contain;
        border-radius: var(--radius-sm);
      }
      .tree:focus-visible {
        outline: none;
      }
      .tree:focus-visible .row.active {
        outline: 2px solid var(--mm-text);
        outline-offset: -2px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        height: var(--_row);
        padding-inline-start: calc(var(--space-1) + (var(--_level, 1) - 1) * var(--_indent));
        padding-inline-end: var(--space-1);
        border-radius: var(--radius-sm);
        cursor: default;
        white-space: nowrap;
        user-select: none;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      .row[aria-selected='true'] {
        background: var(--mm-selected);
        color: var(--mm-text);
      }
      .row[aria-disabled='true'] .label {
        color: var(--mm-text-3);
      }
      .twisty {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        margin-inline-end: calc(-1 * var(--space-1));
        color: var(--mm-text-2);
        border-radius: var(--radius-sm);
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
      .twisty.leaf {
        cursor: default;
      }
      .glyph {
        flex: none;
        color: var(--mm-text-2);
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      mark {
        background: none;
        color: inherit;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .secondary {
        /* The label has priority: the secondary text gives up its room (down to nothing) before the
           label starts to truncate. */
        flex: 0 1000 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--mm-text-3);
        font-variant-numeric: tabular-nums;
      }
      .secondary.mono {
        font: var(--text-mono-dense);
      }
      .row[aria-selected='true'] .secondary {
        color: var(--mm-text-2);
      }
      .badges {
        display: inline-flex;
        gap: var(--space-1);
        flex: none;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .actions {
        display: none;
        flex: none;
        gap: 2px;
      }
      .row:hover .actions,
      .row.active .actions,
      .row:focus-within .actions {
        display: inline-flex;
      }
      .actions mm-button {
        --mm-control: calc(var(--_row) - var(--space-1));
        --control-h-sm: calc(var(--_row) - var(--space-1));
      }
      .status {
        color: var(--mm-text-2);
        gap: var(--space-2);
      }
      .status.error {
        color: var(--mm-danger);
        cursor: pointer;
      }
      .status .retry {
        color: var(--mm-text);
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .spinner {
        width: 12px;
        height: 12px;
        flex: none;
        border-radius: 50%;
        border: 1.5px solid currentColor;
        border-inline-end-color: transparent;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-inline-end-color: currentColor;
          opacity: 0.6;
        }
      }
      .message {
        padding: var(--space-3) var(--space-2);
        color: var(--mm-text-2);
        font: var(--text-dense);
      }
      .message.error {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      .message.error .why {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--mm-danger);
      }
      @media (pointer: coarse) {
        :host {
          --_row: var(--target-touch);
        }
      }
    `,
  ];

  /** The root nodes. */
  @property({ attribute: false }) accessor nodes: TreeNode[] = [];
  /** Accessible name of the tree, e.g. "Query sources". Required. */
  @property() accessor label = '';
  /** `none`, `single` (default) or `multiple`. */
  @property({ reflect: true }) accessor selection: 'none' | 'single' | 'multiple' = 'single';
  /** Expanded node ids. Updated as the person expands and collapses. */
  @property({ attribute: false }) accessor expandedIds: string[] = [];
  /** Selected node ids. Updated as the person selects. */
  @property({ attribute: false }) accessor selectedIds: string[] = [];
  /** Loads the children of a node with `hasChildren`. Abort when `signal` aborts. */
  @property({ attribute: false }) accessor loadChildren: TreeLoader | undefined;
  /** Actions for every node, shown on hover and focus. A node's own `actions` win. */
  @property({ attribute: false }) accessor actions: TreeAction[] | ((node: TreeNode) => TreeAction[]) = [];
  /** Shows a filter field above the tree. */
  @property({ type: Boolean, reflect: true }) accessor filterable = false;
  /** The filter text. Matching labels are highlighted and their ancestors expanded. */
  @property() accessor filter = '';
  /** Label of the filter field. */
  @property({ attribute: 'filter-label' }) accessor filterLabel = '';
  /** Placeholder of the filter field. */
  @property({ attribute: 'filter-placeholder' }) accessor filterPlaceholder = '';
  /** Shows skeleton rows in place of the tree. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** Shows an error with a retry button in place of the tree. */
  @property() accessor error = '';
  /** Sentence for the empty state. */
  @property({ attribute: 'empty-text' }) accessor emptyText = '';

  @state() accessor #activeKey = '';
  @state() accessor #version = 0;
  @query('.tree') accessor #treeEl!: (HTMLElement & VirtualizerHostElement) | null;

  #expanded = new Set<string>();
  #selected = new Set<string>();
  #filterCollapsed = new Set<string>();
  #loaded = new Map<string, TreeNode[]>();
  #loads = new Map<string, LoadState>();
  #domIds = new Map<string, string>();
  #prefix = uid('mm-tree');
  #rowsCache: { version: number; filter: string; nodes: TreeNode[]; rows: Row[]; matches: number } | null = null;
  #typeahead = '';
  #typeaheadTimer?: ReturnType<typeof setTimeout>;
  #scrollPending = false;
  #syncing = false;

  /** Expands a node, loading its children if needed. */
  expand(id: string) {
    const row = this.#rows().find((r): r is NodeRow => r.kind === 'node' && r.node.id === id);
    const node = row?.node ?? this.#find(id);
    if (node) this.#setExpanded(node, true, false);
  }
  /** Collapses a node. */
  collapse(id: string) {
    const node = this.#find(id);
    if (node) this.#setExpanded(node, false, false);
  }
  /** Expands every loaded node. Does not load lazy children. */
  expandAll() {
    const walk = (list: TreeNode[]) =>
      list.forEach((n) => {
        const kids = this.#children(n);
        if (kids?.length) {
          this.#expanded.add(n.id);
          walk(kids);
        }
      });
    walk(this.nodes);
    this.#commitExpanded();
  }
  /** Collapses every node. */
  collapseAll() {
    this.#expanded.clear();
    this.#commitExpanded();
  }
  /** Moves focus to the tree. */
  override focus(options?: FocusOptions) {
    this.#treeEl?.focus(options);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const l of this.#loads.values()) {
      l.controller.abort();
      clearTimeout(l.timer);
    }
    this.#loads.clear();
    clearTimeout(this.#typeaheadTimer);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('expandedIds') && !this.#syncing) this.#expanded = new Set(this.expandedIds);
    if (changed.has('selectedIds') && !this.#syncing) this.#selected = new Set(this.selectedIds);
    if (changed.has('filter')) this.#filterCollapsed.clear();
    if (changed.has('nodes')) {
      this.#loaded.clear();
      this.#domIds.clear();
    }
    this.#syncing = false;
    // Nodes expanded from `expandedIds` load their children too.
    for (const r of this.#rows()) {
      if (r.kind === 'node' && r.expanded && !this.#children(r.node) && r.node.hasChildren && !this.#loads.has(r.node.id)) this.#load(r.node);
    }
    // Keep the active row valid when rows come and go: a finished loading row hands focus to its parent.
    const rows = this.#rows();
    if (this.#activeKey && !rows.some((r) => r.key === this.#activeKey)) {
      const parentKey = this.#activeKey.split('\u0000')[0]!;
      this.#activeKey = (rows.find((r) => r.key === parentKey) ?? rows[0])?.key ?? '';
    }
  }

  protected override updated() {
    if (this.#scrollPending) {
      this.#scrollPending = false;
      this.#scrollToActive();
    }
  }

  // ---- data ---------------------------------------------------------------

  #children(n: TreeNode): TreeNode[] | undefined {
    return n.children ?? this.#loaded.get(n.id);
  }
  #expandable(n: TreeNode): boolean {
    const kids = this.#children(n);
    if (kids) return kids.length > 0;
    return !!n.hasChildren;
  }
  #find(id: string): TreeNode | undefined {
    const stack = [...this.nodes];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === id) return n;
      const kids = this.#children(n);
      if (kids) stack.push(...kids);
    }
    return undefined;
  }
  #domId(key: string): string {
    let id = this.#domIds.get(key);
    if (!id) {
      id = `${this.#prefix}-${this.#domIds.size}`;
      this.#domIds.set(key, id);
    }
    return id;
  }
  #matchText(): string {
    return this.filter.trim().toLowerCase();
  }

  /** The visible rows, flattened in order. Cached until something changes. */
  #rows(): Row[] {
    const q = this.#matchText();
    const c = this.#rowsCache;
    if (c && c.version === this.#version && c.filter === q && c.nodes === this.nodes) return c.rows;
    const rows: Row[] = [];
    let matches = 0;
    // While filtering, keep nodes that match or have a matching loaded descendant, and open the path to them.
    const keep = new Set<string>();
    const forced = new Set<string>();
    if (q) {
      const visit = (n: TreeNode): boolean => {
        const self = n.label.toLowerCase().includes(q);
        if (self) matches++;
        let below = false;
        for (const k of this.#children(n) ?? []) if (visit(k)) below = true;
        if (below) forced.add(n.id);
        if (self || below) keep.add(n.id);
        return self || below;
      };
      this.nodes.forEach(visit);
    }
    const isOpen = (n: TreeNode) =>
      q && forced.has(n.id) ? !this.#filterCollapsed.has(n.id) : this.#expanded.has(n.id);
    const walk = (list: TreeNode[], level: number, parent: TreeNode | null, filtered: boolean) => {
      const shown = filtered ? list.filter((n) => keep.has(n.id)) : list;
      shown.forEach((node, i) => {
        const expandable = this.#expandable(node);
        const expanded = expandable && !!isOpen(node);
        rows.push({ kind: 'node', key: node.id, node, level, setsize: shown.length, posinset: i + 1, parent, expandable, expanded });
        if (!expanded) return;
        const kids = this.#children(node);
        const load = this.#loads.get(node.id);
        if (kids) {
          // Below a match, show its subtree as it is; above one, keep filtering.
          const selfMatch = q && node.label.toLowerCase().includes(q);
          walk(kids, level + 1, node, filtered && !selfMatch);
        } else if (load?.status === 'error') {
          rows.push({ kind: 'error', key: `${node.id}\u0000error`, parent: node, level: level + 1, message: load.message });
        } else if (load && load.visibleAt) {
          rows.push({ kind: 'loading', key: `${node.id}\u0000loading`, parent: node, level: level + 1 });
        }
      });
    };
    walk(this.nodes, 1, null, !!q);
    this.#rowsCache = { version: this.#version, filter: q, nodes: this.nodes, rows, matches };
    return rows;
  }

  #bump() {
    this.#version++;
  }

  #commitExpanded() {
    this.#syncing = true;
    this.expandedIds = [...this.#expanded];
    this.#bump();
  }

  #setExpanded(node: TreeNode, open: boolean, user: boolean) {
    if (!this.#expandable(node)) return;
    const q = this.#matchText();
    const current = this.#rows().find((r): r is NodeRow => r.kind === 'node' && r.node.id === node.id);
    if (current && current.expanded === open) return;
    if (q && this.#isForced(node.id)) {
      if (open) this.#filterCollapsed.delete(node.id);
      else this.#filterCollapsed.add(node.id);
    }
    if (open) this.#expanded.add(node.id);
    else this.#expanded.delete(node.id);
    if (open && !this.#children(node) && node.hasChildren) this.#load(node);
    this.#commitExpanded();
    if (user) emit<MmTreeExpandDetail>(this, 'mm-expand', { node, expanded: open });
  }

  #isForced(id: string): boolean {
    const q = this.#matchText();
    const has = (n: TreeNode): boolean => n.label.toLowerCase().includes(q) || (this.#children(n) ?? []).some(has);
    const n = this.#find(id);
    return !!n && (this.#children(n) ?? []).some(has);
  }

  #load(node: TreeNode) {
    const loader = this.loadChildren;
    if (!loader) return;
    const prev = this.#loads.get(node.id);
    prev?.controller.abort();
    clearTimeout(prev?.timer);
    const controller = new AbortController();
    const state: LoadState = { status: 'loading', controller, visibleAt: 0 };
    this.#loads.set(node.id, state);
    state.timer = setTimeout(() => {
      state.visibleAt = performance.now();
      this.#bump();
    }, 200);
    const settle = (fn: () => void) => {
      clearTimeout(state.timer);
      const wait = state.visibleAt ? Math.max(0, 400 - (performance.now() - state.visibleAt)) : 0;
      const done = () => {
        if (this.#loads.get(node.id) !== state) return;
        fn();
        this.#bump();
      };
      if (wait) state.timer = setTimeout(done, wait);
      else done();
    };
    loader(node, controller.signal).then(
      (kids) => {
        if (controller.signal.aborted) return;
        settle(() => {
          this.#loads.delete(node.id);
          this.#loaded.set(node.id, kids);
        });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        settle(() => {
          state.status = 'error';
          state.visibleAt = 1;
          state.message = err instanceof Error && err.message ? err.message : '';
        });
      },
    );
  }

  #select(node: TreeNode, toggle: boolean) {
    if (this.selection === 'none' || node.disabled) return;
    if (this.selection === 'multiple' && toggle) {
      if (this.#selected.has(node.id)) this.#selected.delete(node.id);
      else this.#selected.add(node.id);
    } else {
      if (this.selection === 'single' && this.#selected.size === 1 && this.#selected.has(node.id)) return;
      this.#selected = new Set([node.id]);
    }
    this.#syncing = true;
    this.selectedIds = [...this.#selected];
    this.#bump();
    emit<MmTreeSelectDetail>(this, 'mm-select', { node, selected: [...this.#selected] });
  }

  // ---- keyboard -----------------------------------------------------------

  #activeIndex(rows: Row[]): number {
    const i = rows.findIndex((r) => r.key === this.#activeKey);
    return i;
  }

  #moveTo(rows: Row[], index: number) {
    const row = rows[index];
    if (!row) return;
    this.#activeKey = row.key;
    this.#scrollPending = true;
  }

  #onKeydown = (e: KeyboardEvent) => {
    // Keys pressed on a row action belong to that button.
    if (e.composedPath()[0] !== this.#treeEl) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const rows = this.#rows();
    if (!rows.length) return;
    let i = this.#activeIndex(rows);
    if (i < 0) i = 0;
    const row = rows[i]!;
    const rtl = isRtl(this);
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const handled = () => e.preventDefault();
    switch (e.key) {
      case 'ArrowDown':
        handled();
        this.#moveTo(rows, Math.min(rows.length - 1, i + 1));
        return;
      case 'ArrowUp':
        handled();
        this.#moveTo(rows, Math.max(0, i - 1));
        return;
      case 'Home':
        handled();
        this.#moveTo(rows, 0);
        return;
      case 'End':
        handled();
        this.#moveTo(rows, rows.length - 1);
        return;
      case fwd:
        handled();
        if (row.kind !== 'node' || !row.expandable) return;
        if (!row.expanded) this.#setExpanded(row.node, true, true);
        else if (rows[i + 1] && rows[i + 1]!.level === row.level + 1) this.#moveTo(rows, i + 1);
        return;
      case back: {
        handled();
        if (row.kind === 'node' && row.expanded) {
          this.#setExpanded(row.node, false, true);
          return;
        }
        const parent = row.parent;
        if (parent) {
          const p = rows.findIndex((r) => r.kind === 'node' && r.node.id === parent.id);
          if (p >= 0) this.#moveTo(rows, p);
        }
        return;
      }
      case 'Enter':
        handled();
        if (row.kind === 'error') this.#load(row.parent);
        else if (row.kind === 'node' && !row.node.disabled) emit<MmTreeNodeDetail>(this, 'mm-activate', { node: row.node });
        return;
      case ' ':
        if (!this.#typeahead) {
          handled();
          if (row.kind === 'error') this.#load(row.parent);
          else if (row.kind === 'node') this.#select(row.node, true);
          return;
        }
        break;
      case '*': {
        handled();
        const siblings = rows.filter((r): r is NodeRow => r.kind === 'node' && r.parent === row.parent && r.level === row.level);
        siblings.forEach((s) => s.expandable && !s.expanded && this.#setExpanded(s.node, true, true));
        return;
      }
    }
    if (e.key.length === 1 && e.key.trim() !== '' || (e.key === ' ' && this.#typeahead)) {
      handled();
      this.#onTypeahead(rows, i, e.key.toLowerCase());
    }
  };

  #onTypeahead(rows: Row[], i: number, ch: string) {
    clearTimeout(this.#typeaheadTimer);
    this.#typeaheadTimer = setTimeout(() => (this.#typeahead = ''), TYPEAHEAD_MS);
    const repeat = this.#typeahead.length > 0 && [...this.#typeahead].every((c) => c === ch);
    this.#typeahead += ch;
    const needle = repeat ? ch : this.#typeahead;
    // A fresh search (or repeating one letter) starts after the current row; a longer one includes it.
    const start = needle.length === 1 ? i + 1 : i;
    for (let k = 0; k < rows.length; k++) {
      const r = rows[(start + k) % rows.length]!;
      if (r.kind === 'node' && r.node.label.toLowerCase().startsWith(needle)) {
        this.#moveTo(rows, (start + k) % rows.length);
        return;
      }
    }
  }

  #scrollToActive() {
    const rows = this.#rows();
    const i = this.#activeIndex(rows);
    const host = this.#treeEl;
    if (i < 0 || !host) return;
    const v = host[virtualizerRef];
    try {
      v?.element(i)?.scrollIntoView({ block: 'nearest' });
    } catch {
      /* not laid out yet */
    }
  }

  // ---- pointer ------------------------------------------------------------

  #rowFromEvent(e: Event): Row | undefined {
    const el = (e.target as Element).closest<HTMLElement>('[data-key]');
    const key = el?.dataset.key;
    return key === undefined ? undefined : this.#rows().find((r) => r.key === key);
  }

  #onClick = (e: MouseEvent) => {
    const row = this.#rowFromEvent(e);
    if (!row) return;
    if ((e.target as Element).closest('.actions')) return;
    this.#activeKey = row.key;
    this.#treeEl?.focus({ preventScroll: true });
    if (row.kind === 'error') {
      this.#load(row.parent);
      return;
    }
    if (row.kind !== 'node') return;
    if ((e.target as Element).closest('.twisty') && row.expandable) {
      this.#setExpanded(row.node, !row.expanded, true);
      return;
    }
    this.#select(row.node, this.selection === 'multiple' && (e.ctrlKey || e.metaKey));
  };

  #onDblclick = (e: MouseEvent) => {
    const row = this.#rowFromEvent(e);
    if (row?.kind !== 'node' || row.node.disabled || (e.target as Element).closest('.actions, .twisty')) return;
    emit<MmTreeNodeDetail>(this, 'mm-activate', { node: row.node });
  };

  #onFocus = () => {
    const rows = this.#rows();
    if (!rows.length) return;
    if (this.#activeIndex(rows) < 0) {
      const sel = rows.find((r) => r.kind === 'node' && this.#selected.has(r.node.id));
      this.#activeKey = (sel ?? rows[0]!).key;
    }
  };

  // ---- render -------------------------------------------------------------

  #actionsFor(node: TreeNode): TreeAction[] {
    if (node.actions) return node.actions;
    return typeof this.actions === 'function' ? this.actions(node) : this.actions;
  }

  #highlight(label: string): TemplateResult | string {
    const q = this.#matchText();
    if (!q) return label;
    const at = label.toLowerCase().indexOf(q);
    if (at < 0) return label;
    return html`${label.slice(0, at)}<mark>${label.slice(at, at + q.length)}</mark>${label.slice(at + q.length)}`;
  }

  #renderRow = (row: Row): TemplateResult => {
    const active = row.key === this.#activeKey;
    if (row.kind !== 'node') {
      const error = row.kind === 'error';
      const text = error
        ? `${row.message || tr('treeLoadError', 'Could not load this level.')} ${tr('retry', 'Retry')}`
        : tr('loading', 'Loading');
      return html`<div
        role="treeitem"
        part="row"
        id=${this.#domId(row.key)}
        data-key=${row.key}
        class="row status ${error ? 'error' : ''} ${active ? 'active' : ''}"
        style="--_level:${row.level}"
        aria-level=${row.level}
        aria-setsize="1"
        aria-posinset="1"
        aria-disabled=${error ? 'false' : 'true'}
        aria-label=${text}
      >
        <span class="twisty leaf" aria-hidden="true"></span>
        ${error
          ? html`<mm-icon name="error" aria-hidden="true"></mm-icon
              ><span class="label">${row.message || tr('treeLoadError', 'Could not load this level.')}</span
              ><span class="retry" aria-hidden="true">${tr('retry', 'Retry')}</span>`
          : html`<span class="spinner" aria-hidden="true"></span><span class="label">${tr('loading', 'Loading')}…</span>`}
      </div>`;
    }
    const { node } = row;
    const selectable = this.selection !== 'none';
    const loading = this.#loads.get(node.id)?.status === 'loading';
    const actions = this.#actionsFor(node);
    const mono = node.secondaryMono === true;
    const domId = this.#domId(row.key);
    const labelledby = [`${domId}-l`, node.secondary ? `${domId}-s` : '', node.badges?.length ? `${domId}-b` : ''].filter(Boolean).join(' ');
    return html`<div
      role="treeitem"
      part="row"
      id=${domId}
      data-key=${row.key}
      class="row ${active ? 'active' : ''}"
      style="--_level:${row.level}"
      aria-level=${row.level}
      aria-setsize=${row.setsize}
      aria-posinset=${row.posinset}
      aria-expanded=${ifDefined(row.expandable ? String(row.expanded) : undefined)}
      aria-selected=${ifDefined(selectable ? String(this.#selected.has(node.id)) : undefined)}
      aria-disabled=${ifDefined(node.disabled ? 'true' : undefined)}
      aria-busy=${ifDefined(loading ? 'true' : undefined)}
      aria-labelledby=${labelledby}
    >
      <span class="twisty ${row.expandable ? '' : 'leaf'}" aria-hidden="true"
        >${row.expandable ? html`<mm-icon name="chevron-right"></mm-icon>` : nothing}</span
      >
      ${node.provider
        ? html`<mm-provider-logo class="glyph" provider=${node.provider} size="16" decorative></mm-provider-logo>`
        : node.icon
          ? html`<mm-icon class="glyph" name=${node.icon} aria-hidden="true"></mm-icon>`
          : nothing}
      <span class="label" id=${`${domId}-l`}>${this.#highlight(node.label)}</span>
      ${node.secondary ? html`<span class="secondary ${mono ? 'mono' : ''}" id=${`${domId}-s`}>${node.secondary}</span>` : nothing}
      ${node.badges?.length
        ? html`<span class="badges" id=${`${domId}-b`}>${node.badges.map((b) => html`<mm-tag variant=${b.variant ?? 'plain'}>${b.label}</mm-tag>`)}</span>`
        : nothing}
      <span class="spacer"></span>
      ${actions.length
        ? html`<span class="actions">
            ${actions.map(
              (a) =>
                html`<mm-button
                  variant="ghost"
                  size="sm"
                  icon=${a.icon}
                  label=${a.label}
                  tabindex=${active ? '0' : '-1'}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    emit<MmTreeActionDetail>(this, 'mm-action', { action: a.id, node });
                  }}
                ></mm-button>`,
            )}
          </span>`
        : nothing}
    </div>`;
  };

  #renderBody() {
    if (this.loading) {
      return html`<mm-skeleton loading shape="text" count="6"></mm-skeleton>`;
    }
    if (this.error) {
      return html`<div class="message error" role="alert">
        <span class="why"><mm-icon name="error" aria-hidden="true"></mm-icon>${this.error}</span>
        <mm-button size="sm" icon="refresh" @click=${() => emit(this, 'mm-retry', null)}>${tr('retry', 'Retry')}</mm-button>
      </div>`;
    }
    if (!this.nodes.length) {
      return html`<slot name="empty"
        ><mm-empty-state compact heading=${tr('treeEmptyHeading', 'Nothing to show')} description=${this.emptyText || tr('treeEmpty', 'There is nothing here yet.')}></mm-empty-state
      ></slot>`;
    }
    const rows = this.#rows();
    const active = rows.find((r) => r.key === this.#activeKey);
    const q = this.#matchText();
    const matches = this.#rowsCache?.matches ?? 0;
    return html`
      <div
        part="tree"
        class="tree"
        role="tree"
        tabindex="0"
        style="min-height:0;--_n:${Math.max(1, rows.length)}"
        ?hidden=${!rows.length}
        aria-label=${this.label}
        aria-multiselectable=${ifDefined(this.selection === 'multiple' ? 'true' : undefined)}
        aria-activedescendant=${ifDefined(active ? this.#domId(active.key) : undefined)}
        @keydown=${this.#onKeydown}
        @click=${this.#onClick}
        @dblclick=${this.#onDblclick}
        @focus=${this.#onFocus}
      >
        ${virtualize({ items: rows, keyFunction: (r: Row) => r.key, renderItem: this.#renderRow, scroller: true })}
      </div>
      ${q && !rows.length
        ? html`<p class="message">${tr('treeNoMatches', 'Nothing matches “{filter}”.', { filter: this.filter.trim() })}</p>`
        : nothing}
      <span class="visually-hidden" role="status">${q ? tr('treeMatches', '{count} matches', { count: matches }) : ''}</span>
    `;
  }

  override render() {
    // The virtualiser renders rows asynchronously, so the state version is read here to re-render on change.
    void this.#version;
    return html`
      ${this.filterable
        ? html`<mm-search-field
            part="filter"
            label=${this.filterLabel || tr('treeFilter', 'Filter')}
            hide-label
            placeholder=${this.filterPlaceholder}
            .value=${this.filter}
            @mm-input=${(e: CustomEvent<{ value: string }>) => {
              this.filter = e.detail.value;
            }}
          ></mm-search-field>`
        : nothing}
      ${this.#renderBody()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-tree': MmTree;
  }
}
