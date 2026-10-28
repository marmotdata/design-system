import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/readout.js';
import '@marmotdata/elements/text.js';

type Args = { items: string; label: string; inline: boolean };

const assetItems = ['Table', '14 cols', '1.28M rows', 'Updated 04:12 UTC'];

const meta: Meta<Args> = {
  title: 'Components/Foundations/Readout',
  component: 'mm-readout',
  args: { items: 'Table · 14 cols · 1.28M rows · Updated 04:12 UTC', label: 'Asset metadata', inline: false },
  render: (a) => html`<mm-readout items=${a.items} label=${a.label} ?inline=${a.inline}></mm-readout>`,
  parameters: {
    docs: {
      description: {
        component:
          'A sentence-case metadata caption. There is no uppercase variant.',
      },
    },
    usage: {
      html: `<mm-readout label="Asset metadata" items="Table · 14 cols · 1.28M rows · Updated 04:12 UTC"></mm-readout>`,
      react: `import { MmReadout } from '@marmotdata/react';

<MmReadout label="Asset metadata" items={['Table', '14 cols', '1.28M rows', 'Updated 04:12 UTC']} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/readout.js';
  const items = ['Table', '14 cols', '1.28M rows', 'Updated 04:12 UTC'];
</script>

<mm-readout label="Asset metadata" items={items}></mm-readout>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-readout')!;
    const items = el.shadowRoot!.querySelectorAll('li');
    await expect([...items].map((li) => li.textContent)).toEqual(assetItems);
    // Always sentence case.
    await expect(getComputedStyle(el).textTransform).toBe('none');
  },
};

export const UnderAssetTitle: Story = {
  name: 'Under an asset title',
  render: () => html`<div style="display:grid;gap:var(--space-2)">
    <mm-heading level="1">orders_daily</mm-heading>
    <mm-readout label="Asset metadata" .items=${assetItems}></mm-readout>
  </div>`,
};

export const FromArray: Story = {
  name: 'Items as a property',
  render: () => html`<mm-readout label="Topic metadata" .items=${['Kafka topic', '12 partitions', 'Retention 7 days', 'shop.orders.v2']}></mm-readout>`,
};

export const Slotted: Story = { name: 'Plain text (slotted)', render: () => html`<mm-readout>Plugin</mm-readout>` };

export const Empty: Story = {
  render: () => html`<mm-readout label="Asset metadata" .items=${[]}></mm-readout>`,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('mm-readout')!.shadowRoot!.querySelector('ul')).toBeNull();
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px;border:1px dashed var(--mm-rule);padding:var(--space-2)">
    <mm-readout label="Asset metadata" .items=${['Table', '214 cols', '1,284,019 rows', 'mrn://postgresql/table/shop.public.orders', 'Updated 04:12 UTC']}></mm-readout>
  </div>`,
};

export const RightsAndWrongs: Story = {
  name: 'Where it belongs',
  render: () => html`<div style="display:grid;gap:var(--space-5);max-width:520px;font:var(--text-dense)">
    <section style="display:grid;gap:var(--space-2)">
      <mm-text variant="label">Use it for real metadata</mm-text>
      <mm-heading level="2" variant="heading">customers_dim</mm-heading>
      <mm-readout label="Asset metadata" items="Table · 22 cols · 412K rows · Updated 03:58 UTC"></mm-readout>
    </section>
    <section style="display:grid;gap:var(--space-2)">
      <mm-text variant="label">Not as an eyebrow, a button or a field label</mm-text>
    </section>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-2)">
      <mm-heading level="2" variant="heading">orders_daily</mm-heading>
      <mm-readout label="Asset metadata" .items=${assetItems}></mm-readout>
    </div>`),
};
