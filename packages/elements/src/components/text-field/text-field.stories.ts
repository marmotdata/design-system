import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/button.js';

type Args = {
  label: string;
  help: string;
  error: string;
  value: string;
  placeholder: string;
  type: string;
  required: boolean;
  optional: boolean;
  disabled: boolean;
  mono: boolean;
  clearable: boolean;
  hideLabel: boolean;
  maxlength?: number;
};

const meta: Meta<Args> = {
  title: 'Components/Forms/Text field',
  component: 'mm-text-field',
  args: {
    label: 'Asset name',
    help: 'Shown in search results and lineage. Use the name people already say out loud.',
    error: '',
    value: 'orders_daily',
    placeholder: '',
    type: 'text',
    required: false,
    optional: false,
    disabled: false,
    mono: false,
    clearable: false,
    hideLabel: false,
  },
  argTypes: { type: { control: 'inline-radio', options: ['text', 'email', 'url', 'password', 'tel'] } },
  render: (a) => html`<div style="max-width:360px">
    <mm-text-field
      label=${a.label}
      help=${a.help}
      error=${a.error}
      value=${a.value}
      placeholder=${a.placeholder}
      type=${a.type}
      maxlength=${a.maxlength ?? nothing}
      ?required=${a.required}
      ?optional=${a.optional}
      ?disabled=${a.disabled}
      ?mono=${a.mono}
      ?clearable=${a.clearable}
      ?hide-label=${a.hideLabel}
    ></mm-text-field>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-text-field name="owner" type="email" label="Owner email" required
  help="We send freshness alerts here."></mm-text-field>
<mm-text-field name="mrn" label="Asset MRN" mono value="mrn://postgresql/table/shop.public.orders"></mm-text-field>`,
      react: `import { MmTextField } from '@marmotdata/react';

<MmTextField name="owner" type="email" label="Owner email" required
  help="We send freshness alerts here."
  onMmChange={(e) => setOwner(e.detail.value)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/text-field.js';
  let owner = $state('');
</script>

<!-- Inside a SvelteKit form action: the value submits as plain FormData under "owner". -->
<form method="POST" action="?/saveOwner">
  <mm-text-field name="owner" type="email" label="Owner email" required
    value={owner} oninput={(e) => (owner = e.currentTarget.value)}></mm-text-field>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Placeholder: Story = { name: 'Empty', args: { value: '', placeholder: 'customers_dim' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-text-field')!.shadowRoot!.querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Required: Story = { args: { required: true, value: '' } };
export const Optional: Story = { args: { optional: true, label: 'Display name', value: '', help: '' } };
export const Error: Story = {
  args: { label: 'Owner email', type: 'email', value: 'jane.doe@', error: 'Enter a full email address, such as jane.doe@marmotdata.io.', help: '' },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('mm-text-field')!.shadowRoot!.querySelector('input')!;
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby')!;
    const err = input.getRootNode() as ShadowRoot;
    await expect(err.getElementById(describedBy.split(' ')[0]!)?.textContent).toContain('Enter a full email address');
  },
};
export const Mono: Story = {
  name: 'Long identifiers',
  args: { label: 'Asset MRN', mono: true, value: 'mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel', help: 'Machine strings are set in mono.' },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px;display:grid;gap:var(--space-4)">
    <mm-text-field label="Description shown in the catalog search results and on the asset page header" value="Daily rollup of shop orders by region, channel and currency, deduplicated against the payments ledger"></mm-text-field>
    <mm-text-field label="Owner team" error="Choose a team that exists in Settings, such as Analytics Engineering or Data Platform. The team name you entered was not found." value="Analytics Engineering (EMEA)"></mm-text-field>
  </div>`,
};
export const Password: Story = {
  args: { label: 'Warehouse password', type: 'password', value: 'correct-horse-battery', help: 'Stored encrypted. Only the Data Platform team can read it.' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('mm-text-field')!.shadowRoot!;
    const input = root.querySelector('input')!;
    await expect(input.type).toBe('password');
    await tab();
    await tab();
    const toggle = root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    await expect(deepActive()).toBe(toggle);
    await press('{Enter}');
    await expect(input.type).toBe('text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await press(' ');
    await expect(input.type).toBe('password');
  },
};
export const Counter: Story = {
  name: 'Character counter',
  args: { label: 'Short description', value: 'Orders deduplicated against payments', maxlength: 64, help: 'One line for search results.' },
};
export const PrefixSuffix: Story = {
  name: 'Prefix and suffix',
  render: () => html`<div style="max-width:420px;display:grid;gap:var(--space-4)">
    <mm-text-field label="Warehouse host" mono value="analytics.eu-west-2">
      <span slot="prefix" style="font:var(--text-mono-dense)">https://</span>
      <span slot="suffix" style="font:var(--text-mono-dense)">.snowflakecomputing.com</span>
    </mm-text-field>
  </div>`,
};
export const Clearable: Story = {
  args: { clearable: true, label: 'Filter columns', value: 'customer_id', help: '' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-text-field')!;
    const onChange = fn();
    el.addEventListener('mm-change', onChange);
    await tab();
    await tab();
    await expect(deepActive()).toHaveAttribute('aria-label', 'Clear');
    await press('{Enter}');
    await expect(el.value).toBe('');
    await expect(onChange).toHaveBeenCalledOnce();
    await expect(deepActive()).toBe(el.shadowRoot!.querySelector('input'));
  },
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'اسم الأصل', help: 'يظهر في نتائج البحث.', clearable: true } };
export const AllTypes: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:360px">
    <mm-text-field label="Asset name" value="orders_daily"></mm-text-field>
    <mm-text-field label="Owner email" type="email" value="jane.doe@marmotdata.io"></mm-text-field>
    <mm-text-field label="Runbook URL" type="url" value="https://wiki.marmotdata.io/runbooks/orders"></mm-text-field>
    <mm-text-field label="On-call phone" type="tel" value="+44 20 7946 0958" optional></mm-text-field>
    <mm-text-field label="Service account key" type="password" value="sk_live_51284019"></mm-text-field>
    <mm-text-field label="Asset MRN" mono value="mrn://postgresql/table/shop.public.orders"></mm-text-field>
    <mm-text-field label="Topic" required error="Enter a Kafka topic name, such as shop.orders.v2." value=""></mm-text-field>
    <mm-text-field label="Schema" disabled value="public"></mm-text-field>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(AllTypes.render!({} as Args, {} as never)) };

export const KeyboardTyping: Story = {
  name: 'Keyboard: typing fires mm-input, input and mm-change',
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:360px"><mm-text-field label="Asset name"></mm-text-field><mm-button>Save asset</mm-button></div>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-text-field')!;
    const mmInput = fn();
    const nativeInput = fn();
    const mmChange = fn();
    const nativeChange = fn();
    el.addEventListener('mm-input', mmInput);
    el.addEventListener('input', nativeInput);
    el.addEventListener('mm-change', mmChange);
    el.addEventListener('change', nativeChange);
    await tab();
    await press('orders');
    await expect(el.value).toBe('orders');
    await expect(mmInput).toHaveBeenCalledTimes(6);
    await expect(nativeInput).toHaveBeenCalledTimes(6);
    await tab();
    await expect(mmChange).toHaveBeenCalledOnce();
    await expect(nativeChange).toHaveBeenCalledOnce();
    await expect(mmChange.mock.calls[0]![0].detail).toEqual({ value: 'orders' });
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-4);max-width:360px"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-text-field name="asset" label="Asset name" value="orders_daily"></mm-text-field>
    <mm-text-field name="owner" type="email" label="Owner email" required></mm-text-field>
    <div style="display:flex;gap:var(--space-2)">
      <mm-button variant="primary" type="submit">Save asset</mm-button>
      <mm-button type="reset">Reset</mm-button>
    </div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [asset, owner] = Array.from(canvasElement.querySelectorAll('mm-text-field'));
    // Required and empty: the form does not submit and the field shows why.
    form.requestSubmit();
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(owner!.matches(':invalid')).toBe(true);
    await expect(deepActive()).toBe(owner!.shadowRoot!.querySelector('input'));
    await expect(owner!.shadowRoot!.querySelector('.error')).not.toBeNull();
    await press('jane.doe@marmotdata.io');
    await press('{Enter}');
    await expect(onSubmit).toHaveBeenCalledWith({ asset: 'orders_daily', owner: 'jane.doe@marmotdata.io' });
    form.reset();
    await expect(owner!.value).toBe('');
    await expect(asset!.value).toBe('orders_daily');
    await expect(Object.fromEntries(new FormData(form))).toEqual({ asset: 'orders_daily', owner: '' });
  },
};

export const DisabledByFieldset: Story = {
  render: () => html`<form><fieldset disabled style="border:0;padding:0;margin:0">
    <mm-text-field name="asset" label="Asset name" value="orders_daily"></mm-text-field>
  </fieldset></form>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-text-field')!;
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('input')!.disabled).toBe(true);
    await expect([...new FormData(canvasElement.querySelector('form')!).keys()]).toEqual([]);
  },
};
