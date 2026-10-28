import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

export const TONE_ICONS: Record<CalloutTone, string> = {
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  danger: 'error',
};

/**
 * Callouts surface one message inside a page: a stale source, a truncated result, a failed run.
 * A soft status fill, a 16px status icon, a bold heading in ink written as a full sentence, and a
 * body in `mm-text-2` that says what to do. No coloured stripe and no border.
 *
 * `compact` is the inline alert: one line, smaller padding, for forms and table toolbars.
 *
 * Callouts are `role="status"`, so changes are announced politely. Set `urgent` only when the
 * message must interrupt (a query that was just denied), which makes it `role="alert"`. With
 * `dismissible`, the close button fires `mm-dismiss` and hides the callout unless the event is
 * cancelled. Escape inside the callout also dismisses it.
 *
 * @tagname mm-callout
 * @summary One message inside a page.
 * @slot - The body: what happened and what to do.
 * @slot heading - The heading, if you need markup. Otherwise use the `heading` attribute.
 * @slot actions - Buttons, e.g. `<mm-button size="sm">Open pipeline</mm-button>`.
 * @csspart callout - The container.
 * @csspart icon - The status icon.
 * @csspart heading - The heading.
 * @csspart body - The body.
 * @csspart actions - The actions row.
 * @csspart dismiss - The close button.
 * @fires mm-dismiss - {{ tone: string }} The close button was activated. Cancel it to keep the callout visible.
 */
export class MmCallout extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .callout {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr) auto;
        column-gap: 10px;
        row-gap: 2px;
        padding-block: var(--space-3);
        padding-inline: var(--space-4);
        border-radius: var(--radius-md);
        font: var(--text-dense);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .info {
        background: var(--mm-info-soft);
        --_icon: var(--mm-info);
      }
      .success {
        background: var(--mm-success-soft);
        --_icon: var(--mm-success);
      }
      .warning {
        background: var(--mm-warning-soft);
        --_icon: var(--mm-warning);
      }
      .danger {
        background: var(--mm-danger-soft);
        --_icon: var(--mm-danger);
      }
      .icon {
        grid-row: 1;
        grid-column: 1;
        margin-block-start: 1px;
        color: var(--_icon);
      }
      .text {
        grid-column: 2;
        min-inline-size: 0;
      }
      .heading {
        display: block;
        font-weight: 700;
        color: var(--mm-text);
      }
      .body {
        display: block;
        margin: 0;
      }
      .body ::slotted(p) {
        margin: 0;
      }
      .heading-empty {
        display: none;
      }
      .actions {
        grid-column: 2;
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
      }
      .actions:not(.has) {
        display: none;
      }
      .dismiss {
        grid-column: 3;
        grid-row: 1;
        display: inline-grid;
        place-items: center;
        inline-size: 24px;
        block-size: 24px;
        margin-block: -4px;
        margin-inline-end: -6px;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease), color var(--mm-dur-press) var(--mm-ease);
      }
      .dismiss:hover {
        color: var(--mm-text);
        background: color-mix(in oklab, var(--mm-text) 8%, transparent);
      }

      /* Compact: the inline alert. One line, heading and body run together. */
      :host([compact]) .callout {
        align-items: center;
        padding-block: var(--space-2);
        padding-inline: var(--space-3);
        column-gap: var(--space-2);
        grid-template-columns: 16px minmax(0, 1fr) auto auto;
      }
      :host([compact]) .icon {
        margin: 0;
      }
      :host([compact]) .heading,
      :host([compact]) .body {
        display: inline;
      }
      :host([compact]) .heading:not(.heading-empty)::after {
        content: ' ';
      }
      :host([compact]) .actions {
        grid-column: 3;
        grid-row: 1;
        margin: 0;
        flex-wrap: nowrap;
      }
      :host([compact]) .dismiss {
        grid-column: 4;
        margin-block: 0;
      }
    `,
  ];

  /** `info` (default), `success`, `warning` or `danger`. */
  @property({ reflect: true }) accessor tone: CalloutTone = 'info';
  /** The heading, written as a full sentence. */
  @property() accessor heading = '';
  /** The single-line inline alert. */
  @property({ type: Boolean, reflect: true }) accessor compact = false;
  /** Shows a close button that fires `mm-dismiss`. */
  @property({ type: Boolean, reflect: true }) accessor dismissible = false;
  /** Interrupts assistive technology with `role="alert"`. Use sparingly. */
  @property({ type: Boolean, reflect: true }) accessor urgent = false;
  /** Overrides the tone's icon. */
  @property() accessor icon = '';

  #hasActions = false;
  #hasHeadingSlot = false;

  protected override willUpdate(): void {
    this.#hasActions = !!this.querySelector(':scope > [slot="actions"]');
    this.#hasHeadingSlot = !!this.querySelector(':scope > [slot="heading"]');
  }

  /** Dismisses the callout as if the close button were pressed. */
  dismiss(): void {
    if (emit(this, 'mm-dismiss', { tone: this.tone }, { cancelable: true })) this.hidden = true;
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.dismissible) {
      e.stopPropagation();
      this.dismiss();
    }
  };

  override render() {
    const tone = TONE_ICONS[this.tone] ? this.tone : 'info';
    const hasHeading = !!this.heading || this.#hasHeadingSlot;
    return html`<div
      part="callout"
      class="callout ${tone}"
      role=${this.urgent ? 'alert' : 'status'}
      @keydown=${this.#onKeydown}
    >
      <mm-icon part="icon" class="icon" name=${this.icon || TONE_ICONS[tone]}></mm-icon>
      <div class="text">
        <span part="heading" class="heading ${hasHeading ? '' : 'heading-empty'}"
          ><slot name="heading" @slotchange=${() => this.requestUpdate()}>${this.heading}</slot></span
        >
        <span part="body" class="body"><slot></slot></span>
      </div>
      <div part="actions" class="actions ${this.#hasActions ? 'has' : ''}">
        <slot name="actions" @slotchange=${() => this.requestUpdate()}></slot>
      </div>
      ${this.dismissible
        ? html`<button part="dismiss" class="dismiss" type="button" aria-label=${t('dismiss')} @click=${() => this.dismiss()}>
            <mm-icon name="close"></mm-icon>
          </button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-callout': MmCallout;
  }
}
