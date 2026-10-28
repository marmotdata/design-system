import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/tag.js';
import type { MmTag } from './class.ts';

type Args = { variant: string; removable: boolean; href: string; text: string };

const meta: Meta<Args> = {
  title: 'Components/Status/Tag',
  component: 'mm-tag',
  args: { variant: 'plain', removable: false, href: '', text: 'finance' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'pii', 'certified', 'generated', 'plugin'] },
    text: { name: 'text (slot)' },
  },
  render: (a) => html`<mm-tag variant=${a.variant} ?removable=${a.removable} href=${a.href}>${a.text}</mm-tag>`,
  parameters: {
    usage: {
      html: `<mm-tag>finance</mm-tag>
<mm-tag variant="pii"></mm-tag>
<mm-tag variant="certified"></mm-tag>
<mm-tag variant="generated"></mm-tag>
<mm-tag removable>orders</mm-tag>`,
      react: `import { MmTag } from '@marmotdata/react';

{asset.tags.map((tag) => (
  <MmTag key={tag} removable={canEdit} href={\`/discover?tag=\${tag}\`} onMmRemove={() => removeTag(tag)}>{tag}</MmTag>
))}`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/tag.js';
  let { asset, canEdit, removeTag } = $props();
</script>

{#each asset.tags as tag (tag)}
  <mm-tag removable={canEdit} onmm-remove={() => removeTag(tag)}>{tag}</mm-tag>
{/each}`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

const assetTags = () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center">
  <mm-tag>finance</mm-tag>
  <mm-tag>orders</mm-tag>
  <mm-tag>daily</mm-tag>
  <mm-tag variant="pii"></mm-tag>
  <mm-tag variant="certified"></mm-tag>
  <mm-tag variant="generated"></mm-tag>
  <mm-tag variant="plugin"></mm-tag>
</div>`;

export const Variants: Story = { render: assetTags };

export const Generated: Story = {
  name: 'Generated and plugin readouts',
  render: () => html`<div style="display:grid;gap:var(--space-2);font:var(--text-dense);max-width:560px">
    <p style="margin:0;display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap">
      Daily order totals per region, rolled up from <code>shop.public.orders</code>. <mm-tag variant="generated"></mm-tag>
    </p>
    <p style="margin:0;display:flex;gap:var(--space-2);align-items:center">Owner: Analytics Engineering <mm-tag variant="plugin"></mm-tag></p>
  </div>`,
};

const onRemove = fn();
export const Removable: Story = {
  name: 'Keyboard: remove a tag',
  render: () => html`<div
    style="display:flex;flex-wrap:wrap;gap:var(--space-2)"
    @mm-remove=${(e: CustomEvent<{ value: string }>) => {
      onRemove(e.detail.value);
      (e.target as MmTag).remove();
    }}
  >
    <mm-tag removable>finance</mm-tag>
    <mm-tag removable>orders</mm-tag>
    <mm-tag removable>daily</mm-tag>
  </div>`,
  play: async ({ canvasElement }) => {
    onRemove.mockClear();
    await tab();
    const first = canvasElement.querySelector('mm-tag')!;
    await expect(deepActive()).toBe(first.shadowRoot!.querySelector('button'));
    await expect(deepActive()).toHaveAttribute('aria-label', 'Remove finance');
    await press('{Enter}');
    await expect(onRemove).toHaveBeenCalledWith('finance');
    await waitFor(() => expect(canvasElement.querySelectorAll('mm-tag')).toHaveLength(2));
    await tab();
    await press('{Delete}');
    await expect(onRemove).toHaveBeenLastCalledWith('orders');
    await tab();
    await press('{Space}');
    await expect(onRemove).toHaveBeenLastCalledWith('daily');
    await expect(canvasElement.querySelectorAll('mm-tag')).toHaveLength(0);
  },
};

export const Link: Story = {
  name: 'As a link',
  render: () => html`<div style="display:flex;gap:var(--space-2)">
    <mm-tag href="#discover?tag=finance">finance</mm-tag>
    <mm-tag href="#discover?tag=orders" removable>orders</mm-tag>
  </div>`,
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-tag')!.shadowRoot!.querySelector('a'));
  },
};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => html`<div style="display:flex;gap:var(--space-2)">
    <mm-tag href="#discover?tag=finance">finance</mm-tag><mm-tag removable>orders</mm-tag>
  </div>`,
};

export const Focus: Story = {
  render: () => html`<mm-tag removable>customers</mm-tag>`,
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-tag')!.shadowRoot!.querySelector('button'));
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);max-width:360px">
    <mm-tag>finance-reporting-quarterly-reconciliation-emea</mm-tag>
    <mm-tag removable>analytics-engineering-certified-marts</mm-tag>
    <mm-tag>orders</mm-tag>
  </div>`,
  play: async ({ canvasElement }) => {
    const tag = canvasElement.querySelector('mm-tag')!;
    const label = tag.shadowRoot!.querySelector('.label')!;
    await waitFor(() => expect(label).toHaveAttribute('title', 'finance-reporting-quarterly-reconciliation-emea'));
    // The full text stays in the accessibility tree; only the paint is cut off.
    await expect(tag.textContent).toBe('finance-reporting-quarterly-reconciliation-emea');
    await expect(canvasElement.querySelectorAll('mm-tag')[2]!.shadowRoot!.querySelector('.label')).not.toHaveAttribute('title');
  },
};

export const LongIdentifiers: Story = {
  render: () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);max-width:420px">
    <mm-tag style="--mm-tag-max-width:40ch">source:mrn://postgresql/table/shop.public.orders</mm-tag>
    <mm-tag>shop.orders.v2</mm-tag>
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="display:flex;gap:var(--space-2)">
    <mm-tag>مالية</mm-tag><mm-tag variant="pii"></mm-tag><mm-tag removable>طلبات</mm-tag><mm-tag variant="generated"></mm-tag>
  </div>`,
};

export const BothThemes: Story = { render: () => themes(assetTags()) };
