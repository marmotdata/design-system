import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/loading.js';
import '@marmotdata/elements/progress.js';
import { topographyLines } from '../topography/field.ts';
import type { MmLoading } from './class.ts';

type Args = { active: boolean; caption: string; seed: number; density: 'sparse' | 'normal'; width: number; height: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const meta: Meta<Args> = {
  title: 'Components/Status/Loading',
  component: 'mm-loading',
  args: { active: true, caption: 'Surveying shop.orders.v2…', seed: 7, density: 'sparse', width: 160, height: 96 },
  argTypes: { density: { control: 'inline-radio', options: ['sparse', 'normal'] } },
  render: (a) =>
    html`<mm-loading ?active=${a.active} caption=${a.caption} seed=${a.seed} density=${a.density} width=${a.width} height=${a.height}></mm-loading>`,
  parameters: {
    usage: {
      html: `<mm-loading caption="Surveying shop.orders.v2…"></mm-loading>

<mm-loading caption="Cataloguing postgres-shop">
  <mm-progress hide-label label="Cataloguing assets" value="412" max="1280" unit="assets" readout-position="below"></mm-progress>
</mm-loading>`,
      react: `import { MmLoading, MmProgress } from '@marmotdata/react';

<MmLoading active={isLoading} caption="Surveying shop.orders.v2…" />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/loading.js';
  let loading = $state(true);
</script>

<mm-loading active={loading} caption="Surveying shop.orders.v2…"></mm-loading>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-loading')!;
    // Nothing is drawn for the first 200ms.
    await expect(el.shadowRoot!.querySelector('svg')).toBeNull();
    await waitFor(() => expect(el.shadowRoot!.querySelector('svg')).not.toBeNull());
    await expect(el.shadowRoot!.querySelectorAll('path').length).toBeGreaterThanOrEqual(5);
    await expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).toContain('Surveying shop.orders.v2…');
  },
};

export const WithProgress: Story = {
  name: 'Long operation with a count',
  render: () => html`<mm-loading caption="Cataloguing postgres-shop">
    <mm-progress hide-label label="Cataloguing assets" value="412" max="1280" unit="assets" readout-position="below"></mm-progress>
  </mm-loading>`,
};

export const IndexContours: Story = {
  name: 'Index contours',
  args: { density: 'normal', width: 240, height: 144, caption: '' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-loading')!;
    await waitFor(() => expect(el.shadowRoot!.querySelector('path.index')).not.toBeNull());
    // Deterministic: the same seed always draws the same field.
    await expect(topographyLines(7, 'normal')).toEqual(topographyLines(7, 'normal'));
  },
};

export const Finishes: Story = {
  name: 'Stays at least 400ms',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector<MmLoading>('mm-loading')!;
    await waitFor(() => expect(el.shadowRoot!.querySelector('svg')).not.toBeNull());
    el.active = false;
    await wait(100);
    await expect(el.shadowRoot!.querySelector('svg')).not.toBeNull();
    await waitFor(() => expect(el.shadowRoot!.querySelector('svg')).toBeNull());
  },
};

export const Inactive: Story = { name: 'Inactive (renders nothing)', args: { active: false } };

export const ReducedMotion: Story = {
  name: 'Reduced motion',
  globals: { motion: 'reduce' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-loading')!;
    await waitFor(() => expect(el.shadowRoot!.querySelector('path')).not.toBeNull());
    await expect(el).toHaveAttribute('data-still');
    await expect(getComputedStyle(el.shadowRoot!.querySelector('path')!).animationName).toBe('none');
  },
};

export const Seeds: Story = {
  name: 'Different sheets by seed',
  render: () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-6)">
    ${[1, 7, 12, 31].map((seed) => html`<mm-loading seed=${seed} caption=${`Sheet ${seed}`}></mm-loading>`)}
  </div>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:220px;border:1px dashed var(--mm-rule)">
    <mm-loading caption="Surveying mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel…"></mm-loading>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { caption: 'جارٍ مسح shop.orders.v2…' } };

export const BothThemes: Story = { render: () => themes(html`<mm-loading caption="Surveying shop.orders.v2…" density="normal" width="200" height="120"></mm-loading>`) };
