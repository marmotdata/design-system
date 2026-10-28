import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/description-list.js';
import '@marmotdata/elements/link.js';
import '@marmotdata/elements/tag.js';
import '@marmotdata/icons/define.js';

type Args = { layout: string; columns: number };

const details = html`
  <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.orders</mm-description>
  <mm-description term="Provider"><span style="display:inline-flex;gap:6px;align-items:center"><mm-provider-logo provider="postgresql" size="14" decorative></mm-provider-logo>PostgreSQL</span></mm-description>
  <mm-description term="Rows">1,284,019</mm-description>
  <mm-description term="Last surveyed">Today, 04:12 UTC</mm-description>
  <mm-description term="Created">12 Mar 2026</mm-description>
  <mm-description term="Retention"></mm-description>
`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Description list',
  component: 'mm-description-list',
  args: { layout: 'columns', columns: 3 },
  argTypes: { layout: { control: 'inline-radio', options: ['columns', 'stacked', 'inline-grid'] } },
  render: (a) => html`<mm-description-list layout=${a.layout} columns=${a.columns} style="max-width:520px">${details}</mm-description-list>`,
  parameters: {
    usage: {
      html: `<mm-description-list>
  <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.orders</mm-description>
  <mm-description term="Rows">1,284,019</mm-description>
  <mm-description term="Retention"></mm-description> <!-- shows "Not set" -->
</mm-description-list>`,
      react: `import { MmDescriptionList, MmDescription } from '@marmotdata/react';

<MmDescriptionList layout="inline-grid" columns={4}>
  <MmDescription term="Rows">{rows.toLocaleString('en-GB')}</MmDescription>
  <MmDescription term="Size">{size}</MmDescription>
  <MmDescription term="Updated">{updated}</MmDescription>
  <MmDescription term="Owner">{owner}</MmDescription>
</MmDescriptionList>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/description-list.js';
</script>

<mm-description-list layout="stacked">
  <mm-description term="MRN" mono>{asset.mrn}</mm-description>
  <mm-description term="Retention">{asset.retention ?? ''}</mm-description>
</mm-description-list>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector('mm-description-list')!;
    await expect(list).toHaveAttribute('role', 'list');
    const empty = canvasElement.querySelector('mm-description[term="Retention"]')!;
    await expect(empty.shadowRoot!.querySelector('.empty')!.textContent).toBe('Not set');
    const term = empty.shadowRoot!.querySelector('[role="term"]')!;
    await expect(term.textContent!.trim()).toBe('Retention');
  },
};

export const Stacked: Story = { args: { layout: 'stacked' } };

export const InlineGrid: Story = {
  name: 'Inline grid (KPI-like metadata)',
  render: () => html`<mm-description-list layout="inline-grid" columns="4" style="max-width:720px">
    <mm-description term="Rows">1,284,019</mm-description>
    <mm-description term="Size">412&nbsp;MB</mm-description>
    <mm-description term="Columns">14</mm-description>
    <mm-description term="Updated" mono>04:12 UTC</mm-description>
  </mm-description-list>`,
};

export const RichValues: Story = {
  name: 'Links and tags as values',
  render: () => html`<mm-description-list style="max-width:520px">
    <mm-description term="Owner"><mm-link href="#/teams/analytics-engineering">Analytics Engineering</mm-link></mm-description>
    <mm-description term="Steward">Jane Doe</mm-description>
    <mm-description term="Classification"><mm-tag variant="pii"></mm-tag></mm-description>
    <mm-description term="Upstream" mono>shop.orders.v2</mm-description>
  </mm-description-list>`,
};

export const Empty: Story = {
  name: 'Empty values',
  render: () => html`<mm-description-list style="max-width:520px">
    <mm-description term="Steward"></mm-description>
    <mm-description term="Retention"></mm-description>
    <mm-description term="Domain"></mm-description>
  </mm-description-list>`,
  play: async ({ canvasElement }) => {
    for (const d of canvasElement.querySelectorAll('mm-description')) {
      await expect(d.shadowRoot!.querySelector('.empty')).not.toBeNull();
    }
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-description-list style="max-width:360px">
    <mm-description term="Description of the source system and its quirks">
      Orders placed through the storefront and the partner API, deduplicated by order number and restated nightly when refunds settle.
    </mm-description>
    <mm-description term="Schedule">Every hour at 12 minutes past, except during the Sunday maintenance window</mm-description>
  </mm-description-list>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-description-list style="max-width:360px">
    <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.orders_daily_by_customer_region_rollup_v2</mm-description>
    <mm-description term="Run ID" mono>run_01J8Z6Q4M2T9X7KD3VBN5RWEHC</mm-description>
  </mm-description-list>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-description-list style="max-width:520px">
    <mm-description term="المعرّف" mono>mrn://postgresql/table/shop.public.orders</mm-description>
    <mm-description term="الصفوف">1,284,019</mm-description>
    <mm-description term="الاحتفاظ"></mm-description>
  </mm-description-list>`,
};

export const CompactDensity: Story = { globals: { density: 'compact' } };

export const BothThemes: Story = {
  render: () => themes(html`<mm-description-list>${details}</mm-description-list>`),
};
