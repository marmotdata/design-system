import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/menu.js';
import '@marmotdata/elements/button.js';
import type { MmMenu, MmMenuItem } from './class.ts';

type Args = { label: string; placement: string };

const items = () => html`
  <mm-menu-item icon="content-copy" shortcut="mod+shift+c" value="copy-mrn">Copy MRN</mm-menu-item>
  <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
  <mm-menu-item icon="account-tree" value="lineage">View lineage</mm-menu-item>
  <mm-menu-item icon="notifications" value="subscribe">Subscribe to changes</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
`;

const meta: Meta<Args> = {
  title: 'Components/Overlays/Menu',
  component: 'mm-menu',
  args: { label: 'Asset actions', placement: 'bottom-start' },
  render: (a) => html`<mm-menu label=${a.label} style="width:260px">${items()}</mm-menu>`,
  parameters: {
    usage: {
      html: `<mm-button id="orders-actions" variant="ghost" icon="more-horiz" label="More actions"></mm-button>
<mm-menu anchor="orders-actions" label="Asset actions">
  <mm-menu-item icon="content-copy" shortcut="mod+shift+c">Copy MRN</mm-menu-item>
  <mm-menu-item icon="terminal">Open in Query</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
</mm-menu>`,
      react: `import { MmMenu, MmMenuItem, MmMenuSeparator } from '@marmotdata/react';

<MmMenu label="Asset actions" onMmSelect={(e) => handle(e.detail.value)}>
  <MmMenuItem icon="content-copy" shortcut="mod+shift+c" value="copy-mrn">Copy MRN</MmMenuItem>
  <MmMenuItem icon="terminal" value="open-query">Open in Query</MmMenuItem>
  <MmMenuSeparator />
  <MmMenuItem icon="delete" danger value="delete">Delete asset</MmMenuItem>
</MmMenu>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/menu.js';
</script>

<mm-menu label="Asset actions" onmm-select={(e) => handle(e.detail.value)}>
  <mm-menu-item icon="content-copy" shortcut="mod+shift+c" value="copy-mrn">Copy MRN</mm-menu-item>
  <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
</mm-menu>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const onSelect = fn();
const menuIn = (el: HTMLElement) => el.querySelector('mm-menu') as MmMenu;
const item = (el: HTMLElement, text: string) => [...el.querySelectorAll<MmMenuItem>('mm-menu-item')].find((i) => i.text === text)!;

export const Default: Story = {};

export const WithDescriptions: Story = {
  name: 'Descriptions',
  render: () => html`<mm-menu label="Share asset" style="width:300px">
    <mm-menu-item icon="link" description="Anyone in the workspace with access to shop.public">Copy link</mm-menu-item>
    <mm-menu-item icon="content-copy" description="mrn://postgresql/table/shop.public.orders" shortcut="mod+shift+c">Copy MRN</mm-menu-item>
    <mm-menu-item icon="download" description="Schema, owners and tags as JSON">Export metadata</mm-menu-item>
  </mm-menu>`,
};

export const Groups: Story = {
  name: 'Groups and checkable items',
  render: () => html`<mm-menu label="Table view" style="width:260px" @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>
    <mm-menu-group label="Columns">
      <mm-menu-item type="checkbox" checked>Owner</mm-menu-item>
      <mm-menu-item type="checkbox" checked>Row count</mm-menu-item>
      <mm-menu-item type="checkbox">Last updated</mm-menu-item>
    </mm-menu-group>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-group label="Density">
      <mm-menu-item type="radio" checked value="default">Default rows</mm-menu-item>
      <mm-menu-item type="radio" value="compact">Compact rows</mm-menu-item>
    </mm-menu-group>
  </mm-menu>`,
  play: async ({ canvasElement }) => {
    const owner = item(canvasElement, 'Owner');
    const lastUpdated = item(canvasElement, 'Last updated');
    const compact = item(canvasElement, 'Compact rows');
    const def = item(canvasElement, 'Default rows');
    await expect(owner).toHaveAttribute('role', 'menuitemcheckbox');
    await expect(compact).toHaveAttribute('role', 'menuitemradio');
    await tab();
    await expect(deepActive()).toBe(owner);
    await press('{ArrowDown}{ArrowDown}');
    await press('{Space}');
    await expect(lastUpdated).toHaveAttribute('aria-checked', 'true');
    await press('{End}');
    await press('{Enter}');
    await expect(compact).toHaveAttribute('aria-checked', 'true');
    await expect(def).toHaveAttribute('aria-checked', 'false');
  },
};

export const Floating: Story = {
  render: (a) => html`<div style="min-height:280px">
    <mm-button id="orders-actions" variant="ghost" icon="more-horiz" label="More actions" haspopup="menu"
      @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as MmMenu).show()}></mm-button>
    <mm-menu anchor="orders-actions" label="Asset actions" placement=${a.placement}
      @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>${items()}</mm-menu>
  </div>`,
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const menu = menuIn(canvasElement);
    const trigger = canvasElement.querySelector('mm-button')!;
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    await expect(menu).toHaveAttribute('data-instant');
    await waitFor(() => expect(deepActive()).toBe(item(canvasElement, 'Copy MRN')));
    await press('{Escape}');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(menu.matches(':popover-open')).toBe(false);
    await waitFor(() => expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button')));
    await press('{Enter}');
    await waitFor(() => expect(menu.open).toBe(true));
    await press('{ArrowDown}{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('open-query');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button'));
  },
};

export const KeyboardNavigation: Story = {
  name: 'Keyboard: arrows wrap, Home and End',
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(item(canvasElement, 'Copy MRN'));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(item(canvasElement, 'Open in Query'));
    await press('{ArrowUp}{ArrowUp}');
    await expect(deepActive()).toBe(item(canvasElement, 'Delete asset'));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(item(canvasElement, 'Copy MRN'));
    await press('{End}');
    await expect(deepActive()).toBe(item(canvasElement, 'Delete asset'));
    await press('{Home}');
    await expect(deepActive()).toBe(item(canvasElement, 'Copy MRN'));
  },
};

export const KeyboardTypeahead: Story = {
  name: 'Keyboard: typeahead',
  play: async ({ canvasElement }) => {
    await tab();
    await press('v');
    await expect(deepActive()).toBe(item(canvasElement, 'View lineage'));
    await new Promise((r) => setTimeout(r, 600));
    await press('d');
    await expect(deepActive()).toBe(item(canvasElement, 'Delete asset'));
    await new Promise((r) => setTimeout(r, 600));
    await press('op');
    await expect(deepActive()).toBe(item(canvasElement, 'Open in Query'));
  },
};

export const KeyboardActivation: Story = {
  name: 'Keyboard: Enter and Space activate',
  render: (a) => html`<mm-menu label=${a.label} style="width:260px" @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>${items()}</mm-menu>`,
  play: async () => {
    onSelect.mockClear();
    await tab();
    await press('{Enter}');
    await press('{ArrowDown}{Space}');
    await expect(onSelect).toHaveBeenNthCalledWith(1, 'copy-mrn');
    await expect(onSelect).toHaveBeenNthCalledWith(2, 'open-query');
  },
};

export const KeyboardTabCloses: Story = {
  name: 'Keyboard: Tab closes a floating menu',
  render: Floating.render,
  play: async ({ canvasElement }) => {
    const menu = menuIn(canvasElement);
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(menu.open).toBe(true));
    await tab();
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(menu.matches(':popover-open')).toBe(false);
  },
};

export const Disabled: Story = {
  name: 'Disabled items',
  render: (a) => html`<mm-menu label=${a.label} style="width:260px" @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>
    <mm-menu-item icon="content-copy">Copy MRN</mm-menu-item>
    <mm-menu-item icon="terminal" disabled description="You need query access to shop.public">Open in Query</mm-menu-item>
    <mm-menu-item icon="account-tree">View lineage</mm-menu-item>
  </mm-menu>`,
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const disabled = item(canvasElement, 'Open in Query');
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await tab();
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(item(canvasElement, 'View lineage'));
    disabled.click();
    await expect(onSelect).not.toHaveBeenCalled();
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(item(canvasElement, 'Copy MRN'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-menu label="Recent assets" style="width:260px">
    <mm-menu-item icon="table">Open orders_daily_rollup_by_region_and_channel_v2</mm-menu-item>
    <mm-menu-item icon="table" description="mrn://snowflake/table/analytics.marts.customers_dim_scd2_history">Open customers_dim</mm-menu-item>
    <mm-menu-item icon="smart-toy" shortcut="mod+alt+enter">Ask support-triage-agent about this asset and its upstream sources</mm-menu-item>
  </mm-menu>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-menu label="Copy identifier" style="width:260px">
    <mm-menu-item icon="content-copy" description="mrn://postgresql/table/shop.public.orders">Copy MRN</mm-menu-item>
    <mm-menu-item icon="content-copy" description="mrn://kafka/topic/prod-eu-west-1.shop.orders.v2.dead-letter">Copy topic MRN</mm-menu-item>
  </mm-menu>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-menu label="إجراءات الأصل" style="width:260px">
    <mm-menu-item icon="content-copy" shortcut="mod+shift+c">نسخ المعرّف</mm-menu-item>
    <mm-menu-item icon="terminal">فتح في الاستعلام</mm-menu-item>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-item icon="delete" danger>حذف الأصل</mm-menu-item>
  </mm-menu>`,
};

export const BothThemes: Story = {
  render: () => themes(html`<mm-menu label="Asset actions" style="width:260px">${items()}</mm-menu>`),
};
