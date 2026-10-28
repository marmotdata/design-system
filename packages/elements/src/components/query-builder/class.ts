import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { formatCount } from '../../core/format.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../select/define.js';
import '../multiselect/define.js';
import '../text-field/define.js';
import '../segmented-control/define.js';
import '../combobox/define.js';
import '../number-field/define.js';
import { fieldFor, operatorsFor, opSyntax, type SearchBarField, type SearchOperator } from '../search-bar/class.js';
import type { MmOptionData } from '../select/option.js';

/* ------------------------------------------------------------------------------------------------
 * Query tree. A group matches all, any or none of its items; an item is a condition, free text
 * ("any field contains") or another group. It reads and writes the full Marmot syntax, brackets
 * and NOT included, so every query can be built and edited here.
 * ---------------------------------------------------------------------------------------------- */

export type GroupMatch = 'all' | 'any' | 'none';

export interface QueryConditionNode {
  type: 'condition';
  field: string;
  operator: SearchOperator;
  values: string[];
  to?: string;
}
export interface QueryTextNode {
  type: 'text';
  text: string;
}
export interface QueryGroupNode {
  type: 'group';
  match: GroupMatch;
  items: QueryNode[];
}
export type QueryNode = QueryConditionNode | QueryTextNode | QueryGroupNode;

// Wildcards are quoted too, as Marmot's query docs write them ("*_archive*").
const quote = (v: string) => (/[\s"()[\]*]/.test(v) ? `"${v.replace(/"/g, '')}"` : v);
const unquote = (v: string) => v.replace(/^"|"$/g, '');

function writeCondition(c: QueryConditionNode): string {
  const one = (v: string) => (c.operator === 'range' ? `@${c.field} range [${quote(v)} TO ${quote(c.to ?? '')}]` : `@${c.field} ${opSyntax(c.operator)} ${quote(v)}`);
  const vals = c.values.filter((v) => v !== '');
  if (!vals.length) return '';
  return vals.length === 1 ? one(vals[0]!) : `(${vals.map(one).join(' OR ')})`;
}

/** Writes a tree as Marmot query syntax. */
export function writeQuery(node: QueryNode, nested = false): string {
  // Free text is written exactly as typed, quotes and all.
  if (node.type === 'text') return node.text.trim();
  if (node.type === 'condition') return writeCondition(node);
  const parts = node.items.map((i) => writeQuery(i, true)).filter(Boolean);
  if (!parts.length) return '';
  if (node.match === 'none') return `NOT ${parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`}`;
  const joined = parts.join(node.match === 'all' ? ' AND ' : ' OR ');
  return nested && parts.length > 1 ? `(${joined})` : joined;
}

type Tok = { k: 'lp' | 'rp' | 'and' | 'or' | 'not' | 'cond' | 'word'; v: string };

function lex(q: string): Tok[] {
  const out: Tok[] = [];
  const re =
    /\s*(?:(\()|(\))|(AND|OR|NOT)(?=[\s()]|$)|(@[\w.-]+\s+range\s+\[[^\]]*\])|(@[\w.-]+\s*(?:!=|>=|<=|=|:|>|<|contains)\s*(?:"[^"]*"|[^\s"()]+))|("[^"]*"|[^\s()]+))/gy;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q)) && m[0].trim()) {
    if (m[1]) out.push({ k: 'lp', v: '(' });
    else if (m[2]) out.push({ k: 'rp', v: ')' });
    else if (m[3]) out.push({ k: m[3].toLowerCase() as 'and' | 'or' | 'not', v: m[3] });
    else if (m[4] || m[5]) out.push({ k: 'cond', v: (m[4] ?? m[5])!.trim() });
    else if (m[6]) out.push({ k: 'word', v: m[6] });
  }
  return out;
}

function condition(s: string): QueryConditionNode | null {
  const r = /^@([\w.-]+)\s+range\s+\[\s*("[^"]*"|\S+)\s+TO\s+("[^"]*"|[^\]\s]+)\s*\]$/.exec(s);
  if (r) return { type: 'condition', field: r[1]!, operator: 'range', values: [unquote(r[2]!)], to: unquote(r[3]!) };
  const m = /^@([\w.-]+)\s*(!=|>=|<=|=|:|>|<|contains)\s*("[^"]*"|\S+)$/.exec(s);
  if (!m) return null;
  const value = unquote(m[3]!);
  const op = (m[2] === ':' ? '=' : m[2]) as SearchOperator;
  return { type: 'condition', field: m[1]!, operator: op === '=' && value.includes('*') ? 'matches' : op, values: [value] };
}

/** Reads Marmot query syntax into a tree whose root is a group. Unknown pieces become free text, so nothing is dropped. */
export function readQuery(query: string): QueryGroupNode {
  const toks = lex(query);
  let i = 0;
  const flatten = (match: GroupMatch, items: QueryNode[]): QueryNode[] =>
    items.flatMap((n) => (n.type === 'group' && n.match === match && match !== 'none' ? n.items : [n]));
  const unary = (): QueryNode | null => {
    const t = toks[i];
    if (!t) return null;
    if (t.k === 'not') {
      i++;
      const inner = unary();
      if (!inner) return null;
      return { type: 'group', match: 'none', items: inner.type === 'group' && inner.match === 'any' ? inner.items : [inner] };
    }
    if (t.k === 'lp') {
      i++;
      const inner = or();
      if (toks[i]?.k === 'rp') i++;
      return inner;
    }
    if (t.k === 'cond') {
      i++;
      return condition(t.v) ?? { type: 'text', text: t.v };
    }
    if (t.k === 'word') {
      i++;
      const words = [t.v];
      // Consecutive words are one row of free text, kept as typed.
      while (toks[i]?.k === 'word') words.push(toks[i++]!.v);
      return { type: 'text', text: words.join(' ') };
    }
    i++;
    return null;
  };
  const and = (): QueryNode | null => {
    const items: QueryNode[] = [];
    let n = unary();
    if (n) items.push(n);
    while (i < toks.length && toks[i]!.k !== 'or' && toks[i]!.k !== 'rp') {
      if (toks[i]!.k === 'and') i++;
      n = unary();
      if (n) items.push(n);
    }
    if (items.length === 1) return items[0]!;
    return items.length ? { type: 'group', match: 'all', items: flatten('all', items) } : null;
  };
  const or = (): QueryNode | null => {
    const items: QueryNode[] = [];
    let n = and();
    if (n) items.push(n);
    while (toks[i]?.k === 'or') {
      i++;
      n = and();
      if (n) items.push(n);
    }
    if (items.length === 1) return items[0]!;
    if (!items.length) return null;
    // Same field, same "is": one condition with several values.
    const conds = items.filter((x): x is QueryConditionNode => x.type === 'condition');
    if (conds.length === items.length && new Set(conds.map((c) => `${c.field}${c.operator}`)).size === 1 && conds[0]!.operator === '=') {
      return { ...conds[0]!, values: conds.flatMap((c) => c.values) };
    }
    return { type: 'group', match: 'any', items: flatten('any', items) };
  };
  const root = or();
  if (!root) return { type: 'group', match: 'all', items: [] };
  return root.type === 'group' ? root : { type: 'group', match: 'all', items: [root] };
}

/* ------------------------------------------------------------------------------------------------ */

const MAX_DEPTH = 3;
const ANY_FIELD = '__text';

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

/**
 * The query builder edits a search as groups of conditions, for anything the search bar's tokens
 * cannot say. Each group has an All, Any or None switch with a plain hint ("Every condition must
 * match"), and rows read as a sentence ("Where … and …", "or", "nor"); groups nest up to three
 * deep, indented with a rule, never boxed. A row is a field, an operator that
 * fits it and a value control that fits both. Operators follow what Marmot's query engine accepts
 * per field (see `operatorsFor`): a glossary term only "is" or "matches" a pattern, a provider has
 * no comparisons, metadata takes everything including "between" for numbers. Any metadata path can
 * be typed as the field, with suggestions from `loadFields`, and values suggest from `loadValues`.
 * Free text is a row too ("Any field contains orders"). It reads and writes the full query syntax, so
 * every query can be built here; nothing falls back to text.
 *
 * Open it from the search bar ("Build query"). It edits a copy: Apply fires `mm-apply` with the
 * new query, Cancel or Escape fires `mm-cancel`. Every change fires `mm-input`, so the page can
 * set `count` to the live number of results. Adding and removing rows and groups is announced,
 * and focus moves to the new row or to the control that adds one.
 *
 * @tagname mm-query-builder
 * @summary Build a search as groups of conditions that match all, any or none.
 * @csspart panel - The bordered panel.
 * @csspart group - Each group.
 * @csspart footer - The count and actions.
 * @fires mm-input - {{ value: string }} The draft query changed.
 * @fires mm-apply - {{ value: string }} Apply was pressed.
 * @fires mm-cancel - {{}} Cancel or Escape was pressed.
 */
export class MmQueryBuilder extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      .panel {
        display: grid;
        gap: var(--space-4);
        padding: var(--space-5);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      .group {
        display: grid;
        gap: var(--space-2);
      }
      /* A nested group is indented with a rule, never boxed. */
      .group.nested {
        padding: var(--space-1) 0 var(--space-1) var(--space-4);
        border-inline-start: 2px solid var(--mm-rule);
      }
      .match {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-block-size: var(--control-h-sm, 30px);
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      .match mm-segmented-control {
        --mm-control: var(--control-h-sm, 30px);
      }
      .match .spacer {
        flex: 1;
      }
      /* Connector, field, operator, value, remove: the same columns in every row and group. */
      .row,
      .nest {
        display: grid;
        grid-template-columns: 3.5rem minmax(0, 12rem) minmax(0, 9rem) minmax(0, 1fr) 2rem;
        gap: var(--space-2);
        align-items: center;
      }
      .nest {
        align-items: start;
      }
      .nest > .group {
        grid-column: 2 / -1;
      }
      .row > *,
      .row mm-select,
      .row mm-multiselect,
      .row mm-text-field {
        min-inline-size: 0;
        inline-size: 100%;
      }
      .join {
        font: var(--text-dense);
        color: var(--mm-text-3);
        text-align: end;
        padding-inline-end: var(--space-1);
      }
      .nest > .join {
        padding-block-start: 6px;
      }
      .fixed {
        font: var(--text-dense);
        color: var(--mm-text-2);
        padding-inline: var(--space-3);
      }
      .range {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: var(--space-2);
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      .adds {
        display: flex;
        gap: var(--space-1);
        padding-inline-start: calc(3.5rem + var(--space-2));
      }
      .footer {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--mm-rule);
      }
      .count {
        font: var(--text-dense);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .footer .end {
        display: flex;
        gap: var(--space-2);
        margin-inline-start: auto;
      }
      @container (max-width: 640px) {
        .row {
          grid-template-columns: 3rem minmax(0, 1fr) 2rem;
        }
        .row > :nth-child(3),
        .row > :nth-child(4) {
          grid-column: 2;
        }
        .row > :nth-child(5) {
          grid-column: 3;
          grid-row: 1;
        }
        .nest {
          grid-template-columns: 3rem minmax(0, 1fr);
        }
        .adds {
          padding-inline-start: 0;
        }
      }
    `,
  ];

  /** The query to edit, in Marmot search syntax. */
  @property() accessor value = '';
  /** Fields with everyday labels and known values. */
  @property({ attribute: false }) accessor fields: SearchBarField[] = [];
  /** Live number of results for the draft, set by the page after `mm-input`. */
  @property({ type: Number }) accessor count: number | undefined;
  /** Suggests metadata fields as people type a field name, such as from `/assets/suggestions/metadata/fields`. */
  @property({ attribute: false }) accessor loadFields: ((prefix: string) => Promise<string[]>) | undefined;
  /** Suggests values for a field as people type, such as from `/assets/suggestions/metadata/values`. */
  @property({ attribute: false }) accessor loadValues: ((field: string, prefix: string) => Promise<string[]>) | undefined;

  @state() accessor #root: QueryGroupNode = { type: 'group', match: 'all', items: [] };
  @state() accessor #announce = '';
  #emitted: string | null = null;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && this.value !== this.#emitted) {
      this.#root = readQuery(this.value);
      if (!this.#root.items.length) this.#root = { ...this.#root, items: [this.#blank()] };
    }
  }

  /** The draft as query syntax. */
  get draft(): string {
    return writeQuery(this.#root);
  }

  #blank(): QueryConditionNode {
    const f = this.fields[0];
    return { type: 'condition', field: f?.value ?? '', operator: f?.values?.length ? '=' : 'contains', values: [] };
  }

  #field(path: string): SearchBarField {
    return fieldFor(path, this.fields);
  }

  #changed(announce = '') {
    this.#root = { ...this.#root };
    if (announce) this.#announce = announce;
    const value = this.draft;
    this.#emitted = value;
    emit(this, 'mm-input', { value });
  }

  async #addNode(group: QueryGroupNode, node: QueryNode, focusSel: string) {
    group.items = [...group.items, node];
    this.#changed(node.type === 'group' ? tr('qbGroupAdded', 'Group added') : tr('qbConditionAdded', 'Condition added'));
    await this.updateComplete;
    [...this.renderRoot.querySelectorAll<HTMLElement>(focusSel)].at(-1)?.focus();
  }

  async #removeAt(group: QueryGroupNode, index: number, path: string) {
    const removed = group.items[index];
    group.items = group.items.filter((_, i) => i !== index);
    this.#changed(removed?.type === 'group' ? tr('qbGroupRemoved', 'Group removed') : tr('qbConditionRemoved', 'Condition removed'));
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLElement>(`[data-path="${path}"] .add-condition`)?.focus();
  }

  #operators(field: string): SearchOperator[] {
    return operatorsFor(this.#field(field));
  }

  /** Field names, then metadata fields from the loader; anything else typed becomes a metadata path. */
  #fieldLoader = async (q: string): Promise<MmOptionData[]> => {
    const known = this.fields.filter((f) => !q || f.label.toLowerCase().includes(q.toLowerCase()) || f.value.includes(q.toLowerCase()));
    const extra = (await this.loadFields?.(q)) ?? [];
    const metadata = extra.map((x) => (x.startsWith('metadata.') ? x : `metadata.${x}`)).filter((x) => !this.fields.some((f) => f.value === x));
    return [
      ...(q && !q.includes(' ') ? [] : [{ value: ANY_FIELD, label: tr('qbAnyField', 'Any field') }]),
      ...known.map((f) => ({ value: f.value, label: f.label, description: `@${f.value}`, mono: true })),
      ...metadata.map((m) => ({ value: m, label: m.replace(/^metadata\./, ''), description: `@${m}`, mono: true })),
    ];
  };

  #pathFrom(v: string): string {
    if (v === ANY_FIELD || this.fields.some((f) => f.value === v) || v.startsWith('metadata.')) return v;
    return `metadata.${v.replace(/^@/, '')}`;
  }

  /** The value control fits the operator and field: two numbers for between, a number for comparisons, a pick list for known values, suggestions or free text otherwise. */
  #valueControl(c: QueryConditionNode, label: string): TemplateResult {
    const f = this.#field(c.field);
    const set = (v: string) => ((c.values = [v]), this.#changed());
    if (c.operator === 'range') {
      return html`<div class="range">
        <mm-number-field label=${`${label}, ${tr('sbFrom', 'From')}`} hide-label placeholder=${tr('sbFrom', 'From')} value=${c.values[0] ?? ''} @mm-input=${(e: CustomEvent<{ value: string }>) => set(String(e.detail.value))}></mm-number-field>
        <span aria-hidden="true">${tr('qbAnd', 'and')}</span>
        <mm-number-field label=${`${label}, ${tr('sbTo', 'To')}`} hide-label placeholder=${tr('sbTo', 'To')} value=${c.to ?? ''} @mm-input=${(e: CustomEvent<{ value: string }>) => ((c.to = String(e.detail.value)), this.#changed())}></mm-number-field>
      </div>`;
    }
    if (c.operator === '>' || c.operator === '<' || c.operator === '>=' || c.operator === '<=') {
      return html`<mm-number-field label=${label} hide-label placeholder=${tr('qbNumber', 'Number')} value=${c.values[0] ?? ''} @mm-input=${(e: CustomEvent<{ value: string }>) => set(String(e.detail.value))}></mm-number-field>`;
    }
    if (c.operator === 'matches') {
      return html`<mm-text-field label=${label} hide-label placeholder=${tr('sbPattern', 'Pattern, such as customer*')} value=${c.values[0] ?? ''} @mm-input=${(e: CustomEvent<{ value: string }>) => set(e.detail.value)}></mm-text-field>`;
    }
    const options = (f.values ?? []).map((x) => (typeof x === 'string' ? { value: x, label: x } : x));
    if (options.length && c.operator === '=') {
      return html`<mm-multiselect label=${label} hide-label placeholder=${tr('qbChoose', 'Pick values')} max-tags="2" .value=${c.values} @mm-change=${(e: CustomEvent<{ value: string[] }>) => ((c.values = e.detail.value), this.#changed())}>
        ${options.map((x) => html`<mm-option value=${x.value} label=${x.label}></mm-option>`)}
      </mm-multiselect>`;
    }
    if (options.length) {
      return html`<mm-select label=${label} hide-label placeholder=${tr('qbChooseOne', 'Pick a value')} value=${c.values[0] ?? ''} @mm-change=${(e: CustomEvent<{ value: string }>) => set(e.detail.value)}>
        ${options.map((x) => html`<mm-option value=${x.value} label=${x.label}></mm-option>`)}
      </mm-select>`;
    }
    if (this.loadValues) {
      const loader = async (q: string): Promise<MmOptionData[]> => ((await this.loadValues?.(c.field, q)) ?? []).map((v) => ({ value: v, label: v }));
      return html`<mm-combobox label=${label} hide-label allow-custom placeholder=${tr('sbValuePlaceholder', 'Value')} value=${c.values[0] ?? ''} value-label=${c.values[0] ?? ''} .loader=${loader} @mm-change=${(e: CustomEvent<{ value: string }>) => set(e.detail.value)}></mm-combobox>`;
    }
    return html`<mm-text-field label=${label} hide-label placeholder=${tr('sbValuePlaceholder', 'Value')} value=${c.values[0] ?? ''} @mm-input=${(e: CustomEvent<{ value: string }>) => set(e.detail.value)}></mm-text-field>`;
  }

  /** The word before a row: "Where" first, then the group's joiner, so each group reads as a sentence. */
  #join(group: QueryGroupNode, index: number): string {
    if (index === 0) return group.match === 'none' ? tr('qbWhereNot', 'Not') : tr('qbWhere', 'Where');
    return group.match === 'any' ? tr('qbOr', 'or') : group.match === 'none' ? tr('qbNor', 'nor') : tr('qbAnd', 'and');
  }

  #renderItem(node: QueryNode, group: QueryGroupNode, index: number, path: string, depth: number): TemplateResult {
    const n = index + 1;
    const join = html`<span class="join" aria-hidden="true">${this.#join(group, index)}</span>`;
    if (node.type === 'group') return html`<div class="nest">${join}${this.#renderGroup(node, `${path}.${index}`, depth + 1, () => this.#removeAt(group, index, path))}</div>`;
    const remove = html`<mm-button variant="ghost" size="sm" icon="close" label=${tr('qbRemoveCondition', 'Remove condition {n}', { n })} @click=${() => this.#removeAt(group, index, path)}></mm-button>`;
    const fieldSelect = (value: string) => html`<mm-combobox
      class="field"
      label=${tr('qbFieldFor', 'Field for condition {n}', { n })}
      hide-label
      allow-custom
      placeholder=${tr('qbFieldPlaceholder', 'Field or metadata key')}
      value=${value}
      value-label=${value === ANY_FIELD ? tr('qbAnyField', 'Any field') : this.#field(value).label}
      .loader=${this.#fieldLoader}
      @mm-change=${(e: CustomEvent<{ value: string }>) => {
        const v = this.#pathFrom(e.detail.value);
        if (v === ANY_FIELD) group.items[index] = { type: 'text', text: '' };
        else group.items[index] = { type: 'condition', field: v, operator: this.#operators(v)[0]!, values: [] };
        this.#changed();
      }}
    ></mm-combobox>`;
    if (node.type === 'text') {
      return html`<div class="row">
        ${join}${fieldSelect(ANY_FIELD)}
        <span class="fixed">${operatorWords().contains}</span>
        <mm-text-field label=${tr('qbTextFor', 'Text for condition {n}', { n })} hide-label placeholder=${tr('qbText', 'Text')} value=${node.text} @mm-input=${(e: CustomEvent<{ value: string }>) => ((node.text = e.detail.value), this.#changed())}></mm-text-field>
        ${remove}
      </div>`;
    }
    return html`<div class="row">
      ${join}${fieldSelect(node.field)}
      <mm-select
        label=${tr('qbOperatorFor', 'Operator for condition {n}', { n })}
        hide-label
        value=${node.operator}
        @mm-change=${(e: CustomEvent<{ value: SearchOperator }>) => {
          node.operator = e.detail.value;
          // Only "is" with known values takes several values.
          if (node.operator !== '=') node.values = node.values.slice(0, 1);
          this.#changed();
        }}
      >
        ${this.#operators(node.field).map((o) => html`<mm-option value=${o} label=${operatorWords()[o]}></mm-option>`)}
      </mm-select>
      ${this.#valueControl(node, tr('qbValueFor', 'Value for condition {n}', { n }))}
      ${remove}
    </div>`;
  }

  #renderGroup(group: QueryGroupNode, path: string, depth: number, remove?: () => void): TemplateResult {
    return html`<div class="group ${depth > 0 ? 'nested' : ''}" part="group" role="group" aria-label=${tr('qbGroupLabel', 'Match {match} of these', { match: group.match })} data-path=${path}>
      <div class="match">
        <mm-segmented-control label=${tr('qbMatchLabel', 'Match')} hide-label value=${group.match} @mm-change=${(e: CustomEvent<{ value: GroupMatch }>) => (e.stopPropagation(), (group.match = e.detail.value), this.#changed())}>
          <mm-segment value="all">${tr('qbAllOf', 'All')}</mm-segment>
          <mm-segment value="any">${tr('qbAnyOf', 'Any')}</mm-segment>
          <mm-segment value="none">${tr('qbNoneOf', 'None')}</mm-segment>
        </mm-segmented-control>
        <span>${group.match === 'all' ? tr('qbAllHint', 'Every condition must match') : group.match === 'any' ? tr('qbAnyHint', 'At least one must match') : tr('qbNoneHint', 'None may match')}</span>
        <span class="spacer"></span>
        ${remove ? html`<mm-button variant="ghost" size="sm" icon="close" label=${tr('qbRemoveGroup', 'Remove group')} @click=${remove}></mm-button>` : nothing}
      </div>
      ${group.items.map((item, i) => this.#renderItem(item, group, i, path, depth))}
      <div class="adds">
        <mm-button class="add-condition" variant="ghost" size="sm" icon="add" @click=${() => this.#addNode(group, this.#blank(), `[data-path="${path}"] > .row mm-combobox.field`)}>${tr('qbCondition', 'Condition')}</mm-button>
        ${depth < MAX_DEPTH - 1
          ? html`<mm-button variant="ghost" size="sm" icon="add" @click=${() => this.#addNode(group, { type: 'group', match: 'any', items: [this.#blank()] }, `[data-path="${path}"] > .nest .match mm-segmented-control`)}>${tr('qbGroup', 'Group')}</mm-button>`
          : nothing}
      </div>
    </div>`;
  }

  override render() {
    return html`<div
      class="panel"
      part="panel"
      role="group"
      aria-label=${tr('qbHeading', 'Build a query')}
      @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && (e.preventDefault(), emit(this, 'mm-cancel', {}))}
    >
      ${this.#renderGroup(this.#root, 'root', 0)}
      <div class="footer" part="footer">
        <span class="count" role="status">${this.count === undefined ? '' : this.count === 1 ? tr('qbOneResult', '1 result') : tr('qbResults', '{n} results', { n: formatCount(this.count) })}</span>
        <div class="end">
          <mm-button size="sm" @click=${() => emit(this, 'mm-cancel', {})}>${tr('cancel', 'Cancel')}</mm-button>
          <mm-button size="sm" variant="primary" @click=${() => emit(this, 'mm-apply', { value: this.draft })}>${tr('qbApply', 'Apply')}</mm-button>
        </div>
      </div>
      <span class="visually-hidden" role="status">${this.#announce}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-query-builder': MmQueryBuilder;
  }
}
