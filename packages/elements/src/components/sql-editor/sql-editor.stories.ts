import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/sql-editor.js';
import '@marmotdata/elements/button.js';
import type { MmSqlEditor, SqlCompletion, SqlSchema } from './class.ts';

const SQL = `-- Daily revenue and a 7-day rolling average, by region
with daily as (
  select date_trunc('day', o.created_at) as day,
         c.region,
         sum(o.total) as revenue
  from shop.public.orders o
  join analytics.customers_dim c on c.customer_id = o.customer_id
  where o.status = 'completed'
  group by 1, 2
)
select day,
       region,
       revenue,
       avg(revenue) over (partition by region order by day rows between 6 preceding and current row) as revenue_7d
from daily
order by day desc, region
limit 200;`;

const BROKEN = `select o.order_id,
       o.total,
       o.custmer_id
from shop.public.orders o
where o.created_at >= current_date - 7;`;

const SCHEMA: SqlSchema = {
  'shop.public.orders': { columns: ['order_id', 'customer_id', 'total', 'status', 'created_at'], type: 'table', provider: 'postgresql' },
  'shop.public.order_items': { columns: ['order_id', 'sku', 'quantity', 'unit_price'], type: 'table', provider: 'postgresql' },
  'analytics.customers_dim': { columns: ['customer_id', 'customer_name', 'email', 'region', 'first_order_at'], type: 'table', provider: 'postgresql' },
  'analytics.orders_daily': { columns: ['day', 'orders', 'revenue', 'refunds'], type: 'view', provider: 'postgresql' },
};

/** Catalog search, as the Query workspace would call the Marmot API. */
const CATALOG: SqlCompletion[] = [
  { label: 'orders_daily', type: 'type', assetType: 'view', provider: 'snowflake', apply: 'analytics.orders_daily', info: 'mrn://snowflake/view/analytics.orders_daily' },
  { label: 'orders_v2', type: 'type', assetType: 'topic', provider: 'kafka', apply: 'shop.orders.v2', info: 'mrn://kafka/topic/shop.orders.v2' },
  { label: 'customers_dim', type: 'type', assetType: 'table', provider: 'bigquery', apply: 'analytics.customers_dim', info: 'mrn://bigquery/table/analytics.customers_dim' },
];
const completer = async (ctx: { matchBefore(re: RegExp): { text: string } | null }) => {
  const word = ctx.matchBefore(/\w*$/)?.text ?? '';
  await new Promise((r) => setTimeout(r, 40));
  return CATALOG.filter((c) => c.label.startsWith(word.toLowerCase()));
};

type Args = { value: string; dialect: string; readonly: boolean; disabled: boolean; label: string };

const meta: Meta<Args> = {
  title: 'Components/Query/SQL editor',
  component: 'mm-sql-editor',
  args: { value: SQL, dialect: 'postgresql', readonly: false, disabled: false, label: 'Query' },
  argTypes: { dialect: { control: 'select', options: ['postgresql', 'mysql', 'sqlite', 'standard', 'trino', 'snowflake', 'bigquery'] } },
  render: (a) =>
    html`<mm-sql-editor
      .value=${a.value}
      dialect=${a.dialect}
      label=${a.label}
      .schema=${SCHEMA}
      .completer=${completer}
      ?readonly=${a.readonly}
      ?disabled=${a.disabled}
    ></mm-sql-editor>`,
  parameters: {
    usage: {
      html: `<mm-sql-editor label="Query" dialect="postgresql" default-schema="shop.public"></mm-sql-editor>
<script type="module">
  import '@marmotdata/elements/sql-editor.js';
  const editor = document.querySelector('mm-sql-editor');
  editor.schema = { 'shop.public.orders': ['order_id', 'customer_id', 'total', 'status', 'created_at'] };
  editor.completer = async (ctx) => searchCatalog(ctx.matchBefore(/\\w*$/)?.text ?? '');
  editor.addEventListener('mm-run', async (e) => {
    const result = await runQuery(e.detail.sql);
    editor.error = result.error ?? null; // { line, column, message }
  });
</script>`,
      react: `import { MmSqlEditor } from '@marmotdata/react';

<MmSqlEditor
  label="Query"
  dialect={source.dialect}
  value={sql}
  schema={schema}
  completer={searchCatalog}
  error={result?.error ?? null}
  onMmInput={(e) => setSql(e.detail.value)}
  onMmRun={(e) => run(e.detail.sql)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/sql-editor.js';
  let sql = $state('select * from shop.public.orders limit 100');
  let error = $state(null);
</script>

<mm-sql-editor
  label="Query"
  dialect="postgresql"
  value={sql}
  schema={schema}
  completer={searchCatalog}
  error={error}
  onmm-input={(e) => (sql = e.detail.value)}
  onmm-run={async (e) => (error = (await runQuery(e.detail.sql)).error ?? null)}
></mm-sql-editor>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const editorIn = (el: HTMLElement) => el.querySelector('mm-sql-editor') as MmSqlEditor;
const loaded = async (el: HTMLElement) => {
  const editor = editorIn(el);
  await editor.load();
  await waitFor(() => expect(editor.shadowRoot!.querySelector('.cm-content')).toBeTruthy());
  return editor;
};
const content = (editor: MmSqlEditor) => editor.shadowRoot!.querySelector('.cm-content') as HTMLElement;
/** CodeMirror ignores completion keys for 75ms after the popup opens, so a fast typist never accepts by accident. */
const settle = () => new Promise((r) => setTimeout(r, 120));
const popup = (editor: MmSqlEditor) => editor.shadowRoot!.querySelector('.cm-tooltip-autocomplete');

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(content(editor)).toHaveAttribute('aria-label', 'Query');
    await expect(editor.shadowRoot!.querySelector('[part="shortcut"]')).toHaveTextContent('Run query');
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await expect(deepActive()).toBe(content(editor));
  },
};

export const ReadOnly: Story = {
  name: 'Read only',
  render: () => html`<mm-sql-editor label="Saved query" readonly .value=${SQL}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.badge')).toHaveTextContent('Read only');
  },
};

export const ReadOnlyBadgeSlot: Story = {
  name: 'Read only with a custom badge',
  render: () => html`<mm-sql-editor label="Query" readonly .value=${'select count(*) from shop.public.orders;'} style="--mm-code-editor-height:120px">
    <span slot="badge" style="display:inline-flex;align-items:center;gap:var(--space-1);font:var(--text-label);color:var(--mm-text-2)">
      <mm-icon name="lock" aria-hidden="true"></mm-icon>Read-only replica of shop-postgres
    </span>
  </mm-sql-editor>`,
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(content(editor)).toHaveAttribute('contenteditable', 'false');
  },
};

export const Loading: Story = {
  name: 'Loading (lazy until focused)',
  render: () => html`<mm-sql-editor lazy="interaction" label="Query" .value=${SQL}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    const editor = editorIn(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.cm-editor')).toBeNull();
    await expect(editor.shadowRoot!.querySelector('.fallback .c')).toHaveTextContent('-- Daily revenue');
  },
};

export const ServerError: Story = {
  name: 'Error from the server',
  render: () =>
    html`<mm-sql-editor label="Query" .value=${BROKEN} .error=${{ line: 3, column: 10, message: 'column "custmer_id" does not exist' }}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await waitFor(() => expect(editor.shadowRoot!.querySelector('.cm-lintRange-error')).toHaveTextContent('custmer_id'));
    const message = editor.shadowRoot!.querySelector('.message')!;
    await expect(message).toHaveTextContent('Line 3, column 10');
    await expect(message).toHaveTextContent('column "custmer_id" does not exist');
  },
};

export const LongLines: Story = {
  name: 'Long lines',
  args: {
    value: `select order_id, customer_id, total, status, created_at, updated_at, shipping_country, shipping_postcode, payment_method, discount_code from shop.public.orders where created_at >= '2026-10-01' and status in ('completed', 'refunded', 'partially_refunded') order by created_at desc;`,
  },
};
export const Empty: Story = { render: () => html`<mm-sql-editor label="Query" placeholder="Write a query, then press Ctrl+Enter to run it" .value=${''}></mm-sql-editor>` };
export const MySqlDialect: Story = {
  name: 'MySQL dialect',
  args: { dialect: 'mysql', value: 'select `order_id`, `total`\nfrom `orders`\nwhere `status` = \'completed\'\nlimit 100;' },
};
export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { label: 'استعلام' },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.frame')).toHaveAttribute('dir', 'ltr');
  },
};
export const BothThemes: Story = {
  name: 'Both themes',
  render: () =>
    themes(html`<mm-sql-editor label="Query" .value=${BROKEN} .error=${{ line: 3, column: 10, message: 'column "custmer_id" does not exist' }} style="--mm-code-editor-height:150px"></mm-sql-editor>`),
};

const onRun = fn();
export const RunShortcut: Story = {
  name: 'Keyboard: Ctrl/⌘+Enter runs',
  render: () => html`<mm-sql-editor label="Query" .value=${'select count(*) from shop.public.orders;'} @mm-run=${(e: CustomEvent) => onRun(e.detail)}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    onRun.mockClear();
    const editor = await loaded(canvasElement);
    await tab();
    await press('{Control>}{Enter}{/Control}');
    await expect(onRun).toHaveBeenCalledWith({ sql: 'select count(*) from shop.public.orders;', selection: false });
    await expect(editor.value).toBe('select count(*) from shop.public.orders;');
  },
};

export const SelectionRun: Story = {
  name: 'Keyboard: runs only the selection',
  render: () =>
    html`<mm-sql-editor
      label="Query"
      .value=${'select count(*) from shop.public.orders;\nselect count(*) from analytics.customers_dim;'}
      @mm-run=${(e: CustomEvent) => onRun(e.detail)}
    ></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    onRun.mockClear();
    await loaded(canvasElement);
    await tab();
    await press('{Shift>}{End}{/Shift}');
    await press('{Control>}{Enter}{/Control}');
    await expect(onRun).toHaveBeenCalledWith({ sql: 'select count(*) from shop.public.orders;', selection: true });
  },
};

export const Autocomplete: Story = {
  name: 'Keyboard: autocomplete moves with arrows and accepts with Enter',
  render: () => html`<mm-sql-editor label="Query" .value=${''} .schema=${SCHEMA}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await press('select * from shop.public.ord');
    await waitFor(() => expect(popup(editor)).toBeTruthy());
    await expect(popup(editor)!.querySelector('li[aria-selected]')).toHaveTextContent('order_items');
    await settle();
    await press('{ArrowDown}');
    await waitFor(() => expect(popup(editor)?.querySelector('li[aria-selected] .cm-completionLabel')).toHaveTextContent(/^orders$/));
    const selected = popup(editor)!.querySelector('li[aria-selected]')!;
    await expect(selected.querySelector('.cm-completionDetail')).toHaveTextContent('table · PostgreSQL');
    await press('{Enter}');
    await waitFor(() => expect(editor.value).toBe('select * from shop.public.orders'));
    await waitFor(() => expect(popup(editor)).toBeNull());
  },
};

export const CatalogCompleter: Story = {
  name: 'Keyboard: catalog completions show type and provider',
  render: () => html`<mm-sql-editor label="Query" .value=${''} .completer=${completer}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await press('select * from orders_d');
    await waitFor(() => expect(popup(editor)?.textContent).toContain('orders_daily'));
    const option = [...popup(editor)!.querySelectorAll('li')].find((li) => li.textContent?.includes('orders_daily'))!;
    await expect(option.querySelector('.cm-completionDetail')).toHaveTextContent('view · Snowflake');
    await expect(option.querySelector('mm-provider-logo')).toHaveAttribute('provider', 'snowflake');
  },
};

export const EscapeClosesCompletions: Story = {
  name: 'Keyboard: Escape closes completions, then Escape and Tab leave',
  render: () => html`<mm-sql-editor label="Query" .value=${''} .schema=${SCHEMA}></mm-sql-editor><mm-button style="margin-top:var(--space-3)">Save query</mm-button>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await press('select * from shop.public.');
    await waitFor(() => expect(popup(editor)).toBeTruthy());
    await settle();
    await press('{Escape}');
    await waitFor(() => expect(popup(editor)).toBeNull());
    await expect(deepActive()).toBe(content(editor));
    await press('{Escape}');
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};

const onFormat = fn();
export const FormatShortcut: Story = {
  name: 'Keyboard: Shift+Alt+F formats',
  render: () =>
    html`<mm-sql-editor label="Query" .value=${"select order_id from shop.public.orders where status = 'paid'  "} @mm-format=${(e: CustomEvent) => onFormat(e.detail.sql)}></mm-sql-editor>`,
  play: async ({ canvasElement }) => {
    onFormat.mockClear();
    const editor = await loaded(canvasElement);
    await tab();
    await press('{Shift>}{Alt>}f{/Alt}{/Shift}');
    await expect(onFormat).toHaveBeenCalled();
    await waitFor(() => expect(editor.value).toBe("SELECT order_id FROM shop.public.orders WHERE status = 'paid'"));
  },
};
