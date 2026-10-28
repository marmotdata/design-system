/**
 * Graph preparation and layout for `mm-lineage-canvas`.
 *
 * `prepareGraph` turns the app's lineage response into what is drawn: edges filtered by the Observed
 * and Structure toggles, nodes cut to the depth, agent lookups grouped into clusters, and cycles
 * broken into "Returns to" nodes. `layoutGraph` lays that out with dagre (rankdir LR), off the main
 * thread for large graphs.
 */
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';
import { NODE_WIDTH, estimateNodeHeight, type LineageNodeVariant } from '../lineage-node/class.js';

export type LineageEdgeKind = 'CONTAINS' | 'FEEDS' | 'PRODUCES' | 'REFERENCES' | 'AGENT_LOOKUP';
export type LineageEdgeOrigin = 'declared' | 'observed' | 'mixed';

export interface LineageGraphNode {
  id: string;
  mrn: string;
  name: string;
  /** Asset type in normal case: `table`, `topic`, `model`, `dashboard`, `job`, `agent`. */
  type: string;
  /** Provider key: `postgresql`, `kafka`, `dbt`. */
  provider: string;
  /** `stub` for assets created by OpenLineage but not yet surveyed; `failed` when the last run failed. */
  state?: 'stub' | 'failed';
  /** Upstream neighbours the server knows about but did not return (beyond the requested depth). */
  hiddenUpstream?: number;
  /** Downstream neighbours the server knows about but did not return. */
  hiddenDownstream?: number;
}

export interface LineageGraphEdge {
  source: string;
  target: string;
  /** Edge type. Defaults to `FEEDS`. `CONTAINS` is structure and follows the Structure toggle. */
  kind?: LineageEdgeKind;
  /** `declared` (default) by a plugin, `observed` at runtime (OpenLineage, agent lookups), or `mixed`. */
  origin?: LineageEdgeOrigin;
  /** Number of runs that observed the edge. */
  observations?: number;
  /** ISO timestamp of the last observation. */
  lastSeen?: string;
  /** The job that produces the edge, e.g. `dbt run orders_daily` or a job MRN. */
  job?: string;
}

export interface LineageGraph {
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
  /** The asset whose page you are on. */
  currentId?: string;
}

export interface PrepareOptions {
  depth: number;
  showObserved: boolean;
  showStructure: boolean;
  /** Ids of agent clusters the person has expanded. */
  expandedClusters: ReadonlySet<string>;
  /** Node ids revealed beyond the depth with a "+3 upstream" handle. */
  revealed: ReadonlySet<string>;
}

export interface ViewNode {
  id: string;
  variant: LineageNodeVariant;
  name: string;
  type: string;
  provider: string;
  mrn: string;
  stub: boolean;
  failed: boolean;
  current: boolean;
  /** Cycle return: the node the cycle returns to. */
  targetId?: string;
  /** Agent cluster: member names and ids. */
  members?: string[];
  memberIds?: string[];
  hiddenUp: number;
  hiddenDown: number;
  w: number;
  h: number;
}

export type ViewEdgeOrigin = LineageEdgeOrigin | 'cycle';

export interface ViewEdge {
  id: string;
  source: string;
  target: string;
  kind: LineageEdgeKind;
  origin: ViewEdgeOrigin;
  observations?: number;
  lastSeen?: string;
  job?: string;
}

export interface ViewGraph {
  nodes: ViewNode[];
  edges: ViewEdge[];
  /** Expanded-or-not agent clusters that exist in this graph, so "Collapse groups" knows what to offer. */
  clusterIds: string[];
}

const kindOf = (e: LineageGraphEdge): LineageEdgeKind => e.kind ?? 'FEEDS';
const originOf = (e: LineageGraphEdge): LineageEdgeOrigin => e.origin ?? (kindOf(e) === 'AGENT_LOOKUP' ? 'observed' : 'declared');

/** Builds the drawn graph from the app's lineage response. Pure; safe to call on every toggle. */
export function prepareGraph(graph: LineageGraph, opts: PrepareOptions): ViewGraph {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const currentId = graph.currentId && byId.has(graph.currentId) ? graph.currentId : undefined;

  // 1. Toggles.
  const edges = graph.edges.filter((e) => {
    if (!byId.has(e.source) || !byId.has(e.target)) return false;
    if (originOf(e) === 'observed' && !opts.showObserved) return false;
    if (kindOf(e) === 'CONTAINS' && !opts.showStructure) return false;
    return true;
  });

  // 2. Depth: undirected distance from the current asset over the remaining edges.
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target);
    (adj.get(e.target) ?? adj.set(e.target, []).get(e.target)!).push(e.source);
  }
  let visible: Set<string>;
  if (currentId) {
    const dist = new Map<string, number>([[currentId, 0]]);
    const queue = [currentId];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!;
      const d = dist.get(id)!;
      for (const nb of adj.get(id) ?? []) {
        if (dist.has(nb)) continue;
        // Revealed nodes extend the reach by one step past the depth.
        if (d + 1 > opts.depth && !opts.revealed.has(nb)) continue;
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    }
    visible = new Set(dist.keys());
  } else {
    visible = new Set(graph.nodes.map((n) => n.id));
  }
  // With Structure off, nodes that only hung off CONTAINS edges drop out.
  let shown = edges.filter((e) => visible.has(e.source) && visible.has(e.target));

  // Hidden neighbour counts: edges cut by the depth plus what the server says it left out.
  const hiddenUp = new Map<string, number>();
  const hiddenDown = new Map<string, number>();
  for (const e of edges) {
    if (visible.has(e.target) && !visible.has(e.source)) hiddenUp.set(e.target, (hiddenUp.get(e.target) ?? 0) + 1);
    if (visible.has(e.source) && !visible.has(e.target)) hiddenDown.set(e.source, (hiddenDown.get(e.source) ?? 0) + 1);
  }

  const toView = (n: LineageGraphNode): ViewNode => {
    const failed = n.state === 'failed';
    return {
      id: n.id,
      variant: 'asset',
      name: n.name,
      type: n.type,
      provider: n.provider,
      mrn: n.mrn,
      stub: n.state === 'stub',
      failed,
      current: n.id === currentId,
      hiddenUp: (hiddenUp.get(n.id) ?? 0) + (n.hiddenUpstream ?? 0),
      hiddenDown: (hiddenDown.get(n.id) ?? 0) + (n.hiddenDownstream ?? 0),
      w: NODE_WIDTH.asset,
      h: estimateNodeHeight({ name: n.name, failed }),
    };
  };

  // 3. Agent clusters: agents whose only shown edges are AGENT_LOOKUPs with one asset, two or more per asset and direction.
  const nodes = new Map<string, ViewNode>();
  for (const id of visible) nodes.set(id, toView(byId.get(id)!));
  const incident = new Map<string, LineageGraphEdge[]>();
  for (const e of shown) {
    (incident.get(e.source) ?? incident.set(e.source, []).get(e.source)!).push(e);
    (incident.get(e.target) ?? incident.set(e.target, []).get(e.target)!).push(e);
  }
  const groups = new Map<string, { anchor: string; agentIsSource: boolean; agents: string[] }>();
  for (const n of nodes.values()) {
    if (byId.get(n.id)!.type.toLowerCase() !== 'agent' || n.current) continue;
    const es = incident.get(n.id) ?? [];
    if (!es.length || es.some((e) => kindOf(e) !== 'AGENT_LOOKUP')) continue;
    const anchors = new Set(es.map((e) => (e.source === n.id ? e.target : e.source)));
    if (anchors.size !== 1) continue;
    const anchor = [...anchors][0]!;
    const agentIsSource = es[0]!.source === n.id;
    const key = `agents:${anchor}:${agentIsSource ? 'in' : 'out'}`;
    const g = groups.get(key) ?? { anchor, agentIsSource, agents: [] };
    g.agents.push(n.id);
    groups.set(key, g);
  }
  const clusterIds: string[] = [];
  for (const [key, g] of groups) {
    if (g.agents.length < 2) continue;
    clusterIds.push(key);
    if (opts.expandedClusters.has(key)) continue;
    const members = g.agents.map((id) => nodes.get(id)!.name);
    const memberSet = new Set(g.agents);
    const merged = shown.filter((e) => memberSet.has(e.source) || memberSet.has(e.target));
    shown = shown.filter((e) => !memberSet.has(e.source) && !memberSet.has(e.target));
    for (const id of g.agents) nodes.delete(id);
    nodes.set(key, {
      id: key,
      variant: 'agent-cluster',
      name: members.join(', '),
      type: 'agent',
      provider: '',
      mrn: '',
      stub: false,
      failed: false,
      current: false,
      members,
      memberIds: g.agents,
      hiddenUp: 0,
      hiddenDown: 0,
      w: NODE_WIDTH['agent-cluster'],
      h: estimateNodeHeight({ name: '', variant: 'agent-cluster' }),
    });
    const observations = merged.reduce((s, e) => s + (e.observations ?? 0), 0);
    const lastSeen = merged.map((e) => e.lastSeen ?? '').sort().pop() || undefined;
    shown.push({
      source: g.agentIsSource ? key : g.anchor,
      target: g.agentIsSource ? g.anchor : key,
      kind: 'AGENT_LOOKUP',
      origin: 'observed',
      observations: observations || undefined,
      lastSeen,
    });
  }

  // 4. Cycles: depth-first from the sources; every back edge ends at a "Returns to" node instead.
  const out = new Map<string, number[]>();
  shown.forEach((e, i) => (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(i));
  const indeg = new Map<string, number>();
  for (const e of shown) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const order = [...nodes.keys()].sort((a, b) => (indeg.get(a) ?? 0) - (indeg.get(b) ?? 0));
  const colour = new Map<string, 1 | 2>();
  const back = new Set<number>();
  for (const root of order) {
    if (colour.has(root)) continue;
    const stack: [string, number][] = [[root, 0]];
    colour.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const list = out.get(top[0]) ?? [];
      if (top[1] >= list.length) {
        colour.set(top[0], 2);
        stack.pop();
        continue;
      }
      const ei = list[top[1]++]!;
      const t = shown[ei]!.target;
      const c = colour.get(t);
      if (c === 1) back.add(ei);
      else if (!c) {
        colour.set(t, 1);
        stack.push([t, 0]);
      }
    }
  }

  const viewEdges: ViewEdge[] = [];
  const seen = new Map<string, number>();
  shown.forEach((e, i) => {
    const base = `${e.source}->${e.target}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n ? `${base}#${n}` : base;
    if (back.has(i)) {
      const rid = `cycle:${id}`;
      const target = nodes.get(e.target)!;
      nodes.set(rid, {
        id: rid,
        variant: 'cycle-return',
        name: target.name,
        type: target.type,
        provider: '',
        mrn: target.mrn,
        stub: false,
        failed: false,
        current: false,
        targetId: e.target,
        hiddenUp: 0,
        hiddenDown: 0,
        w: NODE_WIDTH['cycle-return'],
        h: estimateNodeHeight({ name: target.name, variant: 'cycle-return' }),
      });
      viewEdges.push({ id, source: e.source, target: rid, kind: kindOf(e), origin: 'cycle', observations: e.observations, lastSeen: e.lastSeen, job: e.job });
    } else {
      viewEdges.push({ id, source: e.source, target: e.target, kind: kindOf(e), origin: originOf(e), observations: e.observations, lastSeen: e.lastSeen, job: e.job });
    }
  });

  return { nodes: [...nodes.values()], edges: viewEdges, clusterIds };
}

/* ------------------------------------------------------------------ layout */

export interface LayoutInput {
  nodes: { id: string; w: number; h: number }[];
  edges: { id: string; source: string; target: string }[];
  nodesep: number;
  ranksep: number;
  /** dagre's network-simplex ranker gives the tidiest result but is slow past a few hundred nodes; tight-tree is about 4x faster. */
  ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
  rtl: boolean;
}

export interface LayoutOutput {
  width: number;
  height: number;
  /** Node centres. */
  nodes: Record<string, [number, number]>;
  /** SVG path, label point and bounding box per edge. */
  edges: Record<string, { d: string; lx: number; ly: number; box: [number, number, number, number] }>;
  ms: number;
}

/**
 * Runs dagre and turns its output into node centres and smooth edge paths. Self-contained (it uses
 * nothing from module scope) because it is also stringified into the layout worker.
 */
export function runLayout(
  dagre: { graphlib: { Graph: new (opts?: { multigraph?: boolean }) => any }; layout: (g: any) => void },
  input: LayoutInput,
): LayoutOutput {
  const t0 = performance.now();
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: input.nodesep, ranksep: input.ranksep, ranker: input.ranker, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  const size: Record<string, { w: number; h: number }> = {};
  for (const n of input.nodes) {
    size[n.id] = n;
    g.setNode(n.id, { width: n.w, height: n.h });
  }
  for (const e of input.edges) g.setEdge(e.source, e.target, {}, e.id);
  dagre.layout(g);
  const gl = g.graph();
  const width: number = gl.width || 0;
  const height: number = gl.height || 0;
  const mx = (x: number) => (input.rtl ? width - x : x);
  const dir = input.rtl ? -1 : 1;
  const nodes: LayoutOutput['nodes'] = {};
  for (const n of input.nodes) {
    const p = g.node(n.id);
    nodes[n.id] = [mx(p.x), p.y];
  }
  const r = (v: number) => Math.round(v * 10) / 10;
  // Ranks are columns that share a centre x. Half the widest node per column gives the gap edges.
  const half: Record<string, number> = {};
  for (const n of input.nodes) {
    const k = String(Math.round(nodes[n.id]![0]));
    half[k] = Math.max(half[k] ?? 0, n.w / 2);
  }
  const bez = (sg: [number, number][], t: number, i: 0 | 1) => {
    const u = 1 - t;
    return u * u * u * sg[0]![i] + 3 * u * u * t * sg[1]![i] + 3 * u * t * t * sg[2]![i] + t * t * t * sg[3]![i];
  };
  const edges: LayoutOutput['edges'] = {};
  for (const e of input.edges) {
    const s = nodes[e.source]!;
    const t = nodes[e.target]!;
    const start: [number, number] = [s[0] + (dir * size[e.source]!.w) / 2, s[1]];
    // Leave room for the arrowhead.
    const end: [number, number] = [t[0] - dir * (size[e.target]!.w / 2 + 1), t[1]];
    const raw: { x: number; y: number }[] = g.edge({ v: e.source, w: e.target, name: e.id })?.points ?? [];
    // One-rank edges carry a single label point from dagre; skip it so they draw as one clean S.
    const inner = raw.length > 3 ? raw.slice(1, -1).map((p) => [mx(p.x), p.y] as [number, number]) : [];
    const pts: [number, number][] = [start, ...inner, end];
    // Catmull-Rom through the points with horizontal tangents at both ends.
    const tan = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) {
        const dx = (pts.length === 2 ? end[0] - start[0] : i === 0 ? pts[1]![0] - p[0] : p[0] - pts[i - 1]![0]) * 1.5;
        return [dx, 0] as [number, number];
      }
      return [(pts[i + 1]![0] - pts[i - 1]![0]) / 2, (pts[i + 1]![1] - pts[i - 1]![1]) / 2] as [number, number];
    });
    let d = `M${r(start[0])},${r(start[1])}`;
    let x0 = Math.min(start[0], end[0]);
    let x1 = Math.max(start[0], end[0]);
    let y0 = Math.min(start[1], end[1]);
    let y1 = Math.max(start[1], end[1]);
    const segs: [number, number][][] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const c1: [number, number] = [a[0] + tan[i]![0] / 3, a[1] + tan[i]![1] / 3];
      const c2: [number, number] = [b[0] - tan[i + 1]![0] / 3, b[1] - tan[i + 1]![1] / 3];
      segs.push([a, c1, c2, b]);
      d += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(b[0])},${r(b[1])}`;
      for (const p of [b, c1, c2]) {
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
    }
    const mid = segs[Math.floor((segs.length - 1) / 2)]!;
    let lx = (mid[0]![0] + 3 * mid[1]![0] + 3 * mid[2]![0] + mid[3]![0]) / 8;
    let ly = (mid[0]![1] + 3 * mid[1]![1] + 3 * mid[2]![1] + mid[3]![1]) / 8;
    // The label point sits in the clear gap just after the source's column, where no node box can
    // be, so an edge chip never covers a node. Backward (cycle) edges keep the midpoint.
    const gx = s[0] + dir * ((half[String(Math.round(s[0]))] ?? size[e.source]!.w / 2) + input.ranksep / 2);
    if ((gx - start[0]) * dir > 0 && (end[0] - gx) * dir > 0) {
      const seg = segs.find((sg) => (gx - sg[0]![0]) * dir >= 0 && (sg[3]![0] - gx) * dir >= 0);
      if (seg) {
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 24; k++) {
          const m = (lo + hi) / 2;
          if ((bez(seg, m, 0) - gx) * dir < 0) lo = m;
          else hi = m;
        }
        lx = gx;
        ly = bez(seg, (lo + hi) / 2, 1);
      }
    }
    edges[e.id] = { d, lx: r(lx), ly: r(ly), box: [x0, y0, x1, y1] };
  }
  return { width, height, nodes, edges, ms: performance.now() - t0 };
}

/* ------------------------------------------------------------------ worker */

/** Above this many nodes the layout runs in a worker (when one can be started) and uses the faster ranker. */
export const WORKER_THRESHOLD = 300;

let worker: Worker | null | undefined;
let workerUrl = '';
let seq = 0;
const pending = new Map<number, { resolve: (o: LayoutOutput) => void; reject: (e: unknown) => void }>();

function workerSource(embedded: string): string {
  // With `embedded`, dagre's own code is prepended (it defines self.__mmDagre) and no import is needed.
  return `${embedded ? `${embedded}\nlet lib = self.__mmDagre;` : 'let lib;'}
const runLayout = ${runLayout.toString()};
self.onmessage = async (e) => {
  const { id, url, input } = e.data;
  try {
    lib ??= await import(url);
    self.postMessage({ id, out: runLayout(lib.default && lib.default.layout ? lib.default : lib, input) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};`;
}

function getWorker(embedded = ''): Worker | null {
  if (worker !== undefined) return worker;
  try {
    workerUrl = URL.createObjectURL(new Blob([workerSource(embedded)], { type: 'text/javascript' }));
    const w = new Worker(workerUrl, { type: 'module', name: 'mm-lineage-layout' });
    w.onmessage = (e: MessageEvent<{ id: number; out?: LayoutOutput; error?: string }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (!p) return;
      if (e.data.out) p.resolve(e.data.out);
      else p.reject(new Error(e.data.error));
    };
    w.onerror = () => {
      worker = null;
      pending.forEach((p) => p.reject(new Error('Layout worker failed')));
      pending.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * The URL the worker imports dagre from. Apps pass it with `layout-module-url` (for example Vite's
 * `import url from '@dagrejs/dagre?url'`); otherwise `import.meta.resolve` is tried, which works with
 * import maps and native ESM hosting. Without either, layout runs on the main thread.
 */
export function resolveDagreUrl(explicit: string): string {
  const base = typeof document !== 'undefined' ? document.baseURI : undefined;
  try {
    if (explicit) return new URL(explicit, base).href;
    const resolve = (import.meta as ImportMeta & { resolve?: (s: string) => string }).resolve;
    return resolve ? new URL(resolve('@dagrejs/dagre'), base).href : '';
  } catch {
    return '';
  }
}

/** Lays the graph out, in a worker when the graph is large and a worker can import dagre; synchronously otherwise. */
export async function layoutGraph(input: LayoutInput, moduleUrl: string): Promise<LayoutOutput & { where: 'worker' | 'main' }> {
  const big = input.nodes.length > WORKER_THRESHOLD;
  const url = big ? resolveDagreUrl(moduleUrl) : '';
  // No URL for dagre: embed a prebuilt copy in the worker, loaded lazily so small graphs never pay for it.
  const embedded = big && !url && typeof Worker !== 'undefined' && worker === undefined ? (await import('./dagre-source.generated.js')).default : '';
  if (big && (url || embedded || worker) && typeof Worker !== 'undefined') {
    const w = getWorker(embedded);
    if (w) {
      try {
        const id = ++seq;
        const out = await new Promise<LayoutOutput>((resolve, reject) => {
          pending.set(id, { resolve, reject });
          w.postMessage({ id, url, input });
        });
        return { ...out, where: 'worker' };
      } catch {
        /* fall through to the synchronous layout */
      }
    }
  }
  return { ...runLayout({ graphlib, layout: dagreLayout }, input), where: 'main' };
}
