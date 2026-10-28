import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/data-table.js';
import '@marmotdata/elements/copy-button.js';
import '@marmotdata/elements/menu-button.js';
import '@marmotdata/elements/menu.js';
import '@marmotdata/elements/tag.js';
import '@marmotdata/icons/define.js';
import type { DataTableColumn, MmDataTable } from './class.ts';

// ---- Realistic, deterministic sample data ----

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface Asset {
  id: string;
  name: string;
  provider: string;
  mrn: string;
  type: string;
  owner: string;
  rows: number | null;
  updated: string;
  status: string;
}

const SOURCES = [
  { provider: 'postgresql', type: 'Table', kind: 'table', ns: 'shop.public' },
  { provider: 'snowflake', type: 'Table', kind: 'table', ns: 'analytics.marts' },
  { provider: 'bigquery', type: 'View', kind: 'view', ns: 'growth.reporting' },
  { provider: 'kafka', type: 'Topic', kind: 'topic', ns: 'shop' },
  { provider: 's3', type: 'Bucket', kind: 'bucket', ns: 'lake-raw' },
  { provider: 'dbt', type: 'Model', kind: 'model', ns: 'marts.finance' },
  { provider: 'mysql', type: 'Table', kind: 'table', ns: 'billing' },
  { provider: 'airflow', type: 'Pipeline', kind: 'dag', ns: 'etl' },
];
const STEMS = ['orders', 'customers', 'payments', 'refunds', 'shipments', 'sessions', 'invoices', 'products', 'inventory', 'subscriptions', 'returns', 'carts'];
const SUFFIX = ['_daily', '_dim', '_fct', '_raw', '_v2', '_snapshot', '_hourly', ''];
const OWNERS = ['Analytics Engineering', 'Data Platform', 'Payments', 'Growth', 'Finance Data', 'Customer Insights'];
const STATES = ['succeeded', 'succeeded', 'succeeded', 'stale', 'running', 'failed'];

function makeAssets(n: number, seed = 7): Asset[] {
  const r = rng(seed);
  const now = Date.now();
  const out: Asset[] = [];
  for (let i = 0; i < n; i++) {
    const src = SOURCES[Math.floor(r() * SOURCES.length)]!;
    const stem = STEMS[Math.floor(r() * STEMS.length)]!;
    const name = `${stem}${SUFFIX[Math.floor(r() * SUFFIX.length)]}${n > 200 ? `_${i}` : ''}`;
    const sep = src.kind === 'topic' ? '.' : '.';
    out.push({
      id: `a-${i}`,
      name,
      provider: src.provider,
      mrn: `mrn://${src.provider}/${src.kind}/${src.ns}${sep}${name}`,
      type: src.type,
      owner: OWNERS[Math.floor(r() * OWNERS.length)]!,
      rows: src.kind === 'dag' ? null : Math.floor(r() ** 3 * 48_000_000),
      updated: new Date(now - Math.floor(r() * 1000 * 60 * 60 * 24 * 40)).toISOString(),
      status: STATES[Math.floor(r() * STATES.length)]!,
    });
  }
  return out;
}

const ASSETS = makeAssets(60);
ASSETS[0] = { ...ASSETS[0]!, name: 'orders', provider: 'postgresql', type: 'Table', mrn: 'mrn://postgresql/table/shop.public.orders', owner: 'Analytics Engineering', rows: 1_284_019, status: 'succeeded' };
ASSETS[1] = { ...ASSETS[1]!, name: 'customers_dim', provider: 'snowflake', type: 'Table', mrn: 'mrn://snowflake/table/analytics.marts.customers_dim', owner: 'Data Platform', rows: 412_880, status: 'stale' };
ASSETS[2] = { ...ASSETS[2]!, name: 'shop.orders.v2', provider: 'kafka', type: 'Topic', mrn: 'mrn://kafka/topic/shop.orders.v2', owner: 'Payments', rows: 38_114_002, status: 'running' };

let big: Asset[] | undefined;
const bigAssets = () => (big ??= makeAssets(100_000, 11));

const assetColumns = (): DataTableColumn<Asset>[] => [
  {
    key: 'name',
    header: 'Name',
    type: 'custom',
    sortable: true,
    resizable: true,
    minWidth: 200,
    render: (a) => html`<mm-provider-logo provider=${a.provider} size="16" decorative></mm-provider-logo><span class="text">${a.name}</span>`,
    href: (a) => `#asset/${encodeURIComponent(a.mrn)}`,
  },
  { key: 'mrn', header: 'MRN', type: 'mono', resizable: true, minWidth: 280 },
  { key: 'type', header: 'Type', sortable: true, resizable: true, width: 104, minWidth: 80 },
  { key: 'owner', header: 'Owner', sortable: true, resizable: true, minWidth: 160 },
  { key: 'rows', header: 'Rows', type: 'number', sortable: true, resizable: true, width: 120 },
  { key: 'updated', header: 'Updated', type: 'date', sortable: true, resizable: true, width: 136 },
  { key: 'status', header: 'Status', type: 'status', sortable: true, width: 132 },
];

const actionsColumn: DataTableColumn<Asset> = {
  key: 'actions',
  header: 'Actions',
  type: 'custom',
  width: 104,
  align: 'end',
  render: (a) => html`<mm-copy-button size="sm" value=${a.mrn} label="Copy MRN"></mm-copy-button>
    <mm-menu-button variant="ghost" size="sm" icon="more-horiz" label="More actions for ${a.name}" icon-only>
      <mm-menu label="Asset actions">
        <mm-menu-item icon="terminal" value="open-query">Open in Query</mm-menu-item>
        <mm-menu-item icon="account-tree" value="lineage">View lineage</mm-menu-item>
        <mm-menu-separator></mm-menu-separator>
        <mm-menu-item icon="delete" danger value="delete">Delete asset</mm-menu-item>
      </mm-menu>
    </mm-menu-button>`,
};

interface Member {
  id: string;
  name: string;
  email: string;
  kind: 'person' | 'agent';
  role: string;
  teams: string;
  lastActive: string;
  status: string;
}
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
const MEMBERS: Member[] = [
  { id: 'u1', name: 'Jane Doe', email: 'jane.doe@marmotdata.io', kind: 'person', role: 'Admin', teams: 'Data Platform', lastActive: ago(4), status: 'allowed' },
  { id: 'u2', name: 'John Ward', email: 'tomas.ferreira@marmotdata.io', kind: 'person', role: 'Editor', teams: 'Analytics Engineering', lastActive: ago(52), status: 'allowed' },
  { id: 'u3', name: 'support-triage-agent', email: 'agent:support-triage', kind: 'agent', role: 'Viewer', teams: 'Customer Insights', lastActive: ago(1), status: 'allowed' },
  { id: 'u4', name: 'Alex Walker', email: 'hannah.okafor@marmotdata.io', kind: 'person', role: 'Editor', teams: 'Payments', lastActive: ago(60 * 26), status: 'allowed' },
  { id: 'u5', name: 'revenue-forecast-agent', email: 'agent:revenue-forecast', kind: 'agent', role: 'Viewer', teams: 'Finance Data', lastActive: ago(60 * 3), status: 'denied' },
  { id: 'u6', name: 'Max Turner', email: 'callum.reid@marmotdata.io', kind: 'person', role: 'Viewer', teams: 'Growth', lastActive: ago(60 * 24 * 12), status: 'allowed' },
  { id: 'u7', name: 'Kim Young Zhou', email: 'meilin.zhou@marmotdata.io', kind: 'person', role: 'Owner', teams: 'Data Platform', lastActive: ago(60 * 5), status: 'allowed' },
];
const memberColumns: DataTableColumn<Member>[] = [
  {
    key: 'name',
    header: 'Member',
    type: 'custom',
    sortable: true,
    resizable: true,
    minWidth: 220,
    render: (m) => html`<mm-icon name=${m.kind === 'agent' ? 'smart-toy' : 'person'} label=${m.kind === 'agent' ? 'Agent' : 'Person'}></mm-icon><span class="text">${m.name}</span>`,
  },
  { key: 'email', header: 'Identity', type: 'mono', minWidth: 240, resizable: true },
  { key: 'role', header: 'Role', sortable: true, width: 104 },
  { key: 'teams', header: 'Team', sortable: true, minWidth: 160 },
  { key: 'lastActive', header: 'Last active', type: 'date', sortable: true, width: 140 },
  { key: 'status', header: 'Access', type: 'status', width: 120 },
];

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  duration: number;
  status: string;
}
const ACTIONS = ['query.run', 'asset.update', 'policy.evaluate', 'token.create', 'asset.read', 'lineage.read'];
const ACTORS = ['Jane Doe', 'support-triage-agent', 'John Ward', 'revenue-forecast-agent', 'Alex Walker'];
const TARGETS = ['mrn://postgresql/table/shop.public.orders', 'mrn://snowflake/table/analytics.marts.customers_dim', 'mrn://kafka/topic/shop.orders.v2', 'mrn://bigquery/view/growth.reporting.sessions_daily'];
const AUDIT: AuditEntry[] = (() => {
  const r = rng(3);
  return Array.from({ length: 240 }, (_, i) => ({
    id: `evt_${(9_812_400 + i).toString(36)}`,
    at: new Date(Date.UTC(2026, 9, 27, 4, 12, 9) - i * 47_000).toISOString(),
    actor: ACTORS[Math.floor(r() * ACTORS.length)]!,
    action: ACTIONS[Math.floor(r() * ACTIONS.length)]!,
    target: TARGETS[Math.floor(r() * TARGETS.length)]!,
    duration: Math.round(20 + r() ** 2 * 3000),
    status: r() > 0.88 ? 'denied' : 'allowed',
  }));
})();
const auditColumns: DataTableColumn<AuditEntry>[] = [
  { key: 'at', header: 'Time (UTC)', type: 'mono', width: 196, sortable: true, value: (e) => e.at.slice(0, 19).replace('T', ' ') },
  { key: 'actor', header: 'Actor', sortable: true, minWidth: 180 },
  { key: 'action', header: 'Action', type: 'mono', width: 150, sortable: true },
  { key: 'target', header: 'Target', type: 'mono', minWidth: 320, resizable: true },
  { key: 'duration', header: 'Duration', unit: 'ms', type: 'number', width: 120, sortable: true },
  { key: 'status', header: 'Decision', type: 'status', width: 120, sortable: true },
  { key: 'id', header: 'Event ID', type: 'mono', width: 120 },
];

// ---- Helpers ----

const tableIn = (el: HTMLElement) => el.querySelector('mm-data-table') as MmDataTable;
const sr = (el: HTMLElement) => tableIn(el).shadowRoot!;
const cellAt = (el: HTMLElement, r: number, c: number) => sr(el).querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`);
const pos = (node: Element | null) => {
  let cell = node as HTMLElement | null;
  while (cell && cell.dataset?.c === undefined) cell = (cell.parentElement ?? ((cell.getRootNode() as ShadowRoot).host as HTMLElement)) ?? null;
  return cell ? { r: Number(cell.dataset.r), c: Number(cell.dataset.c) } : null;
};
/** True when `node` is `host` or inside it, through shadow roots. */
const within = (host: Element, node: Node | null) => {
  let n: Node | null = node;
  while (n) {
    if (n === host) return true;
    n = n.parentNode ?? (n as ShadowRoot).host ?? null;
  }
  return false;
};
const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const onSort = fn();
const onSelect = fn();
const onActivate = fn();
const onResize = fn();
const onReorder = fn();
const onRetry = fn();

type Args = { selectable: boolean; reorderable: boolean; stickyFirstColumn: boolean; density: string; loading: boolean; error: string };

const assetsTable = (a: Partial<Args> & { rows?: Asset[]; height?: string; sort?: MmDataTable['sort']; selected?: unknown[]; actions?: boolean } = {}) =>
  html`<mm-data-table
    label="Assets"
    ?selectable=${a.selectable ?? true}
    ?reorderable=${a.reorderable ?? true}
    ?sticky-first-column=${a.stickyFirstColumn ?? false}
    density=${a.density || 'default'}
    ?loading=${a.loading ?? false}
    error=${a.error ?? ''}
    .columns=${a.actions ? [...assetColumns(), actionsColumn] : assetColumns()}
    .rows=${a.rows ?? ASSETS}
    .sort=${a.sort ?? null}
    .selected=${a.selected ?? []}
    .rowLabel=${(r: Asset) => `Select ${r.name}`}
    style=${a.height ? `--mm-data-table-max-height:${a.height}` : ''}
    @mm-sort-change=${(e: CustomEvent) => onSort(e.detail)}
    @mm-selection-change=${(e: CustomEvent) => onSelect(e.detail)}
    @mm-row-activate=${(e: CustomEvent) => onActivate(e.detail)}
    @mm-column-resize=${(e: CustomEvent) => onResize(e.detail)}
    @mm-column-reorder=${(e: CustomEvent) => onReorder(e.detail)}
    @mm-retry=${() => onRetry()}
  ></mm-data-table>`;

const meta: Meta<Args> = {
  title: 'Components/Data/Data table',
  component: 'mm-data-table',
  args: { selectable: true, reorderable: true, stickyFirstColumn: false, density: 'default', loading: false, error: '' },
  argTypes: { density: { control: 'inline-radio', options: ['default', 'compact'] } },
  render: (a) => assetsTable({ ...a, height: '420px' }),
  parameters: {
    usage: {
      html: `<mm-data-table id="assets" label="Assets" selectable row-key="mrn"></mm-data-table>
<script type="module">
  import '@marmotdata/elements/data-table.js';
  const table = document.getElementById('assets');
  table.columns = [
    { key: 'name', header: 'Name', sortable: true, href: (a) => '/assets/' + a.mrn },
    { key: 'mrn', header: 'MRN', type: 'mono' },
    { key: 'rows', header: 'Rows', type: 'number', sortable: true },
    { key: 'updated', header: 'Updated', type: 'date', sortable: true },
    { key: 'status', header: 'Status', type: 'status' },
  ];
  table.rows = assets;
  table.addEventListener('mm-row-activate', (e) => openAsset(e.detail.row));
</script>`,
      react: `import { MmDataTable } from '@marmotdata/react';

const columns = [
  { key: 'name', header: 'Name', sortable: true, href: (a) => \`/assets/\${a.mrn}\` },
  { key: 'mrn', header: 'MRN', type: 'mono' },
  { key: 'rows', header: 'Rows', type: 'number', sortable: true },
  { key: 'updated', header: 'Updated', type: 'date', sortable: true },
  { key: 'status', header: 'Status', type: 'status' },
];

<MmDataTable
  label="Assets"
  selectable
  rowKey="mrn"
  columns={columns}
  rows={assets}
  onMmSelectionChange={(e) => setSelected(e.detail.selected)}
  onMmRowActivate={(e) => navigate(\`/assets/\${e.detail.row.mrn}\`)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/data-table.js';
  let { assets } = $props();
  const columns = [
    { key: 'name', header: 'Name', sortable: true, href: (a) => \`/assets/\${a.mrn}\` },
    { key: 'mrn', header: 'MRN', type: 'mono' },
    { key: 'rows', header: 'Rows', type: 'number', sortable: true },
    { key: 'status', header: 'Status', type: 'status' },
  ];
</script>

<mm-data-table
  label="Assets"
  selectable
  row-key="mrn"
  columns={columns}
  rows={assets}
  onmm-selection-change={(e) => (selected = e.detail.selected)}
  onmm-row-activate={(e) => goto(\`/assets/\${e.detail.row.mrn}\`)}
></mm-data-table>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Members: Story = {
  render: () => html`<mm-data-table label="Members" .columns=${memberColumns} .rows=${MEMBERS} .sort=${{ key: 'name', direction: 'ascending' }}></mm-data-table>`,
};

export const AuditLog: Story = {
  name: 'Audit log',
  render: () => html`<mm-data-table label="Query audit log" density="compact" sticky-first-column style="--mm-data-table-max-height:420px" .columns=${auditColumns} .rows=${AUDIT}></mm-data-table>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: () => assetsTable({ rows: ASSETS.slice(0, 6) }) };
export const Active: Story = { parameters: { pseudo: { active: true } }, render: () => assetsTable({ rows: ASSETS.slice(0, 6) }) };

export const Focus: Story = {
  render: () => assetsTable({ rows: ASSETS.slice(0, 6) }),
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(cellAt(canvasElement, 0, 0));
    await press('{ArrowDown}{ArrowRight}');
    await expect(deepActive()).toBe(cellAt(canvasElement, 1, 1));
  },
};

export const Selected: Story = {
  name: 'Selected rows',
  render: () => assetsTable({ rows: ASSETS.slice(0, 8), selected: ['a-1', 'a-2', 'a-5'] }),
  play: async ({ canvasElement }) => {
    const rows = sr(canvasElement).querySelectorAll('.body [role="row"][aria-selected="true"]');
    await expect(rows.length).toBe(3);
    const all = sr(canvasElement).querySelector('.head mm-checkbox') as HTMLElement & { indeterminate: boolean };
    await expect(all.indeterminate).toBe(true);
  },
};

export const Sorted: Story = {
  render: () => assetsTable({ rows: ASSETS.slice(0, 12), sort: { key: 'rows', direction: 'descending' } }),
  play: async ({ canvasElement }) => {
    const header = cellAt(canvasElement, 0, 5)!;
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(header).toHaveTextContent('Sorted descending');
  },
};

export const Resizing: Story = {
  render: () => assetsTable({ rows: ASSETS.slice(0, 6) }),
  play: async ({ canvasElement }) => {
    const handle = cellAt(canvasElement, 0, 4)!.querySelector('.resize')!;
    handle.classList.add('active');
    await expect(handle).toHaveAttribute('role', 'separator');
  },
};

export const DisabledRows: Story = {
  name: 'Disabled rows',
  render: () => html`<mm-data-table
    label="Assets"
    selectable
    .columns=${assetColumns()}
    .rows=${ASSETS.slice(0, 8)}
    .rowDisabled=${(a: Asset) => a.status === 'failed' || a.type === 'Pipeline'}
  ></mm-data-table>`,
};

export const Loading: Story = {
  render: () => assetsTable({ rows: [], loading: true }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(sr(canvasElement).querySelector('.skeleton')).not.toBeNull(), { timeout: 1000 });
    await expect(sr(canvasElement).querySelector('[role="grid"]')).toHaveAttribute('aria-busy', 'true');
  },
};

export const Empty: Story = {
  render: () => html`<mm-data-table
    label="Assets"
    .columns=${assetColumns()}
    .rows=${[]}
    empty-heading="No assets catalogued yet"
    empty-text="No assets have been catalogued from this source yet. Add a plugin to catalogue it."
  ></mm-data-table>`,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => assetsTable({ rows: [], error: 'The catalog API did not respond within 30 s. Check that the Marmot server is running, then try again.' }),
  play: async ({ canvasElement }) => {
    onRetry.mockClear();
    const btn = sr(canvasElement).querySelector('mm-button')!;
    btn.click();
    await expect(onRetry).toHaveBeenCalledTimes(1);
  },
};

const LONG: Asset[] = [
  {
    ...ASSETS[0]!,
    id: 'l1',
    name: 'orders_daily_rollup_by_region_and_fulfilment_centre_with_returns_v3',
    mrn: 'mrn://snowflake/table/analytics.marts_finance_reporting.orders_daily_rollup_by_region_and_fulfilment_centre_with_returns_v3',
    owner: 'Analytics Engineering, Finance Data and Customer Insights',
    rows: 1_284_019_552,
  },
  { ...ASSETS[1]!, id: 'l2', name: 'customers_dim', mrn: 'mrn://postgresql/table/shop.public.customers_dim_scd2_with_marketing_preferences_and_consent_history' },
  ...ASSETS.slice(3, 6),
];

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="max-inline-size:720px">${assetsTable({ rows: LONG, stickyFirstColumn: true })}</div>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-data-table
    label="Long identifiers"
    .columns=${[
      { key: 'mrn', header: 'MRN', type: 'mono', minWidth: 360, resizable: true },
      { key: 'owner', header: 'Owner', minWidth: 160 },
      { key: 'rows', header: 'Rows', type: 'number', width: 140 },
    ] satisfies DataTableColumn<Asset>[]}
    .rows=${LONG}
  ></mm-data-table>`,
};

type Key = { name: string; prefix: string; uses: number | null; lastUsed: string | null; scope: string };
const KEYS: Key[] = [
  { name: 'support-inbox-prod', prefix: 'mk_live_c81R', uses: 1284019, lastUsed: '2026-10-27T09:10:00Z', scope: 'read:catalog' },
  { name: 'support-inbox-staging', prefix: 'mk_live_P0wa', uses: 4210, lastUsed: '2026-10-12T14:40:00Z', scope: 'read:catalog' },
  { name: 'dbt-ci', prefix: 'mk_live_9QeT', uses: null, lastUsed: null, scope: 'write:lineage' },
];

export const CellContent: Story = {
  name: 'Number headers, empty values and cell classes',
  render: () => html`<mm-data-table
    label="API keys"
    row-key="prefix"
    selectable
    .selected=${['mk_live_9QeT']}
    .columns=${[
      { key: 'name', header: 'Name', minWidth: 200, render: (k) => html`<a class="mm-link" href="#keys/${k.prefix}">${k.name}</a>` },
      { key: 'prefix', header: 'Key', width: 150, render: (k) => html`<span class="mm-mono">${k.prefix}</span>` },
      { key: 'scope', header: 'Scope', width: 150, render: (k) => html`<code>${k.scope}</code>` },
      { key: 'uses', header: 'Requests', type: 'number', width: 130, sortable: true, empty: 'None' },
      { key: 'lastUsed', header: 'Last used', type: 'date', width: 140, empty: 'Never' },
    ] satisfies DataTableColumn<Key>[]}
    .rows=${KEYS}
  ></mm-data-table>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-data-table') as MmDataTable;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await waitFor(() => expect(sr.querySelectorAll('.body .row').length).toBe(3));
    // The number header's label ends at the same edge as its values.
    const head = sr.querySelector('.head .cell[aria-colindex="5"] .label')!.getBoundingClientRect();
    const val = sr.querySelector('.body .cell[data-r="1"][aria-colindex="5"] .text')!.getBoundingClientRect();
    await expect(Math.abs(head.right - val.right)).toBeLessThan(2);
    // Empty values show the column's text in text-3 (text-2 in the selected row).
    const never = sr.querySelector('.body .cell[data-r="3"][aria-colindex="6"] .empty') as HTMLElement;
    await expect(never).toHaveTextContent('Never');
    await expect(sr.querySelector('.body .cell[data-r="3"][aria-colindex="5"]')).toHaveTextContent('None');
    const unselected = sr.querySelector('.body .row:not([aria-selected="true"]) .cell[aria-colindex="6"] time') as HTMLElement;
    await expect(unselected).toBeTruthy();
    // Classes from @marmotdata/css work inside cells.
    // Links in cells are quiet: ink, underlined only on hover and focus.
    const link = sr.querySelector('.mm-link') as HTMLElement;
    await expect(getComputedStyle(link).textDecorationLine).toBe('none');
    const mono = sr.querySelector('.mm-mono') as HTMLElement;
    await expect(getComputedStyle(mono).fontFamily).toMatch(/mono/i);
    // Keyboard: the grid stays one tab stop and arrows move between cells.
    await tab();
    await press('{ArrowRight}');
    await expect(deepActive()?.getAttribute('aria-colindex')).toBe('2');
  },
};

export const Compact: Story = { name: 'Compact density', render: () => assetsTable({ rows: ASSETS.slice(0, 12), density: 'compact' }) };

export const StickyFirstColumn: Story = {
  name: 'Sticky first column',
  render: () => html`<div style="max-inline-size:640px">${assetsTable({ rows: ASSETS.slice(0, 12), stickyFirstColumn: true })}</div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => assetsTable({ rows: ASSETS.slice(0, 8) }) };

export const BothThemes: Story = {
  render: () => themes(assetsTable({ rows: ASSETS.slice(0, 6), selected: ['a-1'], sort: { key: 'rows', direction: 'descending' } })),
};

// ---- Performance ----

export const HundredThousandRows: Story = {
  name: '100,000 rows',
  // Stress data: kept out of the Storybook UI (see .storybook/main.ts), still run as a test.
  tags: ['!dev', 'stress'],
  render: () => assetsTable({ rows: bigAssets(), height: '480px' }),
  play: async ({ canvasElement }) => {
    const table = tableIn(canvasElement);
    await table.updateComplete;
    await settle();
    const rowsInDom = () => sr(canvasElement).querySelectorAll('[role="row"]').length;
    await expect(rowsInDom()).toBeLessThan(200);
    await expect(sr(canvasElement).querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '100001');
    const scroller = sr(canvasElement).querySelector<HTMLElement>('.scroller')!;
    const t0 = performance.now();
    scroller.scrollTop = 40 * 50_000;
    await settle();
    await table.updateComplete;
    const frame = performance.now() - t0;
    await expect(rowsInDom()).toBeLessThan(200);
    const indexes = [...sr(canvasElement).querySelectorAll('.body [role="row"]')].map((r) => Number(r.getAttribute('aria-rowindex')));
    await expect(Math.min(...indexes)).toBeGreaterThan(49_000);
    await expect(frame).toBeLessThan(1000);
    // Ctrl+End reaches the last row.
    await tab();
    await press('{Control>}{End}{/Control}');
    await waitFor(() => expect(pos(deepActive())?.r).toBe(100_000));
    await expect(rowsInDom()).toBeLessThan(200);
  },
};

// ---- Keyboard ----

export const KeyboardGrid: Story = {
  name: 'Keyboard: grid navigation',
  render: () => assetsTable({ rows: ASSETS, height: '360px' }),
  play: async ({ canvasElement }) => {
    await tab();
    await expect(pos(deepActive())).toEqual({ r: 0, c: 0 });
    await press('{ArrowDown}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 0 });
    await press('{ArrowRight}{ArrowRight}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 2 });
    await press('{End}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 7 });
    await press('{Home}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 0 });
    await press('{PageDown}');
    await waitFor(() => expect(pos(deepActive())!.r).toBeGreaterThan(4));
    await press('{Control>}{End}{/Control}');
    await waitFor(() => expect(pos(deepActive())).toEqual({ r: ASSETS.length, c: 7 }));
    await expect(deepActive()!.closest('[role="row"]')).toHaveAttribute('aria-rowindex', String(ASSETS.length + 1));
    // The sticky header never hides the focused cell.
    const scroller = sr(canvasElement).querySelector('.scroller')!.getBoundingClientRect();
    const head = sr(canvasElement).querySelector('.head')!.getBoundingClientRect();
    await press('{Control>}{Home}{/Control}');
    await waitFor(() => expect(pos(deepActive())).toEqual({ r: 0, c: 0 }));
    await press('{ArrowDown}');
    const cell = (deepActive() as HTMLElement).getBoundingClientRect();
    await expect(cell.top).toBeGreaterThanOrEqual(head.bottom - 1);
    await expect(cell.bottom).toBeLessThanOrEqual(scroller.bottom + 1);
  },
};

export const KeyboardSort: Story = {
  name: 'Keyboard: sort from the header',
  render: () => assetsTable({ rows: ASSETS.slice(0, 20) }),
  play: async ({ canvasElement }) => {
    onSort.mockClear();
    await tab();
    await press('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(pos(deepActive())).toEqual({ r: 0, c: 5 });
    await press('{Enter}');
    await expect(onSort).toHaveBeenLastCalledWith({ key: 'rows', direction: 'ascending' });
    await waitFor(() => expect(cellAt(canvasElement, 0, 5)).toHaveAttribute('aria-sort', 'ascending'));
    const firstRows = () => tableIn(canvasElement).viewRows[0] as Asset;
    const min = Math.min(...ASSETS.slice(0, 20).map((a) => a.rows ?? Infinity));
    await expect(firstRows().rows).toBe(min);
    await press('{Space}');
    await expect(onSort).toHaveBeenLastCalledWith({ key: 'rows', direction: 'descending' });
    await waitFor(() => expect(cellAt(canvasElement, 0, 5)).toHaveAttribute('aria-sort', 'descending'));
    await press('{Enter}');
    await expect(onSort).toHaveBeenLastCalledWith({ key: 'rows', direction: null });
    await waitFor(() => expect(cellAt(canvasElement, 0, 5)).not.toHaveAttribute('aria-sort'));
    await expect(deepActive()).toBe(cellAt(canvasElement, 0, 5));
  },
};

export const KeyboardSelection: Story = {
  name: 'Keyboard: select with Space and Shift',
  render: () => assetsTable({ rows: ASSETS.slice(0, 20) }),
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const selectedRows = () => [...sr(canvasElement).querySelectorAll('.body [role="row"][aria-selected="true"]')].map((r) => Number(r.getAttribute('aria-rowindex')));
    await tab();
    await press('{ArrowDown}{ArrowRight}');
    await press('{Space}');
    await expect(selectedRows()).toEqual([2]);
    await expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ selected: ['a-0'] }));
    await press('{ArrowDown}{ArrowDown}{ArrowDown}');
    await press('{Shift>}{Space}{/Shift}');
    await waitFor(() => expect(selectedRows()).toEqual([2, 3, 4, 5]));
    const all = sr(canvasElement).querySelector('.head mm-checkbox') as HTMLElement & { indeterminate: boolean; checked: boolean };
    await expect(all.indeterminate).toBe(true);
    await press('{Space}');
    await waitFor(() => expect(selectedRows()).toEqual([2, 3, 4]));
    // Select all from the header checkbox cell.
    await press('{Control>}{Home}{/Control}');
    await press('{Space}');
    await waitFor(() => expect(all.checked).toBe(true));
    await expect(onSelect.mock.lastCall![0].selected).toHaveLength(20);
    await press('{Enter}');
    await waitFor(() => expect(all.checked).toBe(false));
  },
};

export const KeyboardResize: Story = {
  name: 'Keyboard: resize a column',
  render: () => assetsTable({ rows: ASSETS.slice(0, 6) }),
  play: async ({ canvasElement }) => {
    onResize.mockClear();
    await tab();
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    await press('{F2}');
    const handle = deepActive() as HTMLElement;
    await expect(handle).toHaveAttribute('role', 'separator');
    await expect(handle).toHaveAttribute('aria-label', 'Resize Type column');
    // The handle starts at the width on screen; arrow keys step 10px from there.
    await waitFor(() => expect(Number(handle.getAttribute('aria-valuenow'))).toBe(Math.round(handle.parentElement!.getBoundingClientRect().width)));
    const start = Number(handle.getAttribute('aria-valuenow'));
    await press('{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(handle).toHaveAttribute('aria-valuenow', String(start + 20)));
    await expect(onResize).toHaveBeenLastCalledWith({ key: 'type', width: start + 20 });
    await press('{Shift>}{ArrowLeft}{/Shift}');
    await waitFor(() => expect(handle).toHaveAttribute('aria-valuenow', '80'));
    await press('{Escape}');
    await expect(pos(deepActive())).toEqual({ r: 0, c: 3 });
  },
};

export const KeyboardReorder: Story = {
  name: 'Keyboard: move a column',
  render: () => assetsTable({ rows: ASSETS.slice(0, 6) }),
  play: async ({ canvasElement }) => {
    onReorder.mockClear();
    await tab();
    await press('{ArrowRight}{ArrowRight}');
    await expect(cellAt(canvasElement, 0, 2)).toHaveTextContent('MRN');
    await press('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    await expect(onReorder).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'mrn', from: 1, to: 2 }));
    await waitFor(() => expect(cellAt(canvasElement, 0, 3)).toHaveTextContent('MRN'));
    await expect(pos(deepActive())).toEqual({ r: 0, c: 3 });
  },
};

export const KeyboardCellContent: Story = {
  name: 'Keyboard: buttons inside a cell',
  render: () => assetsTable({ rows: ASSETS.slice(0, 6), actions: true }),
  play: async ({ canvasElement }) => {
    await tab();
    await press('{ArrowDown}{End}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 8 });
    const cell = cellAt(canvasElement, 1, 8)!;
    const copy = cell.querySelector('mm-copy-button')!;
    const more = cell.querySelector('mm-menu-button')!;
    // Cell content is not in the Tab sequence until you enter the cell.
    await expect(copy.tabIndex).toBe(-1);
    await press('{Enter}');
    await waitFor(() => expect(within(copy, deepActive())).toBe(true));
    await expect(pos(deepActive())).toEqual({ r: 1, c: 8 });
    await press('{Tab}');
    await waitFor(() => expect(within(more, deepActive())).toBe(true));
    await press('{Tab}');
    await waitFor(() => expect(within(copy, deepActive())).toBe(true));
    await press('{Escape}');
    await expect(deepActive()).toBe(cell);
    await expect(copy.tabIndex).toBe(-1);
  },
};

export const KeyboardActivate: Story = {
  name: 'Keyboard: Enter activates the row',
  render: () => assetsTable({ rows: ASSETS.slice(0, 6) }),
  play: async ({ canvasElement }) => {
    onActivate.mockClear();
    await tab();
    await press('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(pos(deepActive())).toEqual({ r: 2, c: 3 });
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledWith({ row: ASSETS[1], index: 1 });
    // The name cell is the row link: Enter follows it.
    await press('{Home}{ArrowRight}');
    const link = cellAt(canvasElement, 2, 1)!.querySelector('a')!;
    const clicked = fn((e: Event) => e.preventDefault());
    link.addEventListener('click', clicked);
    await press('{Enter}');
    await expect(clicked).toHaveBeenCalledTimes(1);
  },
};
