import { property } from 'lit/decorators.js';
import { MmLineBase, type LineSeries } from '../line-chart/class.js';

/**
 * Area charts show one quantity over time, such as assets catalogued per day, as a key line over
 * a flat 10% tint of the same colour, never a gradient. They carry the key series only: when you
 * need context series, use `mm-line-chart`. The fill runs down to zero, so the range-frame y axis
 * spans zero to the maximum, labelled at both ends, with at most three dotted gridlines and no box.
 * Estimated trailing points (`estimated`) are dashed and hatched instead of tinted, and
 * `annotations` take the same leader and dimension-bracket notes as the line chart.
 *
 * Keyboard: Tab to the chart, then Left and Right move between points and show the tooltip;
 * Home and End jump to the ends; Escape hides the tooltip.
 *
 * @tagname mm-area-chart
 * @summary One key series over a flat tint.
 * @csspart frame - The focusable plot region.
 * @csspart plot - The SVG drawing.
 * @csspart message - The empty or error sentence.
 * @cssprop --mm-chart-key - Colour of the line and its tint.
 */
export class MmAreaChart extends MmLineBase {
  /** One value per x, oldest first. `null` leaves a gap. */
  @property({ type: Array }) accessor values: (number | null)[] = [];
  /** Series name, printed at the line end, e.g. "Catalogued". Defaults to `label`. */
  @property() accessor name = '';

  protected override getSeries(): LineSeries[] {
    return [{ name: this.name || this.label, values: this.values ?? [], key: true }];
  }
  protected override get filled(): boolean {
    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-area-chart': MmAreaChart;
  }
}
