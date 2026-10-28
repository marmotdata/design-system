import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/facet-sidebar.js';
import type { MmFacet, MmFacetOption, MmFacetSidebar } from './class.ts';

const types: MmFacetOption[] = [
  { value: 'table', label: 'Table', count: 4812, icon: 'table' },
  { value: 'view', label: 'View', count: 1206, icon: 'table-view' },
  { value: 'topic', label: 'Topic', count: 382, icon: 'stream' },
  { value: 'dashboard', label: 'Dashboard', count: 241, icon: 'dashboard' },
  { value: 'pipeline', label: 'Pipeline', count: 96, icon: 'conversion-path' },
  { value: 'agent', label: 'Agent', count: 14, icon: 'smart-toy' },
];
const providers: MmFacetOption[] = [
  { value: 'snowflake', label: 'Snowflake', count: 2904, provider: 'snowflake' },
  { value: 'postgresql', label: 'PostgreSQL', count: 1611, provider: 'postgresql' },
  { value: 'bigquery', label: 'BigQuery', count: 988, provider: 'bigquery' },
  { value: 'kafka', label: 'Kafka', count: 382, provider: 'kafka' },
  { value: 's3', label: 'Amazon S3', count: 311, provider: 's3' },
  { value: 'dbt', label: 'dbt', count: 274, provider: 'dbt' },
  { value: 'looker', label: 'Looker', count: 188, provider: 'looker' },
  { value: 'airflow', label: 'Airflow', count: 96, provider: 'airflow' },
  { value: 'mysql', label: 'MySQL', count: 41, provider: 'mysql' },
  { value: 'mongodb', label: 'MongoDB', count: 12, provider: 'mongodb' },
];
const tags: MmFacetOption[] = [
  ['pii', 'pii', 1204],
  ['finance', 'finance', 812],
  ['certified', 'certified', 640],
  ['commerce', 'commerce', 522],
  ['marketing', 'marketing', 418],
  ['gdpr', 'gdpr', 377],
  ['deprecated', 'deprecated', 201],
  ['finance-reporting', 'finance-reporting', 188],
  ['customer-360', 'customer-360', 140],
  ['ml-features', 'ml-features', 96],
  ['support', 'support', 71],
  ['experimental', 'experimental', 33],
  ['sox', 'sox', 22],
  ['tier-1', 'tier-1', 19],
].map(([value, label, count]) => ({ value: value as string, label: label as string, count: count as number }));
const owners: MmFacetOption[] = [
  { value: 'analytics-engineering', label: 'Analytics Engineering', count: 2210, icon: 'group' },
  { value: 'data-platform', label: 'Data Platform', count: 1984, icon: 'group' },
  { value: 'finance-analytics', label: 'Finance Analytics', count: 402, icon: 'group' },
  { value: 'jane-doe', label: 'Jane Doe', count: 128, icon: 'person' },
  { value: 'support-triage-agent', label: 'support-triage-agent', count: 9, icon: 'smart-toy' },
];

const onFilter = fn();

const sidebar = (sel: Record<string, string[]> = {}) => html`<div style="width:260px;max-width:100%">
  <mm-facet-sidebar @mm-filter-change=${(e: CustomEvent) => onFilter(e.detail)}>
    <mm-facet name="type" label="Type" .options=${types} .value=${sel.type ?? []}></mm-facet>
    <mm-facet name="provider" label="Provider" .options=${providers} .value=${sel.provider ?? []}></mm-facet>
    <mm-facet name="tags" label="Tags" .options=${tags} .value=${sel.tags ?? []}></mm-facet>
    <mm-facet name="owner" label="Owner" .options=${owners} .value=${sel.owner ?? []}></mm-facet>
  </mm-facet-sidebar>
</div>`;

const meta: Meta = {
  title: 'Components/Navigation/Facet sidebar',
  component: 'mm-facet-sidebar',
  subcomponents: { 'mm-facet': 'mm-facet' } as never,
  render: () => sidebar(),
  parameters: {
    usage: {
      html: `<mm-facet-sidebar>
  <mm-facet name="type" label="Type"
    options='[{"value":"table","label":"Table","count":4812,"icon":"table"},{"value":"topic","label":"Topic","count":382,"icon":"stream"}]'></mm-facet>
  <mm-facet name="provider" label="Provider"
    options='[{"value":"snowflake","label":"Snowflake","count":2904,"provider":"snowflake"}]'></mm-facet>
</mm-facet-sidebar>`,
      react: `import { MmFacetSidebar, MmFacet } from '@marmotdata/react';

<MmFacetSidebar onMmFilterChange={(e) => setFilters(e.detail.facets)}>
  <MmFacet name="type" label="Type" options={typeOptions} value={filters.type ?? []} />
  <MmFacet name="provider" label="Provider" options={providerOptions} value={filters.provider ?? []} />
</MmFacetSidebar>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/facet-sidebar.js';
  let filters = $state<Record<string, string[]>>({});
</script>

<mm-facet-sidebar onmm-filter-change={(e) => (filters = e.detail.facets)}>
  <mm-facet name="type" label="Type" options={typeOptions} value={filters.type ?? []}></mm-facet>
  <mm-facet name="provider" label="Provider" options={providerOptions} value={filters.provider ?? []}></mm-facet>
</mm-facet-sidebar>`,
    },
  },
};
export default meta;
type Story = StoryObj;

const sb = (root: HTMLElement) => root.querySelector('mm-facet-sidebar') as MmFacetSidebar;
const facet = (root: HTMLElement, name: string) => root.querySelector(`mm-facet[name="${name}"]`) as MmFacet;
const boxes = (f: MmFacet) => [...f.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
const settle = async (root: HTMLElement) => {
  await sb(root).updateComplete;
  await Promise.all([...root.querySelectorAll('mm-facet')].map((f) => f.updateComplete));
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(sb(canvasElement).shadowRoot!.querySelector('h2')!.textContent!.trim()).toBe('Filters');
    // Five shown, the rest behind "Show 5 more".
    await expect(boxes(facet(canvasElement, 'provider'))).toHaveLength(5);
    await expect(facet(canvasElement, 'provider').shadowRoot!.querySelector('.more')!.textContent!.trim()).toBe('Show 5 more');
    await expect(boxes(facet(canvasElement, 'type'))[0]).toHaveAccessibleName('Table 4,812');
    // Tags has more than 12 options, so it gets a filter field.
    await expect(facet(canvasElement, 'tags').shadowRoot!.querySelector('mm-search-field')).not.toBeNull();
  },
};

export const WithSelection: Story = {
  name: 'Filters applied',
  render: () => sidebar({ type: ['table', 'view'], provider: ['snowflake'], owner: ['analytics-engineering'] }),
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const root = sb(canvasElement).shadowRoot!;
    await expect(root.querySelector('[role="status"]')!.textContent!.trim()).toBe('4 filters applied');
    await expect(root.querySelectorAll('mm-filter-pill')).toHaveLength(4);
  },
};

export const KeyboardToggle: Story = {
  name: 'Keyboard: toggle checkboxes',
  play: async ({ canvasElement }) => {
    onFilter.mockClear();
    await settle(canvasElement);
    const type = facet(canvasElement, 'type');
    await tab();
    await expect(deepActive()).toBe(type.shadowRoot!.querySelector('.toggle'));
    await tab();
    await expect(deepActive()).toBe(boxes(type)[0]);
    await press('{Space}');
    await expect(onFilter).toHaveBeenLastCalledWith({ facets: { type: ['table'], provider: [], tags: [], owner: [] } });
    await tab();
    await tab();
    await press('{Space}');
    await expect(onFilter).toHaveBeenLastCalledWith({ facets: { type: ['table', 'topic'], provider: [], tags: [], owner: [] } });
    await settle(canvasElement);
    await expect(sb(canvasElement).shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).toBe('2 filters applied');
    // Untick.
    await press('{Space}');
    await expect(type.value).toEqual(['table']);
  },
};

export const KeyboardShowMore: Story = {
  name: 'Keyboard: show more',
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const provider = facet(canvasElement, 'provider');
    const more = provider.shadowRoot!.querySelector<HTMLElement>('.more')!;
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    more.focus();
    await press('{Enter}');
    await waitFor(() => expect(boxes(provider)).toHaveLength(10));
    // Focus moves to the first newly shown option.
    await expect(deepActive()).toBe(boxes(provider)[5]);
    await expect(deepActive()).toHaveAccessibleName('dbt 274');
    const less = provider.shadowRoot!.querySelector<HTMLElement>('.more')!;
    await expect(less).toHaveAttribute('aria-expanded', 'true');
    await expect(less.textContent!.trim()).toBe('Show fewer');
    less.focus();
    await press('{Space}');
    await waitFor(() => expect(boxes(provider)).toHaveLength(5));
  },
};

export const KeyboardFilterField: Story = {
  name: 'Keyboard: filter a long facet',
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const tagsFacet = facet(canvasElement, 'tags');
    const field = tagsFacet.shadowRoot!.querySelector('mm-search-field')!;
    const input = field.shadowRoot!.querySelector('input')!;
    await expect(input).toHaveAccessibleName('Filter tags');
    input.focus();
    await press('fin');
    await waitFor(() => expect(boxes(tagsFacet).map((b) => b.value)).toEqual(['finance', 'finance-reporting']));
    // Past the field's clear button to the first match.
    await tab();
    await tab();
    await press('{Space}');
    await expect(tagsFacet.value).toEqual(['finance']);
    input.focus();
    await press('zzz');
    await waitFor(() => expect(tagsFacet.shadowRoot!.querySelector('.none')!.textContent).toBe('No tags match “finzzz”.'));
  },
};

export const KeyboardCollapse: Story = {
  name: 'Keyboard: collapse a facet',
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const owner = facet(canvasElement, 'owner');
    const toggle = owner.shadowRoot!.querySelector<HTMLElement>('.toggle')!;
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    toggle.focus();
    await press('{Enter}');
    await owner.updateComplete;
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(owner.shadowRoot!.querySelector('.body')).not.toBeVisible();
    await press('{Space}');
    await owner.updateComplete;
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  },
};

export const KeyboardClear: Story = {
  name: 'Keyboard: clear, remove and clear all',
  render: () => sidebar({ type: ['table'], provider: ['snowflake', 'kafka'] }),
  play: async ({ canvasElement }) => {
    onFilter.mockClear();
    await settle(canvasElement);
    const root = sb(canvasElement).shadowRoot!;
    // Remove the first applied pill; focus moves to the next one.
    const first = root.querySelector('mm-filter-pill')!;
    const x = first.shadowRoot!.querySelector<HTMLElement>('.x')!;
    await expect(x).toHaveAccessibleName(/Type: Table/);
    x.focus();
    await press('{Enter}');
    await expect(onFilter).toHaveBeenLastCalledWith({ facets: { type: [], provider: ['snowflake', 'kafka'], tags: [], owner: [] } });
    await settle(canvasElement);
    await waitFor(() => expect(deepActive()?.getRootNode()).toBe(root.querySelector('mm-filter-pill')!.shadowRoot));
    // Clear one facet.
    const clear = facet(canvasElement, 'provider').shadowRoot!.querySelector<HTMLElement>('.text-btn')!;
    await expect(clear).toHaveAccessibleName('Clear Provider filters');
    clear.focus();
    await press('{Enter}');
    await expect(facet(canvasElement, 'provider').value).toEqual([]);
    // Clear all, from a fresh selection.
    facet(canvasElement, 'owner').setValue(['data-platform']);
    await settle(canvasElement);
    const all = root.querySelector<HTMLElement>('.text-btn')!;
    all.focus();
    await press('{Enter}');
    await expect(onFilter).toHaveBeenLastCalledWith({ facets: { type: [], provider: [], tags: [], owner: [] } });
    await settle(canvasElement);
    await expect(deepActive()).toBe(root.querySelector('h2'));
    await expect(all).not.toBeVisible();
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };

export const Empty: Story = {
  name: 'Empty facet',
  render: () => html`<div style="width:260px"><mm-facet-sidebar>
    <mm-facet name="type" label="Type" .options=${types}></mm-facet>
    <mm-facet name="tags" label="Tags" .options=${[]}></mm-facet>
  </mm-facet-sidebar></div>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<div style="width:240px"><mm-facet-sidebar>
    <mm-facet name="schema" label="Schema" .options=${[
      { value: 'a', label: 'analytics.marts.customer_lifetime_value_monthly_snapshot', count: 1284019 },
      { value: 'b', label: 'shop.public.orders_daily_rollup_v2_backfill', count: 412 },
      { value: 'c', label: 'raw.stripe.balance_transactions', count: 98 },
    ]} .value=${['a']}></mm-facet>
  </mm-facet-sidebar></div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => sidebar({ type: ['table'] }) };
export const CompactDensity: Story = { name: 'Compact density', globals: { density: 'compact' } };
export const BothThemes: Story = {
  render: () => themes(html`<mm-facet-sidebar heading="Filters">
    <mm-facet name="type" label="Type" .options=${types} .value=${['table']}></mm-facet>
    <mm-facet name="provider" label="Provider" .options=${providers}></mm-facet>
  </mm-facet-sidebar>`),
  play: async ({ canvasElement }) => {
    // Two regions on one page need different names.
    const [light, peat] = [...canvasElement.querySelectorAll('mm-facet-sidebar')];
    light!.heading = 'Filters (Light)';
    peat!.heading = 'Filters (Peat)';
    await Promise.all([light!.updateComplete, peat!.updateComplete]);
  },
};
