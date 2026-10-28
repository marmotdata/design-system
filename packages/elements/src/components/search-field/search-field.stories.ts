import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/search-field.js';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; hideLabel: boolean; value: string; placeholder: string; shortcut: string; globalShortcut: boolean; disabled: boolean; error: string; help: string };

const meta: Meta<Args> = {
  title: 'Components/Forms/Search field',
  component: 'mm-search-field',
  args: { label: 'Search the catalog', hideLabel: true, value: '', placeholder: 'Search assets, columns and glossary terms', shortcut: '/', globalShortcut: false, disabled: false, error: '', help: '' },
  render: (a) => html`<div style="max-width:420px">
    <mm-search-field
      label=${a.label}
      ?hide-label=${a.hideLabel}
      value=${a.value}
      placeholder=${a.placeholder}
      shortcut=${a.shortcut}
      ?global-shortcut=${a.globalShortcut}
      ?disabled=${a.disabled}
      error=${a.error}
      help=${a.help}
    ></mm-search-field>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-search-field name="q" label="Search the catalog" hide-label shortcut="/" global-shortcut
  placeholder="Search assets, columns and glossary terms"></mm-search-field>`,
      react: `import { MmSearchField } from '@marmotdata/react';

<MmSearchField name="q" label="Search the catalog" hideLabel shortcut="mod+k" globalShortcut
  onMmInput={(e) => setQuery(e.detail.value)}
  onMmSearch={(e) => navigate(\`/discover?q=\${encodeURIComponent(e.detail.value)}\`)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/search-field.js';
</script>

<!-- A GET form: Enter submits ?q=… natively, so it works without JavaScript handlers. -->
<form method="GET" action="/discover">
  <mm-search-field name="q" label="Search the catalog" hide-label shortcut="/" global-shortcut></mm-search-field>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Empty: Story = { args: { placeholder: '', shortcut: '' } };
export const WithQuery: Story = { args: { value: 'orders_daily' } };
export const ModK: Story = { name: 'Shortcut mod+k', args: { shortcut: 'mod+k' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-search-field')!.shadowRoot!.querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true, value: 'customers_dim' } };
export const VisibleLabel: Story = { args: { hideLabel: false, label: 'Filter columns', placeholder: 'Column name or type', shortcut: '', help: 'Matches column names, types and descriptions.' } };
export const Error: Story = {
  args: { hideLabel: false, label: 'Filter columns', value: 'customer_id ~ (', error: 'Remove the unmatched bracket to run this filter.', shortcut: '' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('mm-search-field')!.shadowRoot!.querySelector('input')).toHaveAttribute('aria-invalid', 'true');
  },
};
export const LongIdentifier: Story = { name: 'Long identifiers', args: { value: 'mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel' } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:220px"><mm-search-field label="Search the catalog" hide-label shortcut="mod+k" placeholder="Search assets, columns, glossary terms and owners"></mm-search-field></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'ابحث في الكتالوج', placeholder: 'ابحث عن الأصول', value: '' } };
export const Both: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:360px">
    <mm-search-field label="Search the catalog" hide-label shortcut="/" placeholder="Search assets"></mm-search-field>
    <mm-search-field label="Search the catalog" hide-label value="shop.orders.v2"></mm-search-field>
    <mm-search-field label="Search the catalog" hide-label disabled placeholder="Search assets"></mm-search-field>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(Both.render!({} as Args, {} as never)) };

export const KeyboardEscape: Story = {
  name: 'Keyboard: Escape clears, then blurs',
  args: { value: '' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-search-field')!;
    const input = el.shadowRoot!.querySelector('input')!;
    await expect(input).toHaveAttribute('role', 'searchbox');
    const onInput = fn();
    el.addEventListener('mm-input', onInput);
    await tab();
    await press('customers');
    await expect(el.value).toBe('customers');
    await expect(el.shadowRoot!.querySelector('button[aria-label="Clear"]')).not.toBeNull();
    await press('{Escape}');
    await expect(el.value).toBe('');
    await expect(onInput).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { value: '' } }));
    await expect(deepActive()).toBe(input);
    await press('{Escape}');
    await expect(deepActive()).not.toBe(input);
  },
};

const onSearch = fn();
export const KeyboardEnter: Story = {
  name: 'Keyboard: Enter fires mm-search',
  render: () => html`<mm-search-field label="Search the catalog" hide-label @mm-search=${(e: CustomEvent) => onSearch(e.detail)}></mm-search-field>`,
  play: async () => {
    onSearch.mockClear();
    await tab();
    await press('orders{Enter}');
    await expect(onSearch).toHaveBeenCalledWith({ value: 'orders' });
  },
};

export const GlobalShortcut: Story = {
  name: 'Keyboard: global shortcut focuses the field',
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:360px">
    <mm-text-field label="Asset name" value="orders_daily"></mm-text-field>
    <mm-button>Run query</mm-button>
    <mm-search-field label="Search the catalog" hide-label shortcut="/" global-shortcut placeholder="Search assets"></mm-search-field>
  </div>`,
  play: async ({ canvasElement }) => {
    const search = canvasElement.querySelector('mm-search-field')!;
    const input = search.shadowRoot!.querySelector('input')!;
    const field = canvasElement.querySelector('mm-text-field')!.shadowRoot!.querySelector('input')!;
    await expect(input).toHaveAttribute('aria-keyshortcuts', '/');
    // Typing "/" in another field types it there.
    await tab();
    await expect(deepActive()).toBe(field);
    await press('{End}/');
    await expect(field.value).toBe('orders_daily/');
    // From a button, "/" jumps to search.
    await tab();
    await press('/');
    await expect(deepActive()).toBe(input);
    await expect(search.value).toBe('');
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:flex;gap:var(--space-2);max-width:480px;align-items:start"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-search-field style="flex:1" name="q" label="Search the catalog" hide-label value="orders"></mm-search-field>
    <mm-button variant="primary" type="submit">Search</mm-button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = canvasElement.querySelector('mm-search-field')!;
    await tab();
    await press('{End}_daily{Enter}');
    await expect(onSubmit).toHaveBeenCalledWith({ q: 'orders_daily' });
    form.reset();
    await expect(el.value).toBe('orders');
    await expect(Object.fromEntries(new FormData(form))).toEqual({ q: 'orders' });
  },
};
