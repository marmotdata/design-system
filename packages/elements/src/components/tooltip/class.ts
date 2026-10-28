import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { base } from '../../core/styles.js';
import { float } from '../../core/floating.js';
import { uid } from '../../core/id.js';

export interface TooltipItem {
  label: string;
  value: string | number;
}

/**
 * Tooltips are square-cornered and ink-filled, in caption type, and appear instantly with no
 * delay or animation. They hide on Escape, when the pointer leaves and when focus moves away.
 * Keep them to a short phrase that adds to the trigger's name; never put actions or essential
 * information in one. `variant="data"` is the chart tooltip: mono key and value pairs with
 * tabular numbers, driven by `items`.
 *
 * Attach with `for` (the id of a trigger in the same document or shadow root; the tooltip's text
 * is its content and the trigger gets `aria-describedby`), or wrap a single trigger and give the
 * text in `content` (the trigger gets `aria-description`, since a description cannot reach into
 * a shadow root). Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 *
 * @tagname mm-tooltip
 * @summary A short, instant description of a control or a data point.
 * @slot - With `for`, the tooltip text. Otherwise, the trigger.
 * @slot content - Rich tooltip text when wrapping a trigger, instead of `content`.
 * @csspart tooltip - The ink box.
 */
export class MmTooltip extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-block;
      }
      :host([popover]) {
        display: block;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
      }
      :host([popover]:not(:popover-open)) {
        display: none;
      }
      .tip {
        margin: 0;
        inset: auto;
        border: 0;
        overflow: visible;
        max-inline-size: 280px;
        padding: 6px var(--space-2);
        border-radius: 0;
        background: var(--mm-text);
        color: var(--mm-on-inverse);
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        overflow-wrap: anywhere;
        pointer-events: none;
        transition: none;
      }
      .tip[popover] {
        position: fixed;
      }
      dl {
        display: grid;
        grid-template-columns: auto auto;
        gap: 2px var(--space-3);
        margin: 0;
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        font-variant-numeric: tabular-nums;
      }
      :host([variant='data']) .tip {
        padding: var(--space-2) 10px;
        max-inline-size: 360px;
      }
      dt {
        opacity: 0.75;
      }
      dd {
        margin: 0;
        text-align: end;
      }
    `,
  ];

  /** The id of the trigger, in the same document or shadow root. The tooltip's content is its text. */
  @property({ attribute: 'for' }) accessor htmlFor = '';
  /** Tooltip text when wrapping a trigger. */
  @property() accessor content = '';
  /** Placement against the trigger. */
  @property() accessor placement: Placement = 'top';
  /** `default` (caption text) or `data` (mono key and value pairs from `items`). */
  @property({ reflect: true }) accessor variant: 'default' | 'data' = 'default';
  /** Key and value pairs for `variant="data"`. */
  @property({ attribute: false }) accessor items: TooltipItem[] = [];
  /** Whether the tooltip is showing. Set it to show a data tooltip under program control. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  #trigger: HTMLElement | null = null;
  #cleanup?: () => void;
  #virtual: { getBoundingClientRect(): DOMRect; contextElement?: Element } | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.htmlFor) this.#setupFor();
  }

  protected override firstUpdated(): void {
    // The trigger may come later in the document than the tooltip.
    if (this.htmlFor && !this.#trigger) this.#setupFor();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unfloat();
    this.#detach();
    document.removeEventListener('keydown', this.#onDocKeydown, true);
  }

  /** The element the tooltip describes. */
  get trigger(): HTMLElement | null {
    return this.#trigger;
  }

  /** Shows the tooltip against its trigger. */
  show(): void {
    this.#virtual = null;
    this.open = true;
  }

  hide(): void {
    this.open = false;
  }

  /** Shows the tooltip at a viewport point, for chart hover. */
  showAt(x: number, y: number): void {
    this.#virtual = { getBoundingClientRect: () => new DOMRect(x, y, 0, 0), contextElement: this.#trigger ?? this };
    if (this.open) this.#position();
    this.open = true;
  }

  get #popover(): HTMLElement | null {
    return this.htmlFor ? this : this.renderRoot?.querySelector<HTMLElement>('.tip') ?? null;
  }

  #setupFor() {
    if (!this.id) this.id = uid('mm-tooltip');
    this.setAttribute('popover', 'manual');
    this.setAttribute('role', 'tooltip');
    const root = this.getRootNode() as Document | ShadowRoot;
    this.#attach((root.getElementById?.(this.htmlFor) as HTMLElement | null) ?? null);
  }

  #onSlotChange = (e: Event) => {
    if (this.htmlFor) return;
    const el = (e.target as HTMLSlotElement).assignedElements()[0] as HTMLElement | undefined;
    this.#attach(el ?? null);
  };

  #attach(el: HTMLElement | null) {
    if (el === this.#trigger) return;
    this.#detach();
    this.#trigger = el;
    if (!el) return;
    el.addEventListener('pointerenter', this.#onEnter);
    el.addEventListener('pointerleave', this.#onLeave);
    el.addEventListener('focusin', this.#onEnter);
    el.addEventListener('focusout', this.#onLeave);
    this.#describe();
    if (this.open) this.#reveal();
  }

  #detach() {
    const el = this.#trigger;
    if (!el) return;
    el.removeEventListener('pointerenter', this.#onEnter);
    el.removeEventListener('pointerleave', this.#onLeave);
    el.removeEventListener('focusin', this.#onEnter);
    el.removeEventListener('focusout', this.#onLeave);
    if (this.htmlFor) {
      const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== this.id);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    } else {
      el.removeAttribute('aria-description');
    }
    this.#trigger = null;
  }

  #text(): string {
    if (this.variant === 'data') return this.items.map((i) => `${i.label} ${i.value}`).join(', ');
    const slotted = this.querySelector('[slot="content"]')?.textContent?.trim();
    return slotted || this.content;
  }

  #describe() {
    const el = this.#trigger;
    if (!el) return;
    if (this.htmlFor) {
      const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
      ids.add(this.id);
      el.setAttribute('aria-describedby', [...ids].join(' '));
    } else {
      const text = this.#text();
      if (text) el.setAttribute('aria-description', text);
      else el.removeAttribute('aria-description');
    }
  }

  #onEnter = () => this.show();
  #onLeave = () => this.hide();
  #onDocKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.hide();
  };

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('htmlFor') && changed.get('htmlFor') !== undefined) {
      this.#detach();
      if (this.htmlFor) this.#setupFor();
      else {
        this.removeAttribute('popover');
        this.removeAttribute('role');
      }
    }
    if (!this.htmlFor && (changed.has('content') || changed.has('items') || changed.has('variant'))) this.#describe();
    if (changed.has('open')) {
      if (this.open) this.#reveal();
      else if (changed.get('open')) this.#conceal();
    }
  }

  #reveal() {
    const pop = this.#popover;
    // Without a trigger yet (the slot has not settled), showing waits for #attach.
    if (!pop || (!this.#trigger && !this.#virtual)) return;
    try {
      if (!pop.matches(':popover-open')) pop.showPopover();
    } catch {
      return;
    }
    this.#position();
    document.addEventListener('keydown', this.#onDocKeydown, true);
  }

  #position() {
    const pop = this.#popover;
    const ref = (this.#virtual as unknown as Element | null) ?? this.#trigger;
    if (!pop || !ref) return;
    this.#unfloat();
    this.#cleanup = float(ref, pop, { placement: this.placement, offset: 6 });
  }

  #unfloat() {
    this.#cleanup?.();
    this.#cleanup = undefined;
  }

  #conceal() {
    this.#unfloat();
    document.removeEventListener('keydown', this.#onDocKeydown, true);
    try {
      this.#popover?.hidePopover();
    } catch {
      /* not open */
    }
  }

  #body() {
    if (this.variant === 'data') {
      return html`<dl>
        ${this.items.map((i) => html`<dt>${i.label}</dt><dd>${i.value}</dd>`)}
      </dl>`;
    }
    return this.htmlFor ? html`<slot>${this.content}</slot>` : html`<slot name="content">${this.content}</slot>`;
  }

  override render() {
    if (this.htmlFor) return html`<div class="tip" part="tooltip">${this.#body()}</div>`;
    return html`<slot @slotchange=${this.#onSlotChange}></slot
      ><div class="tip" part="tooltip" popover="manual" role="tooltip" aria-hidden="true">${this.#body()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-tooltip': MmTooltip;
  }
}

