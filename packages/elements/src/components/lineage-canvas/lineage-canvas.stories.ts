import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import dagreUrl from '@dagrejs/dagre?url';
import { press } from '../../../../../apps/storybook/src/support/keys.ts';
import '@marmotdata/elements/lineage-canvas.js';
import type { MmLineageCanvas, LineageGraph, LineageGraphNode, LineageGraphEdge } from './class.ts';

/* ------------------------------------------------------------------ data */

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const ordersGraph: LineageGraph = {
  currentId: 'orders_daily',
  nodes: [
    { id: 'shop_db', mrn: 'mrn://postgresql/database/shop', name: 'shop', type: 'database', provider: 'postgresql' },
    { id: 'pg_orders', mrn: 'mrn://postgresql/table/shop.public.orders', name: 'shop.public.orders', type: 'table', provider: 'postgresql' },
    { id: 'pg_customers', mrn: 'mrn://postgresql/table/shop.public.customers', name: 'shop.public.customers', type: 'table', provider: 'postgresql' },
    { id: 'topic_orders', mrn: 'mrn://kafka/topic/shop.orders.v2', name: 'shop.orders.v2', type: 'topic', provider: 'kafka', hiddenUpstream: 2 },
    { id: 'flink_enrich', mrn: 'mrn://flink/job/orders-enrichment', name: 'orders-enrichment', type: 'job', provider: 'flink' },
    { id: 'order_events', mrn: 'mrn://snowflake/table/ANALYTICS.RAW.ORDER_EVENTS', name: 'ANALYTICS.RAW.ORDER_EVENTS', type: 'table', provider: 'snowflake' },
    { id: 'stg_orders', mrn: 'mrn://dbt/model/analytics.stg_orders', name: 'stg_orders', type: 'model', provider: 'dbt' },
    { id: 'customers_dim', mrn: 'mrn://snowflake/table/ANALYTICS.MARTS.CUSTOMERS_DIM', name: 'customers_dim', type: 'table', provider: 'snowflake' },
    { id: 'orders_daily', mrn: 'mrn://dbt/model/analytics.orders_daily', name: 'orders_daily', type: 'model', provider: 'dbt' },
    { id: 'sf_orders_daily', mrn: 'mrn://snowflake/table/ANALYTICS.MARTS.ORDERS_DAILY', name: 'ANALYTICS.MARTS.ORDERS_DAILY', type: 'table', provider: 'snowflake' },
    { id: 'looker_revenue', mrn: 'mrn://looker/dashboard/revenue-overview', name: 'Revenue overview', type: 'dashboard', provider: 'looker', hiddenDownstream: 3 },
    { id: 'agent_support', mrn: 'mrn://marmot/agent/support-triage-agent', name: 'support-triage-agent', type: 'agent', provider: '' },
    { id: 'agent_forecast', mrn: 'mrn://marmot/agent/revenue-forecast-agent', name: 'revenue-forecast-agent', type: 'agent', provider: '' },
    { id: 'agent_churn', mrn: 'mrn://marmot/agent/churn-watch-agent', name: 'churn-watch-agent', type: 'agent', provider: '' },
    { id: 'agent_finance', mrn: 'mrn://marmot/agent/finance-agent', name: 'finance-agent', type: 'agent', provider: '' },
  ],
  edges: [
    { source: 'shop_db', target: 'pg_orders', kind: 'CONTAINS' },
    { source: 'shop_db', target: 'pg_customers', kind: 'CONTAINS' },
    { source: 'pg_orders', target: 'stg_orders', kind: 'FEEDS', job: 'dbt run stg_orders' },
    { source: 'pg_customers', target: 'customers_dim', kind: 'FEEDS', job: 'mrn://airflow/job/customers_dim_build' },
    { source: 'topic_orders', target: 'flink_enrich', kind: 'FEEDS', origin: 'observed', observations: 2412, lastSeen: ago(0.2) },
    { source: 'flink_enrich', target: 'order_events', kind: 'PRODUCES', origin: 'observed', observations: 2412, lastSeen: ago(0.2) },
    { source: 'order_events', target: 'orders_daily', kind: 'FEEDS', origin: 'mixed', observations: 128, lastSeen: ago(4) },
    { source: 'stg_orders', target: 'orders_daily', kind: 'FEEDS', origin: 'mixed', observations: 128, lastSeen: ago(4), job: 'dbt run orders_daily' },
    { source: 'customers_dim', target: 'orders_daily', kind: 'REFERENCES' },
    { source: 'orders_daily', target: 'sf_orders_daily', kind: 'PRODUCES', job: 'dbt run orders_daily' },
    { source: 'orders_daily', target: 'looker_revenue', kind: 'FEEDS' },
    { source: 'orders_daily', target: 'agent_support', kind: 'AGENT_LOOKUP', origin: 'observed', observations: 64, lastSeen: ago(1) },
    { source: 'orders_daily', target: 'agent_forecast', kind: 'AGENT_LOOKUP', origin: 'observed', observations: 31, lastSeen: ago(6) },
    { source: 'orders_daily', target: 'agent_churn', kind: 'AGENT_LOOKUP', origin: 'observed', observations: 12, lastSeen: ago(30) },
    { source: 'orders_daily', target: 'agent_finance', kind: 'AGENT_LOOKUP', origin: 'observed', observations: 7, lastSeen: ago(70) },
  ],
};

const cycleGraph: LineageGraph = {
  currentId: 'orders_daily',
  nodes: [
    { id: 'stg_orders', mrn: 'mrn://dbt/model/analytics.stg_orders', name: 'stg_orders', type: 'model', provider: 'dbt' },
    { id: 'orders_daily', mrn: 'mrn://dbt/model/analytics.orders_daily', name: 'orders_daily', type: 'model', provider: 'dbt' },
    { id: 'orders_snapshot', mrn: 'mrn://dbt/snapshot/analytics.orders_snapshot', name: 'orders_snapshot', type: 'snapshot', provider: 'dbt' },
    { id: 'reconcile', mrn: 'mrn://airflow/job/orders_reconciliation', name: 'orders_reconciliation', type: 'job', provider: 'airflow' },
    { id: 'looker_revenue', mrn: 'mrn://looker/dashboard/revenue-overview', name: 'Revenue overview', type: 'dashboard', provider: 'looker' },
  ],
  edges: [
    { source: 'stg_orders', target: 'orders_daily', kind: 'FEEDS', job: 'dbt run orders_daily' },
    { source: 'orders_daily', target: 'orders_snapshot', kind: 'FEEDS' },
    { source: 'orders_snapshot', target: 'reconcile', kind: 'FEEDS', origin: 'observed', observations: 30, lastSeen: ago(20) },
    { source: 'reconcile', target: 'orders_daily', kind: 'PRODUCES', origin: 'observed', observations: 30, lastSeen: ago(20) },
    { source: 'orders_daily', target: 'looker_revenue', kind: 'FEEDS' },
  ],
};

const stubGraph: LineageGraph = {
  currentId: 'spark_sessionize',
  nodes: [
    { id: 'airflow_dag', mrn: 'mrn://airflow/dag/clickstream_hourly', name: 'clickstream_hourly', type: 'dag', provider: 'airflow' },
    { id: 's3_raw', mrn: 'mrn://s3/bucket/shop-clickstream-raw', name: 's3://shop-clickstream-raw/events/', type: 'bucket', provider: 's3', state: 'stub' },
    { id: 'topic_clicks', mrn: 'mrn://kafka/topic/web.clicks.v1', name: 'web.clicks.v1', type: 'topic', provider: 'kafka', state: 'stub' },
    { id: 'spark_sessionize', mrn: 'mrn://spark/job/sessionize_clicks', name: 'sessionize_clicks', type: 'job', provider: 'spark' },
    { id: 'bq_sessions', mrn: 'mrn://bigquery/table/shop-analytics.web.sessions', name: 'shop-analytics.web.sessions', type: 'table', provider: 'bigquery', state: 'stub' },
    { id: 'bq_funnel', mrn: 'mrn://bigquery/table/shop-analytics.web.checkout_funnel', name: 'shop-analytics.web.checkout_funnel', type: 'table', provider: 'bigquery', state: 'stub' },
    { id: 'looker_funnel', mrn: 'mrn://looker/dashboard/checkout-funnel', name: 'Checkout funnel', type: 'dashboard', provider: 'looker', state: 'stub' },
    { id: 'bq_bots', mrn: 'mrn://bigquery/table/shop-analytics.web.bot_sessions', name: 'shop-analytics.web.bot_sessions', type: 'table', provider: 'bigquery' },
  ],
  edges: [
    { source: 'airflow_dag', target: 'spark_sessionize', kind: 'PRODUCES', origin: 'observed', observations: 744, lastSeen: ago(1) },
    { source: 's3_raw', target: 'spark_sessionize', kind: 'FEEDS', origin: 'observed', observations: 744, lastSeen: ago(1) },
    { source: 'topic_clicks', target: 'spark_sessionize', kind: 'FEEDS', origin: 'observed', observations: 312, lastSeen: ago(1) },
    { source: 'spark_sessionize', target: 'bq_sessions', kind: 'PRODUCES', origin: 'observed', observations: 744, lastSeen: ago(1) },
    { source: 'spark_sessionize', target: 'bq_bots', kind: 'PRODUCES', origin: 'mixed', observations: 744, lastSeen: ago(1) },
    { source: 'bq_sessions', target: 'bq_funnel', kind: 'FEEDS', origin: 'observed', observations: 24, lastSeen: ago(3) },
    { source: 'bq_funnel', target: 'looker_funnel', kind: 'FEEDS', origin: 'observed', observations: 9, lastSeen: ago(9) },
  ],
};

const failedGraph: LineageGraph = {
  ...ordersGraph,
  nodes: ordersGraph.nodes.map((n) => (n.id === 'stg_orders' ? { ...n, state: 'failed' as const } : n)),
};

const longGraph: LineageGraph = {
  currentId: 'int',
  nodes: [
    { id: 'src', mrn: 'mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel_v3', name: 'shop.public.orders_daily_rollup_by_region_and_channel_v3', type: 'table', provider: 'postgresql' },
    { id: 'int', mrn: 'mrn://dbt/model/analytics.int_orders__joined_with_customer_lifetime_value_and_marketing_attribution', name: 'int_orders__joined_with_customer_lifetime_value_and_marketing_attribution', type: 'model', provider: 'dbt' },
    { id: 'out', mrn: 'mrn://snowflake/table/ANALYTICS.MARTS.ORDERS_WITH_CUSTOMER_LIFETIME_VALUE_AND_ATTRIBUTION', name: 'ANALYTICS.MARTS.ORDERS_WITH_CUSTOMER_LIFETIME_VALUE_AND_ATTRIBUTION', type: 'table', provider: 'snowflake' },
    { id: 'dash', mrn: 'mrn://looker/dashboard/marketing-attribution-by-channel-region-and-cohort', name: 'Marketing attribution by channel, region and acquisition cohort', type: 'dashboard', provider: 'looker' },
  ],
  edges: [
    { source: 'src', target: 'int', job: 'mrn://airflow/job/analytics_marketing_attribution_nightly_full_refresh' },
    { source: 'int', target: 'out', kind: 'PRODUCES', origin: 'mixed', observations: 1284, lastSeen: ago(2) },
    { source: 'out', target: 'dash', origin: 'observed', observations: 412, lastSeen: ago(5) },
  ],
};

/** A deterministic 2,000-node warehouse: 12 columns of sources, staging, marts and dashboards. */
function generated(count = 2000): LineageGraph {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cols = 12;
  const per = Math.ceil(count / cols);
  const stages = [
    ['postgresql', 'table', (i: number) => `shop.public.orders_p${i}`],
    ['kafka', 'topic', (i: number) => `shop.events.v${(i % 4) + 1}.p${i}`],
    ['airflow', 'job', (i: number) => `ingest_shard_${i}`],
    ['snowflake', 'table', (i: number) => `ANALYTICS.RAW.EVENTS_${i}`],
    ['dbt', 'model', (i: number) => `stg_events__shard_${i}`],
    ['dbt', 'model', (i: number) => `int_sessions__${i}`],
    ['spark', 'job', (i: number) => `sessionize_${i}`],
    ['bigquery', 'table', (i: number) => `shop-analytics.web.sessions_${i}`],
    ['dbt', 'model', (i: number) => `fct_orders__region_${i}`],
    ['snowflake', 'table', (i: number) => `ANALYTICS.MARTS.ORDERS_${i}`],
    ['dbt', 'model', (i: number) => `rpt_revenue_${i}`],
    ['looker', 'dashboard', (i: number) => `Revenue by region ${i}`],
  ] as const;
  const nodes: LineageGraphNode[] = [];
  const edges: LineageGraphEdge[] = [];
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / per);
    const [provider, type, name] = stages[col]!;
    nodes.push({ id: `g${i}`, mrn: `mrn://${provider}/${type}/${name(i)}`, name: name(i), type, provider, state: rand() < 0.03 ? 'failed' : rand() < 0.05 ? 'stub' : undefined });
    if (col > 0) {
      const lo = (col - 1) * per;
      edges.push({ source: `g${i - per}`, target: `g${i}`, kind: 'FEEDS', origin: rand() < 0.2 ? 'observed' : 'declared', observations: 40 });
      // Pipelines mostly join neighbouring shards, so the second input is chosen nearby.
      const near = Math.min(per - 1, Math.max(0, i - per - lo + Math.round((rand() - 0.5) * 16)));
      if (rand() < 0.5) edges.push({ source: `g${lo + near}`, target: `g${i}`, kind: 'FEEDS' });
    }
  }
  return { nodes, edges, currentId: `g${Math.floor(count / 2)}` };
}

/* ------------------------------------------------------------------ helpers */

const el = (root: HTMLElement) => root.querySelector('mm-lineage-canvas') as MmLineageCanvas;
const vp = (c: MmLineageCanvas) => c.shadowRoot!.querySelector<HTMLElement>('.viewport')!;
const ready = async (c: MmLineageCanvas) => {
  await c.updateComplete;
  await c.layoutComplete;
  await c.updateComplete;
};
/** Name of the node (or "edge"/"handle") the canvas's aria-activedescendant points at. */
const active = (c: MmLineageCanvas): string => {
  const id = vp(c).getAttribute('aria-activedescendant');
  if (!id) return '';
  const t = c.shadowRoot!.getElementById(id);
  if (!t) return `missing:${id}`;
  if (t.tagName === 'MM-LINEAGE-NODE') return (t as HTMLElement & { name: string }).name;
  return id.startsWith('e') ? 'edge' : 'handle';
};

const canvas = (graph: LineageGraph, attrs: { observed?: boolean; height?: string; editable?: boolean; labels?: boolean; fullscreen?: boolean } = {}) =>
  html`<mm-lineage-canvas
    .graph=${graph}
    ?show-observed=${attrs.observed ?? true}
    ?editable=${attrs.editable ?? false}
    ?show-edge-labels=${attrs.labels ?? false}
    ?fullscreen=${attrs.fullscreen ?? false}
    layout-module-url=${dagreUrl}
    style="--mm-lineage-height:${attrs.height ?? '560px'}"
    @mm-node-activate=${(e: CustomEvent) => onActivate(e.detail)}
    @mm-node-select=${(e: CustomEvent) => onSelect(e.detail)}
    @mm-expand=${(e: CustomEvent) => onExpand(e.detail)}
    @mm-fullscreen-change=${(e: CustomEvent) => onFullscreen(e.detail)}
    @mm-edge-delete=${(e: CustomEvent) => onDelete(e.detail)}
  ></mm-lineage-canvas>`;

const onActivate = fn();
const onSelect = fn();
const onExpand = fn();
const onFullscreen = fn();
const onDelete = fn();
const clear = () => [onActivate, onSelect, onExpand, onFullscreen, onDelete].forEach((f) => f.mockClear());

/* ------------------------------------------------------------------ meta */

type Args = { depth: number; showObserved: boolean; hideStructure: boolean; showEdgeLabels: boolean; editable: boolean };

const meta: Meta<Args> = {
  title: 'Components/Lineage/Lineage canvas',
  component: 'mm-lineage-canvas',
  args: { depth: 10, showObserved: true, hideStructure: false, showEdgeLabels: false, editable: false },
  render: (a) => html`<mm-lineage-canvas
    .graph=${ordersGraph}
    depth=${a.depth}
    ?show-observed=${a.showObserved}
    ?hide-structure=${a.hideStructure}
    ?show-edge-labels=${a.showEdgeLabels}
    ?editable=${a.editable}
  ></mm-lineage-canvas>`,
  parameters: {
    layout: 'padded',
    usage: {
      html: `<mm-lineage-canvas id="lineage" show-observed></mm-lineage-canvas>
<script type="module">
  import '@marmotdata/elements/lineage-canvas.js';
  const res = await fetch('/api/v1/lineage/assets/orders_daily?depth=10').then((r) => r.json());
  lineage.graph = {
    currentId: res.current_id,
    nodes: res.nodes.map((n) => ({ id: n.id, mrn: n.asset.mrn, name: n.asset.name, type: n.asset.type, provider: n.asset.providers[0] })),
    edges: res.edges.map((e) => ({ source: e.source, target: e.target, kind: e.type, origin: e.origin, observations: e.observation_count, lastSeen: e.last_seen_at, job: e.job_mrn })),
  };
</script>`,
      react: `import { MmLineageCanvas } from '@marmotdata/react';
import dagreUrl from '@dagrejs/dagre?url';

<MmLineageCanvas
  graph={graph}
  showObserved={isAgent}
  layoutModuleUrl={dagreUrl}
  onMmNodeActivate={(e) => openBlade(e.detail.mrn)}
  onMmExpand={(e) => e.detail.direction !== 'agents' && fetchMore(e.detail)}
  onMmFullscreenChange={(e) => setSearchParams({ tab: 'lineage', view: e.detail.fullscreen ? 'full' : undefined })}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/lineage-canvas.js';
  import dagreUrl from '@dagrejs/dagre?url';
  let { graph, fullscreen } = $props();
</script>

<mm-lineage-canvas
  graph={graph}
  layout-module-url={dagreUrl}
  fullscreen={fullscreen}
  onmm-node-activate={(e) => openBlade(e.detail.mrn)}
  onmm-fullscreen-change={(e) => goto(e.detail.fullscreen ? '?tab=lineage&view=full' : '?tab=lineage')}
></mm-lineage-canvas>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

/* ------------------------------------------------------------------ states */

export const OrdersPipeline: Story = { name: 'Orders pipeline' };
export const ObservedOff: Story = { name: 'Observed off (product default)', args: { showObserved: false } };
export const StructureOff: Story = { name: 'Structure off', args: { hideStructure: true } };
export const EdgeLabels: Story = { name: 'Edge labels', args: { showEdgeLabels: true } };
export const Cycle: Story = { render: () => canvas(cycleGraph, { labels: true }) };
export const OpenLineageStubs: Story = { name: 'OpenLineage stubs', render: () => canvas(stubGraph) };
export const FailedNode: Story = { name: 'Failed node', render: () => canvas(failedGraph) };
export const LongIdentifiers: Story = { name: 'Long identifiers', render: () => canvas(longGraph, { labels: true, height: '420px' }) };
export const Editable: Story = { render: () => canvas(ordersGraph, { editable: true }) };
export const Empty: Story = {
  render: () => canvas({ currentId: 'orders_daily', nodes: [ordersGraph.nodes.find((n) => n.id === 'orders_daily')!], edges: [] }, { height: '420px' }),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await c.updateComplete;
    const empty = c.shadowRoot!.querySelector('mm-empty-state')!;
    await expect(empty.getAttribute('description')).toBe('Pipelines that declare inputs and outputs will draw it here.');
  },
};
export const Loading: Story = { render: () => html`<mm-lineage-canvas loading style="--mm-lineage-height:420px"></mm-lineage-canvas>` };
export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-lineage-canvas
    .graph=${ordersGraph}
    error="The lineage service timed out after 30 s while walking 10 levels from orders_daily. Lower the depth or try again."
    style="--mm-lineage-height:420px"
  ></mm-lineage-canvas>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => canvas(ordersGraph) };
export const BothThemes: Story = {
  // Stacked rather than side by side, so each canvas has the width a lineage tab really gets.
  render: () => html`<div style="display:grid;gap:0;margin:calc(-1 * var(--space-8))">
    ${(['light', 'dark'] as const).map(
      (t) => html`<div data-theme=${t} style="background:var(--mm-paper);color:var(--mm-text);padding:var(--space-8)">
        <div style="font:var(--text-caption);color:var(--mm-text-2);margin-bottom:var(--space-3)">${t === 'dark' ? 'Peat' : 'Light'}</div>
        ${canvas(ordersGraph, { height: '480px' })}
      </div>`,
    )}
  </div>`,
};

export const Narrow: Story = {
  name: 'Narrow panel (minimap collapsed)',
  render: () => html`<div style="max-width:640px">${canvas(ordersGraph, { height: '480px' })}</div>`,
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    await expect(c.shadowRoot!.querySelector('.minimap')).toBeNull();
    const toggle = [...c.shadowRoot!.querySelectorAll('mm-button')].find((b) => b.getAttribute('icon') === 'layers')!;
    await expect(toggle.getAttribute('label')).toBe('Show minimap');
  },
};

export const FitsOnFirstLayout: Story = {
  name: 'Fits the graph on first layout and resize',
  render: () => html`<div style="width:1100px" id="frame">${canvas(cycleGraph, { height: '520px' })}</div>`,
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    const inView = () => {
      const vr = vp(c).getBoundingClientRect();
      return [...c.shadowRoot!.querySelectorAll('mm-lineage-node')].every((n) => {
        const r = n.getBoundingClientRect();
        return r.left >= vr.left && r.right <= vr.right && r.top >= vr.top && r.bottom <= vr.bottom;
      });
    };
    await waitFor(() => expect(inView()).toBe(true));
    (canvasElement.querySelector('#frame') as HTMLElement).style.width = '900px';
    await waitFor(() => expect(inView()).toBe(true));
  },
};
/** True when the asset's card lies inside the viewport, clear of the legend above and the minimap below. */
const nodeInView = (c: MmLineageCanvas, name: string) => {
  const node = [...c.shadowRoot!.querySelectorAll<HTMLElement & { name: string }>('mm-lineage-node')].find((n) => n.name === name);
  if (!node) return false;
  const v = vp(c).getBoundingClientRect();
  const r = node.getBoundingClientRect();
  return r.left >= v.left && r.right <= v.right && r.top >= v.top + 40 && r.bottom <= v.bottom - 140;
};

export const SelectedInView: Story = {
  name: 'Selected asset is brought into view',
  render: () => html`<div style="width:900px">
    <mm-lineage-canvas .graph=${generated(240)} depth="200" max-depth="200" selected="g0" layout-module-url=${dagreUrl} style="--mm-lineage-height:520px"></mm-lineage-canvas>
  </div>`,
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    // The graph is too big to fit legibly, so the view opens at 100%, on the selection rather than the current asset.
    await waitFor(() => expect(nodeInView(c, 'shop.public.orders_p0')).toBe(true));
    // Selecting from outside (a list beside the graph, the URL) moves the view to the new asset.
    c.selected = 'g190';
    await c.updateComplete;
    await waitFor(() => expect(nodeInView(c, 'ANALYTICS.MARTS.ORDERS_190')).toBe(true));
    // Narrowing the canvas, as a blade opening beside it does, keeps the selection in view.
    (canvasElement.firstElementChild as HTMLElement).style.width = '560px';
    await waitFor(() => expect(nodeInView(c, 'ANALYTICS.MARTS.ORDERS_190')).toBe(true));
  },
};

export const EdgeLabelsClearOfNodes: Story = {
  name: 'Edge labels never cover nodes',
  render: () => canvas(longGraph, { labels: true, height: '420px' }),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    const sr = c.shadowRoot!;
    await waitFor(() => expect(sr.querySelectorAll('.chip').length).toBeGreaterThan(0));
    const nodes = [...sr.querySelectorAll('mm-lineage-node')].map((n) => n.getBoundingClientRect());
    const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    for (const chip of sr.querySelectorAll<HTMLElement>('.chip')) {
      const r = chip.getBoundingClientRect();
      for (const n of nodes) await expect(overlaps(r, n)).toBe(false);
    }
    // The long job name is truncated in its chip and given in full on the edge.
    const job = 'mrn://airflow/job/analytics_marketing_attribution_nightly_full_refresh';
    const ct = [...sr.querySelectorAll<HTMLElement>('.chip .ct')].find((t) => t.textContent?.includes('analytics_marketing'))!;
    await expect(ct.scrollWidth).toBeGreaterThan(ct.clientWidth);
    await expect([...sr.querySelectorAll('.e .hit title')].some((t) => t.textContent === job)).toBe(true);
  },
};

export const Fullscreen: Story = { name: 'Full screen', parameters: { layout: 'fullscreen' }, render: () => canvas(ordersGraph, { fullscreen: true }) };

/* ------------------------------------------------------------------ performance */

export const TwoThousandNodes: Story = {
  name: '2,000 nodes',
  // Stress data: kept out of the Storybook UI (see .storybook/main.ts), still run as a test.
  tags: ['!dev', 'stress'],
  render: () => html`<mm-lineage-canvas .graph=${generated()} show-observed depth="200" max-depth="200" layout-module-url=${dagreUrl} style="--mm-lineage-height:640px"></mm-lineage-canvas>`,
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    const layout = new Promise<CustomEvent>((r) => c.addEventListener('mm-layout', (e) => r(e as CustomEvent), { once: true }));
    const info = (await layout).detail as { nodes: number; ms: number; where: string };
    await ready(c);
    await expect(info.nodes).toBe(2000);
    // Only what is in view plus a margin is rendered.
    await expect(c.renderedNodeCount).toBeLessThan(400);
    // Pan for 120 frames, one step per frame, and time the frames.
    const times: number[] = [];
    await new Promise<void>((resolve) => {
      let last = performance.now();
      let n = 0;
      const step = () => {
        const now = performance.now();
        times.push(now - last);
        last = now;
        c.panBy(n < 60 ? -14 : 14, n % 2 ? -6 : 6);
        if (++n < 120) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    times.shift();
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    const result = { layoutMs: info.ms, layoutWhere: info.where, rendered: c.renderedNodeCount, p50: +p50.toFixed(1), p95: +p95.toFixed(1), max: +sorted[sorted.length - 1]!.toFixed(1) };
    console.info('[lineage-canvas perf]', JSON.stringify(result));
    (globalThis as { __lineagePerf?: unknown }).__lineagePerf = result;
    await expect(p95).toBeLessThan(50);
  },
};

/* ------------------------------------------------------------------ keyboard */

const upstreamOfDaily = ['stg_orders', 'customers_dim', 'ANALYTICS.RAW.ORDER_EVENTS'];
const downstreamOfDaily = ['ANALYTICS.MARTS.ORDERS_DAILY', 'Revenue overview', 'support-triage-agent, revenue-forecast-agent, churn-watch-agent, finance-agent'];

export const KeyboardArrows: Story = {
  name: 'Keyboard: arrows follow edges',
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
    await press('{ArrowLeft}');
    await c.updateComplete;
    const up = active(c);
    await expect(upstreamOfDaily).toContain(up);
    await press('{ArrowRight}');
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
    await press('{ArrowRight}');
    await c.updateComplete;
    await expect(downstreamOfDaily).toContain(active(c));
    // Up and Down move between the upstream assets, which share a column.
    await press('{ArrowLeft}');
    await press('{ArrowLeft}');
    await c.updateComplete;
    const before = active(c);
    await expect(upstreamOfDaily).toContain(before);
    await press('{ArrowDown}');
    await c.updateComplete;
    if (active(c) === before) await press('{ArrowUp}');
    await c.updateComplete;
    await expect(active(c)).not.toBe(before);
    await expect(upstreamOfDaily).toContain(active(c));
    await press('f');
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
  },
};

export const KeyboardArrowsRtl: Story = {
  name: 'Keyboard: arrows flip right to left',
  parameters: { dir: 'rtl' },
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
    await press('{ArrowRight}');
    await c.updateComplete;
    await expect(upstreamOfDaily).toContain(active(c));
    await press('{ArrowLeft}');
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
  },
};

export const KeyboardEnterSpace: Story = {
  name: 'Keyboard: Enter opens, Space selects',
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    clear();
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledWith({ id: 'orders_daily', mrn: 'mrn://dbt/model/analytics.orders_daily', name: 'orders_daily' });
    await press('{Space}');
    await c.updateComplete;
    await expect(onSelect).toHaveBeenCalledWith({ id: 'orders_daily', mrn: 'mrn://dbt/model/analytics.orders_daily' });
    await expect(c.selected).toBe('orders_daily');
    await press('{Space}');
    await expect(onSelect).toHaveBeenLastCalledWith({ id: null, mrn: null });
  },
};

export const KeyboardZoom: Story = {
  name: 'Keyboard: plus, minus and 0',
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await press('0');
    const k0 = c.transform.k;
    await press('+');
    await expect(c.transform.k).toBeGreaterThan(k0);
    await press('-');
    await press('-');
    await expect(c.transform.k).toBeLessThan(k0);
    await press('0');
    await expect(c.transform.k).toBeCloseTo(k0, 5);
  },
};

export const KeyboardEdges: Story = {
  name: 'Keyboard: E steps through edges, Delete removes',
  render: () => canvas(ordersGraph, { editable: true }),
  play: async ({ canvasElement }) => {
    clear();
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await press('e');
    await c.updateComplete;
    await expect(active(c)).toBe('edge');
    await expect(c.shadowRoot!.querySelector('.chip')).not.toBeNull();
    const firstEdge = vp(c).getAttribute('aria-activedescendant');
    await press('e');
    await c.updateComplete;
    await expect(vp(c).getAttribute('aria-activedescendant')).not.toBe(firstEdge);
    await press('{Delete}');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await press('{Escape}');
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
  },
};

export const KeyboardClusterAndHandles: Story = {
  name: 'Keyboard: agent cluster and hidden neighbours',
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    clear();
    const c = el(canvasElement);
    await ready(c);
    c.focusNode('agents:orders_daily:out');
    await c.updateComplete;
    await expect(active(c)).toBe('support-triage-agent, revenue-forecast-agent, churn-watch-agent, finance-agent');
    await press('{Enter}');
    await expect(onExpand).toHaveBeenCalledWith({ id: 'agents:orders_daily:out', direction: 'agents', expanded: true });
    await c.layoutComplete;
    await waitFor(() => expect(active(c)).toBe('support-triage-agent'));
    // Revenue overview has three downstream assets the server did not return.
    c.focusNode('looker_revenue');
    await press('{ArrowRight}');
    await c.updateComplete;
    await expect(active(c)).toBe('handle');
    await press('{Enter}');
    await expect(onExpand).toHaveBeenLastCalledWith({ id: 'looker_revenue', direction: 'downstream' });
  },
};

export const KeyboardCycle: Story = {
  name: 'Keyboard: Enter on "Returns to" goes to the asset',
  render: () => canvas(cycleGraph),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    const ret = c.shadowRoot!.querySelector('mm-lineage-node[variant="cycle-return"]');
    await expect(ret).not.toBeNull();
    c.focusNode('cycle:reconcile->orders_daily');
    await press('{Enter}');
    await c.updateComplete;
    await expect(active(c)).toBe('orders_daily');
  },
};

export const KeyboardEscapeFullscreen: Story = {
  name: 'Keyboard: Escape leaves full screen',
  parameters: { layout: 'fullscreen' },
  render: () => canvas(ordersGraph, { fullscreen: true }),
  play: async ({ canvasElement }) => {
    clear();
    const c = el(canvasElement);
    await ready(c);
    vp(c).focus();
    await press('{Escape}');
    await c.updateComplete;
    await expect(c.fullscreen).toBe(false);
    await expect(onFullscreen).toHaveBeenCalledWith({ fullscreen: false });
  },
};

export const KeyboardMinimap: Story = {
  name: 'Keyboard: minimap pans and zooms',
  render: () => canvas(ordersGraph),
  play: async ({ canvasElement }) => {
    const c = el(canvasElement);
    await ready(c);
    const mm = c.shadowRoot!.querySelector<HTMLElement>('.minimap')!;
    mm.focus();
    await press('0');
    const t0 = c.transform;
    await press('{ArrowRight}');
    await expect(c.transform.x).toBeLessThan(t0.x);
    await press('{ArrowDown}');
    await expect(c.transform.y).toBeLessThan(t0.y);
    await press('+');
    await expect(c.transform.k).toBeGreaterThan(t0.k);
    await press('0');
    await expect(c.transform.k).toBeCloseTo(t0.k, 5);
  },
};
