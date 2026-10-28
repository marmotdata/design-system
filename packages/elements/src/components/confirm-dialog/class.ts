import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t, tr } from '../../core/strings.js';
import type { MmDialog } from '../dialog/class.js';
import '../dialog/define.js';
import '../button/define.js';
import '../text-field/define.js';

export interface ConfirmOptions {
  /** States the consequence: "Delete orders_daily?". */
  heading: string;
  /** What is destroyed or changed, in a sentence or two. */
  body?: string;
  /** Verb and object naming what is destroyed: "Delete asset". */
  confirmLabel?: string;
  /** Material Symbols icon for the confirm button. Defaults to `delete` for `danger`. */
  confirmIcon?: string;
  cancelLabel?: string;
  /** Enables type-to-confirm with this exact text, usually the asset name. */
  confirmText?: string;
  /** `danger` (default) or `default`. */
  tone?: 'danger' | 'default';
  /** Where to attach the dialog. Defaults to `document.body`. */
  container?: HTMLElement;
}

/**
 * Confirm dialogs stop a destructive or irreversible action until the person agrees to it. The
 * heading states the consequence as a question ("Delete orders_daily?"), the body says exactly what
 * is destroyed (lineage edges, owners, documentation) and what is not, and the confirm button is
 * crimson with an icon and a word naming what is destroyed ("Delete asset"), so it can never be
 * mistaken for the primary. Cancel is the secondary button and receives focus first, so Enter
 * never destroys anything by accident.
 *
 * With `confirm-text`, a mono field labelled "Type orders_daily to confirm" appears and the confirm
 * button stays disabled until the field matches exactly (case and spaces included). Enter in the
 * field confirms once it matches. Use it for deletions that cannot be undone and reach other
 * people's work.
 *
 * `tone="default"` uses the primary button for confirmations that are not destructive.
 *
 * For one-off confirmations, `await MmConfirmDialog.confirm({ heading, body, confirmLabel,
 * confirmText })` creates the dialog, shows it, resolves `true` on confirm and `false` on cancel or
 * Escape, and removes it afterwards. Focus returns to the element that was focused when it opened.
 * It is announced as an `alertdialog`, named by the heading and described by the body.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
 *
 * @tagname mm-confirm-dialog
 * @summary Confirms a destructive action, optionally by typing its name.
 * @slot - Rich body content, in place of `body`.
 * @csspart dialog - The inner `mm-dialog`.
 * @csspart field - The type-to-confirm field.
 * @csspart cancel - The cancel button.
 * @csspart confirm - The confirm button.
 * @fires mm-confirm - {} The confirm button was activated. Cancel it to keep the dialog open (for example while the deletion runs with `loading`), then call `close('confirm')`.
 * @fires mm-open - {} The dialog opened.
 * @fires mm-close - {DialogCloseDetail} The dialog closed; `returnValue` is `confirm` when confirmed.
 * @fires mm-request-close - {DialogRequestCloseDetail} Escape or the close button asked to close. Cancelable.
 */
export class MmConfirmDialog extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: contents;
      }
      .content {
        display: grid;
        gap: var(--space-4);
      }
      .text {
        display: grid;
        gap: var(--space-3);
        font: var(--text-dense);
        color: var(--mm-text-2);
        max-width: 75ch;
      }
      .text p,
      ::slotted(p) {
        margin: 0;
      }
      .confirm-field {
        display: grid;
        gap: 6px;
      }
      .prompt {
        margin: 0;
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      code {
        font: var(--text-mono-dense);
        color: var(--mm-text);
        background: var(--mm-sunken);
        border-radius: var(--radius-sm);
        padding: 1px 4px;
        overflow-wrap: anywhere;
      }
    `,
  ];

  /** States the consequence as a question: "Delete orders_daily?". */
  @property() accessor heading = '';
  /** What is destroyed or changed. Use the default slot for richer content. */
  @property() accessor body = '';
  /** Verb and object naming what is destroyed: "Delete asset". Defaults to the `confirm` string. */
  @property({ attribute: 'confirm-label' }) accessor confirmLabel = '';
  /** Icon on the confirm button. Defaults to `delete` when `tone` is `danger`. */
  @property({ attribute: 'confirm-icon' }) accessor confirmIcon = '';
  /** Label of the cancel button. Defaults to the `cancel` string. */
  @property({ attribute: 'cancel-label' }) accessor cancelLabel = '';
  /** Turns on type-to-confirm: the confirm button stays disabled until the field matches this exactly. */
  @property({ attribute: 'confirm-text' }) accessor confirmText = '';
  /** `danger` (default) or `default`. */
  @property({ reflect: true }) accessor tone: 'danger' | 'default' = 'danger';
  /** Opens and closes the dialog. Reflects. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Shows a spinner on the confirm button while the action runs. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;

  @state() accessor #typed = '';
  @query('mm-dialog') accessor #dialog!: MmDialog | null;

  /** The value the dialog last closed with: `confirm`, `cancel`, or empty for Escape and the close button. */
  get returnValue(): string {
    return this.#dialog?.returnValue ?? '';
  }

  /** True when type-to-confirm is off or the typed text matches exactly. */
  get confirmable(): boolean {
    return !this.confirmText || this.#typed === this.confirmText;
  }

  /**
   * Creates a confirm dialog, shows it and resolves `true` when confirmed or `false` when cancelled.
   * The element is removed once its closing transition has finished.
   */
  static confirm(options: ConfirmOptions): Promise<boolean> {
    const el = document.createElement('mm-confirm-dialog');
    const { container, ...props } = options;
    Object.assign(el, props);
    (container ?? document.body).append(el);
    return new Promise((resolve) => {
      el.addEventListener(
        'mm-close',
        (e) => {
          if (e.target !== el) return;
          resolve(el.returnValue === 'confirm');
          setTimeout(() => el.remove(), 300);
        },
      );
      el.show();
    });
  }

  show(): void {
    this.open = true;
  }

  close(returnValue?: string): void {
    this.#dialog?.close(returnValue);
    this.open = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Each opening starts with an empty field.
    if (changed.has('open') && this.open) this.#typed = '';
  }

  #confirm = () => {
    if (!this.confirmable || this.loading) return;
    if (emit(this, 'mm-confirm', {}, { cancelable: true })) this.close('confirm');
  };

  #onClose = (e: Event) => {
    if (e.target === this.#dialog) this.open = false;
  };

  #onInput = (e: Event) => {
    this.#typed = (e.target as HTMLInputElement).value ?? '';
  };

  #onFieldKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing && this.confirmable) {
      e.preventDefault();
      this.#confirm();
    }
  };

  #field() {
    if (!this.confirmText) return nothing;
    const label = tr('typeToConfirm', 'Type {text} to confirm', { text: this.confirmText });
    const [before = '', after = ''] = tr('typeToConfirm', 'Type {text} to confirm').split('{text}');
    return html`<div class="confirm-field">
      <p class="prompt" aria-hidden="true">${before}<code>${this.confirmText}</code>${after}</p>
      <mm-text-field
        part="field"
        label=${label}
        hide-label
        mono
        autocomplete="off"
        .value=${this.#typed}
        @mm-input=${this.#onInput}
        @input=${this.#onInput}
        @keydown=${this.#onFieldKeydown}
      ></mm-text-field>
    </div>`;
  }

  override render() {
    const danger = this.tone === 'danger';
    const icon = this.confirmIcon || (danger ? 'delete' : '');
    return html`<mm-dialog
      part="dialog"
      alert
      size="sm"
      heading=${this.heading}
      .open=${this.open}
      @mm-close=${this.#onClose}
    >
      <div class="content">
        <div class="text"><slot>${this.body ? html`<p>${this.body}</p>` : nothing}</slot></div>
        ${this.#field()}
      </div>
      <mm-button slot="footer" part="cancel" variant="secondary" autofocus data-close="cancel">${this.cancelLabel || t('cancel')}</mm-button>
      <mm-button
        slot="footer"
        part="confirm"
        variant=${danger ? 'danger' : 'primary'}
        icon=${icon}
        ?disabled=${!this.confirmable}
        ?loading=${this.loading}
        @click=${this.#confirm}
        >${this.confirmLabel || t('confirm')}</mm-button
      >
    </mm-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-confirm-dialog': MmConfirmDialog;
  }
}
