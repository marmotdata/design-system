import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { prefersReducedMotion } from '../../core/platform.js';
import { t } from '../../core/strings.js';

export type SkeletonShape = 'text' | 'rect' | 'circle' | 'table-row';

/** Fixed, plausible widths so lines look like real text rather than a barcode. */
const LINE_WIDTHS = [92, 78, 86, 64, 88, 71];
const CELL_WIDTHS = [62, 40, 74, 28, 56, 46];

/**
 * Skeletons hold the shape of content that is on its way: text lines, a block, an avatar circle
 * or table rows, in a fill mixed from `mm-rule` and paper. Wrap the real content and toggle `loading`: the placeholder
 * appears only after 200ms, so fast loads never flash, and once shown it stays at least 400ms
 * before the slotted content swaps in. The container is `aria-busy` while loading.
 *
 * The only motion is a very slow opacity breath, never a gradient sweep, and none under reduced
 * motion.
 *
 * @tagname mm-skeleton
 * @summary Placeholder shapes while content loads.
 * @slot - The real content, shown once loading finishes.
 * @csspart base - The busy container.
 * @csspart placeholder - The placeholder shapes.
 * @cssprop --mm-skeleton-width - Width of `rect` and `circle`. Defaults to 100% and 32px.
 * @cssprop --mm-skeleton-height - Height of `rect` and `circle`. Defaults to 96px and 32px.
 */
export class MmSkeleton extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
      }
      .ph {
        display: grid;
        gap: var(--space-2);
        animation: breathe 1600ms var(--mm-ease) infinite alternate;
      }
      @keyframes breathe {
        to {
          opacity: 0.6;
        }
      }
      :host([data-still]) .ph {
        animation: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .ph {
          animation: none;
        }
      }
      .bone {
        display: block;
        /* mm-sunken alone vanishes on Peat paper; a rule-tinted fill reads in both themes. */
        background: color-mix(in oklab, var(--mm-rule) 70%, var(--mm-paper));
        border-radius: var(--radius-sm);
      }
      .line {
        block-size: 12px;
        margin-block: 3px;
      }
      .rect {
        inline-size: var(--mm-skeleton-width, 100%);
        block-size: var(--mm-skeleton-height, 96px);
        border-radius: var(--radius-md);
      }
      .circle {
        inline-size: var(--mm-skeleton-width, 32px);
        block-size: var(--mm-skeleton-height, 32px);
        border-radius: 50%;
      }
      .ph.table-row {
        gap: 0;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(var(--_cols, 4), minmax(0, 1fr));
        align-items: center;
        gap: var(--space-3);
        block-size: var(--mm-row, var(--row-default));
        padding-inline: var(--space-3);
        border-block-end: 1px solid var(--mm-rule);
      }
      .row .bone {
        block-size: 10px;
      }
      .row .bone.num {
        justify-self: end;
      }
    `,
  ];

  /** Whether the content is loading. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** `text` (default), `rect`, `circle` or `table-row`. */
  @property({ reflect: true }) accessor shape: SkeletonShape = 'text';
  /** Lines for `text`, rows for `table-row`. */
  @property({ type: Number }) accessor count = 3;
  /** Columns for `table-row`. The last column is right-aligned like a number column. */
  @property({ type: Number }) accessor columns = 4;

  #delayed = new DelayedVisibility(this);

  override connectedCallback(): void {
    super.connectedCallback();
    this.#delayed.set(this.loading);
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('loading') && this.isConnected) this.#delayed.set(this.loading);
    if (typeof window !== 'undefined') this.toggleAttribute('data-still', prefersReducedMotion());
  }

  #shapes() {
    const n = Math.max(1, this.count);
    switch (this.shape) {
      case 'rect':
        return html`<span class="bone rect"></span>`;
      case 'circle':
        return html`<span class="bone circle"></span>`;
      case 'table-row': {
        const cols = Math.max(1, this.columns);
        return Array.from(
          { length: n },
          (_, r) => html`<div class="row" style="--_cols:${cols}">
            ${Array.from({ length: cols }, (_, c) => {
              const w = CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]!;
              return html`<span class="bone ${c === cols - 1 && cols > 1 ? 'num' : ''}" style="inline-size:${c === cols - 1 && cols > 1 ? 40 : w}%"></span>`;
            })}
          </div>`,
        );
      }
      default:
        return Array.from({ length: n }, (_, i) => {
          const w = i === n - 1 && n > 1 ? 48 : LINE_WIDTHS[i % LINE_WIDTHS.length]!;
          return html`<span class="bone line" style="inline-size:${w}%"></span>`;
        });
    }
  }

  override render() {
    const showPlaceholder = this.#delayed.visible;
    // While loading but inside the 200ms delay, show neither: the content is not ready yet.
    const showContent = !this.loading && !showPlaceholder;
    return html`<div part="base" aria-busy=${this.loading || showPlaceholder ? 'true' : 'false'}>
      ${showPlaceholder
        ? html`<span class="visually-hidden">${t('loading')}</span>
            <div part="placeholder" class="ph ${this.shape}" aria-hidden="true">${this.#shapes()}</div>`
        : nothing}
      <div ?hidden=${!showContent}><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-skeleton': MmSkeleton;
  }
}
