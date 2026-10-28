import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/tabs.js';
import type { MmTabs } from './class.ts';

type Args = { activation: 'auto' | 'manual'; maxVisible: number; value: string };

const panel = (value: string, text: string) =>
  html`<mm-tab-panel value=${value}><p style="margin:0;font:var(--text-dense);color:var(--mm-text-2)">${text}</p></mm-tab-panel>`;

const assetTabs = (a: Partial<Args> = {}, onChange?: (e: CustomEvent) => void) => html`<mm-tabs
  label="Asset views"
  activation=${a.activation ?? 'auto'}
  max-visible=${a.maxVisible ?? 6}
  value=${a.value ?? 'documentation'}
  @mm-tab-change=${onChange ?? (() => {})}
>
  <mm-tab value="documentation" icon="description">Documentation</mm-tab>
  <mm-tab value="metadata" icon="data-object">Metadata</mm-tab>
  <mm-tab value="schema" icon="schema" count="14">Schema</mm-tab>
  <mm-tab value="lineage" icon="account-tree">Lineage</mm-tab>
  <mm-tab value="runs" icon="history" count="30">Run history</mm-tab>
  <mm-tab value="queries" icon="terminal" count="128">Queries</mm-tab>
  <mm-tab value="environments" icon="layers">Environments</mm-tab>
  <mm-tab value="preview" icon="table-view">Preview</mm-tab>
  <mm-tab value="contents" icon="folder">Contents</mm-tab>
  ${panel('documentation', 'Daily order totals per customer, rebuilt at 04:00 UTC from shop.public.orders.')}
  ${panel('metadata', 'Owner: Analytics Engineering. Domain: Commerce. 1,284,019 rows.')}
  ${panel('schema', '14 columns, including order_id, customer_id and order_total.')}
  ${panel('lineage', 'Upstream: shop.public.orders. Downstream: revenue_weekly, churn-features.')}
  ${panel('runs', '30 runs in the last 30 days. Last run succeeded in 412 ms.')}
  ${panel('queries', '128 queries in the last 7 days, most often from Jane Doe.')}
  ${panel('environments', 'Production and staging.')}
  ${panel('preview', 'The first 50 rows of orders_daily.')}
  ${panel('contents', 'Files in s3://shop-exports/orders_daily/.')}
</mm-tabs>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Tabs',
  component: 'mm-tabs',
  subcomponents: { 'mm-tab': 'mm-tab', 'mm-tab-panel': 'mm-tab-panel' } as never,
  args: { activation: 'auto', maxVisible: 6, value: 'documentation' },
  argTypes: { activation: { control: 'inline-radio', options: ['auto', 'manual'] } },
  render: (a) => assetTabs(a),
  parameters: {
    usage: {
      html: `<mm-tabs label="Asset views" value="schema">
  <mm-tab value="documentation" icon="description">Documentation</mm-tab>
  <mm-tab value="schema" icon="schema" count="14">Schema</mm-tab>
  <mm-tab value="lineage" icon="account-tree">Lineage</mm-tab>
  <mm-tab value="runs" icon="history" count="30">Run history</mm-tab>
  <mm-tab-panel value="documentation">…</mm-tab-panel>
  <mm-tab-panel value="schema">…</mm-tab-panel>
  <mm-tab-panel value="lineage">…</mm-tab-panel>
  <mm-tab-panel value="runs">…</mm-tab-panel>
</mm-tabs>`,
      react: `import { MmTabs, MmTab, MmTabPanel } from '@marmotdata/react';

<MmTabs label="Asset views" value={view} activation="manual" onMmTabChange={(e) => setView(e.detail.value)}>
  <MmTab value="schema" icon="schema" count={14}>Schema</MmTab>
  <MmTab value="lineage" icon="account-tree">Lineage</MmTab>
  <MmTabPanel value="schema"><SchemaTable /></MmTabPanel>
  <MmTabPanel value="lineage"><LineageCanvas /></MmTabPanel>
</MmTabs>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/tabs.js';
  let view = $state('schema');
</script>

<mm-tabs label="Asset views" value={view} activation="manual" onmm-tab-change={(e) => (view = e.detail.value)}>
  <mm-tab value="schema" icon="schema" count={14}>Schema</mm-tab>
  <mm-tab value="lineage" icon="account-tree">Lineage</mm-tab>
  <mm-tab-panel value="schema">…</mm-tab-panel>
  <mm-tab-panel value="lineage">…</mm-tab-panel>
</mm-tabs>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const tabsOf = (root: HTMLElement) => [...root.querySelectorAll('mm-tab')];
const byValue = (root: HTMLElement, v: string) => root.querySelector(`mm-tab[value="${v}"]`)!;
const panelOf = (root: HTMLElement, v: string) => root.querySelector(`mm-tab-panel[value="${v}"]`)!;
const ready = async (root: HTMLElement) => {
  const el = root.querySelector('mm-tabs')!;
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await el.updateComplete;
  return el as MmTabs;
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = await ready(canvasElement);
    // Nine tabs with max-visible 6: six show, three move into More.
    await waitFor(() => expect(tabsOf(canvasElement).filter((t) => !t.hasAttribute('data-overflow')).length).toBe(6));
    await expect(el.shadowRoot!.querySelector('[role="tablist"]')).toHaveAttribute('aria-label', 'Asset views');
    await expect(byValue(canvasElement, 'documentation')).toHaveAttribute('aria-selected', 'true');
    await expect(panelOf(canvasElement, 'documentation')).toHaveAttribute('role', 'tabpanel');
    await expect(panelOf(canvasElement, 'documentation')).toHaveAttribute('aria-labelledby', byValue(canvasElement, 'documentation').id);
  },
};

export const FewTabs: Story = {
  name: 'Without overflow',
  render: () => html`<mm-tabs label="Asset views" value="schema">
    <mm-tab value="documentation" icon="description">Documentation</mm-tab>
    <mm-tab value="schema" icon="schema" count="14">Schema</mm-tab>
    <mm-tab value="lineage" icon="account-tree">Lineage</mm-tab>
    <mm-tab value="runs" icon="history" count="30">Run history</mm-tab>
    ${panel('documentation', 'Daily order totals per customer.')}${panel('schema', '14 columns.')}${panel('lineage', 'Two upstream sources.')}${panel('runs', '30 runs.')}
  </mm-tabs>`,
  play: async ({ canvasElement }) => {
    const el = await ready(canvasElement);
    await expect(el.shadowRoot!.querySelector('.more')).toHaveAttribute('hidden');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: FewTabs.render };

export const Focus: Story = {
  render: FewTabs.render,
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await tab();
    await expect(deepActive()).toBe(byValue(canvasElement, 'schema'));
  },
};

export const Disabled: Story = {
  name: 'Disabled tab',
  render: () => html`<mm-tabs label="Pipeline views" value="runs">
    <mm-tab value="runs" icon="history" count="30">Runs</mm-tab>
    <mm-tab value="config" icon="tune" disabled>Configuration</mm-tab>
    <mm-tab value="logs" icon="terminal">Logs</mm-tab>
    ${panel('runs', '30 runs of postgres-prod in the last 30 days.')}${panel('config', 'Only Data Platform can view the configuration.')}${panel('logs', 'Logs for the last run.')}
  </mm-tabs>`,
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await tab();
    await press('{ArrowRight}');
    // The disabled tab is skipped.
    await expect(deepActive()).toBe(byValue(canvasElement, 'logs'));
    await expect(byValue(canvasElement, 'config')).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Empty: Story = {
  name: 'Empty panel',
  render: () => html`<mm-tabs label="Asset views" value="queries">
    <mm-tab value="schema" icon="schema" count="14">Schema</mm-tab>
    <mm-tab value="queries" icon="terminal" count="0">Queries</mm-tab>
    ${panel('schema', '14 columns.')}
    ${panel('queries', 'No one has queried orders_daily in the last 7 days. Queries run through Marmot appear here.')}
  </mm-tabs>`,
};

const onChange = fn();

export const KeyboardAuto: Story = {
  name: 'Keyboard: automatic activation',
  render: () => assetTabs({}, (e) => onChange(e.detail)),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const el = await ready(canvasElement);
    await tab();
    await expect(deepActive()).toBe(byValue(canvasElement, 'documentation'));
    await press('{ArrowRight}');
    await expect(deepActive()).toBe(byValue(canvasElement, 'metadata'));
    await expect(el.value).toBe('metadata');
    await expect(panelOf(canvasElement, 'metadata')).toBeVisible();
    await expect(panelOf(canvasElement, 'documentation')).not.toBeVisible();
    await expect(onChange).toHaveBeenLastCalledWith({ value: 'metadata' });
    await press('{End}');
    // End goes to the last visible tab; the rest are in More.
    await expect(el.value).toBe('queries');
    await press('{ArrowRight}');
    await expect(el.value).toBe('documentation');
    await press('{ArrowLeft}');
    await expect(el.value).toBe('queries');
    await press('{Home}');
    await expect(el.value).toBe('documentation');
    // Only the selected tab is a tab stop; Tab moves on to the More button.
    await tab();
    await expect(deepActive()?.closest?.('mm-menu-button') ?? deepActive()?.getRootNode()).toBeTruthy();
    await expect((byValue(canvasElement, 'metadata') as HTMLElement).tabIndex).toBe(-1);
  },
};

export const KeyboardManual: Story = {
  name: 'Keyboard: manual activation',
  args: { activation: 'manual' },
  render: (a) => assetTabs(a, (e) => onChange(e.detail)),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const el = await ready(canvasElement);
    await tab();
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(deepActive()).toBe(byValue(canvasElement, 'lineage'));
    // Focus moved, selection did not: the heavy lineage panel has not rendered.
    await expect(el.value).toBe('documentation');
    await expect(onChange).not.toHaveBeenCalled();
    await press('{Enter}');
    await expect(el.value).toBe('lineage');
    await expect(onChange).toHaveBeenCalledWith({ value: 'lineage' });
    await press('{ArrowLeft}');
    await press('{Space}');
    await expect(el.value).toBe('schema');
  },
};

export const KeyboardOverflow: Story = {
  name: 'Keyboard: More menu',
  render: () => assetTabs({}, (e) => onChange(e.detail)),
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const el = await ready(canvasElement);
    await tab();
    await tab();
    const more = el.shadowRoot!.querySelector('mm-menu-button')!;
    await expect(deepActive()).toBe(more.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
    await press('{Enter}');
    const menu = more.querySelector('mm-menu')!;
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    const items = [...menu.querySelectorAll('mm-menu-item')];
    await expect(items.map((i) => i.textContent?.trim())).toEqual(['Environments', 'Preview', 'Contents']);
    await expect(deepActive()).toBe(items[0]);
    await press('{ArrowDown}');
    await press('{Enter}');
    await waitFor(() => expect(el.value).toBe('preview'));
    await expect(onChange).toHaveBeenCalledWith({ value: 'preview' });
    // The chosen tab swaps into the strip, selected and focused.
    const preview = byValue(canvasElement, 'preview');
    await waitFor(() => expect(preview).not.toHaveAttribute('data-overflow'));
    await expect(deepActive()).toBe(preview);
    await expect(preview).toHaveAttribute('aria-selected', 'true');
    await expect(panelOf(canvasElement, 'preview')).toBeVisible();
    await expect(byValue(canvasElement, 'queries')).toHaveAttribute('data-overflow');
  },
};

export const NarrowOverflow: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:420px;max-width:100%">${assetTabs({ maxVisible: 9 })}</div>`,
  play: async ({ canvasElement }) => {
    await ready(canvasElement);
    await waitFor(() => expect(tabsOf(canvasElement).filter((t) => t.hasAttribute('data-overflow')).length).toBeGreaterThan(0));
  },
};

export const LongLabels: Story = {
  name: 'Long labels',
  render: () => html`<div style="width:640px;max-width:100%"><mm-tabs label="Data product views" value="contract">
    <mm-tab value="docs" icon="description">Documentation and onboarding notes</mm-tab>
    <mm-tab value="contract" icon="contract">customer_lifetime_value_monthly_snapshot contract</mm-tab>
    <mm-tab value="assets" icon="dataset" count="1284019">Assets</mm-tab>
    <mm-tab value="rules" icon="rule" count="12">Rules</mm-tab>
    ${panel('docs', 'How the Commerce domain publishes customer data.')}
    ${panel('contract', 'Contract for mrn://snowflake/table/analytics.marts.customer_lifetime_value_monthly_snapshot.')}
    ${panel('assets', 'Assets in this product.')}${panel('rules', 'Rules that keep this product healthy.')}
  </mm-tabs></div>`,
};

export const LinkTabs: Story = {
  name: 'Link tabs (navigation)',
  render: () => html`<mm-tabs label="Asset sections" value="schema" @click=${(e: Event) => e.preventDefault()}>
    <mm-tab value="documentation" icon="description" href="#/assets/orders_daily/documentation">Documentation</mm-tab>
    <mm-tab value="schema" icon="schema" count="14" href="#/assets/orders_daily/schema">Schema</mm-tab>
    <mm-tab value="lineage" icon="account-tree" href="#/assets/orders_daily/lineage">Lineage</mm-tab>
    <mm-tab value="runs" icon="history" count="30" href="#/assets/orders_daily/runs">Run history</mm-tab>
    <mm-tab-panel value="schema"><p style="margin:0;font:var(--text-dense)">14 columns, rendered by the /schema route.</p></mm-tab-panel>
  </mm-tabs>`,
  play: async ({ canvasElement }) => {
    const el = await ready(canvasElement);
    await expect(el.shadowRoot!.querySelector('nav')).toHaveAttribute('aria-label', 'Asset sections');
    await expect(el.shadowRoot!.querySelector('[role="tablist"]')).toBeNull();
    const schema = byValue(canvasElement, 'schema');
    await expect(schema).not.toHaveAttribute('role');
    await expect(schema.shadowRoot!.querySelector('a')).toHaveAttribute('aria-current', 'page');
    // Each link is its own tab stop.
    await tab();
    await tab();
    await expect(deepActive()).toBe(schema.shadowRoot!.querySelector('a'));
    await press('{Enter}');
  },
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-tabs label="عروض الأصل" value="docs">
    <mm-tab value="docs" icon="description">التوثيق</mm-tab>
    <mm-tab value="schema" icon="schema" count="14">المخطط</mm-tab>
    <mm-tab value="lineage" icon="account-tree">النسب</mm-tab>
    ${panel('docs', 'orders_daily')}${panel('schema', '14')}${panel('lineage', 'shop.public.orders')}
  </mm-tabs>`,
  play: async ({ canvasElement }) => {
    const el = await ready(canvasElement);
    await tab();
    // In right-to-left, ArrowLeft moves forward.
    await press('{ArrowLeft}');
    await expect(el.value).toBe('schema');
    await press('{ArrowRight}');
    await expect(el.value).toBe('docs');
  },
};

export const CompactDensity: Story = { name: 'Compact density', globals: { density: 'compact' }, render: FewTabs.render };

export const BothThemes: Story = { render: () => themes(assetTabs({ value: 'schema' })) };
