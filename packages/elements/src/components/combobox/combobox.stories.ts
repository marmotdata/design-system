import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/combobox.js';
import type { MmCombobox, MmOptionData } from './class.ts';

/** A slice of a realistic catalog: name, MRN, provider and type. */
const assets: { name: string; mrn: string; provider: string; type: string }[] = [
  { name: 'orders_daily', mrn: 'mrn://postgresql/table/shop.public.orders_daily', provider: 'postgresql', type: 'table' },
  { name: 'orders', mrn: 'mrn://postgresql/table/shop.public.orders', provider: 'postgresql', type: 'table' },
  { name: 'order_items', mrn: 'mrn://postgresql/table/shop.public.order_items', provider: 'postgresql', type: 'table' },
  { name: 'shop.orders.v2', mrn: 'mrn://kafka/topic/shop.orders.v2', provider: 'kafka', type: 'topic' },
  { name: 'shop.payments.v1', mrn: 'mrn://kafka/topic/shop.payments.v1', provider: 'kafka', type: 'topic' },
  { name: 'customers_dim', mrn: 'mrn://snowflake/table/analytics.marts.customers_dim', provider: 'snowflake', type: 'table' },
  { name: 'dim_products', mrn: 'mrn://snowflake/table/analytics.marts.dim_products', provider: 'snowflake', type: 'table' },
  { name: 'customer_events', mrn: 'mrn://bigquery/table/analytics.events.customer_events', provider: 'bigquery', type: 'table' },
  { name: 'fct_revenue_monthly', mrn: 'mrn://bigquery/table/finance.reporting.fct_revenue_monthly', provider: 'bigquery', type: 'table' },
  { name: 'stg_orders', mrn: 'mrn://dbt/model/analytics.staging.stg_orders', provider: 'dbt', type: 'model' },
  { name: 'orders_daily_load', mrn: 'mrn://airflow/dag/orders_daily_load', provider: 'airflow', type: 'dag' },
  { name: 'refunds', mrn: 'mrn://redshift/table/finance.public.refunds', provider: 'redshift', type: 'table' },
  {
    name: 'customers_dim_with_lifetime_value_and_marketing_consent_v3',
    mrn: 'mrn://snowflake/table/analytics.marts_customer_360.customers_dim_with_lifetime_value_and_marketing_consent_v3',
    provider: 'snowflake',
    type: 'table',
  },
];

const toOption = (a: (typeof assets)[number]): MmOptionData => ({
  value: a.mrn,
  label: a.name,
  description: a.mrn,
  mono: true,
  meta: a.type,
  provider: a.provider,
});

/** Searches the catalog with artificial latency, and honours the abort signal. */
const catalogSearch =
  (latency: number, fail = false) =>
  (q: string, signal: AbortSignal) =>
    new Promise<MmOptionData[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (fail) return reject(new Error('Search service unavailable'));
        const needle = q.trim().toLowerCase();
        resolve(assets.filter((a) => !needle || a.name.includes(needle) || a.mrn.includes(needle)).slice(0, 8).map(toOption));
      }, latency);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

const providers = html`
  <mm-option value="postgresql"><mm-provider-logo slot="logo" provider="postgresql" decorative></mm-provider-logo>PostgreSQL</mm-option>
  <mm-option value="snowflake"><mm-provider-logo slot="logo" provider="snowflake" decorative></mm-provider-logo>Snowflake</mm-option>
  <mm-option value="bigquery"><mm-provider-logo slot="logo" provider="bigquery" decorative></mm-provider-logo>BigQuery</mm-option>
  <mm-option value="kafka"><mm-provider-logo slot="logo" provider="kafka" decorative></mm-provider-logo>Kafka</mm-option>
  <mm-option value="mysql" disabled><mm-provider-logo slot="logo" provider="mysql" decorative></mm-provider-logo>MySQL</mm-option>
  <mm-option value="redshift"><mm-provider-logo slot="logo" provider="redshift" decorative></mm-provider-logo>Amazon Redshift</mm-option>
`;

type Args = { label: string; placeholder: string; help: string; error: string; disabled: boolean; required: boolean; allowCustom: boolean };

const meta: Meta<Args> = {
  title: 'Components/Forms/Combobox',
  component: 'mm-combobox',
  args: { label: 'Provider', placeholder: 'Search providers', help: '', error: '', disabled: false, required: false, allowCustom: false },
  render: (a) => html`<mm-combobox
    name="provider"
    label=${a.label}
    placeholder=${a.placeholder}
    help=${a.help}
    error=${a.error}
    ?disabled=${a.disabled}
    ?required=${a.required}
    ?allow-custom=${a.allowCustom}
    >${providers}</mm-combobox
  >`,
  parameters: {
    usage: {
      html: `<mm-combobox name="upstream" label="Upstream asset" placeholder="Search the catalog"></mm-combobox>
<script>
  document.querySelector('mm-combobox').loader = (query, signal) =>
    fetch('/api/v1/assets/search?q=' + encodeURIComponent(query), { signal })
      .then((r) => r.json())
      .then((r) => r.assets.map((a) => ({ value: a.mrn, label: a.name, description: a.mrn, mono: true, provider: a.provider, meta: a.type })));
</script>`,
      react: `import { MmCombobox } from '@marmotdata/react';

<MmCombobox
  name="upstream"
  label="Upstream asset"
  placeholder="Search the catalog"
  loader={searchAssets}
  onMmChange={(e) => setUpstream(e.detail.value)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/combobox.js';
  import { searchAssets } from '$lib/catalog';
  let upstream = $state('');
</script>

<mm-combobox
  name="upstream"
  label="Upstream asset"
  placeholder="Search the catalog"
  loader={searchAssets}
  onmm-change={(e) => (upstream = e.detail.value)}
></mm-combobox>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-combobox') as MmCombobox;
const input = (c: MmCombobox) => c.shadowRoot!.querySelector('input')!;
const isOpen = (c: MmCombobox) => input(c).getAttribute('aria-expanded') === 'true';
const activeOf = (c: MmCombobox) =>
  (c.querySelector('mm-option[active]') ?? c.shadowRoot!.querySelector('mm-option[active]'))?.getAttribute('label') ||
  c.querySelector('mm-option[active]')?.textContent?.trim();
const status = (c: MmCombobox) => c.shadowRoot!.querySelector('.status');

export const Default: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(input(host(canvasElement)));
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const ErrorState: Story = { name: 'Error', args: { required: true, error: 'Choose the provider this plugin reads from.' } };
export const WithHelp: Story = { name: 'With help text', args: { help: 'Only providers with an installed plugin are listed.' } };

export const Filtering: Story = {
  name: 'Filtering with matched text',
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    input(c).focus();
    await press('sn');
    await waitFor(() => expect(isOpen(c)).toBe(true));
    const visible = [...c.querySelectorAll('mm-option')].filter((o) => !o.hidden);
    await expect(visible.map((o) => o.textContent?.trim())).toEqual(['Snowflake']);
    await expect(visible[0]!.shadowRoot!.querySelector('mark')).toHaveTextContent('Sn');
  },
};

const searchSpy = fn(catalogSearch(250));
export const AsyncSearch: Story = {
  name: 'Async catalog search',
  render: () => html`<mm-combobox
    name="upstream"
    label="Upstream asset"
    placeholder="Search the catalog"
    help="Search by asset name or MRN."
    style="width:440px"
    .loader=${searchSpy}
  ></mm-combobox>`,
  play: async ({ canvasElement }) => {
    searchSpy.mockClear();
    const c = host(canvasElement);
    input(c).focus();
    await press('orders');
    await waitFor(() => expect(c.shadowRoot!.querySelectorAll('mm-option').length).toBeGreaterThan(0), { timeout: 2000 });
    // Debounced: one request for the whole word, not one per keystroke.
    await expect(searchSpy).toHaveBeenCalledTimes(1);
    await expect(searchSpy.mock.calls[0]![0]).toBe('orders');
    await press('{ArrowDown}');
    await expect(activeOf(c)).toBe('orders_daily');
    await press('{ArrowDown}{Enter}');
    await waitFor(() => expect(c.value).toBe('mrn://postgresql/table/shop.public.orders'));
    await expect(input(c).value).toBe('orders');
    await expect(isOpen(c)).toBe(false);
  },
};

const abortSpy = fn(catalogSearch(400));
export const AbortsStaleRequests: Story = {
  name: 'Async: aborts stale requests',
  render: () => html`<mm-combobox label="Upstream asset" .loader=${abortSpy}></mm-combobox>`,
  play: async ({ canvasElement }) => {
    abortSpy.mockClear();
    const c = host(canvasElement);
    input(c).focus();
    await press('cu');
    await waitFor(() => expect(abortSpy).toHaveBeenCalledTimes(1), { timeout: 1000 });
    await press('s');
    await waitFor(() => expect(abortSpy).toHaveBeenCalledTimes(2), { timeout: 1000 });
    await expect((abortSpy.mock.calls[0]![1] as AbortSignal).aborted).toBe(true);
    await waitFor(() => expect(c.shadowRoot!.querySelector('mm-option')).toHaveAttribute('label', 'customers_dim'), { timeout: 2000 });
  },
};

export const Loading: Story = {
  name: 'Loading (slow loader)',
  render: () => html`<mm-combobox label="Upstream asset" placeholder="Search the catalog" style="width:440px" .loader=${catalogSearch(2500)}></mm-combobox>`,
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    input(c).focus();
    await press('orders');
    await waitFor(() => expect(status(c)).toHaveTextContent('Searching'), { timeout: 1500 });
  },
};

const failSpy = fn(catalogSearch(150, true));
export const ErrorWithRetry: Story = {
  name: 'Load error with retry',
  render: () => html`<mm-combobox label="Upstream asset" placeholder="Search the catalog" style="width:440px" .loader=${failSpy}></mm-combobox>`,
  play: async ({ canvasElement }) => {
    failSpy.mockClear();
    const c = host(canvasElement);
    input(c).focus();
    await press('orders');
    await waitFor(() => expect(status(c)).toHaveTextContent('Results could not be loaded.'), { timeout: 2000 });
    await expect(status(c)).toHaveAttribute('role', 'alert');
    const calls = failSpy.mock.calls.length;
    await press('{Enter}');
    await waitFor(() => expect(failSpy.mock.calls.length).toBe(calls + 1));
    await waitFor(() => expect(c.shadowRoot!.querySelector('.retry')).not.toBeNull(), { timeout: 2000 });
    await click(c.shadowRoot!.querySelector('.retry')!);
    await waitFor(() => expect(failSpy.mock.calls.length).toBe(calls + 2));
  },
};

export const Empty: Story = {
  name: 'Empty (no results)',
  render: () => html`<mm-combobox label="Upstream asset" style="width:440px" .loader=${catalogSearch(100)}></mm-combobox>`,
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    input(c).focus();
    await press('warehouse_ledger');
    await waitFor(() => expect(status(c)).toHaveTextContent('No results'), { timeout: 2000 });
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-combobox label="Upstream asset" style="width:300px" .loader=${catalogSearch(50)}></mm-combobox>`,
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    input(c).focus();
    await press('customers_dim');
    await waitFor(() => expect(c.shadowRoot!.querySelectorAll('mm-option').length).toBe(2), { timeout: 2000 });
  },
};

export const AllowCustom: Story = {
  name: 'Free text (allow-custom)',
  render: () => html`<mm-combobox name="schema" label="Target schema" allow-custom placeholder="analytics.marts">
    <mm-option>analytics.marts</mm-option>
    <mm-option>analytics.staging</mm-option>
    <mm-option>finance.reporting</mm-option>
  </mm-combobox>`,
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    input(c).focus();
    await press('finance.audit');
    await waitFor(() => expect(status(c)).toHaveTextContent('Press Enter to use “finance.audit”.'));
    await press('{Enter}');
    await expect(c.value).toBe('finance.audit');
    await expect(isOpen(c)).toBe(false);
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'المزوّد', placeholder: 'ابحث عن مزوّد' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      <mm-combobox label="Provider" value="snowflake">${providers}</mm-combobox>
      <mm-combobox label="Provider" required error="Choose the provider this plugin reads from.">${providers}</mm-combobox>
      <mm-combobox label="Provider" disabled value="kafka">${providers}</mm-combobox>
    </div>`),
};

const onChange = fn();
export const KeyboardModel: Story = {
  name: 'Keyboard: arrows, Enter, Escape, Tab',
  render: () => html`<div style="display:flex;gap:var(--space-2);align-items:end">
    <mm-combobox label="Provider" @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}>${providers}</mm-combobox>
    <button type="button">Next</button>
  </div>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const c = host(canvasElement);
    await tab();
    await expect(deepActive()).toBe(input(c));
    // Alt+Down opens without moving the highlight.
    await press('{Alt>}{ArrowDown}{/Alt}');
    await waitFor(() => expect(isOpen(c)).toBe(true));
    await expect(activeOf(c)).toBeUndefined();
    await press('{Escape}');
    await waitFor(() => expect(isOpen(c)).toBe(false));
    // Down opens on the first option; Up opens on the last.
    await press('{ArrowDown}');
    await waitFor(() => expect(activeOf(c)).toBe('PostgreSQL'));
    await press('{ArrowDown}{ArrowDown}');
    await expect(activeOf(c)).toBe('BigQuery');
    await press('{Escape}{ArrowUp}');
    await waitFor(() => expect(activeOf(c)).toBe('Amazon Redshift'));
    await press('{ArrowUp}');
    await expect(activeOf(c)).toBe('Kafka'); // MySQL is disabled and skipped
    await press('{Enter}');
    await expect(c.value).toBe('kafka');
    await expect(onChange).toHaveBeenCalledWith('kafka');
    await expect(input(c).value).toBe('Kafka');
    // Home and End stay in the text.
    await press('{Home}');
    await expect(input(c).selectionStart).toBe(0);
    await press('{End}');
    await expect(input(c).selectionStart).toBe(5);
    // Escape with the list closed clears the value.
    await press('{Escape}');
    await expect(c.value).toBe('');
    await expect(input(c).value).toBe('');
    // Typed text that matches no option reverts when focus leaves.
    await press('kafk');
    await press('{ArrowDown}');
    await waitFor(() => expect(activeOf(c)).toBe('Kafka'));
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('button'));
    await expect(isOpen(c)).toBe(false);
    await expect(c.value).toBe('');
    await expect(input(c).value).toBe('');
  },
};

const onSubmit = fn();
export const FormSubmission: Story = {
  name: 'Form: submit, validate and reset',
  render: () => html`<form
    style="display:grid;gap:var(--space-3);justify-items:start"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-combobox name="provider" label="Provider" required value="snowflake">${providers}</mm-combobox>
    <mm-combobox name="upstream" label="Upstream asset" required .loader=${catalogSearch(50)}></mm-combobox>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <mm-combobox name="ignored" label="Disabled by its fieldset" value="kafka">${providers}</mm-combobox>
    </fieldset>
    <div style="display:flex;gap:var(--space-2)"><button type="submit">Save lineage edge</button><button type="reset">Reset</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [provider, upstream, ignored] = [...canvasElement.querySelectorAll('mm-combobox')] as MmCombobox[];
    await expect(form.checkValidity()).toBe(false);
    await expect(upstream!.validity.valueMissing).toBe(true);
    await expect(input(ignored!).disabled).toBe(true);
    input(upstream!).focus();
    await press('customers');
    await waitFor(() => expect(upstream!.shadowRoot!.querySelectorAll('mm-option').length).toBeGreaterThan(0), { timeout: 2000 });
    await press('{ArrowDown}{Enter}');
    await waitFor(() => expect(upstream!.value).toBe('mrn://snowflake/table/analytics.marts.customers_dim'));
    await expect(form.checkValidity()).toBe(true);
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ provider: 'snowflake', upstream: 'mrn://snowflake/table/analytics.marts.customers_dim' });
    form.reset();
    await upstream!.updateComplete;
    await expect(provider!.value).toBe('snowflake');
    await expect(upstream!.value).toBe('');
    await expect(input(upstream!).value).toBe('');
  },
};
