import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/button.js';
import { createQuerySuggest, tokenize, type MmQueryInput, type QuerySuggestFn, type QuerySuggestion } from '@marmotdata/elements/query-input.js';

type Args = { label: string; placeholder: string; value: string; help: string; error: string; disabled: boolean; loading: boolean; hideLabel: boolean };

const FIELDS: QuerySuggestion[] = [
  { label: 'type:', description: 'Asset type' },
  { label: 'provider:', description: 'Source system' },
  { label: 'owner:', description: 'Team or person' },
  { label: 'tag:', description: 'Tag' },
  { label: '@metadata.', description: 'Metadata field' },
];
const VALUES: Record<string, [string, string][]> = {
  type: [
    ['table', '1,284 assets'],
    ['topic', '312 assets'],
    ['dashboard', '87 assets'],
    ['pipeline', '41 assets'],
  ],
  provider: [
    ['snowflake', '842 assets'],
    ['postgresql', '391 assets'],
    ['kafka', '312 assets'],
    ['bigquery', '58 assets'],
  ],
  owner: [
    ['"Analytics Engineering"', '512 assets'],
    ['"Data Platform"', '388 assets'],
  ],
};

/** A small catalog-backed suggester, as the Discover page would wire up. */
const suggest: QuerySuggestFn = async (query, cursor) => {
  const term = /(\S*)$/.exec(query.slice(0, cursor))?.[1] ?? '';
  const pair = /^([a-z]+):(.*)$/.exec(term);
  if (pair) {
    const [, field, partial] = pair as unknown as [string, string, string];
    return (VALUES[field] ?? []).filter(([v]) => v.startsWith(partial)).map(([v, d]) => ({ label: `${field}:${v}`, insert: v, description: d }));
  }
  return FIELDS.filter((f) => f.label.startsWith(term));
};

const field = (root: HTMLElement) => root.querySelector('mm-query-input')!;
const inner = (el: MmQueryInput) => el.shadowRoot!.querySelector('input')!;
const activeLabel = (el: MmQueryInput) => {
  const id = inner(el).getAttribute('aria-activedescendant');
  return id ? el.shadowRoot!.getElementById(id)?.querySelector('.opt-label')?.textContent : null;
};
const optionLabels = (el: MmQueryInput) => [...el.shadowRoot!.querySelectorAll('[role="option"] .opt-label')].map((o) => o.textContent);

const meta: Meta<Args> = {
  title: 'Components/Forms/Query input',
  component: 'mm-query-input',
  args: {
    label: 'Search the catalog',
    placeholder: 'Search assets, or filter with type:table',
    value: '',
    help: '',
    error: '',
    disabled: false,
    loading: false,
    hideLabel: false,
  },
  render: (a) => html`<div style="max-width:640px">
    <mm-query-input
      label=${a.label}
      placeholder=${a.placeholder}
      .value=${a.value}
      help=${a.help}
      error=${a.error}
      ?disabled=${a.disabled}
      ?loading=${a.loading}
      ?hide-label=${a.hideLabel}
      .suggest=${suggest}
    ></mm-query-input>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-query-input label="Search the catalog" hide-label name="q"
  placeholder="Search assets, or filter with type:table"></mm-query-input>
<script type="module">
  import '@marmotdata/elements/query-input.js';
  const box = document.querySelector('mm-query-input');
  box.suggest = (query, cursor) => fetch(\`/api/v1/search/suggest?q=\${encodeURIComponent(query)}&cursor=\${cursor}\`).then((r) => r.json());
  box.addEventListener('mm-search', (e) => runSearch(e.detail.query));
</script>`,
      react: `import { MmQueryInput } from '@marmotdata/react';

<MmQueryInput
  label="Search the catalog"
  hideLabel
  placeholder="Search assets, or filter with type:table"
  suggest={suggestFromCatalog}
  onMmSearch={(e) => navigate(\`/discover?q=\${encodeURIComponent(e.detail.query)}\`)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/query-input.js';
  import { goto } from '$app/navigation';
  let { suggestFromCatalog } = $props();
</script>

<mm-query-input
  label="Search the catalog"
  hide-label
  placeholder="Search assets, or filter with type:table"
  suggest={suggestFromCatalog}
  onmm-search={(e: CustomEvent<{ query: string }>) => goto(\`/discover?q=\${encodeURIComponent(e.detail.query)}\`)}
></mm-query-input>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const FULL = 'type:table provider:snowflake "orders daily" AND NOT @metadata.owner = "Analytics Engineering"';

export const Default: Story = {};
export const WithQuery: Story = { name: 'Highlighted query', args: { value: FULL, help: 'Combine filters with AND, OR and NOT. Quote phrases that contain spaces.' } };
export const Discover: Story = { name: 'Discover header (hidden label)', args: { hideLabel: true, value: '@metadata.row_count > 1000000 AND tag:pii' } };
export const Hover: Story = { args: { value: 'type:table' }, parameters: { pseudo: { hover: true } } };
export const Active: Story = { args: { value: 'type:table' }, parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  args: { value: 'provider:kafka orders' },
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(inner(field(canvasElement)));
    await expect(field(canvasElement).shadowRoot!.querySelector('.kbd')).toBeNull();
  },
};
export const Disabled: Story = { args: { disabled: true, value: 'type:table provider:postgresql' } };
export const Loading: Story = {
  args: { loading: true, value: 'customers_dim' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(field(canvasElement).shadowRoot!.querySelector('.spinner')).not.toBeNull());
  },
};
export const Empty: Story = { args: { help: 'Search by name, or filter with type:, provider:, owner: and @metadata.' } };
export const ErrorState: Story = {
  name: 'Error',
  args: { value: 'type:table "orders daily', error: 'Close the quoted phrase after “orders daily” to run the search.' },
  play: async ({ canvasElement }) => {
    const el = field(canvasElement);
    await expect(inner(el)).toHaveAttribute('aria-invalid', 'true');
    await expect(el.shadowRoot!.querySelector('.tk-unterminated')).not.toBeNull();
    await expect(el.checkValidity()).toBe(false);
  },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  args: {
    value:
      'type:table provider:snowflake owner:"Analytics Engineering" AND (tag:finance OR tag:revenue) AND NOT @metadata.dbt.materialized = "view" AND @metadata.row_count range [1000000 TO 5000000]',
  },
  play: async ({ canvasElement }) => {
    const el = field(canvasElement);
    await tab();
    await press('{End}');
    const input = inner(el);
    await waitFor(() => expect(input.scrollLeft).toBeGreaterThan(0));
    await waitFor(() => expect((el.shadowRoot!.querySelector('.mirror-inner') as HTMLElement).style.transform).toBe(`translateX(${-input.scrollLeft}px)`));
  },
};
export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  args: {
    value: 'mrn:"mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel" OR @metadata.dbt.unique_id = "model.shop_analytics.fct_orders_daily_rollup"',
  },
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'البحث في الكتالوج', value: 'type:table provider:snowflake orders' } };
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      <mm-query-input label="Search the catalog" .value=${FULL}></mm-query-input>
      <mm-query-input label="Search the catalog" value='type:table "orders daily' error="Close the quoted phrase after “orders daily” to run the search."></mm-query-input>
    </div>`),
};

export const Tokenizer: Story = {
  name: 'Tokenizer',
  args: { value: FULL },
  play: async () => {
    const simple = (q: string) => tokenize(q).filter((k) => k.type !== 'whitespace').map((k) => [k.type, k.text]);
    await expect(simple(FULL)).toEqual([
      ['field', 'type'],
      ['operator', ':'],
      ['value', 'table'],
      ['field', 'provider'],
      ['operator', ':'],
      ['value', 'snowflake'],
      ['quoted', '"orders daily"'],
      ['keyword', 'AND'],
      ['keyword', 'NOT'],
      ['metadata', '@metadata.owner'],
      ['operator', '='],
      ['value', '"Analytics Engineering"'],
    ]);
    await expect(simple('@metadata.row_count > 1000000')).toEqual([
      ['metadata', '@metadata.row_count'],
      ['operator', '>'],
      ['value', '1000000'],
    ]);
    await expect(simple('@metadata.row_count>=1000000')).toEqual([
      ['metadata', '@metadata.row_count'],
      ['operator', '>='],
      ['value', '1000000'],
    ]);
    const open = tokenize('customers "orders daily');
    await expect(open.at(-1)).toMatchObject({ type: 'quoted', text: '"orders daily', unterminated: true, start: 10, end: 23 });
    await expect(simple('@metadata.description contains "refund"')).toEqual([
      ['metadata', '@metadata.description'],
      ['keyword', 'contains'],
      ['value', '"refund"'],
    ]);
    await expect(simple('contains refunds')).toEqual([
      ['text', 'contains'],
      ['text', 'refunds'],
    ]);
    await expect(simple('@metadata.row_count range [1000 TO 5000]')).toEqual([
      ['metadata', '@metadata.row_count'],
      ['keyword', 'range'],
      ['paren', '['],
      ['value', '1000'],
      ['keyword', 'TO'],
      ['value', '5000'],
      ['paren', ']'],
    ]);
    await expect(simple('!type:view orders and refunds')).toEqual([
      ['operator', '!'],
      ['field', 'type'],
      ['operator', ':'],
      ['value', 'view'],
      ['text', 'orders'],
      ['text', 'and'],
      ['text', 'refunds'],
    ]);
    await expect(simple('mrn:mrn://postgresql/table/shop.public.orders')).toEqual([
      ['field', 'mrn'],
      ['operator', ':'],
      ['value', 'mrn://postgresql/table/shop.public.orders'],
    ]);
    // Tokens cover every character exactly once.
    const toks = tokenize(FULL);
    await expect(toks.map((k) => k.text).join('')).toBe(FULL);
    toks.forEach((k, i) => i > 0 && expect(k.start).toBe(toks[i - 1]!.end));
    await expect(tokenize('')).toEqual([]);
  },
};

const onSearch = fn();
const onChange = fn();
const onInput = fn();

export const KeyboardSearch: Story = {
  name: 'Keyboard: type, Enter searches, shortcut focuses',
  render: () => html`<mm-query-input
    label="Search the catalog"
    placeholder="Search assets, or filter with type:table"
    @mm-search=${(e: CustomEvent) => onSearch(e.detail.query, e.detail.tokens.map((k: { type: string }) => k.type))}
    @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}
    @mm-input=${(e: CustomEvent) => onInput(e.detail.value)}
  ></mm-query-input>`,
  play: async ({ canvasElement }) => {
    onSearch.mockClear();
    onChange.mockClear();
    onInput.mockClear();
    const el = field(canvasElement);
    await expect(el.shadowRoot!.querySelector('.kbd')?.textContent).toBe('/');
    (document.activeElement as HTMLElement | null)?.blur();
    await press('/');
    await expect(deepActive()).toBe(inner(el));
    await expect(el.value).toBe('');
    await press('type:table orders');
    await expect(el.value).toBe('type:table orders');
    await expect(onInput).toHaveBeenLastCalledWith('type:table orders');
    await press('{Enter}');
    await expect(onSearch).toHaveBeenCalledWith('type:table orders', ['field', 'operator', 'value', 'whitespace', 'text']);
    await expect(onChange).toHaveBeenCalledWith('type:table orders');
    // Home and End stay native caret movement.
    await press('{Home}');
    await expect(inner(el).selectionStart).toBe(0);
    await press('{End}');
    await expect(inner(el).selectionStart).toBe(17);
  },
};

export const KeyboardSuggestions: Story = {
  name: 'Keyboard: suggestions combobox',
  render: () => html`<mm-query-input
    label="Search the catalog"
    .suggest=${suggest}
    @mm-search=${(e: CustomEvent) => onSearch(e.detail.query)}
  ></mm-query-input>`,
  play: async ({ canvasElement }) => {
    onSearch.mockClear();
    const el = field(canvasElement);
    const input = inner(el);
    await tab();
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    // Typing opens the list without an active option, so Enter would still search.
    await press('ty');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(optionLabels(el)).toEqual(['type:']));
    await expect(input.hasAttribute('aria-activedescendant')).toBe(false);

    // ArrowDown activates, Enter accepts and keeps the list open for the value.
    await press('{ArrowDown}');
    await expect(activeLabel(el)).toBe('type:');
    await press('{Enter}');
    await expect(el.value).toBe('type:');
    await waitFor(() => expect(optionLabels(el)).toEqual(['type:table', 'type:topic', 'type:dashboard', 'type:pipeline']));
    await expect(activeLabel(el)).toBe('type:table');
    await press('{ArrowDown}');
    await expect(activeLabel(el)).toBe('type:topic');
    await press('{ArrowUp}{ArrowUp}');
    await expect(activeLabel(el)).toBe('type:pipeline');
    await press('{ArrowDown}');
    await expect(activeLabel(el)).toBe('type:table');

    // Tab accepts the active option and stays in the field.
    await press('{Tab}');
    await expect(el.value).toBe('type:table ');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(deepActive()).toBe(input);

    // ArrowDown opens explicitly; Escape closes without changing the query.
    await press('{ArrowDown}');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(activeLabel(el)).toBe('type:'));
    await press('{Escape}');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(el.value).toBe('type:table ');

    // Replaces a partial value at the cursor.
    await press('provider:sn');
    await waitFor(() => expect(optionLabels(el)).toEqual(['provider:snowflake']));
    await press('{ArrowDown}{Enter}');
    await expect(el.value).toBe('type:table provider:snowflake ');

    // With no active option, Enter searches.
    await press('{Enter}');
    await expect(onSearch).toHaveBeenCalledWith('type:table provider:snowflake ');
  },
};

const editorSuggest = createQuerySuggest({
  fields: [
    { value: 'type', description: 'Asset type', values: ['table', 'view', 'topic', 'dashboard'] },
    { value: 'provider', description: 'Where it lives', values: ['snowflake', 'postgresql', 'kafka'] },
    { value: 'metadata.owner', description: 'Owner' },
  ],
  values: (field) => (field === 'metadata.owner' ? ['Analytics Engineering', 'Data Platform'] : []),
});

export const EditorCompletion: Story = {
  name: 'Editor-style completion',
  render: () => html`<div style="max-width:640px"><mm-query-input label="Search the catalog" .suggest=${editorSuggest}></mm-query-input></div>`,
  play: async ({ canvasElement }) => {
    const el = field(canvasElement);
    await tab();
    // "@" lists the fields; accepting one moves straight on to the operators, then the values.
    await press('@');
    await waitFor(() => expect(optionLabels(el)).toEqual(['@type', '@provider', '@metadata.owner']));
    await press('{ArrowDown}');
    await press('{Enter}');
    await expect(el.value).toBe('@type ');
    await waitFor(() => expect(optionLabels(el)[0]).toBe('='));
    await press('{Enter}');
    await waitFor(() => expect(optionLabels(el)).toEqual(['table', 'view', 'topic', 'dashboard']));
    await press('{Enter}');
    await expect(el.value).toBe('@type = table ');
    await waitFor(() => expect(optionLabels(el)).toEqual(['AND', 'OR', 'NOT']));
  },
};

export const IgnoresStaleSuggestions: Story = {
  name: 'Ignores stale suggestions',
  render: () => {
    const slowThenFast: QuerySuggestFn = (q) =>
      new Promise((resolve) => setTimeout(() => resolve([{ label: `orders_daily (${q})` }]), q === 'o' ? 300 : 10));
    return html`<mm-query-input label="Search the catalog" suggest-delay="0" .suggest=${slowThenFast}></mm-query-input>`;
  },
  play: async ({ canvasElement }) => {
    const el = field(canvasElement);
    await tab();
    await press('o');
    await press('r');
    await new Promise((r) => setTimeout(r, 450));
    await expect(optionLabels(el)).toEqual(['orders_daily (or)']);
  },
};

const onSubmit = fn();
export const FormSubmission: Story = {
  name: 'Form: submits, validates and resets',
  render: () => html`<form
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(new FormData(e.target as HTMLFormElement).get('q'));
    }}
  >
    <mm-query-input label="Search the catalog" name="q" required value="provider:snowflake"></mm-query-input>
    <fieldset disabled style="border:0;padding:0;margin:var(--space-4) 0 0">
      <legend style="font:var(--text-label);color:var(--mm-text-2)">Archived search</legend>
      <mm-query-input label="Archived search" name="archived" value="type:topic"></mm-query-input>
    </fieldset>
    <mm-button variant="primary" type="submit" style="margin-top:var(--space-4)">Search catalog</mm-button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = field(canvasElement);
    await expect(new FormData(form).get('q')).toBe('provider:snowflake');
    await expect(new FormData(form).has('archived')).toBe(false);
    await tab();
    await press('{End} type:table');
    await press('{Enter}');
    await expect(onSubmit).toHaveBeenCalledWith('provider:snowflake type:table');
    form.reset();
    await expect(el.value).toBe('provider:snowflake');
    await el.updateComplete;
    await expect(new FormData(form).get('q')).toBe('provider:snowflake');
    el.value = '';
    await el.updateComplete;
    await expect(form.checkValidity()).toBe(false);
    await expect(el.validity.valueMissing).toBe(true);
  },
};
