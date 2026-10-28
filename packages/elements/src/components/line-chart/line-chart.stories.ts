import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/line-chart.js';
import type { ChartAnnotation, LineSeries, MmLineChart } from './class.ts';

/** 27 Oct 2026, hourly, UTC. */
const hours = Array.from({ length: 24 }, (_, i) => `2026-10-27T${String(i).padStart(2, '0')}:00:00Z`);
const queries = [212, 168, 141, 126, 133, 187, 342, 561, 806, 948, 1012, 1067, 1104, 1158, 1284, 1231, 1096, 1003, 874, 702, 561, 432, 338, 186];
const lastWeek = [198, 171, 133, 118, 140, 176, 311, 528, 744, 902, 961, 988, 1021, 1046, 1077, 1052, 990, 911, 802, 655, 520, 401, 322, 251];
const series: LineSeries[] = [
  { name: 'Last week', values: lastWeek },
  { name: 'Queries', values: queries, key: true },
];
const annotations: ChartAnnotation[] = [
  { at: '2026-10-27T07:00:00Z', caption: 'Snowflake warehouse resize' },
  { type: 'range', from: '2026-10-27T14:00:00Z', to: '2026-10-27T15:30:00Z', caption: 'Incident 14:00–15:30' },
];

type Args = { label: string; height: number; tone: 'primary' | 'info'; estimated: number; area: boolean; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Line chart',
  component: 'mm-line-chart',
  args: { label: 'Queries per hour', height: 240, tone: 'primary', estimated: 1, area: false, loading: false, error: '' },
  argTypes: { tone: { control: 'inline-radio', options: ['primary', 'info'] } },
  render: (a) => html`<mm-line-chart
    label=${a.label}
    height=${a.height}
    tone=${a.tone}
    estimated=${a.estimated}
    ?area=${a.area}
    ?loading=${a.loading}
    error=${a.error}
    x-label="Hour"
    .x=${hours}
    .series=${series}
    .annotations=${annotations}
  ></mm-line-chart>`,
  parameters: {
    usage: {
      html: `<mm-line-chart id="queries" label="Queries per hour" estimated="1" x-label="Hour"></mm-line-chart>
<script type="module">
  const chart = document.querySelector('#queries');
  chart.x = hours; // ISO strings, Dates or numbers
  chart.series = [
    { name: 'Last week', values: lastWeek },
    { name: 'Queries', values: queries, key: true },
  ];
  chart.annotations = [
    { at: '2026-10-27T07:00:00Z', caption: 'Snowflake warehouse resize' },
    { type: 'range', from: '2026-10-27T14:00:00Z', to: '2026-10-27T15:30:00Z', caption: 'Incident 14:00–15:30' },
  ];
</script>`,
      react: `import { MmLineChart } from '@marmotdata/react';

<MmLineChart
  label="Queries per hour"
  estimated={1}
  xLabel="Hour"
  x={hours}
  series={[{ name: 'Last week', values: lastWeek }, { name: 'Queries', values: queries, key: true }]}
  annotations={annotations}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/line-chart.js';
  let { hours, series, annotations } = $props();
</script>

<mm-line-chart label="Queries per hour" estimated={1} x-label="Hour" x={hours} {series} {annotations}></mm-line-chart>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const chart = (root: HTMLElement) => root.querySelector('mm-line-chart') as MmLineChart;
const frame = (root: HTMLElement) => chart(root).shadowRoot!.querySelector<HTMLElement>('.frame')!;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await expect(frame(canvasElement).getAttribute('aria-label')).toBe(
      'Queries per hour over 24 hours, peaking at 1,284 at 14:00, latest 186 (estimated), shown against Last week.',
    );
    // Grey first: one key line, at most three gridlines, no legend.
    const sr = el.shadowRoot!;
    await expect(sr.querySelectorAll('path.key:not(.est)').length).toBe(1);
    await expect(sr.querySelectorAll('.grid').length).toBeLessThanOrEqual(4);
    await expect(sr.querySelector('table caption')!.textContent).toBe('Queries per hour');
    await expect(sr.querySelectorAll('tbody tr').length).toBe(24);
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const svgEl = el.shadowRoot!.querySelector('svg.plot')!;
    const r = svgEl.getBoundingClientRect();
    frame(canvasElement).dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width * 0.55, clientY: r.top + 60 }));
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(el.activeIndex).toBeGreaterThan(0);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows move between points',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(frame(canvasElement));
    await press('{ArrowRight}');
    await expect(el.activeIndex).toBe(0);
    await press('{ArrowRight}{ArrowRight}');
    await expect(el.activeIndex).toBe(2);
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items.map((i) => i.value)).toContain('141');
    await expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Queries 141');
    await press('{End}');
    await expect(el.activeIndex).toBe(23);
    await expect(tip.items.some((i) => i.value === 'Estimated')).toBe(true);
    await press('{ArrowLeft}');
    await expect(el.activeIndex).toBe(22);
    await press('{Home}');
    await expect(el.activeIndex).toBe(0);
    await press('{Escape}');
    await expect(el.activeIndex).toBe(-1);
    await waitFor(() => expect(tip.open).toBe(false));
  },
};

export const InfoTone: Story = { name: 'Slate key series', args: { tone: 'info' } };
export const WithArea: Story = { name: 'Key series with a flat tint', args: { area: true } };

export const Empty: Story = {
  render: () => html`<mm-line-chart label="Queries per hour" .x=${[]} .series=${[]} empty-text="No queries have run against this source in the last 24 hours."></mm-line-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('.message')!.textContent).toContain('No queries have run');
  },
};
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'The query audit service did not respond. Try again in a minute.' } };

export const SinglePoint: Story = {
  name: 'Single point',
  render: () => html`<mm-line-chart label="Queries per hour" .x=${['2026-10-27T14:00:00Z']} .series=${[{ name: 'Queries', values: [1284], key: true }]}></mm-line-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await expect(frame(canvasElement).getAttribute('aria-label')).toBe('Queries per hour: 1,284 at 14:00.');
  },
};

const days = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 14 + i)).toISOString());
const scanned = [1.21e9, 1.18e9, 1.32e9, 1.29e9, 1.41e9, 0.62e9, 0.58e9, 1.37e9, 1.44e9, 1.52e9, 2.84e9, 1.49e9, 0.71e9, 0.66e9];
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-line-chart
    label="Rows scanned per day"
    .x=${days}
    .series=${[
      { name: 'p50 warehouse', values: scanned.map((v) => Math.round(v * 0.42)) },
      { name: 'Rows scanned', values: scanned, key: true },
    ]}
    .annotations=${[{ at: days[10]!, caption: 'Backfill of orders_daily' }]}
  ></mm-line-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await expect(frame(canvasElement).getAttribute('aria-label')).toContain('peaking at 2.84B at 24 Oct');
  },
};

export const Negative: Story = {
  name: 'Negative values',
  render: () => html`<mm-line-chart
    label="Net change in catalogued assets per day"
    .x=${days}
    .series=${[{ name: 'Net change', values: [214, 96, -37, 12, 140, -212, 8, 61, 33, -18, 402, 27, -4, 15], key: true }]}
  ></mm-line-chart>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a, c) => themes(meta.render!(a, c)) };
