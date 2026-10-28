import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/top-bar.js';
import '@marmotdata/elements/breadcrumbs.js';
import type { MmAvatarMenu, MmTopBar } from './class.ts';
import type { MmMenuItem } from '../menu/class.ts';

type Args = { unread: number; notifications: boolean; globalShortcut: boolean; helpHref: string; placeholder: string };

const crumbs = () => html`<mm-breadcrumbs slot="start">
  <mm-breadcrumb href="#/discover">Discover</mm-breadcrumb>
  <mm-breadcrumb>orders_daily</mm-breadcrumb>
</mm-breadcrumbs>`;

const avatar = () => html`<mm-avatar-menu slot="end" name="Jane Doe" email="jane.doe@northwind.dev" language="English (UK)" theme="light"></mm-avatar-menu>`;

const bar = (a: Partial<Args>) => html`<mm-top-bar
  ?notifications=${a.notifications ?? true}
  unread=${a.unread ?? 4}
  ?global-shortcut=${a.globalShortcut ?? true}
  help-href=${a.helpHref ?? 'https://marmotdata.io/docs'}
  placeholder=${a.placeholder ?? ''}
  @mm-open-search=${(e: CustomEvent) => onSearch(e.detail.source)}
  @mm-open-notifications=${() => onBell()}
  >${crumbs()}${avatar()}</mm-top-bar
>`;

const onSearch = fn();
const onBell = fn();
const onTheme = fn();
const onSelect = fn();

const meta: Meta<Args> = {
  title: 'Components/Navigation/Top bar',
  component: 'mm-top-bar',
  subcomponents: { AvatarMenu: 'mm-avatar-menu' } as never,
  args: { unread: 4, notifications: true, globalShortcut: true, helpHref: 'https://marmotdata.io/docs', placeholder: '' },
  render: (a) => html`<div style="min-height:420px">${bar(a)}</div>`,
  parameters: {
    layout: 'fullscreen',
    usage: {
      html: `<mm-top-bar global-shortcut notifications unread="4" help-href="/docs">
  <mm-breadcrumbs slot="start">
    <mm-breadcrumb href="/discover">Discover</mm-breadcrumb>
    <mm-breadcrumb>orders_daily</mm-breadcrumb>
  </mm-breadcrumbs>
  <mm-avatar-menu slot="end" name="Jane Doe" email="jane.doe@northwind.dev" language="English (UK)"></mm-avatar-menu>
</mm-top-bar>`,
      react: `import { MmTopBar, MmAvatarMenu } from '@marmotdata/react';

<MmTopBar globalShortcut notifications unread={unread} onMmOpenSearch={() => setPaletteOpen(true)} onMmOpenNotifications={openBell}>
  <MmAvatarMenu slot="end" name="Jane Doe" theme={theme} onMmThemeChange={(e) => saveTheme(e.detail.theme)}
    onMmSelect={(e) => e.detail.value === 'sign-out' && signOut()} />
</MmTopBar>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/top-bar.js';
</script>

<mm-top-bar global-shortcut notifications unread={data.unread} onmm-open-search={() => (paletteOpen = true)}>
  <mm-avatar-menu slot="end" name={data.user.name} theme={data.theme}
    onmm-theme-change={(e) => saveTheme(e.detail.theme)}
    onmm-select={(e) => e.detail.value === 'sign-out' && signOut()}></mm-avatar-menu>
</mm-top-bar>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (root: HTMLElement) => {
  const top = root.querySelector('mm-top-bar') as MmTopBar;
  const sr = top.shadowRoot!;
  const av = root.querySelector('mm-avatar-menu') as MmAvatarMenu;
  return {
    top,
    trigger: sr.querySelector('.trigger') as HTMLButtonElement,
    bell: sr.querySelector('[part="notifications"]') as HTMLButtonElement,
    av,
    avatar: av.shadowRoot!.querySelector('.avatar') as HTMLButtonElement,
    items: () => [...av.shadowRoot!.querySelectorAll<MmMenuItem>('mm-menu-item')],
  };
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { trigger, bell } = parts(canvasElement);
    await expect(trigger).toHaveTextContent('Search the catalog');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    // The name is "Notifications 4 unread": hidden text plus the count's label.
    await expect(bell).toHaveTextContent('Notifications');
    await expect(bell.querySelector('mm-count')).toHaveAttribute('label', '4 unread');
  },
};
export const NoUnread: Story = { name: 'No unread notifications', args: { unread: 0 } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const { trigger } = parts(canvasElement);
    await tab();
    await tab();
    await expect(deepActive()).toBe(trigger);
  },
};

export const SearchTrigger: Story = {
  name: 'Keyboard: search trigger and ⌘K fire mm-open-search',
  play: async ({ canvasElement }) => {
    onSearch.mockClear();
    const { trigger } = parts(canvasElement);
    trigger.focus();
    await press('{Enter}');
    await expect(onSearch).toHaveBeenLastCalledWith('click');
    await click(canvasElement.querySelector('mm-breadcrumbs')!);
    await press('{Control>}k{/Control}');
    await expect(onSearch).toHaveBeenLastCalledWith('shortcut');
    await expect(onSearch).toHaveBeenCalledTimes(2);
  },
};

export const NoGlobalShortcut: Story = {
  name: 'Without global shortcut',
  args: { globalShortcut: false },
  play: async ({ canvasElement }) => {
    onSearch.mockClear();
    const { trigger } = parts(canvasElement);
    trigger.focus();
    await press('{Control>}k{/Control}');
    await expect(onSearch).not.toHaveBeenCalled();
  },
};

export const Bell: Story = {
  name: 'Keyboard: bell fires mm-open-notifications',
  play: async ({ canvasElement }) => {
    onBell.mockClear();
    const { bell } = parts(canvasElement);
    bell.focus();
    await press('{Space}');
    await expect(onBell).toHaveBeenCalledTimes(1);
  },
};

export const AvatarMenuOpen: Story = {
  name: 'Avatar menu open',
  play: async ({ canvasElement }) => {
    const { av, avatar } = parts(canvasElement);
    await click(avatar);
    await waitFor(() => expect(av.open).toBe(true));
    await expect(avatar).toHaveAttribute('aria-expanded', 'true');
  },
};

export const AvatarKeyboard: Story = {
  name: 'Keyboard: avatar menu opens, chooses Peat and returns focus',
  render: (a) => html`<div style="min-height:420px" @mm-theme-change=${(e: CustomEvent) => onTheme(e.detail.theme)}>${bar(a)}</div>`,
  play: async ({ canvasElement }) => {
    onTheme.mockClear();
    const { av, avatar, items } = parts(canvasElement);
    await expect(avatar).toHaveAccessibleName('Account menu for Jane Doe');
    avatar.focus();
    await press('{Enter}');
    await waitFor(() => expect(av.open).toBe(true));
    const [account, light, peat] = items();
    await expect(deepActive()).toBe(account);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(light);
    await expect(light).toHaveAttribute('aria-checked', 'true');
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(peat);
    await press('{Enter}');
    await expect(onTheme).toHaveBeenCalledWith('dark');
    await expect(document.documentElement.dataset.theme).toBe('dark');
    await expect(peat).toHaveAttribute('aria-checked', 'true');
    // Radio items keep the menu open; Escape closes it and returns focus to the avatar.
    await press('{Escape}');
    await waitFor(() => expect(av.open).toBe(false));
    await expect(deepActive()).toBe(avatar);
    av.setTheme('light');
    // Let colour transitions settle before the accessibility check.
    await new Promise((r) => setTimeout(r, 400));
  },
};

export const AvatarArrowUp: Story = {
  name: 'Keyboard: ArrowUp opens on Sign out',
  render: (a) => html`<div style="min-height:420px" @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>${bar(a)}</div>`,
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const { av, avatar, items } = parts(canvasElement);
    avatar.focus();
    await press('{ArrowUp}');
    await waitFor(() => expect(av.open).toBe(true));
    await expect(deepActive()).toBe(items().at(-1));
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('sign-out');
    await waitFor(() => expect(av.open).toBe(false));
    await expect(deepActive()).toBe(avatar);
  },
};

export const AvatarTypeahead: Story = {
  name: 'Keyboard: avatar menu typeahead',
  play: async ({ canvasElement }) => {
    const { av, avatar, items } = parts(canvasElement);
    avatar.focus();
    await press('{Enter}');
    await waitFor(() => expect(av.open).toBe(true));
    await press('s');
    await expect(deepActive()).toBe(items()[3]);
    await press('s');
    await expect(deepActive()).toBe(items()[5]);
    await press('{Escape}');
    await waitFor(() => expect(av.open).toBe(false));
    await expect(deepActive()).toBe(avatar);
  },
};

export const ThemeCancelled: Story = {
  name: 'Cancelling mm-theme-change leaves the document alone',
  render: (a) => html`<div style="min-height:420px" @mm-theme-change=${(e: Event) => e.preventDefault()}>${bar(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { av, avatar, items } = parts(canvasElement);
    avatar.focus();
    await press('{Enter}');
    await waitFor(() => expect(av.open).toBe(true));
    items()[2]!.click();
    await expect(document.documentElement.dataset.theme).toBe('light');
    await press('{Escape}');
  },
};

const narrow = (a: Partial<Args>) => html`<div style="container: mm-shell / inline-size; width: 375px; min-height: 420px">${bar(a)}</div>`;
export const Narrow: Story = {
  name: 'Narrow (inside the app shell under 720px)',
  render: narrow,
  play: async ({ canvasElement }) => {
    const { top, trigger } = parts(canvasElement);
    const toggle = top.shadowRoot!.querySelector<HTMLButtonElement>('.nav-toggle')!;
    await expect(toggle.checkVisibility()).toBe(true);
    await expect(toggle).toHaveAttribute('aria-label', 'Open navigation');
    await expect(trigger).toHaveAccessibleName('Search the catalog');
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: (a) => html`<div style="width:860px;min-height:200px;border:1px solid var(--mm-rule)">
    <mm-top-bar notifications unread="1284" ?global-shortcut=${a.globalShortcut} placeholder="Search tables, topics, dashboards, glossary terms and agents">
      <mm-breadcrumbs slot="start" mono>
        <mm-breadcrumb href="#/discover?provider=snowflake">snowflake</mm-breadcrumb>
        <mm-breadcrumb href="#/discover?db=analytics_prod">analytics_prod</mm-breadcrumb>
        <mm-breadcrumb href="#/discover?schema=finance_reporting">finance_reporting</mm-breadcrumb>
        <mm-breadcrumb href="#/discover?schema=finance_reporting.marts">marts</mm-breadcrumb>
        <mm-breadcrumb>payments_reconciliation_by_region_and_currency_daily</mm-breadcrumb>
      </mm-breadcrumbs>
      <mm-avatar-menu slot="end" name="Drew Martin-Fitzgerald" email="oluwaseun.adebayo-fitzgerald@northwind.dev"></mm-avatar-menu>
    </mm-top-bar>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };

export const BothThemes: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  render: () =>
    themes(html`<mm-top-bar notifications unread="4"><mm-breadcrumbs slot="start" label="Breadcrumbs"><mm-breadcrumb href="#/discover">Discover</mm-breadcrumb><mm-breadcrumb>orders_daily</mm-breadcrumb></mm-breadcrumbs>${avatar()}</mm-top-bar>`),
};
