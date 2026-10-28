import { nothing, svg, type SVGTemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { tr } from '../../core/strings.js';
import { MmChartBase, type ChartPoint, type ChartTable } from '../chart-core/class.js';
import { fmtNum, isTimeX, monoWidth, periodPhrase, xFormatter, xLongFormatter, xNum, type XValue } from '../chart-core/format.js';
import { dimensionBracket, gridValues, gridlines, leaderAnnotation, rangeX, rangeY, spreadLabels } from '../chart-core/svg.js';

/** One line. Exactly one series should be the key series; the rest are grey context. */
export interface LineSeries {
  name: string;
  /** One value per x, oldest first. `null` leaves a gap. */
  values: (number | null)[];
  /** The series that matters, drawn in the key colour. Defaults to the first series. */
  key?: boolean;
}

/** A point annotation (leader line with a dot terminal) or a range (a dimension bracket). */
export type ChartAnnotation =
  | { type?: 'point'; at: XValue; caption: string; series?: string }
  | { type: 'range'; from: XValue; to: XValue; caption: string };

type Num = number | null;
const isNum = (v: Num | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Shared drawing for `mm-line-chart` and `mm-area-chart`: a time or number x axis, range-frame
 * axes, at most three dotted gridlines, direct labels at line ends, annotations and a hatched,
 * dashed estimated tail. Not an element on its own.
 */
export abstract class MmLineBase extends MmChartBase {
  /** The x values, oldest first: Dates, ISO strings or numbers. Times are formatted in `time-zone`. */
  @property({ type: Array }) accessor x: XValue[] = [];
  /** Unit after each value, after a non-breaking space, e.g. "ms". */
  @property() accessor unit = '';
  /** How many trailing points are estimated (an incomplete hour or day). They are dashed and hatched. */
  @property({ type: Number }) accessor estimated = 0;
  /** Point annotations and ranges such as an incident window. */
  @property({ type: Array }) accessor annotations: ChartAnnotation[] = [];
  /** Heading for the x values in the tooltip and the data table. */
  @property({ attribute: 'x-label' }) accessor xLabel = '';
  /** IANA time zone for time labels. UTC by default so server and browser agree. */
  @property({ attribute: 'time-zone' }) accessor timeZone = 'UTC';

  protected abstract getSeries(): LineSeries[];
  /** Fill the key series with a flat 10% tint down to zero. */
  protected abstract get filled(): boolean;

  protected keySeries(): LineSeries | undefined {
    const s = this.getSeries();
    return s.find((x) => x.key) ?? s[0];
  }

  protected override isEmpty(): boolean {
    return !this.x.length || !this.getSeries().some((s) => s.values.some(isNum));
  }

  #xHeading(): string {
    return this.xLabel || (isTimeX(this.x) ? tr('chartTime', 'Time') : tr('chartX', 'Value'));
  }

  protected override describe(): string {
    const key = this.keySeries();
    if (!key) return this.label;
    const fx = xFormatter(this.x, this.timeZone);
    const vals = key.values;
    let maxI = -1;
    vals.forEach((v, i) => {
      if (isNum(v) && (maxI < 0 || v > (vals[maxI] as number))) maxI = i;
    });
    const lastI = vals.findLastIndex(isNum);
    const lead = this.label || key.name;
    const ctx = this.getSeries().filter((s) => s !== key).map((s) => s.name);
    const n = this.x.length;
    let s =
      n === 1
        ? tr('chartSummarySingle', '{label}: {value} at {at}', { label: lead, value: fmtNum(vals[0] ?? NaN, this.unit), at: fx(this.x[0]!) })
        : tr('chartSummaryPeak', '{label} over {period}, peaking at {max} at {at}', {
            label: lead,
            period: periodPhrase(this.x),
            max: fmtNum(vals[maxI] as number, this.unit),
            at: fx(this.x[maxI]!),
          });
    if (n > 1 && lastI >= 0 && lastI !== maxI) {
      s += `, ${tr('chartLatest', 'latest {value}', { value: fmtNum(vals[lastI] as number, this.unit) })}`;
      if (this.estimated > 0) s += ` ${tr('chartEstimatedParen', '(estimated)')}`;
    }
    if (ctx.length) s += `, ${tr('chartAgainst', 'shown against {names}', { names: ctx.join(', ') })}`;
    return `${s}.`;
  }

  protected override dataTable(): ChartTable {
    const series = this.getSeries();
    const fl = xLongFormatter(this.x, this.timeZone);
    const firstEst = this.x.length - this.estimated;
    return {
      caption: this.label || this.keySeries()?.name || '',
      head: [this.#xHeading(), ...series.map((s) => s.name)],
      rows: this.x.map((xv, i) => [
        `${fl(xv)}${i >= firstEst ? ` ${tr('chartEstimatedParen', '(estimated)')}` : ''}`,
        ...series.map((s) => (isNum(s.values[i]) ? fmtNum(s.values[i] as number, this.unit) : '')),
      ]),
    };
  }

  protected override renderPlot(): SVGTemplateResult {
    const w = this.w;
    const h = this.plotHeight();
    const series = this.getSeries();
    const key = this.keySeries()!;
    const n = this.x.length;
    const xs = this.x.map(xNum);
    const fx = xFormatter(this.x, this.timeZone);
    const fl = xLongFormatter(this.x, this.timeZone);
    const all = series.flatMap((s) => s.values.filter(isNum));
    let min = Math.min(...all);
    const max = Math.max(...all);
    if (this.filled) min = Math.min(0, min);
    const lo = min === max ? min - 1 : min;
    const hi = min === max ? max + 1 : max;
    const est = Math.max(0, Math.min(n - 1, Math.round(this.estimated)));
    const estFrom = n - 1 - est;

    // Margins from label widths, computed without measuring so the server draws the same.
    const yLabelW = Math.max(monoWidth(fmtNum(min, this.unit)), monoWidth(fmtNum(max, this.unit)));
    const labelFor = (s: LineSeries) => {
      if (s !== key) return s.name;
      const lastI = s.values.findLastIndex(isNum);
      const v = lastI >= 0 ? fmtNum(s.values[lastI] as number, this.unit) : '';
      return `${s.name} ${v}${est > 0 && lastI >= estFrom ? ` ${tr('chartEstShort', 'est.')}` : ''}`;
    };
    const labels = series.map(labelFor);
    const ml = Math.ceil(yLabelW) + 18;
    const mr = Math.min(w * 0.4, Math.ceil(Math.max(...labels.map((l) => monoWidth(l)))) + 14);
    const top = 28;
    const bottom = h - 30;
    const left = ml;
    const right = Math.max(left + 1, w - mr);
    this.box = { left, right, top, bottom };

    const X = n === 1 ? () => (left + right) / 2 : scaleLinear().domain([xs[0]!, xs[n - 1]!]).range([left, right]);
    const Y = scaleLinear().domain([lo, hi]).range([bottom, top]);
    const xi = (i: number) => X(xs[i]!);

    const lineGen = d3line<Num>()
      .defined(isNum)
      .x((_, i) => xi(i))
      .y((v) => Y(v as number));
    const segment = (vals: Num[], from: number, to: number) => {
      const masked = vals.map((v, i) => (i >= from && i <= to ? v : null));
      return lineGen(masked) ?? '';
    };
    const areaGen = (from: number, to: number) =>
      d3area<Num>()
        .defined((v, i) => isNum(v) && i >= from && i <= to)
        .x((_, i) => xi(i))
        .y0(Y(lo))
        .y1((v) => Y(v as number))(key.values) ?? '';

    const grid = gridValues(Y.ticks(4), lo, hi).map((v) => Y(v));
    const ctx = series.filter((s) => s !== key);

    // Direct labels at each line end, spread so they never overlap.
    const ends = series.map((s) => {
      const i = s.values.findLastIndex(isNum);
      return i >= 0 ? Y(s.values[i] as number) : bottom;
    });
    const labelYs = spreadLabels(ends, 13, top, bottom + 4);

    // Points the keyboard and pointer reach: one per x, on the key series.
    this.pointList = this.x.map((xv, i) => {
      const kv = key.values[i];
      const anyV = isNum(kv) ? kv : series.map((s) => s.values[i]).find(isNum);
      const isEst = est > 0 && i > estFrom;
      const items = [
        { label: this.#xHeading().toLowerCase(), value: fl(xv) },
        ...series.map((s) => ({ label: s.name, value: isNum(s.values[i]) ? fmtNum(s.values[i] as number, this.unit) : '–' })),
        ...(isEst ? [{ label: tr('chartStatus', 'status'), value: tr('chartEstimated', 'Estimated') }] : []),
      ];
      return {
        x: xi(i),
        y: isNum(anyV) ? Y(anyV) : bottom,
        items,
        text: `${fl(xv)}: ${series.map((s) => `${s.name} ${isNum(s.values[i]) ? fmtNum(s.values[i] as number, this.unit) : '–'}`).join(', ')}${isEst ? ` ${tr('chartEstimatedParen', '(estimated)')}` : ''}`,
      } satisfies ChartPoint;
    });

    const bounds = { left, right: w - 2, top: 4 };
    const anns = this.annotations.map((a) => {
      if (a.type === 'range') {
        const a1 = Math.max(left, Math.min(right, n === 1 ? left : X(xNum(a.from))));
        const a2 = Math.max(left, Math.min(right, n === 1 ? right : X(xNum(a.to))));
        const x1 = Math.min(a1, a2);
        const x2 = Math.max(a1, a2);
        // Below the data like a drawing's dimension line when there is room, otherwise just above it.
        let hiY = bottom;
        let loY = top;
        xs.forEach((_, i) => {
          const px = xi(i);
          if (px < x1 - 1 || px > x2 + 1) return;
          for (const s of series) {
            const v = s.values[i];
            if (!isNum(v)) continue;
            hiY = Math.min(hiY, Y(v));
            loY = Math.max(loY, Y(v));
          }
        });
        const y = bottom - loY >= 26 ? bottom - 8 : Math.max(top + 4, hiY - 12);
        return dimensionBracket(x1, x2, y, a.caption, { left, right });
      }
      const s = series.find((x) => x.name === a.series) ?? key;
      const t = xNum(a.at);
      let idx = 0;
      xs.forEach((v, i) => {
        if (Math.abs(v - t) < Math.abs(xs[idx]! - t)) idx = i;
      });
      const v = s.values[idx];
      if (!isNum(v)) return nothing;
      return leaderAnnotation(xi(idx), Y(v), a.caption, bounds);
    });

    const keyVals = key.values;
    const estX = est > 0 ? xi(estFrom) : right;
    return svg`
      ${gridlines(grid, left, right)}
      ${rangeY(left - 8, { at: Y(max), label: fmtNum(max, this.unit) }, { at: Y(min), label: fmtNum(min, this.unit) })}
      ${rangeX(bottom + 8, { at: xi(0), label: fx(this.x[0]!) }, { at: xi(n - 1), label: fx(this.x[n - 1]!) })}
      ${ctx.map((s) =>
        n === 1
          ? svg`<circle class="ctx-dot" cx=${xi(0)} cy=${Y(s.values[0] as number)} r="2.5" fill="var(--mm-text-3)"></circle>`
          : svg`<path class="ctx" d=${lineGen(s.values) ?? ''}></path>`,
      )}
      ${this.filled && n > 1 ? svg`<path class="key-area" d=${areaGen(0, est > 0 ? estFrom : n - 1)}></path>` : nothing}
      ${est > 0 && n > 1
        ? svg`<path class="hatch" fill="url(#${this.hatchId})" d=${areaGen(estFrom, n - 1)}></path>
            <line class="grid" x1=${estX} x2=${estX} y1=${top} y2=${bottom}></line>`
        : nothing}
      ${n === 1
        ? svg`<circle class="key-dot" cx=${xi(0)} cy=${Y(keyVals[0] as number)} r="3"></circle>`
        : svg`<path class="key" d=${segment(keyVals, 0, est > 0 ? estFrom : n - 1)}></path>
            ${est > 0 ? svg`<path class="key est" d=${segment(keyVals, estFrom, n - 1)}></path>` : nothing}`}
      ${series.map(
        (s, i) => svg`<text class=${s === key ? 'key-label' : ''} x=${right + 8} y=${labelYs[i]! + 4}>${labels[i]}</text>`,
      )}
      ${anns}
    `;
  }
}

/**
 * Line charts show change over time, grey first: context series in `mm-text-3`, and one key series
 * in burnt sienna (or slate with `tone="info"`), the only colour on the chart. Lines are labelled
 * directly at their ends in 13px mono, so there is no legend. The axes are range frames that span
 * only the data's minimum to maximum, labelled at their endpoints, with at most three dotted
 * gridlines and no chart box.
 *
 * Annotate like a technical drawing: `annotations` takes points (a leader line with a dot
 * terminal and a mono caption, e.g. "Snowflake warehouse resize") and ranges (a dimension
 * bracket, e.g. an incident window). Set `estimated` to the number of trailing points that are
 * incomplete, such as the current hour: that tail is dashed and hatched, and marked "est.".
 *
 * Keyboard: Tab to the chart, then Left and Right move between points and show the tooltip;
 * Home and End jump to the ends; Escape hides the tooltip. Pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/ (focusable image with an active point).
 *
 * @tagname mm-line-chart
 * @summary Grey-first time series with one key line, direct labels and annotations.
 * @csspart frame - The focusable plot region.
 * @csspart plot - The SVG drawing.
 * @csspart message - The empty or error sentence.
 * @cssprop --mm-chart-key - Colour of the key series.
 */
export class MmLineChart extends MmLineBase {
  /** The lines. One has `key: true`; the others are grey context. */
  @property({ type: Array }) accessor series: LineSeries[] = [];
  /** Fill the key series with a flat 10% tint. */
  @property({ type: Boolean, reflect: true }) accessor area = false;

  protected override getSeries(): LineSeries[] {
    return this.series ?? [];
  }
  protected override get filled(): boolean {
    return this.area;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-line-chart': MmLineChart;
  }
}
