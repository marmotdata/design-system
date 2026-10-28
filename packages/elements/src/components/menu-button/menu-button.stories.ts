import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/menu-button.js';
import type { MmMenuButton } from './class.ts';
import type { MmMenuItem } from '../menu/class.ts';

type Args = { variant: string; size: string; icon: string; label: string; iconOnly: boolean; disabled: boolean };

const assetMenu = () => html`<mm-menu @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>
  <mm-menu-item icon="content-copy" shortcut="mod+shift+c" value="copy-mrn">Copy MRN</mm-menu-item>
  <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
  <mm-menu-separator></mm-menu-separator>
  <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
</mm-menu>`;

const meta: Meta<Args> = {
  title: 'Components/Actions/Menu button',
  component: 'mm-menu-button',
  args: { variant: 'ghost', size: 'md', icon: 'more-horiz', label: 'More actions', iconOnly: true, disabled: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (a) => html`<div style="min-height:220px">
    <mm-menu-button variant=${a.variant} size=${a.size} icon=${a.icon} label=${a.label} ?icon-only=${a.iconOnly} ?disabled=${a.disabled}>${assetMenu()}</mm-menu-button>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-menu-button variant="ghost" icon="more-horiz" label="More actions" icon-only>
  <mm-menu>
    <mm-menu-item icon="content-copy">Copy MRN</mm-menu-item>
    <mm-menu-item icon="terminal">Open in Query</mm-menu-item>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
  </mm-menu>
</mm-menu-button>`,
      react: `import { MmMenuButton, MmMenu, MmMenuItem, MmMenuSeparator } from '@marmotdata/react';

<MmMenuButton variant="ghost" icon="more-horiz" label="More actions" iconOnly>
  <MmMenu onMmSelect={(e) => act(e.detail.value)}>
    <MmMenuItem icon="content-copy" value="copy-mrn">Copy MRN</MmMenuItem>
    <MmMenuItem icon="terminal" value="open-query">Open in Query</MmMenuItem>
    <MmMenuSeparator />
    <MmMenuItem icon="delete" danger value="delete">Delete asset</MmMenuItem>
  </MmMenu>
</MmMenuButton>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/menu-button.js';
</script>

<mm-menu-button variant="ghost" icon="more-horiz" label="More actions" icon-only>
  <mm-menu onmm-select={(e) => act(e.detail.value)}>
    <mm-menu-item icon="content-copy" value="copy-mrn">Copy MRN</mm-menu-item>
    <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
    <mm-menu-separator></mm-menu-separator>
    <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
  </mm-menu>
</mm-menu-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const onSelect = fn();
const parts = (el: HTMLElement) => {
  const mb = el.querySelector('mm-menu-button') as MmMenuButton;
  const button = mb.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
  const items = [...el.querySelectorAll<MmMenuItem>('mm-menu-item')];
  return { mb, menu: mb.menu!, button, items };
};

export const More: Story = {
  name: 'More (icon only)',
  play: async ({ canvasElement }) => {
    const { button } = parts(canvasElement);
    await expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-label', 'More actions');
  },
};

export const WithLabel: Story = {
  name: 'Labelled with chevron',
  args: { variant: 'secondary', icon: 'download', label: 'Export', iconOnly: false },
  render: (a) => html`<div style="min-height:200px"><mm-menu-button variant=${a.variant} icon=${a.icon} label=${a.label}>
    <mm-menu>
      <mm-menu-item icon="table-view">Export CSV</mm-menu-item>
      <mm-menu-item icon="data-object">Export JSON</mm-menu-item>
    </mm-menu>
  </mm-menu-button></div>`,
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { mb, menu, button } = parts(canvasElement);
    await click(button);
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    await expect(mb).toHaveAttribute('open');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  },
};

export const KeyboardOpen: Story = {
  name: 'Keyboard: Enter, Space and ArrowDown open on the first item',
  play: async ({ canvasElement }) => {
    const { menu, button, items } = parts(canvasElement);
    for (const key of ['{Enter}', '{Space}', '{ArrowDown}']) {
      button.focus();
      await press(key);
      await waitFor(() => expect(menu.open).toBe(true));
      await expect(menu).toHaveAttribute('data-instant');
      await expect(deepActive()).toBe(items[0]);
      await press('{Escape}');
      await waitFor(() => expect(menu.open).toBe(false));
      await expect(deepActive()).toBe(button);
      await expect(button).toHaveAttribute('aria-expanded', 'false');
    }
  },
};

export const KeyboardOpenLast: Story = {
  name: 'Keyboard: ArrowUp opens on the last item',
  play: async ({ canvasElement }) => {
    const { menu, items } = parts(canvasElement);
    await tab();
    await press('{ArrowUp}');
    await waitFor(() => expect(menu.open).toBe(true));
    await expect(deepActive()).toBe(items.at(-1));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(items[0]);
  },
};

export const KeyboardSelect: Story = {
  name: 'Keyboard: select closes and returns focus',
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const { menu, button } = parts(canvasElement);
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(menu.open).toBe(true));
    await press('o');
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('open-query');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(deepActive()).toBe(button);
  },
};

export const ClickToggles: Story = {
  name: 'Pointer: click toggles',
  play: async ({ canvasElement }) => {
    const { menu, button } = parts(canvasElement);
    await click(button);
    await waitFor(() => expect(menu.open).toBe(true));
    await click(button);
    await waitFor(() => expect(menu.open).toBe(false));
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(parts(canvasElement).button);
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const { menu, button } = parts(canvasElement);
    button.focus();
    await press('{ArrowDown}');
    await expect(menu.open).toBe(false);
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  args: { variant: 'secondary', icon: 'table', label: 'Open orders_daily_rollup_by_region', iconOnly: false },
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="min-height:200px"><mm-menu-button variant="ghost" icon="more-horiz" label="إجراءات أخرى" icon-only>
    <mm-menu><mm-menu-item icon="content-copy">نسخ المعرّف</mm-menu-item><mm-menu-item icon="delete" danger>حذف الأصل</mm-menu-item></mm-menu>
  </mm-menu-button></div>`,
};

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-2)">
      <mm-menu-button variant="ghost" icon="more-horiz" label="More actions" icon-only>${assetMenu()}</mm-menu-button>
      <mm-menu-button variant="secondary" icon="download" label="Export"><mm-menu><mm-menu-item>Export CSV</mm-menu-item></mm-menu></mm-menu-button>
    </div>`),
};
