import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/area-chart.js';
import type { MmAreaChart } from './class.ts';
import type { ChartAnnotation } from '../line-chart/class.ts';

/** 90 days to 27 Oct 2026: weekday cataloguing, quiet weekends, and the Snowflake connection on 29 Sep. */
const days = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 6, 30 + i)).toISOString());
const catalogued = days.map((d, i) => {
  const dow = new Date(d).getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const base = 96 + Math.round(38 * Math.sin(i / 4.1) + 22 * Math.sin(i / 1.7));
  if (i === 61) return 2104;
  if (i === 62) return 846;
  return weekend ? Math.round(base * 0.28) : base + (i > 61 ? 40 : 0);
});
const annotations: ChartAnnotation[] = [
  { at: days[61]!, caption: 'Snowflake connected' },
  { type: 'range', from: days[40]!, to: days[47]!, caption: 'Kafka plugin paused 7 days' },
];

type Args = { label: string; name: string; height: number; tone: 'primary' | 'info'; estimated: number; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Area chart',
  component: 'mm-area-chart',
  args: { label: 'Assets catalogued per day', name: 'Catalogued', height: 240, tone: 'primary', estimated: 1, loading: false, error: '' },
  argTypes: { tone: { control: 'inline-radio', options: ['primary', 'info'] } },
  render: (a) => html`<mm-area-chart
    label=${a.label}
    name=${a.name}
    height=${a.height}
    tone=${a.tone}
    estimated=${a.estimated}
    ?loading=${a.loading}
    error=${a.error}
    x-label="Day"
    unit=""
    .x=${days}
    .values=${catalogued}
    .annotations=${annotations}
  ></mm-area-chart>`,
  parameters: {
    usage: {
      html: `<mm-area-chart id="catalogued" label="Assets catalogued per day" name="Catalogued" estimated="1"></mm-area-chart>
<script type="module">
  const chart = document.querySelector('#catalogued');
  chart.x = days;
  chart.values = catalogued;
  chart.annotations = [{ at: '2026-09-29', caption: 'Snowflake connected' }];
</script>`,
      react: `import { MmAreaChart } from '@marmotdata/react';

<MmAreaChart label="Assets catalogued per day" name="Catalogued" estimated={1} x={days} values={catalogued} annotations={annotations} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/area-chart.js';
  let { days, catalogued } = $props();
</script>

<mm-area-chart label="Assets catalogued per day" name="Catalogued" estimated={1} x={days} values={catalogued}></mm-area-chart>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const chart = (root: HTMLElement) => root.querySelector('mm-area-chart') as MmAreaChart;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('.frame')!.getAttribute('aria-label')).toMatch(/^Assets catalogued per day over 90 days, peaking at 2,104 at 29 Sept?/);
    // One flat tint, no gradient anywhere.
    await expect(sr.querySelectorAll('path.key-area').length).toBe(1);
    await expect(sr.querySelector('linearGradient, radialGradient')).toBeNull();
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const r = el.shadowRoot!.querySelector('svg.plot')!.getBoundingClientRect();
    el.shadowRoot!.querySelector('.frame')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width * 0.3, clientY: r.top + 100 }));
    await waitFor(() => expect(el.shadowRoot!.querySelector('mm-tooltip')!.open).toBe(true));
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows move between days',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(el.shadowRoot!.querySelector('.frame'));
    await press('{ArrowLeft}');
    await expect(el.activeIndex).toBe(89);
    await press('{ArrowLeft}');
    await expect(el.activeIndex).toBe(88);
    await press('{Escape}');
    await expect(el.activeIndex).toBe(-1);
  },
};

export const Empty: Story = {
  render: () => html`<mm-area-chart label="Assets catalogued per day" .x=${[]} .values=${[]} empty-text="No assets have been catalogued from this source yet. Add a plugin to catalogue it."></mm-area-chart>`,
};
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'The catalog API returned 503 for /api/v1/metrics/assets.' } };
export const SinglePoint: Story = {
  name: 'Single point',
  render: () => html`<mm-area-chart label="Assets catalogued per day" .x=${[days[89]!]} .values=${[184]}></mm-area-chart>`,
};
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-area-chart label="Rows ingested per day" name="Rows" .x=${days.slice(-30)} .values=${catalogued.slice(-30).map((v) => v * 4_812_019)}></mm-area-chart>`,
};
export const Slate: Story = { name: 'Slate key series', args: { tone: 'info' } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a, c) => themes(meta.render!(a, c)) };
