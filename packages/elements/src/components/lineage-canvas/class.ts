import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { repeat } from 'lit/directives/repeat.js';
import { select, type Selection } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { MmProviderLogo } from '@marmotdata/icons';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { isRtl } from '../../core/roving.js';
import { formatCount, formatRelative } from '../../core/format.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../switch/define.js';
import '../loading/define.js';
import '../empty-state/define.js';
import '../lineage-node/define.js';
import '../lineage-legend/define.js';
import {
  WORKER_THRESHOLD,
  layoutGraph,
  prepareGraph,
  type LayoutOutput,
  type LineageGraph,
  type ViewEdge,
  type ViewGraph,
  type ViewNode,
} from './layout.js';

export type { LineageGraph, LineageGraphNode, LineageGraphEdge, LineageEdgeKind, LineageEdgeOrigin } from './layout.js';

/** Detail for `mm-node-activate`. */
export interface MmLineageActivateDetail {
  id: string;
  mrn: string;
  name: string;
}
/** Detail for `mm-node-select`. `id` is null when the selection is cleared. */
export interface MmLineageSelectDetail {
  id: string | null;
  mrn: string | null;
}
/** Detail for `mm-expand`. `agents` expands or collapses an agent cluster; the others ask for hidden neighbours. */
export interface MmLineageExpandDetail {
  id: string;
  direction: 'upstream' | 'downstream' | 'agents';
  expanded?: boolean;
}
/** Detail for `mm-viewport-change`: the d3-zoom transform. */
export interface MmLineageViewportDetail {
  x: number;
  y: number;
  k: number;
}
/** Detail for `mm-fullscreen-change`. */
export interface MmLineageFullscreenDetail {
  fullscreen: boolean;
}
/** Detail for `mm-options-change`. Refetch lineage at the new depth if the server cut it. */
export interface MmLineageOptionsDetail {
  depth: number;
  showObserved: boolean;
  showStructure: boolean;
}
/** Detail for `mm-edge-delete`. */
export interface MmLineageEdgeDeleteDetail {
  source: string;
  target: string;
  kind: string;
}
/** Detail for `mm-add-lineage`. */
export interface MmLineageAddDetail {
  id: string;
  direction: 'upstream' | 'downstream';
}
/** Detail for `mm-layout`. */
export interface MmLineageLayoutDetail {
  nodes: number;
  edges: number;
  ms: number;
  where: 'worker' | 'main';
}

type Focus = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | { kind: 'handle'; id: string; dir: 'up' | 'down' };

/** Below this scale node text is unreadable, so nodes are drawn as plain shapes in the SVG layer. */
const LOD_SCALE = 0.4;
const MAX_SCALE = 2;

/**
 * The lineage canvas draws how data moves between assets: HTML nodes on one transformed layer, SVG
 * edges beneath, on survey paper with a 16px dot grid that pans and zooms with the content. Layout
 * is dagre, left to right (mirrored in right-to-left documents), run in a worker for large graphs.
 * Pan and zoom use d3-zoom: drag, wheel and pinch.
 *
 * Edges never rely on colour alone: declared edges are solid ink-3, observed edges dashed moss,
 * mixed edges solid with a dashed overlay, and cycle edges dotted ochre ending in a "Returns to"
 * node rather than doubling back. Edge chips (origin and run count, or the job) appear on hover or
 * focus, or always with `show-edge-labels`. Agents that looked an asset up are grouped into one
 * agent cluster that expands. Nodes with neighbours beyond the depth show a "+3 upstream" handle.
 *
 * Keyboard: the canvas is one tab stop (an `application` with `aria-activedescendant`). Right moves
 * downstream along an edge and Left upstream (flipped right to left), Up and Down move between assets
 * in the same column, Enter opens (`mm-node-activate`), Space selects, E steps through the focused
 * asset's edges (Delete removes one when `editable`), + and - zoom, 0 fits, F returns to the current
 * asset, and Escape leaves full screen. The minimap is a second tab stop: arrows pan, + and - zoom.
 *
 * Performance: only nodes and edges in view plus a margin are rendered, panning moves one CSS
 * transform, and below 40% zoom nodes become plain shapes. 2,000 nodes pan at display rate.
 *
 * Full screen is in-page (`fullscreen`); making it deep-linkable is the app's job, from
 * `mm-fullscreen-change`.
 *
 * @tagname mm-lineage-canvas
 * @summary Pan-and-zoom lineage graph with keyboard navigation and a minimap.
 * @slot actions - Extra toolbar actions, at the end of the toolbar before full screen.
 * @slot legend - Replaces the compact legend in the top corner.
 * @csspart toolbar - The control bar.
 * @csspart viewport - The pannable paper.
 * @csspart minimap - The minimap.
 * @csspart zoom-controls - The zoom buttons.
 * @cssprop --mm-lineage-height - Height when not full screen. Default 560px.
 * @fires mm-node-activate - {MmLineageActivateDetail} An asset was clicked or Enter was pressed on it. Open the asset blade.
 * @fires mm-node-select - {MmLineageSelectDetail} The selected asset changed (Space or click).
 * @fires mm-expand - {MmLineageExpandDetail} A "+3 upstream" handle was used, or an agent cluster expanded or collapsed.
 * @fires mm-viewport-change - {MmLineageViewportDetail} A pan or zoom ended.
 * @fires mm-fullscreen-change - {MmLineageFullscreenDetail} Full screen was entered or left.
 * @fires mm-options-change - {MmLineageOptionsDetail} Depth, Observed or Structure changed.
 * @fires mm-edge-delete - {MmLineageEdgeDeleteDetail} Delete was asked for on an edge (`editable` only). The app confirms and removes it.
 * @fires mm-add-lineage - {MmLineageAddDetail} "Add upstream" or "Add downstream" was pressed for the selected asset (`editable` only).
 * @fires mm-layout - {MmLineageLayoutDetail} A layout finished.
 * @fires mm-retry - {Record<string, never>} "Try again" was pressed in the error state.
 */
export class MmLineageCanvas extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        height: var(--mm-lineage-height, 560px);
        min-height: 320px;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-paper);
        color: var(--mm-text);
        font: var(--text-dense);
        overflow: hidden;
      }
      :host([fullscreen]) {
        position: fixed;
        inset: 0;
        height: auto;
        z-index: var(--mm-z-dialog);
        border: 0;
        border-radius: 0;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-5);
        padding: var(--space-2) var(--space-3);
        background: var(--mm-surface);
        border-bottom: 1px solid var(--mm-rule);
      }
      .depth {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
      .depth-val {
        min-width: 7ch;
        text-align: center;
        font: var(--text-caption);
        color: var(--mm-text);
        font-variant-numeric: tabular-nums;
      }
      .spacer {
        flex: 1;
      }
      .end {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .stage {
        position: relative;
        flex: 1;
        min-height: 0;
        container-type: size;
      }
      .viewport {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background-color: var(--mm-paper);
        background-image: radial-gradient(circle, var(--mm-rule) 1px, transparent 1.2px);
        background-size: 16px 16px;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .viewport:active {
        cursor: grabbing;
      }
      .viewport:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: -2px;
      }
      .layer {
        position: absolute;
        left: 0;
        top: 0;
        transform-origin: 0 0;
      }
      /* Graph coordinates are physical: right-to-left is handled by mirroring the layout itself. */
      .n {
        position: absolute;
        transform: translate(-50%, -50%);
        cursor: pointer;
      }
      .n mm-lineage-node:not([current]):not([selected]):hover::part(node) {
        border-color: var(--mm-text);
      }
      .handle {
        all: unset;
        box-sizing: border-box;
        position: absolute;
        top: 50%;
        display: inline-flex;
        align-items: center;
        height: 24px;
        padding: 0 6px;
        white-space: nowrap;
        font: var(--text-caption);
        font-weight: 600;
        color: var(--mm-text-2);
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        cursor: pointer;
        unicode-bidi: plaintext;
        transition: border-color var(--mm-dur-press) var(--mm-ease), color var(--mm-dur-press) var(--mm-ease);
      }
      .handle:hover {
        color: var(--mm-text);
        border-color: var(--mm-text);
      }
      .handle.up {
        inset-inline-end: 100%;
        transform: translateY(-50%);
        margin-inline-end: var(--space-2);
      }
      .handle.down {
        inset-inline-start: 100%;
        transform: translateY(-50%);
        margin-inline-start: var(--space-2);
      }
      .handle.focused {
        outline: 2px solid var(--mm-text);
        outline-offset: 2px;
      }
      svg.edges {
        position: absolute;
        left: 0;
        top: 0;
        overflow: visible;
        pointer-events: none;
      }
      .e .line,
      .e .overlay,
      .e .ring,
      .e .gap {
        fill: none;
        stroke-width: 1.5;
      }
      .e.declared .line,
      .e.mixed .line {
        stroke: var(--mm-text-3);
      }
      .e.observed .line,
      .e.mixed .overlay {
        stroke: var(--mm-success);
        stroke-dasharray: 5 4;
      }
      .e.cycle .line {
        stroke: var(--mm-warning);
        stroke-dasharray: 2 3;
      }
      .e.hot .line,
      .e.hot .overlay {
        stroke-width: 2.5;
      }
      .e .ring {
        stroke: var(--mm-text);
        stroke-width: 9;
      }
      .e .gap {
        stroke: var(--mm-paper);
        stroke-width: 5;
      }
      .e .hit {
        fill: none;
        stroke: transparent;
        stroke-width: 12;
        pointer-events: stroke;
        cursor: pointer;
      }
      .lod .e .line,
      .lod .e .overlay {
        vector-effect: non-scaling-stroke;
        stroke-width: 1;
      }
      .head-declared {
        fill: var(--mm-text-3);
      }
      .head-observed {
        fill: var(--mm-success);
      }
      .head-cycle {
        fill: var(--mm-warning);
      }
      .lodn {
        fill: var(--mm-control-border);
        stroke: var(--mm-control-border);
        vector-effect: non-scaling-stroke;
        pointer-events: all;
        cursor: pointer;
      }
      .lodn.stub {
        fill: none;
        stroke-dasharray: 4 3;
      }
      .lodn.cycle {
        stroke: var(--mm-warning);
        stroke-dasharray: 2 3;
      }
      .lodn.current {
        fill: var(--mm-primary);
        stroke: var(--mm-primary);
      }
      .lodn.failed {
        fill: var(--mm-danger);
        stroke: var(--mm-danger);
      }
      .chip {
        position: absolute;
        transform: translate(-50%, -50%);
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font: var(--text-caption);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        padding: 3px 5px;
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        color: var(--mm-text-2);
        white-space: nowrap;
        pointer-events: none;
        unicode-bidi: plaintext;
      }
      .chip .ct {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chip.editable {
        pointer-events: auto;
        padding-inline-end: 2px;
      }
      .del {
        all: unset;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        margin-block: -6px;
        border-radius: var(--radius-sm);
        color: var(--mm-danger);
        cursor: pointer;
      }
      .del:hover {
        background: var(--mm-danger-soft);
      }
      .del:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: 0;
      }
      .tools {
        position: absolute;
        inset-block-end: var(--space-3);
        inset-inline-start: var(--space-3);
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      .zoom-val {
        min-width: 5ch;
        text-align: center;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .minimap {
        position: absolute;
        inset-block-end: var(--space-3);
        inset-inline-end: var(--space-3);
        width: 200px;
        height: 128px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        overflow: hidden;
        cursor: pointer;
        touch-action: none;
      }
      .minimap svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .mmn {
        fill: var(--mm-control-border);
      }
      .mmn.current {
        fill: var(--mm-primary);
      }
      .mmv {
        fill: var(--mm-text);
        fill-opacity: 0.04;
        stroke: var(--mm-text-2);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
        cursor: move;
      }
      .legend {
        position: absolute;
        inset-block-start: var(--space-3);
        inset-inline-end: var(--space-3);
      }
      .state {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        padding: var(--space-6);
        background: var(--mm-paper);
      }
      .error {
        display: grid;
        justify-items: center;
        gap: var(--space-3);
        max-width: 46ch;
        text-align: center;
        font: var(--text-body);
        color: var(--mm-text-2);
      }
      .error p {
        margin: 0;
      }
      .error strong {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--mm-text);
      }
      .error mm-icon {
        color: var(--mm-danger);
      }
      @container (max-width: 520px) {
        .zoom-val {
          display: none;
        }
      }
    `,
  ];

  /** The lineage to draw: `{ nodes, edges, currentId }`. Replace the object to update it. */
  @property({ attribute: false }) accessor graph: LineageGraph = { nodes: [], edges: [] };
  /** How many steps from the current asset to draw. Default 10, as in the product. */
  @property({ type: Number, reflect: true }) accessor depth = 10;
  /** Upper bound for the depth stepper. */
  @property({ type: Number, attribute: 'max-depth' }) accessor maxDepth = 20;
  /** Draws observed edges (OpenLineage runs, agent lookups). Off by default so chatty agents don't crowd pipeline lineage. */
  @property({ type: Boolean, reflect: true, attribute: 'show-observed' }) accessor showObserved = false;
  /** Hides CONTAINS edges (a database holds a table), which are most of many graphs but move no data. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-structure' }) accessor hideStructure = false;
  /** Shows every edge chip, not only on hover and focus. */
  @property({ type: Boolean, reflect: true, attribute: 'show-edge-labels' }) accessor showEdgeLabels = false;
  /** In-page full screen. Escape leaves it. */
  @property({ type: Boolean, reflect: true }) accessor fullscreen = false;
  /** Offers "Add upstream", "Add downstream" and edge deletion. */
  @property({ type: Boolean, reflect: true }) accessor editable = false;
  /** Shows the topographic loading field (after 200ms, for at least 400ms). */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message. Shows the error state with "Try again". */
  @property() accessor error = '';
  /** Id of the selected asset. */
  @property({ reflect: true }) accessor selected = '';
  /** Accessible name. Defaults to "Lineage of {current asset}". */
  @property() accessor label = '';
  /**
   * URL of the dagre ES module for the layout worker, e.g. `import url from '@dagrejs/dagre?url'` in
   * Vite. Graphs over 300 nodes lay out off the main thread when this (or `import.meta.resolve`) works.
   */
  @property({ attribute: 'layout-module-url' }) accessor layoutModuleUrl = '';
  @property({ type: Boolean, reflect: true, attribute: 'hide-minimap' }) accessor hideMinimap = false;
  @property({ type: Boolean, reflect: true, attribute: 'hide-legend' }) accessor hideLegend = false;

  @query('.viewport') accessor #vp!: HTMLDivElement | null;
  @query('.layer') accessor #layer!: HTMLDivElement | null;

  #view: ViewGraph | null = null;
  #layout: LayoutOutput | null = null;
  /** Widest an edge chip may be: the gap between columns less a margin each side, so it never covers a node. */
  #chipMax = 112;
  /** True while the canvas itself changes `selected`, so the change does not move the view. */
  #selecting = false;
  #byId = new Map<string, ViewNode>();
  #nodeIndex = new Map<string, number>();
  #edgeById = new Map<string, ViewEdge>();
  #edgeIndex = new Map<string, number>();
  #out = new Map<string, ViewEdge[]>();
  #in = new Map<string, ViewEdge[]>();
  #rankOf = new Map<string, string[]>();

  #expandedClusters = new Set<string>();
  #revealed = new Set<string>();
  #focus: Focus | null = null;
  #edgeAnchor = '';
  #hoverEdge = '';
  #announce = '';

  #t: ZoomTransform = zoomIdentity;
  #zoom?: ZoomBehavior<HTMLDivElement, unknown>;
  #sel?: Selection<HTMLDivElement, unknown, null, undefined>;
  #vw = 0;
  #vh = 0;
  #rtl = false;
  #frame = 0;
  #cull: [number, number, number, number] | null = null;
  #lod = false;
  #visibleNodes: ViewNode[] = [];
  #visibleEdges: ViewEdge[] = [];
  #needsInitialView = true;
  /** True once the person pans, zooms or moves focus; until then the view refits on resize and relayout. */
  #userMoved = false;
  /** Minimap shown: null follows the canvas width (open from 720px). */
  #minimapOpen: boolean | null = null;
  #layoutSeq = 0;
  #relayoutQueued = false;
  #layingOut = false;
  #lastCurrent: string | undefined;
  #layoutDone: Promise<void> = Promise.resolve();
  #layoutResolve?: () => void;
  #resize?: ResizeObserver;
  #minimapDrag = false;

  /** Resolves when the current layout has been drawn. Useful in tests and before measuring. */
  get layoutComplete(): Promise<void> {
    return this.#layoutDone;
  }
  /** The current pan and zoom. */
  get transform(): MmLineageViewportDetail {
    return { x: this.#t.x, y: this.#t.y, k: this.#t.k };
  }
  /** Number of asset elements currently rendered (for performance checks). */
  get renderedNodeCount(): number {
    return this.renderRoot.querySelectorAll('mm-lineage-node').length;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('keydown', this.#onHostKeydown);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onHostKeydown);
    this.#resize?.disconnect();
    cancelAnimationFrame(this.#frame);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('graph')) {
      if (this.graph.currentId !== this.#lastCurrent) {
        this.#lastCurrent = this.graph.currentId;
        this.#expandedClusters.clear();
        this.#revealed.clear();
        this.#focus = null;
        this.#needsInitialView = true;
        this.#userMoved = false;
      }
      this.#queueRelayout();
    }
    if (changed.has('depth') || changed.has('showObserved') || changed.has('hideStructure')) this.#queueRelayout();
  }

  #queueRelayout() {
    if (this.#relayoutQueued) return;
    this.#relayoutQueued = true;
    this.#layoutDone = new Promise((r) => (this.#layoutResolve = r));
  }

  protected override firstUpdated(): void {
    const vp = this.#vp!;
    this.#rtl = isRtl(this);
    this.#zoom = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.05, MAX_SCALE])
      .filter((e: Event) => {
        if (e.type === 'wheel') return true;
        const t = e.target as Element | null;
        if (t?.closest?.('button, .chip')) return false;
        return !(e as MouseEvent).button;
      })
      .on('start', () => this.#layer && (this.#layer.style.willChange = 'transform'))
      .on('zoom', (e: { transform: ZoomTransform; sourceEvent: Event | null }) => {
        if (e.sourceEvent) this.#userMoved = true;
        this.#t = e.transform;
        this.#schedule();
      })
      .on('end', () => {
        if (this.#layer) this.#layer.style.willChange = '';
        emit<MmLineageViewportDetail>(this, 'mm-viewport-change', this.transform);
      });
    this.#sel = select(vp);
    this.#sel.call(this.#zoom).on('dblclick.zoom', null);
    this.#resize = new ResizeObserver(() => {
      const wasWide = this.#minimapShown;
      this.#vw = vp.clientWidth;
      this.#vh = vp.clientHeight;
      if (wasWide !== this.#minimapShown) this.requestUpdate();
      // Until the person moves the view, every size change (first measure, full screen, panel resize) refits.
      if ((this.#needsInitialView || !this.#userMoved) && this.#layout && this.#vw && this.#vh) this.#initialView();
      // A blade opening beside the canvas narrows it: keep the selected asset in view.
      else if (this.selected && this.#layout && this.#vw && this.#vh) this.#reveal(this.selected);
      this.#cull = null;
      this.#schedule();
    });
    this.#resize.observe(vp);
    this.#vw = vp.clientWidth;
    this.#vh = vp.clientHeight;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (typeof window === 'undefined') return;
    // A selection set from outside (a URL, a list beside the graph) is brought into view; one made
    // in the canvas is already on screen.
    if (changed.has('selected') && this.selected && !this.#selecting && this.#layout && !this.#relayoutQueued) this.#reveal(this.selected);
    this.#selecting = false;
    const rtl = isRtl(this);
    if (rtl !== this.#rtl) {
      this.#rtl = rtl;
      this.#queueRelayout();
    }
    if (this.#relayoutQueued) {
      this.#relayoutQueued = false;
      // After this update settles, so the layout's own re-render is not scheduled inside updated().
      void Promise.resolve().then(() => this.#relayout());
    }
    // The layer transform is applied directly, outside Lit, so it survives re-renders of the layer.
    this.#applyTransform();
  }

  #space(name: string, fallback: number): number {
    const v = parseFloat(getComputedStyle(this).getPropertyValue(name));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  async #relayout(): Promise<void> {
    const seq = ++this.#layoutSeq;
    const resolve = this.#layoutResolve;
    const view = prepareGraph(this.graph, {
      depth: this.depth,
      showObserved: this.showObserved,
      showStructure: !this.hideStructure,
      expandedClusters: this.#expandedClusters,
      revealed: this.#revealed,
    });
    const big = view.nodes.length > WORKER_THRESHOLD;
    if (big) {
      this.#layingOut = true;
      this.requestUpdate();
    }
    const anchor = this.#anchorScreenPoint();
    // Two of the largest spacing steps plus one more, so an edge chip fits between columns.
    const ranksep = this.#space('--space-12', 48) * 2 + this.#space('--space-8', 32);
    this.#chipMax = Math.max(48, ranksep - 2 * this.#space('--space-2', 8));
    let out: Awaited<ReturnType<typeof layoutGraph>> | null = null;
    if (view.nodes.length) {
      out = await layoutGraph(
        {
          nodes: view.nodes.map(({ id, w, h }) => ({ id, w, h })),
          edges: view.edges.map(({ id, source, target }) => ({ id, source, target })),
          nodesep: this.#space('--space-8', 32),
          ranksep,
          ranker: big ? 'tight-tree' : 'network-simplex',
          rtl: this.#rtl,
        },
        this.layoutModuleUrl,
      );
    }
    if (seq !== this.#layoutSeq) return;
    this.#layingOut = false;
    this.#view = view;
    this.#layout = out;
    this.#index(view);
    if (this.#focus && !this.#focusExists(this.#focus)) this.#focus = null;
    if (this.selected && !this.#byId.has(this.selected)) this.selected = '';
    this.#zoom?.scaleExtent([Math.min(0.05, this.#fitScale() * 0.8), MAX_SCALE]);
    if (out && this.#vw && this.#vh && (this.#needsInitialView || !this.#userMoved)) this.#initialView();
    else if (out && anchor) this.#restoreAnchor(anchor);
    this.#cull = null;
    this.#computeVisible();
    this.requestUpdate();
    await this.updateComplete;
    if (out) emit<MmLineageLayoutDetail>(this, 'mm-layout', { nodes: view.nodes.length, edges: view.edges.length, ms: Math.round(out.ms), where: out.where });
    resolve?.();
  }

  #index(view: ViewGraph) {
    this.#byId = new Map(view.nodes.map((n) => [n.id, n]));
    this.#nodeIndex = new Map(view.nodes.map((n, i) => [n.id, i]));
    this.#edgeById = new Map(view.edges.map((e) => [e.id, e]));
    this.#edgeIndex = new Map(view.edges.map((e, i) => [e.id, i]));
    this.#out = new Map();
    this.#in = new Map();
    for (const e of view.edges) {
      (this.#out.get(e.source) ?? this.#out.set(e.source, []).get(e.source)!).push(e);
      (this.#in.get(e.target) ?? this.#in.set(e.target, []).get(e.target)!).push(e);
    }
    // Ranks are columns: dagre centres every node of a rank on the same x.
    const cols = new Map<number, string[]>();
    const pos = this.#layout?.nodes ?? {};
    for (const n of view.nodes) {
      const p = pos[n.id];
      if (!p) continue;
      const key = Math.round(p[0]);
      (cols.get(key) ?? cols.set(key, []).get(key)!).push(n.id);
    }
    this.#rankOf = new Map();
    for (const ids of cols.values()) {
      ids.sort((a, b) => pos[a]![1] - pos[b]![1]);
      for (const id of ids) this.#rankOf.set(id, ids);
    }
  }

  #focusExists(f: Focus): boolean {
    return f.kind === 'edge' ? this.#edgeById.has(f.id) : this.#byId.has(f.id);
  }

  /* ---------------------------------------------------------------- viewport */

  get #minimapShown(): boolean {
    return !this.hideMinimap && (this.#minimapOpen ?? this.#vw >= 720);
  }

  /**
   * Fit geometry. Graph-space room for "+3 upstream" handles at the sides, and screen-space room for
   * the legend above and the zoom controls and minimap below, so nothing fitted sits under them.
   */
  #fitBox(): { hx: number; side: number; top: number; bottom: number } {
    const hx = this.#view?.nodes.some((n) => n.hiddenUp || n.hiddenDown) ? 112 : 0;
    return { hx, side: 24, top: this.hideLegend ? 24 : 56, bottom: this.#minimapShown ? 128 + 24 + 8 : 36 + 24 + 4 };
  }

  #fitScale(): number {
    const l = this.#layout;
    if (!l || !this.#vw || !this.#vh) return 1;
    const b = this.#fitBox();
    return Math.min(1, (this.#vw - b.side * 2) / Math.max(1, l.width + b.hx * 2), (this.#vh - b.top - b.bottom) / Math.max(1, l.height));
  }

  /**
   * Whole graph if it fits legibly (nodes still drawn as cards); otherwise the current asset at 100%.
   * Then, if an asset is selected, it is brought into view clear of the legend and minimap.
   */
  #initialView() {
    this.#needsInitialView = false;
    const current = this.graph.currentId;
    if (this.#fitScale() >= LOD_SCALE || !current || !this.#layout?.nodes[current]) this.#fit();
    else this.#centreOn(current, 1);
    if (this.selected) this.#reveal(this.selected);
  }

  /** Screen area clear of the legend above and the zoom controls and minimap below. */
  #safeBox(): { l: number; t: number; r: number; b: number } {
    const f = this.#fitBox();
    return { l: f.side, t: f.top, r: this.#vw - f.side, b: this.#vh - f.bottom };
  }

  /** Brings an asset fully into the safe area, centring it there if any part is outside. */
  #reveal(id: string) {
    const p = this.#layout?.nodes[id];
    const n = this.#byId.get(id);
    if (!p || !n || !this.#sel || !this.#zoom || !this.#vw || !this.#vh) return;
    const { x, y, k } = this.#t;
    const box = this.#safeBox();
    const sx = p[0] * k + x;
    const sy = p[1] * k + y;
    const hw = (n.w * k) / 2;
    const hh = (n.h * k) / 2;
    if (sx - hw >= box.l && sx + hw <= box.r && sy - hh >= box.t && sy + hh <= box.b) return;
    const cx = (box.l + box.r) / 2;
    const cy = box.b > box.t ? (box.t + box.b) / 2 : this.#vh / 2;
    this.#zoom.transform(this.#sel, zoomIdentity.translate(cx - p[0] * k, cy - p[1] * k).scale(k));
  }

  #fit() {
    const l = this.#layout;
    if (!l || !this.#sel || !this.#zoom) return;
    const k = this.#fitScale();
    const b = this.#fitBox();
    const x = b.side + (this.#vw - b.side * 2 - (l.width + b.hx * 2) * k) / 2 + b.hx * k;
    const y = b.top + (this.#vh - b.top - b.bottom - l.height * k) / 2;
    this.#zoom.transform(this.#sel, zoomIdentity.translate(x, y).scale(k));
  }

  /** Fits the whole graph in view, clear of the legend, zoom controls and minimap. */
  fit(): void {
    this.#userMoved = true;
    this.#fit();
  }
  /** Zooms in one step around the centre. */
  zoomIn(): void {
    this.#userMoved = true;
    if (this.#sel && this.#zoom) this.#zoom.scaleBy(this.#sel, 1.25);
  }
  /** Zooms out one step around the centre. */
  zoomOut(): void {
    this.#userMoved = true;
    if (this.#sel && this.#zoom) this.#zoom.scaleBy(this.#sel, 0.8);
  }
  /** Pans by a number of screen pixels. */
  panBy(dx: number, dy: number): void {
    this.#userMoved = true;
    if (this.#sel && this.#zoom) this.#zoom.translateBy(this.#sel, dx / this.#t.k, dy / this.#t.k);
  }
  /** Moves keyboard focus to an asset and brings it into view. */
  focusNode(id: string): void {
    if (!this.#byId.has(id)) return;
    this.#userMoved = true;
    this.#setFocus({ kind: 'node', id });
    this.#vp?.focus({ preventScroll: true });
  }

  #centreOn(id: string, k = this.#t.k) {
    const p = this.#layout?.nodes[id];
    if (!p || !this.#sel || !this.#zoom) return;
    this.#zoom.transform(this.#sel, zoomIdentity.translate(this.#vw / 2 - p[0] * k, this.#vh / 2 - p[1] * k).scale(k));
  }

  #ensureVisible(id: string) {
    const p = this.#layout?.nodes[id];
    const n = this.#byId.get(id);
    if (!p || !n) return;
    const { x, y, k } = this.#t;
    const m = 24;
    const sx = p[0] * k + x;
    const sy = p[1] * k + y;
    const hw = (n.w * k) / 2 + 80 * k;
    const hh = (n.h * k) / 2;
    if (sx - hw < m || sx + hw > this.#vw - m || sy - hh < m || sy + hh > this.#vh - m) this.#centreOn(id);
  }

  #anchorScreenPoint(): { id: string; sx: number; sy: number } | null {
    const id = this.#focus?.kind === 'node' ? this.#focus.id : this.graph.currentId;
    const p = id ? this.#layout?.nodes[id] : undefined;
    if (!id || !p) return null;
    return { id, sx: p[0] * this.#t.k + this.#t.x, sy: p[1] * this.#t.k + this.#t.y };
  }

  #restoreAnchor(a: { id: string; sx: number; sy: number }) {
    const p = this.#layout?.nodes[a.id];
    if (!p || !this.#sel || !this.#zoom) return;
    const k = this.#t.k;
    this.#zoom.transform(this.#sel, zoomIdentity.translate(a.sx - p[0] * k, a.sy - p[1] * k).scale(k));
  }

  #schedule() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#applyTransform();
      if (this.#needsCull()) {
        this.#computeVisible();
        this.requestUpdate();
      }
    });
  }

  #applyTransform() {
    const layer = this.#layer;
    const vp = this.#vp;
    if (!layer || !vp) return;
    const { x, y, k } = this.#t;
    layer.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    // The dot grid pans and zooms with the content, doubling its pitch when it would get denser than 8px.
    let s = 16 * k;
    while (s < 8) s *= 2;
    vp.style.backgroundSize = `${s}px ${s}px`;
    vp.style.backgroundPosition = `${x}px ${y}px`;
    const v = this.renderRoot.querySelector('.mmv');
    if (v) {
      v.setAttribute('x', String(-x / k));
      v.setAttribute('y', String(-y / k));
      v.setAttribute('width', String(Math.max(1, this.#vw / k)));
      v.setAttribute('height', String(Math.max(1, this.#vh / k)));
    }
    const z = this.renderRoot.querySelector('.zoom-val');
    if (z) z.textContent = `${k < 0.1 ? (k * 100).toFixed(1) : Math.round(k * 100)}%`;
  }

  #viewRect(): [number, number, number, number] {
    const { x, y, k } = this.#t;
    return [-x / k, -y / k, (this.#vw - x) / k, (this.#vh - y) / k];
  }

  #needsCull(): boolean {
    if (!this.#layout) return false;
    const lod = this.#t.k < LOD_SCALE;
    if (lod !== this.#lod || !this.#cull) return true;
    const [a, b, c, d] = this.#viewRect();
    const [ca, cb, cc, cd] = this.#cull;
    return a < ca || b < cb || c > cc || d > cd;
  }

  #computeVisible() {
    const l = this.#layout;
    const view = this.#view;
    if (!l || !view) {
      this.#visibleNodes = [];
      this.#visibleEdges = [];
      return;
    }
    this.#lod = this.#t.k < LOD_SCALE;
    const [a, b, c, d] = this.#viewRect();
    const mw = (c - a) * 0.5;
    const mh = (d - b) * 0.5;
    const cull: [number, number, number, number] = [a - mw, b - mh, c + mw, d + mh];
    this.#cull = cull;
    this.#visibleNodes = view.nodes.filter((n) => {
      const p = l.nodes[n.id]!;
      return p[0] + n.w / 2 + 120 >= cull[0] && p[0] - n.w / 2 - 120 <= cull[2] && p[1] + n.h / 2 >= cull[1] && p[1] - n.h / 2 <= cull[3];
    });
    this.#visibleEdges = view.edges.filter((e) => {
      const box = l.edges[e.id]!.box;
      return box[2] >= cull[0] && box[0] <= cull[2] && box[3] >= cull[1] && box[1] <= cull[3];
    });
  }

  /* ---------------------------------------------------------------- focus and keyboard */

  #setFocus(f: Focus | null, opts: { reveal?: boolean } = {}) {
    this.#focus = f;
    if (f && f.kind !== 'edge' && opts.reveal !== false) this.#ensureVisible(f.id);
    if (f?.kind === 'edge') {
      const e = this.#edgeById.get(f.id);
      const l = this.#layout?.edges[f.id];
      if (e && l) {
        const { x, y, k } = this.#t;
        const sx = l.lx * k + x;
        const sy = l.ly * k + y;
        if (sx < 24 || sy < 24 || sx > this.#vw - 24 || sy > this.#vh - 24) this.#zoom?.translateTo(this.#sel!, l.lx, l.ly);
      }
    }
    // Keep the focused item rendered even when it is outside the culled set.
    this.requestUpdate();
  }

  #onViewportFocus = () => {
    if (this.#focus || !this.#view?.nodes.length) return;
    const id = this.graph.currentId && this.#byId.has(this.graph.currentId) ? this.graph.currentId : this.#view.nodes[0]!.id;
    this.#setFocus({ kind: 'node', id }, { reveal: false });
  };

  #onHostKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.fullscreen && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      this.#setFullscreen(false);
    }
  };

  #neighbour(id: string, dir: 'up' | 'down'): string | null {
    const list = dir === 'down' ? (this.#out.get(id) ?? []).map((e) => e.target) : (this.#in.get(id) ?? []).map((e) => e.source);
    if (!list.length) return null;
    const y = this.#layout!.nodes[id]![1];
    return list.reduce((best, cur) => (Math.abs(this.#layout!.nodes[cur]![1] - y) < Math.abs(this.#layout!.nodes[best]![1] - y) ? cur : best));
  }

  #incidentEdges(id: string): ViewEdge[] {
    return [...(this.#out.get(id) ?? []), ...(this.#in.get(id) ?? [])];
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    this.#userMoved = true;
    if (!this.#view?.nodes.length || !this.#layout) return;
    const f = this.#focus;
    const downKey = this.#rtl ? 'ArrowLeft' : 'ArrowRight';
    const upKey = this.#rtl ? 'ArrowRight' : 'ArrowLeft';
    const key = e.key;
    let handled = true;
    if (key === '+' || key === '=') {
      this.zoomIn();
      this.#say(tr('lineageZoomLevel', 'Zoom {n}%', { n: Math.round(this.#t.k * 100) }));
    } else if (key === '-' || key === '_') {
      this.zoomOut();
      this.#say(tr('lineageZoomLevel', 'Zoom {n}%', { n: Math.round(this.#t.k * 100) }));
    } else if (key === '0') {
      this.fit();
      this.#say(tr('lineageFitted', 'Whole graph in view'));
    } else if (key === 'f' || key === 'F') {
      const id = this.graph.currentId;
      if (id && this.#byId.has(id)) this.#setFocus({ kind: 'node', id });
    } else if (!f) {
      handled = false;
      if (key.startsWith('Arrow') || key === 'Enter' || key === ' ') {
        this.#onViewportFocus();
        handled = true;
      }
    } else if (f.kind === 'node') {
      handled = this.#nodeKey(f.id, key, downKey, upKey);
    } else if (f.kind === 'handle') {
      if ((key === downKey && f.dir === 'up') || (key === upKey && f.dir === 'down') || key === 'Escape') this.#setFocus({ kind: 'node', id: f.id });
      else if (key === 'Enter' || key === ' ') this.#expandHidden(f.id, f.dir);
      else handled = false;
    } else {
      const edge = this.#edgeById.get(f.id);
      if (!edge) handled = false;
      else if (key === downKey) this.#setFocus({ kind: 'node', id: edge.target });
      else if (key === upKey) this.#setFocus({ kind: 'node', id: edge.source });
      else if (key === 'e' || key === 'E' || key === 'ArrowDown' || key === 'ArrowUp') {
        const list = this.#incidentEdges(this.#edgeAnchor);
        const i = list.findIndex((x) => x.id === f.id);
        const step = key === 'ArrowUp' || (key !== 'ArrowDown' && e.shiftKey) ? -1 : 1;
        const next = list[(i + step + list.length) % list.length];
        if (next) this.#setFocus({ kind: 'edge', id: next.id });
      } else if (key === 'Escape') this.#setFocus({ kind: 'node', id: this.#edgeAnchor || edge.source });
      else if ((key === 'Delete' || key === 'Backspace') && this.editable && edge.origin !== 'cycle' && !edge.source.startsWith('agents:') && !edge.target.startsWith('agents:'))
        this.#deleteEdge(edge);
      else handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  #nodeKey(id: string, key: string, downKey: string, upKey: string): boolean {
    const n = this.#byId.get(id)!;
    if (key === downKey || key === upKey) {
      const dir = key === downKey ? 'down' : 'up';
      const next = this.#neighbour(id, dir);
      if (next) this.#setFocus({ kind: 'node', id: next });
      else if (dir === 'down' ? n.hiddenDown : n.hiddenUp) this.#setFocus({ kind: 'handle', id, dir });
      return true;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const col = this.#rankOf.get(id) ?? [id];
      const i = col.indexOf(id);
      const next = col[i + (key === 'ArrowDown' ? 1 : -1)];
      if (next) this.#setFocus({ kind: 'node', id: next });
      return true;
    }
    if (key === 'Home' || key === 'End') {
      const col = this.#rankOf.get(id) ?? [id];
      this.#setFocus({ kind: 'node', id: key === 'Home' ? col[0]! : col[col.length - 1]! });
      return true;
    }
    if (key === 'Enter') {
      this.#activate(n);
      return true;
    }
    if (key === ' ') {
      if (n.variant === 'asset') this.#select(this.selected === id ? '' : id);
      else this.#activate(n);
      return true;
    }
    if (key === 'e' || key === 'E') {
      const first = this.#incidentEdges(id)[0];
      if (first) {
        this.#edgeAnchor = id;
        this.#setFocus({ kind: 'edge', id: first.id });
      }
      return true;
    }
    if (key === 'Escape' && this.selected) {
      this.#select('');
      return true;
    }
    return false;
  }

  #activate(n: ViewNode) {
    if (n.variant === 'agent-cluster') this.#toggleCluster(n.id);
    else if (n.variant === 'cycle-return' && n.targetId) this.#setFocus({ kind: 'node', id: n.targetId });
    else emit<MmLineageActivateDetail>(this, 'mm-node-activate', { id: n.id, mrn: n.mrn, name: n.name });
  }

  #select(id: string) {
    this.#selecting = this.selected !== id;
    this.selected = id;
    const n = id ? this.#byId.get(id) : undefined;
    emit<MmLineageSelectDetail>(this, 'mm-node-select', { id: id || null, mrn: n?.mrn ?? null });
  }

  #toggleCluster(id: string, force?: boolean) {
    const expanded = force ?? !this.#expandedClusters.has(id);
    if (expanded) this.#expandedClusters.add(id);
    else this.#expandedClusters.delete(id);
    const cluster = this.#byId.get(id);
    emit<MmLineageExpandDetail>(this, 'mm-expand', { id, direction: 'agents', expanded });
    this.#queueRelayout();
    this.requestUpdate();
    if (expanded && cluster?.memberIds?.length && this.#focus?.id === id) {
      const first = cluster.memberIds[0]!;
      void this.#layoutDone.then(() => this.#byId.has(first) && this.#setFocus({ kind: 'node', id: first }));
    }
    this.#say(expanded ? tr('lineageAgentsShown', 'Agents shown') : tr('lineageAgentsGrouped', 'Agents grouped'));
  }

  /** Collapses every expanded agent cluster. */
  collapseGroups(): void {
    if (!this.#expandedClusters.size) return;
    for (const id of [...this.#expandedClusters]) emit<MmLineageExpandDetail>(this, 'mm-expand', { id, direction: 'agents', expanded: false });
    this.#expandedClusters.clear();
    this.#queueRelayout();
    this.requestUpdate();
  }

  #expandHidden(id: string, dir: 'up' | 'down') {
    const shown = this.#byId;
    for (const e of this.graph.edges) {
      if (dir === 'up' && e.target === id && !shown.has(e.source)) this.#revealed.add(e.source);
      if (dir === 'down' && e.source === id && !shown.has(e.target)) this.#revealed.add(e.target);
    }
    emit<MmLineageExpandDetail>(this, 'mm-expand', { id, direction: dir === 'up' ? 'upstream' : 'downstream' });
    this.#queueRelayout();
    this.requestUpdate();
    void this.#layoutDone.then(() => {
      const next = this.#byId.has(id) ? this.#neighbour(id, dir) : null;
      if (next && this.#focus?.kind === 'handle') this.#setFocus({ kind: 'node', id: next });
      else if (this.#focus?.kind === 'handle' && !this.#byId.get(id)?.[dir === 'up' ? 'hiddenUp' : 'hiddenDown']) this.#setFocus({ kind: 'node', id });
    });
  }

  #deleteEdge(edge: ViewEdge) {
    emit<MmLineageEdgeDeleteDetail>(this, 'mm-edge-delete', { source: edge.source, target: edge.target, kind: edge.kind });
  }

  #setFullscreen(on: boolean) {
    this.fullscreen = on;
    emit<MmLineageFullscreenDetail>(this, 'mm-fullscreen-change', { fullscreen: on });
    this.#say(on ? tr('lineageFullscreenOn', 'Full screen. Press Escape to leave.') : tr('lineageFullscreenOff', 'Left full screen'));
  }

  #say(text: string) {
    // Toggle a trailing space so repeating the same message is still announced.
    this.#announce = this.#announce === text ? `${text} ` : text;
    this.requestUpdate();
  }

  #options() {
    emit<MmLineageOptionsDetail>(this, 'mm-options-change', { depth: this.depth, showObserved: this.showObserved, showStructure: !this.hideStructure });
  }

  /* ---------------------------------------------------------------- pointer */

  #onLayerClick = (e: MouseEvent) => {
    for (const t of e.composedPath()) {
      if (!(t instanceof Element) || t === this.#layer) break;
      const ds = (t as HTMLElement | SVGElement).dataset;
      if (ds.del) {
        const edge = this.#edgeById.get(ds.del);
        if (edge) this.#deleteEdge(edge);
        return;
      }
      if (ds.handle && ds.for) {
        this.#setFocus({ kind: 'handle', id: ds.for, dir: ds.handle as 'up' | 'down' }, { reveal: false });
        this.#expandHidden(ds.for, ds.handle as 'up' | 'down');
        return;
      }
      if (ds.edge) {
        this.#edgeAnchor = this.#edgeById.get(ds.edge)?.source ?? '';
        this.#setFocus({ kind: 'edge', id: ds.edge });
        return;
      }
      if (ds.node) {
        const n = this.#byId.get(ds.node);
        if (!n) return;
        this.#setFocus({ kind: 'node', id: n.id }, { reveal: false });
        if (n.variant === 'asset' && this.selected !== n.id) this.#select(n.id);
        this.#activate(n);
        return;
      }
    }
  };

  #onPointerOver = (e: PointerEvent) => {
    let id = '';
    for (const t of e.composedPath()) {
      if (!(t instanceof Element) || t === this.#layer) break;
      const v = (t as HTMLElement | SVGElement).dataset.edge;
      if (v) {
        id = v;
        break;
      }
    }
    if (id !== this.#hoverEdge) {
      this.#hoverEdge = id;
      this.requestUpdate();
    }
  };

  #onNodeToggle = (e: Event) => {
    e.stopPropagation();
    const host = (e.target as Element).closest<HTMLElement>('[data-node]');
    if (host?.dataset.node) this.#toggleCluster(host.dataset.node);
  };

  #minimapPoint(e: PointerEvent): [number, number] | null {
    const svgEl = (e.currentTarget as Element).querySelector('svg');
    const m = svgEl?.getScreenCTM();
    if (!svgEl || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  #onMinimapDown = (e: PointerEvent) => {
    const p = this.#minimapPoint(e);
    if (!p || !this.#sel || !this.#zoom) return;
    this.#minimapDrag = true;
    this.#userMoved = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.#zoom.translateTo(this.#sel, p[0], p[1]);
  };
  #onMinimapMove = (e: PointerEvent) => {
    if (!this.#minimapDrag) return;
    const p = this.#minimapPoint(e);
    if (p && this.#sel && this.#zoom) this.#zoom.translateTo(this.#sel, p[0], p[1]);
  };
  #onMinimapUp = () => {
    this.#minimapDrag = false;
  };
  #onMinimapKey = (e: KeyboardEvent) => {
    if (!this.#sel || !this.#zoom || e.ctrlKey || e.metaKey || e.altKey) return;
    this.#userMoved = true;
    const k = this.#t.k;
    const step = (e.shiftKey ? 0.5 : 0.15) * Math.min(this.#vw, this.#vh);
    // Arrows move the view rectangle, so content moves the other way.
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const mv = moves[e.key];
    if (mv) this.#zoom.translateBy(this.#sel, mv[0] / k, mv[1] / k);
    else if (e.key === '+' || e.key === '=') this.zoomIn();
    else if (e.key === '-' || e.key === '_') this.zoomOut();
    else if (e.key === '0') this.fit();
    else if (e.key === 'Enter' && this.graph.currentId) this.#centreOn(this.graph.currentId);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  /* ---------------------------------------------------------------- render */

  #nodeLabel(n: ViewNode): string {
    const parts: string[] = [];
    if (n.variant === 'agent-cluster') {
      const c = n.members?.length ?? 0;
      parts.push(tr('lineageAgentsMany', '{n} agents looked this up', { n: c }), n.members?.join(', ') ?? '', tr('lineageEnterShowsAgents', 'press Enter to show them'));
    } else if (n.variant === 'cycle-return') {
      parts.push(tr('lineageReturnsTo', 'Returns to {name}', { name: n.name }), tr('lineageEnterGoesTo', 'press Enter to go there'));
    } else {
      parts.push(n.name, n.type);
      if (n.provider) parts.push(MmProviderLogo.displayName(n.provider));
      if (n.current) parts.push(tr('lineageCurrent', 'current asset'));
      if (this.selected === n.id) parts.push(tr('lineageSelected', 'selected'));
      if (n.stub) parts.push(tr('lineageNotSurveyed', 'Not catalogued yet'));
      if (n.failed) parts.push(tr('lineageLastRunFailed', 'Last run failed'));
    }
    const up = this.#in.get(n.id)?.length ?? 0;
    const down = this.#out.get(n.id)?.length ?? 0;
    parts.push(tr('lineageNeighbours', '{up} upstream, {down} downstream', { up, down }));
    return parts.filter(Boolean).join(', ');
  }

  #chipText(e: ViewEdge): string {
    const runs = e.observations ? ` · ${tr('lineageRuns', '{n} runs', { n: formatCount(e.observations) })}` : '';
    if (e.origin === 'cycle') return tr('lineageCycleChip', 'cycle');
    if (e.origin === 'observed') return `${e.kind === 'AGENT_LOOKUP' ? tr('lineageLookedUp', 'looked up') : tr('lineageObserved', 'observed')}${runs}`;
    if (e.origin === 'mixed') return `${tr('lineageMixed', 'mixed')}${runs}`;
    if (e.job) return e.job.startsWith('mrn://') ? e.job.slice(e.job.lastIndexOf('/') + 1) : e.job;
    return e.kind;
  }

  #edgeLabel(e: ViewEdge): string {
    const s = this.#byId.get(e.source)?.name ?? e.source;
    const t = this.#byId.get(e.target);
    const tn = t?.variant === 'cycle-return' ? tr('lineageReturnsTo', 'Returns to {name}', { name: t.name }) : (t?.name ?? e.target);
    const origin =
      e.origin === 'cycle' ? tr('lineageCycleEdge', 'cycle, dotted') : e.origin === 'observed' ? tr('lineageObservedEdge', 'observed, dashed') : e.origin === 'mixed' ? tr('lineageMixedEdge', 'declared and observed') : tr('lineageDeclaredEdge', 'declared, solid');
    const parts = [tr('lineageEdgeFromTo', '{kind} from {source} to {target}', { kind: e.kind, source: s, target: tn }), origin];
    if (e.observations) parts.push(tr('lineageRuns', '{n} runs', { n: formatCount(e.observations) }));
    if (e.lastSeen) parts.push(tr('lineageLastSeen', 'last seen {when}', { when: formatRelative(e.lastSeen) }));
    if (e.job) parts.push(tr('lineageJob', 'job {job}', { job: e.job }));
    if (this.editable && e.origin !== 'cycle') parts.push(tr('lineageDeleteHint', 'press Delete to remove'));
    return parts.join(', ');
  }

  #domId(f: Focus | null): string | undefined {
    if (!f) return undefined;
    if (f.kind === 'node') return this.#nodeIndex.has(f.id) ? `n${this.#nodeIndex.get(f.id)}` : undefined;
    if (f.kind === 'handle') return this.#nodeIndex.has(f.id) ? `h${this.#nodeIndex.get(f.id)}-${f.dir}` : undefined;
    return this.#edgeIndex.has(f.id) ? `e${this.#edgeIndex.get(f.id)}` : undefined;
  }

  #renderNode(n: ViewNode): TemplateResult {
    const l = this.#layout!;
    const p = l.nodes[n.id]!;
    const i = this.#nodeIndex.get(n.id)!;
    const f = this.#focus;
    const focused = f?.kind === 'node' && f.id === n.id;
    const handleFocus = f?.kind === 'handle' && f.id === n.id ? f.dir : '';
    const handle = (dir: 'up' | 'down', count: number) =>
      count
        ? html`<button
            class="handle ${dir} ${handleFocus === dir ? 'focused' : ''}"
            id="h${i}-${dir}"
            type="button"
            tabindex="-1"
            data-handle=${dir}
            data-for=${n.id}
            aria-label=${`${dir === 'up' ? tr('lineageUpstreamCount', '+{n} upstream', { n: count }) : tr('lineageDownstreamCount', '+{n} downstream', { n: count })}, ${tr('lineageShowThem', 'press Enter to show them')}`}
          >
            ${dir === 'up' ? tr('lineageUpstreamCount', '+{n} upstream', { n: count }) : tr('lineageDownstreamCount', '+{n} downstream', { n: count })}
          </button>`
        : nothing;
    return html`<div class="n" style="left:${p[0]}px;top:${p[1]}px" data-node=${n.id}>
      <mm-lineage-node
        id="n${i}"
        role="group"
        aria-roledescription=${tr('lineageAssetRole', 'asset')}
        aria-label=${this.#nodeLabel(n)}
        variant=${n.variant}
        .name=${n.name}
        .type=${n.type}
        .provider=${n.provider}
        .mrn=${n.mrn}
        .members=${n.members ?? []}
        ?current=${n.current}
        ?stub=${n.stub}
        ?failed=${n.failed}
        ?selected=${this.selected === n.id}
        ?focused=${focused}
        @mm-toggle=${this.#onNodeToggle}
      ></mm-lineage-node>
      ${handle('up', n.hiddenUp)} ${handle('down', n.hiddenDown)}
    </div>`;
  }

  #renderEdge(e: ViewEdge): TemplateResult {
    const g = this.#layout!.edges[e.id]!;
    const i = this.#edgeIndex.get(e.id)!;
    const f = this.#focus;
    const focused = f?.kind === 'edge' && f.id === e.id;
    const touchesFocus = f?.kind === 'node' && (e.source === f.id || e.target === f.id);
    const hot = focused || this.#hoverEdge === e.id || touchesFocus || (!!this.selected && (e.source === this.selected || e.target === this.selected));
    const marker = this.#lod ? undefined : e.origin === 'observed' ? 'url(#ah-observed)' : e.origin === 'cycle' ? 'url(#ah-cycle)' : 'url(#ah-declared)';
    return svg`<g class="e ${e.origin} ${hot ? 'hot' : ''}" id="e${i}" data-edge=${e.id} role="group" aria-roledescription=${tr('lineageEdgeRole', 'edge')} aria-label=${this.#edgeLabel(e)}>
      ${focused ? svg`<path class="ring" d=${g.d}></path><path class="gap" d=${g.d}></path>` : nothing}
      <path class="hit" d=${g.d}><title>${e.job || this.#chipText(e)}</title></path>
      <path class="line" d=${g.d} marker-end=${marker ?? nothing}></path>
      ${e.origin === 'mixed' ? svg`<path class="overlay" d=${g.d}></path>` : nothing}
    </g>`;
  }

  #renderLodNode(n: ViewNode): TemplateResult {
    const p = this.#layout!.nodes[n.id]!;
    const cls = ['lodn', n.current ? 'current' : '', n.stub ? 'stub' : '', n.failed ? 'failed' : '', n.variant === 'cycle-return' ? 'cycle' : ''].join(' ');
    return svg`<rect class=${cls} data-node=${n.id} x=${p[0] - n.w / 2} y=${p[1] - n.h / 2} width=${n.w} height=${n.h} rx="6"></rect>`;
  }

  #renderMinimap(): TemplateResult {
    const l = this.#layout!;
    const view = this.#view!;
    const pad = 40;
    return html`<svg viewBox="${-pad} ${-pad} ${l.width + pad * 2} ${l.height + pad * 2}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${view.nodes.map((n) => {
        const p = l.nodes[n.id]!;
        return svg`<rect class="mmn ${n.current ? 'current' : ''}" x=${p[0] - n.w / 2} y=${p[1] - n.h / 2} width=${n.w} height=${n.h}></rect>`;
      })}
      <rect class="mmv" x="0" y="0" width="1" height="1"></rect>
    </svg>`;
  }

  #renderToolbar(): TemplateResult {
    const sel = this.selected ? this.#byId.get(this.selected) : undefined;
    return html`<div class="bar" part="toolbar" role="group" aria-label=${tr('lineageControls', 'Lineage controls')}>
      <div class="depth" role="group" aria-label=${tr('lineageDepth', 'Depth')}>
        <mm-button
          variant="ghost"
          size="sm"
          icon="remove"
          label=${tr('lineageDepthLess', 'Decrease depth')}
          ?disabled=${this.depth <= 1}
          @click=${() => {
            this.depth = Math.max(1, this.depth - 1);
            this.#options();
          }}
        ></mm-button>
        <span class="depth-val" aria-live="polite">${tr('lineageDepthValue', 'Depth {n}', { n: this.depth })}</span>
        <mm-button
          variant="ghost"
          size="sm"
          icon="add"
          label=${tr('lineageDepthMore', 'Increase depth')}
          ?disabled=${this.depth >= this.maxDepth}
          @click=${() => {
            this.depth = Math.min(this.maxDepth, this.depth + 1);
            this.#options();
          }}
        ></mm-button>
      </div>
      <mm-switch
        label=${tr('lineageObservedToggle', 'Observed')}
        .checked=${this.showObserved}
        @mm-change=${(e: CustomEvent<{ checked: boolean }>) => {
          e.stopPropagation();
          this.showObserved = e.detail.checked;
          this.#options();
        }}
        @mm-input=${(e: Event) => e.stopPropagation()}
      ></mm-switch>
      <mm-switch
        label=${tr('lineageStructureToggle', 'Structure')}
        .checked=${!this.hideStructure}
        @mm-change=${(e: CustomEvent<{ checked: boolean }>) => {
          e.stopPropagation();
          this.hideStructure = !e.detail.checked;
          this.#options();
        }}
        @mm-input=${(e: Event) => e.stopPropagation()}
      ></mm-switch>
      ${this.#expandedClusters.size
        ? html`<mm-button variant="ghost" size="sm" icon="expand-less" @click=${() => this.collapseGroups()}>${tr('lineageCollapseGroups', 'Collapse groups')}</mm-button>`
        : nothing}
      <span class="spacer"></span>
      <div class="end">
        ${this.editable && sel
          ? html`<mm-button
                variant="secondary"
                size="sm"
                icon="add"
                @click=${() => emit<MmLineageAddDetail>(this, 'mm-add-lineage', { id: sel.id, direction: 'upstream' })}
                >${tr('lineageAddUpstream', 'Add upstream')}</mm-button
              ><mm-button
                variant="secondary"
                size="sm"
                icon="add"
                @click=${() => emit<MmLineageAddDetail>(this, 'mm-add-lineage', { id: sel.id, direction: 'downstream' })}
                >${tr('lineageAddDownstream', 'Add downstream')}</mm-button
              >`
          : nothing}
        <slot name="actions"></slot>
        <mm-button
          variant="ghost"
          size="sm"
          icon=${this.fullscreen ? 'fullscreen-exit' : 'fullscreen'}
          label=${this.fullscreen ? tr('lineageExitFullscreen', 'Leave full screen') : tr('lineageFullscreen', 'Full screen')}
          pressed=${this.fullscreen ? 'true' : 'false'}
          @click=${() => this.#setFullscreen(!this.fullscreen)}
        ></mm-button>
      </div>
    </div>`;
  }

  #renderOverlay(): TemplateResult | typeof nothing {
    if (this.error) {
      return html`<div class="state">
        <div class="error" role="alert">
          <strong><mm-icon name="error"></mm-icon>${tr('lineageErrorTitle', 'Lineage could not be loaded')}</strong>
          <p>${this.error}</p>
          <mm-button variant="secondary" icon="refresh" @click=${() => emit(this, 'mm-retry', {})}>${tr('lineageRetry', 'Try again')}</mm-button>
        </div>
      </div>`;
    }
    if (this.loading || this.#layingOut) {
      // mm-loading applies the 200ms delay and 400ms minimum itself.
      return html`<div class="state"><mm-loading caption=${tr('lineageLoading', 'Drawing lineage')}></mm-loading></div>`;
    }
    if (!this.graph.nodes.length || !this.graph.edges.length) {
      return html`<div class="state">
        <mm-empty-state
          heading=${tr('lineageEmptyTitle', 'No lineage yet')}
          description=${tr('lineageEmpty', 'Pipelines that declare inputs and outputs will draw it here.')}
          compact
        ></mm-empty-state>
      </div>`;
    }
    return nothing;
  }

  #help(): string {
    const right = this.#rtl ? tr('lineageKeyLeft', 'Left') : tr('lineageKeyRight', 'Right');
    const left = this.#rtl ? tr('lineageKeyRight', 'Right') : tr('lineageKeyLeft', 'Left');
    return tr(
      'lineageHelp',
      '{right} arrow moves downstream and {left} arrow upstream. Up and Down move within a column. Enter opens, Space selects, E steps through edges, plus and minus zoom, 0 fits the graph, F returns to the current asset.',
      { right, left },
    );
  }

  override render() {
    const l = this.#layout;
    const view = this.#view;
    const current = this.graph.nodes.find((n) => n.id === this.graph.currentId);
    const label = this.label || (current ? tr('lineageOf', 'Lineage of {name}', { name: current.name }) : tr('lineage', 'Lineage'));
    const ready = !!(l && view && !this.error && !this.loading && this.graph.edges.length);

    let nodes: ViewNode[] = [];
    let edges: ViewEdge[] = [];
    let lodNodes: ViewNode[] = [];
    if (ready) {
      const f = this.#focus;
      const pinned = f && f.kind !== 'edge' ? this.#byId.get(f.id) : undefined;
      if (this.#lod) {
        lodNodes = this.#visibleNodes;
        nodes = pinned ? [pinned] : [];
      } else {
        nodes = pinned && !this.#visibleNodes.includes(pinned) ? [...this.#visibleNodes, pinned] : this.#visibleNodes;
      }
      edges = this.#visibleEdges;
      const fe = f?.kind === 'edge' ? this.#edgeById.get(f.id) : undefined;
      if (fe && !edges.includes(fe)) edges = [...edges, fe];
    }
    const chipIds = new Set<string>();
    if (ready && !this.#lod) {
      if (this.showEdgeLabels) edges.forEach((e) => chipIds.add(e.id));
      if (this.#hoverEdge) chipIds.add(this.#hoverEdge);
      if (this.#focus?.kind === 'edge') chipIds.add(this.#focus.id);
    }

    return html`
      ${this.#renderToolbar()}
      <div class="stage">
        <div
          class="viewport"
          part="viewport"
          role="application"
          aria-roledescription=${tr('lineageGraphRole', 'lineage graph')}
          aria-label=${label}
          aria-describedby="help"
          aria-activedescendant=${(ready && this.#domId(this.#focus)) || nothing}
          tabindex=${ready ? 0 : -1}
          @keydown=${this.#onKeydown}
          @focus=${this.#onViewportFocus}
        >
          <div class="layer" @click=${this.#onLayerClick} @pointerover=${this.#onPointerOver}>
            ${ready
              ? html`<svg class="edges ${this.#lod ? 'lod' : ''}" width=${l!.width} height=${l!.height}>
                    <defs>
                      <marker id="ah-declared" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                        <path class="head-declared" d="M0,0 L8,4 L0,8 Z"></path>
                      </marker>
                      <marker id="ah-observed" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                        <path class="head-observed" d="M0,0 L8,4 L0,8 Z"></path>
                      </marker>
                      <marker id="ah-cycle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
                        <path class="head-cycle" d="M0,0 L8,4 L0,8 Z"></path>
                      </marker>
                    </defs>
                    ${repeat(edges, (e) => e.id, (e) => this.#renderEdge(e))}
                    ${repeat(lodNodes, (n) => n.id, (n) => this.#renderLodNode(n))}
                  </svg>
                  ${repeat(nodes, (n) => n.id, (n) => this.#renderNode(n))}
                  ${repeat(
                    [...chipIds].map((id) => this.#edgeById.get(id)!).filter(Boolean),
                    (e) => e.id,
                    (e) => {
                      const g = l!.edges[e.id]!;
                      const del = this.editable && e.origin !== 'cycle' && !e.source.startsWith('agents:') && !e.target.startsWith('agents:');
                      const full = this.#hoverEdge === e.id || (this.#focus?.kind === 'edge' && this.#focus.id === e.id);
                      return html`<span class="chip ${del ? 'editable' : ''} ${full ? 'full' : ''}" style="left:${g.lx}px;top:${g.ly}px;max-inline-size:${full ? 'none' : `${this.#chipMax}px`}" data-edge=${e.id} aria-hidden=${del ? nothing : 'true'}
                        ><span class="ct">${this.#chipText(e)}</span>${del
                          ? html`<button class="del" type="button" tabindex="-1" data-del=${e.id} aria-label=${tr('lineageDeleteEdge', 'Delete edge')}>
                              <mm-icon name="close" size="14"></mm-icon>
                            </button>`
                          : nothing}</span
                      >`;
                    },
                  )}`
              : nothing}
          </div>
        </div>
        ${this.#renderOverlay()}
        ${ready
          ? html`<div class="tools" part="zoom-controls" role="group" aria-label=${tr('lineageZoom', 'Zoom')}>
                <mm-button variant="ghost" size="sm" icon="zoom-out" label=${tr('zoomOut', 'Zoom out')} @click=${() => this.zoomOut()}></mm-button>
                <span class="zoom-val" aria-hidden="true"></span>
                <mm-button variant="ghost" size="sm" icon="zoom-in" label=${tr('zoomIn', 'Zoom in')} @click=${() => this.zoomIn()}></mm-button>
                <mm-button variant="ghost" size="sm" icon="fit-screen" label=${tr('fitView', 'Fit to view')} @click=${() => this.fit()}></mm-button>
                ${this.graph.currentId
                  ? html`<mm-button
                      variant="ghost"
                      size="sm"
                      icon="center-focus-strong"
                      label=${tr('lineageShowCurrent', 'Show current asset')}
                      @click=${() => {
                        this.#userMoved = true;
                        if (this.graph.currentId) this.#centreOn(this.graph.currentId);
                      }}
                    ></mm-button>`
                  : nothing}
                ${this.hideMinimap
                  ? nothing
                  : html`<mm-button
                      variant="ghost"
                      size="sm"
                      icon="layers"
                      label=${this.#minimapShown ? tr('lineageHideMinimap', 'Hide minimap') : tr('lineageShowMinimap', 'Show minimap')}
                      pressed=${this.#minimapShown ? 'true' : 'false'}
                      @click=${() => {
                        this.#minimapOpen = !this.#minimapShown;
                        this.requestUpdate();
                      }}
                    ></mm-button>`}
              </div>
              ${!this.#minimapShown
                ? nothing
                : html`<div
                    class="minimap"
                    part="minimap"
                    tabindex="0"
                    role="application"
                    aria-roledescription=${tr('lineageMinimapRole', 'minimap')}
                    aria-label=${tr('lineageMinimap', 'Minimap. Arrow keys move the view, plus and minus zoom, 0 fits.')}
                    @pointerdown=${this.#onMinimapDown}
                    @pointermove=${this.#onMinimapMove}
                    @pointerup=${this.#onMinimapUp}
                    @pointercancel=${this.#onMinimapUp}
                    @keydown=${this.#onMinimapKey}
                  >
                    ${guard([l, view], () => this.#renderMinimap())}
                  </div>`}
              ${this.hideLegend ? nothing : html`<div class="legend"><slot name="legend"><mm-lineage-legend compact></mm-lineage-legend></slot></div>`}`
          : nothing}
        <p id="help" class="visually-hidden">${this.#help()}</p>
        <div class="visually-hidden" role="status">${this.#announce}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-lineage-canvas': MmLineageCanvas;
  }
}
