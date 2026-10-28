import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { t, tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../menu/define.js';
import '../menu-button/define.js';
import type { MenuSelectDetail } from '../menu/class.js';

/**
 * Breadcrumbs show where a page sits: Discover › PostgreSQL › shop › public › orders. They are a
 * `nav` landmark named "Breadcrumbs" around an ordered list. Separators are chevrons hidden from
 * assistive technology and mirrored in right-to-left text. The last crumb is the current page: plain
 * ink text with `aria-current="page"`, not a link. Earlier crumbs are quiet `mm-text-2` links.
 *
 * With more than `max` crumbs (default 4), or when they do not fit, the middle ones collapse into a
 * "…" menu button, keeping the first crumb and as many of the last as fit. Crumbs are always in the
 * text face, asset paths (provider, database, schema, table) included: breadcrumbs are never mono.
 *
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 *
 * @tagname mm-breadcrumbs
 * @summary The path to the current page, with overflow.
 * @slot - `mm-breadcrumb` elements, outermost first.
 * @csspart nav - The `nav` landmark.
 * @csspart list - The ordered list.
 * @csspart overflow - The "…" menu button.
 */
export class MmBreadcrumbs extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
        color: var(--mm-text-2);
      }
      nav {
        min-width: 0;
      }
      ol {
        display: flex;
        align-items: center;
        min-width: 0;
        margin: 0;
        padding: 0;
        list-style: none;
        overflow: hidden;
      }
      .more {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        flex: none;
      }
      .sep {
        flex: none;
        color: var(--mm-text-3);
      }
      :host(:dir(rtl)) .sep {
        transform: scaleX(-1);
      }
      mm-menu-button {
        margin-inline: -2px;
      }
    `,
  ];

  /** Collapse the middle crumbs into a menu when there are more than this many. Minimum 3. */
  @property({ type: Number }) accessor max = 4;
  /** Accessible name of the landmark. Defaults to "Breadcrumbs". */
  @property() accessor label = '';

  /** How many of the last crumbs stay visible when collapsed. */
  @state() accessor #tail = Infinity;
  @query('ol') accessor #ol!: HTMLOListElement | null;
  @query('slot[name="lead"]') accessor #lead!: HTMLSlotElement | null;
  @query('slot[name="tail"]') accessor #tailSlot!: HTMLSlotElement | null;

  #mo?: MutationObserver;
  #ro?: ResizeObserver;
  #width = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window === 'undefined') return;
    this.#mo = new MutationObserver(() => this.#reset());
    this.#mo.observe(this, { childList: true });
    this.#ro = new ResizeObserver(() => {
      const w = Math.round(this.getBoundingClientRect().width);
      if (w > this.#width) this.#reset();
      else if (w < this.#width) this.requestUpdate();
      this.#width = w;
    });
    this.#ro.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#mo?.disconnect();
    this.#ro?.disconnect();
  }

  get crumbs(): MmBreadcrumb[] {
    return [...this.children].filter((el): el is MmBreadcrumb => el instanceof MmBreadcrumb);
  }

  /** The crumbs hidden in the overflow menu. */
  get overflowed(): MmBreadcrumb[] {
    const all = this.crumbs;
    const { show } = this.#plan(all.length);
    return show ? all.slice(1, all.length - show) : [];
  }

  #reset() {
    this.#tail = Infinity;
    this.requestUpdate();
  }

  /** `show` is the number of trailing crumbs kept beside the first; 0 means no collapsing. */
  #plan(n: number): { show: number } {
    const max = Math.max(3, Number(this.max) || 4);
    let show = n > max ? max - 2 : 0;
    if (Number.isFinite(this.#tail)) show = show ? Math.min(show, this.#tail) : this.#tail;
    if (show && n - show <= 1) show = 0;
    return { show };
  }

  #assign() {
    const all = this.crumbs;
    const { show } = this.#plan(all.length);
    const lead = show ? all.slice(0, 1) : all;
    const tail = show ? all.slice(all.length - show) : [];
    all.forEach((c, i) => {
      c.last = i === all.length - 1;
    });
    this.#lead?.assign(...lead);
    this.#tailSlot?.assign(...tail);
  }

  protected override updated(): void {
    this.#assign();
    // Collapse further while the list overflows, down to the first crumb, "…" and the current page.
    const ol = this.#ol;
    if (!ol) return;
    requestAnimationFrame(() => {
      if (ol.scrollWidth <= ol.clientWidth + 1) return;
      const n = this.crumbs.length;
      const current = this.#plan(n).show || n - 1;
      if (current > 1) {
        this.#tail = current - 1;
      }
    });
  }

  #onSelect(e: CustomEvent<MenuSelectDetail>) {
    const index = Number(e.detail.value);
    const crumb = this.overflowed[index];
    crumb?.activate();
  }

  override render() {
    const hidden = this.overflowed;
    return html`<nav part="nav" aria-label=${this.label || t('breadcrumbs')}>
      <ol part="list">
        <slot name="lead"></slot>
        ${hidden.length
          ? html`<li class="more">
              <mm-menu-button
                part="overflow"
                variant="ghost"
                size="sm"
                icon="more-horiz"
                icon-only
                label=${tr('showHiddenLevels', 'Show {count} more levels', { count: hidden.length })}
              >
                <mm-menu @mm-select=${this.#onSelect}>
                  ${hidden.map(
                    // Text set as a property, so no Lit markers end up in the item's typeahead text.
                    (c, i) => html`<mm-menu-item
                      value=${String(i)}
                      icon=${ifDefined(c.icon || undefined)}
                      .textContent=${c.text}
                    ></mm-menu-item>`,
                  )}
                </mm-menu>
              </mm-menu-button>
              <mm-icon class="sep" name="chevron-right" aria-hidden="true"></mm-icon>
            </li>`
          : nothing}
        <slot name="tail"></slot>
      </ol>
    </nav>`;
  }
}

/**
 * One level in `mm-breadcrumbs`. With `href` it is a link; the last crumb is always the current page,
 * marked `aria-current="page"` and never a link. Long names are truncated with an ellipsis and their
 * full text shown on hover.
 *
 * @tagname mm-breadcrumb
 * @summary One level of the breadcrumb trail.
 * @slot - The name.
 * @csspart link - The link, or the current page's text.
 * @csspart separator - The chevron after the crumb.
 */
export class MmBreadcrumb extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        flex: none;
      }
      /* Only the current page shrinks; below 8ch the trail collapses into the menu instead. */
      :host([last]) {
        flex: 0 1 auto;
        min-width: 8ch;
      }
      .crumb {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 1.5em;
        max-width: 28ch;
        min-height: 24px;
        padding: 0 2px;
        border-radius: var(--radius-sm);
        color: var(--mm-text-2);
        text-decoration: none;
        white-space: nowrap;
      }
      .text {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      a.crumb:hover,
      a.crumb:focus-visible {
        color: var(--mm-text);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
      }
      :host([last]) .crumb {
        color: var(--mm-text);
        font-weight: 600;
        max-width: 40ch;
      }
      .sep {
        flex: none;
        color: var(--mm-text-3);
      }
      :host(:dir(rtl)) .sep {
        transform: scaleX(-1);
      }
      mm-icon.lead {
        flex: none;
      }
    `,
  ];

  /** Link to this level. Ignored on the last crumb, which is the current page. */
  @property() accessor href = '';
  /** Optional leading 16px icon. */
  @property() accessor icon = '';
  /** Set by `mm-breadcrumbs` on the final crumb. */
  @property({ type: Boolean, reflect: true }) accessor last = false;

  @query('a') accessor #a!: HTMLAnchorElement | null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
  }

  /** The crumb's text. */
  get text(): string {
    return (this.textContent ?? '').trim();
  }

  /** Follows the link, as a click would. */
  activate(): void {
    if (this.#a) this.#a.click();
    else if (this.href && typeof location !== 'undefined') location.assign(this.href);
  }

  override render() {
    const icon = this.icon ? html`<mm-icon class="lead" name=${this.icon}></mm-icon>` : nothing;
    const body = html`${icon}<span class="text"><slot></slot></span>`;
    const title = this.text || undefined;
    if (this.last || !this.href) {
      return html`<span part="link" class="crumb" aria-current=${ifDefined(this.last ? 'page' : undefined)} title=${ifDefined(title)}>${body}</span>${this.last
          ? nothing
          : html`<mm-icon part="separator" class="sep" name="chevron-right" aria-hidden="true"></mm-icon>`}`;
    }
    return html`<a part="link" class="crumb" href=${this.href} title=${ifDefined(title)}>${body}</a
      ><mm-icon part="separator" class="sep" name="chevron-right" aria-hidden="true"></mm-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-breadcrumbs': MmBreadcrumbs;
    'mm-breadcrumb': MmBreadcrumb;
  }
}
