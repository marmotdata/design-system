import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/select.js';
import type { MmSelect } from './class.ts';

type Args = { label: string; placeholder: string; help: string; error: string; disabled: boolean; required: boolean; value: string };

const providers = html`
  <mm-option value="postgresql"><mm-provider-logo slot="logo" provider="postgresql" decorative></mm-provider-logo>PostgreSQL</mm-option>
  <mm-option value="snowflake"><mm-provider-logo slot="logo" provider="snowflake" decorative></mm-provider-logo>Snowflake</mm-option>
  <mm-option value="bigquery"><mm-provider-logo slot="logo" provider="bigquery" decorative></mm-provider-logo>BigQuery</mm-option>
  <mm-option value="kafka"><mm-provider-logo slot="logo" provider="kafka" decorative></mm-provider-logo>Kafka</mm-option>
  <mm-option value="mongodb" disabled><mm-provider-logo slot="logo" provider="mongodb" decorative></mm-provider-logo>MongoDB</mm-option>
  <mm-option value="s3"><mm-provider-logo slot="logo" provider="s3" decorative></mm-provider-logo>Amazon S3</mm-option>
`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Select',
  component: 'mm-select',
  args: { label: 'Provider', placeholder: 'Choose a provider', help: '', error: '', disabled: false, required: false, value: '' },
  render: (a) => html`<mm-select
    name="provider"
    label=${a.label}
    placeholder=${a.placeholder}
    help=${a.help}
    error=${a.error}
    value=${a.value}
    ?disabled=${a.disabled}
    ?required=${a.required}
    >${providers}</mm-select
  >`,
  parameters: {
    usage: {
      html: `<mm-select name="owner" label="Owner team" placeholder="Choose a team">
  <mm-option value="analytics-engineering">Analytics Engineering</mm-option>
  <mm-option value="data-platform">Data Platform</mm-option>
  <mm-option value="snowflake"><mm-provider-logo slot="logo" provider="snowflake" decorative></mm-provider-logo>Snowflake</mm-option>
</mm-select>`,
      react: `import { MmSelect, MmOption } from '@marmotdata/react';

<MmSelect name="owner" label="Owner team" value={owner} onMmChange={(e) => setOwner(e.detail.value)}>
  <MmOption value="analytics-engineering">Analytics Engineering</MmOption>
  <MmOption value="data-platform">Data Platform</MmOption>
</MmSelect>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/select.js';
  let owner = $state('data-platform');
</script>

<mm-select name="owner" label="Owner team" value={owner} onmm-change={(e) => (owner = e.detail.value)}>
  <mm-option value="analytics-engineering">Analytics Engineering</mm-option>
  <mm-option value="data-platform">Data Platform</mm-option>
</mm-select>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-select') as MmSelect;
const combo = (s: MmSelect) => s.shadowRoot!.querySelector<HTMLElement>('[role="combobox"]')!;
const activeLabel = (s: MmSelect) => s.querySelector('mm-option[active]')?.textContent?.trim();
const isOpen = (s: MmSelect) => combo(s).getAttribute('aria-expanded') === 'true';

export const Default: Story = {};
export const WithValue: Story = { name: 'With a value', args: { value: 'snowflake', help: 'The source system this plugin reads from.' } };

export const Open: Story = {
  name: 'Open listbox',
  args: { value: 'bigquery' },
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await expect(s.querySelector('mm-option[value="bigquery"]')).toHaveAttribute('aria-selected', 'true');
  },
};

export const OptionDetails: Story = {
  name: 'Icons and descriptions',
  render: () => html`<mm-select label="Sort results by" value="relevance" style="width:300px">
    <mm-option value="relevance" icon="sort" description="Best match for the search terms first">Relevance</mm-option>
    <mm-option value="updated" icon="schedule" description="Assets with the newest metadata first">Recently updated</mm-option>
    <mm-option value="queries" icon="query-stats" description="Most queried in the last 30 days first">Query volume</mm-option>
    <mm-option value="name" icon="sort" description="A to Z by asset name">Name</mm-option>
  </mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(isOpen(s)).toBe(true));
  },
};

export const Groups: Story = {
  name: 'Option groups',
  render: () => html`<mm-select label="Owner" placeholder="Choose an owner" style="width:280px">
    <mm-option-group label="Teams">
      <mm-option value="team:analytics-engineering" icon="group">Analytics Engineering</mm-option>
      <mm-option value="team:data-platform" icon="group">Data Platform</mm-option>
    </mm-option-group>
    <mm-option-group label="People">
      <mm-option value="user:jane.doe" icon="person">Jane Doe</mm-option>
      <mm-option value="user:tomas.nowak" icon="person">John Price</mm-option>
    </mm-option-group>
    <mm-option-group label="Agents">
      <mm-option value="agent:support-triage-agent" icon="smart-toy">support-triage-agent</mm-option>
    </mm-option-group>
  </mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(isOpen(s)).toBe(true));
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(combo(host(canvasElement)));
  },
};
export const Disabled: Story = { args: { disabled: true, value: 'postgresql' } };
export const ErrorState: Story = { name: 'Error', args: { required: true, error: 'Choose the provider this plugin reads from.' } };
export const Empty: Story = {
  name: 'Empty',
  render: () => html`<mm-select label="Pipeline" placeholder="No pipelines yet"></mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(s.shadowRoot!.querySelector('.status')).toHaveTextContent('No results'));
  },
};
export const Loading: Story = {
  render: () => html`<mm-select label="Pipeline" .loader=${() => new Promise(() => {})}></mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(s.shadowRoot!.querySelector('.status')).toHaveTextContent('Loading'), { timeout: 1500 });
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-select label="Source table" value="orders" style="width:260px">
    <mm-option value="orders" mono description="mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel"
      ><mm-provider-logo slot="logo" provider="postgresql" decorative></mm-provider-logo>orders_daily_rollup_by_region_and_channel</mm-option
    >
    <mm-option value="customers" mono description="mrn://snowflake/table/analytics.marts.customers_dim_with_lifetime_value_v3"
      ><mm-provider-logo slot="logo" provider="snowflake" decorative></mm-provider-logo>customers_dim_with_lifetime_value_v3</mm-option
    >
    <mm-option value="topic" mono description="mrn://kafka/topic/shop.orders.v2.dead-letter-queue"
      ><mm-provider-logo slot="logo" provider="kafka" decorative></mm-provider-logo>shop.orders.v2.dead-letter-queue</mm-option
    >
  </mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await userEvent.click(combo(s));
    await waitFor(() => expect(isOpen(s)).toBe(true));
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'المزوّد', value: 'kafka' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      <mm-select label="Provider" value="snowflake">${providers}</mm-select>
      <mm-select label="Provider" required error="Choose the provider this plugin reads from.">${providers}</mm-select>
      <mm-select label="Provider" disabled value="kafka">${providers}</mm-select>
    </div>`),
};

const onChange = fn();
export const KeyboardModel: Story = {
  name: 'Keyboard: open, move, select',
  render: () => html`<mm-select label="Provider" @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}>${providers}</mm-select>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const s = host(canvasElement);
    await tab();
    await expect(deepActive()).toBe(combo(s));
    await press('{ArrowDown}');
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await expect(activeLabel(s)).toBe('PostgreSQL');
    await expect((combo(s) as HTMLElement & { ariaActiveDescendantElement: Element | null }).ariaActiveDescendantElement).toBe(
      s.querySelector('mm-option[value="postgresql"]'),
    );
    await press('{ArrowDown}');
    await expect(activeLabel(s)).toBe('Snowflake');
    await press('{End}');
    await expect(activeLabel(s)).toBe('Amazon S3');
    await press('{ArrowDown}');
    await expect(activeLabel(s)).toBe('Amazon S3');
    await press('{ArrowUp}');
    await expect(activeLabel(s)).toBe('Kafka'); // MongoDB is disabled and skipped
    await press('{Home}');
    await expect(activeLabel(s)).toBe('PostgreSQL');
    await press('{ArrowDown}{Enter}');
    await waitFor(() => expect(isOpen(s)).toBe(false));
    await expect(s.value).toBe('snowflake');
    await expect(onChange).toHaveBeenCalledWith('snowflake');
    await expect(deepActive()).toBe(combo(s));
    // Space opens on the selected option and selects.
    await press('{Space}');
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await expect(activeLabel(s)).toBe('Snowflake');
    await press('{ArrowDown}{Space}');
    await waitFor(() => expect(s.value).toBe('bigquery'));
    // Up opens too; Escape closes without changing the value.
    await press('{ArrowUp}');
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await press('{ArrowDown}{Escape}');
    await waitFor(() => expect(isOpen(s)).toBe(false));
    await expect(s.value).toBe('bigquery');
    await expect(deepActive()).toBe(combo(s));
  },
};

export const Typeahead: Story = {
  name: 'Keyboard: typeahead',
  render: () => html`<mm-select label="Provider">${providers}</mm-select>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await tab();
    await press('k');
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await expect(activeLabel(s)).toBe('Kafka');
    await press('{Enter}');
    await waitFor(() => expect(s.value).toBe('kafka'));
    await press('{ArrowDown}');
    await waitFor(() => expect(isOpen(s)).toBe(true));
    await press('am');
    await expect(activeLabel(s)).toBe('Amazon S3');
    await press('{Escape}');
  },
};

export const TabSelects: Story = {
  name: 'Keyboard: Tab selects and moves on',
  render: () => html`<div style="display:flex;gap:var(--space-2);align-items:end">
    <mm-select label="Provider">${providers}</mm-select><button type="button">Next</button>
  </div>`,
  play: async ({ canvasElement }) => {
    const s = host(canvasElement);
    await tab();
    await press('{ArrowDown}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(activeLabel(s)).toBe('BigQuery'));
    await tab();
    await waitFor(() => expect(isOpen(s)).toBe(false));
    await expect(s.value).toBe('bigquery');
    await expect(deepActive()).toBe(canvasElement.querySelector('button'));
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
    <mm-select name="provider" label="Provider" required value="postgresql">${providers}</mm-select>
    <mm-select name="owner" label="Owner team" required>
      <mm-option value="analytics-engineering">Analytics Engineering</mm-option>
      <mm-option value="data-platform">Data Platform</mm-option>
    </mm-select>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <mm-select name="ignored" label="Disabled by its fieldset" value="kafka">${providers}</mm-select>
    </fieldset>
    <div style="display:flex;gap:var(--space-2)"><button type="submit">Save plugin</button><button type="reset">Reset</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [provider, owner, ignored] = [...canvasElement.querySelectorAll('mm-select')] as MmSelect[];
    await expect(form.checkValidity()).toBe(false);
    await expect(owner!.validity.valueMissing).toBe(true);
    await expect(combo(ignored!)).toHaveAttribute('aria-disabled', 'true');
    owner!.focus();
    await press('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(owner!.value).toBe('data-platform'));
    await expect(form.checkValidity()).toBe(true);
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ provider: 'postgresql', owner: 'data-platform' });
    provider!.value = 'kafka';
    form.reset();
    await provider!.updateComplete;
    await expect(provider!.value).toBe('postgresql');
    await expect(owner!.value).toBe('');
  },
};
