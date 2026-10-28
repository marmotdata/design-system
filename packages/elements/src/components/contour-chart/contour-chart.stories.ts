import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/contour-chart.js';
import type { ContourMark, DensityPoint, MmContourChart } from './class.ts';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
const g = (h: number, mu: number, s: number) => Math.exp(-((h - mu) ** 2) / (2 * s * s));
const dayFactor = [0.92, 1, 0.97, 0.94, 0.8, 0.3, 0.26];
/** Query heat for the week to 27 Oct 2026: office hours on weekdays and the nightly dbt run at 02:00. */
const raw = weekdays.map((_, r) => hourLabels.map((_, c) => dayFactor[r]! * (0.07 + 0.55 * g(c, 10, 2.3) + 0.92 * g(c, 14.5, 2.1)) + 0.3 * g(c, 2, 0.9)));
const peak = Math.max(...raw.flat());
const heat = raw.map((row) => row.map((v) => Math.round((v / peak) * 1284)));
const marks: ContourMark[] = [
  { x: 14, y: 1, label: 'Peak 1,284 Tue 14:00' },
  { x: 2, y: 5, label: 'Nightly dbt run' },
];

type Args = { label: string; bands: number; height: number; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Contour chart',
  component: 'mm-contour-chart',
  args: { label: 'Query heat by hour and weekday', bands: 5, height: 260, loading: false, error: '' },
  argTypes: { bands: { control: { type: 'range', min: 4, max: 6, step: 1 } } },
  render: (a) => html`<mm-contour-chart
    label=${a.label}
    bands=${a.bands}
    height=${a.height}
    ?loading=${a.loading}
    error=${a.error}
    unit="queries"
    x-name="Hour (UTC)"
    y-name="Day"
    .grid=${heat}
    .xLabels=${hourLabels}
    .yLabels=${weekdays}
    .marks=${marks}
  ></mm-contour-chart>`,
  parameters: {
    docs: {
      description: {
        component:
          'For summary views only, never behind working data such as tables, forms or the lineage canvas.',
      },
    },
    usage: {
      html: `<mm-contour-chart id="heat" label="Query heat by hour and weekday" unit="queries" x-name="Hour (UTC)" y-name="Day"></mm-contour-chart>
<script type="module">
  const chart = document.querySelector('#heat');
  chart.grid = heat; // 7 rows (Mon to Sun) × 24 columns (hours)
  chart.xLabels = hours; // '00:00' … '23:00'
  chart.yLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  chart.marks = [{ x: 14, y: 1, label: 'Peak 1,284 Tue 14:00' }];
</script>`,
      react: `import { MmContourChart } from '@marmotdata/react';

<MmContourChart label="Query heat by hour and weekday" unit="queries" xName="Hour (UTC)" yName="Day"
  grid={heat} xLabels={hours} yLabels={weekdays} marks={marks} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/contour-chart.js';
  let { heat, hours, weekdays, marks } = $props();
</script>

<mm-contour-chart label="Query heat by hour and weekday" unit="queries" x-name="Hour (UTC)" y-name="Day"
  grid={heat} xLabels={hours} yLabels={weekdays} {marks}></mm-contour-chart>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const chart = (root: HTMLElement) => root.querySelector('mm-contour-chart') as MmContourChart;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('.frame')!.getAttribute('aria-label')).toMatch(/^Query heat by hour and weekday: highest 1,284 queries on Tue at 14:00, lowest/);
    // Isolines in the contour colours, with the heaviest band as the index contour and labelled.
    await expect(sr.querySelectorAll('path.iso').length).toBeGreaterThanOrEqual(5);
    await expect(sr.querySelectorAll('path.iso.index').length).toBeGreaterThanOrEqual(1);
    await expect(sr.querySelector('text.iso-label')).not.toBeNull();
    await expect(sr.querySelectorAll('tbody tr').length).toBe(7);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows move a cross-hair',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(el.shadowRoot!.querySelector('.frame'));
    await press('{ArrowRight}');
    await expect(el.activeIndex).toBe(0);
    await press('{ArrowDown}');
    await expect(el.activeIndex).toBe(24);
    await press('{End}');
    await expect(el.activeIndex).toBe(47);
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items.map((i) => i.value)).toEqual(expect.arrayContaining(['Tue', '23:00']));
    await expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Tue 23:00');
    await press('{ArrowUp}{ArrowLeft}');
    await expect(el.activeIndex).toBe(22);
    await press('{Escape}');
    await expect(el.activeIndex).toBe(-1);
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const r = el.shadowRoot!.querySelector('svg.plot')!.getBoundingClientRect();
    el.shadowRoot!.querySelector('.frame')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width * 0.6, clientY: r.top + 60 }));
    await waitFor(() => expect(el.shadowRoot!.querySelector('mm-tooltip')!.open).toBe(true));
  },
};

export const FourBands: Story = { name: 'Four bands', args: { bands: 4 } };
export const SixBands: Story = { name: 'Six bands', args: { bands: 6 } };

function rand(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = rand(42);
const normal = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
/** Assets by downstream dependants and daily queries: most are leaves; a few marts carry the load. */
const cluster = (n: number, x: number, y: number, sx: number, sy: number) =>
  Array.from({ length: n }, () => ({ x: x + normal() * sx, y: y + normal() * sy })).filter((p) => p.x > 0 && p.x < 32 && p.y > 0 && p.y < 480);
const usage: DensityPoint[] = [...cluster(420, 6, 90, 2.6, 34), ...cluster(260, 15, 220, 2.8, 40), ...cluster(150, 25, 370, 2.2, 36)];

export const Density: Story = {
  name: 'Density of points',
  render: () => html`<mm-contour-chart
    label="Asset usage by downstream dependants"
    x-name="Downstream assets"
    y-name="Queries per day"
    .points=${usage}
    .xDomain=${[0, 32]}
    .yDomain=${[0, 480]}
    .marks=${[
      { x: 25, y: 372, label: 'orders_daily' },
      { x: 15, y: 222, label: 'customers_dim' },
    ]}
  ></mm-contour-chart>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    await tab();
    await press('{ArrowRight}');
    await expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('orders_daily');
  },
};

export const Empty: Story = {
  render: () => html`<mm-contour-chart label="Query heat by hour and weekday" .grid=${[]} empty-text="No queries have been audited this week."></mm-contour-chart>`,
};
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Query audit has not finished aggregating this week.' } };
export const SingleCell: Story = { name: 'Single point', render: () => html`<mm-contour-chart label="Query heat" .grid=${[[1284]]} .xLabels=${['14:00']} .yLabels=${['Tue']}></mm-contour-chart>` };
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-contour-chart label="Rows scanned by hour and weekday" .grid=${heat.map((r) => r.map((v) => v * 1_284_019))} .xLabels=${hourLabels} .yLabels=${weekdays}></mm-contour-chart>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a, c) => themes(meta.render!({ ...a, height: 220 }, c)) };

export const LabelsClearOfLines: Story = {
  name: 'Labels clear of the index contour',
  render: (a, c) => html`<div style="width:1100px;max-width:100%">${meta.render!(a, c)}</div>`,
  play: async ({ canvasElement }) => {
    const el = chart(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const index = [...sr.querySelectorAll<SVGPathElement>('path.iso.index')];
    const labels = [...sr.querySelectorAll<SVGTextElement>('text.ann, text.iso-label')];
    await expect(labels.length).toBe(3);
    const svgEl = sr.querySelector<SVGSVGElement>('svg.plot')!;
    for (const t of labels) {
      // Labels carry a ground-coloured halo.
      await expect(getComputedStyle(t).paintOrder).toContain('stroke');
      const b = t.getBBox();
      for (const p of index) {
        const len = p.getTotalLength();
        for (let s = 0; s <= len; s += 2) {
          const pt = p.getPointAtLength(s);
          const inside = pt.x > b.x + 1 && pt.x < b.x + b.width - 1 && pt.y > b.y + 1 && pt.y < b.y + b.height - 1;
          await expect(inside, `${t.textContent} over the index contour`).toBe(false);
        }
      }
    }
    void svgEl;
  },
};
