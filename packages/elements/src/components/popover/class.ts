import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { activeDeep, containsDeep, tabbables } from '../dialog/focus.js';

export interface PopoverToggleDetail {
  open: boolean;
}

/** Styles shared by the floating panels (popover and hover card). */
export const panelStyles = css`
  :host {
    display: contents;
  }
  .panel {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    min-width: var(--mm-popover-min-width, 200px);
    max-width: min(var(--mm-popover-max-width, 360px), calc(100vw - var(--space-4)));
    padding: var(--mm-popover-padding, var(--space-4));
    color: var(--mm-text);
    background: var(--mm-raised);
    border: 1px solid var(--mm-rule);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-float);
    font: var(--text-dense);
    overflow: auto;
    overscroll-behavior: contain;
    opacity: 0;
    transform: scale(0.97);
    transition:
      opacity var(--mm-dur-menu) var(--mm-ease),
      transform var(--mm-dur-menu) var(--mm-ease),
      overlay var(--mm-dur-menu) allow-discrete,
      display var(--mm-dur-menu) allow-discrete;
  }
  .panel:popover-open {
    opacity: 1;
    transform: none;
  }
  @starting-style {
    .panel:popover-open {
      opacity: 0;
      transform: scale(0.97);
    }
  }
  .panel[data-instant] {
    transition: none;
  }
  .panel:focus-visible {
    outline-offset: -2px;
  }
  .panel[data-placement^='bottom'] { transform-origin: top; }
  .panel[data-placement^='top'] { transform-origin: bottom; }
  .panel[data-placement^='left'] { transform-origin: right; }
  .panel[data-placement^='right'] { transform-origin: left; }
  @media (prefers-reduced-motion: reduce) {
    .panel,
    .panel:popover-open {
      transform: none;
    }
  }
`;

/** Sets aria-expanded on a trigger, through `expanded` on elements such as `mm-button` that render their own button. */
export function setExpanded(trigger: HTMLElement, open: boolean, haspopup?: string): void {
  const t = trigger as HTMLElement & { expanded?: string; haspopup?: string };
  if ('expanded' in t) {
    t.expanded = open ? 'true' : 'false';
    if (haspopup) t.haspopup = haspopup;
  } else {
    trigger.setAttribute('aria-expanded', String(open));
    if (haspopup) trigger.setAttribute('aria-haspopup', haspopup);
  }
}

/**
 * Popovers hold a small piece of interactive content next to its trigger: a filter form, column
 * options, a share list. The panel is a raised layer (`mm-raised`, `radius-md`, `shadow-float`)
 * with square, simple edges and no arrow, positioned against the trigger and flipped to stay on
 * screen. It uses the native `popover="auto"` attribute, so it sits in the top layer, a click
 * outside closes it, and only one auto popover is open at a time.
 *
 * Wrap the trigger in the `trigger` slot, or point `for` at the id of a trigger in the same
 * document or shadow root, or set `anchor` to an element. The trigger toggles the popover and
 * carries `aria-expanded`. Escape closes it and returns focus to the trigger; Tab moves through
 * the content in document order (place a `for` popover straight after its trigger) and leaving it
 * closes the popover. It is non-modal: focus stays on the trigger unless something inside has
 * `autofocus`. Give it a `label` to expose the panel as a named, non-modal dialog. It fades over
 * `--mm-dur-menu`, and appears instantly when opened from the keyboard.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 *
 * @tagname mm-popover
 * @summary A non-modal panel anchored to a trigger.
 * @slot - The content.
 * @slot trigger - The element that toggles the popover.
 * @csspart panel - The floating panel.
 * @cssprop --mm-popover-padding - Panel padding. Defaults to `--space-4`.
 * @cssprop --mm-popover-min-width - Minimum width. Defaults to 200px.
 * @cssprop --mm-popover-max-width - Maximum width. Defaults to 360px.
 * @fires mm-toggle - {PopoverToggleDetail} The popover opened or closed.
 */
export class MmPopover extends LitElement {
  static override styles = [base, panelStyles];

  /** The id of the trigger, in the same document or shadow root. */
  @property({ attribute: 'for' }) accessor htmlFor = '';
  /** The trigger element, when it cannot be referenced by id. */
  @property({ attribute: false }) accessor anchor: HTMLElement | null = null;
  /** Floating UI placement against the trigger. */
  @property({ reflect: true }) accessor placement: Placement = 'bottom-start';
  /** Gap between the trigger and the panel, in pixels. */
  @property({ type: Number }) accessor offset = 4;
  /** Makes the panel at least as wide as the trigger. */
  @property({ type: Boolean, attribute: 'match-width' }) accessor matchWidth = false;
  /** Opens and closes the popover. Reflects. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Names the panel, which is then exposed as a non-modal dialog. */
  @property() accessor label = '';

  @query('.panel') accessor #panel!: HTMLElement | null;

  #trigger: HTMLElement | null = null;
  #slotted: HTMLElement | null = null;
  #cleanup?: () => void;
  #shown = false;
  #returnFocus = false;
  #openAtPointerDown = false;
  #ro?: ResizeObserver;

  /** The element that toggles the popover. */
  get trigger(): HTMLElement | null {
    return this.#trigger;
  }

  show(): void {
    this.open = true;
  }
  hide(): void {
    this.open = false;
  }
  toggle(force?: boolean): void {
    this.open = force ?? !this.open;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#resolveTrigger();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unfloat();
    this.#attach(null);
    this.#ro?.disconnect();
  }

  protected override firstUpdated(): void {
    this.#resolveTrigger();
    if (typeof ResizeObserver !== 'undefined' && this.#panel) {
      this.#ro = new ResizeObserver(() => this.#measure());
      this.#ro.observe(this.#panel);
    }
  }

  /** A panel whose content scrolls must be reachable from the keyboard, unless it already holds a control. */
  #measure() {
    const panel = this.#panel;
    if (!panel) return;
    const slot = panel.querySelector('slot:not([name])') as HTMLSlotElement;
    if (panel.scrollHeight > panel.clientHeight + 1 && !tabbables(slot).list.length) panel.tabIndex = 0;
    else panel.removeAttribute('tabindex');
  }

  protected override updated(changed: PropertyValues<this>): void {
    if ((changed.has('htmlFor') || changed.has('anchor')) && this.hasUpdated) this.#resolveTrigger();
    if (changed.has('open')) {
      if (this.open) this.#reveal();
      else if (this.#shown) this.#conceal();
    }
    if (changed.has('label') && this.#trigger) setExpanded(this.#trigger, this.open, this.label ? 'dialog' : undefined);
  }

  #resolveTrigger() {
    let el: HTMLElement | null = this.anchor;
    if (!el && this.htmlFor) {
      const root = this.getRootNode() as Document | ShadowRoot;
      el = (root.getElementById?.(this.htmlFor) as HTMLElement | null) ?? null;
    }
    this.#attach(el ?? this.#slotted);
  }

  #onSlotChange = (e: Event) => {
    this.#slotted = ((e.target as HTMLSlotElement).assignedElements()[0] as HTMLElement | undefined) ?? null;
    this.#resolveTrigger();
  };

  #attach(el: HTMLElement | null) {
    if (el === this.#trigger) return;
    const old = this.#trigger;
    if (old) {
      old.removeEventListener('pointerdown', this.#onTriggerPointerDown);
      old.removeEventListener('click', this.#onTriggerClick);
      old.removeEventListener('keydown', this.#onKeydown);
      old.removeEventListener('focusout', this.#onFocusOut);
    }
    this.#trigger = el;
    if (!el) return;
    el.addEventListener('pointerdown', this.#onTriggerPointerDown);
    el.addEventListener('click', this.#onTriggerClick);
    el.addEventListener('keydown', this.#onKeydown);
    el.addEventListener('focusout', this.#onFocusOut);
    setExpanded(el, this.open, this.label ? 'dialog' : undefined);
    if (this.open && !this.#shown) this.#reveal();
  }

  #onTriggerPointerDown = () => {
    // Light dismiss closes the popover before the click arrives, so remember it was open.
    this.#openAtPointerDown = this.open;
  };

  #onTriggerClick = (e: MouseEvent) => {
    const t = e.currentTarget as HTMLElement & { disabled?: boolean };
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const wasOpen = this.#openAtPointerDown || this.open;
    this.#openAtPointerDown = false;
    this.open = !wasOpen;
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !this.open || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    this.#returnFocus = true;
    this.open = false;
  };

  #onFocusOut = (e: FocusEvent) => {
    if (!this.open) return;
    const to = e.relatedTarget as Node | null;
    // Focus moving to nowhere (a click on plain content) keeps it open; light dismiss handles outside clicks.
    if (!to) return;
    const panel = this.#panel;
    if ((panel && containsDeep(panel, to)) || (this.#trigger && containsDeep(this.#trigger, to)) || containsDeep(this, to)) return;
    this.open = false;
  };

  #onToggle = (e: Event) => {
    const state = (e as ToggleEvent).newState;
    // Light dismiss and other popovers opening close the panel without us.
    if (state === 'closed' && this.open) this.open = false;
  };

  #reveal() {
    const panel = this.#panel;
    const trigger = this.#trigger;
    if (!panel || !trigger || !this.isConnected) return;
    panel.toggleAttribute('data-instant', openedFromKeyboard());
    try {
      if (!panel.matches(':popover-open')) panel.showPopover();
    } catch {
      this.open = false;
      return;
    }
    this.#unfloat();
    this.#cleanup = float(trigger, panel, { placement: this.placement, offset: this.offset, matchWidth: this.matchWidth });
    this.#shown = true;
    setExpanded(trigger, true, this.label ? 'dialog' : undefined);
    const { autofocus } = tabbables(panel.querySelector('slot:not([name])') as HTMLSlotElement);
    autofocus?.focus();
    emit<PopoverToggleDetail>(this, 'mm-toggle', { open: true });
  }

  #conceal() {
    this.#shown = false;
    this.#unfloat();
    const panel = this.#panel;
    try {
      if (panel?.matches(':popover-open')) panel.hidePopover();
    } catch {
      /* already closed */
    }
    const trigger = this.#trigger;
    if (trigger) setExpanded(trigger, false, this.label ? 'dialog' : undefined);
    const active = activeDeep();
    if (trigger && (this.#returnFocus || (panel && active && containsDeep(panel, active)))) trigger.focus({ preventScroll: true });
    this.#returnFocus = false;
    emit<PopoverToggleDetail>(this, 'mm-toggle', { open: false });
  }

  #unfloat() {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }

  override render() {
    return html`<slot name="trigger" @slotchange=${this.#onSlotChange}></slot
      ><div
        part="panel"
        class="panel"
        popover="auto"
        role=${ifDefined(this.label ? 'dialog' : undefined)}
        aria-label=${this.label || nothing}
        @toggle=${this.#onToggle}
        @keydown=${this.#onKeydown}
        @focusout=${this.#onFocusOut}
      >
        <slot></slot>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-popover': MmPopover;
  }
}
