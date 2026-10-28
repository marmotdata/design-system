import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/progress.js';

type Args = { value: number; max: number; label: string; unit: string; readout: string; indeterminate: boolean; hideLabel: boolean };

const meta: Meta<Args> = {
  title: 'Components/Status/Progress',
  component: 'mm-progress',
  args: { value: 412, max: 1280, label: 'Cataloguing assets', unit: 'assets', readout: 'count', indeterminate: false, hideLabel: false },
  argTypes: {
    readout: { control: 'inline-radio', options: ['count', 'percent', 'none'] },
    value: { control: { type: 'range', min: 0, max: 1280, step: 1 } },
  },
  render: (a) => html`<div style="max-width:360px">
    <mm-progress value=${a.value} max=${a.max} label=${a.label} unit=${a.unit} readout=${a.readout} ?indeterminate=${a.indeterminate} ?hide-label=${a.hideLabel}></mm-progress>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-progress label="Cataloguing assets" value="412" max="1280" unit="assets"></mm-progress>`,
      react: `import { MmProgress } from '@marmotdata/react';

<MmProgress label="Cataloguing assets" value={run.done} max={run.total} unit="assets" />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/progress.js';
  let { run } = $props();
</script>

<mm-progress label="Cataloguing assets" value={run.done} max={run.total} unit="assets"></mm-progress>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('mm-progress')!.shadowRoot!.querySelector('[role="progressbar"]')!;
    await expect(bar).toHaveAttribute('aria-valuenow', '412');
    await expect(bar).toHaveAttribute('aria-valuemax', '1280');
    await expect(bar).toHaveAttribute('aria-valuemin', '0');
    await expect(bar).toHaveAttribute('aria-valuetext', '412 of 1,280 assets');
    await expect(bar).toHaveAttribute('aria-label', 'Cataloguing assets');
    await expect(canvasElement.querySelector('mm-progress')!.shadowRoot!.querySelector('.readout')!.textContent).toBe('412 / 1,280 assets');
  },
};

export const Percentage: Story = { args: { readout: 'percent', label: 'Uploading lineage export', value: 64, max: 100, unit: '' } };

export const Indeterminate: Story = {
  args: { indeterminate: true, label: 'Connecting to snowflake-prod' },
  play: async ({ canvasElement }) => {
    const bar = canvasElement.querySelector('mm-progress')!.shadowRoot!.querySelector('[role="progressbar"]')!;
    await expect(bar).not.toHaveAttribute('aria-valuenow');
  },
};

export const ReducedMotion: Story = { name: 'Reduced motion', globals: { motion: 'reduce' }, args: { indeterminate: true, label: 'Connecting to snowflake-prod' } };

export const Empty: Story = { name: 'Empty (not started)', args: { value: 0, label: 'Waiting for the first run' } };
export const Complete: Story = { args: { value: 1280 } };

export const Loading: Story = {
  name: 'In a loading state',
  render: () => html`<div style="display:grid;gap:var(--space-2);justify-items:center">
    <mm-progress style="--mm-progress-width:240px" hide-label label="Cataloguing assets from postgres-shop" value="412" max="1280" unit="assets" readout-position="below"></mm-progress>
  </div>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="max-width:260px">
    <mm-progress label="Inferring lineage for mrn://postgresql/table/shop.public.orders_daily_rollup" value="1031" max="1284019" unit="queries"></mm-progress>
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="max-width:360px">
    <mm-progress label="فهرسة الأصول" value="412" max="1280" unit="أصول"></mm-progress>
  </div>`,
};

const set = () => html`<div style="display:grid;gap:var(--space-4);max-width:320px">
  <mm-progress label="Cataloguing assets" value="412" max="1280" unit="assets"></mm-progress>
  <mm-progress label="Uploading lineage export" value="64" readout="percent"></mm-progress>
  <mm-progress label="Connecting to snowflake-prod" indeterminate></mm-progress>
</div>`;
export const BothThemes: Story = { render: () => themes(set()) };
