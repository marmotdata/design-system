import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import { openedFromKeyboard, supportsPopover } from '../../core/floating.js';
import '../button/define.js';

/** Why the coachmark asked to close: Escape or its close button. */
export type CoachmarkDismissReason = 'escape' | 'close-button';

export interface CoachmarkDismissDetail {
  reason: CoachmarkDismissReason;
}

/**
 * A coachmark is one step of a guided tour. It points at a part of the page, dims everything
 * else and says in a sentence or two what that part is for, with the tour's buttons beneath.
 * Without a target it sits in the middle of the screen, for the welcome and the closing step.
 *
 * Give the element to point at as the `target` property, or its id as `for`. The spotlight is cut
 * around the target and follows it as the page scrolls or resizes. By default the target stays
 * usable through the spotlight, so a step can ask people to press the button it points at; set
 * `blocking` to keep the rest of the page and the target inert. A target taller than the screen,
 * such as a long list, is scrolled to its top edge and the card sits in its bottom corner, inside
 * the spotlight, so it never covers the heading of what it points at.
 *
 * The card is a non-modal dialog in the top layer, named by its heading. It takes focus when it
 * opens so screen readers announce the step, and Escape or the close button fire a cancelable
 * `mm-dismiss`: the app decides whether that ends the tour. Step counts are shown as "2 of 7",
 * and the buttons are the app's own, in the `actions` slot, so their labels stay in its
 * translations.
 *
 * @tagname mm-coachmark
 * @summary One step of a guided tour, pointing at part of the page.
 * @slot - The body: one or two short sentences.
 * @slot heading - A rich heading, in place of the `heading` attribute.
 * @slot actions - The tour's buttons, for example Back and Next. Put the primary button last.
 * @csspart spotlight - The cut-out around the target, which also draws the scrim.
 * @csspart card - The step card.
 * @csspart heading - The heading.
 * @csspart progress - The "2 of 7" caption.
 * @csspart body - The body.
 * @csspart actions - The actions row.
 * @csspart close - The close button.
 * @cssprop --mm-coachmark-width - The card's width. Defaults to 340px.
 * @fires mm-dismiss - {CoachmarkDismissDetail} Escape or the close button asked to end the tour. Cancel it to keep the step open.
 */
export class MmCoachmark extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: contents;
      }
      .layer {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
      }
      .layer:not(:popover-open):not([data-fallback]) {
        display: none;
      }
      :host([blocking]) .layer,
      .layer[data-centred] {
        pointer-events: auto;
      }
      .spotlight {
        position: fixed;
        border-radius: var(--radius-md);
        box-shadow: 0 0 0 100vmax var(--mm-scrim);
        pointer-events: none;
        transition:
          left var(--mm-dur-dialog) var(--mm-ease),
          top var(--mm-dur-dialog) var(--mm-ease),
          width var(--mm-dur-dialog) var(--mm-ease),
          height var(--mm-dur-dialog) var(--mm-ease),
          opacity var(--mm-dur-dialog) var(--mm-ease);
      }
      .spotlight[data-centred] {
        inset: 50%;
        width: 0;
        height: 0;
      }
      .card {
        position: fixed;
        top: 0;
        left: 0;
        box-sizing: border-box;
        width: min(var(--mm-coachmark-width, 340px), calc(100vw - var(--space-4)));
        display: grid;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-4) var(--space-4) var(--space-5);
        color: var(--mm-text);
        background: var(--mm-raised);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dialog);
        font: var(--text-body);
        pointer-events: auto;
        opacity: 0;
        transform: translateY(4px);
        transition:
          opacity var(--mm-dur-dialog) var(--mm-ease),
          transform var(--mm-dur-dialog) var(--mm-ease);
      }
      .card[data-shown] {
        opacity: 1;
        transform: none;
      }
      .card[data-centred] {
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        width: min(var(--mm-coachmark-width, 440px), calc(100vw - var(--space-4)));
      }
      :host([data-instant]) .card,
      :host([data-instant]) .spotlight {
        transition: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .card {
          transform: none;
        }
      }
      /* The card takes focus only so the step is announced; its buttons carry the visible focus. */
      .card:focus-visible {
        outline: none;
      }
      .header {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
      }
      .titles {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: var(--space-1);
        padding-block-start: var(--space-1);
      }
      .progress {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      h2 {
        margin: 0;
        font: var(--text-heading-sm);
        letter-spacing: var(--tracking-heading-sm);
        overflow-wrap: anywhere;
      }
      .close {
        flex: none;
        margin-block-start: -2px;
      }
      .body {
        font: var(--text-dense);
        color: var(--mm-text-2);
        padding-inline-end: var(--space-1);
        overflow-wrap: anywhere;
      }
      .body ::slotted(p) {
        margin: 0 0 var(--space-2);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
      }
      .actions[hidden] {
        display: none;
      }
    `,
  ];

  /** The heading, which also names the step. */
  @property() accessor heading = '';
  /** Shows the step. Reflects. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** The id of the element to point at, looked up in the coachmark's own root. */
  @property({ attribute: 'for' }) accessor htmlFor = '';
  /** The element to point at. Takes precedence over `for`. Without either, the card is centred. */
  @property({ attribute: false }) accessor target: Element | null = null;
  /** Where the card sits against the target. It flips and shifts to stay on screen. */
  @property() accessor placement: Placement = 'bottom-start';
  /** This step's number, counted from 1. With `steps`, shows "2 of 7". */
  @property({ type: Number }) accessor step = 0;
  /** How many steps the tour has. */
  @property({ type: Number }) accessor steps = 0;
  /** Space between the target and the edge of the spotlight, in pixels. */
  @property({ type: Number }) accessor padding = 6;
  /** Keeps the page, the target included, from being used while the step is open. */
  @property({ type: Boolean, reflect: true }) accessor blocking = false;
  /** Accessible name of the close button. Defaults to the `close` string. */
  @property({ attribute: 'close-label' }) accessor closeLabel = '';

  @state() accessor #hasActions = false;
  @state() accessor #shown = false;

  @query('.layer') accessor #layer!: HTMLElement | null;
  @query('.card') accessor #card!: HTMLElement | null;
  @query('.spotlight') accessor #spotlight!: HTMLElement | null;

  #stopTracking?: () => void;
  #returnFocus: Element | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#untrack();
  }

  /** The element the step points at, if it is in the page. */
  get resolvedTarget(): Element | null {
    if (this.target?.isConnected) return this.target;
    if (!this.htmlFor) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.htmlFor) ?? null;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open')) {
      if (this.open) this.#show();
      else this.#hide();
    } else if (this.open && (changed.has('target') || changed.has('htmlFor') || changed.has('placement') || changed.has('padding'))) {
      this.#track();
      this.#focusCard();
    }
  }

  #show(): void {
    const layer = this.#layer;
    if (!layer) return;
    this.toggleAttribute('data-instant', openedFromKeyboard());
    this.#returnFocus = document.activeElement;
    if (supportsPopover()) {
      if (!layer.matches(':popover-open')) layer.showPopover();
    } else {
      layer.dataset.fallback = '';
    }
    this.#track();
    requestAnimationFrame(() => {
      this.#shown = true;
      this.#focusCard();
    });
  }

  #hide(): void {
    this.#untrack();
    this.#shown = false;
    const layer = this.#layer;
    if (layer?.matches(':popover-open')) layer.hidePopover();
    if (layer) delete layer.dataset.fallback;
    const back = this.#returnFocus as HTMLElement | null;
    this.#returnFocus = null;
    if (back?.isConnected && this.#focusIsInside()) back.focus?.();
  }

  #focusIsInside(): boolean {
    let el: Element | null = document.activeElement;
    while (el) {
      if (el === this) return true;
      el = el.shadowRoot?.activeElement ?? null;
      if (el && this.shadowRoot?.contains(el)) return true;
    }
    return false;
  }

  #focusCard(): void {
    this.#card?.focus({ preventScroll: true });
  }

  #track(): void {
    this.#untrack();
    const card = this.#card;
    const spot = this.#spotlight;
    const target = this.resolvedTarget;
    if (!card || !spot) return;
    if (!target) {
      card.dataset.centred = '';
      spot.dataset.centred = '';
      this.#layer?.setAttribute('data-centred', '');
      Object.assign(card.style, { left: '', top: '' });
      Object.assign(spot.style, { left: '', top: '', width: '', height: '' });
      return;
    }
    delete card.dataset.centred;
    delete spot.dataset.centred;
    this.#layer?.removeAttribute('data-centred');
    const pad = this.padding;
    // A target taller than the screen cannot be shown whole, and a card placed against it lands on top of it. It is scrolled to its top edge so the spotlight frames where it starts, and the card sits in the bottom corner inside it rather than over its heading.
    const tall = () => target.getBoundingClientRect().height + pad * 2 > window.innerHeight - CARD_MARGIN * 2;
    if (tall()) scrollToTop(target);
    else target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const update = () => {
      const r = target.getBoundingClientRect();
      Object.assign(spot.style, {
        left: `${r.left - pad}px`,
        top: `${r.top - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      if (tall()) {
        const right = Math.min(r.right, window.innerWidth) - CARD_MARGIN;
        const bottom = Math.min(r.bottom, window.innerHeight) - CARD_MARGIN;
        Object.assign(card.style, {
          left: `${Math.max(CARD_MARGIN, right - card.offsetWidth)}px`,
          top: `${Math.max(CARD_MARGIN, bottom - card.offsetHeight)}px`,
        });
        card.dataset.placement = 'inside';
        return;
      }
      void computePosition(target, card, {
        strategy: 'fixed',
        placement: this.placement,
        // A wide target can leave no room on either side, so the card may also go above or below it and slide along both axes to stay on screen.
        middleware: [
          offset(pad + 10),
          flip({ padding: 12, fallbackPlacements: ['bottom-start', 'top-start', 'bottom-end', 'top-end'] }),
          shift({ padding: 12, crossAxis: true }),
        ],
      }).then(({ x, y, placement }) => {
        Object.assign(card.style, { left: `${x}px`, top: `${y}px` });
        card.dataset.placement = placement;
      });
    };
    this.#stopTracking = autoUpdate(target, card, update, { animationFrame: false });
  }

  #untrack(): void {
    this.#stopTracking?.();
    this.#stopTracking = undefined;
  }

  /** Asks to end the tour as Escape would: fires a cancelable `mm-dismiss`. */
  requestDismiss(reason: CoachmarkDismissReason = 'close-button'): boolean {
    return emit<CoachmarkDismissDetail>(this, 'mm-dismiss', { reason }, { cancelable: true });
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    this.requestDismiss('escape');
  };

  #onActions = (e: Event) => {
    this.#hasActions = (e.target as HTMLSlotElement).assignedElements().length > 0;
  };

  override render() {
    const progress = this.step > 0 && this.steps > 0 ? tr('coachmarkProgress', '{step} of {steps}', { step: this.step, steps: this.steps }) : '';
    return html`<div class="layer" popover="manual" @keydown=${this.#onKeydown}>
      <div class="spotlight" part="spotlight"></div>
      <div
        class="card"
        part="card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="heading"
        aria-describedby="body"
        tabindex="-1"
        ?data-shown=${this.#shown}
      >
        <div class="header">
          <div class="titles">
            ${progress ? html`<p class="progress" part="progress">${progress}</p>` : nothing}
            <h2 id="heading" part="heading"><slot name="heading">${this.heading}</slot></h2>
          </div>
          <mm-button
            class="close"
            part="close"
            variant="ghost"
            size="sm"
            icon="close"
            label=${this.closeLabel || t('close')}
            @click=${() => this.requestDismiss('close-button')}
          ></mm-button>
        </div>
        <div id="body" class="body" part="body"><slot></slot></div>
        <div class="actions" part="actions" ?hidden=${!this.#hasActions}>
          <slot name="actions" @slotchange=${this.#onActions}></slot>
        </div>
      </div>
    </div>`;
  }
}

/** The least space between the card and the edge of the screen, in pixels. */
const CARD_MARGIN = 16;

/** The next element up the composed tree, through slots and shadow roots. */
function composedParent(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot;
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * Brings a target's top edge to the top of the nearest container that scrolls it. Unlike
 * `scrollIntoView({ block: 'start' })` it moves only that container, so an app shell whose page
 * must not scroll keeps its top bar in place.
 */
function scrollToTop(target: Element): void {
  for (let el = composedParent(target); el; el = composedParent(el)) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollBy({ top: target.getBoundingClientRect().top - el.getBoundingClientRect().top - CARD_MARGIN });
      return;
    }
  }
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-coachmark': MmCoachmark;
  }
}
