import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/skeleton.js';
import type { MmSkeleton } from './class.ts';

type Args = { loading: boolean; shape: string; count: number; columns: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const assetSummary = html`<p style="margin:0;font:var(--text-body);max-width:60ch">
  Daily order totals per region, rolled up from <code>shop.public.orders</code> at 04:00 UTC. Owned by Analytics Engineering;
  1,284,019 rows.
</p>`;

const meta: Meta<Args> = {
  title: 'Components/Status/Skeleton',
  component: 'mm-skeleton',
  args: { loading: true, shape: 'text', count: 3, columns: 4 },
  argTypes: { shape: { control: 'inline-radio', options: ['text', 'rect', 'circle', 'table-row'] } },
  render: (a) => html`<div style="max-width:520px">
    <mm-skeleton ?loading=${a.loading} shape=${a.shape} count=${a.count} columns=${a.columns}>${assetSummary}</mm-skeleton>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-skeleton loading shape="text" count="3">
  <p>Daily order totals per region…</p>
</mm-skeleton>`,
      react: `import { MmSkeleton } from '@marmotdata/react';

<MmSkeleton loading={isLoading} shape="table-row" count={5} columns={4}>
  <AssetTable rows={rows} />
</MmSkeleton>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/skeleton.js';
  let { asset } = $props();
</script>

<mm-skeleton loading={!asset} shape="text" count="3">
  {#if asset}<p>{asset.description}</p>{/if}
</mm-skeleton>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Loading: Story = {
  play: async ({ canvasElement }) => {
    const sk = canvasElement.querySelector('mm-skeleton')!;
    const busy = sk.shadowRoot!.querySelector('[part="base"]')!;
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    // Nothing for the first 200ms, so fast loads never flash.
    await expect(sk.shadowRoot!.querySelector('.ph')).toBeNull();
    await waitFor(() => expect(sk.shadowRoot!.querySelector('.ph')).not.toBeNull());
  },
};

export const Loaded: Story = { args: { loading: false } };

export const SwapsIn: Story = {
  name: 'Swaps in the real content',
  play: async ({ canvasElement }) => {
    const sk = canvasElement.querySelector<MmSkeleton>('mm-skeleton')!;
    await waitFor(() => expect(sk.shadowRoot!.querySelector('.ph')).not.toBeNull());
    sk.loading = false;
    await wait(100);
    // Held for at least 400ms once shown.
    await expect(sk.shadowRoot!.querySelector('.ph')).not.toBeNull();
    await waitFor(() => expect(sk.shadowRoot!.querySelector('.ph')).toBeNull());
    await expect(sk.shadowRoot!.querySelector('[part="base"]')).toHaveAttribute('aria-busy', 'false');
  },
};

export const FastLoad: Story = {
  name: 'Fast load never flashes',
  play: async ({ canvasElement }) => {
    const sk = canvasElement.querySelector<MmSkeleton>('mm-skeleton')!;
    await wait(80);
    sk.loading = false;
    await wait(250);
    await expect(sk.shadowRoot!.querySelector('.ph')).toBeNull();
  },
};

const shapes = () => html`<div style="display:grid;gap:var(--space-6);max-width:560px">
  <div style="display:flex;gap:var(--space-3);align-items:center">
    <mm-skeleton loading shape="circle"></mm-skeleton>
    <mm-skeleton loading shape="text" count="1" style="flex:1"></mm-skeleton>
  </div>
  <mm-skeleton loading shape="text" count="4"></mm-skeleton>
  <mm-skeleton loading shape="rect" style="--mm-skeleton-height:120px"></mm-skeleton>
  <mm-skeleton loading shape="table-row" count="4" columns="4"></mm-skeleton>
</div>`;

export const Shapes: Story = { render: shapes };

export const TableRows: Story = {
  name: 'Table rows',
  render: () => html`<div style="max-width:640px;border:1px solid var(--mm-rule);border-radius:var(--radius-md);background:var(--mm-surface)">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);padding:0 var(--space-3);height:32px;align-items:center;background:var(--mm-sunken);font:var(--text-label);color:var(--mm-text-2);border-bottom:1px solid var(--mm-rule)">
      <span>Name</span><span>Owner</span><span>Updated</span><span style="text-align:end">Rows</span>
    </div>
    <mm-skeleton loading shape="table-row" count="5" columns="4"></mm-skeleton>
  </div>`,
};

export const ReducedMotion: Story = { name: 'Reduced motion', globals: { motion: 'reduce' }, render: shapes };

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: shapes };

export const BothThemes: Story = { render: () => themes(shapes()) };
