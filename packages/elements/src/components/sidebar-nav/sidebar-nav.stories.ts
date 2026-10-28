import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/sidebar-nav.js';
import '@marmotdata/elements/logo.js';
import '@marmotdata/elements/org-switcher.js';
import type { MmNavGroup, MmNavItem, MmSidebarNav } from './class.ts';
import type { Organisation } from '../org-switcher/class.ts';

type Args = { collapsed: boolean; collapsible: boolean; current: string };

const orgs: Organisation[] = [
  {
    id: 'northwind',
    name: 'Northwind Freight',
    workspaces: [
      { id: 'prod', name: 'Production', plan: 'Team' },
      { id: 'staging', name: 'Staging', plan: 'Team' },
    ],
  },
];

const item = (current: string, href: string, icon: string, label: string, extra: unknown = nothing) =>
  html`<mm-nav-item href=${href} icon=${icon} ?current=${current === label}>${label}${extra}</mm-nav-item>`;

const navContent = (a: Partial<Args>, cloud = false) => {
  const c = a.current ?? 'Discover';
  return html`<mm-logo slot="header" size="24"></mm-logo>
    <mm-nav-group label="Catalog" ?collapsible=${!!a.collapsible}>
      ${item(c, '#/', 'home', 'Home')} ${item(c, '#/discover', 'travel-explore', 'Discover')} ${item(c, '#/glossary', 'menu-book', 'Glossary')}
      ${item(c, '#/products', 'package-2', 'Data products')}
    </mm-nav-group>
    <mm-nav-group label="Work" ?collapsible=${!!a.collapsible}>
      ${item(c, '#/query', 'terminal', 'Query')} ${item(c, '#/insights', 'insights', 'Insights')}
    </mm-nav-group>
    <mm-nav-group label="Operate" ?collapsible=${!!a.collapsible}>
      <mm-nav-item href="#/runs" icon="extension" attention="2" attention-label="2 pipelines failed" ?current=${c === 'Plugins'}>Plugins</mm-nav-item>
      <mm-nav-item href="#/audit" icon="policy" count="14" count-label="14 refused today" ?current=${c === 'Query audit'}>Query audit</mm-nav-item>
      ${item(c, '#/rules', 'rule', 'Asset rules')}
    </mm-nav-group>
    <mm-nav-item slot="footer" href="#/settings" icon="settings" attention="3" ?current=${c === 'Settings'}>Settings</mm-nav-item>
    ${cloud ? html`<mm-org-switcher slot="footer" .orgs=${orgs} org="northwind" workspace="prod"></mm-org-switcher>` : nothing}`;
};

const frame = (inner: unknown, height = 620) => html`<div style="display:flex;height:${height}px;border:1px solid var(--mm-rule);width:max-content">${inner}</div>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Sidebar nav',
  component: 'mm-sidebar-nav',
  subcomponents: { NavGroup: 'mm-nav-group', NavItem: 'mm-nav-item' } as never,
  args: { collapsed: false, collapsible: false, current: 'Discover' },
  argTypes: { current: { control: 'select', options: ['Home', 'Discover', 'Glossary', 'Data products', 'Query', 'Insights', 'Plugins', 'Query audit', 'Asset rules', 'Settings'] } },
  render: (a) => frame(html`<mm-sidebar-nav ?collapsed=${a.collapsed}>${navContent(a)}</mm-sidebar-nav>`),
  parameters: {
    usage: {
      html: `<mm-sidebar-nav>
  <mm-logo slot="header" size="24"></mm-logo>
  <mm-nav-group label="Catalog">
    <mm-nav-item href="/" icon="home">Home</mm-nav-item>
    <mm-nav-item href="/discover" icon="travel-explore" current>Discover</mm-nav-item>
    <mm-nav-item href="/glossary" icon="menu-book">Glossary</mm-nav-item>
    <mm-nav-item href="/products" icon="package-2">Data products</mm-nav-item>
  </mm-nav-group>
  <mm-nav-group label="Work">
    <mm-nav-item href="/query" icon="terminal">Query</mm-nav-item>
    <mm-nav-item href="/insights" icon="insights">Insights</mm-nav-item>
  </mm-nav-group>
  <mm-nav-group label="Operate">
    <mm-nav-item href="/runs" icon="extension" attention="2" attention-label="2 pipelines failed">Plugins</mm-nav-item>
    <mm-nav-item href="/audit" icon="policy">Query audit</mm-nav-item>
    <mm-nav-item href="/rules" icon="rule">Asset rules</mm-nav-item>
  </mm-nav-group>
  <mm-nav-item slot="footer" href="/settings" icon="settings" attention="3">Settings</mm-nav-item>
</mm-sidebar-nav>`,
      react: `import { MmSidebarNav, MmNavGroup, MmNavItem } from '@marmotdata/react';

<MmSidebarNav>
  <MmNavGroup label="Catalog">
    <MmNavItem href="/" icon="home" current={path === '/'}>Home</MmNavItem>
    <MmNavItem href="/discover" icon="travel-explore" current={path.startsWith('/discover')}>Discover</MmNavItem>
  </MmNavGroup>
  <MmNavItem slot="footer" href="/settings" icon="settings" attention={settingsIssues}>Settings</MmNavItem>
</MmSidebarNav>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/sidebar-nav.js';
  import { page } from '$app/state';
</script>

<mm-sidebar-nav>
  <mm-nav-group label="Catalog">
    <mm-nav-item href="/" icon="home" current={page.url.pathname === '/'}>Home</mm-nav-item>
    <mm-nav-item href="/discover" icon="travel-explore" current={page.url.pathname.startsWith('/discover')}>Discover</mm-nav-item>
  </mm-nav-group>
  <mm-nav-item slot="footer" href="/settings" icon="settings" attention={data.settingsIssues}>Settings</mm-nav-item>
</mm-sidebar-nav>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (root: HTMLElement) => {
  const nav = root.querySelector('mm-sidebar-nav') as MmSidebarNav;
  const items = [...root.querySelectorAll<MmNavItem>('mm-nav-item')];
  const link = (label: string) => items.find((i) => i.text === label)!.shadowRoot!.querySelector<HTMLElement>('.link')!;
  return { nav, items, link, groups: [...root.querySelectorAll<MmNavGroup>('mm-nav-group')] };
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { nav, link } = parts(canvasElement);
    await expect(nav.shadowRoot!.querySelector('nav')).toHaveAttribute('aria-label', 'Main');
    await expect(link('Discover')).toHaveAttribute('aria-current', 'page');
    await expect(link('Home')).not.toHaveAttribute('aria-current');
    await expect(link('Home').tagName).toBe('A');
    await expect(link('Settings')).toHaveTextContent('3 need attention');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const { link } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(link('Home'));
  },
};
export const CurrentSettings: Story = { name: 'Current: Settings in the footer', args: { current: 'Settings' } };

export const Collapsed: Story = {
  name: 'Collapsed rail',
  args: { collapsed: true },
  play: async ({ canvasElement }) => {
    const { link, groups } = parts(canvasElement);
    await waitFor(() => expect(groups[0]!.collapsed).toBe(true));
    // Labels stay as accessible names; counts and attention become words.
    await expect(link('Query audit')).toHaveTextContent('14 refused today');
    await expect(link('Plugins')).toHaveTextContent('2 pipelines failed');
  },
};

export const CollapsedTooltip: Story = {
  name: 'Collapsed rail: label tooltip on focus',
  args: { collapsed: true },
  play: async ({ canvasElement }) => {
    const { link, items } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(link('Home'));
    const tip = items[0]!.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
  },
};

export const CollapsibleGroups: Story = {
  name: 'Collapsible groups',
  args: { collapsible: true },
  play: async ({ canvasElement }) => {
    const { groups } = parts(canvasElement);
    const work = groups[1]!;
    const btn = work.toggleButton!;
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    btn.focus();
    await press('{Enter}');
    await expect(work.open).toBe(false);
    await waitFor(() => expect(btn).toHaveAttribute('aria-expanded', 'false'));
    await press('{Space}');
    await expect(work.open).toBe(true);
  },
};

export const ArrowKeys: Story = {
  name: 'Keyboard: Up, Down, Home and End move between items',
  play: async ({ canvasElement }) => {
    const { link } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(link('Home'));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(link('Discover'));
    await press('{ArrowDown}{ArrowDown}{ArrowDown}');
    await expect(deepActive()).toBe(link('Query'));
    await press('{ArrowUp}');
    await expect(deepActive()).toBe(link('Data products'));
    await press('{End}');
    await expect(deepActive()).toBe(link('Settings'));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(link('Settings'));
    await press('{Home}');
    await expect(deepActive()).toBe(link('Home'));
    // Tab still reaches every item in order.
    await tab();
    await expect(deepActive()).toBe(link('Discover'));
  },
};

export const ArrowKeysCollapsible: Story = {
  name: 'Keyboard: arrows include group headings and skip closed groups',
  args: { collapsible: true },
  play: async ({ canvasElement }) => {
    const { link, groups } = parts(canvasElement);
    const work = groups[1]!;
    work.open = false;
    await work.updateComplete;
    link('Data products').focus();
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(work.toggleButton);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(groups[2]!.toggleButton);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(link('Plugins'));
  },
};

const onToggle = fn();
export const ToggleButton: Story = {
  name: 'Keyboard: the toggle button collapses the rail',
  render: (a) => frame(html`<mm-sidebar-nav @mm-sidebar-toggle=${(e: CustomEvent) => onToggle(e.detail.collapsed)}>${navContent(a)}</mm-sidebar-nav>`),
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const { nav, link } = parts(canvasElement);
    const toggle = () => nav.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
    await expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle()).toHaveTextContent('Collapse sidebar');
    toggle().focus();
    await press('{Enter}');
    await waitFor(() => expect(nav.collapsed).toBe(true));
    await expect(onToggle).toHaveBeenCalledWith(true);
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-expanded', 'false'));
    toggle().focus();
    await press('{Enter}');
    await waitFor(() => expect(nav.collapsed).toBe(false));
    await expect(link('Home').closest('mm-tooltip')).toBeNull();
  },
};

export const Disabled: Story = {
  name: 'Disabled item',
  render: () =>
    frame(
      html`<mm-sidebar-nav>
        <mm-nav-group label="Work">
          <mm-nav-item href="#/query" icon="terminal" disabled>Query</mm-nav-item>
          <mm-nav-item href="#/insights" icon="insights">Insights</mm-nav-item>
        </mm-nav-group>
      </mm-sidebar-nav>`,
      240,
    ),
  play: async ({ canvasElement }) => {
    const { link } = parts(canvasElement);
    await expect(link('Query')).toHaveAttribute('aria-disabled', 'true');
    await expect(link('Query')).not.toHaveAttribute('href');
    await tab();
    await expect(deepActive()).toBe(link('Insights'));
  },
};

export const WithOrgSwitcher: Story = {
  name: 'Cloud: with the organisation switcher',
  render: (a) => frame(html`<mm-sidebar-nav ?collapsed=${a.collapsed}>${navContent(a, true)}</mm-sidebar-nav>`, 700),
};
export const WithOrgSwitcherCollapsed: Story = {
  name: 'Cloud: collapsed rail with the organisation switcher',
  args: { collapsed: true },
  render: WithOrgSwitcher.render,
  play: async ({ canvasElement }) => {
    const sw = canvasElement.querySelector('mm-org-switcher')!;
    await waitFor(() => expect(sw.collapsed).toBe(true));
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () =>
    frame(
      html`<mm-sidebar-nav>
        <mm-nav-group label="Catalog">
          <mm-nav-item href="#/" icon="home">Home</mm-nav-item>
          <mm-nav-item href="#/products/orders" icon="package-2" current count="1284019" count-label="1,284,019 assets">Customer orders and fulfilment reporting</mm-nav-item>
          <mm-nav-item href="#/glossary" icon="menu-book" count="214">Glossary</mm-nav-item>
        </mm-nav-group>
        <mm-nav-group label="Saved searches for the Analytics Engineering on-call rotation">
          ${['orders_daily', 'customers_dim', 'shop.orders.v2', 'payments_reconciliation_by_region', 'support-triage-agent', 'inventory_snapshots_hourly', 'refunds_fact', 'web_sessions_raw'].map(
            (n) => html`<mm-nav-item href="#/search?q=${n}" icon="search">${n}</mm-nav-item>`,
          )}
        </mm-nav-group>
        <mm-nav-item slot="footer" href="#/settings" icon="settings" attention="12">Settings</mm-nav-item>
      </mm-sidebar-nav>`,
      420,
    ),
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const RightToLeftCollapsed: Story = { name: 'Right to left, collapsed', parameters: { dir: 'rtl' }, args: { collapsed: true } };

export const BothThemes: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-4)">
      ${frame(html`<mm-sidebar-nav label="Main (expanded)">${navContent({ current: 'Discover' })}</mm-sidebar-nav>`, 560)}
      ${frame(html`<mm-sidebar-nav label="Main (rail)" collapsed>${navContent({ current: 'Discover' })}</mm-sidebar-nav>`, 560)}
    </div>`),
};

export const ClickCurrent: Story = {
  name: 'Pointer: items are real links',
  play: async ({ canvasElement }) => {
    const { link } = parts(canvasElement);
    await expect(link('Glossary')).toHaveAttribute('href', '#/glossary');
    void click;
  },
};
