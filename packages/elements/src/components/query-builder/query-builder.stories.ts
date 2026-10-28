import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/query-builder.js';
import type { MmQueryBuilder } from '@marmotdata/elements/query-builder.js';
import type { SearchBarField } from '@marmotdata/elements/search-bar.js';

const fields: SearchBarField[] = [
  { value: 'type', label: 'Type', values: [{ value: 'table', label: 'Table' }, { value: 'view', label: 'View' }, { value: 'topic', label: 'Topic' }, { value: 'dashboard', label: 'Dashboard' }] },
  { value: 'provider', label: 'Provider', values: [{ value: 'snowflake', label: 'Snowflake' }, { value: 'postgresql', label: 'PostgreSQL' }, { value: 'bigquery', label: 'BigQuery' }, { value: 'kafka', label: 'Kafka' }] },
  { value: 'name', label: 'Name' },
  { value: 'term', label: 'Glossary term', kind: 'term', values: ['Gross merchandise value', 'Net revenue', 'Active customer'] },
  { value: 'kind', label: 'Kind', values: [{ value: 'asset', label: 'Asset' }, { value: 'glossary', label: 'Glossary term' }, { value: 'team', label: 'Team' }, { value: 'product', label: 'Data product' }] },
  { value: 'metadata.team', label: 'Team' },
  { value: 'metadata.row_count', label: 'Row count', kind: 'number' },
];

const GROUPS = 'orders AND @type = table AND @metadata.team = analytics-engineering AND ((@provider = snowflake OR @provider = bigquery) OR @metadata.row_count range [1000 TO 50000]) AND NOT @name = "*_archive*"';

type Args = { value: string; count: number };

const meta: Meta<Args> = {
  title: 'Components/Query/Query builder',
  component: 'mm-query-builder',
  args: { value: GROUPS, count: 47 },
  render: (a) => html`<mm-query-builder .value=${a.value} .count=${a.count} .fields=${fields}></mm-query-builder>`,
  parameters: {
    usage: {
      html: `<mm-search-bar label="Search the catalog"></mm-search-bar>
<!-- "Build query" on the bar opens mm-query-builder in place; Apply writes the query back. -->`,
      react: `import { MmQueryBuilder } from '@marmotdata/react';

<MmQueryBuilder value={query} fields={fields} count={count} onMmInput={(e) => countFor(e.detail.value)} onMmApply={(e) => setQuery(e.detail.value)} onMmCancel={close} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/query-builder.js';
</script>

<mm-query-builder value={query} {fields} {count} onmm-apply={(e) => (query = e.detail.value)} onmm-cancel={close}></mm-query-builder>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const builderOf = (root: Element) => root.querySelector<MmQueryBuilder>('mm-query-builder')!;

export const Default: Story = {};
export const Empty: Story = { args: { value: '', count: 6402 } };
export const Simple: Story = { name: 'One group', args: { value: '@type = table AND @provider = snowflake', count: 12 } };
export const EveryOperator: Story = {
  name: 'Every operator',
  args: {
    value: '@name contains customer AND @name = "orders_*" AND @provider != kafka AND @term = "Gross merchandise value" AND @metadata.partitions > 10 AND @metadata.size range [100 TO 500] AND @metadata.environment != test',
    count: 4,
  },
};
const metadataKeys = ['team', 'environment', 'partitions', 'size', 'retention_ms', 'schema'];
export const Suggestions: Story = {
  name: 'Field and value suggestions',
  render: (a) => html`<mm-query-builder
    .value=${a.value}
    .count=${a.count}
    .fields=${fields}
    .loadFields=${async (q: string) => metadataKeys.filter((k) => k.includes(q))}
    .loadValues=${async (_f: string, q: string) => ['analytics-engineering', 'data-platform', 'finance-analytics'].filter((v) => v.includes(q))}
  ></mm-query-builder>`,
  args: { value: '@metadata.team = analytics-engineering', count: 31 },
};
export const Narrow: Story = { render: (a) => html`<div style="max-width:28rem">${meta.render!(a, {} as never)}</div>` };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a) => themes(meta.render!(a, {} as never)) };

export const RoundTrip: Story = {
  name: 'Reads and writes the full query',
  play: async ({ canvasElement }) => {
    const b = builderOf(canvasElement);
    await b.updateComplete;
    await expect(b.draft).toBe(GROUPS);
    await expect(b.shadowRoot!.querySelectorAll('.group.nested').length).toBe(2);
  },
};

const onApply = fn();
export const AddAndApply: Story = {
  name: 'Add a group and apply',
  args: { value: '@type = table', count: 23 },
  render: (a) => html`<mm-query-builder .value=${a.value} .count=${a.count} .fields=${fields} @mm-apply=${(e: CustomEvent) => onApply(e.detail.value)}></mm-query-builder>`,
  play: async ({ canvasElement }) => {
    onApply.mockClear();
    const b = builderOf(canvasElement);
    await b.updateComplete;
    const addGroup = [...b.shadowRoot!.querySelectorAll('.adds mm-button')].find((x) => x.textContent?.includes('Group'))!;
    await click(addGroup.shadowRoot!.querySelector('button')!);
    await waitFor(() => expect(b.shadowRoot!.querySelectorAll('.group.nested').length).toBe(1));
    const apply = [...b.shadowRoot!.querySelectorAll('.footer mm-button')].find((x) => x.textContent?.includes('Apply'))!;
    await click(apply.shadowRoot!.querySelector('button')!);
    await expect(onApply).toHaveBeenCalledWith('@type = table');
  },
};
