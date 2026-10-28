import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/saved-query-card.js';
import '@marmotdata/elements/menu.js';

const NOW = Date.parse('2026-10-27T09:30:00Z');

const REVENUE = `-- Weekly revenue by region, completed orders only
select date_trunc('week', o.created_at) as week, c.region, sum(o.total) as revenue
from shop.public.orders o
join analytics.customers_dim c on c.customer_id = o.customer_id
where o.status = 'completed'
group by 1, 2
order by 1 desc, 3 desc;`;

const REFUNDS = `select order_id, total, refunded_at
from shop.public.orders
where status = 'refunded' and refunded_at >= current_date - 1;`;

const CHURN = `with last_orders as (
  select customer_id, max(created_at) as last_order_at from shop.public.orders group by 1
)
select c.customer_id, c.region, l.last_order_at
from analytics.customers_dim c join last_orders l using (customer_id)
where l.last_order_at < current_date - interval '90 days';`;

const menu = () => html`<mm-menu slot="menu">
  <mm-menu-item icon="content-copy" value="duplicate">Duplicate</mm-menu-item>
  <mm-menu-item icon="link" value="share">Copy link</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete saved query</mm-menu-item>
</mm-menu>`;

type Args = {
  name: string;
  description: string;
  owner: string;
  ownerKind: string;
  source: string;
  provider: string;
  lastRunStatus: string;
  lastRunAt: string;
  sql: string;
};

const meta: Meta<Args> = {
  title: 'Components/Query/Saved query card',
  component: 'mm-saved-query-card',
  args: {
    name: 'Weekly revenue by region',
    description: 'Completed orders only, joined to the customer dimension for region. Used in the Monday trading review.',
    owner: 'Jane Doe',
    ownerKind: 'person',
    source: 'shop-postgres',
    provider: 'postgresql',
    lastRunStatus: 'succeeded',
    lastRunAt: new Date(NOW - 2 * 3600_000).toISOString(),
    sql: REVENUE,
  },
  argTypes: {
    ownerKind: { control: 'inline-radio', options: ['person', 'agent'] },
    lastRunStatus: { control: 'select', options: ['', 'succeeded', 'failed', 'denied', 'running'] },
  },
  render: (a) => html`<mm-saved-query-card
    style="max-width:760px"
    name=${a.name}
    description=${a.description}
    owner=${a.owner}
    owner-kind=${a.ownerKind}
    source=${a.source}
    provider=${a.provider}
    last-run-status=${a.lastRunStatus}
    last-run-at=${a.lastRunAt}
    .sql=${a.sql}
    .now=${NOW}
    >${menu()}</mm-saved-query-card
  >`,
  parameters: {
    usage: {
      html: `<mm-saved-query-card
  name="Weekly revenue by region"
  description="Completed orders only, joined to the customer dimension for region."
  owner="Jane Doe" owner-kind="person"
  source="shop-postgres" provider="postgresql"
  last-run-status="succeeded" last-run-at="2026-10-27T07:30:00Z"
  href="/query/saved/weekly-revenue">
  <mm-menu slot="menu">
    <mm-menu-item icon="content-copy">Duplicate</mm-menu-item>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-item icon="delete" danger>Delete saved query</mm-menu-item>
  </mm-menu>
</mm-saved-query-card>`,
      react: `import { MmSavedQueryCard, MmMenu, MmMenuItem } from '@marmotdata/react';

<MmSavedQueryCard
  name={q.name}
  description={q.description}
  owner={q.owner.name}
  ownerKind={q.owner.kind}
  source={q.source.name}
  provider={q.source.provider}
  lastRunStatus={q.lastRun?.status ?? ''}
  lastRunAt={q.lastRun?.at ?? ''}
  sql={q.sql}
  onMmOpenQuery={() => openInEditor(q)}
  onMmRun={() => run(q.sql)}
>
  <MmMenu slot="menu"><MmMenuItem icon="content-copy">Duplicate</MmMenuItem></MmMenu>
</MmSavedQueryCard>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/saved-query-card.js';
  import '@marmotdata/elements/menu.js';
</script>

{#each saved as q (q.id)}
  <mm-saved-query-card
    name={q.name}
    owner={q.owner.name}
    owner-kind={q.owner.kind}
    source={q.source.name}
    provider={q.source.provider}
    last-run-status={q.lastRun?.status ?? ''}
    sql={q.sql}
    onmm-run={() => run(q.sql)}
  ></mm-saved-query-card>
{/each}`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector('mm-saved-query-card')!;
    const root = card.shadowRoot!;
    await expect(root.querySelector('[role="heading"]')).toHaveTextContent('Weekly revenue by region');
    await expect(root.querySelector('.owner mm-icon')).toHaveAttribute('name', 'person');
    await expect(root.querySelectorAll('.preview .ln')).toHaveLength(3);
    // Don't badge the happy path: a succeeded run shows no pill.
    await expect(root.querySelector('mm-status-pill')).toBeNull();
    await expect(root.querySelector('time')).toHaveTextContent('2 hours ago');
  },
};
export const AgentOwner: Story = {
  name: 'Owned by an agent',
  args: {
    name: 'Refunds in the last day',
    description: 'Run each morning to flag unusual refund volume for the support team.',
    owner: 'support-triage-agent',
    ownerKind: 'agent',
    lastRunAt: new Date(NOW - 25 * 60_000).toISOString(),
    sql: REFUNDS,
  },
};
export const FailedLastRun: Story = {
  name: 'Last run failed',
  args: { name: 'Lapsed customers', description: 'Customers with no order in 90 days.', lastRunStatus: 'failed', source: 'analytics-snowflake', provider: 'snowflake', sql: CHURN },
};
export const NeverRun: Story = { name: 'Never run', args: { lastRunStatus: '', lastRunAt: '' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const LongContent: Story = {
  name: 'Long identifiers',
  args: {
    name: 'Daily rollup of orders with refunds and partial shipments for the EMEA finance close',
    source: 'shop-postgres-eu-west-2-read-replica-03',
    sql: 'select order_id, customer_id, shipping_postcode, payment_method_fingerprint, discount_code_applied_at, partial_shipment_count from shop.public.orders_daily_rollup_with_refunds;',
  },
};
export const InAList: Story = {
  name: 'In a list of saved queries',
  render: () => html`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:var(--space-3);max-width:760px">
    <li>
      <mm-saved-query-card name="Weekly revenue by region" description="Completed orders only, joined to the customer dimension for region." owner="Jane Doe" source="shop-postgres" provider="postgresql" last-run-status="succeeded" last-run-at=${new Date(NOW - 2 * 3600_000).toISOString()} .now=${NOW} .sql=${REVENUE}>${menu()}</mm-saved-query-card>
    </li>
    <li>
      <mm-saved-query-card name="Refunds in the last day" owner="support-triage-agent" owner-kind="agent" source="shop-postgres" provider="postgresql" last-run-status="denied" last-run-at=${new Date(NOW - 25 * 60_000).toISOString()} .now=${NOW} .sql=${REFUNDS}>${menu()}</mm-saved-query-card>
    </li>
    <li>
      <mm-saved-query-card name="Lapsed customers" description="Customers with no order in 90 days, for the win-back campaign." owner="Analytics Engineering" source="analytics-snowflake" provider="snowflake" .now=${NOW} .sql=${CHURN}>${menu()}</mm-saved-query-card>
    </li>
  </ul>`,
};
export const Narrow: Story = { render: (a, c) => html`<div style="max-width:420px">${meta.render!(a, c)}</div>` };
export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { name: 'الإيرادات الأسبوعية حسب المنطقة', description: 'الطلبات المكتملة فقط.' },
};
export const BothThemes: Story = { name: 'Both themes', render: (a, c) => themes(meta.render!(a, c)) };

const onOpen = fn();
const onRun = fn();
const onSelect = fn();
export const Keyboard: Story = {
  name: 'Keyboard: Open, Run and the More menu',
  render: (a, c) => html`<div
    @mm-open-query=${(e: CustomEvent) => onOpen(e.detail.sql)}
    @mm-run=${(e: CustomEvent) => onRun(e.detail.sql)}
    @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}
  >
    ${meta.render!(a, c)}
  </div>`,
  play: async ({ canvasElement }) => {
    onOpen.mockClear();
    onRun.mockClear();
    onSelect.mockClear();
    await tab();
    await press('{Enter}');
    await expect(onOpen).toHaveBeenCalledWith(REVENUE);
    await tab();
    await press('{Space}');
    await expect(onRun).toHaveBeenCalledWith(REVENUE);
    await tab();
    await press('{Enter}');
    const menuEl = canvasElement.querySelector('mm-menu')!;
    await waitFor(() => expect(menuEl.open).toBe(true));
    await press('{ArrowDown}{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('share');
    const card = canvasElement.querySelector('mm-saved-query-card')!;
    const trigger = card.shadowRoot!.querySelector('mm-menu-button')!;
    const triggerButton = trigger.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button');
    await waitFor(() => expect(deepActive()).toBe(triggerButton));
  },
};
