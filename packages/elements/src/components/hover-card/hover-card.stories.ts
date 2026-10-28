import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, userEvent, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/hover-card.js';
import type { MmHoverCard } from './class.ts';

type Args = { placement: string; openDelay: number; closeDelay: number };

const HOURS_AGO = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const link = 'color:var(--mm-primary);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px';
const prose = 'margin:0;font:var(--text-body);max-width:65ch';

const cardOf = (root: ParentNode) => root.querySelector('mm-hover-card')!;
const panel = (c: MmHoverCard) => c.shadowRoot!.querySelector<HTMLElement>('.panel')!;
const isOpen = (c: MmHoverCard) => panel(c).matches(':popover-open');
const shown = async (c: MmHoverCard) => {
  await waitFor(() => expect(isOpen(c)).toBe(true), { timeout: 2000 });
  await Promise.all(panel(c).getAnimations().map((a) => a.finished.catch(() => undefined)));
};
const hidden = (c: MmHoverCard) => waitFor(() => expect(isOpen(c)).toBe(false), { timeout: 2000 });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const assetCard = html`<mm-asset-card
  name="orders_daily"
  href="#orders_daily"
  provider="postgresql"
  type="Table"
  columns="14"
  mrn="mrn://postgresql/table/shop.public.orders_daily"
  description="One row per order per day, rolled up from shop.public.orders at 04:00 UTC. Use this for revenue reporting rather than the raw orders table, which includes test orders."
  owners="Analytics Engineering, Jane Doe"
  tags="finance, pii, certified"
  rows="1284019"
  updated=${HOURS_AGO(3)}
></mm-asset-card>`;

const meta: Meta<Args> = {
  title: 'Components/Overlays/Hover card',
  component: 'mm-hover-card',
  args: { placement: 'bottom-start', openDelay: 300, closeDelay: 150 },
  render: (a) => html`<p style=${prose}>
    Revenue dashboards read from
    <mm-hover-card placement=${a.placement} open-delay=${a.openDelay} close-delay=${a.closeDelay}>
      <a slot="trigger" href="#orders_daily" style=${link}>orders_daily</a>
      ${assetCard}
    </mm-hover-card>, which Analytics Engineering refreshes every morning.
  </p>`,
  parameters: {
    usage: {
      html: `<mm-hover-card>
  <a slot="trigger" href="/assets/mrn://postgresql/table/shop.public.orders_daily">orders_daily</a>
  <mm-asset-card name="orders_daily" provider="postgresql" type="Table" rows="1284019"
    mrn="mrn://postgresql/table/shop.public.orders_daily" owners="Analytics Engineering" tags="pii, certified"
    updated="2026-10-27T04:12:00Z"></mm-asset-card>
</mm-hover-card>`,
      react: `import { MmAssetCard, MmHoverCard } from '@marmotdata/react';

<MmHoverCard>
  <a slot="trigger" href={asset.url}>{asset.name}</a>
  <MmAssetCard name={asset.name} provider={asset.provider} type="Table" mrn={asset.mrn}
    owners={asset.owners} tags={asset.tags} rows={asset.rowCount} updated={asset.updatedAt} />
</MmHoverCard>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/hover-card.js';
</script>

<mm-hover-card>
  <a slot="trigger" href={asset.url}>{asset.name}</a>
  <mm-asset-card name={asset.name} provider={asset.provider} type="Table" mrn={asset.mrn}
    owners={asset.owners} tags={asset.tags} rows={asset.rowCount} updated={asset.updatedAt}></mm-asset-card>
</mm-hover-card>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Hover: Story = {
  name: 'Pointer: shows after 300ms, hides 150ms after leaving',
  play: async ({ canvasElement }) => {
    const c = cardOf(canvasElement);
    const trigger = canvasElement.querySelector('a[slot="trigger"]')!;
    await userEvent.hover(trigger);
    await wait(150);
    await expect(isOpen(c)).toBe(false);
    await shown(c);
    await expect(panel(c)).not.toHaveAttribute('data-instant');
    // Moving into the card keeps it open.
    await userEvent.unhover(trigger);
    await userEvent.hover(panel(c));
    await wait(250);
    await expect(isOpen(c)).toBe(true);
    await userEvent.unhover(panel(c));
    await hidden(c);
  },
};

export const Focus: Story = {
  name: 'Keyboard: shows on focus after the delay, never takes focus, Escape hides',
  play: async ({ canvasElement }) => {
    const c = cardOf(canvasElement);
    const trigger = canvasElement.querySelector('a[slot="trigger"]')!;
    await tab();
    await expect(deepActive()).toBe(trigger);
    await expect(isOpen(c)).toBe(false);
    await shown(c);
    await expect(panel(c)).toHaveAttribute('data-instant');
    await expect(deepActive()).toBe(trigger);
    // The card's own link follows the trigger in the tab order and keeps the card open.
    await tab();
    await expect(deepActive()).toBe(c.querySelector('mm-asset-card')!.shadowRoot!.querySelector('a'));
    await wait(250);
    await expect(isOpen(c)).toBe(true);
    await tab(true);
    await expect(deepActive()).toBe(trigger);
    await press('{Escape}');
    await hidden(c);
    await expect(deepActive()).toBe(trigger);
  },
};

export const Open: Story = {
  render: (a) => meta.render!(a, {} as never),
  play: async ({ canvasElement }) => {
    const c = cardOf(canvasElement);
    c.show();
    await shown(c);
  },
};

export const People: Story = {
  name: 'Person and agent cards',
  render: () => html`<p style=${prose}>
    <mm-hover-card>
      <a slot="trigger" href="#jane" style=${link}>Jane Doe</a>
      <mm-person-card
        name="Jane Doe"
        href="#jane"
        job-title="Senior analytics engineer"
        team="Analytics Engineering"
        email="jane.doe@marmot.internal"
      ></mm-person-card>
    </mm-hover-card>
    approved access for
    <mm-hover-card>
      <a slot="trigger" href="#support-triage-agent" style=${link}>support-triage-agent</a>
      <mm-person-card
        kind="agent"
        name="support-triage-agent"
        href="#support-triage-agent"
        job-title="Routes support tickets using order history"
        team="Customer Operations"
        service-account="svc-support-triage@marmot"
      ></mm-person-card>
    </mm-hover-card>
    to query customers_dim.
  </p>`,
  play: async ({ canvasElement }) => {
    const [person, agent] = canvasElement.querySelectorAll('mm-hover-card');
    agent!.show();
    await shown(agent!);
    person!.show();
    await shown(person!);
  },
};

export const Loading: Story = {
  name: 'Loading content',
  render: () => html`<p style=${prose}>
    Lineage comes from
    <mm-hover-card>
      <a slot="trigger" href="#shop-orders-v2" style=${link}>shop.orders.v2</a>
      <mm-asset-card loading></mm-asset-card>
    </mm-hover-card>
  </p>`,
  play: Open.play,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<p style=${prose}>
    Lineage comes from
    <mm-hover-card>
      <a slot="trigger" href="#shop-orders-v2" style=${link}>shop.orders.v2</a>
      <mm-asset-card error="shop.orders.v2 could not be loaded. Open the asset page to try again."></mm-asset-card>
    </mm-hover-card>
  </p>`,
  play: Open.play,
};

export const Empty: Story = {
  name: 'Empty: an asset with little metadata',
  render: () => html`<p style=${prose}>
    New in the catalog:
    <mm-hover-card>
      <a slot="trigger" href="#shop-orders-v2" style=${link}>shop.orders.v2</a>
      <mm-asset-card name="shop.orders.v2" provider="kafka" type="Topic" mrn="mrn://kafka/topic/shop.orders.v2"></mm-asset-card>
    </mm-hover-card>
  </p>`,
  play: Open.play,
};

export const LongIdentifiers: Story = {
  name: 'Overflowing content and long identifiers',
  render: () => html`<p style=${prose}>
    Built from
    <mm-hover-card>
      <a slot="trigger" href="#long" style=${link}>finance_orders_daily_rollup_by_region_and_currency_v2</a>
      <mm-asset-card
        name="finance_orders_daily_rollup_by_region_and_currency_v2"
        provider="snowflake"
        type="Table"
        columns="212"
        mrn="mrn://snowflake/table/analytics.marts.finance_orders_daily_rollup_by_region_and_currency_v2"
        description="Daily order totals by region and currency after refunds, chargebacks, partial shipments, tax adjustments and currency conversion at the closing rate published by the treasury team, reconciled against the general ledger every night."
        owners="Finance Data, Analytics Engineering, Data Platform, Jane Doe, Lee Morgan"
        tags="finance, pii, certified, month-end-close, revenue-recognition, gdpr-article-30"
        rows="9876543210"
        updated=${HOURS_AGO(26)}
      ></mm-asset-card>
    </mm-hover-card>
  </p>`,
  play: Open.play,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<p style=${prose}>
    تقرأ لوحات الإيرادات من
    <mm-hover-card>
      <a slot="trigger" href="#orders_daily" style=${link}>orders_daily</a>
      ${assetCard}
    </mm-hover-card>
  </p>`,
  play: Open.play,
};

export const Peat: Story = { parameters: { theme: 'dark' }, play: Open.play };

export const BothThemes: Story = {
  render: (a) => themes(meta.render!(a, {} as never)),
  play: async ({ canvasElement }) => {
    const c = canvasElement.querySelector('[data-theme="dark"] mm-hover-card') as MmHoverCard;
    c.show();
    await shown(c);
  },
};
