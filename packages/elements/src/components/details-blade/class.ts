import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import { deepActive, openedFromKeyboard } from '../../core/floating.js';
import { isRtl } from '../../core/roving.js';
import { uid } from '../../core/id.js';
import { clamp, readStored, resizeForKey, writeStored } from '../split-pane/resize.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';
import '../text/define.js';

const MIN_WIDTH = 320;

/**
 * The details blade is the 36rem (`blade-w`) side panel on an asset page: plain sections separated
 * by hairlines on `mm-chrome`, with a hairline on its inline-start edge. It is never a stack of
 * cards. The head carries the title, an optional "Full view" link and a close button. Identifiers
 * such as MRNs wrap anywhere.
 *
 * `mode="static"` (default) sits in the page grid as a labelled region. `mode="overlay"` slides
 * over the content from the inline-end edge with `shadow-float` (220ms, instant when opened or
 * closed from the keyboard, opacity only under reduced motion). It is a non-modal dialog: focus
 * moves to the close button when it opens and returns to where it was when it closes, and Escape
 * closes it.
 *
 * With `resizable`, the inline-start edge is a handle: drag it, or focus it (a `role="separator"`
 * with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`) and use Left and Right to resize by
 * 16px (flipped in right-to-left layouts) or Home and End for the minimum (320px) and maximum (half
 * the viewport). The width is remembered in `localStorage` under `storage-key`. With `collapsible`,
 * a button folds the blade to a 3rem rail, as the asset blade does.
 *
 * Pattern for the handle: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 *
 * @tagname mm-details-blade
 * @summary The 36rem side panel of sections on an asset page.
 * @slot - `mm-blade-section` elements.
 * @slot heading - The title, if it needs markup. Otherwise use `heading`.
 * @slot actions - Extra head buttons, before the "Full view" link.
 * @slot footer - Content pinned under the sections.
 * @csspart blade - The region or dialog.
 * @csspart head - The head row.
 * @csspart heading - The `mm-heading`.
 * @csspart full-view - The "Full view" link.
 * @csspart close - The close button.
 * @csspart collapse - The collapse toggle.
 * @csspart handle - The resize handle.
 * @csspart body - The scrolling sections wrapper.
 * @fires mm-close - {{}} The close button or Escape asked to close. Cancelable; in overlay mode the blade closes itself unless cancelled.
 * @fires mm-resize - {{ width: number }} The blade was resized by pointer or keyboard, in pixels.
 * @fires mm-collapse - {{ collapsed: boolean }} The blade was folded to its rail or expanded.
 */
export class MmDetailsBlade extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        --_dir: 1;
        display: block;
        position: relative;
        inline-size: var(--_w, var(--blade-w));
        max-inline-size: 100%;
        min-block-size: 0;
        block-size: 100%;
        background: var(--mm-chrome);
        color: var(--mm-text);
        border-inline-start: 1px solid var(--mm-rule);
      }
      :host([data-rtl]) {
        --_dir: -1;
      }
      :host([collapsed]) {
        inline-size: var(--space-12);
      }
      :host([mode='overlay']) {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        block-size: auto;
        max-inline-size: 100vw;
        z-index: var(--mm-z-blade);
        box-shadow: var(--shadow-float);
        transition:
          transform var(--mm-dur-dialog) var(--mm-ease),
          visibility 0s linear 0s;
      }
      :host([mode='overlay']:not([open])) {
        transform: translateX(calc(var(--_dir) * 100%));
        visibility: hidden;
        transition:
          transform var(--mm-dur-dialog) var(--mm-ease),
          visibility 0s linear var(--mm-dur-dialog);
      }
      :host([data-instant]) {
        transition: none !important;
      }
      @media (prefers-reduced-motion: reduce) {
        :host([mode='overlay']) {
          transition:
            opacity var(--mm-dur-dialog) var(--mm-ease),
            visibility 0s linear 0s;
        }
        :host([mode='overlay']:not([open])) {
          transform: none;
          opacity: 0;
          transition:
            opacity var(--mm-dur-dialog) var(--mm-ease),
            visibility 0s linear var(--mm-dur-dialog);
        }
      }
      .blade {
        display: flex;
        flex-direction: column;
        block-size: 100%;
        min-block-size: 0;
      }
      .head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: calc(var(--space-12) + var(--space-1));
        padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
        border-block-end: 1px solid var(--mm-rule);
        flex: none;
      }
      :host([collapsible]) .head {
        padding-inline-start: var(--space-3);
      }
      :host([collapsed]) .head {
        flex-direction: column;
        padding: var(--space-2) 0;
        border-block-end: 0;
      }
      mm-heading {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .full {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        flex: none;
        font: var(--text-label);
        color: var(--mm-text);
        text-decoration: none;
        border-radius: var(--radius-sm);
        min-block-size: 24px;
        padding-inline: var(--space-1);
      }
      .full:hover,
      .full:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .body {
        flex: 1;
        min-block-size: 0;
        overflow: auto;
        overflow-wrap: anywhere;
      }
      .footer {
        flex: none;
        border-block-start: 1px solid var(--mm-rule);
        padding: var(--space-4) var(--space-5);
      }
      .handle {
        position: absolute;
        inset-block: 0;
        inset-inline-start: -7px;
        inline-size: 12px;
        z-index: 1;
        cursor: col-resize;
        touch-action: none;
        border-radius: var(--radius-sm);
      }
      .handle::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 5px;
        inline-size: 2px;
        background: transparent;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .handle:hover::before {
        background: var(--mm-control-border);
      }
      .handle:focus-visible::before,
      :host([data-dragging]) .handle::before {
        background: var(--mm-text);
      }
      :host([data-dragging]) {
        user-select: none;
        cursor: col-resize;
      }
      [hidden] {
        display: none !important;
      }
    `,
  ];

  /** The title, usually the asset name. */
  @property() accessor heading = '';
  /** Outline level of the title. */
  @property({ type: Number }) accessor level = 2;
  /** `static` (in the page grid, default) or `overlay` (slides over the content). */
  @property({ reflect: true }) accessor mode: 'static' | 'overlay' = 'static';
  /** Overlay mode: whether the blade is showing. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Href of the "Full view" link in the head. */
  @property({ attribute: 'full-view-href' }) accessor fullViewHref = '';
  /** Text of the full view link. Defaults to "Full view". */
  @property({ attribute: 'full-view-label' }) accessor fullViewLabel = '';
  /** Shows a close button in static mode. Overlay mode always has one. */
  @property({ type: Boolean, reflect: true }) accessor closable = false;
  /** Adds the edge resize handle. */
  @property({ type: Boolean, reflect: true }) accessor resizable = false;
  /** Width in pixels. Unset, the blade is `blade-w` (36rem). */
  @property({ type: Number }) accessor width: number | undefined;
  /** `localStorage` key that remembers the width. */
  @property({ attribute: 'storage-key' }) accessor storageKey = '';
  /** Adds a button that folds the blade to a 3rem rail. */
  @property({ type: Boolean, reflect: true }) accessor collapsible = false;
  /** Folded to the 3rem rail. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;
  /** Accessible name of the resize handle. Defaults to "Resize details". */
  @property({ attribute: 'handle-label' }) accessor handleLabel = '';

  @state() accessor #measured = 0;
  @state() accessor #viewport = 0;
  /** True when the body overflows and holds nothing focusable, so it needs to be a Tab stop to scroll. */
  @state() accessor #bodyNeedsFocus = false;
  #bodyRo?: ResizeObserver;
  @query('.close') accessor #close!: HTMLElement | null;
  @query('.handle') accessor #handle!: HTMLElement | null;
  #id = uid('blade');
  #returnTo: HTMLElement | null = null;
  #drag?: { start: number; from: number };

  get #max(): number {
    return Math.max(MIN_WIDTH, Math.floor((this.#viewport || 1280) / 2));
  }

  get #current(): number {
    return Math.round(clamp(this.width ?? this.#measured ?? MIN_WIDTH, MIN_WIDTH, this.#max));
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onHostKeydown);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.width === undefined) {
      const stored = readStored(this.storageKey);
      if (stored !== undefined) this.width = stored;
    }
    if (typeof window !== 'undefined') {
      this.#viewport = window.innerWidth;
      window.addEventListener('resize', this.#onWindowResize);
      this.toggleAttribute('data-rtl', isRtl(this));
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.#onWindowResize);
    this.#bodyRo?.disconnect();
  }

  /** A scrolling body with no focusable content can only be scrolled from the keyboard if it takes focus. */
  #checkBody = () => {
    const body = this.renderRoot.querySelector<HTMLElement>('.body');
    if (!body) return;
    const overflows = body.scrollHeight > body.clientHeight + 1;
    const focusable = this.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), mm-button, mm-link, mm-tag[href]');
    this.#bodyNeedsFocus = overflows && !focusable;
  };

  #onWindowResize = () => {
    this.#viewport = window.innerWidth;
  };

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('open') && changed.get('open') !== undefined && this.mode === 'overlay') {
      this.toggleAttribute('data-instant', openedFromKeyboard());
      if (this.open) this.#returnTo = deepActive() as HTMLElement | null;
    }
  }

  protected override firstUpdated(): void {
    this.#measured = Math.round(this.getBoundingClientRect().width);
    const body = this.renderRoot.querySelector<HTMLElement>('.body');
    if (body && typeof ResizeObserver !== 'undefined') {
      this.#bodyRo = new ResizeObserver(this.#checkBody);
      this.#bodyRo.observe(body);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('width')) {
      if (this.width === undefined) this.style.removeProperty('--_w');
      else this.style.setProperty('--_w', `${this.#current}px`);
      if (this.width === undefined) this.#measured = Math.round(this.getBoundingClientRect().width);
    }
    if (changed.has('open') && changed.get('open') !== undefined && this.mode === 'overlay') {
      if (this.open) {
        // Focus moves in once the blade is visible; visibility switches immediately on open.
        requestAnimationFrame(() => (this.#close ?? (this.renderRoot.querySelector('.blade') as HTMLElement | null))?.focus());
      } else {
        const active = deepActive();
        const inside = !active || active === document.body || this.#owns(active);
        if (inside && this.#returnTo?.isConnected) this.#returnTo.focus();
        this.#returnTo = null;
      }
    }
  }

  /** True when `el` is this blade or inside it, through slots' light DOM and nested shadow roots. */
  #owns(el: Node): boolean {
    let n: Node | null = el;
    while (n) {
      if (n === this) return true;
      n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
    }
    return false;
  }

  /** Opens the overlay blade. */
  show(): void {
    this.open = true;
  }

  /** Closes the overlay blade (without firing `mm-close`). */
  hide(): void {
    this.open = false;
  }

  #requestClose = () => {
    if (!emit(this, 'mm-close', {}, { cancelable: true })) return;
    if (this.mode === 'overlay') this.open = false;
  };

  #onHostKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || this.mode !== 'overlay' || !this.open || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    this.#requestClose();
  };

  #toggleCollapsed = () => {
    this.collapsed = !this.collapsed;
    emit(this, 'mm-collapse', { collapsed: this.collapsed });
  };

  #setWidth(value: number, persist: boolean) {
    this.width = Math.round(clamp(value, MIN_WIDTH, this.#max));
    if (persist) {
      writeStored(this.storageKey, this.width);
      emit(this, 'mm-resize', { width: this.width });
    }
  }

  #onHandleKeydown = (e: KeyboardEvent) => {
    this.#viewport = window.innerWidth;
    const next = resizeForKey(e, {
      value: this.#current,
      min: MIN_WIDTH,
      max: this.#max,
      orientation: 'vertical',
      rtl: isRtl(this),
      growsTowardEnd: false,
    });
    if (next === null) return;
    e.preventDefault();
    this.#setWidth(next, true);
  };

  #coord(e: PointerEvent) {
    // The handle is on the inline-start edge, so the blade grows as the pointer moves toward it.
    return isRtl(this) ? e.clientX : -e.clientX;
  }

  #onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !this.#handle) return;
    e.preventDefault();
    this.#viewport = window.innerWidth;
    this.#handle.setPointerCapture(e.pointerId);
    this.#drag = { start: this.#coord(e), from: this.#current };
    this.setAttribute('data-dragging', '');
  };

  #onPointerMove = (e: PointerEvent) => {
    if (!this.#drag) return;
    this.#setWidth(this.#drag.from + this.#coord(e) - this.#drag.start, false);
  };

  #onPointerUp = (e: PointerEvent) => {
    if (!this.#drag) return;
    this.#drag = undefined;
    this.removeAttribute('data-dragging');
    if (this.#handle?.hasPointerCapture(e.pointerId)) this.#handle.releasePointerCapture(e.pointerId);
    this.#setWidth(this.#current, true);
  };

  #head() {
    const rtl = this.hasAttribute('data-rtl');
    const side = rtl ? 'left' : 'right';
    const closable = (this.closable || this.mode === 'overlay') && !this.collapsed;
    // One template for both states, so the collapse toggle keeps its identity and focus.
    return html`<div class="head" part="head">
      ${this.collapsible
        ? html`<mm-button
            class="collapse"
            part="collapse"
            variant="ghost"
            size="sm"
            icon=${this.collapsed ? `${side}-panel-open` : `${side}-panel-close`}
            label=${this.collapsed ? tr('expandDetails', 'Expand details') : tr('collapseDetails', 'Collapse details')}
            expanded=${this.collapsed ? 'false' : 'true'}
            @click=${this.#toggleCollapsed}
          ></mm-button>`
        : nothing}
      <mm-heading part="heading" level=${this.level} variant="heading-sm" ?hidden=${this.collapsed}
        ><slot name="heading">${this.heading}</slot></mm-heading
      >
      <div class="actions" ?hidden=${this.collapsed}><slot name="actions"></slot></div>
      ${this.fullViewHref && !this.collapsed
        ? html`<a class="full" part="full-view" href=${this.fullViewHref}
            ><mm-icon name="open-in-full" aria-hidden="true"></mm-icon>${this.fullViewLabel || tr('fullView', 'Full view')}</a
          >`
        : nothing}
      ${closable
        ? html`<mm-button class="close" part="close" variant="ghost" size="sm" icon="close" label=${t('close')} @click=${this.#requestClose}></mm-button>`
        : nothing}
    </div>`;
  }

  override render() {
    const overlay = this.mode === 'overlay';
    const name = this.heading || tr('details', 'Details');
    const handle =
      this.resizable && !this.collapsed
        ? html`<div
            class="handle"
            part="handle"
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            aria-label=${this.handleLabel || tr('resizeDetails', 'Resize details')}
            aria-controls="${this.#id}-blade"
            aria-valuenow=${this.#current}
            aria-valuemin=${MIN_WIDTH}
            aria-valuemax=${this.#max}
            @keydown=${this.#onHandleKeydown}
            @pointerdown=${this.#onPointerDown}
            @pointermove=${this.#onPointerMove}
            @pointerup=${this.#onPointerUp}
            @pointercancel=${this.#onPointerUp}
          ></div>`
        : nothing;
    const body = html`${handle}${this.#head()}
      <div
        class="body"
        part="body"
        id="${this.#id}-body"
        ?hidden=${this.collapsed}
        tabindex=${ifDefined(this.#bodyNeedsFocus ? '0' : undefined)}
        role=${ifDefined(this.#bodyNeedsFocus ? 'group' : undefined)}
        aria-label=${ifDefined(this.#bodyNeedsFocus ? this.heading || undefined : undefined)}
      ><slot @slotchange=${this.#checkBody}></slot></div>
      <div class="footer" ?hidden=${this.collapsed}><slot name="footer"></slot></div>`;
    return overlay
      ? html`<div class="blade" part="blade" id="${this.#id}-blade" role="dialog" aria-modal="false" aria-label=${name} tabindex="-1">${body}</div>`
      : html`<section class="blade" part="blade" id="${this.#id}-blade" aria-label=${name}>${body}</section>`;
  }
}

/**
 * One section of a details blade: a 13px/700 title, optional actions at the end of the title row and
 * the content, usually an `mm-description-list` or an `mm-list`. Sections are separated by hairlines
 * and padded `space-5`; they are never cards.
 *
 * With `collapsible`, the title becomes a button with a trailing chevron that shows and hides the
 * content (closed by default; set `open`), for secondary detail such as "More details". The title
 * keeps the same style and position as every other section. It follows the WAI-ARIA disclosure
 * pattern: Enter or Space toggles, and the button states `aria-expanded`.
 *
 * @tagname mm-blade-section
 * @summary A titled section of the details blade.
 * @slot - The content.
 * @slot heading - The title, if it needs markup. Otherwise use `heading`.
 * @slot actions - Small ghost buttons such as "Edit".
 * @csspart heading - The native heading.
 * @csspart toggle - The title button of a collapsible section.
 * @csspart body - The content wrapper.
 * @fires mm-toggle - {{ open: boolean }} A collapsible section was opened or closed by the person.
 */
export class MmBladeSection extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        padding: var(--space-5);
        min-width: 0;
      }
      :host(:not(:first-child)) {
        border-block-start: 1px solid var(--mm-rule);
      }
      :host([flush]) {
        padding-inline: 0;
      }
      :host([flush]) .head {
        padding-inline: var(--space-5);
      }
      .head {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: 24px;
        margin-block-end: var(--space-3);
      }
      .h {
        flex: 1;
        min-width: 0;
        margin: 0;
        font: var(--text-dense);
        font-weight: 700;
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      .body {
        min-width: 0;
        font: var(--text-dense);
        overflow-wrap: anywhere;
      }
      :host([collapsible]:not([open])) .head {
        margin-block-end: 0;
      }
      .toggle {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        inline-size: 100%;
        cursor: pointer;
        border-radius: var(--radius-sm);
      }
      .toggle:focus-visible {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
      .chev {
        flex: none;
        color: var(--mm-text-2);
        transition: transform var(--mm-dur-press) var(--mm-ease);
      }
      .toggle:hover .chev {
        color: var(--mm-text);
      }
      :host([open]) .chev {
        transform: rotate(180deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .chev {
          transition: none;
        }
      }
    `,
  ];

  /** The title. */
  @property() accessor heading = '';
  /** Outline level of the title, 2 to 6. Defaults to 3, under the blade's level 2 title. */
  @property({ type: Number }) accessor level = 3;
  /** Lets lists run edge to edge while the title keeps its padding. */
  @property({ type: Boolean, reflect: true }) accessor flush = false;
  /** The title shows and hides the content. */
  @property({ type: Boolean, reflect: true }) accessor collapsible = false;
  /** Whether a collapsible section's content is shown. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  #toggle() {
    this.open = !this.open;
    emit(this, 'mm-toggle', { open: this.open });
  }

  override render() {
    const label = html`<slot name="heading">${this.heading}</slot>`;
    const text = this.collapsible
      ? html`<button class="toggle" part="toggle" type="button" aria-expanded=${this.open ? 'true' : 'false'} aria-controls="body" @click=${this.#toggle}>
          <span>${label}</span><mm-icon class="chev" name="expand-more" size="16" aria-hidden="true"></mm-icon>
        </button>`
      : label;
    const lvl = Math.min(6, Math.max(2, Math.round(this.level) || 3));
    const h =
      lvl === 2
        ? html`<h2 class="h" part="heading">${text}</h2>`
        : lvl === 3
          ? html`<h3 class="h" part="heading">${text}</h3>`
          : lvl === 4
            ? html`<h4 class="h" part="heading">${text}</h4>`
            : lvl === 5
              ? html`<h5 class="h" part="heading">${text}</h5>`
              : html`<h6 class="h" part="heading">${text}</h6>`;
    return html`<div class="head">${h}<slot name="actions"></slot></div>
      <div class="body" part="body" id="body" ?hidden=${this.collapsible && !this.open}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-details-blade': MmDetailsBlade;
    'mm-blade-section': MmBladeSection;
  }
}
