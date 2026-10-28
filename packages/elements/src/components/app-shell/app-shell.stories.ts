import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import '@marmotdata/elements/app-shell.js';
import '@marmotdata/elements/sidebar-nav.js';
import '@marmotdata/elements/top-bar.js';
import '@marmotdata/elements/breadcrumbs.js';
import '@marmotdata/elements/banner.js';
import '@marmotdata/elements/logo.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/org-switcher.js';
import '@marmotdata/elements/details-blade.js';
import type { Organisation } from '../org-switcher/class.ts';

const orgs: Organisation[] = [
  {
    id: 'northwind',
    name: 'Northwind Freight',
    workspaces: [
      { id: 'nw-prod', name: 'Production', plan: 'Team' },
      { id: 'nw-staging', name: 'Staging', plan: 'Team' },
    ],
  },
];
import type { MmAppShell } from './class.ts';
import type { MmSidebarNav } from '../sidebar-nav/class.ts';

type Args = { sidebarCollapsed: boolean; banner: boolean; blade: boolean };

const nav = (cloud = false) => html`<mm-sidebar-nav slot="sidebar">
  <mm-logo slot="header" size="24"></mm-logo>
  <mm-nav-group label="Catalog">
    <mm-nav-item href="#/" icon="home">Home</mm-nav-item>
    <mm-nav-item href="#/discover" icon="travel-explore" current>Discover</mm-nav-item>
    <mm-nav-item href="#/glossary" icon="menu-book">Glossary</mm-nav-item>
    <mm-nav-item href="#/products" icon="package-2">Data products</mm-nav-item>
  </mm-nav-group>
  <mm-nav-group label="Work">
    <mm-nav-item href="#/query" icon="terminal">Query</mm-nav-item>
    <mm-nav-item href="#/insights" icon="insights">Insights</mm-nav-item>
  </mm-nav-group>
  <mm-nav-group label="Operate">
    <mm-nav-item href="#/runs" icon="extension" attention="2" attention-label="2 pipelines failed">Plugins</mm-nav-item>
    <mm-nav-item href="#/audit" icon="policy" count="14" count-label="14 refused today">Query audit</mm-nav-item>
    <mm-nav-item href="#/rules" icon="rule">Asset rules</mm-nav-item>
  </mm-nav-group>
  <mm-nav-item slot="footer" href="#/settings" icon="settings" attention="3">Settings</mm-nav-item>
  ${cloud ? html`<mm-org-switcher slot="footer" .orgs=${orgs} org="northwind" workspace="nw-prod"></mm-org-switcher>` : nothing}
</mm-sidebar-nav>`;

const topbar = () => html`<mm-top-bar slot="topbar" global-shortcut notifications unread="4" help-href="https://marmotdata.io/docs">
  <mm-breadcrumbs slot="start" mono>
    <mm-breadcrumb href="#/discover?provider=postgresql">postgresql</mm-breadcrumb>
    <mm-breadcrumb href="#/discover?db=shop">shop</mm-breadcrumb>
    <mm-breadcrumb href="#/discover?schema=public">public</mm-breadcrumb>
    <mm-breadcrumb>orders</mm-breadcrumb>
  </mm-breadcrumbs>
  <mm-avatar-menu slot="end" name="Jane Doe" email="jane.doe@northwind.dev" language="English (UK)"></mm-avatar-menu>
</mm-top-bar>`;

const page = () => html`<h1 style="font:var(--text-display-title);letter-spacing:var(--tracking-display-title);margin:0 0 var(--space-2)">orders</h1>
  <p class="mm-readout" style="margin:0 0 var(--space-5)">
    1.28M rows · Updated 5 hours ago
  </p>
  <p style="max-width:68ch;margin:0 0 var(--space-5);color:var(--mm-text-2)">
    One row per customer order placed through the web shop, written by the checkout service and loaded hourly. Owned by
    <a class="mm-link" href="#/teams/analytics-engineering" style="color:var(--mm-primary)">Analytics Engineering</a>.
  </p>
  <table style="border-collapse:collapse;width:100%;max-width:720px;font:var(--text-dense);background:var(--mm-surface);border:1px solid var(--mm-rule)">
    <caption style="text-align:start;font:var(--text-label);color:var(--mm-text-2);padding-block-end:var(--space-2)">Schema</caption>
    <thead>
      <tr style="background:var(--mm-sunken);color:var(--mm-text-2);font:var(--text-label)">
        <th scope="col" style="text-align:start;padding:var(--space-2) var(--space-3)">Column</th>
        <th scope="col" style="text-align:start;padding:var(--space-2) var(--space-3)">Type</th>
        <th scope="col" style="text-align:start;padding:var(--space-2) var(--space-3)">Description</th>
      </tr>
    </thead>
    <tbody>
      ${[
        ['order_id', 'bigint', 'Primary key'],
        ['customer_id', 'bigint', 'Joins to customers_dim'],
        ['placed_at', 'timestamptz', 'When checkout completed'],
        ['total_gbp', 'numeric(12,2)', 'Order total including VAT'],
      ].map(
        ([c, ty, d]) => html`<tr style="border-top:1px solid var(--mm-rule)">
          <td style="padding:var(--space-2) var(--space-3);font:var(--text-mono-dense)">${c}</td>
          <td style="padding:var(--space-2) var(--space-3);font:var(--text-mono-dense);color:var(--mm-text-2)">${ty}</td>
          <td style="padding:var(--space-2) var(--space-3)">${d}</td>
        </tr>`,
      )}
    </tbody>
  </table>`;

const blade = () => html`<div slot="blade" style="inline-size:var(--blade-w);padding:var(--space-5);display:grid;gap:var(--space-3)">
  <h2 style="font:var(--text-heading-sm);margin:0">Details</h2>
  <dl style="display:grid;grid-template-columns:120px 1fr;gap:var(--space-2) var(--space-4);margin:0;font:var(--text-dense)">
    <dt style="font:var(--text-label);color:var(--mm-text-2)">MRN</dt>
    <dd style="margin:0;font:var(--text-mono-dense);overflow-wrap:anywhere">mrn://postgresql/table/shop.public.orders</dd>
    <dt style="font:var(--text-label);color:var(--mm-text-2)">Owner</dt>
    <dd style="margin:0">Analytics Engineering</dd>
    <dt style="font:var(--text-label);color:var(--mm-text-2)">Last run</dt>
    <dd style="margin:0"><mm-status-pill tone="success">Succeeded</mm-status-pill></dd>
  </dl>
</div>`;

const shell = (a: Partial<Args> = {}, style = '--mm-shell-height: 640px') => html`<mm-app-shell ?sidebar-collapsed=${!!a.sidebarCollapsed} style=${style}>
  ${a.banner
    ? html`<mm-banner slot="banner" tone="warning" href="#/status" link-text="View status">Planned maintenance on Sunday 2 November from 06:00 to 07:00 UTC. Search may be slow.</mm-banner>`
    : nothing}
  ${nav()} ${topbar()}
  ${page()} ${a.blade ? blade() : nothing}
</mm-app-shell>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/App shell',
  component: 'mm-app-shell',
  args: { sidebarCollapsed: false, banner: true, blade: false },
  render: (a) => shell(a),
  parameters: {
    layout: 'fullscreen',
    usage: {
      html: `<mm-app-shell>
  <mm-banner slot="banner" tone="warning">Planned maintenance on Sunday from 06:00 UTC.</mm-banner>
  <mm-sidebar-nav slot="sidebar">…</mm-sidebar-nav>
  <mm-top-bar slot="topbar" global-shortcut notifications unread="4">…</mm-top-bar>
  <h1>orders</h1>
  …
  <mm-details-blade slot="blade">…</mm-details-blade>
</mm-app-shell>`,
      react: `import { MmAppShell, MmSidebarNav, MmTopBar } from '@marmotdata/react';

<MmAppShell sidebarCollapsed={collapsed} onMmSidebarToggle={(e) => save(e.detail.collapsed)}>
  <MmSidebarNav slot="sidebar">{/* groups */}</MmSidebarNav>
  <MmTopBar slot="topbar" globalShortcut notifications unread={4} onMmOpenSearch={openPalette} />
  <Outlet />
</MmAppShell>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/app-shell.js';
  import '@marmotdata/elements/sidebar-nav.js';
  import '@marmotdata/elements/top-bar.js';
  let { children, data } = $props();
</script>

<mm-app-shell sidebar-collapsed={data.sidebarCollapsed} onmm-sidebar-toggle={(e) => save(e.detail.collapsed)}>
  <mm-sidebar-nav slot="sidebar">…</mm-sidebar-nav>
  <mm-top-bar slot="topbar" global-shortcut notifications unread={data.unread} onmm-open-search={openPalette}></mm-top-bar>
  {@render children()}
</mm-app-shell>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const get = (root: HTMLElement) => {
  const el = root.querySelector('mm-app-shell') as MmAppShell;
  const sr = el.shadowRoot!;
  return {
    el,
    skip: sr.querySelector('.skip') as HTMLAnchorElement,
    main: sr.querySelector('main') as HTMLElement,
    nav: root.querySelector('mm-sidebar-nav') as MmSidebarNav,
    toggle: () => root.querySelector('mm-top-bar')!.shadowRoot!.querySelector('.nav-toggle') as HTMLButtonElement,
    close: () => sr.querySelector('.close') as HTMLButtonElement | null,
  };
};

export const ShellWithAllParts: Story = {
  name: 'Shell with all parts',
  args: { blade: true },
  play: async ({ canvasElement }) => {
    const { el } = get(canvasElement);
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('header')).toBeTruthy();
    await expect(sr.querySelector('main')).toBeTruthy();
    await expect(sr.querySelector('aside')).toHaveAttribute('aria-label', 'Details');
    await expect(sr.querySelector('aside')).not.toHaveAttribute('hidden');
  },
};

export const CloudShell: Story = {
  name: 'Shell with all parts (Cloud)',
  render: () => html`<mm-app-shell style="--mm-shell-height: 640px">
    ${nav(true)} ${topbar()} ${page()}
  </mm-app-shell>`,
};

export const Default: Story = { args: { banner: false } };

export const Bleed: Story = {
  name: 'Full bleed main area',
  render: () => html`<mm-app-shell bleed style="--mm-shell-height: 520px">
    ${nav()} ${topbar()}
    <div style="block-size:100%;display:grid;place-items:center;background:var(--mm-sunken)">
      <p style="margin:0;color:var(--mm-text-2)">The lineage canvas fills the main area to its edges.</p>
    </div>
  </mm-app-shell>`,
  play: async ({ canvasElement }) => {
    const { el, main } = get(canvasElement);
    await expect(el).toHaveAttribute('bleed');
    await expect(getComputedStyle(main).paddingInlineStart).toBe('0px');
    await expect(getComputedStyle(main).paddingBlockStart).toBe('0px');
    const fill = el.querySelector(':scope > div') as HTMLElement;
    await expect(Math.abs(fill.getBoundingClientRect().height - main.getBoundingClientRect().height)).toBeLessThan(1);
    // The data attribute some apps already set is honoured too.
    el.bleed = false;
    await el.updateComplete;
    await expect(getComputedStyle(main).paddingInlineStart).not.toBe('0px');
    el.setAttribute('data-bleed', '');
    await expect(getComputedStyle(main).paddingInlineStart).toBe('0px');
  },
};

export const FoldedBlade: Story = {
  name: 'Blade column follows a folded blade',
  render: () => html`<mm-app-shell style="--mm-shell-height: 520px">
    ${nav()} ${topbar()} ${page()}
    <mm-details-blade slot="blade" heading="orders_daily" collapsible>
      <p style="margin:0">Daily order totals by region, built by dbt-analytics.</p>
    </mm-details-blade>
  </mm-app-shell>`,
  play: async ({ canvasElement }) => {
    const { el } = get(canvasElement);
    const blade = el.querySelector('mm-details-blade')!;
    await blade.updateComplete;
    const aside = el.shadowRoot!.querySelector('aside') as HTMLElement;
    const open = aside.getBoundingClientRect().width;
    await expect(Math.abs(open - blade.getBoundingClientRect().width)).toBeLessThan(2);
    const fold = blade.shadowRoot!.querySelector('.collapse') as HTMLElement;
    await click(fold);
    await waitFor(() => expect(blade.collapsed).toBe(true));
    await waitFor(() => expect(aside.getBoundingClientRect().width).toBeLessThan(open / 4));
    await expect(Math.abs(aside.getBoundingClientRect().width - blade.getBoundingClientRect().width)).toBeLessThan(2);
  },
};
export const WithBanner: Story = { name: 'With system banner', args: { banner: true } };
export const SidebarCollapsed: Story = {
  name: 'Collapsed rail',
  args: { sidebarCollapsed: true, banner: false },
  play: async ({ canvasElement }) => {
    const { nav } = get(canvasElement);
    await waitFor(() => expect(nav.collapsed).toBe(true));
  },
};

export const SkipLink: Story = {
  name: 'Keyboard: skip link is first and moves focus to main',
  args: { banner: false },
  play: async ({ canvasElement }) => {
    const { skip, main } = get(canvasElement);
    // Hidden, it casts no shadow into the corner over the logo.
    await expect(getComputedStyle(skip).boxShadow).toBe('none');
    await tab();
    await expect(deepActive()).toBe(skip);
    await expect(skip).toHaveTextContent('Skip to content');
    await expect(getComputedStyle(skip).boxShadow).not.toBe('none');
    await press('{Enter}');
    await expect(deepActive()).toBe(main);
  },
};

const onToggle = fn();
export const ShortcutToggle: Story = {
  name: 'Keyboard: ⌘B or Ctrl+B collapses and expands',
  args: { banner: false },
  render: (a) => html`<div @mm-sidebar-toggle=${(e: CustomEvent) => onToggle(e.detail.collapsed)}>${shell(a)}</div>`,
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const { el, nav } = get(canvasElement);
    await tab();
    await press('{Control>}b{/Control}');
    await waitFor(() => expect(el.sidebarCollapsed).toBe(true));
    await expect(el).toHaveAttribute('sidebar-collapsed');
    await waitFor(() => expect(nav.collapsed).toBe(true));
    await expect(onToggle).toHaveBeenLastCalledWith(true);
    await press('{Control>}b{/Control}');
    await waitFor(() => expect(el.sidebarCollapsed).toBe(false));
    await expect(nav.collapsed).toBe(false);
    await expect(onToggle).toHaveBeenLastCalledWith(false);
  },
};

export const ToggleCancelled: Story = {
  name: 'Cancelling mm-sidebar-toggle keeps the sidebar',
  args: { banner: false },
  render: (a) => html`<div @mm-sidebar-toggle=${(e: Event) => e.preventDefault()}>${shell(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { el } = get(canvasElement);
    await tab();
    await press('{Control>}b{/Control}');
    await expect(el.sidebarCollapsed).toBe(false);
  },
};

const narrow = (a: Partial<Args>) => html`<div style="width:375px">${shell(a, '--mm-shell-height: 680px')}</div>`;

export const Mobile: Story = {
  name: 'Mobile (drawer closed)',
  args: { banner: false },
  render: narrow,
  play: async ({ canvasElement }) => {
    const { el, toggle } = get(canvasElement);
    await waitFor(() => expect(el).toHaveAttribute('narrow'));
    await expect(toggle().checkVisibility()).toBe(true);
  },
};

export const MobileDrawerOpen: Story = {
  name: 'Mobile drawer open',
  args: { banner: false },
  render: narrow,
  play: async ({ canvasElement }) => {
    const { el, toggle, close } = get(canvasElement);
    await waitFor(() => expect(el).toHaveAttribute('narrow'));
    await click(toggle());
    await waitFor(() => expect(el.drawerOpen).toBe(true));
    await waitFor(() => expect(deepActive()).toBe(close()));
    await expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    await expect(el.shadowRoot!.querySelector('.sidebar')).toHaveAttribute('role', 'dialog');
  },
};

export const DrawerKeyboard: Story = {
  name: 'Keyboard: drawer traps Tab, Escape closes and returns focus',
  args: { banner: false },
  render: narrow,
  play: async ({ canvasElement }) => {
    const { el, toggle, close } = get(canvasElement);
    await waitFor(() => expect(el).toHaveAttribute('narrow'));
    toggle().focus();
    await press('{Enter}');
    await waitFor(() => expect(el.drawerOpen).toBe(true));
    await waitFor(() => expect(deepActive()).toBe(close()));
    // Shift+Tab from the first element wraps to the last (Settings).
    await tab(true);
    const settings = canvasElement.querySelector('mm-nav-item[slot="footer"]')!.shadowRoot!.querySelector('a');
    await expect(deepActive()).toBe(settings);
    // Tab from the last wraps to the close button.
    await tab();
    await expect(deepActive()).toBe(close());
    await press('{Escape}');
    await waitFor(() => expect(el.drawerOpen).toBe(false));
    await expect(deepActive()).toBe(toggle());
    await expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  },
};

export const DrawerShortcut: Story = {
  name: 'Keyboard: Ctrl+B opens the drawer on narrow screens',
  args: { banner: false },
  render: narrow,
  play: async ({ canvasElement }) => {
    const { el, close } = get(canvasElement);
    await waitFor(() => expect(el).toHaveAttribute('narrow'));
    await tab();
    await press('{Control>}b{/Control}');
    await waitFor(() => expect(el.drawerOpen).toBe(true));
    await waitFor(() => expect(deepActive()).toBe(close()));
    await press('{Enter}');
    await waitFor(() => expect(el.drawerOpen).toBe(false));
  },
};

export const MobileWithBlade: Story = { name: 'Mobile with blade over the page', args: { banner: true, blade: true }, render: narrow };

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  args: { banner: true },
  render: (a) => html`<mm-app-shell style="--mm-shell-height: 480px">
    ${a.banner
      ? html`<mm-banner slot="banner" tone="info">Marmot 0.9 moves navigation into the sidebar. Glossary, Data products, Asset rules and Query audit are now one click away instead of under Governance.</mm-banner>`
      : nothing}
    ${nav()} ${topbar()}
    ${page()}
    ${Array.from({ length: 12 }, (_, i) => html`<p style="max-width:68ch;color:var(--mm-text-2)">Run ${i + 1}: orders_daily loaded 1,284,019 rows from shop.orders.v2 in 412 ms.</p>`)}
  </mm-app-shell>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { banner: false, blade: true } };
export const RightToLeftDrawer: Story = {
  name: 'Right to left, drawer open',
  parameters: { dir: 'rtl' },
  args: { banner: false },
  render: narrow,
  play: async ({ canvasElement }) => {
    const { el } = get(canvasElement);
    await waitFor(() => expect(el).toHaveAttribute('narrow'));
    el.openDrawer();
    await waitFor(() => expect(el.drawerOpen).toBe(true));
  },
};

export const Peat: Story = { name: 'Peat theme', parameters: { theme: 'dark' }, args: { banner: true, blade: true } };

export const BothThemes: Story = {
  parameters: {
    // Two whole shells on one page repeat the page landmarks; that is the showcase, not the component.
    a11y: { config: { rules: [{ id: 'landmark-no-duplicate-main', enabled: false }, { id: 'landmark-no-duplicate-banner', enabled: false }, { id: 'landmark-unique', enabled: false }] } },
  },
  render: () => html`<div style="display:grid;grid-template-rows:1fr 1fr">
    ${(['light', 'dark'] as const).map(
      (t) => html`<div data-theme=${t}>${shell({ banner: false, blade: false }, '--mm-shell-height: 520px')}</div>`,
    )}
  </div>`,
};
