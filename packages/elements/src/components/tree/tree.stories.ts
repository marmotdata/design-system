import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/tree.js';
import type { MmTree, TreeAction, TreeNode } from './class.ts';

// ---- data -----------------------------------------------------------------

const col = (table: string, name: string, type: string, extra: Partial<TreeNode> = {}): TreeNode => ({
  id: `${table}.${name}`,
  label: name,
  icon: 'view-column',
  secondary: type,
  secondaryMono: true,
  ...extra,
});
const ordersColumns = (t: string) => [
  col(t, 'order_id', 'int8', { badges: [{ label: 'Primary key' }] }),
  col(t, 'customer_id', 'int8'),
  col(t, 'status', 'varchar(32)'),
  col(t, 'total', 'numeric(12,2)'),
  col(t, 'currency', 'char(3)'),
  col(t, 'created_at', 'timestamptz'),
];
const customersColumns = (t: string) => [
  col(t, 'customer_id', 'int8'),
  col(t, 'email', 'varchar(255)', { badges: [{ label: 'PII', variant: 'pii' }] }),
  col(t, 'full_name', 'varchar(255)', { badges: [{ label: 'PII', variant: 'pii' }] }),
  col(t, 'country_code', 'char(2)'),
  col(t, 'signed_up_at', 'timestamptz'),
];
const paymentsColumns = (t: string) => [
  col(t, 'payment_id', 'uuid'),
  col(t, 'order_id', 'int8'),
  col(t, 'amount', 'numeric(12,2)'),
  col(t, 'method', 'varchar(16)'),
  col(t, 'captured_at', 'timestamptz'),
];

const table = (id: string, label: string, rows: string, children: TreeNode[], extra: Partial<TreeNode> = {}): TreeNode => ({
  id,
  label,
  icon: 'table',
  secondary: rows,
  children,
  ...extra,
});

const shopProd = (): TreeNode[] => [
  {
    id: 'shop-prod',
    label: 'shop-prod',
    provider: 'postgresql',
    secondary: 'PostgreSQL 16',
    secondaryMono: false,
    children: [
      {
        id: 'shop-prod/shop',
        label: 'shop',
        icon: 'database',
        children: [
          {
            id: 'shop-prod/shop/public',
            label: 'public',
            icon: 'schema',
            children: [
              table('public.orders', 'orders', '1,284,019 rows', ordersColumns('public.orders'), { badges: [{ label: 'Certified', variant: 'certified' }] }),
              table('public.customers', 'customers', '412,880 rows', customersColumns('public.customers')),
              table('public.payments', 'payments', '1,190,442 rows', paymentsColumns('public.payments')),
            ],
          },
          {
            id: 'shop-prod/shop/audit',
            label: 'audit',
            icon: 'schema',
            children: [table('audit.order_events', 'order_events', '18,402,311 rows', [col('audit.order_events', 'event_id', 'uuid'), col('audit.order_events', 'payload', 'jsonb')])],
          },
        ],
      },
    ],
  },
  { id: 'analytics-snowflake', label: 'analytics', provider: 'snowflake', secondary: 'Snowflake', secondaryMono: false, hasChildren: true },
  { id: 'events-kafka', label: 'events', provider: 'kafka', secondary: 'Kafka', secondaryMono: false, hasChildren: true },
];

const sourceActions = (node: TreeNode): TreeAction[] =>
  node.icon === 'table' || node.icon === 'view-column'
    ? [
        { id: 'insert', label: 'Insert into editor', icon: 'keyboard-return' },
        { id: 'open', label: 'Open in catalog', icon: 'open-in-new' },
      ]
    : [];

const lazySource = (delay = 600, fail = false) => {
  let attempts = 0;
  return (node: TreeNode, signal: AbortSignal) =>
    new Promise<TreeNode[]>((resolve, reject) => {
      attempts++;
      const timer = setTimeout(() => {
        if (fail && attempts === 1) {
          reject(new Error(`Could not reach ${node.label}: connection timed out after 30 s.`));
          return;
        }
        resolve(
          node.id === 'events-kafka'
            ? [
                { id: 'shop.orders.v2', label: 'shop.orders.v2', icon: 'stream', secondary: '12 partitions' },
                { id: 'shop.payments.v1', label: 'shop.payments.v1', icon: 'stream', secondary: '6 partitions' },
              ]
            : [
                {
                  id: 'ANALYTICS.MARTS',
                  label: 'MARTS',
                  icon: 'schema',
                  children: [
                    table('MARTS.ORDERS_DAILY', 'ORDERS_DAILY', '3,652 rows', []),
                    table('MARTS.CUSTOMERS_DIM', 'CUSTOMERS_DIM', '412,880 rows', []),
                  ],
                },
              ],
        );
      }, delay);
      signal.addEventListener('abort', () => clearTimeout(timer));
    });
};

const dbtProject = (): TreeNode[] => [
  {
    id: 'dbt',
    label: 'analytics',
    provider: 'dbt',
    secondary: 'dbt 1.8',
    secondaryMono: false,
    children: [
      {
        id: 'dbt/models',
        label: 'models',
        icon: 'folder',
        children: [
          {
            id: 'dbt/models/staging',
            label: 'staging',
            icon: 'folder',
            children: [
              { id: 'model.analytics.stg_orders', label: 'stg_orders', icon: 'data-object', secondary: 'view' },
              { id: 'model.analytics.stg_customers', label: 'stg_customers', icon: 'data-object', secondary: 'view' },
              { id: 'model.analytics.stg_payments', label: 'stg_payments', icon: 'data-object', secondary: 'view' },
            ],
          },
          {
            id: 'dbt/models/marts',
            label: 'marts',
            icon: 'folder',
            children: [
              { id: 'model.analytics.orders_daily', label: 'orders_daily', icon: 'data-object', secondary: 'incremental', badges: [{ label: 'Certified', variant: 'certified' }] },
              { id: 'model.analytics.customers_dim', label: 'customers_dim', icon: 'data-object', secondary: 'table' },
            ],
          },
        ],
      },
      {
        id: 'dbt/seeds',
        label: 'seeds',
        icon: 'folder',
        children: [{ id: 'seed.analytics.country_codes', label: 'country_codes', icon: 'table', secondary: 'seed' }],
      },
      {
        id: 'dbt/tests',
        label: 'tests',
        icon: 'folder',
        children: [
          { id: 'test.analytics.not_null_orders_order_id', label: 'not_null_orders_order_id', icon: 'rule', secondary: 'generic' },
          { id: 'test.analytics.unique_customers_dim_customer_id', label: 'unique_customers_dim_customer_id', icon: 'rule', secondary: 'generic' },
        ],
      },
    ],
  },
];

/** 20 databases × 25 schemas × 100 tables = 50,000 tables (50,520 nodes). */
const bigTree = (() => {
  let cache: TreeNode[] | null = null;
  return () => {
    if (cache) return cache;
    const domains = ['finance', 'growth', 'logistics', 'payments', 'support', 'marketing', 'risk', 'catalogue', 'identity', 'search'];
    cache = Array.from({ length: 20 }, (_, d) => ({
      id: `db${d}`,
      label: `warehouse_${String(d + 1).padStart(2, '0')}`,
      icon: 'database',
      children: Array.from({ length: 25 }, (_, s) => ({
        id: `db${d}.s${s}`,
        label: `${domains[s % domains.length]}_${s + 1}`,
        icon: 'schema',
        children: Array.from({ length: 100 }, (_, t) => ({
          id: `db${d}.s${s}.t${t}`,
          label: `${['orders', 'events', 'accounts', 'invoices', 'sessions'][t % 5]}_${String(t + 1).padStart(3, '0')}`,
          icon: 'table',
          secondary: `${((d * 7919 + s * 104729 + t * 1299709) % 9_000_000).toLocaleString('en-GB')} rows`,
        })),
      })),
    }));
    return cache;
  };
})();
const allIds = (nodes: TreeNode[]): string[] => nodes.flatMap((n) => (n.children ? [n.id, ...allIds(n.children)] : []));

// ---- helpers ----------------------------------------------------------------

const treeOf = (root: Element) => root.querySelector('mm-tree')!;
const treeEl = (t: MmTree) => t.shadowRoot!.querySelector<HTMLElement>('[role=tree]')!;
const activeRow = (t: MmTree) => {
  const id = treeEl(t).getAttribute('aria-activedescendant');
  return id ? t.shadowRoot!.getElementById(id) : null;
};
const activeLabel = (t: MmTree) => activeRow(t)?.querySelector('.label')?.textContent?.trim();
const expectActive = (t: MmTree, label: string) => waitFor(() => expect(activeLabel(t)).toBe(label));
const rowByLabel = (t: MmTree, label: string) =>
  [...t.shadowRoot!.querySelectorAll<HTMLElement>('[role=treeitem]')].find((r) => r.querySelector('.label')?.textContent?.trim() === label);

// ---- meta -------------------------------------------------------------------

type Args = { label: string; selection: 'none' | 'single' | 'multiple'; filterable: boolean; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data/Tree',
  component: 'mm-tree',
  args: { label: 'Query sources', selection: 'single', filterable: true, loading: false, error: '' },
  argTypes: { selection: { control: 'inline-radio', options: ['none', 'single', 'multiple'] } },
  render: (a) => html`<div style="width:360px">
    <mm-tree
      label=${a.label}
      selection=${a.selection}
      ?filterable=${a.filterable}
      ?loading=${a.loading}
      error=${a.error}
      filter-label="Filter sources"
      filter-placeholder="Filter tables and columns"
      .nodes=${shopProd()}
      .expandedIds=${['shop-prod', 'shop-prod/shop', 'shop-prod/shop/public']}
      .actions=${sourceActions}
      .loadChildren=${lazySource()}
    ></mm-tree>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-tree id="sources" label="Query sources" filterable filter-label="Filter sources"></mm-tree>
<script type="module">
  const tree = document.querySelector('#sources');
  tree.nodes = await api.listQuerySources();
  tree.loadChildren = (node, signal) => api.listChildren(node.id, { signal });
  tree.actions = [{ id: 'insert', label: 'Insert into editor', icon: 'keyboard-return' }];
  tree.addEventListener('mm-action', (e) => editor.insert(e.detail.node.label));
</script>`,
      react: `import { MmTree } from '@marmotdata/react';

<MmTree
  label="Query sources"
  filterable
  nodes={sources}
  loadChildren={(node, signal) => api.listChildren(node.id, { signal })}
  actions={[{ id: 'insert', label: 'Insert into editor', icon: 'keyboard-return' }]}
  onMmActivate={(e) => openAsset(e.detail.node)}
  onMmAction={(e) => editor.insert(e.detail.node.label)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/tree.js';
  let { sources } = $props();
</script>

<mm-tree
  label="Query sources"
  filterable
  nodes={sources}
  loadChildren={(node, signal) => api.listChildren(node.id, { signal })}
  onmm-activate={(e) => openAsset(e.detail.node)}
></mm-tree>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const QuerySourceBrowser: Story = { name: 'Query source browser' };

export const DbtProject: Story = {
  name: 'dbt project',
  render: () => html`<div style="width:360px">
    <mm-tree label="dbt project" .nodes=${dbtProject()} .expandedIds=${['dbt', 'dbt/models', 'dbt/models/marts']} .selectedIds=${['model.analytics.orders_daily']}></mm-tree>
  </div>`,
};

export const FiftyThousandNodes: Story = {
  name: '50,000 nodes',
  // Stress data: kept out of the Storybook UI (see .storybook/main.ts), still run as a test.
  tags: ['!dev', 'stress'],
  render: () => html`<div style="width:360px">
    <p style="font:var(--text-caption);color:var(--mm-text-2);margin:0 0 var(--space-2)">20 databases, 500 schemas and 50,000 tables, all expanded. Only the visible rows are rendered.</p>
    <mm-tree label="Warehouse" filterable filter-label="Filter tables" style="--mm-tree-height:28rem" .nodes=${bigTree()} .expandedIds=${allIds(bigTree())}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await waitFor(() => expect(t.shadowRoot!.querySelectorAll('[role=treeitem]').length).toBeGreaterThan(5));
    // Far fewer rows are in the DOM than exist.
    await expect(t.shadowRoot!.querySelectorAll('[role=treeitem]').length).toBeLessThan(200);
    treeEl(t).focus();
    await press('{End}');
    await expectActive(t, 'sessions_100');
    await waitFor(() => expect(activeRow(t)).toHaveAttribute('aria-posinset', '100'));
    await expect(activeRow(t)).toHaveAttribute('aria-level', '3');
    await press('{Home}');
    await expectActive(t, 'warehouse_01');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await tab(); // filter field
    await tab();
    await expect(deepActive()).toBe(treeEl(t));
    await expectActive(t, 'shop-prod');
  },
};

export const Selected: Story = {
  name: 'Active and selected',
  render: () => html`<div style="width:360px">
    <mm-tree label="Query sources" .nodes=${shopProd()} .expandedIds=${['shop-prod', 'shop-prod/shop', 'shop-prod/shop/public', 'public.orders']} .selectedIds=${['public.orders']} .actions=${sourceActions}></mm-tree>
  </div>`,
};

export const MultipleSelection: Story = {
  name: 'Multiple selection',
  render: () => html`<div style="width:360px">
    <mm-tree label="Columns to export" selection="multiple" .nodes=${shopProd()} .expandedIds=${['shop-prod', 'shop-prod/shop', 'shop-prod/shop/public', 'public.customers']} .selectedIds=${['public.customers.email', 'public.customers.full_name']}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await expect(treeEl(t)).toHaveAttribute('aria-multiselectable', 'true');
    await waitFor(() => expect(rowByLabel(t, 'email')).toBeTruthy());
    treeEl(t).focus();
    await press('{Home}');
    await press('cus');
    await expectActive(t, 'customers');
    await new Promise((r) => setTimeout(r, 600)); // let the typeahead buffer clear so Space selects
    await press('{ArrowDown}{Space}'); // customer_id
    await waitFor(() => expect(t.selectedIds).toEqual(['public.customers.email', 'public.customers.full_name', 'public.customers.customer_id']));
    await press('{ArrowDown}{Space}'); // email off
    await waitFor(() => expect(t.selectedIds).not.toContain('public.customers.email'));
  },
};

export const LazyLoading: Story = {
  name: 'Loading children',
  render: () => html`<div style="width:360px">
    <mm-tree label="Query sources" .nodes=${shopProd()} .loadChildren=${lazySource(60_000)} .expandedIds=${['analytics-snowflake']}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await waitFor(() => expect(rowByLabel(t, 'analytics')).toHaveAttribute('aria-busy', 'true'));
    // The loading row appears only after 200ms.
    await waitFor(() => expect(t.shadowRoot!.querySelector('.row.status')).not.toBeNull(), { timeout: 1000 });
  },
};

export const LoadError: Story = {
  name: 'Error loading children, then retry',
  render: () => html`<div style="width:360px">
    <mm-tree label="Query sources" .nodes=${shopProd()} .loadChildren=${lazySource(10, true)}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    treeEl(t).focus();
    await press('{End}'); // events
    await expectActive(t, 'events');
    await press('{ArrowRight}');
    await waitFor(() => expect(t.shadowRoot!.querySelector('.row.status.error')).not.toBeNull());
    await press('{ArrowDown}');
    await waitFor(() => expect(activeRow(t)?.classList.contains('error')).toBe(true));
    await expect(activeRow(t)?.getAttribute('aria-label')).toContain('Retry');
    await press('{Enter}');
    await waitFor(() => expect(rowByLabel(t, 'shop.orders.v2')).toBeTruthy());
  },
};

export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Could not list query sources. The query service did not respond.' } };
export const Empty: Story = {
  render: () => html`<div style="width:360px">
    <mm-tree label="Query sources" empty-text="No query sources have been connected yet. Add a source in Settings to browse its tables here." .nodes=${[]}></mm-tree>
  </div>`,
};

export const Filtering: Story = {
  name: 'Filter highlights and expands matches',
  render: () => html`<div style="width:360px">
    <mm-tree label="Query sources" filterable filter-label="Filter sources" .nodes=${shopProd()}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await tab();
    await press('customer');
    await waitFor(() => expect(t.filter).toBe('customer'));
    await waitFor(() => expect(rowByLabel(t, 'customer_id')).toBeTruthy());
    await expect(rowByLabel(t, 'customers')?.querySelector('mark')?.textContent).toBe('customer');
    await expect(rowByLabel(t, 'payments')).toBeUndefined();
    await expect(rowByLabel(t, 'public')).toHaveAttribute('aria-expanded', 'true');
    await press('zzzz');
    await waitFor(() => expect(t.shadowRoot!.querySelector('.message')?.textContent).toContain('Nothing matches'));
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content and long identifiers',
  render: () => html`<div style="width:280px">
    <mm-tree
      label="Query sources"
      .nodes=${[
        {
          id: 'x',
          label: 'warehouse-eu-west-2-production-replica',
          provider: 'postgresql',
          children: [
            { id: 'y', label: 'customer_lifetime_value_by_acquisition_channel_and_cohort_month', icon: 'table', secondary: '18,402,311 rows', badges: [{ label: 'Certified', variant: 'certified' }] },
            { id: 'z', label: 'shipping_address_line_2_normalised', icon: 'view-column', secondary: 'varchar(255)', secondaryMono: true, badges: [{ label: 'PII', variant: 'pii' }] },
          ],
        },
      ] as TreeNode[]}
      .expandedIds=${['x']}
    ></mm-tree>
  </div>`,
};

export const Compact: Story = {
  name: 'Compact density',
  render: (a, c) => html`<div data-density="compact">${meta.render!(a, c)}</div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="width:360px">
    <mm-tree label="مصادر الاستعلام" .nodes=${dbtProject()}></mm-tree>
  </div>`,
  play: async ({ canvasElement }) => {
    const t = treeOf(canvasElement);
    await tab();
    await expectActive(t, 'analytics');
    await press('{ArrowLeft}'); // expands in RTL
    await waitFor(() => expect(rowByLabel(t, 'analytics')).toHaveAttribute('aria-expanded', 'true'));
    await press('{ArrowLeft}'); // moves to first child
    await expectActive(t, 'models');
    await press('{ArrowRight}'); // moves to parent in RTL
    await expectActive(t, 'analytics');
    await press('{ArrowRight}'); // collapses
    await waitFor(() => expect(rowByLabel(t, 'analytics')).toHaveAttribute('aria-expanded', 'false'));
  },
};

export const BothThemes: Story = { render: (a, c) => themes(Selected.render!(a, c)) };

// ---- keyboard ---------------------------------------------------------------

const onActivate = fn();
const onSelect = fn();
const onExpand = fn();
const onAction = fn();

export const KeyboardModel: Story = {
  name: 'Keyboard: full tree model',
  render: () => html`<div style="width:360px">
    <mm-tree
      label="dbt project"
      .nodes=${dbtProject()}
      .actions=${[{ id: 'open', label: 'Open in catalog', icon: 'open-in-new' }]}
      @mm-activate=${(e: CustomEvent) => onActivate(e.detail.node.id)}
      @mm-select=${(e: CustomEvent) => onSelect(e.detail.node.id)}
      @mm-expand=${(e: CustomEvent) => onExpand(e.detail.node.id, e.detail.expanded)}
      @mm-action=${(e: CustomEvent) => onAction(e.detail.action, e.detail.node.id)}
    ></mm-tree>
    <button>After the tree</button>
  </div>`,
  play: async ({ canvasElement }) => {
    [onActivate, onSelect, onExpand, onAction].forEach((f) => f.mockClear());
    const t = treeOf(canvasElement);
    await tab();
    await expect(deepActive()).toBe(treeEl(t));
    await expectActive(t, 'analytics');
    await expect(activeRow(t)).toHaveAttribute('aria-level', '1');

    // Right expands, Right again moves to the first child.
    await press('{ArrowRight}');
    await waitFor(() => expect(rowByLabel(t, 'analytics')).toHaveAttribute('aria-expanded', 'true'));
    await expect(onExpand).toHaveBeenCalledWith('dbt', true);
    await press('{ArrowRight}');
    await expectActive(t, 'models');
    await expect(activeRow(t)).toHaveAttribute('aria-level', '2');
    await expect(activeRow(t)).toHaveAttribute('aria-setsize', '3');
    await expect(activeRow(t)).toHaveAttribute('aria-posinset', '1');

    // Down and Up.
    await press('{ArrowDown}');
    await expectActive(t, 'seeds');
    await press('{ArrowUp}');
    await expectActive(t, 'models');

    // * expands every sibling at this level.
    await press('*');
    await waitFor(() => expect(rowByLabel(t, 'tests')).toHaveAttribute('aria-expanded', 'true'));
    await expect(rowByLabel(t, 'seeds')).toHaveAttribute('aria-expanded', 'true');
    await expect(rowByLabel(t, 'models')).toHaveAttribute('aria-expanded', 'true');

    // End and Home.
    await press('{End}');
    await expectActive(t, 'unique_customers_dim_customer_id');
    await press('{Home}');
    await expectActive(t, 'analytics');

    // Typeahead: "st" finds staging; after a pause, "stg_c" finds stg_customers.
    await press('st');
    await expectActive(t, 'staging');
    await press('{ArrowRight}');
    await new Promise((r) => setTimeout(r, 600));
    await press('stg_c');
    await expectActive(t, 'stg_customers');

    // Left on a leaf moves to its parent; Left on an expanded node collapses it.
    await press('{ArrowLeft}');
    await expectActive(t, 'staging');
    await press('{ArrowLeft}');
    await waitFor(() => expect(rowByLabel(t, 'staging')).toHaveAttribute('aria-expanded', 'false'));
    await expect(onExpand).toHaveBeenCalledWith('dbt/models/staging', false);

    // Space selects (once the typeahead buffer has cleared), Enter activates.
    await new Promise((r) => setTimeout(r, 600));
    await press('{Space}');
    await expect(onSelect).toHaveBeenCalledWith('dbt/models/staging');
    await waitFor(() => expect(activeRow(t)).toHaveAttribute('aria-selected', 'true'));
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledWith('dbt/models/staging');

    // Tab reaches the active row's action, then leaves the tree.
    await tab();
    const actionHost = (deepActive()!.getRootNode() as ShadowRoot).host;
    await expect(actionHost.tagName).toBe('MM-BUTTON');
    await expect(actionHost.getAttribute('label')).toBe('Open in catalog');
    await press('{Enter}');
    await expect(onAction).toHaveBeenCalledWith('open', 'dbt/models/staging');
    await tab();
    await expect(deepActive()?.textContent).toBe('After the tree');
  },
};

export const PointerInteraction: Story = {
  name: 'Pointer: chevron toggles, click selects',
  render: KeyboardModel.render,
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const t = treeOf(canvasElement);
    await waitFor(() => expect(rowByLabel(t, 'analytics')).toBeTruthy());
    await click(rowByLabel(t, 'analytics')!.querySelector('.twisty')!);
    await waitFor(() => expect(rowByLabel(t, 'models')).toBeTruthy());
    await expect(onSelect).not.toHaveBeenCalled();
    await click(rowByLabel(t, 'seeds')!);
    await expect(onSelect).toHaveBeenCalledWith('dbt/seeds');
    await expect(deepActive()).toBe(treeEl(t));
    await expectActive(t, 'seeds');
  },
};
