import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/schema-table.js';
import type { MmSchemaTable, SchemaColumn } from './class.ts';

// ---- data -----------------------------------------------------------------

const orders: SchemaColumn[] = [
  { name: 'order_id', type: 'int8', nullable: false, primaryKey: true, description: 'Surrogate key for the order, assigned by the checkout service.', descriptionSource: 'user', stats: { distinct: 1_284_019, nullPercent: 0, min: 1, max: 1_284_019 } },
  { name: 'customer_id', type: 'int8', nullable: false, description: 'The customer who placed the order. Joins to customers_dim.', glossaryTerms: ['Customer'], stats: { distinct: 412_880, nullPercent: 0, min: 1, max: 412_880 } },
  { name: 'order_number', type: 'varchar(32)', nullable: false, description: 'Human-readable order number shown on receipts.', descriptionSource: 'plugin', stats: { distinct: 1_284_019, nullPercent: 0 } },
  { name: 'status', type: 'varchar(32)', nullable: false, description: 'Lifecycle state: pending, paid, shipped, delivered, refunded or cancelled.', glossaryTerms: ['Order status'], stats: { distinct: 6, nullPercent: 0, distribution: [4, 62, 18, 11, 3, 2] } },
  { name: 'currency', type: 'char(3)', nullable: false, description: 'ISO 4217 currency code.', descriptionSource: 'plugin', stats: { distinct: 4, nullPercent: 0, min: 'EUR', max: 'USD' } },
  { name: 'subtotal', type: 'numeric(10,2)', nullable: false, stats: { distinct: 88_204, nullPercent: 0, min: '0.50', max: '9,840.00' } },
  { name: 'discount_total', type: 'numeric(10,2)', nullable: true, description: 'Sum of discounts applied at checkout.', stats: { distinct: 1_822, nullPercent: 71.4, min: '0.00', max: '450.00' } },
  { name: 'tax_total', type: 'numeric(10,2)', nullable: false, stats: { distinct: 20_516, nullPercent: 0, min: '0.00', max: '1,968.00' } },
  { name: 'total', type: 'numeric(12,2)', nullable: false, certified: true, description: 'Amount charged, after discounts and including tax.', stats: { distinct: 96_330, nullPercent: 0, min: '0.50', max: '11,808.00', distribution: [38, 24, 15, 9, 6, 4, 2, 1, 1] } },
  { name: 'email', type: 'varchar(255)', nullable: false, pii: true, description: 'Email address the receipt was sent to.', descriptionSource: 'plugin', stats: { distinct: 409_112, nullPercent: 0 } },
  { name: 'shipping_address_id', type: 'int8', nullable: true, description: 'Null for digital-only orders.', stats: { distinct: 398_604, nullPercent: 6.2, min: 1, max: 451_220 } },
  { name: 'placed_at', type: 'timestamptz', nullable: false, stats: { distinct: 1_283_877, nullPercent: 0, min: '2019-03-01 09:12 UTC', max: '2026-10-27 04:11 UTC' } },
  { name: 'updated_at', type: 'timestamptz', nullable: false, stats: { distinct: 1_284_001, nullPercent: 0, min: '2019-03-01 09:12 UTC', max: '2026-10-27 04:12 UTC' } },
  { name: 'is_test', type: 'boolean', nullable: false, description: 'Orders placed by the QA team in production.', tags: ['internal'], stats: { distinct: 2, nullPercent: 0.04 } },
];

const avro: SchemaColumn[] = [
  { name: 'order_id', type: 'string', nullable: false, description: 'Order identifier from the checkout service.', descriptionSource: 'plugin' },
  {
    name: 'customer',
    type: 'record Customer',
    nullable: false,
    fields: [
      { name: 'id', type: 'long', nullable: false },
      { name: 'email', type: 'string', nullable: false, pii: true },
      { name: 'tier', type: 'enum Tier', nullable: false, description: 'One of STANDARD, PLUS or TRADE.' },
    ],
  },
  {
    name: 'items',
    type: 'array<record LineItem>',
    nullable: false,
    fields: [
      { name: 'sku', type: 'string', nullable: false },
      { name: 'quantity', type: 'int', nullable: false },
      { name: 'unit_price', type: 'bytes (decimal 10,2)', nullable: false },
    ],
  },
  {
    name: 'shipping',
    type: 'union {null, record Shipping}',
    nullable: true,
    description: 'Absent for digital orders.',
    fields: [
      {
        name: 'address',
        type: 'record Address',
        nullable: false,
        fields: [
          { name: 'line1', type: 'string', nullable: false, pii: true },
          { name: 'city', type: 'string', nullable: false },
          { name: 'postcode', type: 'string', nullable: false, pii: true },
          { name: 'country', type: 'string', nullable: false, description: 'ISO 3166-1 alpha-2.' },
        ],
      },
      { name: 'method', type: 'enum ShippingMethod', nullable: false },
    ],
  },
  { name: 'placed_at', type: 'long (timestamp-millis)', nullable: false },
];

const bigquery: SchemaColumn[] = [
  { name: 'event_id', type: 'STRING', nullable: false, primaryKey: true },
  { name: 'event_name', type: 'STRING', nullable: false, description: 'page_view, add_to_cart or purchase.' },
  {
    name: 'user',
    type: 'STRUCT<id STRING, country STRING, consent STRUCT<analytics BOOL, ads BOOL>>',
    nullable: true,
    fields: [
      { name: 'id', type: 'STRING', nullable: true, pii: true },
      { name: 'country', type: 'STRING', nullable: true },
      { name: 'consent', type: 'STRUCT<analytics BOOL, ads BOOL>', nullable: true, fields: [{ name: 'analytics', type: 'BOOL', nullable: true }, { name: 'ads', type: 'BOOL', nullable: true }] },
    ],
  },
  { name: 'items', type: 'ARRAY<STRUCT<sku STRING, price NUMERIC>>', nullable: true, fields: [{ name: 'sku', type: 'STRING', nullable: true }, { name: 'price', type: 'NUMERIC', nullable: true }] },
  { name: 'labels', type: 'ARRAY<STRING>', nullable: true },
  { name: 'event_timestamp', type: 'TIMESTAMP', nullable: false, description: 'Partitioning column (day).', tags: ['partition'] },
];

const longOnes: SchemaColumn[] = [
  { name: 'customer_lifetime_value_by_acquisition_channel_and_cohort_month_gbp', type: 'numeric(38,9)', nullable: true, description: 'Modelled lifetime value in pounds sterling, recalculated nightly by the ltv_forecast job from the last 36 months of orders.' },
  {
    name: 'fulfilment',
    type: 'struct<warehouse_assignment: struct<primary_warehouse_code: string, fallback_warehouse_codes: array<string>, assigned_at: timestamp>, carrier_service_level_agreement_hours: int>',
    nullable: true,
    fields: [{ name: 'warehouse_assignment', type: 'struct<primary_warehouse_code: string, fallback_warehouse_codes: array<string>, assigned_at: timestamp>', nullable: true, fields: [{ name: 'fallback_warehouse_codes', type: 'array<string>', nullable: true }] }],
  },
];

// ---- helpers ----------------------------------------------------------------

const tableOf = (root: Element) => root.querySelector('mm-schema-table')!;
const rowOf = (t: MmSchemaTable, key: string) => t.shadowRoot!.querySelector<HTMLElement>(`.row[data-key="${key}"]`);
const focusedKey = () => (deepActive() as HTMLElement | null)?.dataset?.key;

// ---- meta -------------------------------------------------------------------

type Args = { label: string; editable: boolean; loading: boolean; error: string; piiOnly: boolean };

const meta: Meta<Args> = {
  title: 'Components/Data/Schema outline',
  component: 'mm-schema-table',
  args: { label: 'Schema of shop.public.orders', editable: true, loading: false, error: '', piiOnly: false },
  render: (a) => html`<mm-schema-table label=${a.label} ?editable=${a.editable} ?loading=${a.loading} ?pii-only=${a.piiOnly} error=${a.error} .columns=${orders}></mm-schema-table>`,
  parameters: {
    layout: 'padded',
    usage: {
      html: `<mm-schema-table id="schema" label="Schema of shop.public.orders" editable></mm-schema-table>
<script type="module">
  const table = document.querySelector('#schema');
  table.columns = asset.schema.columns;
  table.addEventListener('mm-edit-description', (e) => openEditor(e.detail.path));
</script>`,
      react: `import { MmSchemaTable } from '@marmotdata/react';

<MmSchemaTable
  label="Schema of shop.public.orders"
  editable
  columns={asset.schema.columns}
  onMmEditDescription={(e) => openEditor(e.detail.path)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/schema-table.js';
  let { asset } = $props();
</script>

<mm-schema-table
  label="Schema of shop.public.orders"
  editable
  columns={asset.schema.columns}
  onmm-edit-description={(e) => openEditor(e.detail.path)}
></mm-schema-table>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const PostgresTable: Story = { name: 'shop.public.orders (14 columns)' };

export const KafkaAvro: Story = {
  name: 'Kafka Avro topic with nested records',
  render: () => html`<mm-schema-table label="Schema of shop.orders.v2" .columns=${avro}></mm-schema-table>`,
};

export const BigQuery: Story = {
  name: 'BigQuery arrays and structs',
  render: () => html`<mm-schema-table label="Schema of marmot-analytics.events.page_views" .columns=${bigquery}></mm-schema-table>`,
  play: async ({ canvasElement }) => {
    const t = tableOf(canvasElement);
    const btn = [...t.shadowRoot!.querySelectorAll('mm-button')].find((b) => b.textContent?.includes('Expand all'))!;
    await click(btn);
    await waitFor(() => expect(rowOf(t, 'user.consent.ads')).not.toBeNull());
  },
};

export const Empty: Story = { render: () => html`<mm-schema-table label="Schema of shop.public.refunds" .columns=${[]}></mm-schema-table>` };
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Could not load the schema. The catalog API returned 503 Service Unavailable.' } };
export const LongIdentifiers: Story = {
  name: 'Very long column names and types',
  render: () => html`<div style="max-width:900px"><mm-schema-table label="Schema of finance.customer_ltv_monthly" .columns=${longOnes}></mm-schema-table></div>`,
};
export const StickyHeader: Story = {
  name: 'Overflowing: sticky header',
  render: () => html`<mm-schema-table label="Schema of shop.public.orders" style="--mm-schema-table-height:20rem" .columns=${orders}></mm-schema-table>`,
};
export const PiiOnly: Story = { name: 'Personal data only', render: () => html`<mm-schema-table label="Schema of shop.orders.v2" pii-only .columns=${avro}></mm-schema-table>` };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const t = tableOf(canvasElement);
    rowOf(t, 'order_id')!.focus();
    await expect(focusedKey()).toBe('order_id');
    await expect(rowOf(t, 'order_id')).toHaveAttribute('tabindex', '0');
  },
};
export const Compact: Story = { name: 'Compact density', render: () => html`<mm-schema-table label="Schema of shop.public.orders" density="compact" .columns=${orders}></mm-schema-table>` };
export const FieldPanel: Story = {
  name: 'Field panel open',
  render: () => html`<mm-schema-table label="Schema of shop.public.orders" editable selected="order_id" .columns=${orders}></mm-schema-table>`,
};

/** The Avro document as the registry holds it, for the text views. */
const avroSource = {
  type: 'record',
  name: 'OrderEvent',
  namespace: 'shop.orders.v2',
  fields: avro.map((c) => ({ name: c.name, type: c.fields?.length ? { type: 'record', name: c.name, fields: c.fields.map((f) => ({ name: f.name, type: f.type })) } : c.type, ...(c.description ? { doc: c.description } : {}) })),
};
export const JsonView: Story = { name: 'JSON view', render: () => html`<mm-schema-table label="Schema of shop.orders.v2" view="json" .source=${avroSource} .columns=${avro}></mm-schema-table>` };
export const YamlView: Story = { name: 'YAML view', render: () => html`<mm-schema-table label="Schema of shop.orders.v2" view="yaml" .source=${avroSource} .columns=${avro}></mm-schema-table>` };
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-schema-table label="مخطط shop.orders.v2" .columns=${avro}></mm-schema-table>`,
  play: async ({ canvasElement }) => {
    const t = tableOf(canvasElement);
    rowOf(t, 'customer')!.focus();
    // Top-level groups start open: Right (backwards in RTL) collapses, Left expands.
    await press('{ArrowRight}');
    await waitFor(() => expect(rowOf(t, 'customer')).toHaveAttribute('aria-expanded', 'false'));
    await press('{ArrowLeft}');
    await waitFor(() => expect(rowOf(t, 'customer')).toHaveAttribute('aria-expanded', 'true'));
    await press('{ArrowLeft}');
    await waitFor(() => expect(focusedKey()).toBe('customer.id'));
  },
};
export const BothThemes: Story = { render: () => themes(html`<mm-schema-table label="Schema of shop.orders.v2" .columns=${avro.slice(0, 3)}></mm-schema-table>`) };

// ---- keyboard ---------------------------------------------------------------

const onEdit = fn();

export const KeyboardRows: Story = {
  name: 'Keyboard: rows, groups and the field panel',
  render: () => html`<mm-schema-table label="Schema of shop.orders.v2" editable .columns=${avro} @mm-edit-description=${(e: CustomEvent) => onEdit(e.detail.path)}></mm-schema-table>`,
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    const t = tableOf(canvasElement);
    rowOf(t, 'order_id')!.focus();
    await press('{ArrowDown}');
    await waitFor(() => expect(focusedKey()).toBe('customer'));
    // Top-level groups start open.
    await expect(rowOf(t, 'customer')).toHaveAttribute('aria-expanded', 'true');

    // Left collapses, Right expands, then moves to the first field.
    await press('{ArrowLeft}');
    await waitFor(() => expect(rowOf(t, 'customer.id')).toBeNull());
    await press('{ArrowRight}');
    await waitFor(() => expect(rowOf(t, 'customer')).toHaveAttribute('aria-expanded', 'true'));
    await press('{ArrowRight}');
    await waitFor(() => expect(focusedKey()).toBe('customer.id'));
    await expect(rowOf(t, 'customer.id')).toHaveAttribute('aria-level', '2');
    await expect(rowOf(t, 'customer.id')).toHaveAttribute('aria-setsize', '3');

    // Left moves to the parent.
    await press('{ArrowLeft}');
    await waitFor(() => expect(focusedKey()).toBe('customer'));

    // Enter opens the field panel; Escape closes it and returns to the row.
    await press('{Enter}');
    await waitFor(() => expect(t.shadowRoot!.querySelector('.panel')).not.toBeNull());
    await expect(t.selected).toBe('customer');
    await press('{Escape}');
    await waitFor(() => expect(t.shadowRoot!.querySelector('.panel')).toBeNull());
    await waitFor(() => expect(focusedKey()).toBe('customer'));

    // Home and End.
    await press('{End}');
    await waitFor(() => expect(focusedKey()).toBe('placed_at'));
    await press('{Home}');
    await waitFor(() => expect(focusedKey()).toBe('order_id'));

    // The panel's Edit description fires the event with the path.
    await press('{Enter}');
    const edit = await waitFor(() => [...t.shadowRoot!.querySelectorAll('.panel mm-button')].find((b) => b.textContent?.includes('Edit description'))!);
    await click(edit.shadowRoot!.querySelector('button')!);
    await expect(onEdit).toHaveBeenCalledWith('order_id');
  },
};

export const FilterAndPii: Story = {
  name: 'Find, personal data filter and expand all',
  render: () => html`<mm-schema-table label="Schema of shop.orders.v2" .columns=${avro}></mm-schema-table>`,
  play: async ({ canvasElement }) => {
    const t = tableOf(canvasElement);
    await tab();
    await press('city');
    await waitFor(() => expect(rowOf(t, 'shipping.address.city')).not.toBeNull());
    await expect(rowOf(t, 'order_id')).toBeNull();
    await press('{Escape}');
    await waitFor(() => expect(rowOf(t, 'order_id')).not.toBeNull());

    // Space on the Personal data pill.
    await tab();
    await press('{Space}');
    await waitFor(() => expect(t.piiOnly).toBe(true));
    await waitFor(() => expect(rowOf(t, 'customer.email')).not.toBeNull());
    await expect(rowOf(t, 'placed_at')).toBeNull();
    await press('{Space}');
    await waitFor(() => expect(t.piiOnly).toBe(false));

    // Top-level groups start open, so the button collapses all, then expands all.
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(rowOf(t, 'shipping.address')).toBeNull());
    await press('{Enter}');
    await waitFor(() => expect(rowOf(t, 'shipping.address.country')).not.toBeNull());
  },
};
