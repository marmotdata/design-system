import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { tr } from '../../core/strings.js';

export type PopularityLevel = 1 | 2 | 3 | 4;

const names: Record<PopularityLevel, () => string> = {
  1: () => tr('popularityLow', 'Popularity: low'),
  2: () => tr('popularityMedium', 'Popularity: medium'),
  3: () => tr('popularityHigh', 'Popularity: high'),
  4: () => tr('popularityVeryHigh', 'Popularity: very high'),
};

/**
 * Popularity shows how much an asset is used compared with the rest of the catalog, as four
 * ascending bars. The bars are the whole message: no rank, percentage or view count beside them,
 * because the exact figure does not change what anyone does. The level is the accessible name.
 * The bars are ink-2, never burnt sienna, because popularity is not a status or an action.
 *
 * @tagname mm-popularity
 * @summary How much an asset is used, as four bars.
 * @csspart bars - The four bars.
 */
export class MmPopularity extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .bars {
        display: inline-flex;
        align-items: flex-end;
        gap: 2px;
        height: 12px;
      }
      .bar {
        width: 3px;
        border-radius: 1px;
        background: var(--mm-rule);
      }
      .bar:nth-child(1) {
        height: 4px;
      }
      .bar:nth-child(2) {
        height: 7px;
      }
      .bar:nth-child(3) {
        height: 10px;
      }
      .bar:nth-child(4) {
        height: 12px;
      }
      .bar.on {
        background: var(--mm-text-2);
      }
    `,
  ];

  /** From 1 (rarely used) to 4 (among the most used in the catalog). */
  @property({ type: Number }) accessor level: PopularityLevel = 1;

  override render() {
    const level = Math.min(4, Math.max(1, Math.round(this.level))) as PopularityLevel;
    return html`<span class="bars" part="bars" role="img" aria-label=${names[level]()}>
      ${[1, 2, 3, 4].map((i) => html`<span class="bar ${i <= level ? 'on' : ''}"></span>`)}
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-popularity': MmPopularity;
  }
}
