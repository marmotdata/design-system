import { css, nothing, svg, type SVGTemplateResult } from 'lit';
import { monoWidth } from './format.js';

/**
 * SVG drawing primitives shared by the Marmot charts. They follow the guidelines' data-visualisation
 * rules: range-frame axes from the data minimum to maximum with endpoint labels and outward 4px
 * ticks, at most three dotted gridlines, no chart box, technical-drawing annotations and hatching
 * for estimated data.
 */

/** Chart stroke and text styles. Every colour is a token. */
export const chartStyles = css`
  mm-tooltip {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
  }
  svg.plot {
    display: block;
    overflow: visible;
    direction: ltr;
  }
  /* Axis, end and annotation labels: the text face with tabular figures, never mono. */
  svg.plot text {
    font: var(--text-caption);
    font-size: 13px;
    letter-spacing: 0;
    fill: var(--mm-text-2);
    font-variant-numeric: tabular-nums;
  }
  .axis {
    stroke: var(--mm-text-3);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .grid {
    stroke: var(--mm-rule);
    stroke-width: 1;
    stroke-dasharray: 1 3;
    shape-rendering: crispEdges;
  }
  .ctx {
    fill: none;
    stroke: var(--mm-text-3);
    stroke-width: 1.25;
    stroke-linejoin: round;
  }
  .ctx-faint {
    fill: none;
    stroke: var(--mm-rule);
    stroke-width: 1.25;
  }
  .ctx-bar {
    fill: var(--mm-rule);
  }
  .ctx-bar-2 {
    fill: var(--mm-text-3);
  }
  .key {
    fill: none;
    stroke: var(--_key);
    stroke-width: 1.75;
    stroke-linejoin: round;
  }
  .key.est {
    stroke-dasharray: 3 3;
  }
  .key-area {
    fill: var(--_key);
    opacity: 0.1;
  }
  .key-bar,
  .key-dot {
    fill: var(--_key);
  }
  svg.plot text.key-label {
    fill: var(--_key);
    font-weight: 600;
  }
  svg.plot text.strong {
    fill: var(--mm-text);
    font-weight: 600;
  }
  svg.plot text.ann {
    fill: var(--mm-text-2);
  }
  .leader {
    stroke: var(--mm-text-2);
    stroke-width: 1;
    fill: none;
  }
  .leader-dot {
    fill: var(--mm-text-2);
  }
  .hatch-line {
    stroke: var(--mm-text-3);
    stroke-width: 1;
  }
  .hatch {
    stroke: none;
  }
  .cursor {
    stroke: var(--mm-text-2);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }
  .marker {
    fill: var(--mm-surface);
    stroke: var(--mm-text);
    stroke-width: 2;
  }
  .halo {
    paint-order: stroke;
    stroke: var(--mm-chart-ground, var(--mm-paper));
    stroke-width: 3px;
    stroke-linejoin: round;
  }
`;

/** A diagonal hatch pattern. Fill a shape with `url(#id)` to mark estimated or stale data. */
export function hatchDef(id: string): SVGTemplateResult {
  return svg`<pattern id=${id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
    <line class="hatch-line" x1="0" y1="0" x2="0" y2="4"></line>
  </pattern>`;
}

export interface Tick {
  /** Pixel position along the axis. */
  at: number;
  label: string;
}

/**
 * Range-frame y axis: a 1px line from the data minimum to maximum, a little outside the plot,
 * with outward 4px ticks and labels at the two endpoints only.
 */
export function rangeY(x: number, top: Tick, bottom: Tick, merged = `${bottom.label}–${top.label}`): SVGTemplateResult {
  if (Math.abs(top.at - bottom.at) < 11 && top.label !== bottom.label) {
    // Too close to label both ends apart: one label for the whole range.
    const mid = (top.at + bottom.at) / 2;
    return svg`<g class="y-axis">
      <line class="axis" x1=${x} x2=${x} y1=${top.at} y2=${bottom.at}></line>
      <line class="axis" x1=${x - 4} x2=${x} y1=${top.at} y2=${top.at}></line>
      <line class="axis" x1=${x - 4} x2=${x} y1=${bottom.at} y2=${bottom.at}></line>
      <text x=${x - 8} y=${mid + 4} text-anchor="end">${merged}</text>
    </g>`;
  }
  const ticks = top.at === bottom.at ? [top] : [top, bottom];
  return svg`<g class="y-axis">
    <line class="axis" x1=${x} x2=${x} y1=${top.at} y2=${bottom.at}></line>
    ${ticks.map(
      (t) => svg`<line class="axis" x1=${x - 4} x2=${x} y1=${t.at} y2=${t.at}></line>
        <text x=${x - 8} y=${t.at + 4} text-anchor="end">${t.label}</text>`,
    )}
  </g>`;
}

/** Range-frame x axis: from the first to the last x, ticks pointing down, endpoint labels. */
export function rangeX(y: number, first: Tick, last: Tick, extra: Tick[] = []): SVGTemplateResult {
  const ticks = first.at === last.at ? [first] : [first, last];
  return svg`<g class="x-axis">
    <line class="axis" x1=${first.at} x2=${last.at} y1=${y} y2=${y}></line>
    ${ticks.map(
      (t, i) => svg`<line class="axis" x1=${t.at} x2=${t.at} y1=${y} y2=${y + 4}></line>
        <text x=${t.at} y=${y + 16} text-anchor=${ticks.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}>${t.label}</text>`,
    )}
    ${extra.map(
      (t) => svg`<line class="axis" x1=${t.at} x2=${t.at} y1=${y} y2=${y + 4}></line>
        <text x=${t.at} y=${y + 16} text-anchor="middle">${t.label}</text>`,
    )}
  </g>`;
}

/** Dotted gridlines, capped at three. */
export function gridlines(ys: number[], x1: number, x2: number): SVGTemplateResult {
  return svg`${ys.slice(0, 3).map((y) => svg`<line class="grid" x1=${x1} x2=${x2} y1=${y} y2=${y}></line>`)}`;
}

/** Picks up to three interior gridline values from a scale's nice ticks. */
export function gridValues(ticks: number[], min: number, max: number): number[] {
  const inside = ticks.filter((t) => t > min && t < max);
  if (inside.length <= 3) return inside;
  const step = Math.ceil(inside.length / 3);
  return inside.filter((_, i) => i % step === step - 1).slice(0, 3);
}

/**
 * A point annotation drawn like a technical drawing: a dot terminal on the data point, a 1px
 * leader, and a mono caption. The leader goes up and to the left, flipping right or down when
 * the caption would leave the drawing.
 */
export function leaderAnnotation(px: number, py: number, caption: string, bounds: { left: number; right: number; top: number }): SVGTemplateResult {
  const w = monoWidth(caption);
  let dx = -36;
  let dy = -18;
  if (px + dx - 4 - w < bounds.left) dx = 36;
  if (dx > 0 && px + dx + 4 + w > bounds.right) dx = -Math.min(36, Math.max(8, px - bounds.left - w - 4));
  if (py + dy - 6 < bounds.top) dy = 18;
  return leaderTo(px, py, px + dx, py + dy, caption, dx < 0 ? 'end' : 'start');
}

/** A leader from a data point to an explicit elbow, with the caption beside the elbow. */
export function leaderTo(px: number, py: number, ex: number, ey: number, caption: string, anchor: 'start' | 'end'): SVGTemplateResult {
  const tx = ex + (anchor === 'end' ? -4 : 4);
  return svg`<g class="annotation">
    <line class="leader" x1=${px} y1=${py} x2=${ex} y2=${ey}></line>
    <circle class="leader-dot" cx=${px} cy=${py} r="2"></circle>
    <text class="ann halo" x=${tx} y=${ey + 4} text-anchor=${anchor}>${caption}</text>
  </g>`;
}

/**
 * A dimension bracket for a range, such as an incident window: a 1px line with end ticks and a
 * mono caption centred above.
 */
export function dimensionBracket(x1: number, x2: number, y: number, caption: string, bounds?: { left: number; right: number }): SVGTemplateResult {
  const mid = (x1 + x2) / 2;
  const w = monoWidth(caption);
  let tx = mid;
  if (bounds) tx = Math.min(bounds.right - w / 2, Math.max(bounds.left + w / 2, mid));
  return svg`<g class="annotation range">
    <line class="leader" x1=${x1} x2=${x2} y1=${y} y2=${y}></line>
    <line class="leader" x1=${x1} x2=${x1} y1=${y - 4} y2=${y + 4}></line>
    <line class="leader" x1=${x2} x2=${x2} y1=${y - 4} y2=${y + 4}></line>
    ${caption ? svg`<text class="ann halo" x=${tx} y=${y - 7} text-anchor="middle">${caption}</text>` : nothing}
  </g>`;
}

/**
 * Spreads direct labels vertically so none overlap, keeping each as close as possible to its
 * line end. Returns adjusted y positions in the input order.
 */
export function spreadLabels(ys: number[], gap = 13, min = -Infinity, max = Infinity): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const cur = order[k]!;
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const overflow = (order[order.length - 1]?.y ?? 0) - max;
  if (overflow > 0) order.forEach((o) => (o.y -= overflow));
  if ((order[0]?.y ?? 0) < min) {
    const shift = min - order[0]!.y;
    order.forEach((o) => (o.y += shift));
  }
  const out = new Array<number>(ys.length);
  order.forEach((o) => (out[o.i] = o.y));
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A closed ring of points to a smooth path through the midpoints, like a hand-inked isoline. */
export function smoothRing(ring: number[][], sx: number, sy: number, ox = 0, oy = 0): string {
  const pts = ring.slice(0, -1);
  if (pts.length < 3) return '';
  const p = (i: number) => pts[(i + pts.length) % pts.length]!;
  const X = (v: number) => r1(ox + v * sx);
  const Y = (v: number) => r1(oy + v * sy);
  const mid = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  const start = mid(p(-1), p(0));
  let d = `M${X(start[0]!)},${Y(start[1]!)}`;
  for (let i = 0; i < pts.length; i++) {
    const c = p(i);
    const m = mid(c, p(i + 1));
    d += `Q${X(c[0]!)},${Y(c[1]!)} ${X(m[0]!)},${Y(m[1]!)}`;
  }
  return `${d}Z`;
}
