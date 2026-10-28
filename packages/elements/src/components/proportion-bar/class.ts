import { css, html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { tr } from '../../core/strings.js';
import { MmChartBase, type ChartPoint, type ChartTable } from '../chart-core/class.js';
import { fmtNum, monoWidth } from '../chart-core/format.js';

export interface ProportionDatum {
  label: string;
  value: number;
}

interface Segment {
  label: string;
  value: number;
  share: number;
  /** For "Other": the grouped items. */
  members: ProportionDatum[];
  highlight: boolean;
}

interface Placed {
  seg: Segment;
  x0: number;
  x1: number;
  mid: number;
  tier: number;
  anchor: 'start' | 'end';
  text: string;
}

const BAR_H = 12;
/** One label row: 13px text is about 17px tall in Geist, plus 1px clear. */
const TIER_H = 18;
const MAX_TIERS = 4;

/** "76.5%", "13%", "0.2%". */
export function fmtShare(share: number): string {
  const p = share * 100;
  if (p === 0) return '0%';
  if (p < 10) return `${p < 0.1 ? '<0.1' : p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

/**
 * The proportion bar replaces the donut. It is a single horizontal bar split into segments in
 * alternating greys, with one segment highlighted in the key colour, and each segment labelled
 * directly in 13px mono with its share, using leader lines when segments are too narrow for their
 * labels. Small segments (below `threshold` of the total) are grouped as "Other", so the bar never
 * needs a legend or a rainbow of categories.
 *
 * Add `list` to attach a ranked list below it with every item's count and share, as on Insights
 * (asset types next to their counts). The list shows grouped items individually.
 *
 * Keyboard: Tab to the bar, then Left and Right move between segments and show the tooltip;
 * Home and End jump to the ends; Escape hides the tooltip.
 *
 * @tagname mm-proportion-bar
 * @summary A single grey stacked bar with direct labels, replacing the donut.
 * @csspart frame - The focusable bar region.
 * @csspart plot - The SVG drawing.
 * @csspart list - The attached ranked list.
 * @csspart message - The empty or error sentence.
 * @cssprop --mm-chart-key - Colour of the highlighted segment.
 */
export class MmProportionBar extends MmChartBase {
  static override styles = [
    ...MmChartBase.styles,
    css`
      .seg {
        stroke: var(--mm-surface);
        stroke-width: 1;
      }
      .list {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        font: var(--text-dense);
        font-variant-numeric: tabular-nums;
      }
      .list li {
        display: grid;
        grid-template-columns: 8px minmax(0, 1fr) auto 4.5em;
        align-items: center;
        gap: var(--space-3);
        min-block-size: var(--row-compact, 36px);
        border-block-start: 1px solid var(--mm-rule);
        color: var(--mm-text);
      }
      .list li:last-child {
        border-block-end: 1px solid var(--mm-rule);
      }
      .list .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .list .hl .name {
        font-weight: 600;
      }
      .list .num {
        text-align: end;
      }
      .list .share {
        text-align: end;
        color: var(--mm-text-2);
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        font-variant-numeric: tabular-nums;
      }
      .sw {
        inline-size: 8px;
        block-size: 8px;
        background: var(--mm-rule);
      }
      .sw.ctx-bar-2 {
        background: var(--mm-text-3);
      }
      .sw.key-bar {
        background: var(--_key);
      }
    `,
  ];

  /** The parts of the whole, in any order. They are ranked largest first. */
  @property({ type: Array }) accessor data: ProportionDatum[] = [];
  /** Label of the one segment drawn in the key colour. It is never grouped into "Other". */
  @property() accessor highlight = '';
  /** Segments smaller than this share of the total are grouped as "Other". */
  @property({ type: Number }) accessor threshold = 0.02;
  /** At most this many segments, including "Other". */
  @property({ type: Number, attribute: 'max-segments' }) accessor maxSegments = 6;
  /** Attach a ranked list of every item with its count and share. */
  @property({ type: Boolean, reflect: true }) accessor list = false;
  /** Unit after counts in the tooltip and list, e.g. "assets". */
  @property() accessor unit = '';
  /** Heading for the items in the tooltip and table, e.g. "Asset type". */
  @property({ attribute: 'category-label' }) accessor categoryLabel = '';

  #total(): number {
    return (this.data ?? []).reduce((a, d) => a + Math.max(0, d.value || 0), 0);
  }

  #ranked(): ProportionDatum[] {
    return [...(this.data ?? [])].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }

  /** Label widths measured after render; estimates are used until then (and on the server). */
  #widths = new Map<string, number>();
  protected override fontsChanged(): void {
    this.#widths.clear();
    super.fontsChanged();
  }
  #labelW(text: string): number {
    return this.#widths.get(text) ?? monoWidth(text) + 4;
  }

  #segments(forced: ReadonlySet<string> = new Set()): Segment[] {
    const total = this.#total();
    const ranked = this.#ranked();
    const keep: ProportionDatum[] = [];
    const other: ProportionDatum[] = [];
    const max = Math.max(2, this.maxSegments);
    ranked.forEach((d) => {
      const small = d.value / total < this.threshold;
      if (d.label === this.highlight || (!small && !forced.has(d.label) && keep.length < max - 1)) keep.push(d);
      else other.push(d);
    });
    // Grouping one item gains nothing: show it under its own name, unless its label has no room.
    if (other.length === 1 && !forced.has(other[0]!.label)) keep.push(other.pop()!);
    const segs: Segment[] = keep.map((d) => ({ label: d.label, value: d.value, share: d.value / total, members: [], highlight: d.label === this.highlight }));
    if (other.length) {
      const v = other.reduce((a, d) => a + d.value, 0);
      segs.push({ label: tr('chartOther', 'Other'), value: v, share: v / total, members: other, highlight: false });
    }
    return segs;
  }

  #fill(seg: Segment, i: number): string {
    return seg.highlight ? 'key-bar' : i % 2 === 0 ? 'ctx-bar-2' : 'ctx-bar';
  }

  /**
   * Places labels on tiers under the bar like a staircase of leader lines. Each label hangs to the
   * left of its leader (to the right only at the left edge), on the shallowest tier where it
   * overlaps no other label, its leader crosses no label above it, and it covers no deeper leader.
   */
  #place(segs: Segment[]): { placed: Placed[]; tiers: number; failed: string[] } {
    const w = this.w;
    const total = this.#total();
    const placed: Placed[] = [];
    const failed: string[] = [];
    let acc = 0;
    for (const seg of segs) {
      const x0 = (acc / total) * w;
      acc += seg.value;
      const x1 = (acc / total) * w;
      const mid = (x0 + x1) / 2;
      const text = `${seg.label} ${fmtShare(seg.share)}`;
      const lw = this.#labelW(text);
      const span = (p: Placed): [number, number] => {
        const pw = this.#labelW(p.text);
        return p.anchor === 'end' ? [p.mid - 4 - pw, p.mid - 4] : [p.mid + 4, p.mid + 4 + pw];
      };
      const fits = (tier: number, a: number, b: number) =>
        a >= 0 &&
        b <= w &&
        placed.every((p) => {
          const [pa, pb] = span(p);
          if (p.tier === tier && !(b + 8 < pa || a > pb + 8)) return false;
          if (p.tier < tier && mid >= pa - 2 && mid <= pb + 2) return false;
          if (p.tier > tier && p.mid >= a - 2 && p.mid <= b + 2) return false;
          return true;
        });
      let done = false;
      for (let tier = 0; tier < MAX_TIERS && !done; tier++) {
        for (const anchor of ['end', 'start'] as const) {
          const [a, b] = anchor === 'end' ? [mid - 4 - lw, mid - 4] : [mid + 4, mid + 4 + lw];
          if (fits(tier, a, b)) {
            placed.push({ seg, x0, x1, mid, tier, anchor, text });
            done = true;
            break;
          }
        }
      }
      if (!done) failed.push(seg.label);
    }
    return { placed, tiers: Math.max(1, ...placed.map((p) => p.tier + 1)), failed };
  }

  /**
   * Segments and their label placement. A segment whose label cannot be placed without touching
   * another label or leader moves into "Other" (it stays in the ranked list and the table). If
   * "Other" itself has no room, its label is left off the bar and the segment stays reachable by
   * keyboard, tooltip and table.
   */
  #layout(): { segs: Segment[]; placed: Placed[]; tiers: number } {
    const forced = new Set<string>();
    for (let guard = 0; guard < 24; guard++) {
      const segs = this.#segments(forced);
      const r = this.#place(segs);
      const movable = r.failed.filter((l) => l !== this.highlight && segs.some((s) => s.label === l && !s.members.length));
      if (!movable.length) {
        // Keep keyboard order aligned with segments: unplaced labels get a bar-only entry.
        const placed = segs.map((seg) => r.placed.find((p) => p.seg === seg) ?? this.#bare(segs, seg));
        return { segs, placed, tiers: r.tiers };
      }
      // Move the smallest unplaceable segment first.
      const smallest = segs.filter((s) => movable.includes(s.label)).sort((a, b) => a.value - b.value)[0]!;
      forced.add(smallest.label);
    }
    const segs = this.#segments(forced);
    return { segs, placed: segs.map((seg) => this.#bare(segs, seg)), tiers: 1 };
  }

  #bare(segs: Segment[], seg: Segment): Placed {
    const total = this.#total();
    let acc = 0;
    for (const s of segs) {
      if (s === seg) break;
      acc += s.value;
    }
    const x0 = (acc / total) * this.w;
    const x1 = ((acc + seg.value) / total) * this.w;
    return { seg, x0, x1, mid: (x0 + x1) / 2, tier: -1, anchor: 'end', text: '' };
  }

  protected override plotHeight(): number {
    if (this.isEmpty()) return 48;
    return BAR_H + 8 + this.#layout().tiers * TIER_H;
  }

  protected override isEmpty(): boolean {
    return this.#total() <= 0;
  }

  #heading(): string {
    return this.categoryLabel || tr('chartCategory', 'Category');
  }

  protected override describe(): string {
    const total = this.#total();
    const parts = this.#layout().segs.map((s) => `${s.label} ${fmtNum(s.value)} (${fmtShare(s.share)})`);
    return `${tr('proportionSummary', '{label}: {total} in total', { label: this.label || this.#heading(), total: fmtNum(total, this.unit) })}. ${parts.join(', ')}.`;
  }

  protected override dataTable(): ChartTable {
    const total = this.#total();
    return {
      caption: this.label || this.#heading(),
      head: [this.#heading(), tr('chartCount', 'Count'), tr('chartShare', 'Share')],
      rows: this.#ranked().map((d) => [d.label, fmtNum(d.value, this.unit), fmtShare(d.value / total)]),
    };
  }

  protected override renderMarker(p: ChartPoint): SVGTemplateResult {
    const seg = this.#layout().placed[this.active];
    if (!seg) return svg``;
    return svg`<rect class="marker" fill="none" x=${seg.x0 + 1} y="1" width=${Math.max(2, seg.x1 - seg.x0 - 2)} height=${BAR_H - 2} style="fill:none"></rect>
      <circle class="marker" cx=${p.x} cy=${BAR_H / 2} r="2"></circle>`;
  }

  protected override renderPlot(): SVGTemplateResult {
    const { placed } = this.#layout();
    this.box = { left: 0, right: this.w, top: 0, bottom: BAR_H };
    this.pointList = placed.map((p) => {
      const items = [
        { label: this.#heading().toLowerCase(), value: p.seg.label },
        { label: tr('chartCount', 'Count').toLowerCase(), value: fmtNum(p.seg.value, this.unit) },
        { label: tr('chartShare', 'Share').toLowerCase(), value: fmtShare(p.seg.share) },
        ...p.seg.members.map((m) => ({ label: m.label, value: fmtNum(m.value) })),
      ];
      return {
        x: p.mid,
        y: BAR_H / 2,
        items,
        text: `${p.seg.label}: ${fmtNum(p.seg.value, this.unit)}, ${fmtShare(p.seg.share)}${p.seg.members.length ? ` (${p.seg.members.map((m) => `${m.label} ${fmtNum(m.value)}`).join(', ')})` : ''}`,
      };
    });
    return svg`
      ${placed.map((p, i) => svg`<rect class="seg ${this.#fill(p.seg, i)}" x=${p.x0} y="0" width=${Math.max(1, p.x1 - p.x0)} height=${BAR_H}></rect>`)}
      ${placed.map((p) => {
        if (p.tier < 0) return nothing;
        const ty = BAR_H + 8 + p.tier * TIER_H + 4;
        return svg`<line class="leader" x1=${p.mid} x2=${p.mid} y1=${BAR_H + 1} y2=${ty - 3}></line>
          <text class="seg-label halo ${p.seg.highlight ? 'strong' : ''}" x=${p.anchor === 'start' ? p.mid + 4 : p.mid - 4} y=${ty} text-anchor=${p.anchor}>${p.text}</text>`;
      })}
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Replace width estimates with measured ones, then lay out again if any label grew.
    let grew = false;
    this.renderRoot.querySelectorAll<SVGTextElement>('text.seg-label').forEach((t) => {
      const text = t.textContent ?? '';
      const w = Math.ceil(t.getComputedTextLength?.() ?? 0);
      if (w > 0 && Math.abs((this.#widths.get(text) ?? -1) - w) > 0.5) {
        if (w > this.#labelW(text) - 0.5) grew = true;
        this.#widths.set(text, w);
      }
    });
    if (grew) this.requestUpdate();
  }

  protected override renderTable(): TemplateResult {
    return this.list ? html`` : super.renderTable();
  }

  override render(): TemplateResult {
    const main = super.render();
    if (!this.list || this.loading || this.error || this.isEmpty()) return main;
    const total = this.#total();
    const segs = this.#layout().segs;
    const fillFor = (label: string) => {
      const i = segs.findIndex((s) => s.label === label);
      return i >= 0 ? this.#fill(segs[i]!, i) : this.#fill(segs[segs.length - 1]!, segs.length - 1);
    };
    return html`${main}
      <ol class="list" part="list" aria-label=${this.label || this.#heading()}>
        ${this.#ranked().map(
          (d) => html`<li class=${d.label === this.highlight ? 'hl' : ''}>
            <span class="sw ${fillFor(d.label)}" aria-hidden="true"></span>
            <span class="name">${d.label}</span>
            <span class="num">${fmtNum(d.value, this.unit)}</span>
            <span class="share">${fmtShare(d.value / total)}</span>
          </li>`,
        )}
      </ol>
      ${nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-proportion-bar': MmProportionBar;
  }
}
