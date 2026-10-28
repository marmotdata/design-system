import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/sparkline.js';
import type { MmSparkline } from './class.ts';

const queries = [212, 168, 141, 126, 133, 187, 342, 561, 806, 948, 1012, 1067, 1104, 1158, 1284, 1231, 1096, 1003, 874, 702, 561, 432, 338, 486];

type Args = { label: string; unit: string; hideValue: boolean; tone: 'primary' | 'info' };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Sparkline',
  component: 'mm-sparkline',
  args: { label: 'Queries per hour, last 24 hours', unit: '', hideValue: false, tone: 'primary' },
  argTypes: { tone: { control: 'inline-radio', options: ['primary', 'info'] } },
  render: (a) => html`<mm-sparkline label=${a.label} unit=${a.unit} ?hide-value=${a.hideValue} tone=${a.tone} .values=${queries}></mm-sparkline>`,
  parameters: {
    usage: {
      html: `<mm-sparkline label="Queries per hour, last 24 hours" values="[212,168,141,126,133,187,342,561,806,948,1012,1067,1104,1158,1284,1231,1096,1003,874,702,561,432,338,486]"></mm-sparkline>`,
      react: `import { MmSparkline } from '@marmotdata/react';

<MmSparkline label="p99 latency, last 14 days" unit="ms" values={latency} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/sparkline.js';
  let { latency } = $props();
</script>

<mm-sparkline label="p99 latency, last 14 days" unit="ms" values={latency}></mm-sparkline>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const spark = (root: HTMLElement) => root.querySelector('mm-sparkline') as MmSparkline;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = spark(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Queries per hour, last 24 hours: low 126, high 1,284, latest 486');
    const svgEl = sr.querySelector('svg')!;
    await expect(svgEl.getAttribute('width')).toBe('64');
    await expect(svgEl.getAttribute('height')).toBe('16');
    // The last point is a 3px dot, and its value is printed beside it.
    await expect(sr.querySelector('circle')!.getAttribute('r')).toBe('1.5');
    await expect(sr.querySelector('.value')!.textContent).toBe('486');
  },
};

export const InASentence: Story = {
  name: 'In a sentence and a table',
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:560px">
    <p style="margin:0;font:var(--text-body)">p99 latency on <code style="font:var(--text-mono)">orders_daily</code> has settled
      <mm-sparkline label="p99 latency, last 14 days" unit="ms" .values=${[612, 598, 640, 588, 571, 530, 512, 498, 470, 452, 441, 433, 425, 418]}></mm-sparkline>
      since the warehouse resize.</p>
    <table style="border-collapse:collapse;font:var(--text-dense);width:100%">
      <thead><tr><th style="text-align:start;font:var(--text-label);color:var(--mm-text-2);padding:8px">Asset</th><th style="text-align:end;font:var(--text-label);color:var(--mm-text-2);padding:8px">Queries, last 24h</th></tr></thead>
      <tbody>
        ${[
          ['orders_daily', [44, 52, 61, 70, 88, 92, 130, 121]],
          ['customers_dim', [31, 30, 29, 33, 35, 32, 30, 34]],
          ['shop.orders.v2', [12, 18, 9, 22, 16, 24, 19, 27]],
        ].map(
          ([name, v]) => html`<tr style="border-top:1px solid var(--mm-rule)"><td style="padding:8px;font:var(--text-mono-dense)">${name}</td><td style="padding:8px;text-align:end"><mm-sparkline label=${`Queries per 3 hours on ${name}`} .values=${v}></mm-sparkline></td></tr>`,
        )}
      </tbody>
    </table>
  </div>`,
};

export const WithUnit: Story = { name: 'With a unit', render: () => html`<mm-sparkline label="p99 latency, last 14 days" unit="ms" .values=${[612, 598, 640, 588, 571, 530, 512, 498, 470, 452, 441, 433, 425, 418]}></mm-sparkline>` };
export const HiddenValue: Story = { name: 'Value hidden (KPI tiles)', args: { hideValue: true } };
export const Empty: Story = {
  render: () => html`<mm-sparkline label="Queries per hour, last 24 hours" .values=${[]}></mm-sparkline>`,
  play: async ({ canvasElement }) => {
    const el = spark(canvasElement);
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Queries per hour, last 24 hours: no data');
  },
};
export const SinglePoint: Story = { name: 'Single point', render: () => html`<mm-sparkline label="Refused queries today" .values=${[37]}></mm-sparkline>` };
export const Gaps: Story = { name: 'Gaps in the data', render: () => html`<mm-sparkline label="Freshness lag, minutes" unit="min" .values=${[4, 5, 3, null, null, 6, 8, 5, 4]}></mm-sparkline>` };
export const LargeNumbers: Story = { name: 'Very large numbers', render: () => html`<mm-sparkline label="Rows in orders_daily" .values=${[1_102_884_120, 1_154_002_418, 1_201_448_903, 1_284_019_442]}></mm-sparkline>` };
export const Negative: Story = {
  name: 'Negative values',
  render: () => html`<mm-sparkline label="Net change in catalogued assets per day" .values=${[214, 96, -37, 12, 140, -212, 8, 61, -18]}></mm-sparkline>`,
  play: async ({ canvasElement }) => {
    const el = spark(canvasElement);
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('low −212');
    await expect(el.shadowRoot!.querySelector('.zero')).not.toBeNull();
  },
};
export const Slate: Story = { name: 'Slate dot', args: { tone: 'info' } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: () => themes(InASentence.render!({} as Args, {} as never)) };
