import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/metadata-viewer.js';
import type { MmMetadataViewer } from './class.ts';

// ---- data -----------------------------------------------------------------

const snowflake = {
  database: 'ANALYTICS',
  schema: 'MARTS',
  table_type: 'BASE TABLE',
  clustering_keys: ['ORDER_DATE', 'CUSTOMER_ID'],
  retention_time: 7,
  created_by: 'Jane Doe',
  owner_role: 'TRANSFORMER',
  row_count: 1284019,
  bytes: 2318402112,
  is_transient: false,
  created: '2024-02-12T09:41:07Z',
  last_altered: '2026-10-27T04:12:09Z',
  comment: 'Daily order rollup used by the finance dashboards. Rebuilt nightly by the orders_daily dbt model.',
  docs_url: 'https://docs.marmotdata.io/catalog/analytics/orders_daily',
  owner: { team: 'Analytics Engineering', slack: '#analytics-eng', on_call: 'jane.doe' },
};

const dbt = {
  unique_id: 'model.analytics.orders_daily',
  materialized: 'incremental',
  incremental_strategy: 'merge',
  package_name: 'analytics',
  original_file_path: 'models/marts/orders_daily.sql',
  depends_on: {
    nodes: ['model.analytics.stg_orders', 'model.analytics.stg_payments', 'model.analytics.customers_dim'],
    macros: ['macro.dbt.is_incremental', 'macro.analytics.cents_to_pounds'],
  },
  config: {
    enabled: true,
    unique_key: 'order_date',
    on_schema_change: 'append_new_columns',
    contract: { enforced: false },
    meta: { owner: 'Analytics Engineering', tier: 1 },
  },
  tags: ['finance', 'daily', 'pii-free'],
  compiled_at: '2026-10-27T04:02:51.118Z',
};

const kafka = {
  topic: 'shop.orders.v2',
  partitions: 12,
  replication_factor: 3,
  'cleanup.policy': 'compact,delete',
  'retention.ms': 604800000,
  'min.insync.replicas': 2,
  'compression.type': 'zstd',
  'max.message.bytes': 1048588,
  schema_registry_subject: 'shop.orders.v2-value',
  schema_registry_url: 'https://schema-registry.eu-west-2.internal:8081/subjects/shop.orders.v2-value',
};

const longValues = {
  mrn: 'mrn://snowflake/table/ANALYTICS.MARTS.CUSTOMER_LIFETIME_VALUE_BY_ACQUISITION_CHANNEL_AND_COHORT_MONTH',
  view_definition:
    'SELECT c.customer_id, c.acquisition_channel, DATE_TRUNC(\'month\', c.signed_up_at) AS cohort_month, SUM(o.total) AS lifetime_value_gbp FROM ANALYTICS.MARTS.CUSTOMERS_DIM c JOIN ANALYTICS.MARTS.ORDERS_DAILY o ON o.customer_id = c.customer_id GROUP BY 1, 2, 3',
  a_rather_long_configuration_key_that_a_plugin_emitted_verbatim: 'ok',
  partition_ids: Array.from({ length: 48 }, (_, i) => `p${String(i).padStart(3, '0')}`),
};

// ---- helpers ----------------------------------------------------------------

const viewerOf = (root: Element) => root.querySelector('mm-metadata-viewer')!;
const rowOf = (v: MmMetadataViewer, path: string) => v.shadowRoot!.querySelector<HTMLElement>(`[role=treeitem][data-path='${path}']`);
const focusedPath = () => (deepActive() as HTMLElement | null)?.dataset?.path;

// ---- meta -------------------------------------------------------------------

type Args = { label: string; raw: boolean; expandDepth: number };

const meta: Meta<Args> = {
  title: 'Components/Data/Metadata viewer',
  component: 'mm-metadata-viewer',
  args: { label: 'Metadata of ANALYTICS.MARTS.ORDERS_DAILY', raw: false, expandDepth: 0 },
  render: (a) => html`<div style="max-width:760px"><mm-metadata-viewer label=${a.label} ?raw=${a.raw} expand-depth=${a.expandDepth} .metadata=${snowflake}></mm-metadata-viewer></div>`,
  parameters: {
    layout: 'padded',
    usage: {
      html: `<mm-metadata-viewer id="md" label="Metadata of orders_daily"></mm-metadata-viewer>
<script type="module">
  document.querySelector('#md').metadata = asset.metadata;
</script>`,
      react: `import { MmMetadataViewer } from '@marmotdata/react';

<MmMetadataViewer label="Metadata of orders_daily" metadata={asset.metadata} onMmCopy={(e) => toast('Copied ' + e.detail.kind)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/metadata-viewer.js';
  let { asset } = $props();
</script>

<mm-metadata-viewer label="Metadata of orders_daily" metadata={asset.metadata}></mm-metadata-viewer>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const SnowflakeTable: Story = { name: 'Snowflake table' };
export const DbtModel: Story = {
  name: 'dbt model',
  render: () => html`<div style="max-width:760px"><mm-metadata-viewer label="Metadata of orders_daily" expand-depth="1" .metadata=${dbt}></mm-metadata-viewer></div>`,
};
export const KafkaTopic: Story = {
  name: 'Kafka topic config',
  render: () => html`<div style="max-width:760px"><mm-metadata-viewer label="Metadata of shop.orders.v2" .metadata=${kafka}></mm-metadata-viewer></div>`,
};
export const Empty: Story = { render: () => html`<mm-metadata-viewer label="Metadata of shop.public.refunds" .metadata=${{}}></mm-metadata-viewer>` };
export const LongValues: Story = {
  name: 'Very long values',
  render: () => html`<div style="max-width:560px"><mm-metadata-viewer label="Metadata of CUSTOMER_LTV" .metadata=${longValues}></mm-metadata-viewer></div>`,
};
export const RawJson: Story = { name: 'View raw JSON', args: { raw: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab(); // search
    await tab(); // raw toggle
    await tab(); // first row
    await expect(focusedPath()).toBe('metadata.database');
    await expect(rowOf(viewerOf(canvasElement), 'metadata.database')).toHaveAttribute('tabindex', '0');
  },
};
export const Compact: Story = { name: 'Compact density', render: (a, c) => html`<div data-density="compact">${meta.render!(a, c)}</div>` };
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="max-width:760px"><mm-metadata-viewer label="البيانات الوصفية" .metadata=${dbt}></mm-metadata-viewer></div>`,
  play: async ({ canvasElement }) => {
    const v = viewerOf(canvasElement);
    rowOf(v, 'metadata.depends_on')!.focus();
    await press('{ArrowLeft}');
    await waitFor(() => expect(rowOf(v, 'metadata.depends_on')).toHaveAttribute('aria-expanded', 'true'));
    await press('{ArrowLeft}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.depends_on.nodes'));
    await press('{ArrowRight}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.depends_on'));
  },
};
export const BothThemes: Story = { render: () => themes(html`<mm-metadata-viewer label="Metadata of shop.orders.v2" .metadata=${kafka}></mm-metadata-viewer>`) };

// ---- keyboard ---------------------------------------------------------------

const onCopy = fn();

export const KeyboardNavigation: Story = {
  name: 'Keyboard: navigation, typeahead and copy',
  render: () => html`<div style="max-width:760px"><mm-metadata-viewer label="Metadata of orders_daily" .metadata=${dbt} @mm-copy=${(e: CustomEvent) => onCopy(e.detail.kind, e.detail.value)}></mm-metadata-viewer></div>`,
  play: async ({ canvasElement }) => {
    onCopy.mockClear();
    const v = viewerOf(canvasElement);
    rowOf(v, 'metadata.unique_id')!.focus();
    await press('{ArrowDown}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.materialized'));
    await press('{ArrowUp}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.unique_id'));

    // Typeahead to depends_on, then expand and walk in.
    await press('dep');
    await waitFor(() => expect(focusedPath()).toBe('metadata.depends_on'));
    await expect(rowOf(v, 'metadata.depends_on')?.textContent).toContain('2 keys');
    await press('{ArrowRight}');
    await waitFor(() => expect(rowOf(v, 'metadata.depends_on')).toHaveAttribute('aria-expanded', 'true'));
    await press('{ArrowRight}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.depends_on.nodes'));
    await expect(rowOf(v, 'metadata.depends_on.nodes')).toHaveAttribute('aria-level', '2');
    // A list of plain values reads inline, so it is a leaf with no expanded state.
    await expect(rowOf(v, 'metadata.depends_on.nodes')!.hasAttribute('aria-expanded')).toBe(false);
    await expect(rowOf(v, 'metadata.depends_on.nodes')?.textContent).toContain('model.analytics.stg_orders');

    // Left goes to the parent, then collapses it.
    await press('{ArrowLeft}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.depends_on'));
    await press('{ArrowLeft}');
    await waitFor(() => expect(rowOf(v, 'metadata.depends_on')).toHaveAttribute('aria-expanded', 'false'));

    // * expands every sibling.
    await press('*');
    await waitFor(() => expect(rowOf(v, 'metadata.config')).toHaveAttribute('aria-expanded', 'true'));

    // Home and End.
    await press('{End}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.compiled_at'));
    await press('{Home}');
    await waitFor(() => expect(focusedPath()).toBe('metadata.unique_id'));

    // Tab reaches Copy value, then Copy path.
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('value', 'model.analytics.orders_daily'));
    // Headless browsers deny the clipboard, so mm-copy-button's fallback may move focus; start again from the row.
    rowOf(v, 'metadata.unique_id')!.focus();
    await tab();
    await tab();
    await expect((deepActive()!.getRootNode() as ShadowRoot).host.getAttribute('label')).toBe('Copy path');
    await press('{Enter}');
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith('path', 'metadata.unique_id'));
    // Let the "Copied" confirmations clear (1.5s) before the accessibility check runs on the row.
    await new Promise((r) => setTimeout(r, 1800));
  },
};

export const SearchAndRaw: Story = {
  name: 'Search filters, raw JSON toggles',
  render: () => html`<div style="max-width:760px"><mm-metadata-viewer label="Metadata of orders_daily" .metadata=${dbt}></mm-metadata-viewer></div>`,
  play: async ({ canvasElement }) => {
    const v = viewerOf(canvasElement);
    await tab();
    await press('cents');
    // Lists of plain values read inline on their own row, so the match is on the macros row itself.
    await waitFor(() => expect(rowOf(v, 'metadata.depends_on.macros')).not.toBeNull());
    await expect(rowOf(v, 'metadata.unique_id')).toBeNull();
    await expect(rowOf(v, 'metadata.depends_on.macros')?.querySelector('mark')?.textContent).toBe('cents');
    await press('{Escape}');
    await waitFor(() => expect(rowOf(v, 'metadata.unique_id')).not.toBeNull());
    await tab(); // raw toggle
    await press('{Enter}');
    await waitFor(() => expect(v.shadowRoot!.querySelector('mm-code-sample')).not.toBeNull());
    await expect(v.raw).toBe(true);
    await press('{Space}');
    await waitFor(() => expect(v.shadowRoot!.querySelector('[role=tree]')).not.toBeNull());
  },
};

export const PointerToggle: Story = {
  name: 'Pointer: clicking a row focuses it',
  render: KafkaTopic.render,
  play: async ({ canvasElement }) => {
    const v = viewerOf(canvasElement);
    await expect(rowOf(v, "metadata[\"retention.ms\"]")).not.toBeNull();
    await click(rowOf(v, 'metadata.topic')!);
    await expect(focusedPath()).toBe('metadata.topic');
  },
};
