import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/text.js';

type Args = { variant: string; tone: string; block: boolean; numeric: boolean; text: string };

const variants = [
  ['body', 'Orders are rolled up nightly from the shop database and published to the finance domain.'],
  ['body-strong', 'This asset has no owner.'],
  ['dense', 'Last run succeeded in 412 ms with 1,284,019 rows written.'],
  ['caption', 'Updated 12 minutes ago by support-triage-agent'],
  ['label', 'Owner'],
  ['mono', 'mrn://postgresql/table/shop.public.orders'],
  ['mono-dense', 'customer_id bigint not null'],
] as const;

const tones = [
  ['default', 'Analytics Engineering owns this asset.'],
  ['secondary', 'Owned by Analytics Engineering'],
  ['tertiary', 'Synced 4 minutes ago'],
  ['danger', 'Failed: permission denied for schema finance'],
  ['success', 'Succeeded: 1,284,019 rows'],
  ['warning', 'Stale: last updated 9 days ago'],
] as const;

const specimen = html`<dl style="display:grid;grid-template-columns:max-content 1fr;gap:var(--space-3) var(--space-6);margin:0;align-items:baseline">
  ${variants.map(
    ([v, sample]) => html`<dt><mm-text variant="mono-dense" tone="secondary">${v}</mm-text></dt>
      <dd style="margin:0"><mm-text variant=${v}>${sample}</mm-text></dd>`,
  )}
</dl>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Text',
  component: 'mm-text',
  args: { variant: 'body', tone: 'default', block: false, numeric: false, text: 'Orders are rolled up nightly from the shop database.' },
  argTypes: {
    variant: { control: 'select', options: variants.map(([v]) => v) },
    tone: { control: 'select', options: tones.map(([t]) => t) },
    text: { name: 'text (slot)' },
  },
  render: (a) => html`<mm-text variant=${a.variant} tone=${a.tone} ?block=${a.block} ?numeric=${a.numeric}>${a.text}</mm-text>`,
  parameters: {
    usage: {
      html: `<mm-text variant="label">Owner</mm-text>
<mm-text variant="mono-dense">mrn://postgresql/table/shop.public.orders</mm-text>
<mm-text block>Orders are rolled up nightly from the shop database.</mm-text>`,
      react: `import { MmText } from '@marmotdata/react';

<MmText variant="label">Owner</MmText>
<MmText variant="mono-dense">mrn://postgresql/table/shop.public.orders</MmText>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/text.js';
</script>

<mm-text variant="label">Owner</mm-text>
<mm-text variant="mono-dense">mrn://postgresql/table/shop.public.orders</mm-text>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Variants: Story = { name: 'Every variant', render: () => specimen };

export const Tones: Story = {
  render: () => html`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)">
    ${tones.map(([t, sample]) => html`<li><mm-text variant="dense" tone=${t}>${sample}</mm-text></li>`)}
  </ul>
  <p style="margin:var(--space-4) 0 0"><mm-text variant="caption" tone="secondary">Status tones always carry the word as well as the colour.</mm-text></p>`,
};

export const Paragraph: Story = {
  name: 'Block paragraph with measure',
  render: () => html`<mm-text block>
    The orders_daily table is rebuilt every night at 02:00 UTC from shop.orders.v2. Each row is one order line with its customer, region and settled amount. Finance reads it for the daily revenue report, so check lineage before changing upstream joins.
  </mm-text>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-text')!;
    await expect(getComputedStyle(el).display).toBe('block');
    await expect(getComputedStyle(el).maxInlineSize).not.toBe('none');
  },
};

export const TabularNumbers: Story = {
  render: () => html`<div style="display:grid;justify-items:end;width:160px">
    <mm-text variant="dense" numeric>1,284,019</mm-text><mm-text variant="dense" numeric>412,118</mm-text><mm-text variant="dense" numeric>11,007</mm-text>
  </div>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<div style="width:240px"><mm-text variant="mono-dense">mrn://postgresql/table/shop.public.orders_daily_rollup_by_region</mm-text></div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { text: 'يتم تجميع الطلبات كل ليلة من قاعدة بيانات المتجر.', block: true } };

export const BothThemes: Story = {
  render: () => themes(html`<div style="display:grid;gap:var(--space-5)">${specimen}${Tones.render!({} as Args, {} as never)}</div>`),
};
