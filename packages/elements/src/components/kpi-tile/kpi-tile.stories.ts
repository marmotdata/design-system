import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/kpi-tile.js';
import type { MmKpiTile } from './class.ts';

const queries = [212, 168, 141, 126, 133, 187, 342, 561, 806, 948, 1012, 1067, 1104, 1158, 1284, 1231, 1096, 1003, 874, 702, 561, 432, 338, 486];

type Args = { label: string; value: string; delta: number; context: string; trend: 'good' | 'bad' | 'neutral'; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/KPI tile',
  component: 'mm-kpi-tile',
  args: { label: 'Queries in last 24h', value: '12480', delta: 1204, context: 'on yesterday', trend: 'neutral', loading: false, error: '' },
  argTypes: { trend: { control: 'inline-radio', options: ['good', 'bad', 'neutral'] } },
  render: (a) => html`<mm-kpi-tile
    label=${a.label}
    value=${a.value}
    delta=${a.delta}
    context=${a.context}
    trend=${a.trend}
    ?loading=${a.loading}
    error=${a.error}
    .spark=${queries}
  ></mm-kpi-tile>`,
  parameters: {
    usage: {
      html: `<mm-kpi-row label="Last 24 hours">
  <mm-kpi-tile label="Queries in last 24h" value="12480" delta="1204" context="on yesterday" spark="[212,168,141,126,133]"></mm-kpi-tile>
  <mm-kpi-tile label="Active agents" value="14" context="across 6 domains"></mm-kpi-tile>
  <mm-kpi-tile label="Refused" value="37" delta="12" context="since yesterday" trend="bad"></mm-kpi-tile>
  <mm-kpi-tile label="Catalogued assets" value="24059" context="from 9 sources"></mm-kpi-tile>
</mm-kpi-row>`,
      react: `import { MmKpiRow, MmKpiTile } from '@marmotdata/react';

<MmKpiRow label="Last 24 hours">
  <MmKpiTile label="Queries in last 24h" value={12480} delta={1204} context="on yesterday" spark={queriesPerHour} />
  <MmKpiTile label="Refused" value={37} delta={12} context="since yesterday" trend="bad" />
</MmKpiRow>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/kpi-tile.js';
  let { queriesPerHour } = $props();
</script>

<mm-kpi-row label="Last 24 hours">
  <mm-kpi-tile label="Queries in last 24h" value={12480} delta={1204} context="on yesterday" spark={queriesPerHour}></mm-kpi-tile>
  <mm-kpi-tile label="Refused" value={37} delta={12} context="since yesterday" trend="bad"></mm-kpi-tile>
</mm-kpi-row>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const row = (loading = false) => html`<mm-kpi-row label="Last 24 hours" style="max-width:960px">
  <mm-kpi-tile label="Queries in last 24h" value="12480" delta="1204" context="on yesterday" .spark=${queries} ?loading=${loading}></mm-kpi-tile>
  <mm-kpi-tile label="Active agents" value="14" context="across 6 domains" ?loading=${loading}></mm-kpi-tile>
  <mm-kpi-tile label="Refused" value="37" delta="12" context="since yesterday" trend="bad" ?loading=${loading}></mm-kpi-tile>
  <mm-kpi-tile label="Catalogued assets" value="24059" delta="214" context="this week from 9 sources" ?loading=${loading}></mm-kpi-tile>
</mm-kpi-row>`;

export const Row: Story = {
  name: 'KPI row',
  render: () => row(),
  play: async ({ canvasElement }) => {
    const tiles = [...canvasElement.querySelectorAll('mm-kpi-tile')] as MmKpiTile[];
    await Promise.all(tiles.map((t) => t.updateComplete));
    const value = (t: MmKpiTile) => t.shadowRoot!.querySelector('.value')!.textContent!.trim();
    await expect(value(tiles[0]!)).toBe('12,480');
    await expect(value(tiles[3]!)).toBe('24,059');
    const delta = tiles[2]!.shadowRoot!.querySelector('.delta')!;
    await expect(delta.textContent).toBe('+12');
    await expect(delta.classList.contains('bad')).toBe(true);
    // Neutral deltas are not coloured, and there are no arrows anywhere.
    await expect(tiles[0]!.shadowRoot!.querySelector('.delta')!.className.trim()).toBe('delta');
    await expect(canvasElement.textContent!.match(/[↑↓▲▼]/)).toBeNull();
    await expect(tiles[0]!.shadowRoot!.querySelector('mm-sparkline')).not.toBeNull();
  },
};

export const Default: Story = { name: 'Single tile' };
export const Good: Story = {
  name: 'Good news',
  render: () => html`<mm-kpi-tile label="Assets with an owner" value="87%" delta="3" delta-unit="points" context="since September" trend="good"></mm-kpi-tile>`,
};
export const Negative: Story = {
  name: 'Negative delta',
  render: () => html`<mm-kpi-tile label="p99 query latency" value="418" unit="ms" delta="-194" delta-unit="ms" context="since the warehouse resize" trend="good"></mm-kpi-tile>`,
  play: async ({ canvasElement }) => {
    const t = canvasElement.querySelector('mm-kpi-tile') as MmKpiTile;
    await t.updateComplete;
    await expect(t.shadowRoot!.querySelector('.delta')!.textContent).toBe('−194 ms');
  },
};
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-kpi-row style="max-width:720px">
    <mm-kpi-tile label="Rows scanned this month" value="1284019442" compact delta="214000000" context="on September"></mm-kpi-tile>
    <mm-kpi-tile label="Rows in shop.public.orders" value="1284019442" context="updated 04:12 UTC"></mm-kpi-tile>
  </mm-kpi-row>`,
};
export const Loading: Story = { render: () => row(true) };
export const ErrorState: Story = { name: 'Error', args: { error: 'Query audit is unavailable.' } };
export const Empty: Story = { render: () => html`<mm-kpi-tile label="Refused" value="" context="No queries have been checked by a policy yet."></mm-kpi-tile>` };
export const Narrow: Story = { name: 'Wrapping on narrow screens', render: () => html`<div style="max-width:420px">${row()}</div>` };
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => row() };
export const BothThemes: Story = { render: () => themes(row()) };
