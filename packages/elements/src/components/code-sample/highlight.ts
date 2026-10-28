/**
 * A small, dependency-free syntax tokenizer for code samples and for the static fallback of the
 * code editor. It runs in `render()`, so it never touches the DOM and is safe during SSR. It knows
 * enough of SQL, shell, JSON, YAML, TypeScript and JavaScript, HCL and Go to colour keywords,
 * functions, strings, numbers and comments with the `mm-syn-*` tokens; it is not a parser.
 */
import { html, type TemplateResult } from 'lit';

/** `k` keyword, `f` function or key, `s` string, `n` number or constant, `c` comment, `''` plain. */
export type TokenKind = 'k' | 'f' | 's' | 'n' | 'c' | '';
export interface Token {
  t: TokenKind;
  v: string;
}

export type SampleLanguage =
  | 'sql'
  | 'bash'
  | 'shell'
  | 'sh'
  | 'json'
  | 'yaml'
  | 'yml'
  | 'typescript'
  | 'ts'
  | 'javascript'
  | 'js'
  | 'hcl'
  | 'terraform'
  | 'go'
  | 'text';

interface LangSpec {
  keywords: Set<string>;
  constants?: Set<string>;
  caseInsensitive?: boolean;
  lineComments?: string[];
  blockComment?: [string, string];
  strings: string[];
  /** Delimiters whose strings may run over several lines. */
  multiline?: string[];
  /** Delimiters that quote identifiers rather than strings (SQL double quotes). */
  identifierQuotes?: string[];
  /** Identifiers followed by `(` are functions. */
  calls?: boolean;
  /** Language-specific rule tried before the generic ones. */
  extra?: (src: string, i: number, lineStart: boolean) => { t: TokenKind; len: number } | null;
}

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

export const SQL_KEYWORDS = words(`
  select from where group by order having limit offset fetch join left right inner outer full cross natural on using as and or not
  in is null like ilike similar between case when then else end with recursive union all distinct except intersect insert into
  values update set delete merge create replace table view materialized index unique primary key foreign references constraint
  drop alter add column rename to if exists cascade restrict over partition rows range groups preceding following current row
  unbounded window filter within interval cast asc desc nulls first last returning lateral grant revoke on default check
  temporary temp schema database begin commit rollback transaction explain analyze qualify pivot unpivot top any some exists
  escape collate at time zone true false array struct qualify`);
const SQL_CONSTANTS = words('true false null');

const TS_KEYWORDS = words(`
  import export from default as const let var function return if else for while do switch case break continue new class extends
  implements interface type enum async await try catch finally throw typeof instanceof in of void delete yield static public
  private protected readonly declare namespace keyof satisfies get set this super`);
const TS_CONSTANTS = words('true false null undefined NaN Infinity');

const GO_KEYWORDS = words(`
  package import func return var const type struct interface map chan go defer if else for range switch case default break
  continue select fallthrough goto`);
const GO_CONSTANTS = words('true false nil iota');

const HCL_KEYWORDS = words('resource data variable output provider module locals terraform for in if else endif endfor dynamic content each count');
const HCL_CONSTANTS = words('true false null');

const SH_KEYWORDS = words('if then else elif fi for do done while until case esac function in select return export local readonly unset');

const isIdentStart = (c: string | undefined) => !!c && /[A-Za-z_]/.test(c);
const isIdent = (c: string | undefined) => !!c && /[\w$]/.test(c);

/** Shell: the first word of a command is a function, flags are keywords, variables are numbers. */
const shellExtra: LangSpec['extra'] = (src, i, lineStart) => {
  const c = src[i]!;
  if (c === '$') {
    const m = /^\$(\{[^}\n]*\}|\w+|[@#?*!$0-9])/.exec(src.slice(i, i + 80));
    if (m) return { t: 'n', len: m[0].length };
  }
  const prev = src[i - 1];
  if (c === '-' && (prev === undefined || /[\s=]/.test(prev))) {
    const m = /^--?[A-Za-z][\w-]*/.exec(src.slice(i, i + 80));
    if (m) return { t: 'k', len: m[0].length };
  }
  if (lineStart && isIdentStart(c)) {
    const m = /^[A-Za-z_][\w.-]*/.exec(src.slice(i, i + 80));
    if (m && !SH_KEYWORDS.has(m[0])) return { t: 'f', len: m[0].length };
  }
  return null;
};

/** YAML: a mapping key at the start of a line is a key. */
const yamlExtra: LangSpec['extra'] = (src, i, lineStart) => {
  if (!lineStart) return null;
  const m = /^(?:- +)?([A-Za-z_][\w.\-/]*|"[^"\n]*"|'[^'\n]*')(?=\s*:(?:\s|$))/.exec(src.slice(i, i + 200));
  if (!m) return null;
  const dash = m[0].length - m[1]!.length;
  if (dash) return { t: '', len: dash };
  return { t: 'f', len: m[0].length };
};

/** JSON: a string followed by a colon is a key. */
const jsonExtra: LangSpec['extra'] = (src, i) => {
  if (src[i] !== '"') return null;
  const m = /^"(?:[^"\\\n]|\\.)*"(?=\s*:)/.exec(src.slice(i, i + 400));
  return m ? { t: 'f', len: m[0].length } : null;
};

const LANGS: Record<string, LangSpec> = {
  sql: {
    keywords: SQL_KEYWORDS,
    constants: SQL_CONSTANTS,
    caseInsensitive: true,
    lineComments: ['--'],
    blockComment: ['/*', '*/'],
    strings: ["'"],
    multiline: ["'"],
    identifierQuotes: ['"', '`'],
    calls: true,
  },
  shell: { keywords: SH_KEYWORDS, lineComments: ['#'], strings: ["'", '"'], extra: shellExtra },
  json: { keywords: new Set(), constants: words('true false null'), strings: ['"'], extra: jsonExtra },
  yaml: { keywords: new Set(), constants: words('true false null yes no on off ~'), lineComments: ['#'], strings: ["'", '"'], extra: yamlExtra },
  typescript: {
    keywords: TS_KEYWORDS,
    constants: TS_CONSTANTS,
    lineComments: ['//'],
    blockComment: ['/*', '*/'],
    strings: ["'", '"', '`'],
    multiline: ['`'],
    calls: true,
  },
  hcl: { keywords: HCL_KEYWORDS, constants: HCL_CONSTANTS, lineComments: ['#', '//'], blockComment: ['/*', '*/'], strings: ['"'], calls: true },
  go: {
    keywords: GO_KEYWORDS,
    constants: GO_CONSTANTS,
    lineComments: ['//'],
    blockComment: ['/*', '*/'],
    strings: ['"', '`', "'"],
    multiline: ['`'],
    calls: true,
  },
};
const ALIASES: Record<string, string> = { bash: 'shell', sh: 'shell', zsh: 'shell', yml: 'yaml', ts: 'typescript', javascript: 'typescript', js: 'typescript', terraform: 'hcl', tf: 'hcl', golang: 'go' };

const specFor = (language: string): LangSpec | undefined => {
  const key = language.toLowerCase();
  return LANGS[ALIASES[key] ?? key];
};

/** Splits code into tokens. Unknown languages come back as one plain token. */
export function tokenize(code: string, language: string): Token[] {
  const spec = specFor(language);
  if (!spec) return [{ t: '', v: code }];
  const out: Token[] = [];
  const push = (t: TokenKind, v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.t === t) last.v += v;
    else out.push({ t, v });
  };
  let i = 0;
  let lineStart = true;
  const n = code.length;
  while (i < n) {
    const c = code[i]!;
    if (c === '\n') {
      push('', c);
      i++;
      lineStart = true;
      continue;
    }
    if (lineStart && (c === ' ' || c === '\t')) {
      push('', c);
      i++;
      continue;
    }
    // Shell prompts ("$ marmot …") keep the following command at line start.
    if (lineStart && spec === LANGS.shell && c === '$' && code[i + 1] === ' ') {
      push('', '$ ');
      i += 2;
      continue;
    }
    const lc = spec.lineComments?.find((p) => code.startsWith(p, i));
    if (lc) {
      const end = code.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      push('c', code.slice(i, stop));
      i = stop;
      lineStart = false;
      continue;
    }
    if (spec.blockComment && code.startsWith(spec.blockComment[0], i)) {
      const end = code.indexOf(spec.blockComment[1], i + spec.blockComment[0].length);
      const stop = end < 0 ? n : end + spec.blockComment[1].length;
      push('c', code.slice(i, stop));
      i = stop;
      lineStart = false;
      continue;
    }
    const ex: { t: TokenKind; len: number } | null | undefined = spec.extra?.(code, i, lineStart);
    if (ex && ex.len > 0) {
      push(ex.t, code.slice(i, i + ex.len));
      i += ex.len;
      lineStart = ex.t === '' && /^[-\s]*$/.test(code.slice(i - ex.len, i));
      continue;
    }
    lineStart = false;
    const quoteKind: TokenKind | null = spec.strings.includes(c) ? 's' : spec.identifierQuotes?.includes(c) ? '' : null;
    if (quoteKind !== null) {
      const multi = spec.multiline?.includes(c) ?? false;
      let j = i + 1;
      while (j < n) {
        const d = code[j]!;
        if (d === '\\' && spec !== LANGS.sql) {
          j += 2;
          continue;
        }
        if (d === c) {
          j++;
          break;
        }
        if (d === '\n' && !multi) break;
        j++;
      }
      push(quoteKind, code.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) && !isIdent(code[i - 1])) {
      const m = /^(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?)/.exec(code.slice(i, i + 64));
      if (m) {
        push('n', m[0]);
        i += m[0].length;
        continue;
      }
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);
      const key = spec.caseInsensitive ? word.toLowerCase() : word;
      let kind: TokenKind = '';
      if (spec.keywords.has(key)) kind = 'k';
      else if (spec.constants?.has(key)) kind = 'n';
      else if (spec.calls && /^\s*\(/.test(code.slice(j, j + 8)) && code[i - 1] !== '.') kind = 'f';
      push(kind, word);
      i = j;
      continue;
    }
    push('', c);
    i++;
  }
  return out;
}

/** Tokens split into lines, with tokens that span lines (block comments, multi-line strings) cut at each newline. */
export function tokenizeLines(code: string, language: string): Token[][] {
  const lines: Token[][] = [[]];
  for (const tok of tokenize(code, language)) {
    const parts = tok.v.split('\n');
    parts.forEach((part, k) => {
      if (k > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ t: tok.t, v: part });
    });
  }
  return lines;
}

/** Renders one line of tokens as `<span class="k|f|s|n|c">` runs, plain text unwrapped. */
export const renderTokens = (tokens: Token[]): unknown[] =>
  tokens.map((tok) => (tok.t ? html`<span class=${tok.t}>${tok.v}</span>` : tok.v));

/** Renders highlighted code as lit templates, one entry per line. */
export const renderLines = (code: string, language: string): TemplateResult[] =>
  tokenizeLines(code, language).map((line) => html`${renderTokens(line)}`);

/** Parses a line list such as "2, 4-6" into a set of 1-based line numbers. */
export function parseLineRanges(value: string): Set<number> {
  const set = new Set<number>();
  for (const part of value.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let k = Math.min(a, b); k <= Math.max(a, b) && k - a < 10_000; k++) set.add(k);
  }
  return set;
}

/**
 * The SQL formatter behind Shift+Alt+F: upper-cases keywords outside strings, comments and quoted
 * identifiers, and trims trailing whitespace. Deliberately conservative, so it never changes meaning.
 */
export function formatSql(sql: string): string {
  return tokenize(sql, 'sql')
    .map((tok) => (tok.t === 'k' ? tok.v.toUpperCase() : tok.v))
    .join('')
    .replace(/[ \t]+$/gm, '');
}

/** Removes a common leading indent and the blank first and last lines, for code written inline in HTML. */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0]!.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
}
