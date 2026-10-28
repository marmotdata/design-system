import { LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { define } from '../../core/define.js';
import { t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';
export type ToastDismissReason = 'timeout' | 'close' | 'action' | 'escape' | 'api';

const ICONS: Record<ToastTone, string> = { info: 'info', success: 'check-circle', warning: 'warning', danger: 'error' };
const MAX_VISIBLE = 3;

/**
 * A toast confirms something that happened away from where the person is looking, such as a
 * pipeline finishing. It sits on `mm-raised` with `shadow-float`: a status icon, one sentence, an
 * optional action and a close button. Toasts dismiss themselves after 5 seconds; the timer pauses
 * while the pointer is over the toast or focus is inside it. Danger toasts stay until dismissed.
 * Escape closes the focused toast.
 *
 * Put toasts in an `mm-toaster`, or call `toast({ message })`, which uses one document-level
 * toaster. The toaster announces each message (politely, or assertively for danger), so the toast
 * itself carries no live region.
 *
 * @tagname mm-toast
 * @summary Transient confirmation of something that happened.
 * @slot - The message, if you need markup. Otherwise use the `message` attribute.
 * @csspart toast - The surface.
 * @csspart icon - The status icon.
 * @csspart message - The message.
 * @csspart action - The action button.
 * @csspart close - The close button.
 * @fires mm-action - {{}} The action button was activated. The toast then closes.
 * @fires mm-dismiss - {{ reason: 'timeout' | 'close' | 'action' | 'escape' | 'api' }} The toast closed and is about to be removed.
 */
export class MmToast extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        pointer-events: auto;
      }
      .toast {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        inline-size: min(400px, calc(100vw - 2 * var(--space-4)));
        min-block-size: 48px;
        padding-block: var(--space-2);
        padding-inline: var(--space-4) var(--space-2);
        background: var(--mm-raised);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-float);
        font: var(--text-dense);
        animation: enter var(--mm-dur-menu) var(--mm-ease);
      }
      @keyframes enter {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .toast {
          animation: none;
        }
      }
      .icon {
        flex: none;
      }
      .info .icon {
        color: var(--mm-info);
      }
      .success .icon {
        color: var(--mm-success);
      }
      .warning .icon {
        color: var(--mm-warning);
      }
      .danger .icon {
        color: var(--mm-danger);
      }
      .message {
        flex: 1;
        min-inline-size: 0;
        overflow-wrap: anywhere;
        padding-block: var(--space-1);
      }
      .close {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: 28px;
        block-size: 28px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease), color var(--mm-dur-press) var(--mm-ease);
      }
      .close:hover {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
    `,
  ];

  /** `info` (default), `success`, `warning` or `danger`. Danger toasts never auto-dismiss. */
  @property({ reflect: true }) accessor tone: ToastTone = 'info';
  /** The message, one sentence. */
  @property() accessor message = '';
  /** Label for an optional action button, e.g. "View run". Fires `mm-action`. */
  @property() accessor action = '';
  /** Milliseconds before auto-dismissal. 0 keeps the toast until closed. Ignored for danger. */
  @property({ type: Number }) accessor duration = 5000;

  #timer?: ReturnType<typeof setTimeout>;
  #remaining = 0;
  #startedAt = 0;
  #paused = 0;
  #started = false;

  get persistent(): boolean {
    return this.tone === 'danger' || !this.duration;
  }

  /** The message as plain text, for announcements. */
  get text(): string {
    return (this.textContent?.trim() || this.message).trim();
  }

  /** Starts the auto-dismiss timer. The toaster calls this when the toast becomes visible. */
  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#remaining = this.duration;
    this.#resume();
  }

  #resume() {
    if (!this.#started || this.persistent || this.#paused > 0) return;
    clearTimeout(this.#timer);
    this.#startedAt = performance.now();
    this.#timer = setTimeout(() => this.close('timeout'), this.#remaining);
  }
  #pause() {
    if (!this.#started || this.persistent) return;
    clearTimeout(this.#timer);
    this.#remaining = Math.max(500, this.#remaining - (performance.now() - this.#startedAt));
  }
  #hold = (on: boolean) => {
    const was = this.#paused;
    this.#paused = Math.max(0, this.#paused + (on ? 1 : -1));
    if (!was && this.#paused) this.#pause();
    if (was && !this.#paused) this.#resume();
  };

  /** Closes the toast: fires `mm-dismiss`, then removes it from the document. */
  close(reason: ToastDismissReason = 'api'): void {
    clearTimeout(this.#timer);
    emit(this, 'mm-dismiss', { reason });
    this.remove();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  override render() {
    const tone = ICONS[this.tone] ? this.tone : 'info';
    return html`<div
      part="toast"
      class="toast ${tone}"
      @pointerenter=${() => this.#hold(true)}
      @pointerleave=${() => this.#hold(false)}
      @focusin=${(e: FocusEvent) => !this.shadowRoot!.contains(e.relatedTarget as Node) && this.#hold(true)}
      @focusout=${(e: FocusEvent) => !this.shadowRoot!.contains(e.relatedTarget as Node) && this.#hold(false)}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.close('escape');
        }
      }}
    >
      <mm-icon part="icon" class="icon" name=${ICONS[tone]}></mm-icon>
      <div part="message" class="message"><slot></slot>${this.textContent?.trim() ? nothing : this.message}</div>
      ${this.action
        ? html`<mm-button
            part="action"
            size="sm"
            variant="secondary"
            @click=${() => {
              emit(this, 'mm-action', {});
              this.close('action');
            }}
            >${this.action}</mm-button
          >`
        : nothing}
      <button part="close" class="close" type="button" aria-label=${t('close')} @click=${() => this.close('close')}>
        <mm-icon name="close"></mm-icon>
      </button>
    </div>`;
  }
}

/**
 * The toaster is the fixed region, bottom-end of the viewport, that holds `mm-toast` elements. At
 * most three are visible; later toasts wait their turn and start their timers when shown. Each
 * new toast's message is written into a polite live region, or an assertive one for danger, so
 * screen readers hear it without the toast stealing focus. When the last toast closes while focus
 * was inside, focus returns to where it was before.
 *
 * @tagname mm-toaster
 * @summary Fixed region that stacks and announces toasts.
 * @slot - `mm-toast` elements, oldest first.
 * @csspart region - The stack.
 * @cssprop --mm-toaster-inset - Distance from the viewport edges. Defaults to `--space-6`.
 */
export class MmToaster extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        position: fixed;
        inset-block-end: var(--mm-toaster-inset, var(--space-6));
        inset-inline-end: var(--mm-toaster-inset, var(--space-6));
        z-index: var(--mm-z-toast);
        pointer-events: none;
      }
      .region {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-2);
        margin: 0;
        padding: 0;
      }
      ::slotted(mm-toast[data-queued]) {
        display: none;
      }
      @media (max-width: 480px) {
        :host {
          inset-inline: var(--space-4);
          inset-block-end: var(--space-4);
        }
      }
    `,
  ];

  /** Accessible name of the region. Defaults to "Notifications". */
  @property() accessor label = '';

  @state() accessor #polite = '';
  @state() accessor #assertive = '';
  #announced = new WeakSet<Element>();
  #returnFocus: HTMLElement | null = null;
  #observer?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof MutationObserver === 'undefined') return;
    this.#observer = new MutationObserver(() => this.#sync());
    this.#observer.observe(this, { childList: true });
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('mm-dismiss', this.#onDismiss);
    queueMicrotask(() => this.#sync());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.removeEventListener('focusin', this.#onFocusIn);
    this.removeEventListener('mm-dismiss', this.#onDismiss);
  }

  #onFocusIn = (e: FocusEvent) => {
    const from = e.relatedTarget as HTMLElement | null;
    if (from && !this.contains(from)) this.#returnFocus = from;
  };

  #onDismiss = (e: Event) => {
    const toast = e.target as MmToast;
    if (!(toast instanceof MmToast)) return;
    // Focus was inside the closing toast: hand it to the next toast, or back to where it came from.
    const active = document.activeElement;
    if (active !== toast && !toast.contains(active)) return;
    queueMicrotask(() => {
      this.#sync();
      const next = this.#toasts().find((t) => !t.hasAttribute('data-queued'));
      const target = next?.shadowRoot?.querySelector<HTMLElement>('.close') ?? this.#returnFocus;
      target?.focus();
      if (!next) this.#returnFocus = null;
    });
  };

  #toasts(): MmToast[] {
    return [...this.children].filter((c): c is MmToast => c instanceof MmToast);
  }

  #sync() {
    this.#toasts().forEach((toast, i) => {
      const queued = i >= MAX_VISIBLE;
      toast.toggleAttribute('data-queued', queued);
      if (queued) return;
      toast.start();
      if (!this.#announced.has(toast)) {
        this.#announced.add(toast);
        this.#announce(toast);
      }
    });
  }

  #announce(toast: MmToast) {
    const text = toast.text;
    if (!text) return;
    // Clear then set on the next frame so a repeated message is still announced.
    if (toast.tone === 'danger') {
      this.#assertive = '';
      requestAnimationFrame(() => (this.#assertive = text));
    } else {
      this.#polite = '';
      requestAnimationFrame(() => (this.#polite = text));
    }
  }

  override render() {
    return html`<section part="region" class="region" aria-label=${this.label || t('notifications')}>
        <slot></slot>
      </section>
      <div class="visually-hidden" aria-live="polite" aria-atomic="true">${this.#polite}</div>
      <div class="visually-hidden" aria-live="assertive" aria-atomic="true">${this.#assertive}</div>`;
  }
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  /** Action button label, e.g. "View run". */
  action?: string;
  /** Called when the action button is activated. */
  onAction?: () => void;
  /** Milliseconds before auto-dismissal; 0 persists. Danger always persists. */
  duration?: number;
  /** A specific toaster. Defaults to the document-level one, created on first use. */
  toaster?: MmToaster;
}

/**
 * Shows a toast on the document-level `mm-toaster`, creating it on first use. Returns the toast so
 * you can `close()` it.
 *
 * ```ts
 * toast({ tone: 'success', message: 'Pipeline snowflake-prod finished: 1,284 assets updated.', action: 'View run', onAction: openRun });
 * ```
 */
export function toast(options: ToastOptions): MmToast {
  // Registered on demand so the helper works from the class entry as well as the define entry.
  define('mm-toast', MmToast);
  define('mm-toaster', MmToaster);
  let toaster = options.toaster ?? document.querySelector<MmToaster>('mm-toaster[data-document]');
  if (!toaster) {
    toaster = document.createElement('mm-toaster') as MmToaster;
    toaster.setAttribute('data-document', '');
    document.body.append(toaster);
  }
  const el = document.createElement('mm-toast') as MmToast;
  el.message = options.message;
  el.tone = options.tone ?? 'info';
  if (options.duration !== undefined) el.duration = options.duration;
  if (options.action) {
    el.action = options.action;
    if (options.onAction) el.addEventListener('mm-action', options.onAction, { once: true });
  }
  toaster.append(el);
  return el;
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-toast': MmToast;
    'mm-toaster': MmToaster;
  }
}
