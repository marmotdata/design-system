import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { formatCount, formatTimestamp } from '../../core/format.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';

/** A column in one schema version. */
export interface DiffColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

export type SchemaChangeKind = 'added' | 'removed' | 'type' | 'nullability' | 'unchanged';

/** One structured change. Computed from `oldColumns` and `newColumns`, or given directly in `changes`. */
export interface SchemaChange {
  kind: SchemaChangeKind;
  column: string;
  before?: string;
  after?: string;
}

export interface DiffLine {
  op: 'eq' | 'add' | 'del';
  text: string;
  /** Line number in the old text. */
  a?: number;
  /** Line number in the new text. */
  b?: number;
}

type Block = { kind: 'lines'; lines: DiffLine[] } | { kind: 'fold'; id: number; lines: DiffLine[] };

const MAX_CELLS = 4_000_000;

/**
 * Line diff by longest common subsequence. Common leading and trailing lines are matched first;
 * if what remains is too large for the table, it is reported as removed then added.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText === '' ? [] : oldText.replace(/\r\n?/g, '\n').split('\n');
  const b = newText === '' ? [] : newText.replace(/\r\n?/g, '\n').split('\n');
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const out: DiffLine[] = [];
  for (let i = 0; i < pre; i++) out.push({ op: 'eq', text: a[i]!, a: i + 1, b: i + 1 });
  const ma = a.slice(pre, a.length - suf);
  const mb = b.slice(pre, b.length - suf);
  const n = ma.length;
  const m = mb.length;
  if (n * m > MAX_CELLS) {
    ma.forEach((text, i) => out.push({ op: 'del', text, a: pre + i + 1 }));
    mb.forEach((text, j) => out.push({ op: 'add', text, b: pre + j + 1 }));
  } else {
    // L[i][j] is the LCS length of ma[i..] and mb[j..].
    const w = m + 1;
    const L = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * w + j] = ma[i] === mb[j] ? L[(i + 1) * w + j + 1]! + 1 : Math.max(L[(i + 1) * w + j]!, L[i * w + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && ma[i] === mb[j]) {
        out.push({ op: 'eq', text: ma[i]!, a: pre + i + 1, b: pre + j + 1 });
        i++;
        j++;
      } else if (j >= m || (i < n && L[(i + 1) * w + j]! >= L[i * w + j + 1]!)) {
        out.push({ op: 'del', text: ma[i]!, a: pre + i + 1 });
        i++;
      } else {
        out.push({ op: 'add', text: mb[j]!, b: pre + j + 1 });
        j++;
      }
    }
  }
  for (let k = 0; k < suf; k++) {
    const ia = a.length - suf + k;
    const ib = b.length - suf + k;
    out.push({ op: 'eq', text: a[ia]!, a: ia + 1, b: ib + 1 });
  }
  return out;
}

/** Structured column changes between two versions, in the new version's order with removals where they were. */
export function diffColumns(before: DiffColumn[], after: DiffColumn[]): SchemaChange[] {
  const old = new Map(before.map((c) => [c.name, c]));
  const next = new Map(after.map((c) => [c.name, c]));
  const nullWord = (n: boolean | undefined) => (n === undefined ? '' : n ? tr('diffNullable', 'Nullable') : tr('diffNotNull', 'Not null'));
  const changes: SchemaChange[] = [];
  const pushRemovedBefore = (idx: number) => {
    // Removed columns that sat before this point in the old order.
    while (removedQueue.length && removedQueue[0]!.idx <= idx) {
      const r = removedQueue.shift()!;
      changes.push({ kind: 'removed', column: r.col.name, before: r.col.type });
    }
  };
  const removedQueue = before.map((col, idx) => ({ col, idx })).filter(({ col }) => !next.has(col.name));
  for (const col of after) {
    const prev = old.get(col.name);
    if (prev) pushRemovedBefore(before.indexOf(prev));
    if (!prev) changes.push({ kind: 'added', column: col.name, after: col.type });
    else if (prev.type !== col.type) changes.push({ kind: 'type', column: col.name, before: prev.type, after: col.type });
    else if (prev.nullable !== col.nullable && prev.nullable !== undefined && col.nullable !== undefined)
      changes.push({ kind: 'nullability', column: col.name, before: nullWord(prev.nullable), after: nullWord(col.nullable) });
    else changes.push({ kind: 'unchanged', column: col.name, before: col.type, after: col.type });
  }
  pushRemovedBefore(Infinity);
  return changes;
}

/**
 * The diff viewer shows what changed between two versions of an asset. In `columns` mode it is a
 * table of schema changes: each row says what happened in a word with a glyph ("+ Added",
 * "− Removed", "± Type changed") and shows the before and after types in mono. Added rows carry a
 * faint moss tint and removed rows a faint crimson tint, always with the word, never colour alone.
 * Unchanged columns fold behind a "Show unchanged columns" button.
 *
 * In `text` mode it is a unified line diff of two texts (DDL, YAML, a pipeline config) on
 * `mm-surface`, with old and new line numbers and + and − gutters; runs of unchanged lines beyond
 * `context` fold behind buttons that expand them in place. Long lines scroll sideways, or wrap with
 * `wrap`.
 *
 * The header is a sentence-case caption of the comparison ("Schema version 41 → 42 · 3 changes")
 * with who or what made the change and when. Column names, types and diff lines stay mono.
 *
 * The fold buttons are ordinary buttons with `aria-expanded`: Tab reaches them, and Enter or Space
 * toggles them.
 *
 * @tagname mm-diff-viewer
 * @summary Structured schema changes or a unified text diff.
 * @csspart header - The comparison caption and actor line.
 * @csspart table - The changes or lines table.
 * @cssprop --mm-diff-max-height - Height at which the text diff scrolls. Defaults to none.
 */
export class MmDiffViewer extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-1) var(--space-4);
        margin-block-end: var(--space-3);
      }
      .readout {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .actor {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--mm-text-2);
      }
      .actor strong {
        color: var(--mm-text);
        font-weight: 600;
      }
      .actor time {
        font-variant-numeric: tabular-nums;
      }
      .wrap {
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
        overflow: auto;
      }
      .wrap.text {
        max-height: var(--mm-diff-max-height, none);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        height: var(--mm-row, var(--row-default));
        padding: 0 var(--space-3);
        background: var(--mm-sunken);
        border-block-end: 1px solid var(--mm-rule);
        font: var(--text-label);
        color: var(--mm-text-2);
        text-align: start;
        white-space: nowrap;
      }
      .cols td {
        height: var(--mm-row, var(--row-default));
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--mm-rule);
      }
      .cols tbody th {
        height: var(--mm-row, var(--row-default));
        padding: var(--space-2) var(--space-3);
        background: none;
        border-block-end: 1px solid var(--mm-rule);
        font: var(--text-mono-dense);
        color: var(--mm-text);
        white-space: normal;
      }
      .cols tr:last-child td,
      .cols tr:last-child th {
        border-block-end: 0;
      }
      tr.added {
        background: var(--mm-success-soft);
      }
      tr.removed {
        background: var(--mm-danger-soft);
      }
      .change {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
        white-space: nowrap;
        font-weight: 600;
      }
      .glyph {
        display: inline-block;
        width: 1ch;
        font: var(--text-mono-dense);
        font-weight: 700;
        text-align: center;
      }
      tr.added .change {
        color: var(--mm-success);
      }
      tr.removed .change {
        color: var(--mm-danger);
      }
      tr.type .change,
      tr.nullability .change {
        color: var(--mm-text);
      }
      tr.unchanged .change {
        color: var(--mm-text-3);
        font-weight: 400;
      }
      .mono {
        font: var(--text-mono-dense);
        overflow-wrap: anywhere;
      }
      .name {
        color: var(--mm-text);
      }
      .ty {
        color: var(--mm-text-2);
      }
      tr.removed .name {
        text-decoration: line-through;
        text-decoration-thickness: 1px;
      }
      .none {
        color: var(--mm-text-3);
      }
      .fold-row td {
        padding: var(--space-1) var(--space-2);
        border-block-end: 1px solid var(--mm-rule);
        background: var(--mm-sunken);
      }
      .fold {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-height: 24px;
        padding: 2px var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        font: var(--text-dense);
        cursor: pointer;
      }
      .fold:hover {
        color: var(--mm-text);
        background: var(--mm-surface);
      }
      .fold mm-icon {
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      .fold[aria-expanded='true'] mm-icon {
        transform: rotate(180deg);
      }
      .footer {
        padding: var(--space-2) var(--space-3);
        border-block-start: 1px solid var(--mm-rule);
      }
      /* Text diff */
      .lines {
        font: var(--text-mono-dense);
        font-variant-numeric: tabular-nums;
        direction: ltr;
      }
      .lines td {
        padding: 0 var(--space-2);
        vertical-align: top;
        line-height: 20px;
      }
      .ln {
        width: 1%;
        min-width: 4ch;
        text-align: end;
        color: var(--mm-text-3);
        user-select: none;
        white-space: nowrap;
      }
      .g {
        width: 1%;
        text-align: center;
        user-select: none;
        font-weight: 700;
      }
      tr.add .g {
        color: var(--mm-success);
      }
      tr.del .g {
        color: var(--mm-danger);
      }
      tr.add {
        background: var(--mm-success-soft);
      }
      tr.del {
        background: var(--mm-danger-soft);
      }
      tr.add .ln,
      tr.del .ln {
        color: var(--mm-text-2);
      }
      .code {
        white-space: pre;
        color: var(--mm-text);
        padding-inline-end: var(--space-4);
      }
      :host([wrap]) .code {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .lines .fold-row td {
        padding-block: 2px;
      }
      .empty {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
        color: var(--mm-text-2);
      }
      .wrap:focus-visible {
        outline-offset: 2px;
      }
    `,
  ];

  /** `columns` (structured schema changes) or `text` (unified line diff). */
  @property({ reflect: true }) accessor mode: 'columns' | 'text' = 'columns';
  /** Columns of the older version (columns mode). */
  @property({ attribute: false }) accessor oldColumns: DiffColumn[] = [];
  /** Columns of the newer version (columns mode). */
  @property({ attribute: false }) accessor newColumns: DiffColumn[] = [];
  /** Precomputed changes. Overrides `oldColumns` and `newColumns`. */
  @property({ attribute: false }) accessor changes: SchemaChange[] | undefined;
  /** Older text (text mode). */
  @property({ attribute: 'old-text' }) accessor oldText = '';
  /** Newer text (text mode). */
  @property({ attribute: 'new-text' }) accessor newText = '';
  /** What is being compared, for the readout. Defaults to "Schema version". */
  @property() accessor subject = '';
  @property({ attribute: 'from-version' }) accessor fromVersion = '';
  @property({ attribute: 'to-version' }) accessor toVersion = '';
  /** When the newer version was recorded (ISO 8601). */
  @property({ attribute: 'changed-at' }) accessor changedAt = '';
  /** Who or what made the change: "Jane Doe", "postgresql plugin". */
  @property() accessor actor = '';
  /** `person`, `plugin` or `agent`; picks the icon. */
  @property({ attribute: 'actor-kind' }) accessor actorKind: 'person' | 'plugin' | 'agent' = 'person';
  /** Unchanged lines kept around each change in text mode. */
  @property({ type: Number }) accessor context = 3;
  /** Wrap long lines in text mode instead of scrolling. */
  @property({ type: Boolean, reflect: true }) accessor wrap = false;
  /** Accessible name of the table, e.g. "Changes to shop.public.orders". */
  @property() accessor label = '';

  @state() accessor #openFolds = new Set<number>();
  @state() accessor #showUnchanged = false;

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('oldText') || changed.has('newText') || changed.has('context')) this.#openFolds = new Set();
  }

  #lines(): DiffLine[] {
    return diffLines(this.oldText, this.newText);
  }

  #blocks(lines: DiffLine[]): Block[] {
    const ctx = Math.max(0, this.context);
    const blocks: Block[] = [];
    let i = 0;
    let fold = 0;
    let current: DiffLine[] = [];
    while (i < lines.length) {
      if (lines[i]!.op !== 'eq') {
        current.push(lines[i++]!);
        continue;
      }
      let j = i;
      while (j < lines.length && lines[j]!.op === 'eq') j++;
      const run = lines.slice(i, j);
      const head = i === 0 ? 0 : ctx;
      const tail = j === lines.length ? 0 : ctx;
      if (run.length > head + tail + 1) {
        current.push(...run.slice(0, head));
        if (current.length) blocks.push({ kind: 'lines', lines: current });
        blocks.push({ kind: 'fold', id: fold++, lines: run.slice(head, run.length - tail) });
        current = run.slice(run.length - tail);
      } else {
        current.push(...run);
      }
      i = j;
    }
    if (current.length) blocks.push({ kind: 'lines', lines: current });
    return blocks;
  }

  #changes(): SchemaChange[] {
    return this.changes ?? diffColumns(this.oldColumns, this.newColumns);
  }

  #renderHeader(summary: string): TemplateResult {
    const subject = this.subject || tr('diffSchemaVersion', 'Schema version');
    const versions = this.fromVersion || this.toVersion ? ` ${this.fromVersion} → ${this.toVersion}` : '';
    const icon = this.actorKind === 'plugin' ? 'extension' : this.actorKind === 'agent' ? 'smart-toy' : 'person';
    return html`<div class="header" part="header">
      <span class="readout">${subject}${versions} · ${summary}</span>
      ${this.actor || this.changedAt
        ? html`<span class="actor">
            ${this.actor
              ? html`<mm-icon name=${icon} aria-hidden="true"></mm-icon><span
                    >${this.actorKind === 'plugin' ? tr('diffRecordedBy', 'Recorded by') : tr('diffChangedBy', 'Changed by')}
                    <strong>${this.actor}</strong></span
                  >`
              : nothing}
            ${this.changedAt ? html`<time datetime=${this.changedAt}>${formatTimestamp(this.changedAt)}</time>` : nothing}
          </span>`
        : nothing}
    </div>`;
  }

  #word(kind: SchemaChangeKind): { glyph: string; word: string } {
    switch (kind) {
      case 'added':
        return { glyph: '+', word: tr('diffAdded', 'Added') };
      case 'removed':
        return { glyph: '−', word: tr('diffRemoved', 'Removed') };
      case 'type':
        return { glyph: '±', word: tr('diffTypeChanged', 'Type changed') };
      case 'nullability':
        return { glyph: '±', word: tr('diffNullabilityChanged', 'Nullability changed') };
      default:
        return { glyph: '', word: tr('diffUnchanged', 'Unchanged') };
    }
  }

  #cell(v: string | undefined): TemplateResult {
    return v ? html`<span class="mono ty">${v}</span>` : html`<span class="visually-hidden">${tr('diffNone', 'None')}</span>`;
  }

  #renderColumns(): TemplateResult {
    const all = this.#changes();
    const real = all.filter((c) => c.kind !== 'unchanged');
    const unchanged = all.length - real.length;
    const summary =
      real.length === 1 ? tr('diffOneChange', '1 change') : tr('diffChanges', '{count} changes', { count: formatCount(real.length) });
    if (!real.length) {
      return html`${this.#renderHeader(summary)}
        <p class="empty" role="status">
          <mm-icon name="check" aria-hidden="true"></mm-icon>${this.fromVersion
            ? tr('diffNoChangesSince', 'The schema has not changed since version {version}.', { version: this.fromVersion })
            : tr('diffNoChanges', 'The schema has not changed.')}
        </p>`;
    }
    const shown = this.#showUnchanged ? all : real;
    return html`${this.#renderHeader(summary)}
      <div class="wrap">
        <table class="cols" part="table" aria-label=${this.label || tr('diffColumnsLabel', 'Schema changes')}>
          <thead>
            <tr>
              <th scope="col">${tr('diffChange', 'Change')}</th>
              <th scope="col">${tr('diffColumn', 'Column')}</th>
              <th scope="col">${tr('diffBefore', 'Before')}</th>
              <th scope="col">${tr('diffAfter', 'After')}</th>
            </tr>
          </thead>
          <tbody>
            ${shown.map((c) => {
              const { glyph, word } = this.#word(c.kind);
              return html`<tr class=${c.kind}>
                <td><span class="change">${glyph ? html`<span class="glyph" aria-hidden="true">${glyph}</span>` : nothing}${word}</span></td>
                <th scope="row" class="mono name">${c.column}</th>
                <td>${this.#cell(c.before)}</td>
                <td>${this.#cell(c.after)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
        ${unchanged
          ? html`<div class="footer">
              <button class="fold" type="button" aria-expanded=${String(this.#showUnchanged)} @click=${() => (this.#showUnchanged = !this.#showUnchanged)}>
                <mm-icon name="expand-more" aria-hidden="true"></mm-icon>${this.#showUnchanged
                  ? tr('diffHideUnchangedColumns', 'Hide {count} unchanged columns', { count: formatCount(unchanged) })
                  : tr('diffShowUnchangedColumns', 'Show {count} unchanged columns', { count: formatCount(unchanged) })}
              </button>
            </div>`
          : nothing}
      </div>`;
  }

  #renderLine(l: DiffLine): TemplateResult {
    const word = l.op === 'add' ? tr('diffAdded', 'Added') : l.op === 'del' ? tr('diffRemoved', 'Removed') : '';
    return html`<tr class=${l.op}>
      <td class="ln">${l.a ?? ''}</td>
      <td class="ln">${l.b ?? ''}</td>
      <td class="g"><span aria-hidden="true">${l.op === 'add' ? '+' : l.op === 'del' ? '−' : ''}</span>${word
          ? html`<span class="visually-hidden">${word}</span>`
          : nothing}</td>
      <td class="code">${l.text}</td>
    </tr>`;
  }

  #renderText(): TemplateResult {
    const lines = this.#lines();
    const added = lines.filter((l) => l.op === 'add').length;
    const removed = lines.filter((l) => l.op === 'del').length;
    const summary = tr('diffLineSummary', '{added} added · {removed} removed', { added: formatCount(added), removed: formatCount(removed) });
    if (!added && !removed) {
      return html`${this.#renderHeader(summary)}
        <p class="empty" role="status"><mm-icon name="check" aria-hidden="true"></mm-icon>${tr('diffIdentical', 'The two versions are identical.')}</p>`;
    }
    const blocks = this.#blocks(lines);
    return html`${this.#renderHeader(summary)}
      <div class="wrap text" role="group" tabindex="0" aria-label=${this.label || tr('diffTextLabel', 'Line changes')}>
        <table class="lines" part="table">
          <thead class="visually-hidden">
            <tr>
              <th scope="col">${tr('diffOldLine', 'Old line')}</th>
              <th scope="col">${tr('diffNewLine', 'New line')}</th>
              <th scope="col">${tr('diffChange', 'Change')}</th>
              <th scope="col">${tr('diffContent', 'Content')}</th>
            </tr>
          </thead>
          <tbody>
            ${blocks.map((b) => {
              if (b.kind === 'lines') return b.lines.map((l) => this.#renderLine(l));
              const open = this.#openFolds.has(b.id);
              return html`<tr class="fold-row">
                  <td colspan="4">
                    <button
                      class="fold"
                      type="button"
                      aria-expanded=${String(open)}
                      @click=${() => {
                        const next = new Set(this.#openFolds);
                        if (open) next.delete(b.id);
                        else next.add(b.id);
                        this.#openFolds = next;
                      }}
                    >
                      <mm-icon name="unfold-more" aria-hidden="true"></mm-icon>${open
                        ? tr('diffHideLines', 'Hide {count} unchanged lines', { count: formatCount(b.lines.length) })
                        : tr('diffShowLines', 'Show {count} unchanged lines', { count: formatCount(b.lines.length) })}
                    </button>
                  </td>
                </tr>
                ${open ? b.lines.map((l) => this.#renderLine(l)) : nothing}`;
            })}
          </tbody>
        </table>
      </div>`;
  }

  override render() {
    return this.mode === 'text' ? this.#renderText() : this.#renderColumns();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-diff-viewer': MmDiffViewer;
  }
}
