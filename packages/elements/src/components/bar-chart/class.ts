import { css, nothing, svg, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { scaleBand, scaleLinear } from 'd3-scale';
import { tr } from '../../core/strings.js';
import { MmChartBase, type ChartPoint, type ChartTable } from '../chart-core/class.js';
import { clip, fmtNum, monoWidth } from '../chart-core/format.js';
import { gridValues, gridlines, rangeY, spreadLabels } from '../chart-core/svg.js';

export interface BarDatum {
  /** Category label, e.g. "postgres-shop" or "Mon". */
  label: string;
  /** The bar's value. Ignored when `values` is given for a stacked chart. */
  value?: number;
  /** Stacked values, one per name in `stack`, at most three. */
  values?: number[];
  /** Estimated or stale: the bar is hatched. */
  estimated?: boolean;
}

const SEG = ['ctx-bar-2', 'ctx-bar', 'key-bar'] as const;

/**
 * Bar charts compare categories. Bars are grey with square tops; one bar can be highlighted in
 * the key colour (`highlight`), the only colour on the chart. Values are printed directly at the
 * bar ends in 13px mono; when bars are too narrow for every label, only the highlighted and
 * largest bars are labelled and a range-frame axis appears instead. Estimated or stale bars are
 * hatched, never recoloured.
 *
 * `orientation="horizontal"` is the ranked-list form (failed runs per pipeline, queries per
 * agent), with the category names in a column and `sort="desc"` to rank them. Stacked bars take
 * `stack` (at most three names) and `values` per bar: the first two segments are greys and the
 * third is the key colour, labelled directly beside the last bar instead of in a legend.
 *
 * Keyboard: Tab to the chart, then the arrow keys move between bars and show the tooltip; Home and
 * End jump to the ends; Escape hides the tooltip.
 *
 * @tagname mm-bar-chart
 * @summary Grey bars with one highlighted, direct value labels, vertical or ranked horizontal.
 * @csspart frame - The focusable plot region.
 * @csspart plot - The SVG drawing.
 * @csspart message - The empty or error sentence.
 * @cssprop --mm-chart-key - Colour of the highlighted bar or key segment.
 */
export class MmBarChart extends MmChartBase {
  static override styles = [
    ...MmChartBase.styles,
    css`
      .seg {
        stroke: var(--mm-surface);
        stroke-width: 1;
      }
      .base {
        stroke: var(--mm-text-3);
        stroke-width: 1;
        shape-rendering: crispEdges;
      }
    `,
  ];

  /** The bars, in order. */
  @property({ type: Array }) accessor data: BarDatum[] = [];
  /** `vertical` (default) or `horizontal`, the ranked-list form. */
  @property({ reflect: true }) accessor orientation: 'vertical' | 'horizontal' = 'vertical';
  /** Label of the one bar drawn in the key colour. */
  @property() accessor highlight = '';
  /** Names of stacked segments, at most three: two greys, then the key colour. */
  @property({ type: Array }) accessor stack: string[] = [];
  /** Unit after each value, after a non-breaking space. */
  @property() accessor unit = '';
  /** `none` keeps the given order; `desc` or `asc` ranks the bars. */
  @property() accessor sort: 'none' | 'desc' | 'asc' = 'none';
  /** Heading for the categories in the tooltip and table. */
  @property({ attribute: 'category-label' }) accessor categoryLabel = '';
  /** Heading for the values in the tooltip and table. */
  @property({ attribute: 'value-label' }) accessor valueLabel = '';

  get #stacked(): boolean {
    return (this.stack?.length ?? 0) > 0;
  }
  #total(d: BarDatum): number {
    return this.#stacked ? (d.values ?? []).slice(0, 3).reduce((a, b) => a + (b || 0), 0) : (d.value ?? 0);
  }
  #rows(): BarDatum[] {
    const rows = [...(this.data ?? [])];
    if (this.sort === 'desc') rows.sort((a, b) => this.#total(b) - this.#total(a));
    if (this.sort === 'asc') rows.sort((a, b) => this.#total(a) - this.#total(b));
    return rows;
  }
  get #catHeading() {
    return this.categoryLabel || tr('chartCategory', 'Category');
  }
  get #valHeading() {
    return this.valueLabel || this.label || tr('chartValue', 'Value');
  }

  protected override plotHeight(): number {
    if (this.orientation !== 'horizontal') return this.height;
    return (this.#stacked ? 22 : 6) + Math.max(1, this.data?.length ?? 0) * 26;
  }

  protected override isEmpty(): boolean {
    return !(this.data ?? []).length;
  }

  protected override describe(): string {
    const rows = this.#rows();
    const lead = this.label || this.#valHeading;
    if (rows.length === 1) return `${lead}: ${rows[0]!.label} ${fmtNum(this.#total(rows[0]!), this.unit)}.`;
    let hi = rows[0]!;
    let lo = rows[0]!;
    rows.forEach((r) => {
      if (this.#total(r) > this.#total(hi)) hi = r;
      if (this.#total(r) < this.#total(lo)) lo = r;
    });
    let s = tr('barSummary', '{label} across {n} categories, highest {hi} at {hiV}, lowest {lo} at {loV}', {
      label: lead,
      n: rows.length,
      hi: hi.label,
      hiV: fmtNum(this.#total(hi), this.unit),
      lo: lo.label,
      loV: fmtNum(this.#total(lo), this.unit),
    });
    const h = rows.find((r) => r.label === this.highlight);
    if (h && !this.#stacked) s += `, ${tr('chartHighlighted', 'highlighted {name} at {value}', { name: h.label, value: fmtNum(this.#total(h), this.unit) })}`;
    if (this.#stacked) s += `, ${tr('barStacked', 'stacked by {names}', { names: this.stack.join(', ') })}`;
    return `${s}.`;
  }

  protected override dataTable(): ChartTable {
    const rows = this.#rows();
    const est = ` ${tr('chartEstimatedParen', '(estimated)')}`;
    return {
      caption: this.label || this.#valHeading,
      head: this.#stacked ? [this.#catHeading, ...this.stack.slice(0, 3), tr('chartTotal', 'Total')] : [this.#catHeading, this.#valHeading],
      rows: rows.map((r) => [
        `${r.label}${r.estimated ? est : ''}`,
        ...(this.#stacked ? this.stack.slice(0, 3).map((_, i) => fmtNum(r.values?.[i] ?? 0, this.unit)) : []),
        fmtNum(this.#total(r), this.unit),
      ]),
    };
  }

  #point(r: BarDatum, x: number, y: number): ChartPoint {
    const items = [
      { label: this.#catHeading.toLowerCase(), value: r.label },
      ...(this.#stacked ? this.stack.slice(0, 3).map((n, i) => ({ label: n, value: fmtNum(r.values?.[i] ?? 0, this.unit) })) : []),
      { label: this.#stacked ? tr('chartTotal', 'Total').toLowerCase() : this.#valHeading.toLowerCase(), value: fmtNum(this.#total(r), this.unit) },
      ...(r.estimated ? [{ label: tr('chartStatus', 'status'), value: tr('chartEstimated', 'Estimated') }] : []),
    ];
    const text = `${r.label}: ${items.slice(1).map((i) => `${i.label} ${i.value}`).join(', ')}`;
    return { x, y, items, text };
  }

  protected override hitTest(x: number, y: number): number {
    if (this.orientation !== 'horizontal') return super.hitTest(x, y);
    let best = -1;
    let dist = Infinity;
    this.pointList.forEach((p, i) => {
      const d = Math.abs(p.y - y);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  protected override moveKey(e: KeyboardEvent, current: number): number | null {
    const map: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
    const key = map[e.key];
    if (key) return super.moveKey(new KeyboardEvent('keydown', { key }), current);
    return super.moveKey(e, current);
  }

  protected override renderMarker(p: ChartPoint): SVGTemplateResult {
    if (this.orientation === 'horizontal') {
      return svg`<g class="focus"><line class="cursor" x1=${this.box.left} x2=${this.box.right} y1=${p.y + 10} y2=${p.y + 10}></line>
        <circle class="marker" cx=${p.x} cy=${p.y} r="3"></circle></g>`;
    }
    return svg`<g class="focus"><circle class="marker" cx=${p.x} cy=${p.y} r="3"></circle></g>`;
  }

  #segments(r: BarDatum, at: (v: number) => number, rect: (a: number, b: number, cls: string, i: number) => SVGTemplateResult) {
    let acc = 0;
    return (r.values ?? []).slice(0, 3).map((v, i) => {
      const a = at(acc);
      acc += v || 0;
      const n = Math.min(3, this.stack.length);
      const cls = n === 3 ? SEG[i]! : i === n - 1 && n === 1 ? 'key-bar' : SEG[i]!;
      return rect(a, at(acc), cls, i);
    });
  }

  protected override renderPlot(): SVGTemplateResult {
    return this.orientation === 'horizontal' ? this.#horizontal() : this.#vertical();
  }

  #vertical(): SVGTemplateResult {
    const w = this.w;
    const h = this.plotHeight();
    const rows = this.#rows();
    const totals = rows.map((r) => this.#total(r));
    const min = Math.min(0, ...totals);
    const max = Math.max(0, ...totals);
    const vals = totals.map((v) => fmtNum(v, this.unit));
    const longestVal = Math.max(...vals.map((v) => monoWidth(v)));
    const stackNames = this.stack.slice(0, 3);
    const mr = this.#stacked ? Math.max(...stackNames.map((s) => monoWidth(s))) + 14 : 4;
    // First pass decides whether every bar can carry its value; if not, a range-frame axis appears.
    const probe = scaleBand<number>().domain(rows.map((_, i) => i)).range([8, w - mr]).paddingInner(0.25).paddingOuter(0.1);
    const labelAll = probe.bandwidth() >= longestVal + 2;
    const axisW = labelAll ? 0 : Math.max(monoWidth(fmtNum(min, this.unit)), monoWidth(fmtNum(max, this.unit))) + 18;
    const left = Math.max(8, axisW);
    const right = Math.max(left + 1, w - mr);
    const top = 20;
    const bottom = h - 24;
    this.box = { left, right, top, bottom };
    const X = scaleBand<number>().domain(rows.map((_, i) => i)).range([left, right]).paddingInner(0.25).paddingOuter(0.1);
    const lo = min;
    const hi = max === min ? min + 1 : max;
    const Y = scaleLinear().domain([lo, hi]).range([bottom, top]);
    const bw = X.bandwidth();
    const hiI = totals.indexOf(Math.max(...totals));
    const loI = totals.indexOf(Math.min(...totals));
    const catW = Math.max(...rows.map((r) => monoWidth(r.label)));
    const catAll = X.step() >= catW + 6;
    const hl = this.#stacked ? -1 : rows.findIndex((r) => r.label === this.highlight);
    const grid = gridValues(Y.ticks(4), lo, hi).filter((v) => v !== 0).map((v) => Y(v));

    this.pointList = rows.map((r, i) => {
      const v = totals[i]!;
      return this.#point(r, X(i)! + bw / 2, v >= 0 ? Y(v) : Y(v));
    });

    const last = rows.length - 1;
    const segLabelYs = this.#stacked
      ? (() => {
          let acc = 0;
          const mids = stackNames.map((_, i) => {
            const v = rows[last]?.values?.[i] ?? 0;
            const mid = Y(acc + v / 2);
            acc += v;
            return mid;
          });
          return spreadLabels(mids, 13, top, bottom);
        })()
      : [];

    return svg`
      ${gridlines(grid, left, right)}
      ${labelAll ? nothing : rangeY(left - 8, { at: Y(max), label: fmtNum(max, this.unit) }, { at: Y(min), label: fmtNum(min, this.unit) })}
      ${rows.map((r, i) => {
        const x = X(i)!;
        const v = totals[i]!;
        const cls = i === hl ? 'key-bar' : 'ctx-bar';
        const bar = this.#stacked
          ? this.#segments(r, Y, (a, b, c) => svg`<rect class="seg ${c}" x=${x} y=${Math.min(a, b)} width=${bw} height=${Math.abs(a - b)}></rect>`)
          : svg`<rect class=${cls} x=${x} y=${Math.min(Y(0), Y(v))} width=${bw} height=${Math.abs(Y(v) - Y(0))}></rect>`;
        const hatch = r.estimated
          ? svg`<rect class="hatch" fill="url(#${this.hatchId})" x=${x} y=${Math.min(Y(0), Y(v))} width=${bw} height=${Math.abs(Y(v) - Y(0))}></rect>`
          : nothing;
        const showVal = labelAll || i === hl || i === hiI || i === loI;
        const vy = v >= 0 ? Y(v) - 5 : Y(v) + 13;
        const showCat = catAll || i === 0 || i === last || i === hl;
        return svg`${bar}${hatch}
          ${showVal ? svg`<text class=${i === hl ? 'strong' : ''} x=${x + bw / 2} y=${vy} text-anchor="middle">${vals[i]}</text>` : nothing}
          ${showCat ? svg`<text x=${x + bw / 2} y=${bottom + 16} text-anchor="middle">${clip(r.label, Math.max(X.step(), 40))}</text>` : nothing}`;
      })}
      <line class="base" x1=${left} x2=${right} y1=${Y(0)} y2=${Y(0)}></line>
      ${stackNames.map((n, i) => svg`<text class=${SEG[i] === 'key-bar' && stackNames.length === 3 ? 'key-label' : ''} x=${right + 8} y=${segLabelYs[i]! + 4}>${n}</text>`)}
    `;
  }

  #horizontal(): SVGTemplateResult {
    const w = this.w;
    const rows = this.#rows();
    const totals = rows.map((r) => this.#total(r));
    const min = Math.min(0, ...totals);
    const max = Math.max(0, ...totals);
    const vals = totals.map((v) => fmtNum(v, this.unit));
    const labelW = Math.min(w * 0.4, Math.max(...rows.map((r) => monoWidth(r.label))));
    const valW = Math.max(...vals.map((v) => monoWidth(v)));
    const top = this.#stacked ? 22 : 6;
    const rowH = 26;
    const left = labelW + 12;
    const negW = min < 0 ? valW + 8 : 0;
    const right = Math.max(left + 40, w - valW - 10);
    this.box = { left, right, top, bottom: top + rows.length * rowH };
    const X = scaleLinear().domain([min, max === min ? min + 1 : max]).range([left + negW, right]);
    const hl = this.#stacked ? -1 : rows.findIndex((r) => r.label === this.highlight);
    const barH = 14;
    const stackNames = this.stack.slice(0, 3);

    this.pointList = rows.map((r, i) => this.#point(r, X(totals[i]!), top + i * rowH + rowH / 2));

    const first = rows[0];
    let acc = 0;
    const segMids = stackNames.map((_, i) => {
      const v = first?.values?.[i] ?? 0;
      const a = X(acc);
      acc += v;
      return (a + X(acc)) / 2;
    });

    return svg`
      ${stackNames.map((n, i) => svg`<text class=${SEG[i] === 'key-bar' && stackNames.length === 3 ? 'key-label' : ''} x=${segMids[i]} y="11" text-anchor="middle">${n}</text>`)}
      ${rows.map((r, i) => {
        const cy = top + i * rowH + rowH / 2;
        const y = cy - barH / 2;
        const v = totals[i]!;
        const x0 = X(0);
        const x1 = X(v);
        const cls = i === hl ? 'key-bar' : 'ctx-bar';
        const bar = this.#stacked
          ? this.#segments(r, X, (a, b, c) => svg`<rect class="seg ${c}" x=${Math.min(a, b)} y=${y} width=${Math.abs(b - a)} height=${barH}></rect>`)
          : svg`<rect class=${cls} x=${Math.min(x0, x1)} y=${y} width=${Math.abs(x1 - x0)} height=${barH}></rect>`;
        const hatch = r.estimated
          ? svg`<rect class="hatch" fill="url(#${this.hatchId})" x=${Math.min(x0, x1)} y=${y} width=${Math.abs(x1 - x0)} height=${barH}></rect>`
          : nothing;
        return svg`
          <text class=${i === hl ? 'strong' : ''} x=${labelW} y=${cy + 4} text-anchor="end">${clip(r.label, labelW)}</text>
          ${bar}${hatch}
          <text class=${i === hl ? 'strong' : ''} x=${v >= 0 ? x1 + 6 : x1 - 6} y=${cy + 4} text-anchor=${v >= 0 ? 'start' : 'end'}>${vals[i]}</text>`;
      })}
      <line class="base" x1=${X(0)} x2=${X(0)} y1=${top} y2=${top + rows.length * rowH}></line>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-bar-chart': MmBarChart;
  }
}
