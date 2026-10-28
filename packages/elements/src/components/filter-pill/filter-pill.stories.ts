import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/filter-pill.js';
import type { MmFilterPill } from './class.ts';

type Args = { text: string; count: number; pressed: boolean; disabled: boolean; removable: boolean; facet: string };

const providerFacets = [
  { key: 'snowflake', name: 'Snowflake', n: 1284 },
  { key: 'postgresql', name: 'PostgreSQL', n: 412 },
  { key: 'bigquery', name: 'BigQuery', n: 236 },
  { key: 'kafka', name: 'Kafka', n: 87 },
  { key: 'dbt', name: 'dbt', n: 1920 },
  { key: 'airflow', name: 'Airflow', n: 14 },
];

const providerRow = (pressed: string[] = ['snowflake']) => html`<div
  role="group"
  aria-label="Provider"
  style="display:flex;flex-wrap:wrap;gap:var(--space-2)"
>
  ${providerFacets.map(
    (p) => html`<mm-filter-pill count=${p.n} ?pressed=${pressed.includes(p.key)}
      ><mm-provider-logo slot="start" provider=${p.key} size="14" decorative></mm-provider-logo>${p.name}</mm-filter-pill
    >`,
  )}
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Filter pill',
  component: 'mm-filter-pill',
  args: { text: 'Snowflake', count: 1284, pressed: false, disabled: false, removable: false, facet: '' },
  argTypes: { text: { name: 'label text (slot)' } },
  render: (a) =>
    html`<mm-filter-pill count=${a.count} facet=${a.facet} ?pressed=${a.pressed} ?disabled=${a.disabled} ?removable=${a.removable}
      >${a.text}</mm-filter-pill
    >`,
  parameters: {
    usage: {
      html: `<div role="group" aria-label="Provider">
  <mm-filter-pill count="1284" pressed>
    <mm-provider-logo slot="start" provider="snowflake" size="14" decorative></mm-provider-logo>Snowflake
  </mm-filter-pill>
  <mm-filter-pill count="412">PostgreSQL</mm-filter-pill>
</div>
<mm-filter-pill removable facet="Provider">Snowflake</mm-filter-pill>`,
      react: `import { MmFilterPill } from '@marmotdata/react';

<MmFilterPill count={1284} pressed={providers.has('snowflake')} onMmChange={(e) => toggle('snowflake', e.detail.pressed)}>
  Snowflake
</MmFilterPill>
<MmFilterPill removable facet="Provider" onMmRemove={() => clear('snowflake')}>Snowflake</MmFilterPill>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/filter-pill.js';
  let snowflake = $state(false);
</script>

<mm-filter-pill count={1284} pressed={snowflake} onmm-change={(e) => (snowflake = e.detail.pressed)}>Snowflake</mm-filter-pill>
<mm-filter-pill removable facet="Provider" onmm-remove={() => (snowflake = false)}>Snowflake</mm-filter-pill>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const inner = (p: MmFilterPill) => p.shadowRoot!.querySelector('button')!;

export const Default: Story = {};
export const Pressed: Story = { args: { pressed: true } };
export const ProviderFacets: Story = { name: 'Provider facets with counts', render: () => providerRow(['snowflake', 'dbt']) };
export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: () => providerRow() };
export const Active: Story = { parameters: { pseudo: { active: true } }, render: () => providerRow() };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(inner(canvasElement.querySelector('mm-filter-pill')!));
  },
};
export const Disabled: Story = {
  render: () => html`<div style="display:flex;gap:var(--space-2)">
    <mm-filter-pill count="0" disabled>Kafka</mm-filter-pill><mm-filter-pill count="87" pressed disabled>Kafka</mm-filter-pill>
  </div>`,
};
export const Empty: Story = {
  name: 'Empty (zero count)',
  render: () => html`<mm-filter-pill count="0"><mm-provider-logo slot="start" provider="mongodb" size="14" decorative></mm-provider-logo>MongoDB</mm-filter-pill>`,
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px;display:grid;gap:var(--space-2);justify-items:start">
    <mm-filter-pill count="1284019">analytics.marts_customer_360.customers_dim_with_lifetime_value</mm-filter-pill>
    <mm-filter-pill removable facet="Upstream">mrn://postgresql/table/shop.public.orders_daily_rollup_by_region</mm-filter-pill>
  </div>`,
};

const activeFilters = () => html`<div
  role="group"
  aria-label="Applied filters"
  style="display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center"
  @mm-remove=${(e: Event) => {
    const pill = e.target as MmFilterPill;
    const pills = [...pill.parentElement!.querySelectorAll('mm-filter-pill')];
    const next = pills[pills.indexOf(pill) + 1] ?? pills[pills.indexOf(pill) - 1];
    onRemove(pill.textContent?.trim());
    pill.remove();
    next?.focus();
  }}
>
  <mm-filter-pill removable facet="Provider"><mm-provider-logo slot="start" provider="snowflake" size="14" decorative></mm-provider-logo>Snowflake</mm-filter-pill>
  <mm-filter-pill removable facet="Tag">pii</mm-filter-pill>
  <mm-filter-pill removable facet="Owner">Data Platform</mm-filter-pill>
</div>`;
const onRemove = fn();

export const Removable: Story = { name: 'Removable (applied filters)', render: activeFilters };
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="display:flex;gap:var(--space-2)">
    <mm-filter-pill count="1284" pressed><mm-provider-logo slot="start" provider="snowflake" size="14" decorative></mm-provider-logo>سنوفليك</mm-filter-pill>
    <mm-filter-pill removable facet="المزوّد">كافكا</mm-filter-pill>
  </div>`,
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-3)">${providerRow(['snowflake'])}${activeFilters()}</div>`),
};

const onChange = fn();
export const KeyboardToggle: Story = {
  name: 'Keyboard: Enter and Space toggle',
  render: () => html`<div @mm-change=${(e: CustomEvent) => onChange(e.detail.pressed)}>${providerRow([])}</div>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const pills = [...canvasElement.querySelectorAll('mm-filter-pill')] as MmFilterPill[];
    await tab();
    await expect(deepActive()).toBe(inner(pills[0]!));
    await press('{Space}');
    await expect(pills[0]!.pressed).toBe(true);
    await expect(inner(pills[0]!)).toHaveAttribute('aria-pressed', 'true');
    await expect(onChange).toHaveBeenLastCalledWith(true);
    await press('{Enter}');
    await expect(pills[0]!.pressed).toBe(false);
    await expect(onChange).toHaveBeenLastCalledWith(false);
    await tab();
    await expect(deepActive()).toBe(inner(pills[1]!));
    await click(inner(pills[2]!));
    await expect(pills[2]!.pressed).toBe(true);
    await expect(inner(pills[2]!)).toHaveAccessibleName('BigQuery 236');
  },
};

export const DisabledBlocksToggle: Story = {
  render: () => html`<mm-filter-pill count="87" disabled @mm-change=${onChange}>Kafka</mm-filter-pill>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const p = canvasElement.querySelector('mm-filter-pill')!;
    inner(p).click();
    await expect(p.pressed).toBe(false);
    await expect(onChange).not.toHaveBeenCalled();
  },
};

export const KeyboardRemove: Story = {
  name: 'Keyboard: remove an applied filter',
  render: activeFilters,
  play: async ({ canvasElement }) => {
    onRemove.mockClear();
    const remove = (p: Element) => p.shadowRoot!.querySelector('button')!;
    let pills = [...canvasElement.querySelectorAll('mm-filter-pill')];
    await expect(remove(pills[0]!)).toHaveAttribute('aria-label', 'Remove Provider: Snowflake');
    await expect(remove(pills[1]!)).toHaveAttribute('aria-label', 'Remove Tag: pii');
    await tab();
    await expect(deepActive()).toBe(remove(pills[0]!));
    await press('{Enter}');
    await expect(onRemove).toHaveBeenCalledWith('Snowflake');
    pills = [...canvasElement.querySelectorAll('mm-filter-pill')];
    await expect(pills.length).toBe(2);
    await expect(deepActive()).toBe(remove(pills[0]!));
    await press('{Space}');
    await expect(onRemove).toHaveBeenLastCalledWith('pii');
  },
};
