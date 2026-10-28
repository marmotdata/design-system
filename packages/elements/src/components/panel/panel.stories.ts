import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, spyOn } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/panel.js';
import '@marmotdata/elements/list.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/empty-state.js';
import '@marmotdata/elements/callout.js';
import '@marmotdata/icons/define.js';

type Args = { heading: string; icon: string; count: number | undefined; linkHref: string; padding: string; loading: boolean; empty: boolean };

const needsAttention = html`<mm-list>
  <mm-list-item href="#/pipelines/airflow_prod">
    <mm-status-pill slot="start" state="failed"></mm-status-pill>
    <mm-text variant="mono-dense">airflow_prod</mm-text> pipeline failed on its last run
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>12 min ago</mm-text>
  </mm-list-item>
  <mm-list-item href="#/assets/orders_daily">
    <mm-status-pill slot="start" state="stale"></mm-status-pill>
    <mm-text variant="mono-dense">orders_daily</mm-text> has no owner
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>3 days</mm-text>
  </mm-list-item>
  <mm-list-item href="#/access/support-triage-agent">
    <mm-status-pill slot="start" status="info" icon="smart-toy">Review</mm-status-pill>
    Agent <mm-text variant="mono-dense">support-triage-agent</mm-text> requested access
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>1 h ago</mm-text>
  </mm-list-item>
</mm-list>`;

const pipelines = html`<mm-list>
  <mm-list-item href="#/pipelines/postgres-shop" secondary="Every hour · 1,284,019 rows">
    <mm-provider-logo slot="start" provider="postgresql" decorative></mm-provider-logo>
    postgres-shop
    <mm-status-pill slot="end" state="succeeded"></mm-status-pill>
  </mm-list-item>
  <mm-list-item href="#/pipelines/kafka-orders" secondary="Continuous · 412 topics">
    <mm-provider-logo slot="start" provider="kafka" decorative></mm-provider-logo>
    kafka-orders
    <mm-status-pill slot="end" state="running" live></mm-status-pill>
  </mm-list-item>
  <mm-list-item href="#/pipelines/snowflake-finance" secondary="Daily at 02:00 UTC · 86 tables">
    <mm-provider-logo slot="start" provider="snowflake" decorative></mm-provider-logo>
    snowflake-finance
    <mm-status-pill slot="end" state="failed"></mm-status-pill>
  </mm-list-item>
</mm-list>`;

const activity = html`<mm-list dense>
  <mm-list-item>
    <mm-icon slot="start" name="person" aria-hidden="true"></mm-icon>
    Jane Doe added the glossary term <mm-text variant="mono-dense">gross_merchandise_value</mm-text>
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>04:12</mm-text>
  </mm-list-item>
  <mm-list-item>
    <mm-icon slot="start" name="smart-toy" aria-hidden="true"></mm-icon>
    <mm-text variant="mono-dense">support-triage-agent</mm-text> queried <mm-text variant="mono-dense">customers_dim</mm-text>
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>03:58</mm-text>
  </mm-list-item>
  <mm-list-item>
    <mm-icon slot="start" name="person" aria-hidden="true"></mm-icon>
    John Smith changed the owner of <mm-text variant="mono-dense">shop.orders.v2</mm-text> to Data Platform
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>03:41</mm-text>
  </mm-list-item>
</mm-list>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Panel',
  component: 'mm-panel',
  args: { heading: 'Needs attention', icon: 'notifications', count: 3, linkHref: '#/attention', padding: 'none', loading: false, empty: false },
  argTypes: { padding: { control: 'inline-radio', options: ['none', 'default'] } },
  render: (a) => html`<mm-panel
    style="max-width:560px"
    heading=${a.heading}
    icon=${a.icon}
    .count=${a.count}
    link-href=${a.linkHref}
    padding=${a.padding}
    ?loading=${a.loading}
    ?empty=${a.empty}
    >${needsAttention}</mm-panel
  >`,
  parameters: {
    usage: {
      html: `<mm-panel heading="Needs attention" icon="notifications" count="3" link-href="/attention">
  <mm-list>
    <mm-list-item href="/pipelines/airflow_prod">
      <mm-status-pill slot="start" state="failed"></mm-status-pill>
      airflow_prod pipeline failed on its last run
      <mm-text slot="end" variant="mono-dense" tone="tertiary">12 min ago</mm-text>
    </mm-list-item>
  </mm-list>
</mm-panel>`,
      react: `import { MmPanel, MmList, MmListItem } from '@marmotdata/react';

<MmPanel heading="Pipelines" icon="cable" linkHref="/plugins" loading={isLoading}>
  <MmList>
    {pipelines.map((p) => (
      <MmListItem key={p.id} href={\`/pipelines/\${p.id}\`} secondary={p.schedule}>{p.name}</MmListItem>
    ))}
  </MmList>
</MmPanel>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/panel.js';
  import '@marmotdata/elements/list.js';
</script>

<mm-panel heading="Activity" icon="history" link-href="/activity" loading={loading} empty={events.length === 0}>
  <mm-list dense>
    {#each events as e (e.id)}<mm-list-item>{e.text}</mm-list-item>{/each}
  </mm-list>
  <mm-empty-state slot="empty" compact heading="No activity yet" description="Changes to assets, owners and terms appear here as they happen."></mm-empty-state>
</mm-panel>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Examples: Story = {
  name: 'Home panels',
  render: () => html`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:var(--space-5);align-items:start">
    <mm-panel heading="Needs attention" icon="notifications" count="3" link-href="#/attention">${needsAttention}</mm-panel>
    <mm-panel heading="Pipelines" icon="cable" link-href="#/plugins">${pipelines}</mm-panel>
    <mm-panel heading="Activity" icon="history" link-href="#/activity">${activity}</mm-panel>
  </div>`,
};

export const Padded: Story = {
  name: 'Padded body with footer',
  render: () => html`<mm-panel heading="About this domain" icon="description" padding="default" style="max-width:560px">
    <mm-text block variant="dense">
      The Commerce domain holds every asset behind checkout, orders and refunds. Analytics Engineering owns the modelled tables;
      Data Platform owns ingestion from <mm-text variant="mono-dense">postgres-shop</mm-text> and <mm-text variant="mono-dense">kafka-orders</mm-text>.
    </mm-text>
    <span slot="footer">Last edited by Jane Doe on 12 Mar 2026</span>
  </mm-panel>`,
};

export const WithActions: Story = {
  name: 'Head actions',
  render: () => html`<mm-panel heading="Pipelines" icon="cable" link-href="#/plugins" style="max-width:560px">
    <mm-button slot="actions" variant="ghost" size="sm" icon="refresh" label="Refresh pipelines"></mm-button>
    ${pipelines}
  </mm-panel>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  name: 'Focus: View all link',
  render: () => html`<mm-panel heading="Pipelines" icon="cable" link-href="#/plugins" style="max-width:560px"><mm-text block variant="dense" style="padding:var(--space-4)">Three pipelines are configured.</mm-text></mm-panel>`,
  play: async ({ canvasElement }) => {
    await tab();
    const link = canvasElement.querySelector('mm-panel')!.shadowRoot!.querySelector('a.link');
    await expect(deepActive()).toBe(link);
    await expect(link!.textContent!.replace(/\s+/g, ' ').trim()).toBe('View all: Pipelines');
  },
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const panel = canvasElement.querySelector('mm-panel')!;
    const body = panel.shadowRoot!.querySelector('[part="body"]')!;
    await expect(body).toHaveAttribute('aria-busy', 'true');
    await new Promise((r) => setTimeout(r, 260));
    const sk = panel.shadowRoot!.querySelector('mm-skeleton')!;
    await expect(sk.shadowRoot!.querySelector('[part="placeholder"]')).not.toBeNull();
  },
};

export const Empty: Story = {
  render: () => html`<mm-panel heading="Needs attention" icon="notifications" count="0" empty style="max-width:560px">
    <mm-list></mm-list>
    <mm-empty-state slot="empty" compact heading="Nothing needs attention" description="Failed runs, stale assets and access requests appear here when they happen."></mm-empty-state>
  </mm-panel>`,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-panel heading="Pipelines" icon="cable" padding="default" style="max-width:560px">
    <mm-callout tone="danger" heading="Pipelines could not be loaded">
      The plugin service did not respond within 30 seconds. Check that <mm-text variant="mono-dense">marmot-plugins</mm-text> is running, then try again.
      <mm-button slot="actions" size="sm">Try again</mm-button>
    </mm-callout>
  </mm-panel>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-panel heading="Assets with the most downstream consumers this quarter across every domain" icon="account-tree" count="1284" link-href="#/insights" style="max-width:360px">
    <mm-list>
      <mm-list-item href="#/a" secondary="Analytics Engineering · 412 consumers">orders_daily_by_customer_region_rollup_v2</mm-list-item>
      <mm-list-item href="#/b" secondary="Data Platform · 318 consumers">mrn://postgresql/table/shop.public.orders_line_items_with_refunds</mm-list-item>
    </mm-list>
  </mm-panel>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-panel heading="Recently viewed" icon="history" style="max-width:420px">
    <mm-list>
      <mm-list-item href="#/a"><mm-text variant="mono-dense">mrn://snowflake/table/finance.reporting.revenue_recognition_monthly_snapshot_v3</mm-text></mm-list-item>
      <mm-list-item href="#/b"><mm-text variant="mono-dense">mrn://kafka/topic/shop.orders.v2.dead_letter_queue_retry_attempts</mm-text></mm-list-item>
    </mm-list>
  </mm-panel>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-panel heading="يحتاج إلى انتباه" icon="notifications" count="3" link-href="#/attention" link-label="عرض الكل" style="max-width:560px">${needsAttention}</mm-panel>`,
};

export const CompactDensity: Story = { globals: { density: 'compact' } };

export const BothThemes: Story = { render: () => themes(Examples.render!({} as Args, {} as never)) };

export const NestingWarns: Story = {
  name: 'Nesting warns in development',
  render: () => html`<mm-panel heading="Pipelines" padding="default" style="max-width:560px"><mm-text block variant="dense">A panel is never placed inside another panel.</mm-text></mm-panel>`,
  play: async ({ canvasElement }) => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    const outer = canvasElement.querySelector('mm-panel')!;
    const inner = document.createElement('mm-panel');
    outer.append(inner);
    inner.remove();
    await expect(warn).toHaveBeenCalledWith(expect.stringContaining('never nested'), inner);
    warn.mockRestore();
  },
};
