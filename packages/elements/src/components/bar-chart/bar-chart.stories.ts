import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/bar-chart.js';
import type { BarDatum, MmBarChart } from './class.ts';

const failedRuns: BarDatum[] = [
  { label: '14 Oct', value: 3 },
  { label: '15 Oct', value: 1 },
  { label: '16 Oct', value: 0 },
  { label: '17 Oct', value: 2 },
  { label: '18 Oct', value: 1 },
  { label: '19 Oct', value: 0 },
  { label: '20 Oct', value: 4 },
  { label: '21 Oct', value: 9 },
  { label: '22 Oct', value: 2 },
  { label: '23 Oct', value: 1 },
  { label: '24 Oct', value: 3 },
  { label: '25 Oct', value: 0 },
  { label: '26 Oct', value: 2 },
  { label: '27 Oct', value: 4, estimated: true },
];

const agents: BarDatum[] = [
  { label: 'support-triage-agent', value: 4812 },
  { label: 'revenue-forecast-agent', value: 2904 },
  { label: 'catalog-steward-agent', value: 1766 },
  { label: 'churn-analysis-agent', value: 1203 },
  { label: 'pii-scanner-agent', value: 688 },
  { label: 'schema-drift-agent', value: 412 },
  { label: 'lineage-backfill-agent', value: 37 },
];

const byCaller: BarDatum[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
  label,
  values: [[1840, 1912, 1876, 1802, 1655, 402, 361][i]!, [3120, 3120, 3120, 3120, 3120, 3120, 3120][i]!, [2204, 2480, 2611, 2390, 2015, 690, 588][i]!],
}));

type Args = { label: string; orientation: 'vertical' | 'horizontal'; highlight: string; height: number; tone: 'primary' | 'info'; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Bar chart',
  component: 'mm-bar-chart',
  args: { label: 'Failed runs per day', orientation: 'vertical', highlight: '21 Oct', height: 220, tone: 'primary', loading: false, error: '' },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] }, tone: { control: 'inline-radio', options: ['primary', 'info'] } },
  render: (a) => html`<mm-bar-chart
    label=${a.label}
    orientation=${a.orientation}
    highlight=${a.highlight}
    height=${a.height}
    tone=${a.tone}
    ?loading=${a.loading}
    error=${a.error}
    category-label="Day"
    value-label="Failed runs"
    .data=${failedRuns}
  ></mm-bar-chart>`,
  parameters: {
    usage: {
      html: `<mm-bar-chart id="agents" label="Queries per agent, last 24 hours" orientation="horizontal" sort="desc" highlight="support-triage-agent"></mm-bar-chart>
<script type="module">
  document.querySelector('#agents').data = [
    { label: 'support-triage-agent', value: 4812 },
    { label: 'revenue-forecast-agent', value: 2904 },
  ];
</script>`,
      react: `import { MmBarChart } from '@marmotdata/react';

<MmBarChart label="Failed runs per day" highlight="21 Oct" categoryLabel="Day" data={failedRuns} />
<MmBarChart label="Queries per agent, last 24 hours" orientation="horizontal" sort="desc" highlight="support-triage-agent" data={agents} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/bar-chart.js';
  let { failedRuns } = $props();
</script>

<mm-bar-chart label="Failed runs per day" highlight="21 Oct" category-label="Day" data={failedRuns}></mm-bar-chart>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const chart = (root: HTMLElement) => root.querySelector('mm-bar-chart') as MmBarChart;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('.frame')!.getAttribute('aria-label')).toBe(
      'Failed runs per day across 14 categories, highest 21 Oct at 9, lowest 16 Oct at 0, highlighted 21 Oct at 9.',
    );
    // Exactly one bar in the key colour; the estimated bar is hatched.
    await expect(sr.querySelectorAll('rect.key-bar').length).toBe(1);
    await expect(sr.querySelectorAll('rect.hatch').length).toBe(1);
  },
};

export const Horizontal: Story = {
  name: 'Horizontal ranked list',
  render: () => html`<mm-bar-chart
    label="Queries per agent, last 24 hours"
    orientation="horizontal"
    sort="desc"
    highlight="support-triage-agent"
    category-label="Agent"
    value-label="Queries"
    .data=${agents}
  ></mm-bar-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(el.shadowRoot!.querySelector('.frame'));
    await press('{ArrowDown}');
    await expect(el.activeIndex).toBe(0);
    await press('{ArrowDown}{ArrowDown}');
    await expect(el.activeIndex).toBe(2);
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items.map((i) => i.value)).toContain('catalog-steward-agent');
    await press('{ArrowUp}');
    await expect(el.activeIndex).toBe(1);
    await press('{Escape}');
    await expect(el.activeIndex).toBe(-1);
  },
};

export const Stacked: Story = {
  name: 'Stacked: two greys and one colour',
  render: () => html`<mm-bar-chart
    label="Queries per day by caller"
    category-label="Day"
    .stack=${['People', 'Scheduled', 'Agents']}
    .data=${byCaller}
  ></mm-bar-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelectorAll('rect.key-bar').length).toBe(7);
    await expect(sr.querySelector('text.key-label')!.textContent).toBe('Agents');
  },
};

export const StackedHorizontal: Story = {
  name: 'Stacked horizontal',
  render: () => html`<mm-bar-chart
    label="Queries this week by caller"
    orientation="horizontal"
    category-label="Source"
    .stack=${['People', 'Scheduled', 'Agents']}
    .data=${[
      { label: 'snowflake-prod', values: [4120, 9800, 6204] },
      { label: 'postgres-shop', values: [2210, 4120, 1880] },
      { label: 'bigquery-marketing', values: [1406, 2011, 940] },
    ]}
  ></mm-bar-chart>`,
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows move between bars',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await press('{ArrowRight}');
    await expect(el.activeIndex).toBe(0);
    await press('{End}');
    await expect(el.activeIndex).toBe(13);
    await expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('27 Oct');
    await press('{Home}');
    await expect(el.activeIndex).toBe(0);
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const r = el.shadowRoot!.querySelector('svg.plot')!.getBoundingClientRect();
    el.shadowRoot!.querySelector('.frame')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 100 }));
    await waitFor(() => expect(el.shadowRoot!.querySelector('mm-tooltip')!.open).toBe(true));
  },
};

export const Empty: Story = { render: () => html`<mm-bar-chart label="Failed runs per day" .data=${[]} empty-text="No pipeline runs in the last 14 days."></mm-bar-chart>` };
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Run history for postgres-shop could not be read.' } };
export const SingleBar: Story = { name: 'Single bar', render: () => html`<mm-bar-chart label="Failed runs today" .data=${[{ label: '27 Oct', value: 4 }]}></mm-bar-chart>` };
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-bar-chart
    label="Rows per table"
    orientation="horizontal"
    sort="desc"
    highlight="shop.public.orders"
    .data=${[
      { label: 'shop.public.orders', value: 1_284_019_442 },
      { label: 'analytics.orders_daily', value: 48_201_118 },
      { label: 'analytics.customers_dim', value: 3_118_402 },
      { label: 'marketing.campaign_touches_with_a_very_long_identifier', value: 912_004 },
    ]}
  ></mm-bar-chart>`,
};
export const Negative: Story = {
  name: 'Negative values',
  render: () => html`<mm-bar-chart
    label="Net change in assets per source this week"
    highlight="snowflake-prod"
    .data=${[
      { label: 'snowflake-prod', value: 214 },
      { label: 'postgres-shop', value: 41 },
      { label: 'kafka-events', value: -37 },
      { label: 'dbt-core', value: 18 },
      { label: 'looker', value: -12 },
    ]}
  ></mm-bar-chart>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: Horizontal.render };
export const BothThemes: Story = { render: (a, c) => themes(html`${meta.render!(a, c)}<div style="height:var(--space-6)"></div>${Horizontal.render!(a, c)}`) };
