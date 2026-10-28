/**
 * The CodeMirror half of `mm-sql-editor`: dialects, catalog completion and the run and format keys.
 * Loaded lazily alongside the base editor's setup.
 */
import { Prec, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { MySQL, PostgreSQL, SQLite, StandardSQL, sql, type SQLDialect, type SQLNamespace } from '@codemirror/lang-sql';
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { providerNames } from '@marmotdata/icons';

export type SqlDialectName = 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'standard' | 'trino' | 'snowflake' | 'bigquery' | 'duckdb' | 'redshift' | 'clickhouse';

/** A completion with Marmot catalog context: the asset type and provider show in the detail, with the provider's logo. */
export interface SqlCompletion extends Completion {
  /** Asset type, such as "table", "view" or "topic". */
  assetType?: string;
  /** Provider key as used in MRNs, such as `postgresql` or `snowflake`. */
  provider?: string;
}

/** A table's columns, or the columns plus catalog context. */
export type SqlSchemaEntry = readonly (string | SqlCompletion)[] | { columns: readonly (string | SqlCompletion)[]; type?: string; provider?: string };
/** Catalog metadata keyed by dotted table name: `{ 'shop.public.orders': ['order_id', 'customer_id'] }`. */
export type SqlSchema = Record<string, SqlSchemaEntry>;
export type SqlCompleter = (context: CompletionContext) => Promise<readonly SqlCompletion[]> | readonly SqlCompletion[];

/** Maps Marmot's source dialects to the closest CodeMirror dialect. */
export function dialectFor(name: string): SQLDialect {
  switch (name.toLowerCase()) {
    case 'mysql':
    case 'mariadb':
    case 'bigquery': // backtick-quoted identifiers
    case 'clickhouse':
      return MySQL;
    case 'sqlite':
      return SQLite;
    case 'standard':
    case 'trino':
      return StandardSQL;
    default: // postgresql, snowflake, redshift, duckdb
      return PostgreSQL;
  }
}

const providerName = (key: string) => providerNames[key.toLowerCase()] ?? key;

/** "table · PostgreSQL" from a completion's asset type and provider, unless it already has a detail. */
export function describe(c: SqlCompletion): SqlCompletion {
  if (c.detail || (!c.assetType && !c.provider)) return c;
  return { ...c, detail: [c.assetType, c.provider ? providerName(c.provider) : ''].filter(Boolean).join(' · ') };
}

/** Turns the element's `schema` into CodeMirror's namespace, with the table type and provider on each table. */
export function toNamespace(schema: SqlSchema): SQLNamespace {
  const ns: Record<string, SQLNamespace> = {};
  for (const [table, entry] of Object.entries(schema)) {
    const columns = Array.isArray(entry) ? (entry as readonly (string | SqlCompletion)[]) : (entry as { columns: readonly (string | SqlCompletion)[] }).columns;
    const info = Array.isArray(entry) ? {} : (entry as { type?: string; provider?: string });
    const label = table.split('.').pop() ?? table;
    ns[table] = {
      self: describe({ label, type: 'type', assetType: info.type ?? 'table', provider: info.provider }),
      children: columns.map((c) => (typeof c === 'string' ? { label: c, type: 'property' } : describe({ type: 'property', ...c }))),
    };
  }
  return ns;
}

export interface SqlLanguageOptions {
  dialect: string;
  schema: SqlSchema;
  defaultSchema?: string;
  completer?: SqlCompleter | null;
}

export function sqlLanguage(o: SqlLanguageOptions): Extension {
  const dialect = dialectFor(o.dialect);
  const support = sql({
    dialect,
    schema: toNamespace(o.schema),
    defaultSchema: o.defaultSchema || undefined,
    upperCaseKeywords: false,
  });
  const exts: Extension[] = [support, autocompletion({ addToOptions: [providerLogoOption] })];
  const completer = o.completer;
  if (completer) {
    const source = async (ctx: CompletionContext): Promise<CompletionResult | null> => {
      const word = ctx.matchBefore(/\w*$/);
      if (!word || (word.from === word.to && !ctx.explicit && ctx.state.sliceDoc(word.from - 1, word.from) !== '.')) return null;
      const options = await completer(ctx);
      if (ctx.aborted) return null;
      return { from: word.from, options: options.map(describe), validFor: /^\w*$/ };
    };
    exts.push(support.language.data.of({ autocomplete: source }));
  }
  return exts;
}

/** Ctrl/⌘+Enter runs and Shift+Alt+F formats, ahead of the default keymap's Mod-Enter. */
export function sqlKeys(o: { run(): void; format(): boolean }): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: 'Mod-Enter',
        preventDefault: true,
        run: () => {
          o.run();
          return true;
        },
      },
      { key: 'Shift-Alt-f', preventDefault: true, run: () => o.format() },
    ]),
  );
}

/** Renders the provider logo in a completion row; full colour, never recoloured. */
export const providerLogoOption = {
  position: 20,
  render(completion: Completion): Node | null {
    const provider = (completion as SqlCompletion).provider;
    if (!provider || typeof document === 'undefined') return null;
    const logo = document.createElement('mm-provider-logo');
    logo.setAttribute('provider', provider);
    logo.setAttribute('size', '14');
    (logo as HTMLElement & { decorative?: boolean }).decorative = true;
    logo.setAttribute('aria-hidden', 'true');
    return logo;
  },
};
