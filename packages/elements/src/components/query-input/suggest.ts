import { tr } from '../../core/strings.js';
import { tokenize, type QuerySuggestFn, type QuerySuggestion, type QueryToken } from './class.js';

export interface QuerySuggestField {
  /** The field path without `@`, such as `type` or `metadata.owner`. */
  value: string;
  /** Short description shown beside the field. */
  description?: string;
  /** Known values, suggested after an operator. */
  values?: string[];
}

export interface QuerySuggestOptions {
  fields: QuerySuggestField[];
  /** Values for fields without a `values` list, such as metadata looked up on the server. */
  values?: (field: string, prefix: string) => string[] | Promise<string[]>;
  /** Most suggestions shown at once. Default 8. */
  limit?: number;
}

const operators = (): { op: string; description: string }[] => [
  { op: '=', description: tr('qsEquals', 'is') },
  { op: '!=', description: tr('qsNotEquals', 'is not') },
  { op: 'contains', description: tr('qsContains', 'contains text') },
  { op: '>', description: tr('qsGreater', 'greater than') },
  { op: '<', description: tr('qsLess', 'less than') },
  { op: '>=', description: tr('qsGreaterEqual', 'at least') },
  { op: '<=', description: tr('qsLessEqual', 'at most') },
  { op: 'range', description: tr('qsRange', 'between two values') },
];

const booleans = (): { word: string; description: string }[] => [
  { word: 'AND', description: tr('qsAnd', 'both must match') },
  { word: 'OR', description: tr('qsOr', 'either can match') },
  { word: 'NOT', description: tr('qsNot', 'leave out matches') },
];

const quote = (v: string) => (/[\s"()[\]]/.test(v) ? `"${v.replace(/"/g, '')}"` : v);
const unquote = (v: string) => v.replace(/^"|"$/g, '');
const starts = (text: string, prefix: string) => text.toLowerCase().startsWith(prefix.toLowerCase());

/**
 * Suggestions for `mm-query-input` that follow the query as it is typed, like an editor: `@` lists
 * the fields, a space after a field lists the operators, a space after an operator lists the field's
 * known values, and a space after a value offers AND, OR and NOT. Each step reopens the list for
 * the next. Free text gets no suggestions.
 */
export function createQuerySuggest(options: QuerySuggestOptions): QuerySuggestFn {
  const limit = options.limit ?? 8;
  const fieldList = (prefix: string): QuerySuggestion[] =>
    options.fields
      .filter((f) => !prefix || f.value.toLowerCase().includes(prefix.toLowerCase()))
      .slice(0, limit)
      .map((f) => ({ label: `@${f.value}`, description: f.description, chain: true }));

  return async (query, cursor) => {
    const toks = tokenize(query.slice(0, cursor));
    const last = toks[toks.length - 1];
    const sig = toks.filter((k) => k.type !== 'whitespace');
    const typing = !!last && last.type !== 'whitespace';
    const cur = typing ? last : undefined;
    const prev: QueryToken | undefined = sig[sig.length - (typing ? 2 : 1)];
    const isField = (k?: QueryToken) => k?.type === 'metadata' || k?.type === 'field';
    const isOperator = (k?: QueryToken) => k?.type === 'operator' || (k?.type === 'keyword' && k.text === 'contains');

    // Typing a field name.
    if (cur?.type === 'metadata') return fieldList(cur.text.slice(1));

    // After a field: operators.
    if (isField(prev) && (!cur || cur.type === 'text')) {
      return operators()
        .filter((o) => !cur || starts(o.op, cur.text))
        .map((o) => (o.op === 'range' ? { label: 'range', insert: 'range [', description: o.description } : { label: o.op, description: o.description, chain: true }));
    }

    // After an operator: the field's values.
    if (isOperator(prev) && (!cur || cur.type === 'value')) {
      const at = sig.lastIndexOf(prev!);
      const field = [...sig.slice(0, at)].reverse().find(isField);
      if (!field) return [];
      const name = field.text.replace(/^@/, '');
      const prefix = cur ? unquote(cur.text) : '';
      const known = options.fields.find((f) => f.value === name)?.values;
      const values = known ?? (await options.values?.(name, prefix)) ?? [];
      return values
        .filter((v) => starts(v, prefix))
        .slice(0, limit)
        .map((v) => ({ label: v, insert: quote(v), chain: true }));
    }

    // After a value: join with another condition.
    if ((prev?.type === 'value' || (prev?.type === 'paren' && prev.text === ']')) && (!cur || cur.type === 'text')) {
      return booleans()
        .filter((b) => !cur || starts(b.word, cur.text))
        .map((b) => ({ label: b.word, description: b.description, chain: true }));
    }

    // After AND, OR or NOT: the fields again.
    if (prev?.type === 'keyword' && /^(AND|OR|NOT)$/.test(prev.text) && !cur) return fieldList('');

    return [];
  };
}
