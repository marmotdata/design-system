import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { float } from '../../core/floating.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../checkbox/define.js';
import '../text-field/define.js';
import '../query-input/define.js';
import '../query-builder/define.js';
import { createQuerySuggest } from '../query-input/suggest.js';
import type { MmQueryInput } from '../query-input/class.js';

/* ------------------------------------------------------------------------------------------------
 * Model. The bar shows free text plus conditions ANDed together. A condition may hold several
 * values of one field (shown as "is X or Y"). Anything else (brackets across fields, OR between
 * different fields) is shown as text, so nothing is ever lost.
 * ---------------------------------------------------------------------------------------------- */

/** `matches` is a wildcard pattern (`customer*`), written as `=` with a `*` in the value. */
export type SearchOperator = '=' | '!=' | 'contains' | 'matches' | '>' | '<' | '>=' | '<=' | 'range';

export interface SearchCondition {
  field: string;
  operator: SearchOperator;
  /** One or more values; several values of one field are ORed. For `range`, the lower bound. */
  values: string[];
  /** Upper bound for `range`. */
  to?: string;
}

export interface SearchModel {
  text: string;
  conditions: SearchCondition[];
}

export interface SearchBarField {
  /** The field path without `@`, such as `type` or `metadata.owner`. */
  value: string;
  /** The field in everyday words, such as "Type" or "Owner". */
  label: string;
  /** Known values to pick from; give labels for values that read differently ("snowflake" as "Snowflake"). */
  values?: (string | { value: string; label: string })[];
  /**
   * Decides the operators, following what Marmot's query engine accepts:
   * `text` (type, provider, kind, name): is, is not, contains, matches;
   * `term` (glossary term): is, matches;
   * `number` (numeric metadata): is, is not, comparisons and between;
   * `metadata` (any other metadata path): every operator.
   */
  kind?: 'text' | 'term' | 'number' | 'metadata';
  /** Overrides the operators the kind gives. */
  operators?: SearchOperator[];
}

/** The operators a field accepts. */
export function operatorsFor(field: SearchBarField): SearchOperator[] {
  if (field.operators?.length) return field.operators;
  const kind = field.kind ?? (field.value.startsWith('metadata.') ? 'metadata' : 'text');
  if (kind === 'term') return ['=', 'matches'];
  if (kind === 'number') return ['=', '!=', '>', '<', '>=', '<=', 'range'];
  if (kind === 'metadata') return ['=', '!=', 'contains', 'matches', '>', '<', '>=', '<=', 'range'];
  return ['=', '!=', 'contains', 'matches'];
}

/** A field by path, or a plain one for a metadata path the list does not name. */
export function fieldFor(path: string, fields: SearchBarField[]): SearchBarField {
  return (
    fields.find((f) => f.value === path) ?? {
      value: path,
      label: path.startsWith('metadata.') ? path : path.replace(/^\w/, (c) => c.toUpperCase()),
      kind: path.startsWith('metadata.') ? 'metadata' : 'text',
    }
  );
}

/** Values that read in plain words but are written as query syntax. */
export const opSyntax = (op: SearchOperator): string => (op === 'matches' ? '=' : op);

// Wildcards are quoted too, as Marmot's query docs write them ("orders_*").
const quote = (v: string) => (/[\s"()[\]*]/.test(v) ? `"${v.replace(/"/g, '')}"` : v);
const unquote = (v: string) => v.replace(/^"|"$/g, '');
const COND = /^@([\w.-]+)\s*(!=|>=|<=|=|:|>|<|contains)\s*("[^"]*"|\S+)$/;
const RANGE = /^@([\w.-]+)\s+range\s+\[\s*("[^"]*"|\S+)\s+TO\s+("[^"]*"|[^\]\s]+)\s*\]$/;

const one = (c: SearchCondition, v: string) =>
  c.operator === 'range' ? `@${c.field} range [${quote(v)} TO ${quote(c.to ?? '')}]` : `@${c.field} ${opSyntax(c.operator)} ${quote(v)}`;

/** Writes the model as Marmot query syntax. */
export function buildSearch(model: SearchModel): string {
  const parts: string[] = [];
  if (model.text.trim()) parts.push(model.text.trim());
  for (const c of model.conditions) {
    const vals = c.values.filter((v) => v !== '');
    if (!vals.length) continue;
    parts.push(vals.length === 1 ? one(c, vals[0]!) : `(${vals.map((v) => one(c, v)).join(' OR ')})`);
  }
  return parts.join(' AND ');
}

/** Splits on a keyword outside quotes, brackets and parentheses. */
function splitTop(q: string, word: 'AND' | 'OR'): string[] {
  const out: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i]!;
    if (ch === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && q.startsWith(` ${word} `, i)) {
      out.push(q.slice(start, i));
      start = i + word.length + 2;
      i = start - 1;
    }
  }
  out.push(q.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

function parseOne(p: string): SearchCondition | null {
  const r = RANGE.exec(p);
  if (r) return { field: r[1]!, operator: 'range', values: [unquote(r[2]!)], to: unquote(r[3]!) };
  const m = COND.exec(p);
  if (m) {
    const value = unquote(m[3]!);
    const op = (m[2] === ':' ? '=' : m[2]) as SearchOperator;
    return { field: m[1]!, operator: op === '=' && value.includes('*') ? 'matches' : op, values: [value] };
  }
  return null;
}

/** Reads a query into the model, or null when it needs the text view (brackets across fields, OR between fields). */
export function parseSearch(query: string): SearchModel | null {
  const model: SearchModel = { text: '', conditions: [] };
  const text: string[] = [];
  for (const part of splitTop(query.trim(), 'AND')) {
    if (part.startsWith('(') && part.endsWith(')')) {
      const alts = splitTop(part.slice(1, -1).trim(), 'OR').map(parseOne);
      if (alts.some((a) => !a) || new Set(alts.map((a) => `${a!.field} ${a!.operator}`)).size !== 1) return null;
      model.conditions.push({ ...alts[0]!, values: alts.map((a) => a!.values[0]!) });
      continue;
    }
    const c = parseOne(part);
    if (c) {
      model.conditions.push(c);
      continue;
    }
    // Conditions written with spaces instead of AND ("orders @type = table") still read as tokens.
    const inline = /@[\w.-]+\s+range\s+\[[^\]]*\]|@[\w.-]+\s*(?:!=|>=|<=|=|:|>|<|contains)\s*(?:"[^"]*"|[^\s"()]+)/g;
    const found = (part.match(inline) ?? []).map(parseOne);
    const rest = part.replace(inline, ' ').replace(/\s+/g, ' ').trim();
    if (found.some((x) => !x) || /(^|\s)(@|OR\b|NOT\b)|[()[\]]/.test(rest)) return null;
    model.conditions.push(...(found as SearchCondition[]));
    if (rest) text.push(rest);
  }
  model.text = text.join(' ');
  return model;
}

/* ------------------------------------------------------------------------------------------------ */

const operatorWords = (): Record<SearchOperator, string> => ({
  '=': tr('sbIs', 'is'),
  '!=': tr('sbIsNot', 'is not'),
  contains: tr('sbContains', 'contains'),
  matches: tr('sbMatches', 'matches'),
  '>': tr('sbMore', 'more than'),
  '<': tr('sbLess', 'less than'),
  '>=': tr('sbAtLeast', 'at least'),
  '<=': tr('sbAtMost', 'at most'),
  range: tr('sbBetween', 'between'),
});

type EditorPart = 'field' | 'operator' | 'value';

/**
 * The search bar is the query builder. Free text and conditions live in one field: each condition
 * is a neutral token in plain words ("Type is Table", "Provider is Snowflake or BigQuery"), and
 * clicking a part of a token edits it (the field, the operator, or the value with a picker that
 * fits the field: a list of known values, a text box, or a from and to pair for ranges). Several
 * values of one field read as "is X or Y". There is no separate builder and no mode to switch.
 *
 * Add a condition by typing `@` (editor-style completion walks field, operator, value), in the
 * query builder, or from outside, such as a facet sidebar setting
 * `value`. "Build query" opens `mm-query-builder` in place of the bar, for groups that match all,
 * any or none; Apply writes the result back. "Show as text" swaps the tokens for the raw query in
 * place; a query the tokens cannot show (groups, OR between fields) shows as text with Build query
 * beside it, never as a dead end.
 *
 * Keyboard: Left at the start of the text moves into the tokens, Left and Right move between their
 * parts, Enter or Space opens a part's editor, Escape closes it and returns focus, Backspace on an
 * empty text box selects the last token and a second Backspace removes it, Delete removes the
 * focused token. Changes are announced politely. Enter in the text box fires `mm-search`.
 *
 * @tagname mm-search-bar
 * @summary Search with conditions as editable tokens: the query builder and the search box in one.
 * @csspart field - The bordered bar.
 * @csspart token - Each condition token.
 * @csspart actions - The row with Show as text and Build query.
 * @csspart editor - The popup that edits a token part.
 * @fires mm-input - {{ value: string }} The query changed.
 * @fires mm-search - {{ query: string }} Enter was pressed in the text box.
 * @fires mm-draft - {{ value: string }} The query builder's draft changed, so the page can set `draft-count`.
 */
export class MmSearchBar extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .field {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1) var(--space-2);
        min-block-size: var(--mm-control, var(--control-h));
        padding: 3px var(--space-2) 3px 10px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        cursor: text;
      }
      .field:hover {
        border-color: var(--mm-text-2);
      }
      .field:focus-within {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
      .lead {
        color: var(--mm-text-2);
        flex: none;
      }
      .token {
        display: inline-flex;
        align-items: center;
        max-inline-size: 100%;
        block-size: 26px;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        font: var(--text-dense);
        overflow: hidden;
      }
      .token.selected {
        border-color: var(--mm-text);
      }
      .part {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        block-size: 100%;
        padding-inline: 6px;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-inline-size: 16rem;
      }
      .part:hover {
        background: var(--mm-sunken);
      }
      .part:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: -2px;
      }
      .part.field-name {
        color: var(--mm-text-2);
        padding-inline-end: 3px;
      }
      .part.op {
        color: var(--mm-text-2);
        padding-inline: 3px;
      }
      .part.val {
        font-weight: 600;
        padding-inline-start: 3px;
      }
      .part.remove {
        padding-inline: 4px;
        color: var(--mm-text-2);
        border-inline-start: 1px solid var(--mm-rule);
      }
      mm-query-input {
        flex: 1 1 12rem;
        min-inline-size: 10rem;
      }
      mm-query-input::part(field) {
        border: 0;
        background: transparent;
        padding-inline: 0;
        min-block-size: 26px;
        block-size: auto;
        outline: none;
      }
      mm-query-input::part(icon) {
        display: none;
      }
      .clear {
        flex: none;
      }
      .below {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
      }
      .below .end {
        display: flex;
        gap: var(--space-2);
        margin-inline-start: auto;
      }
      .note {
        margin: var(--space-2) 0 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .editor {
        margin: 0;
        padding: var(--space-2);
        min-inline-size: 14rem;
        max-inline-size: 22rem;
        background: var(--mm-raised);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-float);
        color: var(--mm-text);
        font: var(--text-dense);
        overflow: auto;
      }
      .editor .opt {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        inline-size: 100%;
        min-block-size: var(--mm-menu-row, 32px);
        padding-inline: var(--space-2);
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .editor .opt:hover,
      .editor .opt:focus-visible {
        background: var(--mm-sunken);
      }
      .editor .opt[aria-checked='true'] {
        font-weight: 600;
      }
      .editor .stack {
        display: grid;
        gap: var(--space-2);
      }
      .editor .row {
        display: flex;
        gap: var(--space-2);
        justify-content: flex-end;
        margin-block-start: var(--space-1);
      }
    `,
  ];

  /** The query, in Marmot search syntax. */
  @property() accessor value = '';
  /** Fields people can filter on, with everyday labels and known values. */
  @property({ attribute: false }) accessor fields: SearchBarField[] = [];
  /** Accessible name of the search. */
  @property() accessor label = '';
  @property() accessor placeholder = '';
  /** Shows the raw query instead of tokens. */
  @property({ type: Boolean, reflect: true }) accessor raw = false;
  /** Shows the query builder in place of the bar. */
  @property({ type: Boolean, reflect: true }) accessor building = false;
  /** Suggests metadata fields in the query builder, such as from `/assets/suggestions/metadata/fields`. */
  @property({ attribute: false }) accessor loadFields: ((prefix: string) => Promise<string[]>) | undefined;
  /** Suggests values in the query builder, such as from `/assets/suggestions/metadata/values`. */
  @property({ attribute: false }) accessor loadValues: ((field: string, prefix: string) => Promise<string[]>) | undefined;
  /** Live number of results for the builder's draft, set by the page after `mm-draft`. */
  @property({ type: Number, attribute: 'draft-count' }) accessor draftCount: number | undefined;

  @state() accessor #model: SearchModel = { text: '', conditions: [] };
  @state() accessor #unsupported = false;
  @state() accessor #selected = -1;
  @state() accessor #editing: { index: number; part: EditorPart } | null = null;
  @state() accessor #announce = '';
  #emitted: string | null = null;
  #unfloat?: () => void;

  @query('mm-query-input') accessor #input!: MmQueryInput | null;
  @query('.editor') accessor #editor!: HTMLElement | null;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && this.value !== this.#emitted) {
      const m = parseSearch(this.value);
      this.#unsupported = !m;
      if (m) this.#model = m;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unfloat?.();
  }

  // ---- model helpers ------------------------------------------------------------------------

  #fieldOf(path: string): SearchBarField {
    return fieldFor(path, this.fields);
  }

  #valueLabel(field: SearchBarField, v: string): string {
    const known = (field.values ?? []).find((x) => (typeof x === 'string' ? x : x.value) === v);
    return known && typeof known !== 'string' ? known.label : v;
  }

  #valueText(c: SearchCondition): string {
    const f = this.#fieldOf(c.field);
    if (c.operator === 'range') return tr('sbRange', '{from} and {to}', { from: c.values[0] ?? '', to: c.to ?? '' });
    return c.values.map((v) => this.#valueLabel(f, v)).join(` ${tr('sbOr', 'or')} `);
  }

  #describe(c: SearchCondition): string {
    return `${this.#fieldOf(c.field).label} ${operatorWords()[c.operator]} ${this.#valueText(c)}`;
  }

  #commit(model: SearchModel, announce = '') {
    this.#model = model;
    const value = buildSearch(model);
    if (announce) this.#announce = announce;
    if (value === this.value) return;
    this.#emitted = value;
    this.value = value;
    emit(this, 'mm-input', { value });
  }

  #setCondition(i: number, c: SearchCondition) {
    const conditions = [...this.#model.conditions];
    conditions[i] = c;
    this.#commit({ ...this.#model, conditions });
  }

  async #remove(i: number) {
    const c = this.#model.conditions[i];
    if (!c) return;
    const conditions = this.#model.conditions.filter((_, k) => k !== i);
    this.#selected = -1;
    this.#commit({ ...this.#model, conditions }, tr('sbRemoved', 'Removed {filter}', { filter: this.#describe(c) }));
    await this.updateComplete;
    const parts = this.#parts();
    (parts[Math.min(i * 4, parts.length - 1)] ?? this.#input)?.focus();
  }

  // ---- text box -----------------------------------------------------------------------------

  /** A completed condition at the end of the text ("… @type = table ") becomes a token. */
  #onText = (e: CustomEvent<{ value: string }>) => {
    e.stopPropagation();
    const v = e.detail.value;
    const m = /(?:^|\s)(@[\w.-]+\s*(?:!=|>=|<=|=|:|>|<|contains)\s*(?:"[^"]*"|[^\s"]+))\s$/.exec(v);
    const c = m ? parseOne(m[1]!.trim()) : null;
    if (c) {
      const text = v.slice(0, v.length - m![0].length).trim();
      const conditions = this.#merge(c);
      this.#commit({ text, conditions }, tr('sbAdded', 'Added {filter}', { filter: this.#describe(c) }));
      if (this.#input) this.#input.value = text ? `${text} ` : '';
      return;
    }
    if (/(^|\s)@/.test(v)) return; // A condition is still being typed.
    this.#commit({ ...this.#model, text: v });
  };

  /** A second value for a field already filtered with "is" joins that token as "or". */
  #merge(c: SearchCondition): SearchCondition[] {
    const conditions = [...this.#model.conditions];
    const same = conditions.findIndex((x) => x.field === c.field && x.operator === c.operator && c.operator === '=');
    if (same >= 0 && !conditions[same]!.values.includes(c.values[0]!)) conditions[same] = { ...conditions[same]!, values: [...conditions[same]!.values, c.values[0]!] };
    else if (same < 0) conditions.push(c);
    return conditions;
  }

  #onTextKeydown = (e: KeyboardEvent) => {
    const empty = !this.#input?.value;
    const n = this.#model.conditions.length;
    if (e.key === 'Backspace' && empty && n) {
      e.preventDefault();
      if (this.#selected === n - 1) void this.#remove(n - 1);
      else {
        this.#selected = n - 1;
        this.#announce = tr('sbSelected', '{filter} selected. Press Backspace again to remove it.', { filter: this.#describe(this.#model.conditions[n - 1]!) });
      }
      return;
    }
    if (e.key === 'ArrowLeft' && empty && n) {
      e.preventDefault();
      this.#parts().at(-1)?.focus();
      return;
    }
    if (e.key !== 'Backspace') this.#selected = -1;
  };

  // ---- tokens ---------------------------------------------------------------------------------

  #parts(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.token .part')];
  }

  #onTokenKeydown = (e: KeyboardEvent) => {
    const parts = this.#parts();
    const i = parts.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    const token = Number((e.target as HTMLElement).closest<HTMLElement>('.token')!.dataset.index);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      (parts[i + 1] ?? this.#input)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      parts[Math.max(0, i - 1)]?.focus();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      void this.#remove(token);
    }
  };

  async #openEditor(index: number, part: EditorPart, anchor: HTMLElement) {
    const c = this.#model.conditions[index];
    if (!c) return;
    this.#editing = { index, part };
    await this.updateComplete;
    const ed = this.#editor;
    if (!ed) return;
    try {
      ed.showPopover();
    } catch {
      /* already open */
    }
    this.#unfloat?.();
    this.#unfloat = float(anchor, ed);
    ed.querySelector<HTMLElement>('[aria-checked="true"], .opt, mm-text-field, mm-checkbox')?.focus();
  }

  #closeEditor(refocus = true) {
    const was = this.#editing;
    this.#unfloat?.();
    this.#unfloat = undefined;
    try {
      this.#editor?.hidePopover();
    } catch {
      /* not open */
    }
    this.#editing = null;
    if (refocus && was) void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(`.token[data-index="${was.index}"] .part.${was.part === 'field' ? 'field-name' : was.part === 'operator' ? 'op' : 'val'}`)?.focus() ?? this.#input?.focus());
  }

  #apply(c: SearchCondition) {
    const ed = this.#editing;
    if (!ed) return;
    this.#setCondition(ed.index, c);
    this.#closeEditor();
  }

  // ---- render ---------------------------------------------------------------------------------

  #renderToken(c: SearchCondition, i: number) {
    const f = this.#fieldOf(c.field);
    const name = this.#describe(c);
    return html`<span class="token ${this.#selected === i ? 'selected' : ''}" part="token" role="group" aria-label=${tr('sbFilter', 'Filter: {filter}', { filter: name })} data-index=${i} @keydown=${this.#onTokenKeydown}>
      <button class="part field-name" type="button" aria-label=${tr('sbChangeField', 'Change field, {field}', { field: f.label })} @click=${(e: Event) => this.#openEditor(i, 'field', e.currentTarget as HTMLElement)}>${f.label}</button>
      <button class="part op" type="button" aria-label=${tr('sbChangeOperator', 'Change operator, {op}', { op: operatorWords()[c.operator] })} @click=${(e: Event) => this.#openEditor(i, 'operator', e.currentTarget as HTMLElement)}>${operatorWords()[c.operator]}</button>
      <button class="part val" type="button" aria-label=${tr('sbChangeValue', 'Change value, {value}', { value: this.#valueText(c) })} @click=${(e: Event) => this.#openEditor(i, 'value', e.currentTarget as HTMLElement)}>${this.#valueText(c)}</button>
      <button class="part remove" type="button" aria-label=${tr('sbRemove', 'Remove {filter}', { filter: name })} @click=${() => this.#remove(i)}><mm-icon name="close" size="14" aria-hidden="true"></mm-icon></button>
    </span>`;
  }

  #renderEditor() {
    const ed = this.#editing;
    const c = ed ? this.#model.conditions[ed.index] : null;
    const body = () => {
      if (!ed || !c) return nothing;
      const f = this.#fieldOf(c.field);
      if (ed.part === 'field') {
        return html`<div role="listbox" aria-label=${tr('sbFields', 'Fields')}>
          ${this.fields.map(
            (x) => html`<button class="opt" type="button" role="option" aria-checked=${x.value === c.field ? 'true' : 'false'} @click=${() => this.#apply({ ...c, field: x.value, values: x.value === c.field ? c.values : [] })}>${x.label}</button>`,
          )}
        </div>`;
      }
      if (ed.part === 'operator') {
        const ops = operatorsFor(f);
        return html`<div role="listbox" aria-label=${tr('sbOperators', 'Operators')}>
          ${ops.map((o) => html`<button class="opt" type="button" role="option" aria-checked=${o === c.operator ? 'true' : 'false'} @click=${() => this.#apply({ ...c, operator: o, values: c.values.slice(0, o === '=' ? undefined : 1) })}>${operatorWords()[o]}</button>`)}
        </div>`;
      }
      // Value: known values pick from a list (several read as "or"); ranges take a pair; anything else a text box.
      if (c.operator === 'range') {
        let from = c.values[0] ?? '';
        let to = c.to ?? '';
        return html`<form class="stack" @submit=${(e: Event) => (e.preventDefault(), this.#apply({ ...c, values: [from], to }))}>
          <mm-text-field label=${tr('sbFrom', 'From')} value=${from} @mm-input=${(e: CustomEvent<{ value: string }>) => (from = e.detail.value)}></mm-text-field>
          <mm-text-field label=${tr('sbTo', 'To')} value=${to} @mm-input=${(e: CustomEvent<{ value: string }>) => (to = e.detail.value)}></mm-text-field>
          <div class="row"><mm-button size="sm" variant="primary" type="submit" @click=${() => this.#apply({ ...c, values: [from], to })}>${tr('sbApply', 'Apply')}</mm-button></div>
        </form>`;
      }
      if (f.values?.length && c.operator === '=') {
        let picked = [...c.values];
        return html`<div class="stack">
          ${f.values.map((x) => {
            const v = typeof x === 'string' ? x : x.value;
            return html`<mm-checkbox label=${this.#valueLabel(f, v)} ?checked=${picked.includes(v)} @mm-change=${(e: CustomEvent<{ checked: boolean }>) => (picked = e.detail.checked ? [...picked, v] : picked.filter((p) => p !== v))}></mm-checkbox>`;
          })}
          <div class="row"><mm-button size="sm" variant="primary" @click=${() => this.#apply({ ...c, values: picked })}>${tr('sbApply', 'Apply')}</mm-button></div>
        </div>`;
      }
      let text = c.values[0] ?? '';
      return html`<form class="stack" @submit=${(e: Event) => (e.preventDefault(), this.#apply({ ...c, values: [text] }))}>
        <mm-text-field label=${f.label} hide-label value=${text} placeholder=${c.operator === 'matches' ? tr('sbPattern', 'Pattern, such as customer*') : tr('sbValuePlaceholder', 'Value')} @mm-input=${(e: CustomEvent<{ value: string }>) => (text = e.detail.value)}></mm-text-field>
        <div class="row"><mm-button size="sm" variant="primary" type="submit" @click=${() => this.#apply({ ...c, values: [text] })}>${tr('sbApply', 'Apply')}</mm-button></div>
      </form>`;
    };
    return html`<div
      class="editor"
      part="editor"
      popover="auto"
      role="dialog"
      aria-label=${c ? tr('sbEdit', 'Edit {field}', { field: this.#fieldOf(c.field).label }) : tr('sbEditFilter', 'Edit filter')}
      @toggle=${(e: ToggleEvent) => e.newState === 'closed' && this.#editing && this.#closeEditor()}
      @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && (e.preventDefault(), this.#closeEditor())}
    >
      ${body()}
    </div>`;
  }

  #renderBuilder() {
    return html`<mm-query-builder
      .value=${this.value}
      .fields=${this.fields}
      .count=${this.draftCount}
      .loadFields=${this.loadFields}
      .loadValues=${this.loadValues}
      @mm-input=${(e: CustomEvent<{ value: string }>) => (e.stopPropagation(), emit(this, 'mm-draft', { value: e.detail.value }))}
      @mm-apply=${(e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        this.building = false;
        this.#emitted = null;
        this.value = e.detail.value;
        emit(this, 'mm-input', { value: this.value });
        void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.build')?.focus());
      }}
      @mm-cancel=${(e: Event) => {
        e.stopPropagation();
        this.building = false;
        void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.build')?.focus());
      }}
    ></mm-query-builder>`;
  }

  #buildButton() {
    return html`<mm-button class="build" variant="secondary" size="sm" icon="tune" @click=${async () => {
      this.building = true;
      await this.updateComplete;
      this.renderRoot.querySelector('mm-query-builder')?.renderRoot.querySelector<HTMLElement>('mm-segmented-control')?.focus();
    }}>${tr('sbBuild', 'Build query')}</mm-button>`;
  }

  override render() {
    const label = this.label || tr('search', 'Search');
    if (this.building) return this.#renderBuilder();
    const suggest = createQuerySuggest({ fields: this.fields.map((f) => ({ value: f.value, description: f.label, values: f.values?.map((x) => (typeof x === 'string' ? x : x.value)) })) });
    if (this.raw || this.#unsupported) {
      return html`<mm-query-input
          label=${label}
          hide-label
          .value=${this.value}
          .suggest=${suggest}
          @mm-input=${(e: CustomEvent<{ value: string }>) => {
            e.stopPropagation();
            this.#emitted = e.detail.value;
            this.value = e.detail.value;
            const m = parseSearch(this.value);
            this.#unsupported = !m;
            if (m) this.#model = m;
            emit(this, 'mm-input', { value: this.value });
          }}
          @mm-search=${(e: CustomEvent<{ query: string }>) => (e.stopPropagation(), emit(this, 'mm-search', { query: this.value }))}
        ></mm-query-input>
        <div class="below">
          ${this.#unsupported ? html`<p class="note" role="status">${tr('sbAsText', 'This search has groups, so it shows as text. Use Build query to edit it.')}</p>` : nothing}
          <span class="end">
            ${this.#unsupported ? nothing : html`<mm-button variant="ghost" size="sm" icon="filter-list" @click=${() => (this.raw = false)}>${tr('sbShowFilters', 'Show as filters')}</mm-button>`}
            ${this.#buildButton()}
          </span>
        </div>`;
    }
    return html`<div class="field" part="field" @click=${(e: Event) => e.target === e.currentTarget && this.#input?.focus()}>
        <mm-icon class="lead" name="search" aria-hidden="true"></mm-icon>
        ${repeat(this.#model.conditions, (c, i) => `${c.field}-${i}`, (c, i) => this.#renderToken(c, i))}
        <mm-query-input
          label=${label}
          hide-label
          placeholder=${this.#model.conditions.length ? '' : this.placeholder}
          .value=${this.#model.text}
          .suggest=${suggest}
          shortcut=""
          @mm-input=${this.#onText}
          @keydown=${this.#onTextKeydown}
          @mm-search=${(e: CustomEvent) => (e.stopPropagation(), emit(this, 'mm-search', { query: this.value }))}
        ></mm-query-input>
        ${this.value
          ? html`<mm-button class="clear" variant="ghost" size="sm" icon="close" label=${tr('clear', 'Clear')} @click=${() => {
              this.#commit({ text: '', conditions: [] }, tr('sbCleared', 'Search cleared'));
              if (this.#input) this.#input.value = '';
              this.#input?.focus();
            }}></mm-button>`
          : nothing}
      </div>
      <div class="below" part="actions">
        <span class="end">
          <mm-button variant="ghost" size="sm" icon="code" @click=${() => (this.raw = true)}>${tr('sbShowText', 'Show as text')}</mm-button>
          ${this.#buildButton()}
        </span>
      </div>
      ${this.#renderEditor()}
      <span class="visually-hidden" role="status">${this.#announce}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-search-bar': MmSearchBar;
  }
}
