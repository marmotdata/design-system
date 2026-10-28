import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/asset-card.js';

type Args = {
  name: string;
  href: string;
  provider: string;
  type: string;
  columns: number;
  mrn: string;
  description: string;
  owners: string;
  tags: string;
  rows: number;
  updated: string;
  framed: boolean;
};

const meta: Meta<Args> = {
  title: 'Components/Overlays/Asset card',
  component: 'mm-asset-card',
  args: {
    name: 'orders_daily',
    href: '#orders_daily',
    provider: 'postgresql',
    type: 'Table',
    columns: 14,
    mrn: 'mrn://postgresql/table/shop.public.orders_daily',
    description:
      'One row per order per day, rolled up from shop.public.orders at 04:00 UTC. Use this for revenue reporting rather than the raw orders table, which includes test orders.',
    owners: 'Analytics Engineering, Jane Doe',
    tags: 'finance, pii, certified',
    rows: 1284019,
    updated: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    framed: true,
  },
  render: (a) => html`<mm-asset-card
    name=${a.name}
    href=${a.href}
    provider=${a.provider}
    type=${a.type}
    columns=${a.columns}
    mrn=${a.mrn}
    description=${a.description}
    owners=${a.owners}
    tags=${a.tags}
    rows=${a.rows}
    updated=${a.updated}
    ?framed=${a.framed}
  ></mm-asset-card>`,
  parameters: {
    usage: {
      html: `<mm-asset-card framed name="orders_daily" href="/assets/orders_daily" provider="postgresql" type="Table" columns="14"
  mrn="mrn://postgresql/table/shop.public.orders_daily" owners="Analytics Engineering, Jane Doe"
  tags="finance, pii, certified" rows="1284019" updated="2026-10-27T04:12:00Z"></mm-asset-card>`,
      react: `import { MmAssetCard } from '@marmotdata/react';

<MmAssetCard framed name={a.name} href={a.url} provider={a.provider} type="Table" mrn={a.mrn}
  description={a.description} owners={a.owners} tags={a.tags} rows={a.rowCount} updated={a.updatedAt} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/asset-card.js';
</script>

<mm-asset-card framed name={a.name} href={a.url} provider={a.provider} type="Table" mrn={a.mrn}
  description={a.description} owners={a.owners} tags={a.tags} rows={a.rowCount} updated={a.updatedAt}></mm-asset-card>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Unframed: Story = { name: 'Unframed, for hover cards and popovers', args: { framed: false } };

export const Focus: Story = {
  name: 'Keyboard: the name is a link',
  play: async ({ canvasElement }) => {
    await tab();
    const a = canvasElement.querySelector('mm-asset-card')!.shadowRoot!.querySelector('a')!;
    await expect(deepActive()).toBe(a);
    await expect(a).toHaveAccessibleName('orders_daily');
  },
};

export const Topic: Story = {
  args: {
    name: 'shop.orders.v2',
    provider: 'kafka',
    type: 'Topic',
    columns: undefined as never,
    mrn: 'mrn://kafka/topic/shop.orders.v2',
    description: 'Order events from the checkout service, keyed by order_id. Retained for 7 days.',
    owners: 'Data Platform',
    tags: 'events',
    rows: undefined as never,
  },
};

export const Empty: Story = {
  name: 'Empty: little metadata',
  render: () => html`<mm-asset-card framed name="customers_dim" provider="snowflake" type="Table" mrn="mrn://snowflake/table/analytics.marts.customers_dim"></mm-asset-card>`,
};
export const Loading: Story = { render: () => html`<mm-asset-card framed loading></mm-asset-card>` };
export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-asset-card framed error="customers_dim could not be loaded. Open the asset page to try again."></mm-asset-card>`,
};
export const LongIdentifiers: Story = {
  name: 'Overflowing content and long identifiers',
  args: {
    name: 'finance_orders_daily_rollup_by_region_and_currency_v2',
    provider: 'snowflake',
    columns: 212,
    mrn: 'mrn://snowflake/table/analytics.marts.finance_orders_daily_rollup_by_region_and_currency_v2',
    description:
      'Daily order totals by region and currency after refunds, chargebacks, partial shipments, tax adjustments and currency conversion at the closing rate published by the treasury team, reconciled against the general ledger every night.',
    owners: 'Finance Data, Analytics Engineering, Data Platform, Jane Doe, Lee Morgan',
    tags: 'finance, pii, certified, month-end-close, revenue-recognition, gdpr-article-30',
    rows: 9876543210,
  },
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { type: 'جدول', description: 'صف واحد لكل طلب في اليوم، مجمّع من shop.public.orders.' } };
export const BothThemes: Story = { render: (a) => themes(meta.render!(a, {} as never)) };
