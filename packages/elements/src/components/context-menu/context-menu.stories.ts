import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/context-menu.js';
import type { MmContextMenu } from './class.ts';
import type { MmMenuItem } from '../menu/class.ts';

type Args = Record<string, never>;

const assets = [
  { name: 'orders', mrn: 'mrn://postgresql/table/shop.public.orders', owner: 'Analytics Engineering', rows: '1,284,019' },
  { name: 'customers_dim', mrn: 'mrn://snowflake/table/analytics.marts.customers_dim', owner: 'Data Platform', rows: '412,880' },
  { name: 'shop.orders.v2', mrn: 'mrn://kafka/topic/shop.orders.v2', owner: 'Jane Doe', rows: '18,204' },
];

const tableStyles = html`<style>
  .assets { width: 100%; border-collapse: collapse; font: var(--text-dense); background: var(--mm-surface); border: 1px solid var(--mm-rule); }
  .assets th { text-align: start; font: var(--text-label); color: var(--mm-text-2); background: var(--mm-sunken); height: 32px; padding: 0 var(--space-3); border-bottom: 1px solid var(--mm-rule); }
  .assets th.num, .assets td.num { text-align: end; font-variant-numeric: tabular-nums; }
  .assets td { height: var(--mm-row); padding: 0 var(--space-3); border-bottom: 1px solid var(--mm-rule); }
  .assets td.mono { font: var(--text-mono-dense); color: var(--mm-text-2); overflow-wrap: anywhere; }
  .assets tbody tr:hover { background: var(--mm-sunken); }
  .assets tbody tr:focus-visible { outline: 2px solid var(--mm-text); outline-offset: -2px; }
</style>`;

const table = () => html`${tableStyles}<table class="assets">
  <caption style="text-align:start;font:var(--text-caption);color:var(--mm-text-2);padding-block-end:var(--space-2)">Right-click a row, or focus it and press Shift+F10, for its actions.</caption>
  <thead><tr><th scope="col">Asset</th><th scope="col">MRN</th><th scope="col">Owner</th><th scope="col" class="num">Rows</th></tr></thead>
  <tbody>
    ${assets.map((a) => html`<tr tabindex="0" data-mrn=${a.mrn}><td>${a.name}</td><td class="mono">${a.mrn}</td><td>${a.owner}</td><td class="num">${a.rows}</td></tr>`)}
  </tbody>
</table>`;

const menu = () => html`<mm-menu slot="menu" label="Asset actions">
  <mm-menu-item icon="content-copy" value="copy-mrn" shortcut="mod+shift+c">Copy MRN</mm-menu-item>
  <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
  <mm-menu-item icon="account-tree" value="lineage">View lineage</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
</mm-menu>`;

const onSelect = fn();
const handle = (e: CustomEvent) => {
  const cm = e.currentTarget as MmContextMenu;
  onSelect(e.detail.value, (cm.target?.closest('tr') as HTMLElement | null)?.dataset.mrn);
};

const meta: Meta<Args> = {
  title: 'Components/Overlays/Context menu',
  component: 'mm-context-menu',
  render: () => html`<mm-context-menu @mm-select=${handle}>${table()}${menu()}</mm-context-menu>`,
  parameters: {
    usage: {
      html: `<mm-context-menu>
  <table>…asset rows…</table>
  <mm-menu slot="menu" label="Asset actions">
    <mm-menu-item icon="content-copy" value="copy-mrn">Copy MRN</mm-menu-item>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
  </mm-menu>
</mm-context-menu>`,
      react: `import { MmContextMenu, MmMenu, MmMenuItem } from '@marmotdata/react';

<MmContextMenu onMmSelect={(e) => act(e.detail.value, e.currentTarget.target?.closest('tr'))}>
  <AssetTable />
  <MmMenu slot="menu" label="Asset actions">
    <MmMenuItem icon="content-copy" value="copy-mrn">Copy MRN</MmMenuItem>
  </MmMenu>
</MmContextMenu>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/context-menu.js';
</script>

<mm-context-menu onmm-select={(e) => act(e.detail.value, e.currentTarget.target?.closest('tr'))}>
  <AssetTable />
  <mm-menu slot="menu" label="Asset actions">
    <mm-menu-item icon="content-copy" value="copy-mrn">Copy MRN</mm-menu-item>
  </mm-menu>
</mm-context-menu>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (el: HTMLElement) => {
  const cm = el.querySelector('mm-context-menu') as MmContextMenu;
  const rows = [...el.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const items = [...el.querySelectorAll<MmMenuItem>('mm-menu-item')];
  return { cm, menu: cm.menu!, rows, items };
};

export const Default: Story = {};

export const RightClick: Story = {
  name: 'Pointer: right-click a row',
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const { menu, rows, items } = parts(canvasElement);
    const r = rows[1]!.cells[0]!.getBoundingClientRect();
    rows[1]!.cells[0]!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: r.left + 12, clientY: r.top + 8, button: 2 }));
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    await expect(menu).toHaveAttribute('data-instant');
    await expect(deepActive()).toBe(items[0]);
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('copy-mrn', 'mrn://snowflake/table/analytics.marts.customers_dim');
    await waitFor(() => expect(menu.open).toBe(false));
  },
};

export const KeyboardShiftF10: Story = {
  name: 'Keyboard: Shift+F10 opens at the focused row, Escape returns focus',
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const { menu, rows, items } = parts(canvasElement);
    await tab();
    await tab();
    await expect(deepActive()).toBe(rows[1]);
    await press('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(menu.open).toBe(true));
    await expect(deepActive()).toBe(items[0]);
    await press('{ArrowUp}');
    await expect(deepActive()).toBe(items.at(-1));
    await press('{Escape}');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(deepActive()).toBe(rows[1]);
  },
};

export const KeyboardMenuKey: Story = {
  name: 'Keyboard: the Menu key opens it too',
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const { menu, rows } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(rows[0]);
    await press('{ContextMenu}');
    await waitFor(() => expect(menu.open).toBe(true));
    await press('v');
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('lineage', 'mrn://postgresql/table/shop.public.orders');
    await waitFor(() => expect(deepActive()).toBe(rows[0]));
  },
};

export const Open: Story = {
  name: 'Open',
  play: async ({ canvasElement }) => {
    const { cm, menu, rows } = parts(canvasElement);
    const r = rows[0]!.getBoundingClientRect();
    cm.openAt(r.left + 80, r.bottom - 8, rows[0]!);
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
  },
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  play: Open.play,
};

export const BothThemes: Story = {
  render: () => themes(html`<mm-context-menu>${table()}${menu()}</mm-context-menu>`),
};
