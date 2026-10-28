import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/query-history.js';
import type { MmQueryHistory, QueryHistoryItem } from './class.ts';

const NOW = Date.parse('2026-10-27T09:30:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const QUERIES: QueryHistoryItem[] = [
  {
    id: 'q_01HF8Z',
    sql: `-- Revenue by region for the last 30 days
with recent_orders as (
  select customer_id, total from shop.public.orders where created_at >= now() - interval '30 days'
)
select c.region, sum(r.total) as revenue from recent_orders r join analytics.customers_dim c using (customer_id) group by 1;`,
    status: 'succeeded',
    source: { name: 'shop-postgres', provider: 'postgresql' },
    rows: 12,
    durationMs: 412,
    startedAt: ago(3),
  },
  {
    id: 'q_01HF8Y',
    sql: 'select o.order_id, o.total, o.custmer_id from shop.public.orders o where o.created_at >= current_date - 7;',
    status: 'failed',
    source: { name: 'shop-postgres', provider: 'postgresql' },
    durationMs: 38,
    startedAt: ago(9),
    reason: 'column "custmer_id" does not exist',
  },
  {
    id: 'q_01HF8X',
    sql: 'select email, phone from analytics.customers_dim where region = \'EMEA\';',
    status: 'denied',
    source: { name: 'analytics-snowflake', provider: 'snowflake' },
    startedAt: ago(26),
    reason: 'The analyst role masks email and phone on customers_dim.',
  },
  {
    id: 'q_01HF8W',
    sql: 'select day, orders, revenue from analytics.orders_daily order by day desc limit 90;',
    status: 'succeeded',
    source: { name: 'analytics-snowflake', provider: 'snowflake' },
    rows: 90,
    durationMs: 2300,
    startedAt: ago(75),
  },
  {
    id: 'q_01HF8V',
    sql: 'select count(*) from shop.public.orders;',
    status: 'succeeded',
    source: { name: 'shop-postgres', provider: 'postgresql' },
    rows: 1,
    durationMs: 192_000,
    startedAt: ago(60 * 26),
  },
  {
    id: 'q_01HF8T',
    sql: 'select * from shop.public.orders where status = \'refunded\' and created_at between \'2026-09-01\' and \'2026-09-30\' order by total desc;',
    status: 'succeeded',
    source: { name: 'shop-postgres', provider: 'postgresql' },
    rows: 1284019,
    durationMs: 18_400,
    startedAt: ago(60 * 24 * 3),
  },
];

type Args = { filter: string; label: string };

const meta: Meta<Args> = {
  title: 'Components/Query/Query history',
  component: 'mm-query-history',
  args: { filter: 'all', label: 'Query history' },
  argTypes: { filter: { control: 'inline-radio', options: ['all', 'succeeded', 'failed', 'denied'] } },
  render: (a) => html`<mm-query-history .queries=${QUERIES} .now=${NOW} filter=${a.filter} label=${a.label} style="max-width:960px"></mm-query-history>`,
  parameters: {
    usage: {
      html: `<mm-query-history label="Query history"></mm-query-history>
<script type="module">
  import '@marmotdata/elements/query-history.js';
  const history = document.querySelector('mm-query-history');
  history.queries = await fetchHistory();
  history.addEventListener('mm-open-query', (e) => openInEditor(e.detail.query.sql));
  history.addEventListener('mm-run', (e) => runQuery(e.detail.sql));
</script>`,
      react: `import { MmQueryHistory } from '@marmotdata/react';

<MmQueryHistory
  queries={history}
  onMmOpenQuery={(e) => setSql(e.detail.query.sql)}
  onMmRun={(e) => run(e.detail.sql)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/query-history.js';
  let { history } = $props();
</script>

<mm-query-history
  queries={history}
  onmm-open-query={(e) => (sql = e.detail.query.sql)}
  onmm-run={(e) => run(e.detail.sql)}
></mm-query-history>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const historyIn = (el: HTMLElement) => el.querySelector('mm-query-history') as MmQueryHistory;
const openButtons = (h: MmQueryHistory) => [...h.shadowRoot!.querySelectorAll<HTMLElement>('.open')];

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const h = historyIn(canvasElement);
    await waitFor(() => expect(openButtons(h)).toHaveLength(6));
    const first = h.shadowRoot!.querySelector('li')!;
    await expect(first.querySelector('.sql')).toHaveTextContent('with recent_orders as (');
    await expect(first).toHaveTextContent('12 rows');
    await expect(first).toHaveTextContent('412 ms');
    await expect(first).toHaveTextContent('3 minutes ago');
    await expect(first.querySelector('mm-provider-logo')).toHaveAttribute('provider', 'postgresql');
  },
};

export const FilteredFailed: Story = { name: 'Filtered to failed', args: { filter: 'failed' } };
export const Narrow: Story = {
  name: 'Narrow (side panel)',
  render: () => html`<mm-query-history .queries=${QUERIES} .now=${NOW} style="max-width:420px"></mm-query-history>`,
};
export const LongSql: Story = {
  name: 'Long identifiers',
  render: () =>
    html`<mm-query-history
      .now=${NOW}
      style="max-width:720px"
      .queries=${[
        {
          id: 'q_long',
          sql: 'select order_id, customer_id, shipping_postcode, payment_method_fingerprint, discount_code_applied_at from mrn_postgresql_shop_public_orders_daily_rollup_with_refunds_and_partial_shipments;',
          status: 'succeeded',
          source: { name: 'shop-postgres-eu-west-2-read-replica-03', provider: 'postgresql' },
          rows: 1284019,
          durationMs: 64_000,
          startedAt: new Date(NOW - 120_000).toISOString(),
        },
      ]}
    ></mm-query-history>`,
};

export const Empty: Story = {
  render: () => html`<mm-query-history .queries=${[]}></mm-query-history>`,
  play: async ({ canvasElement }) => {
    await expect(historyIn(canvasElement).shadowRoot!.querySelector('.empty')).toHaveTextContent(
      'No queries yet. Run one from the editor and it will appear here.',
    );
  },
};
export const RightToLeft: Story = { name: 'Right to left', parameters: { dir: 'rtl' }, args: { label: 'سجل الاستعلامات' } };
export const BothThemes: Story = {
  name: 'Both themes',
  render: () => themes(html`<mm-query-history .queries=${QUERIES.slice(0, 4)} .now=${NOW}></mm-query-history>`),
};

const onOpen = fn();
const onRun = fn();
export const KeyboardNavigation: Story = {
  name: 'Keyboard: arrows move, Enter opens, Tab reaches row actions',
  render: () =>
    html`<mm-query-history
      .queries=${QUERIES}
      .now=${NOW}
      style="max-width:960px"
      @mm-open-query=${(e: CustomEvent) => onOpen(e.detail.query.id)}
      @mm-run=${(e: CustomEvent) => onRun(e.detail.query.id)}
    ></mm-query-history>`,
  play: async ({ canvasElement }) => {
    onOpen.mockClear();
    onRun.mockClear();
    const h = historyIn(canvasElement);
    await waitFor(() => expect(openButtons(h)).toHaveLength(6));
    // The three filter pills come first.
    await tab();
    await tab();
    await tab();
    await tab();
    await expect(deepActive()).toBe(openButtons(h)[0]);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(openButtons(h)[1]);
    await press('{End}');
    await expect(deepActive()).toBe(openButtons(h)[5]);
    await press('{Home}');
    await press('{ArrowDown}{ArrowDown}');
    await expect(deepActive()).toBe(openButtons(h)[2]);
    await press('{Enter}');
    await expect(onOpen).toHaveBeenCalledWith('q_01HF8X');
    // Tab goes to this row's actions, then out of the list.
    await tab();
    const row = h.shadowRoot!.querySelectorAll('li')[2]!;
    const runAgain = row.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
    await expect(deepActive()).toBe(runAgain);
    await press('{Enter}');
    await expect(onRun).toHaveBeenCalledWith('q_01HF8X');
    await tab();
    const copy = row.querySelector('mm-copy-button')!.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
    await expect(deepActive()).toBe(copy);
    await tab(true);
    await tab(true);
    await expect(deepActive()).toBe(openButtons(h)[2]);
  },
};

const onFilter = fn();
export const FilterByStatus: Story = {
  name: 'Keyboard: filter by status',
  render: () =>
    html`<mm-query-history .queries=${QUERIES} .now=${NOW} @mm-filter=${(e: CustomEvent) => onFilter(e.detail.filter)}></mm-query-history>`,
  play: async ({ canvasElement }) => {
    onFilter.mockClear();
    const h = historyIn(canvasElement);
    await waitFor(() => expect(openButtons(h)).toHaveLength(6));
    await tab();
    await tab();
    await press('{Enter}');
    await expect(onFilter).toHaveBeenCalledWith('failed');
    await waitFor(() => expect(openButtons(h)).toHaveLength(1));
    await expect(h.shadowRoot!.querySelector('mm-status-pill')).toHaveAttribute('state', 'failed');
    await press('{Space}');
    await expect(onFilter).toHaveBeenLastCalledWith('all');
    await waitFor(() => expect(openButtons(h)).toHaveLength(6));
  },
};

const writes = fn(async (_text: string) => {});
export const CopySql: Story = {
  name: 'Copy SQL confirms',
  render: () => html`<mm-query-history .queries=${QUERIES.slice(4, 5)} .now=${NOW}></mm-query-history>`,
  play: async ({ canvasElement }) => {
    writes.mockClear();
    Object.defineProperty(navigator.clipboard, 'writeText', { value: writes, configurable: true });
    const h = historyIn(canvasElement);
    const copy = await waitFor(() => h.shadowRoot!.querySelector('mm-copy-button')!);
    await click(copy.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!);
    await expect(writes).toHaveBeenCalledWith('select count(*) from shop.public.orders;');
    await waitFor(() => expect(copy.shadowRoot!.querySelector('[role="status"]')).toHaveTextContent('Copied'));
  },
};
