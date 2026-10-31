import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';

/**
 * A set of places to go: documentation pages, runbooks, external resources. Each item is a title
 * and one quiet line saying what is there, separated by hairlines. Use it instead of a grid of icon
 * cards. With `columns="2"` the items sit in two columns once the list is at least 40rem wide and
 * fall back to one column when it is narrower; rows in a pair share a height, so the hairlines run
 * straight across both columns.
 *
 * This is a plain list of links, not a composite widget: Tab moves from link to link. Static and
 * server-rendered pages can use the zero-JS `.mm-link-list` classes from `@marmotdata/css`, which
 * draw the same thing.
 *
 * Follows the WAI-ARIA link pattern: https://www.w3.org/WAI/ARIA/apg/patterns/link/
 *
 * @tagname mm-link-list
 * @summary Hairline-separated links, each a title and one line, in one or two columns.
 * @slot - `mm-link-list-item` elements.
 * @csspart list - The wrapper that lays out the items.
 */
export class MmLinkList extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
        container: mm-link-list / inline-size;
      }
      .list {
        display: flex;
        flex-wrap: wrap;
        border-block-end: 1px solid var(--mm-rule);
      }
      ::slotted(mm-link-list-item) {
        flex: 0 0 100%;
        min-width: 0;
        border-block-start: 1px solid var(--mm-rule);
      }
      @container mm-link-list (min-width: 40rem) {
        :host([columns='2']) ::slotted(mm-link-list-item) {
          flex-basis: 50%;
        }
      }
    `,
  ];

  /** `2` puts the items in two columns when the list is at least 40rem wide. */
  @property({ reflect: true }) accessor columns: '1' | '2' = '1';

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'list');
  }

  override render() {
    return html`<div class="list" part="list"><slot></slot></div>`;
  }
}

/**
 * One place to go in an `mm-link-list`. The whole row is a single link: an optional 16px icon in
 * `mm-text-2`, the title in ink, one line of description in `mm-text-2` and a trailing chevron in
 * `mm-text-3`. External links open a new tab, swap the chevron for open-in-new and say so to screen
 * readers. On hover and focus the row turns `mm-sunken`, the title underlines and the indicator goes
 * to ink, so it reads as a link without relying on colour.
 *
 * The link is named by the title; the description is attached as its accessible description, so it
 * is read once. Without `href` the item is plain text with no indicator.
 *
 * @tagname mm-link-list-item
 * @summary A whole-row link with an icon, title, one line of description and an indicator.
 * @slot - The title.
 * @slot icon - A leading icon or provider logo (`mm-provider-logo decorative`), if you need more than the `icon` attribute.
 * @slot description - The description, if it needs markup. Otherwise use `description`.
 * @csspart item - The link, or the text wrapper without `href`.
 * @csspart icon - The leading icon wrapper.
 * @csspart title - The title.
 * @csspart description - The description.
 * @csspart indicator - The chevron, or open-in-new on external links.
 */
export class MmLinkListItem extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .item {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        block-size: 100%;
        min-block-size: 44px;
        padding: var(--space-3);
        border-radius: var(--radius-sm);
        color: var(--mm-text);
        text-decoration: none;
      }
      a.item {
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .icon {
        display: inline-flex;
        flex: none;
        margin-block-start: 2px;
        color: var(--mm-text-2);
      }
      .text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }
      .title {
        font: var(--text-label);
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      a .title {
        text-decoration-line: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
        text-decoration-color: transparent;
        transition: text-decoration-color var(--mm-dur-press) var(--mm-ease);
      }
      .description {
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .indicator {
        flex: none;
        align-self: center;
        color: var(--mm-text-3);
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      /* The chevron and the open-in-new arrow point outward in right-to-left text. */
      :host(:dir(rtl)) .indicator {
        transform: scaleX(-1);
      }
      a.item:is(:hover, :focus-visible) {
        background: var(--mm-sunken);
      }
      a.item:is(:hover, :focus-visible) .title {
        text-decoration-color: currentColor;
      }
      a.item:is(:hover, :focus-visible) .indicator {
        color: var(--mm-text);
      }
    `,
  ];

  /** Destination URL. Without it the item is plain text. */
  @property({ reflect: true }) accessor href = '';
  /** Opens in a new tab with `rel="noopener noreferrer"`, shows open-in-new instead of the chevron and announces it. */
  @property({ type: Boolean, reflect: true }) accessor external = false;
  /** One line saying what is there. */
  @property() accessor description = '';
  /** A Material Symbols name for the leading icon, e.g. `dns`, `menu-book`. */
  @property() accessor icon = '';

  @state() accessor #slotted = new Set<string>();

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const next = new Set(this.#slotted);
    if (slot.assignedNodes({ flatten: false }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim())) next.add(slot.name);
    else next.delete(slot.name);
    this.#slotted = next;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  override render() {
    const link = !!this.href;
    const hasIcon = !!this.icon || this.#slotted.has('icon');
    const hasDescription = !!this.description || this.#slotted.has('description');
    const content = html`<span class="icon" part="icon" ?hidden=${!hasIcon}
        ><slot name="icon" @slotchange=${this.#onSlot}>${this.icon ? html`<mm-icon name=${this.icon}></mm-icon>` : nothing}</slot></span
      ><span class="text"
        ><span class="title" part="title"
          ><slot></slot>${link && this.external
            ? html`<span class="visually-hidden"> ${tr('opensInNewTab', '(opens in a new tab)')}</span>`
            : nothing}</span
        ><span
          class="description"
          part="description"
          id="description"
          aria-hidden=${ifDefined(link ? 'true' : undefined)}
          ?hidden=${!hasDescription}
          ><slot name="description" @slotchange=${this.#onSlot}>${this.description || nothing}</slot></span
        ></span
      >${link
        ? html`<mm-icon class="indicator" part="indicator" name=${this.external ? 'open-in-new' : 'chevron-right'}></mm-icon>`
        : nothing}`;
    if (!link) return html`<div class="item" part="item">${content}</div>`;
    return html`<a
      class="item"
      part="item"
      href=${this.href}
      target=${ifDefined(this.external ? '_blank' : undefined)}
      rel=${ifDefined(this.external ? 'noopener noreferrer' : undefined)}
      aria-describedby=${ifDefined(hasDescription ? 'description' : undefined)}
      >${content}</a
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-link-list': MmLinkList;
    'mm-link-list-item': MmLinkListItem;
  }
}
