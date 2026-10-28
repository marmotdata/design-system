import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { Extension } from '@codemirror/state';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import { MmCodeEditor, offsetOf, type EditorDiagnostic, type SetupModule } from '../code-editor/class.js';
import { tokenize } from '../code-sample/highlight.js';
import type * as SqlSetup from './setup.js';
import type { SqlCompleter, SqlDialectName, SqlSchema } from './setup.js';
import '../kbd/define.js';
import '@marmotdata/icons/define.js';

export type { SqlCompleter, SqlCompletion, SqlDialectName, SqlSchema, SqlSchemaEntry } from './setup.js';

/** A query error from the server, 1-based. */
export interface SqlError {
  line: number;
  column: number;
  message: string;
}

export interface SqlRunDetail {
  /** The SQL to run: the selection when there is one, otherwise the whole editor. */
  sql: string;
  /** True when `sql` is only the selection. */
  selection: boolean;
}

/** Changes that upper-case keywords and trim trailing whitespace, as offsets into the original text. */
export function formatSqlChanges(sql: string): { from: number; to: number; insert: string }[] {
  const changes: { from: number; to: number; insert: string }[] = [];
  let pos = 0;
  for (const tok of tokenize(sql, 'sql')) {
    if (tok.t === 'k' && tok.v !== tok.v.toUpperCase()) changes.push({ from: pos, to: pos + tok.v.length, insert: tok.v.toUpperCase() });
    pos += tok.v.length;
  }
  for (const m of sql.matchAll(/[ \t]+$/gm)) changes.push({ from: m.index!, to: m.index! + m[0].length, insert: '' });
  return changes.sort((a, b) => a.from - b.from);
}

const applyChanges = (text: string, changes: { from: number; to: number; insert: string }[]) => {
  let out = '';
  let at = 0;
  for (const c of changes) {
    out += text.slice(at, c.from) + c.insert;
    at = c.to;
  }
  return out + text.slice(at);
};

/**
 * The SQL editor is the Query workspace's editor: `mm-code-editor` with the SQL grammar for the
 * source's `dialect`, autocomplete from catalog metadata, and the run and format keys.
 *
 * - Ctrl+Enter (⌘+Enter on Apple) fires `mm-run` with the selection if there is one, otherwise the
 *   whole statement.
 * - Shift+Alt+F fires a cancelable `mm-format`; unless you cancel it, keywords are upper-cased and
 *   trailing spaces trimmed. Nothing else changes, so formatting never alters meaning.
 * - Completions come from `schema` (`{ 'shop.public.orders': ['order_id', …] }`) and from the async
 *   `completer`, whose results show their asset type and provider ("table · PostgreSQL") with the
 *   provider's logo. The popup sits on the code ground; Enter accepts, Escape closes.
 * - `error` puts the server's error inline at its line and column, with a status line under the editor.
 *
 * Dialects: `postgresql` (default), `mysql`, `sqlite` and `standard`. Trino maps to standard SQL,
 * Snowflake, Redshift and DuckDB to PostgreSQL, BigQuery and ClickHouse to MySQL.
 *
 * @tagname mm-sql-editor
 * @summary SQL editor with catalog completion, run and format.
 * @slot badge - Status under the editor, such as "Read only" or "Read-only replica". Defaults to "Read only" when `readonly`.
 * @csspart frame - The code ground holding the editor.
 * @csspart fallback - The static highlighted copy shown before CodeMirror loads.
 * @csspart footer - The row under the editor with the error, badge and run shortcut.
 * @csspart messages - The list of diagnostic messages.
 * @csspart shortcut - The run shortcut hint.
 * @cssprop --mm-code-editor-height - Initial height of the editor. Defaults to 240px.
 * @fires mm-run - {{ sql: string, selection: boolean }} Ctrl/⌘+Enter, or `run()`. `sql` is the selection when there is one.
 * @fires mm-format - {{ sql: string }} Shift+Alt+F, or `format()`. Cancel it to format on your side and set `value`.
 * @fires mm-input - {{ value: string }} The text changed.
 * @fires mm-change - {{ value: string }} The text changed and the editor lost focus.
 * @fires mm-ready - {{}} CodeMirror loaded and the editor is interactive.
 */
export class MmSqlEditor extends MmCodeEditor {
  static override styles = [
    ...MmCodeEditor.styles,
    css`
      .shortcut {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font: var(--text-caption);
        color: var(--mm-text-2);
        white-space: nowrap;
      }
    `,
  ];

  static loadSqlSetup: () => Promise<typeof SqlSetup> = () => import('./setup.js');

  /** `postgresql` (default), `mysql`, `sqlite`, `standard`, or a Marmot provider mapped to the closest one. */
  @property({ reflect: true }) accessor dialect: SqlDialectName | string = 'postgresql';
  /** Catalog metadata for completion, keyed by dotted table name. */
  @property({ attribute: false }) accessor schema: SqlSchema = {};
  /** Schema whose tables complete without a prefix, such as `shop.public`. */
  @property({ attribute: 'default-schema' }) accessor defaultSchema = '';
  /** Async completion hook, called as people type. Return completions with `assetType` and `provider` for the detail. */
  @property({ attribute: false }) accessor completer: SqlCompleter | null = null;
  /** The server's error for the last run: `{ line, column, message }`, 1-based. */
  @property({ attribute: false }) accessor error: SqlError | null = null;
  /** Hides the run shortcut hint under the editor. */
  @property({ type: Boolean, attribute: 'hide-shortcut' }) accessor hideShortcut = false;

  #sql: typeof SqlSetup | null = null;

  constructor() {
    super();
    this.language = 'sql';
  }

  protected override defaultLabel(): string {
    return tr('sqlEditorLabel', 'SQL editor');
  }

  protected override async languageExtension(setup: SetupModule): Promise<Extension> {
    void setup;
    this.#sql ??= await (this.constructor as typeof MmSqlEditor).loadSqlSetup();
    return this.#sql.sqlLanguage({ dialect: this.dialect, schema: this.schema, defaultSchema: this.defaultSchema, completer: this.completer });
  }

  protected override async extraExtensions(_setup: SetupModule): Promise<Extension> {
    this.#sql ??= await (this.constructor as typeof MmSqlEditor).loadSqlSetup();
    return this.#sql.sqlKeys({ run: () => this.run(), format: () => this.format() });
  }

  protected override effectiveDiagnostics(): EditorDiagnostic[] {
    const e = this.error;
    if (!e) return this.diagnostics;
    const from = offsetOf(this.value, e.line, e.column);
    const rest = this.value.slice(from);
    const word = /^("[^"\n]*"|`[^`\n]*`|\w+)/.exec(rest)?.[0] ?? '';
    const to = from + Math.max(1, word.length);
    return [...this.diagnostics, { from, to: Math.min(to, this.value.length), severity: 'error', message: e.message }];
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('dialect') || changed.has('schema') || changed.has('defaultSchema') || changed.has('completer')) void this.reconfigureLanguage();
    if (changed.has('error')) {
      this.handle?.setDiagnostics(this.effectiveDiagnostics());
      this.syncAttributes();
    }
  }

  /** Fires `mm-run` with the selection, or the whole editor when nothing is selected. */
  run(): void {
    const selected = this.selectedText;
    const sql = selected.trim() ? selected : this.value;
    emit<SqlRunDetail>(this, 'mm-run', { sql, selection: !!selected.trim() });
  }

  /** Fires `mm-format` and, unless it is cancelled, upper-cases keywords and trims trailing spaces. */
  format(): boolean {
    if (this.readonly || this.isDisabled) return false;
    if (!emit(this, 'mm-format', { sql: this.value }, { cancelable: true })) return true;
    const changes = formatSqlChanges(this.value);
    if (!changes.length) return true;
    const view = this.view;
    if (view) view.dispatch({ changes, userEvent: 'format' });
    else this.value = applyChanges(this.value, changes);
    return true;
  }

  protected override renderFooterEnd(): unknown {
    if (this.hideShortcut) return nothing;
    return html`<span class="shortcut" part="shortcut"><mm-kbd keys="mod+enter"></mm-kbd>${t('run')}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-sql-editor': MmSqlEditor;
  }
}
