import { css, nothing, svg, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { contours } from 'd3-contour';
import { blur2 } from 'd3-array';
import { tr } from '../../core/strings.js';
import { MmChartBase, type ChartPoint, type ChartTable } from '../chart-core/class.js';
import { fmtNum, monoWidth } from '../chart-core/format.js';
import { leaderTo, rangeX, rangeY, smoothRing } from '../chart-core/svg.js';

export interface ContourMark {
  /** Column index in grid mode, or an x value in point mode. */
  x: number;
  /** Row index in grid mode, or a y value in point mode. */
  y: number;
  /** Mono caption on a leader line, e.g. "orders_daily". */
  label: string;
}

export interface DensityPoint {
  x: number;
  y: number;
  weight?: number;
}

interface Ring {
  d: string;
  level: number;
  index: boolean;
  /** Lowest point, where the index contour's value is printed. */
  low: [number, number];
  len: number;
  /** Sampled points in drawing coordinates, for keeping labels off the lines. */
  pts: [number, number][];
}

type Box = [number, number, number, number];

/**
 * The contour chart is Marmot's signature density view: query heat by hour and weekday, lineage
 * density or usage, drawn as isolines in `mm-contour` like a survey sheet. There are 4 to 6
 * bands; the heaviest is an index contour in `mm-contour-index`, labelled with its value the way a
 * map labels its index contours, so no legend is needed. Labelled points (`marks`) are annotated
 * with a leader line and a mono caption.
 *
 * Give it either a `grid` of values (rows by columns, such as 7 weekdays by 24 hours, with
 * `x-labels` and `y-labels` for the range-frame axes) or `points` to estimate a density over
 * `x-domain` and `y-domain`.
 *
 * Use it for summaries on Insights and reports. The contour motif is decoration elsewhere, and it
 * must never sit behind working data such as tables or forms.
 *
 * Keyboard: Tab to the chart. In grid mode the arrow keys move a cross-hair between cells
 * (Left and Right through the columns, Up and Down through the rows) and show the tooltip; in
 * point mode Left and Right move between the marks. Home and End jump to the ends, and Escape
 * hides the tooltip.
 *
 * @tagname mm-contour-chart
 * @summary Isoline density view in contour colours with an index contour.
 * @csspart frame - The focusable plot region.
 * @csspart plot - The SVG drawing.
 * @csspart message - The empty or error sentence.
 */
export class MmContourChart extends MmChartBase {
  static override styles = [
    ...MmChartBase.styles,
    css`
      .iso {
        fill: none;
        stroke: var(--mm-contour);
        stroke-width: 1;
        stroke-linejoin: round;
      }
      .iso.index {
        stroke: var(--mm-contour-index);
        stroke-width: 1.75;
      }
      svg.plot text.iso-label {
        fill: var(--mm-contour-index);
        font-weight: 600;
      }
      .mark {
        fill: var(--mm-text);
      }
    `,
  ];

  /** Values by row then column, e.g. 7 weekdays × 24 hours of query counts. */
  @property({ type: Array }) accessor grid: number[][] = [];
  /** Points to estimate a density from, when there is no `grid`. */
  @property({ type: Array }) accessor points: DensityPoint[] = [];
  /** `[min, max]` of x for `points`. Defaults to the data extent. */
  @property({ type: Array, attribute: 'x-domain' }) accessor xDomain: [number, number] | null = null;
  /** `[min, max]` of y for `points`. Defaults to the data extent. */
  @property({ type: Array, attribute: 'y-domain' }) accessor yDomain: [number, number] | null = null;
  /** Column labels in grid mode, e.g. "00:00" to "23:00". The ends label the x axis. */
  @property({ type: Array, attribute: 'x-labels' }) accessor xLabels: string[] = [];
  /** Row labels in grid mode, e.g. "Mon" to "Sun". The ends label the y axis. */
  @property({ type: Array, attribute: 'y-labels' }) accessor yLabels: string[] = [];
  /** Name of the x dimension, e.g. "Hour (UTC)". */
  @property({ attribute: 'x-name' }) accessor xName = '';
  /** Name of the y dimension, e.g. "Day". */
  @property({ attribute: 'y-name' }) accessor yName = '';
  /** Number of contour bands, 4 to 6. */
  @property({ type: Number }) accessor bands = 5;
  /** Unit after values, e.g. "queries". */
  @property() accessor unit = '';
  /** Labelled points, annotated with leader lines. */
  @property({ type: Array }) accessor marks: ContourMark[] = [];
  /** Smoothing radius in grid cells. */
  @property({ type: Number }) accessor smoothing = 0.6;

  get #gridMode(): boolean {
    return (this.grid?.length ?? 0) > 0;
  }
  get #rows(): number {
    return this.grid.length;
  }
  get #cols(): number {
    return Math.max(0, ...this.grid.map((r) => r.length));
  }
  #cell(r: number, c: number): number {
    const v = this.grid[r]?.[c];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  #xl(c: number) {
    return this.xLabels[c] ?? String(c);
  }
  #yl(r: number) {
    return this.yLabels[r] ?? String(r);
  }

  protected override isEmpty(): boolean {
    if (this.#gridMode) return !this.grid.some((r) => r.some((v) => v > 0));
    return !(this.points ?? []).length;
  }

  #extent(): { min: number; max: number; maxAt: [number, number]; minAt: [number, number] } {
    let min = Infinity;
    let max = -Infinity;
    let maxAt: [number, number] = [0, 0];
    let minAt: [number, number] = [0, 0];
    for (let r = 0; r < this.#rows; r++)
      for (let c = 0; c < this.#cols; c++) {
        const v = this.#cell(r, c);
        if (v > max) [max, maxAt] = [v, [r, c]];
        if (v < min) [min, minAt] = [v, [r, c]];
      }
    return { min, max, maxAt, minAt };
  }

  #domains(): { xd: [number, number]; yd: [number, number] } {
    const pts = this.points ?? [];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xd = this.xDomain ?? [Math.min(...xs), Math.max(...xs)];
    const yd = this.yDomain ?? [Math.min(...ys), Math.max(...ys)];
    if (xd[0] === xd[1]) xd[1] = xd[0] + 1;
    if (yd[0] === yd[1]) yd[1] = yd[0] + 1;
    return { xd, yd };
  }

  /** Values on a coarse matrix: the grid itself, or points binned over their domains. */
  #matrix(): { C: number; R: number; at: (r: number, c: number) => number } {
    if (this.#gridMode) return { C: this.#cols, R: this.#rows, at: (r, c) => this.#cell(r, c) };
    const C = 40;
    const R = 24;
    const { xd, yd } = this.#domains();
    const m = new Float64Array(C * R);
    for (const p of this.points) {
      const c = Math.min(C - 1, Math.max(0, Math.floor(((p.x - xd[0]) / (xd[1] - xd[0])) * C)));
      // Rows run top to bottom, so higher y values sit higher on the drawing.
      const r = Math.min(R - 1, Math.max(0, Math.floor(((yd[1] - p.y) / (yd[1] - yd[0])) * R)));
      m[r * C + c]! += p.weight ?? 1;
    }
    const blurred = blur2({ data: m, width: C, height: R }, 1.5);
    return { C, R, at: (r, c) => blurred.data[r * C + c] as number };
  }

  #layout() {
    const w = this.w;
    const h = this.plotHeight();
    const { C, R } = this.#matrix();
    let yLabelW: number;
    if (this.#gridMode) yLabelW = Math.max(monoWidth(this.#yl(0)), monoWidth(this.#yl(R - 1)));
    else {
      const { yd } = this.#domains();
      yLabelW = Math.max(monoWidth(fmtNum(yd[0])), monoWidth(fmtNum(yd[1])));
    }
    // Isolines may close up to a cell outside the data, so leave that much room inside the margins.
    const l0 = Math.ceil(yLabelW) + 18;
    const r0 = w - 12;
    const t0 = 14;
    const b0 = h - 28;
    const hx = this.#gridMode ? (r0 - l0) / (C + 2) : 0;
    const hy = this.#gridMode ? (b0 - t0) / (R + 2) : 0;
    const left = l0 + hx;
    const right = r0 - hx;
    const top = t0 + hy;
    const bottom = b0 - hy;
    const cw = (right - left) / C;
    const ch = (bottom - top) / R;
    return { left, right, top, bottom, C, R, cw, ch };
  }

  #rings(): { rings: Ring[]; thresholds: number[] } {
    const { C, R, at } = this.#matrix();
    const { left, top, cw, ch } = this.#layout();
    const k = this.#gridMode ? 8 : 4;
    const pad = this.#gridMode ? k : 0;
    const gw = C * k + pad * 2;
    const gh = R * k + pad * 2;
    // Bilinear upsampling between cell centres, then a gentle blur so isolines read as drawn.
    const fine = new Float64Array(gw * gh);
    let max = 0;
    for (let j = 0; j < R * k; j++) {
      const v = Math.min(R - 1, Math.max(0, (j + 0.5) / k - 0.5));
      const r0 = Math.floor(v);
      const r1 = Math.min(R - 1, r0 + 1);
      const fv = v - r0;
      for (let i = 0; i < C * k; i++) {
        const u = Math.min(C - 1, Math.max(0, (i + 0.5) / k - 0.5));
        const c0 = Math.floor(u);
        const c1 = Math.min(C - 1, c0 + 1);
        const fu = u - c0;
        const z = (1 - fv) * ((1 - fu) * at(r0, c0) + fu * at(r0, c1)) + fv * ((1 - fu) * at(r1, c0) + fu * at(r1, c1));
        fine[(j + pad) * gw + i + pad] = z;
      }
    }
    blur2({ data: fine, width: gw, height: gh }, Math.max(1, this.smoothing * k));
    for (const v of fine) if (v > max) max = v;
    const B = Math.max(4, Math.min(6, Math.round(this.bands)));
    const raw = Array.from({ length: B }, (_, i) => (max * (i + 1)) / (B + 1));
    const thresholds = raw.map((t) => niceRound(t));
    const sx = cw / k;
    const sy = ch / k;
    const ox = left - pad * sx;
    const oy = top - pad * sy;
    const rings: Ring[] = [];
    contours()
      .size([gw, gh])
      .thresholds(thresholds)(Array.from(fine))
      .forEach((mp, li) => {
        const level = li + 1;
        for (const poly of mp.coordinates)
          for (const ring of poly) {
            const d = smoothRing(ring, sx, sy, ox, oy);
            if (!d) continue;
            let lowPt = ring[0]!;
            for (const p of ring) if (p[1]! > lowPt[1]!) lowPt = p;
            rings.push({ d, level, index: level === B || level % 5 === 0, low: [ox + lowPt[0]! * sx, oy + lowPt[1]! * sy], len: ring.length, pts: ring.map((p) => [ox + p[0]! * sx, oy + p[1]! * sy] as [number, number]) });
          }
      });
    return { rings, thresholds };
  }

  protected override describe(): string {
    const lead = this.label || tr('contourDensity', 'Density');
    if (this.#gridMode) {
      const { min, max, maxAt, minAt } = this.#extent();
      return `${tr('contourSummary', '{label}: highest {max} on {maxRow} at {maxCol}, lowest {min} on {minRow} at {minCol}', {
        label: lead,
        max: fmtNum(max, this.unit),
        maxRow: this.#yl(maxAt[0]),
        maxCol: this.#xl(maxAt[1]),
        min: fmtNum(min, this.unit),
        minRow: this.#yl(minAt[0]),
        minCol: this.#xl(minAt[1]),
      })}.`;
    }
    const marks = this.marks.map((m) => m.label).join(', ');
    return `${tr('contourPointsSummary', '{label}: density of {n} points', { label: lead, n: fmtNum(this.points.length) })}${marks ? `, ${tr('contourMarked', 'marked {names}', { names: marks })}` : ''}.`;
  }

  protected override dataTable(): ChartTable {
    if (this.#gridMode) {
      return {
        caption: this.label,
        head: [this.yName || tr('chartRow', 'Row'), ...Array.from({ length: this.#cols }, (_, c) => this.#xl(c))],
        rows: this.grid.map((row, r) => [this.#yl(r), ...Array.from({ length: this.#cols }, (_, c) => fmtNum(this.#cell(r, c)))]),
      };
    }
    return {
      caption: `${this.label} (${fmtNum(this.points.length)} ${tr('chartPoints', 'points')})`,
      head: [tr('chartMark', 'Mark'), this.xName || 'x', this.yName || 'y'],
      rows: this.marks.map((m) => [m.label, fmtNum(m.x), fmtNum(m.y)]),
    };
  }

  protected override hitTest(x: number, y: number): number {
    let best = -1;
    let dist = Infinity;
    this.pointList.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  protected override moveKey(e: KeyboardEvent, current: number): number | null {
    if (!this.#gridMode) return super.moveKey(e, current);
    const C = this.#cols;
    const R = this.#rows;
    const r = current < 0 ? 0 : Math.floor(current / C);
    const c = current < 0 ? -1 : current % C;
    switch (e.key) {
      case 'ArrowRight':
        return r * C + Math.min(C - 1, c + 1);
      case 'ArrowLeft':
        return current < 0 ? C - 1 : r * C + Math.max(0, c - 1);
      case 'ArrowDown':
        return current < 0 ? 0 : Math.min(R - 1, r + 1) * C + c;
      case 'ArrowUp':
        return current < 0 ? 0 : Math.max(0, r - 1) * C + c;
      case 'Home':
        return r * C;
      case 'End':
        return r * C + C - 1;
    }
    return null;
  }

  protected override renderMarker(p: ChartPoint): SVGTemplateResult {
    const b = this.box;
    return svg`<g class="focus">
      <line class="cursor" x1=${p.x} x2=${p.x} y1=${b.top} y2=${b.bottom}></line>
      <line class="cursor" x1=${b.left} x2=${b.right} y1=${p.y} y2=${p.y}></line>
      <circle class="marker" cx=${p.x} cy=${p.y} r="4"></circle>
    </g>`;
  }

  protected override renderPlot(): SVGTemplateResult {
    const L = this.#layout();
    const { left, right, top, bottom, C, R, cw, ch } = L;
    this.box = { left, right, top, bottom };
    const { rings, thresholds } = this.#rings();
    const B = thresholds.length;
    const cx = (c: number) => left + (c + 0.5) * cw;
    const cy = (r: number) => top + (r + 0.5) * ch;
    let mx: (v: number) => number;
    let my: (v: number) => number;
    let axes: SVGTemplateResult;

    if (this.#gridMode) {
      mx = cx;
      my = cy;
      this.pointList = [];
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          const v = this.#cell(r, c);
          this.pointList.push({
            x: cx(c),
            y: cy(r),
            items: [
              { label: (this.yName || tr('chartRow', 'Row')).toLowerCase(), value: this.#yl(r) },
              { label: (this.xName || tr('chartColumn', 'Column')).toLowerCase(), value: this.#xl(c) },
              { label: (this.unit || tr('chartValue', 'Value')).toLowerCase(), value: fmtNum(v) },
            ],
            text: `${this.#yl(r)} ${this.#xl(c)}: ${fmtNum(v, this.unit)}`,
          });
        }
      axes = svg`${rangeY(left - 8, { at: cy(0), label: this.#yl(0) }, { at: cy(R - 1), label: this.#yl(R - 1) })}
        ${rangeX(bottom + 8, { at: cx(0), label: this.#xl(0) }, { at: cx(C - 1), label: this.#xl(C - 1) })}`;
    } else {
      const { xd, yd } = this.#domains();
      mx = (v) => left + ((v - xd[0]) / (xd[1] - xd[0])) * (right - left);
      my = (v) => bottom - ((v - yd[0]) / (yd[1] - yd[0])) * (bottom - top);
      this.pointList = this.marks.map((m) => ({
        x: mx(m.x),
        y: my(m.y),
        items: [
          { label: tr('chartMark', 'Mark').toLowerCase(), value: m.label },
          { label: this.xName || 'x', value: fmtNum(m.x) },
          { label: this.yName || 'y', value: fmtNum(m.y) },
        ],
        text: `${m.label}: ${this.xName || 'x'} ${fmtNum(m.x)}, ${this.yName || 'y'} ${fmtNum(m.y)}`,
      }));
      axes = svg`${rangeY(left - 8, { at: top, label: fmtNum(yd[1]) }, { at: bottom, label: fmtNum(yd[0]) })}
        ${rangeX(bottom + 8, { at: left, label: fmtNum(xd[0]) }, { at: right, label: fmtNum(xd[1]) })}`;
    }

    // Labels never sit on a line: every candidate box is scored by the contour points it covers,
    // with the index band (the densest) weighted so heavily that it is always avoided when possible.
    const bounds = { left: left - 2, right: this.w - 2, top: 2, bottom: bottom + 4 };
    const taken: Box[] = [];
    const cost = (b: Box) => {
      if (b[0] < bounds.left || b[2] > bounds.right || b[1] < bounds.top || b[3] > bounds.bottom) return Infinity;
      let c = 0;
      for (const r of rings) for (const [x, y] of r.pts) if (x >= b[0] - 2 && x <= b[2] + 2 && y >= b[1] - 2 && y <= b[3] + 2) c += r.index ? 50 : 1;
      for (const t of taken) if (!(b[2] + 4 < t[0] || b[0] > t[2] + 4 || b[3] + 2 < t[1] || b[1] > t[3] + 2)) c += 1000;
      return c;
    };
    const markSvg = this.marks.map((m) => {
      const px = mx(m.x);
      const py = my(m.y);
      const w = monoWidth(m.label);
      let best: { c: number; d: number; ex: number; ey: number; anchor: 'start' | 'end'; box: Box } | null = null;
      for (let d = 24; d <= 168; d += 12)
        for (const [ux, uy] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5], [-1, 0], [1, 0], [-0.4, -1], [0.4, -1], [-0.4, 1], [0.4, 1]] as const) {
          const ex = px + ux * d;
          const ey = py + uy * d * 0.6;
          const anchor = ux < 0 ? 'end' : 'start';
          const box: Box = anchor === 'end' ? [ex - 4 - w, ey - 8, ex - 4, ey + 6] : [ex + 4, ey - 8, ex + 4 + w, ey + 6];
          const c = cost(box) + d * 0.05;
          if (!best || c < best.c) best = { c, d, ex, ey, anchor, box };
        }
      if (!best) return nothing;
      taken.push(best.box);
      return leaderTo(px, py, best.ex, best.ey, m.label, best.anchor);
    });

    // Label the index contour once, on its longest ring, at the clearest point just outside it, as
    // a map labels its index contours. Point densities have no meaningful unit, so stay unlabelled.
    const idx = this.#gridMode ? rings.filter((r) => r.level === B).sort((a, b) => b.len - a.len)[0] : undefined;
    let idxLabel: SVGTemplateResult | typeof nothing = nothing;
    if (idx) {
      const text = fmtNum(thresholds[B - 1]!, this.unit);
      const w = monoWidth(text);
      const cxr = idx.pts.reduce((a, p) => a + p[0], 0) / idx.pts.length;
      const cyr = idx.pts.reduce((a, p) => a + p[1], 0) / idx.pts.length;
      let best: { c: number; x: number; y: number } | null = null;
      const step = Math.max(1, Math.floor(idx.pts.length / 24));
      for (let k = 0; k < idx.pts.length; k += step) {
        const [x, y] = idx.pts[k]!;
        const dx = x - cxr;
        const dy = y - cyr;
        const len = Math.hypot(dx, dy) || 1;
        // Centre the label 10px outside the ring, along the line from its centre.
        const lx = x + (dx / len) * (w / 2 + 6);
        const ly = y + (dy / len) * 12;
        const box: Box = [lx - w / 2, ly - 8, lx + w / 2, ly + 4];
        const c = cost(box);
        if (!best || c < best.c) best = { c, x: lx, y: ly + 3 };
      }
      if (best && Number.isFinite(best.c)) idxLabel = svg`<text class="iso-label halo" x=${best.x} y=${best.y} text-anchor="middle">${text}</text>`;
    }
    return svg`
      ${axes}
      ${rings.map((r) => svg`<path class="iso ${r.index ? 'index' : ''}" d=${r.d}></path>`)}
      ${markSvg}
      ${idxLabel}
    `;
  }
}

/** Rounds a threshold to two significant figures so the index contour label reads cleanly. */
function niceRound(v: number): number {
  if (v <= 0) return v;
  const p = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-contour-chart': MmContourChart;
  }
}
