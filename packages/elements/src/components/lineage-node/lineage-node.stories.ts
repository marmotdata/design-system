import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/lineage-node.js';

type Args = {
  name: string;
  type: string;
  provider: string;
  mrn: string;
  variant: string;
  current: boolean;
  selected: boolean;
  stub: boolean;
  failed: boolean;
  interactive: boolean;
};

const meta: Meta<Args> = {
  title: 'Components/Lineage/Lineage node',
  component: 'mm-lineage-node',
  args: {
    name: 'orders_daily',
    type: 'model',
    provider: 'dbt',
    mrn: 'mrn://dbt/model/analytics.orders_daily',
    variant: 'asset',
    current: false,
    selected: false,
    stub: false,
    failed: false,
    interactive: false,
  },
  argTypes: { variant: { control: 'inline-radio', options: ['asset', 'cycle-return', 'agent-cluster'] } },
  render: (a) =>
    html`<mm-lineage-node
      name=${a.name}
      type=${a.type}
      provider=${a.provider}
      mrn=${a.mrn}
      variant=${a.variant}
      ?current=${a.current}
      ?selected=${a.selected}
      ?stub=${a.stub}
      ?failed=${a.failed}
      ?interactive=${a.interactive}
    ></mm-lineage-node>`,
  parameters: {
    usage: {
      html: `<mm-lineage-node name="orders_daily" type="model" provider="dbt" current></mm-lineage-node>
<mm-lineage-node name="Weekly revenue" type="dashboard" provider="looker" stub></mm-lineage-node>
<mm-lineage-node variant="agent-cluster" count="4"></mm-lineage-node>`,
      react: `import { MmLineageNode } from '@marmotdata/react';

<MmLineageNode name="orders_daily" type="model" provider="dbt" current />
<MmLineageNode name="stg_orders" type="model" provider="dbt" failed interactive onMmNodeActivate={openBlade} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/lineage-node.js';
</script>

<mm-lineage-node name="orders_daily" type="model" provider="dbt" current></mm-lineage-node>
<mm-lineage-node name="stg_orders" type="model" provider="dbt" interactive onmm-node-activate={openBlade}></mm-lineage-node>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = { args: { name: 'shop.public.orders', type: 'table', provider: 'postgresql', mrn: 'mrn://postgresql/table/shop.public.orders' } };
export const Current: Story = { args: { current: true } };
export const Selected: Story = { args: { selected: true, name: 'stg_orders', mrn: 'mrn://dbt/model/analytics.stg_orders' } };
export const Stub: Story = { args: { stub: true, name: 'Weekly revenue', type: 'dashboard', provider: 'looker', mrn: 'mrn://looker/dashboard/weekly-revenue' } };
export const Failed: Story = { args: { failed: true, name: 'stg_orders', mrn: 'mrn://dbt/model/analytics.stg_orders' } };
export const CycleReturn: Story = { name: 'Cycle return', args: { variant: 'cycle-return', provider: '' } };
export const AgentCluster: Story = {
  name: 'Agent cluster',
  render: () => html`<mm-lineage-node
    variant="agent-cluster"
    interactive
    .members=${['support-triage-agent', 'revenue-forecast-agent', 'churn-watch-agent', 'finance-agent']}
  ></mm-lineage-node>`,
};

const stack = (content: unknown) => html`<div style="background-color:var(--mm-paper);background-image:radial-gradient(circle, var(--mm-rule) 1px, transparent 1.2px);background-size:16px 16px;display:grid;grid-template-columns:repeat(auto-fill,220px);gap:var(--space-5);align-items:start;padding:var(--space-5)">${content}</div>`;
const allStates = () =>
  stack(html`
    <mm-lineage-node name="shop.public.orders" type="table" provider="postgresql"></mm-lineage-node>
    <mm-lineage-node name="orders_daily" type="model" provider="dbt" current></mm-lineage-node>
    <mm-lineage-node name="stg_orders" type="model" provider="dbt" selected></mm-lineage-node>
    <mm-lineage-node name="orders_daily" type="model" provider="dbt" current selected></mm-lineage-node>
    <mm-lineage-node name="customers_dim" type="table" provider="snowflake" focused></mm-lineage-node>
    <mm-lineage-node name="Weekly revenue" type="dashboard" provider="looker" stub></mm-lineage-node>
    <mm-lineage-node name="orders-enrichment" type="job" provider="flink" failed></mm-lineage-node>
    <mm-lineage-node name="shop.orders.v2" type="topic" provider="kafka"></mm-lineage-node>
    <mm-lineage-node variant="cycle-return" name="orders_daily" type="model"></mm-lineage-node>
    <mm-lineage-node variant="agent-cluster" .members=${['support-triage-agent', 'revenue-forecast-agent', 'churn-watch-agent', 'finance-agent']}></mm-lineage-node>
    <mm-lineage-node variant="agent-cluster" expanded .members=${['support-triage-agent', 'revenue-forecast-agent', 'churn-watch-agent', 'finance-agent']}></mm-lineage-node>
  `);

export const AllStates: Story = {
  name: 'All states',
  render: allStates,
  parameters: {
    docs: {
      description: {
        story:
          'Current is burnt sienna on its tint. Selected is a 2px ink border with a tick. Keyboard focus is a detached ink ring with a 2px gap. All three combine without becoming ambiguous.',
      },
    },
  },
};

export const Hover: Story = { args: { interactive: true }, parameters: { pseudo: { hover: true } } };

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () =>
    stack(html`
      <mm-lineage-node name="int_orders__joined_with_customer_lifetime_value_and_marketing_attribution" type="model" provider="dbt"></mm-lineage-node>
      <mm-lineage-node name="ANALYTICS.MARTS.ORDERS_DAILY_ROLLUP_BY_REGION_AND_CHANNEL_V3" type="table" provider="snowflake" current></mm-lineage-node>
      <mm-lineage-node name="shop.orders.v2.dead-letter.enrichment-retries" type="topic" provider="kafka" stub></mm-lineage-node>
    `),
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: allStates };
export const BothThemes: Story = { render: () => themes(allStates()) };

const onActivate = fn();
export const KeyboardActivation: Story = {
  name: 'Keyboard: Enter and Space activate',
  render: () => html`<mm-lineage-node name="stg_orders" type="model" provider="dbt" mrn="mrn://dbt/model/analytics.stg_orders" interactive @mm-node-activate=${(e: CustomEvent) => onActivate(e.detail)}></mm-lineage-node>`,
  play: async ({ canvasElement }) => {
    onActivate.mockClear();
    await tab();
    const node = canvasElement.querySelector('mm-lineage-node')!;
    await expect(deepActive()).toBe(node.shadowRoot!.querySelector('button'));
    await press('{Enter}');
    await press('{Space}');
    await expect(onActivate).toHaveBeenCalledTimes(2);
    await expect(onActivate).toHaveBeenCalledWith({ name: 'stg_orders', mrn: 'mrn://dbt/model/analytics.stg_orders' });
  },
};

const onToggle = fn();
export const KeyboardClusterToggle: Story = {
  name: 'Keyboard: agent cluster expands',
  render: () => html`<mm-lineage-node
    variant="agent-cluster"
    interactive
    .members=${['support-triage-agent', 'revenue-forecast-agent', 'churn-watch-agent', 'finance-agent']}
    @mm-toggle=${(e: CustomEvent) => onToggle(e.detail)}
  ></mm-lineage-node>`,
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const node = canvasElement.querySelector('mm-lineage-node')!;
    await tab();
    const btn = node.shadowRoot!.querySelector('button')!;
    await expect(deepActive()).toBe(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await press('{Enter}');
    await node.updateComplete;
    await expect(onToggle).toHaveBeenCalledWith({ expanded: true });
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(node.shadowRoot!.querySelectorAll('li').length).toBe(4);
    await press('{Space}');
    await node.updateComplete;
    await expect(onToggle).toHaveBeenLastCalledWith({ expanded: false });
  },
};

export const Describe: Story = {
  name: 'Accessible description',
  render: () => html`<mm-lineage-node name="Weekly revenue" type="dashboard" provider="looker" stub failed></mm-lineage-node>`,
  play: async ({ canvasElement }) => {
    const node = canvasElement.querySelector('mm-lineage-node')!;
    await expect(node.describe()).toBe('Weekly revenue, dashboard, Looker, Not catalogued yet, Last run failed');
  },
};
