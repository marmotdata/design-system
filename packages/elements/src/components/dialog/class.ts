import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { openedFromKeyboard } from '../../core/floating.js';
import { t } from '../../core/strings.js';
import { activeDeep, containsDeep, lockScroll, settled, tabbables, wrapTab } from './focus.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';

export type DialogSize = 'sm' | 'md' | 'lg' | 'full';
/** Why a close was requested: Escape, the close button, or a click on the backdrop. */
export type DialogCloseReason = 'escape' | 'close-button' | 'backdrop';

export interface DialogCloseDetail {
  /** The value passed to `close()`, or the `data-close` value of the button that closed it. Empty for Escape and the close button. */
  returnValue: string;
}
export interface DialogRequestCloseDetail {
  reason: DialogCloseReason;
}

/**
 * Shared styles for the modal overlays. The scrim is flat ink from the theme (ink at 40% on Light,
 * paper at 60% on Peat, where paper is the darker end), never blurred.
 */
export const modalStyles = css`
  :host {
    display: contents;
  }
  dialog {
    --_scrim: var(--mm-scrim);
    box-sizing: border-box;
    flex-direction: column;
    padding: 0;
    color: var(--mm-text);
    background: var(--mm-raised);
    border: 1px solid var(--mm-rule);
    box-shadow: var(--shadow-dialog);
    font: var(--text-body);
    overflow: hidden;
    overscroll-behavior: contain;
    opacity: 0;
    transform: var(--_from);
    transition:
      opacity var(--mm-dur-dialog) var(--mm-ease),
      transform var(--mm-dur-dialog) var(--mm-ease),
      overlay var(--mm-dur-dialog) allow-discrete,
      display var(--mm-dur-dialog) allow-discrete;
  }
  dialog[open] {
    display: flex;
    opacity: 1;
    transform: none;
  }
  @starting-style {
    dialog[open] {
      opacity: 0;
      transform: var(--_from);
    }
  }
  dialog::backdrop {
    background: var(--_scrim);
    opacity: 0;
    transition:
      opacity var(--mm-dur-dialog) var(--mm-ease),
      overlay var(--mm-dur-dialog) allow-discrete,
      display var(--mm-dur-dialog) allow-discrete;
  }
  dialog[open]::backdrop {
    opacity: 1;
  }
  @starting-style {
    dialog[open]::backdrop {
      opacity: 0;
    }
  }
  /* Guidelines: anything opened from the keyboard appears instantly. */
  :host([data-instant]) dialog,
  :host([data-instant]) dialog::backdrop {
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    dialog {
      transform: none;
    }
  }
  .header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    flex: none;
    padding: var(--space-5) var(--space-5) var(--space-4);
    padding-inline-end: var(--space-4);
    border-block-end: 1px solid transparent;
  }
  .header[data-edge] {
    border-block-end-color: var(--mm-rule);
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: var(--space-1);
  }
  h2 {
    margin: 0;
    font: var(--text-heading);
    letter-spacing: var(--tracking-heading);
    overflow-wrap: anywhere;
  }
  .description {
    margin: 0;
    font: var(--text-dense);
    color: var(--mm-text-2);
    max-width: 75ch;
  }
  .close {
    flex: none;
    margin-block-start: -3px;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0 var(--space-5) var(--space-5);
    font: var(--text-body);
  }
  .body:focus-visible {
    outline-offset: -2px;
  }
  :host([data-no-body]) .body {
    display: none;
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    flex: none;
    padding: var(--space-4) var(--space-5);
    border-block-start: 1px solid transparent;
  }
  .footer[data-edge] {
    border-block-start-color: var(--mm-rule);
  }
  .footer[hidden] {
    display: none;
  }
`;

const NATIVE_CONTROL = 'a[href],area[href],button,input,select,textarea,summary,iframe,audio[controls],video[controls],[contenteditable]:not([contenteditable="false"])';
const WIDGET_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
  'slider', 'spinbutton', 'textbox', 'searchbox', 'combobox', 'listbox', 'grid', 'tree', 'treegrid', 'treeitem', 'gridcell', 'row', 'application', 'separator',
]);

/** An element that is only focusable so its content can be scrolled with the keyboard, not a control. */
function isScrollStop(el: HTMLElement): boolean {
  if (el.matches(NATIVE_CONTROL) || el.shadowRoot?.delegatesFocus) return false;
  const role = el.getAttribute('role');
  return !(role && WIDGET_ROLES.has(role));
}

/**
 * Dialogs ask for one decision or one short task without leaving the page: a native modal
 * `<dialog>` on `mm-raised` with `radius-lg` and `shadow-dialog`, over a flat ink scrim (no blur).
 * The heading is a real heading in the 20px heading style and names the dialog; the optional
 * description is announced with it. Actions go in the `footer` slot with the primary last, after
 * Cancel. Long content scrolls inside the body while the header and footer stay put, gaining a
 * hairline once content runs under them.
 *
 * Opening uses `showModal()`, so the page behind is inert and the dialog sits in the top layer.
 * Focus goes to the first `autofocus` element, otherwise the first control in the body or footer
 * (scroll areas such as a code sample or a log are skipped), otherwise the close button. Tab and Shift+Tab wrap inside the dialog. Escape, the close button
 * and (with `dismissible`) a click on the backdrop fire a cancelable `mm-request-close` first, so
 * a form with unsaved changes can keep the dialog open. Closing returns focus to the element that
 * opened it, and page scrolling is locked while it is open. It fades and rises over
 * `--mm-dur-dialog`, appears instantly when opened from the keyboard, and does not move under
 * reduced motion.
 *
 * Any slotted element with a `data-close` attribute closes the dialog when clicked, with the
 * attribute's value as `returnValue` (`<mm-button slot="footer" data-close="cancel">`).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 *
 * @tagname mm-dialog
 * @summary A modal dialog for one decision or short task.
 * @slot - The body.
 * @slot heading - A rich heading, in place of the `heading` attribute.
 * @slot description - A rich description, in place of the `description` attribute.
 * @slot footer - Actions, primary last.
 * @csspart dialog - The native dialog element.
 * @csspart header - The header row.
 * @csspart heading - The heading.
 * @csspart description - The description.
 * @csspart close - The close button.
 * @csspart body - The scrolling body.
 * @csspart footer - The footer row.
 * @fires mm-open - {} The dialog opened and focus moved into it.
 * @fires mm-close - {DialogCloseDetail} The dialog closed.
 * @fires mm-request-close - {DialogRequestCloseDetail} Escape, the close button or the backdrop asked to close. Cancel it to keep the dialog open.
 */
export class MmDialog extends LitElement {
  static override styles = [
    base,
    modalStyles,
    css`
      dialog {
        --_from: translateY(8px) scale(0.98);
        width: min(var(--_w, 560px), calc(100vw - 2 * var(--space-4)));
        max-width: none;
        max-height: calc(100dvh - 2 * var(--space-8));
        border-radius: var(--radius-lg);
      }
      :host([size='sm']) dialog {
        --_w: 400px;
      }
      :host([size='lg']) dialog {
        --_w: 800px;
      }
      :host([size='full']) dialog {
        --_w: calc(100vw - 2 * var(--space-8));
        height: calc(100dvh - 2 * var(--space-8));
      }
      @media (max-width: 600px) {
        dialog {
          max-height: calc(100dvh - 2 * var(--space-4));
        }
        :host([size='full']) dialog {
          width: calc(100vw - 2 * var(--space-4));
          height: calc(100dvh - 2 * var(--space-4));
        }
      }
    `,
  ];

  /** The heading, which also names the dialog. Required unless the `heading` slot is used. */
  @property() accessor heading = '';
  /** A sentence under the heading, announced with it. */
  @property() accessor description = '';
  /** `sm` (400px), `md` (560px, default), `lg` (800px) or `full` (the viewport less the page gutter). */
  @property({ reflect: true }) accessor size: DialogSize = 'md';
  /** Opens and closes the dialog. Reflects. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Lets a click on the backdrop close the dialog (through `mm-request-close`). Leave off for forms. */
  @property({ type: Boolean, reflect: true }) accessor dismissible = false;
  /** Heading level for the outline, 1 to 6. The look does not change. */
  @property({ type: Number, attribute: 'heading-level' }) accessor headingLevel = 2;
  /** Accessible name of the close button. Defaults to the `close` string. */
  @property({ attribute: 'close-label' }) accessor closeLabel = '';
  /**
   * Announces the dialog as an `alertdialog`: an urgent interruption that needs a response, such as
   * confirming a destructive action (`mm-confirm-dialog` sets it). Leave off for forms and tasks.
   * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
   */
  @property({ type: Boolean, reflect: true }) accessor alert = false;

  /** The value the dialog last closed with. */
  returnValue = '';

  @query('dialog') protected accessor dialogEl!: HTMLDialogElement | null;
  @query('.body') accessor #body!: HTMLElement | null;
  @query('.header') accessor #header!: HTMLElement | null;
  @query('.footer') accessor #footer!: HTMLElement | null;
  @query('.close') accessor #close!: HTMLElement | null;
  @state() accessor #hasFooter = false;
  @state() accessor #hasDescription = false;

  #opener: HTMLElement | null = null;
  #unlock?: () => void;
  #shown = false;
  #downOnBackdrop = false;
  #ro?: ResizeObserver;

  /** Opens the dialog. */
  show(): void {
    this.open = true;
  }

  /** Closes the dialog with an optional return value, which `mm-close` carries. */
  close(returnValue?: string): void {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
  }

  /** Asks to close as Escape would: fires a cancelable `mm-request-close` and closes unless it is cancelled. */
  requestClose(reason: DialogCloseReason = 'escape'): boolean {
    if (!emit<DialogRequestCloseDetail>(this, 'mm-request-close', { reason }, { cancelable: true })) return false;
    this.close('');
    return true;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    if (this.#shown) {
      this.#shown = false;
      this.#unlock?.();
    }
  }

  protected override firstUpdated(): void {
    if (typeof ResizeObserver !== 'undefined' && this.#body) {
      this.#ro = new ResizeObserver(() => this.#measure());
      this.#ro.observe(this.#body);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open')) {
      if (this.open) void this.#show();
      else if (changed.get('open')) this.#hide();
    }
  }

  async #show() {
    const d = this.dialogEl;
    if (!d || d.open || !this.isConnected) return;
    this.#opener = activeDeep();
    this.toggleAttribute('data-instant', openedFromKeyboard());
    this.returnValue = '';
    try {
      d.showModal();
    } catch {
      this.open = false;
      return;
    }
    this.#shown = true;
    this.#unlock = lockScroll();
    // Slotted controls may still be rendering their inner buttons and inputs.
    await settled(d);
    await settled(d);
    if (!this.open) return;
    this.#focusInitial();
    this.#measure();
    emit(this, 'mm-open', {});
  }

  #focusInitial() {
    const d = this.dialogEl;
    if (!d) return;
    const { list, autofocus } = tabbables(d);
    const close = this.#close;
    // The first real control, skipping scroll areas that are only focusable so the keyboard can
    // scroll them (a code sample, a log); with none, the close button (APG dialog pattern).
    const target =
      autofocus ?? list.find((el) => !isScrollStop(el) && (!close || !containsDeep(close, el))) ?? list.find((el) => !isScrollStop(el)) ?? list[0];
    if (target) target.focus();
    else d.focus();
  }

  #hide() {
    const d = this.dialogEl;
    if (d?.open) d.close(this.returnValue);
    this.#finish();
  }

  #finish() {
    if (!this.#shown) return;
    this.#shown = false;
    this.#unlock?.();
    this.#unlock = undefined;
    const back = this.#opener;
    this.#opener = null;
    if (back?.isConnected && back !== document.body) back.focus({ preventScroll: true });
    emit<DialogCloseDetail>(this, 'mm-close', { returnValue: this.returnValue });
  }

  #onNativeClose = () => {
    // The browser closed the dialog itself (an uncancellable close request).
    if (this.open) {
      this.returnValue = this.dialogEl?.returnValue ?? '';
      this.open = false;
    }
  };

  #onCancel = (e: Event) => {
    e.preventDefault();
    this.requestClose('escape');
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      this.requestClose('escape');
      return;
    }
    if (this.dialogEl) wrapTab(e, this.dialogEl);
  };

  #outside(e: MouseEvent): boolean {
    const d = this.dialogEl;
    if (!d || e.target !== d) return false;
    const r = d.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }

  #onPointerDown = (e: PointerEvent) => {
    this.#downOnBackdrop = this.#outside(e);
  };

  #onClick = (e: MouseEvent) => {
    if (this.#outside(e)) {
      if (this.dismissible && this.#downOnBackdrop) this.requestClose('backdrop');
      this.#downOnBackdrop = false;
      return;
    }
    for (const node of e.composedPath()) {
      if (node === this.dialogEl) break;
      if (node instanceof Element && node.hasAttribute('data-close')) {
        if (node.getAttribute('aria-disabled') === 'true' || node.hasAttribute('disabled')) return;
        this.close(node.getAttribute('data-close') ?? '');
        return;
      }
    }
  };

  #measure = () => {
    const b = this.#body;
    if (!b) return;
    const overflow = b.scrollHeight > b.clientHeight + 1;
    // A scrolling region must be reachable from the keyboard, unless it already holds a control.
    if (overflow && !tabbables(b).list.length) b.tabIndex = 0;
    else b.removeAttribute('tabindex');
    this.#header?.toggleAttribute('data-edge', b.scrollTop > 0);
    this.#footer?.toggleAttribute('data-edge', overflow && b.scrollTop + b.clientHeight < b.scrollHeight - 1);
  };

  #onSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    const has = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
    if (slot.name === 'footer') this.#hasFooter = has;
    else if (slot.name === 'description') this.#hasDescription = has;
    else if (!slot.name) {
      this.toggleAttribute('data-no-body', !has);
      this.#measure();
    }
  };

  /** Extra content after the heading, for subclasses (the drawer reuses this layout). */
  protected renderHeaderExtra(): unknown {
    return nothing;
  }

  override render() {
    const hasDescription = this.#hasDescription || !!this.description;
    const level = Math.min(6, Math.max(1, Math.round(this.headingLevel || 2)));
    return html`<dialog
      part="dialog"
      role=${ifDefined(this.alert ? 'alertdialog' : undefined)}
      aria-labelledby="heading"
      aria-describedby=${ifDefined(hasDescription ? 'description' : undefined)}
      @cancel=${this.#onCancel}
      @close=${this.#onNativeClose}
      @keydown=${this.#onKeydown}
      @pointerdown=${this.#onPointerDown}
      @click=${this.#onClick}
    >
      <div part="header" class="header">
        <div class="titles">
          <h2 id="heading" part="heading" aria-level=${ifDefined(level === 2 ? undefined : String(level))}>
            <slot name="heading">${this.heading}</slot>
          </h2>
          <p id="description" part="description" class="description" ?hidden=${!hasDescription}>
            <slot name="description" @slotchange=${this.#onSlot}>${this.description}</slot>
          </p>
          ${this.renderHeaderExtra()}
        </div>
        <mm-button
          class="close"
          part="close"
          variant="ghost"
          size="sm"
          icon="close"
          label=${this.closeLabel || t('close')}
          @click=${() => this.requestClose('close-button')}
        ></mm-button>
      </div>
      <div part="body" class="body" @scroll=${this.#measure}><slot @slotchange=${this.#onSlot}></slot></div>
      <div part="footer" class="footer" ?hidden=${!this.#hasFooter}>
        <slot name="footer" @slotchange=${this.#onSlot}></slot>
      </div>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-dialog': MmDialog;
  }
}
