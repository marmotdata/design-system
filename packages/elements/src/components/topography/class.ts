import { LitElement, css, html, nothing, svg } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { FIELD_H, FIELD_W, topographyLines, type TopographyDensity } from './field.js';

export { FIELD_H, FIELD_W, topographyLines, type TopographyDensity, type TopographyLine } from './field.js';

/** How the field dissolves: not at all, towards every edge, or towards the inline start or end. */
export type TopographyFade = 'none' | 'edges' | 'start' | 'end';

/**
 * Topography is a background field, never an icon or an illustration. It is an unbounded survey
 * sheet: hairline isolines that run off every edge, cropped by the box they sit in, with no closed
 * island, frame, tile or plate. The lines are mixed from `--mm-rule`, every fifth (index) line only a
 * touch stronger, so text over the field keeps its full contrast in Light and Peat. Use at most one
 * per view, behind a moment that has room for it: an empty or error state, sign-in, a marketing hero
 * or closing band.
 *
 * The element is absolutely positioned to fill its containing block and sits at `z-index: -1`, so
 * give the container `position: relative; isolation: isolate` and put the field first. It is
 * decorative (`aria-hidden`, `pointer-events: none`) and deterministic from `seed`, so it
 * server-renders the standard sheet. In the browser it watches its own aspect: a box wider than the
 * sheet (an ultrawide hero) gets a wider sheet with the same line spacing rather than a stretched
 * one, and lines stay hairlines at any size. For a zero-JS page use the `.mm-topography` class
 * from `@marmotdata/css`, which draws one fixed sheet.
 *
 * @tagname mm-topography
 * @summary Abstract topographic background field.
 * @csspart field - The SVG.
 * @cssprop --mm-topography-line - Colour of ordinary isolines. Defaults to `--mm-rule` at 70%.
 * @cssprop --mm-topography-index - Colour of every fifth (index) line. Defaults to `--mm-rule`.
 */
export class MmTopography extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: absolute;
        inset: 0;
        z-index: -1;
        display: block;
        overflow: hidden;
        pointer-events: none;
        contain: strict;
        /* Its own compositor layer: scrolling moves it without repainting the lines. */
        will-change: transform;
      }
      :host([hidden]) {
        display: none;
      }
      svg {
        display: block;
        inline-size: 100%;
        block-size: 100%;
        fill: none;
      }
      .line {
        color: var(--mm-topography-line, color-mix(in oklab, var(--mm-rule) 70%, transparent));
      }
      .index {
        color: var(--mm-topography-index, var(--mm-rule));
      }
      /* Hairlines at any size: the sheet scales to cover its box, the strokes do not. */
      path {
        vector-effect: non-scaling-stroke;
      }
    `,
  ];

  /** Ground seed. The same seed always gives the same sheet. */
  @property({ type: Number }) accessor seed = 1;
  /** `sparse` carries about ten lines, `normal` about eighteen. */
  @property({ reflect: true }) accessor density: TopographyDensity = 'normal';
  /** Where the field dissolves: `none`, `edges`, `start` or `end` (logical, flips in RTL). */
  @property({ reflect: true }) accessor fade: TopographyFade = 'none';

  #rtl = false;
  /** Width of the sheet in user units: the standard 1200, or more for a box wider than 3:2. */
  @state() accessor #width = FIELD_W;
  #resize: ResizeObserver | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
    if (typeof ResizeObserver !== 'undefined') {
      this.#resize ??= new ResizeObserver(([entry]) => {
        const box = entry?.contentRect;
        if (!box || !box.height) return;
        // Steps of 400 units keep the number of distinct sheets (and re-renders) small.
        const wanted = (FIELD_H * box.width) / box.height;
        const width = wanted > FIELD_W ? Math.ceil(wanted / 400) * 400 : FIELD_W;
        if (width !== this.#width) this.#width = width;
      });
      this.#resize.observe(this);
    }
    const rtl = typeof getComputedStyle !== 'undefined' && getComputedStyle(this).direction === 'rtl';
    if (rtl !== this.#rtl) {
      this.#rtl = rtl;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize?.disconnect();
  }

  /**
   * The fade is a gradient on the stroke itself, in the sheet's own coordinates. CSS masks over a
   * full-page SVG made Firefox repaint the whole field on every scroll frame.
   */
  #paint(kind: 'line' | 'index') {
    const id = `${kind}-fade`;
    const FIELD_W = this.#width;
    const stops = (from: number, to: number) => svg`<stop offset=${from} stop-color="currentColor" stop-opacity="0"></stop><stop offset=${to} stop-color="currentColor" stop-opacity="1"></stop>`;
    const fade = this.fade;
    if (fade === 'edges')
      return { id, def: svg`<radialGradient id=${id} class=${kind} gradientUnits="userSpaceOnUse" cx=${FIELD_W / 2} cy=${FIELD_H / 2} r=${FIELD_W * 0.62}>${svg`<stop offset="0.35" stop-color="currentColor" stop-opacity="1"></stop><stop offset="1" stop-color="currentColor" stop-opacity="0"></stop>`}</radialGradient>` };
    if (fade === 'start' || fade === 'end') {
      // Opaque towards the named edge's opposite side; flipped in right-to-left.
      const fromLeft = (fade === 'start') !== this.#rtl;
      return { id, def: svg`<linearGradient id=${id} class=${kind} gradientUnits="userSpaceOnUse" x1=${fromLeft ? 0 : FIELD_W} y1="0" x2=${fromLeft ? FIELD_W : 0} y2="0">${stops(0, 0.65)}</linearGradient>` };
    }
    return { id: '', def: nothing };
  }

  override render() {
    const lines = topographyLines(this.seed, this.density === 'sparse' ? 'sparse' : 'normal', this.#width);
    const line = this.#paint('line');
    const index = this.#paint('index');
    const stroke = (p: { id: string }) => (p.id ? `url(#${p.id})` : 'currentColor');
    return html`<svg part="field" viewBox="0 0 ${this.#width} ${FIELD_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>${line.def}${index.def}</defs>
      <g class="line" stroke=${stroke(line)} stroke-width="1.2">${lines.filter((l) => !l.index).map((l) => svg`<path d=${l.d}></path>`)}</g>
      <g class="index" stroke=${stroke(index)} stroke-width="1.5">${lines.filter((l) => l.index).map((l) => svg`<path d=${l.d}></path>`)}</g>
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-topography': MmTopography;
  }
}
