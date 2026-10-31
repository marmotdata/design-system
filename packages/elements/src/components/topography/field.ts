import { contours } from 'd3-contour';

/** One open isoline of the topographic field, ready for an SVG `<path d>`. */
export interface TopographyLine {
  /** SVG path data in the field's 1200 by 800 user space. */
  d: string;
  /** True for every fifth line (an index contour), drawn a touch stronger. */
  index: boolean;
}

/** How many isolines the field carries. */
export type TopographyDensity = 'sparse' | 'normal';

/** Width of the standard sheet's user space. The SVG slices it to cover any box. */
export const FIELD_W = 1200;
/** Height of the field's user space. */
export const FIELD_H = 800;

const CELL = 40;
const PAD = 2;

/** Small, fast, deterministic PRNG so the same seed always gives the same ground. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Open polyline to a smooth path: quadratic curves through the midpoints, ending on the last point. */
function lineToPath(pts: number[][]): string {
  const f = (n: number) => Math.round(n);
  const p0 = pts[0]!;
  let d = `M${f(p0[0]!)} ${f(p0[1]!)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i]!;
    const n = pts[i + 1]!;
    d += `Q${f(c[0]!)} ${f(c[1]!)} ${f((c[0]! + n[0]!) / 2)} ${f((c[1]! + n[1]!) / 2)}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d}L${f(last[0]!)} ${f(last[1]!)}`;
}

const cache = new Map<string, TopographyLine[]>();

/**
 * Generates an unbounded topographic field: a deterministic, low-frequency height field (a tilted
 * plane with a few broad, warped swells) contoured with d3-contour on a coarse grid that extends past
 * the visible sheet. Each ring is cut where it leaves the sheet, so every line runs off an edge;
 * rings that would close entirely inside the sheet (islands) are dropped. The result is a few hundred
 * path points. Pure and SSR-safe; results are memoised per seed, density and width.
 *
 * `width` widens the sheet for wide boxes (an ultrawide hero) so it is never stretched. The extra
 * ground is added equally on both sides and the line spacing is taken from the central 1200 units,
 * so the middle of a wide sheet is the standard sheet, line for line.
 */
export function topographyLines(seed = 1, density: TopographyDensity = 'normal', width = FIELD_W): TopographyLine[] {
  const W = Math.max(FIELD_W, Math.round(width / CELL) * CELL);
  const key = `${seed}:${density}:${W}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const shift = (W - FIELD_W) / 2;
  const gw = W / CELL + PAD * 2 + 1;
  const gh = FIELD_H / CELL + PAD * 2 + 1;
  const theta = rand() * Math.PI * 2;
  const tilt = 0.8 + rand() * 0.4;
  const waves = Array.from({ length: 4 }, (_, k) => ({
    f: 0.3 + rand() * 0.55 + k * 0.08,
    phi: rand() * Math.PI * 2,
    p: rand() * Math.PI * 2,
    a: 0.32 - k * 0.05,
  }));
  const warp = { f: 0.6 + rand() * 0.6, p: rand() * Math.PI * 2, a: 0.12 };
  const values = new Array<number>(gw * gh);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      // In units of the sheet height, so features are the same size whatever the aspect.
      const u0 = ((i - PAD) * CELL - shift) / FIELD_H;
      const v0 = ((j - PAD) * CELL) / FIELD_H;
      const u = u0 + warp.a * Math.sin(2 * Math.PI * warp.f * v0 + warp.p);
      const v = v0 + warp.a * Math.sin(2 * Math.PI * warp.f * u0 + warp.p * 1.7);
      let z = tilt * (u * Math.cos(theta) + v * Math.sin(theta));
      for (const w of waves) z += w.a * Math.sin(2 * Math.PI * w.f * (u * Math.cos(w.phi) + v * Math.sin(w.phi)) + w.p);
      values[j * gw + i] = z;
      // The range, and so the spacing, comes from the standard sheet's own window.
      const x = (i - PAD) * CELL - shift;
      const inside = x >= 0 && x <= FIELD_W && j >= PAD && j <= gh - PAD - 1;
      if (inside) {
        if (z < lo) lo = z;
        if (z > hi) hi = z;
      }
    }
  }
  const count = density === 'sparse' ? 10 : 18;
  const step = (hi - lo) / (count + 1);
  const thresholds = Array.from({ length: count }, (_, k) => lo + step * (k + 1));
  // A wider sheet's ground keeps rising or falling past the standard window: carry the same step on
  // out, so lines keep their spacing to the edges.
  if (W > FIELD_W) {
    let zmin = Infinity;
    let zmax = -Infinity;
    for (const z of values) {
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
    for (let t = lo; t > zmin; t -= step) thresholds.unshift(t);
    for (let t = lo + step * (count + 1); t < zmax; t += step) thresholds.push(t);
  }
  // d3-contour puts value i at x = i + 0.5; map that back to sheet units.
  const toWorld = (p: number[]) => [(p[0]! - 0.5 - PAD) * CELL, (p[1]! - 0.5 - PAD) * CELL];
  const m = CELL;
  const inSheet = (p: number[]) => p[0]! >= -m && p[0]! <= W + m && p[1]! >= -m && p[1]! <= FIELD_H + m;
  const out: TopographyLine[] = [];
  contours()
    .size([gw, gh])
    .thresholds(thresholds)(values)
    .forEach((mp) => {
      // Every fifth step from the standard sheet's lowest line, so index lines agree at any width.
      const k = Math.round((mp.value - lo) / step);
      const index = k % 5 === 0;
      for (const polygon of mp.coordinates) {
        for (const raw of polygon) {
          const ring = raw.slice(0, -1).map(toWorld);
          const firstOut = ring.findIndex((p) => !inSheet(p));
          // A ring wholly inside the sheet is an island: never shown, the field stays unbounded.
          if (firstOut < 0) continue;
          const n = ring.length;
          const rot = Array.from({ length: n }, (_, k) => ring[(firstOut + k) % n]!);
          let run: number[][] = [];
          const flush = (tail?: number[]) => {
            if (run.length >= 2) {
              if (tail) run.push(tail);
              // Thin to every second point, keeping both ends, so lines stay light.
              const thin = run.filter((_, k) => k === 0 || k === run.length - 1 || k % 2 === 0);
              if (thin.length >= 3) out.push({ d: lineToPath(thin), index });
            }
            run = [];
          };
          for (let k = 0; k < n; k++) {
            const p = rot[k]!;
            if (inSheet(p)) {
              // Start each run on the outside point before it, so the line enters from off the edge.
              if (!run.length) run.push(rot[(k - 1 + n) % n]!);
              run.push(p);
            } else if (run.length) {
              flush(p);
            }
          }
          if (run.length) flush(rot[0]);
        }
      }
    });
  cache.set(key, out);
  return out;
}
