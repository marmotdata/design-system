import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, nextFrame, press } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import { isApple } from '@marmotdata/elements/core/platform.js';
import '@marmotdata/elements/command-palette.js';
import '@marmotdata/elements/shortcut-help.js';
import '@marmotdata/elements/button.js';
import type { MmCommandPalette, PaletteCommand, PaletteItem, PaletteResult, PaletteScope, PaletteSearch } from './class.ts';

/* ------------------------------------------------------------------ data */

/**
 * About 5,000 catalogue assets, generated deterministically from realistic naming conventions per
 * provider, so every run and every screenshot shows the same catalog.
 */
const entities = [
  'orders', 'customers', 'payments', 'refunds', 'invoices', 'subscriptions', 'products', 'order_items', 'shipments', 'sessions',
  'page_views', 'signups', 'carts', 'inventory', 'suppliers', 'returns', 'discounts', 'charges', 'accounts', 'events',
  'ad_spend', 'campaigns', 'support_tickets', 'reviews', 'warehouses', 'stock_levels', 'exchange_rates', 'ledger_entries', 'payouts', 'disputes',
];
const sources = ['stripe', 'shopify', 'salesforce', 'zendesk', 'hubspot', 'segment', 'netsuite', 'adyen'];
const suffixes = ['', '_daily', '_weekly', '_monthly', '_snapshot', '_history', '_latest', '_raw', '_v2', '_archive'];

function buildCatalog(): PaletteResult[] {
  const out: PaletteResult[] = [];
  const seen = new Set<string>();
  const push = (provider: string, kind: string, name: string, path: string) => {
    const mrn = `mrn://${provider}/${kind}/${path}`;
    if (seen.has(mrn)) return;
    seen.add(mrn);
    out.push({ id: mrn, kind: 'asset', label: name, mrn, provider, href: `/discover/${encodeURIComponent(mrn)}` });
  };
  push('postgresql', 'table', 'orders_daily', 'shop.public.orders_daily');
  push('snowflake', 'table', 'customers_dim', 'analytics.marts.customers_dim');
  push('snowflake', 'table', 'fct_payments', 'analytics.marts.fct_payments');
  push('dbt', 'model', 'stg_stripe__charges', 'analytics.staging.stg_stripe__charges');
  push(
    'snowflake',
    'table',
    'customers_dim_with_lifetime_value_and_marketing_consent_v3',
    'analytics.marts_customer_360.customers_dim_with_lifetime_value_and_marketing_consent_v3',
  );
  for (const e of entities) {
    for (const s of suffixes) {
      push('postgresql', 'table', `${e}${s}`, `warehouse.reporting.${e}${s}`);
      push('bigquery', 'table', `rpt_${e}${s}`, `marmot-prod.reporting.rpt_${e}${s}`);
      push('snowflake', 'table', `${e}${s}`, `analytics.staging.${e}${s}`);
      push('looker', 'look', `${e}${s}_by_region`, `finance.${e}${s}_by_region`);
      push('postgresql', 'table', `${e}${s}`, `shop.public.${e}${s}`);
      push('postgresql', 'table', `${e}${s}`, `billing.public.${e}${s}`);
      push('snowflake', 'table', `fct_${e}${s}`, `analytics.marts.fct_${e}${s}`);
      push('snowflake', 'table', `${e}_dim${s}`, `analytics.marts.${e}_dim${s}`);
      push('bigquery', 'table', `${e}${s}`, `marmot-prod.analytics.${e}${s}`);
      push('bigquery', 'table', `int_${e}${s}`, `marmot-prod.intermediate.int_${e}${s}`);
      push('looker', 'dashboard', `${e}${s}_overview`, `finance.${e}${s}_overview`);
    }
    for (let v = 1; v <= 4; v++) {
      push('kafka', 'topic', `shop.${e}.v${v}`, `shop.${e}.v${v}`);
      push('kafka', 'topic', `billing.${e}.v${v}`, `billing.${e}.v${v}`);
      push('kafka', 'topic', `cdc.shop.public.${e}.v${v}`, `cdc.shop.public.${e}.v${v}`);
    }
    for (const src of sources) {
      push('dbt', 'model', `stg_${src}__${e}`, `analytics.staging.stg_${src}__${e}`);
      push('dbt', 'model', `base_${src}__${e}`, `analytics.base.base_${src}__${e}`);
      push('snowflake', 'table', `raw_${src}_${e}`, `raw.${src}.${e}`);
      for (const s of ['_daily', '_snapshot', '_history']) push('dbt', 'model', `stg_${src}__${e}${s}`, `analytics.staging.stg_${src}__${e}${s}`);
    }
  }
  return out.slice(0, 5000);
}
const catalog = buildCatalog();

const glossary: PaletteResult[] = [
  { id: 'g-aov', kind: 'glossary', label: 'Average order value', description: 'Gross order revenue divided by the number of orders in the period.' },
  { id: 'g-active', kind: 'glossary', label: 'Active customer', description: 'A customer with at least one paid order in the last 90 days.' },
  { id: 'g-churn', kind: 'glossary', label: 'Churned subscription', description: 'A subscription cancelled and not renewed within 30 days.' },
  { id: 'g-gmv', kind: 'glossary', label: 'Gross merchandise value', description: 'Total value of orders placed, before refunds and discounts.' },
  { id: 'g-refund', kind: 'glossary', label: 'Refund rate', description: 'Refunded orders as a share of all orders placed.' },
];
const teams: PaletteResult[] = [
  { id: 't-ae', kind: 'team', label: 'Analytics Engineering', description: '12 members' },
  { id: 't-dp', kind: 'team', label: 'Data Platform', description: '8 members' },
  { id: 't-fin', kind: 'team', label: 'Finance Data', description: '5 members' },
  { id: 't-growth', kind: 'team', label: 'Growth Analytics', description: '7 members' },
];
const products: PaletteResult[] = [
  { id: 'p-orders', kind: 'data-product', label: 'Orders 360', description: 'Owned by Analytics Engineering' },
  { id: 'p-revenue', kind: 'data-product', label: 'Revenue reporting', description: 'Owned by Finance Data' },
  { id: 'p-customers', kind: 'data-product', label: 'Customer profile', description: 'Owned by Growth Analytics' },
];
const everything = [...catalog, ...glossary, ...teams, ...products];

/** The OSS app's navigation: pages (permission-filtered by the app), every Settings section with synonyms, Account pages and actions. */
const commands: PaletteCommand[] = [
  { id: 'nav-home', label: 'Go to Home', group: 'Pages', icon: 'home', href: '/', keywords: ['dashboard', 'activity'] },
  { id: 'nav-discover', label: 'Go to Discover', group: 'Pages', icon: 'travel-explore', href: '/discover', shortcut: 'g d', keywords: ['search', 'browse', 'catalog'] },
  { id: 'nav-query', label: 'Open Query', group: 'Pages', icon: 'terminal', href: '/query', shortcut: 'g q', keywords: ['sql', 'editor'] },
  { id: 'nav-lineage', label: 'Go to Lineage', group: 'Pages', icon: 'account-tree', href: '/lineage', keywords: ['graph', 'dependencies'] },
  { id: 'nav-glossary', label: 'Go to Glossary', group: 'Pages', icon: 'book-2', href: '/glossary', keywords: ['terms', 'definitions'] },
  { id: 'nav-products', label: 'Go to Data products', group: 'Pages', icon: 'package-2', href: '/products' },
  { id: 'nav-insights', label: 'Go to Insights', group: 'Pages', icon: 'insights', href: '/insights', keywords: ['metrics', 'usage'] },
  { id: 'nav-plugins', label: 'Go to Plugins', group: 'Pages', icon: 'extension', href: '/plugins', keywords: ['pipelines', 'ingestion', 'connectors'] },
  { id: 'set-overview', label: 'Settings › Overview', group: 'Settings', icon: 'settings', href: '/settings' },
  { id: 'set-members', label: 'Settings › Members', group: 'Settings', icon: 'group', href: '/settings/members', keywords: ['users', 'people', 'invite'] },
  { id: 'set-teams', label: 'Settings › Teams', group: 'Settings', icon: 'groups', href: '/settings/teams' },
  { id: 'set-roles', label: 'Settings › Roles and permissions', group: 'Settings', icon: 'admin-panel-settings', href: '/settings/roles', keywords: ['rbac', 'access'] },
  { id: 'set-api', label: 'Settings › API keys', group: 'Settings', icon: 'key', href: '/settings/api-keys', keywords: ['tokens', 'credentials', 'secrets'] },
  { id: 'set-sso', label: 'Settings › Single sign-on', group: 'Settings', icon: 'shield', href: '/settings/sso', keywords: ['saml', 'oidc', 'okta'] },
  { id: 'set-audit', label: 'Settings › Query audit', group: 'Settings', icon: 'policy', href: '/settings/audit', keywords: ['logs', 'history'] },
  { id: 'set-webhooks', label: 'Settings › Webhooks', group: 'Settings', icon: 'webhook', href: '/settings/webhooks', keywords: ['notifications', 'slack'] },
  { id: 'acc-profile', label: 'Account › Profile', group: 'Account', icon: 'account-circle', href: '/account' },
  { id: 'acc-tokens', label: 'Account › Personal access tokens', group: 'Account', icon: 'vpn-key', href: '/account/tokens', keywords: ['api', 'credentials'] },
  { id: 'acc-notifications', label: 'Account › Notifications', group: 'Account', icon: 'notifications', href: '/account/notifications', keywords: ['email', 'subscriptions'] },
  { id: 'act-theme', label: 'Toggle theme', group: 'Actions', kind: 'action', icon: 'dark-mode', keywords: ['dark', 'light', 'peat'], run: () => {} },
  { id: 'act-sidebar', label: 'Toggle sidebar', group: 'Actions', kind: 'action', icon: 'view-sidebar', shortcut: 'mod+b', run: () => {} },
  { id: 'act-shortcuts', label: 'Show keyboard shortcuts', group: 'Actions', kind: 'action', icon: 'keyboard', shortcut: '?', keywords: ['help', 'keys'], run: () => document.querySelector('mm-shortcut-help')?.show() },
  { id: 'act-new-query', label: 'New query', group: 'Actions', kind: 'action', icon: 'add', shortcut: 'mod+enter', keywords: ['sql'], run: () => {} },
  { id: 'act-signout', label: 'Sign out', group: 'Actions', kind: 'action', icon: 'logout', run: () => {} },
];

const recents: PaletteItem[] = [
  catalog.find((a) => a.label === 'orders_daily')!,
  catalog.find((a) => a.label === 'shop.orders.v1')!,
  glossary[0]!,
  commands.find((c) => c.id === 'set-members')!,
];

const kindsFor: Record<PaletteScope, PaletteResult['kind'][]> = {
  all: ['asset', 'glossary', 'team', 'data-product'],
  assets: ['asset'],
  glossary: ['glossary'],
  teams: ['team'],
  pages: [],
  commands: [],
};

/** Searches the catalogue with artificial latency, honours the abort signal and ranks prefix matches first. */
const catalogSearch =
  ({ latency = 60, fail = false, limit = Infinity, never = false } = {}): PaletteSearch =>
  (q, signal, scope) =>
    new Promise((resolve, reject) => {
      const timer = never
        ? undefined
        : setTimeout(() => {
            if (fail) return reject(new Error('Search service unavailable'));
            const needle = q.toLowerCase();
            const kinds = kindsFor[scope];
            const hits = everything.filter((a) => kinds.includes(a.kind) && (a.label.toLowerCase().includes(needle) || a.mrn?.includes(needle)));
            hits.sort((a, b) => Number(!a.label.toLowerCase().startsWith(needle)) - Number(!b.label.toLowerCase().startsWith(needle)));
            resolve(hits.slice(0, limit));
          }, latency);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });

/* ------------------------------------------------------------------ helpers */

const mod = () => (isApple() ? 'Meta' : 'Control');
const palette = (root: HTMLElement) => root.querySelector('mm-command-palette')!;
const shadow = (root: HTMLElement) => palette(root).shadowRoot!;
const input = (root: HTMLElement) => shadow(root).querySelector('input')!;
const options = (root: HTMLElement) => [...shadow(root).querySelectorAll<HTMLElement>('[role="option"]')];
const activeOption = (root: HTMLElement) => shadow(root).querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
const label = (o: Element | null) => o?.querySelector('.label')?.textContent?.trim();

const onSelect = fn();
const preventNavigation = (e: CustomEvent<{ item: PaletteItem }>) => {
  // Stories never navigate away; apps let the palette follow `href` or handle it with their router.
  if (e.detail.item.href) e.preventDefault();
  onSelect(e.detail.item.id);
};

type Args = { query: string; scope: PaletteScope; placeholder: string };

const meta: Meta<Args> = {
  title: 'Components/Navigation/Command palette',
  component: 'mm-command-palette',
  args: { query: '', scope: 'all', placeholder: '' },
  argTypes: { scope: { control: 'select', options: ['all', 'assets', 'glossary', 'teams', 'pages', 'commands'] } },
  render: (a) => html`<mm-command-palette
      open
      query=${a.query}
      scope=${a.scope}
      placeholder=${a.placeholder}
      .commands=${commands}
      .recents=${recents}
      .search=${catalogSearch()}
      @mm-select=${preventNavigation}
    ></mm-command-palette>
    <mm-shortcut-help></mm-shortcut-help>`,
  parameters: {
    layout: 'fullscreen',
    // Modal stories render in their own frame on the docs page so their dialogs never stack.
    docs: { story: { inline: false, iframeHeight: 600 } },
    usage: {
      html: `<mm-command-palette global-shortcut search-href="/discover?q={query}"></mm-command-palette>
<script type="module">
  import '@marmotdata/elements/command-palette.js';
  const palette = document.querySelector('mm-command-palette');
  palette.commands = [
    { id: 'discover', label: 'Go to Discover', group: 'Pages', icon: 'travel-explore', href: '/discover', shortcut: 'g d' },
    { id: 'api-keys', label: 'Settings › API keys', group: 'Settings', icon: 'key', href: '/settings/api-keys', keywords: ['tokens', 'credentials'] },
    { id: 'theme', label: 'Toggle theme', kind: 'action', icon: 'dark-mode', run: toggleTheme },
  ];
  palette.search = (query, signal) =>
    fetch('/api/v1/search?q=' + encodeURIComponent(query), { signal }).then((r) => r.json());
</script>`,
      react: `import { MmCommandPalette } from '@marmotdata/react';
import { useNavigate } from 'react-router-dom';

export function Palette({ commands, recents }) {
  const navigate = useNavigate();
  return (
    <MmCommandPalette
      globalShortcut
      commands={commands}
      recents={recents}
      search={(query, signal) => api.search(query, { signal })}
      onMmSelect={(e) => {
        e.preventDefault();
        if (e.detail.item.href) navigate(e.detail.item.href);
      }}
    />
  );
}`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/command-palette.js';
  import { goto } from '$app/navigation';
  let { commands, recents } = $props();
  const search = (query: string, signal: AbortSignal) => api.search(query, { signal });
</script>

<mm-command-palette
  global-shortcut
  {commands}
  {recents}
  {search}
  onmm-select={(e) => {
    e.preventDefault();
    if (e.detail.item.href) goto(e.detail.item.href);
  }}
></mm-command-palette>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

/* ------------------------------------------------------------------ states */

export const DefaultOpen: Story = {
  name: 'Default open (recent items)',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('dialog')!.open).toBe(true));
    await expect(label(options(canvasElement)[0]!)).toBe('orders_daily');
    await expect(shadow(canvasElement).querySelector('.heading')!.textContent).toBe('Recent');
  },
};

export const NoRecents: Story = {
  name: 'Empty query without recents',
  render: () => html`<mm-command-palette open .commands=${commands} .search=${catalogSearch()} @mm-select=${preventNavigation}></mm-command-palette>`,
};

export const Typing: Story = {
  args: { query: 'orders' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('mark')).not.toBeNull());
    const first = options(canvasElement)[0]!;
    await expect(first.querySelector('mark')!.textContent).toBe('orders');
    await expect(getComputedStyle(first.querySelector('mark')!).fontWeight).toBe('600');
  },
};

export const ManyResults: Story = {
  name: 'Many results (virtualised)',
  // Stress data: kept out of the Storybook UI (see .storybook/main.ts), still run as a test.
  tags: ['!dev', 'stress'],
  args: { query: 'stg_' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(options(canvasElement).length).toBeGreaterThan(10), { timeout: 3000 });
    const total = Number(options(canvasElement)[0]!.getAttribute('aria-setsize'));
    await expect(total).toBeGreaterThan(200);
    // Only the visible slice is in the DOM.
    await expect(options(canvasElement).length).toBeLessThan(120);
    input(canvasElement).focus();
    await press('{End}');
    await waitFor(() => expect(activeOption(canvasElement)?.getAttribute('aria-posinset')).toBe(String(total)));
    await expect(input(canvasElement).getAttribute('aria-activedescendant')).toBe(activeOption(canvasElement)!.id);
    await press('{Home}');
    await waitFor(() => expect(activeOption(canvasElement)?.getAttribute('aria-posinset')).toBe('1'));
  },
};

export const Loading: Story = {
  args: { query: 'orders_daily' },
  render: (a) => html`<mm-command-palette open query=${a.query} .commands=${commands} .search=${catalogSearch({ never: true })}></mm-command-palette>`,
  play: async ({ canvasElement }) => {
    // Hidden for the first 200ms so fast searches never flash.
    await expect(shadow(canvasElement).querySelector('.status')).toBeNull();
    await waitFor(() => expect(shadow(canvasElement).querySelector('.status')?.textContent).toContain('Searching the catalog'), { timeout: 2000 });
  },
};

export const SearchError: Story = {
  name: 'Error',
  args: { query: 'orders' },
  render: (a) => html`<mm-command-palette open query=${a.query} .commands=${commands} .search=${errorSearch}></mm-command-palette>`,
  play: async ({ canvasElement }) => {
    errorSearch.mockClear();
    await waitFor(() => expect(shadow(canvasElement).querySelector('.retry')).not.toBeNull(), { timeout: 2000 });
    await expect(errorSearch).toHaveBeenCalledTimes(1);
    input(canvasElement).focus();
    // The retry row is an option, so the keyboard can reach it.
    await press('{End}{Enter}');
    await waitFor(() => expect(errorSearch).toHaveBeenCalledTimes(2));
  },
};
const errorSearch = fn(catalogSearch({ fail: true }));

export const EmptyResults: Story = {
  name: 'Empty results',
  args: { query: 'orders_dly' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('.empty')).not.toBeNull(), { timeout: 2000 });
    await expect(shadow(canvasElement).querySelector('.empty')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'No results for orders_dly. Try a table name, a column or an MRN.',
    );
    await expect(shadow(canvasElement).querySelector('[role="status"]')!.textContent).toBe(
      'No results for “orders_dly”. Try a table name, a column or an MRN.',
    );
    await expect(input(canvasElement)).toHaveAttribute('aria-expanded', 'false');
  },
};

const searchAll = fn((e: Event) => e.preventDefault());

export const SearchEverything: Story = {
  name: 'Search everything (search-href)',
  args: { query: 'orders_dly' },
  render: (a) => html`<mm-command-palette
    open
    query=${a.query}
    search-href="/discover?q={query}"
    .commands=${commands}
    .search=${catalogSearch()}
    @mm-select=${preventNavigation}
    @mm-search-all=${searchAll}
  ></mm-command-palette>`,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('.empty')).not.toBeNull(), { timeout: 2000 });
    const options = shadow(canvasElement).querySelectorAll('[role="option"]');
    await expect(options.length).toBe(1);
    await expect(options[0]!.textContent!.trim()).toBe('Search the catalog for “orders_dly”');
    input(canvasElement).focus();
    await press('{Enter}');
    await expect(searchAll).toHaveBeenCalledOnce();
    await expect((searchAll.mock.calls[0]![0] as CustomEvent).detail).toEqual({ query: 'orders_dly', scope: 'all', href: '/discover?q=orders_dly' });
  },
};

export const LongIdentifiers: Story = {
  name: 'Very long asset names and MRNs',
  args: { query: 'customers_dim_with' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('.mid')).not.toBeNull(), { timeout: 2000 });
    const mid = shadow(canvasElement).querySelector<HTMLElement>('.mid')!;
    // The MRN keeps its end visible and stays on one row.
    const tail = mid.querySelector('.tail')!.textContent!;
    await expect(tail.length).toBeGreaterThan(10);
    await expect(mid.title.endsWith(tail)).toBe(true);
    await expect(mid.querySelector('.head')!.scrollWidth).toBeGreaterThan(mid.querySelector('.head')!.clientWidth);
    await expect(options(canvasElement)[0]!.getBoundingClientRect().height).toBe(36);
  },
};

export const ScopedSearch: Story = {
  name: 'Scoped search (Assets)',
  args: { query: 'payments', scope: 'assets' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(options(canvasElement).length).toBeGreaterThan(0), { timeout: 2000 });
    const headings = [...shadow(canvasElement).querySelectorAll('.heading')].map((h) => h.textContent);
    await expect(headings).toEqual(['Assets']);
    await expect(shadow(canvasElement).querySelector('.chip[aria-pressed="true"]')!.textContent!.trim()).toBe('Assets');
  },
};

export const CommandsOnly: Story = {
  name: 'Commands only (> prefix)',
  args: { scope: 'commands' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(options(canvasElement).length).toBe(5));
    await expect(label(options(canvasElement)[0]!)).toBe('Toggle theme');
  },
};

export const KeywordSynonyms: Story = {
  name: 'Keyword synonyms',
  args: { query: 'tokens' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(options(canvasElement).length).toBeGreaterThan(0));
    // "tokens" is a synonym of Settings › API keys and a word in Personal access tokens.
    const labels = options(canvasElement).map(label);
    await expect(labels).toContain('Settings › API keys');
    await expect(labels.indexOf('Account › Personal access tokens')).toBeLessThan(labels.indexOf('Settings › API keys'));
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { query: 'orders' } };

export const BothThemes: Story = {
  parameters: { layout: 'padded', docs: { story: { inline: true } } },
  render: () =>
    themes(html`<mm-command-palette inline query="orders" .commands=${commands} .search=${catalogSearch()} @mm-select=${preventNavigation}></mm-command-palette>`),
};

/* ------------------------------------------------------------------ keyboard */

const app = () => html`<mm-button variant="secondary" icon="search">Search the catalog</mm-button>
  <mm-command-palette global-shortcut .commands=${commands} .recents=${recents} .search=${catalogSearch()} @mm-select=${preventNavigation}></mm-command-palette>
  <mm-shortcut-help global-shortcut></mm-shortcut-help>
  <p style="font:var(--text-caption);color:var(--mm-text-2)">Press ${isApple() ? '⌘' : 'Ctrl'}&nbsp;K to open the palette, or ? for keyboard shortcuts.</p>`;

export const KeyboardOpensInstantly: Story = {
  name: 'Keyboard: mod+K opens within one frame',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    const el = palette(canvasElement);
    const dialog = shadow(canvasElement).querySelector('dialog')!;
    await expect(dialog.open).toBe(false);
    await press(`{${mod()}>}k{/${mod()}}`);
    await expect(el.open).toBe(true);
    await expect(deepActive()).toBe(input(canvasElement));
    await press('{Escape}');
    await expect(el.open).toBe(false);

    // Measure: by the first animation frame after show(), the dialog is open, painted at full size and fully opaque.
    let atFirstFrame = { open: false, rows: 0, height: 0, opacity: '' };
    const frame = new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        atFirstFrame = { open: dialog.open, rows: options(canvasElement).length, height: dialog.getBoundingClientRect().height, opacity: getComputedStyle(dialog).opacity };
        resolve();
      }),
    );
    el.show();
    await frame;
    await expect(atFirstFrame.open).toBe(true);
    await expect(atFirstFrame.rows).toBeGreaterThan(0);
    await expect(atFirstFrame.height).toBeGreaterThan(200);
    await expect(atFirstFrame.opacity).toBe('1');
    const style = getComputedStyle(dialog);
    await expect(style.transitionDuration).toBe('0s');
    await expect(style.animationName).toBe('none');
    await press(`{${mod()}>}k{/${mod()}}`);
    await expect(el.open).toBe(false);
  },
};

export const KeyboardFilterAndArrows: Story = {
  name: 'Keyboard: typing filters, arrows wrap, Home and End',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    palette(canvasElement).show();
    await palette(canvasElement).updateComplete;
    await press('sett mem');
    await waitFor(() => expect(label(activeOption(canvasElement))).toBe('Settings › Members'));
    // Clear, then ">" switches to commands only and Backspace on the empty field leaves it.
    await press(`{${mod()}>}a{/${mod()}}{Backspace}>`);
    await expect(palette(canvasElement).scope).toBe('commands');
    await expect(options(canvasElement).map(label)).not.toContain('Settings › Members');
    await press('{Backspace}');
    await expect(palette(canvasElement).scope).toBe('all');
    await press('go');
    await waitFor(() => expect(options(canvasElement).length).toBeGreaterThan(2));
    const n = options(canvasElement).length;
    await press('{ArrowUp}');
    await expect(activeOption(canvasElement)!.getAttribute('aria-posinset')).toBe(String(n));
    await press('{ArrowDown}');
    await expect(activeOption(canvasElement)!.getAttribute('aria-posinset')).toBe('1');
    await press('{End}');
    await expect(activeOption(canvasElement)!.getAttribute('aria-posinset')).toBe(String(n));
    await press('{Home}');
    await expect(activeOption(canvasElement)!.getAttribute('aria-posinset')).toBe('1');
    await expect(input(canvasElement).getAttribute('aria-activedescendant')).toBe(activeOption(canvasElement)!.id);
    await press('{Escape}');
  },
};

export const KeyboardEnterSelects: Story = {
  name: 'Keyboard: Enter fires mm-select and closes',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    palette(canvasElement).show();
    await palette(canvasElement).updateComplete;
    await press('api keys');
    await waitFor(() => expect(label(activeOption(canvasElement))).toBe('Settings › API keys'));
    // The active row shows the Enter keycap.
    await expect(activeOption(canvasElement)!.querySelector('mm-kbd[keys="enter"]')).not.toBeNull();
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('set-api');
    await expect(palette(canvasElement).open).toBe(false);
  },
};

export const KeyboardEscapeRestoresFocus: Story = {
  name: 'Keyboard: Escape closes and returns focus',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('mm-button')!;
    trigger.focus();
    const before = deepActive();
    await press(`{${mod()}>}k{/${mod()}}`);
    await expect(deepActive()).toBe(input(canvasElement));
    await press('{Escape}');
    await expect(palette(canvasElement).open).toBe(false);
    await expect(deepActive()).toBe(before);
  },
};

export const KeyboardTabCyclesScope: Story = {
  name: 'Keyboard: Tab cycles scope',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    const el = palette(canvasElement);
    const scopes = onQuery;
    scopes.mockClear();
    el.addEventListener('mm-query', (e) => scopes((e as CustomEvent).detail.scope));
    el.show();
    await el.updateComplete;
    for (const s of ['assets', 'glossary', 'teams', 'pages', 'all']) {
      await press('{Tab}');
      await expect(el.scope).toBe(s);
      await expect(deepActive()).toBe(input(canvasElement));
    }
    await press('{Shift>}{Tab}{/Shift}');
    await expect(el.scope).toBe('pages');
    await expect(scopes).toHaveBeenLastCalledWith('pages');
    await press('{Escape}');
  },
};
const onQuery = fn();

export const KeyboardShortcutHelp: Story = {
  name: 'Keyboard: ? opens shortcut help, but not while typing',
  render: () => html`${app()}<label style="display:grid;gap:var(--space-1);max-width:320px;margin-top:var(--space-4)"
      ><span style="font:var(--text-label);color:var(--mm-text-2)">Asset description</span><input id="desc" style="font:var(--text-dense)"
    /></label>`,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    const help = canvasElement.querySelector('mm-shortcut-help')!;
    const field = canvasElement.querySelector<HTMLInputElement>('#desc')!;
    await click(field);
    await press('?');
    await expect(help.open).toBe(false);
    await expect(field.value).toBe('?');

    canvasElement.querySelector('mm-button')!.focus();
    await press('?');
    await expect(help.open).toBe(true);
    await press('{Escape}');
    await expect(help.open).toBe(false);

    // From the palette's "Show keyboard shortcuts" command.
    palette(canvasElement).show();
    await palette(canvasElement).updateComplete;
    await press('shortcuts');
    await waitFor(() => expect(label(activeOption(canvasElement))).toBe('Show keyboard shortcuts'));
    await press('{Enter}');
    await expect(palette(canvasElement).open).toBe(false);
    await expect(help.open).toBe(true);
    await press('{Escape}');
    await expect(help.open).toBe(false);
  },
};

export const PointerSelects: Story = {
  name: 'Pointer: click selects a row',
  render: app,
  parameters: { layout: 'padded' },
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    palette(canvasElement).show();
    await palette(canvasElement).updateComplete;
    const row = options(canvasElement).find((o) => label(o) === 'Go to Discover')!;
    await click(row);
    await expect(onSelect).toHaveBeenCalledWith('nav-discover');
    await nextFrame();
    await expect(palette(canvasElement).open).toBe(false);
  },
};
