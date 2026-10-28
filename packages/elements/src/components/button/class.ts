import { LitElement, css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

/**
 * Buttons trigger one action, labelled with a verb plus an object ("Run query", "Add plugin",
 * "Delete asset"). One primary per view region. Danger buttons always carry an icon and a word
 * naming what is destroyed. Hover changes colour only: buttons never lift or scale, and labels
 * never end in "→".
 *
 * Icon-only buttons need `label`, which is announced and shown as a tooltip.
 *
 * @tagname mm-button
 * @summary Triggers one action.
 * @slot - The label.
 * @slot icon - A leading icon, if you need more than the `icon` attribute.
 * @csspart button - The native button or link.
 * @csspart icon - The leading icon.
 * @csspart label - The label wrapper.
 * @csspart spinner - The loading indicator.
 */
export class MmButton extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static formAssociated = true;

  static override styles = [
    base,
    visuallyHidden,
    css`
      .ext {
        color: var(--mm-text-3);
        margin-inline-start: -2px;
      }
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        width: 100%;
        height: var(--_h, var(--mm-control, var(--control-h)));
        padding: 0 14px;
        font: var(--text-button);
        line-height: 1;
        white-space: nowrap;
        text-decoration: none;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        cursor: pointer;
        user-select: none;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          border-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      :host([size='sm']) {
        --_h: var(--control-h-sm);
      }
      :host([size='sm']) .btn {
        padding: 0 10px;
      }
      :host([icon-only]) .btn {
        width: var(--_h, var(--mm-control, var(--control-h)));
        padding: 0;
      }
      .primary {
        background: var(--mm-primary-fill);
        color: var(--mm-on-primary);
      }
      .primary:hover,
      .primary:active {
        background: var(--mm-primary-hover);
      }
      .secondary {
        background: var(--mm-surface);
        color: var(--mm-text);
        border-color: var(--mm-control-border);
      }
      .secondary:hover,
      .secondary:active {
        border-color: var(--mm-text);
      }
      .ghost {
        background: transparent;
        color: var(--mm-text-2);
      }
      .ghost:hover,
      .ghost:active {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
      .danger {
        background: var(--mm-danger-fill);
        color: var(--mm-on-primary);
      }
      /* docs/open-items.md, item 4: no mm-danger-hover token yet, so darken toward ink with tokens only. */
      .danger:hover,
      .danger:active {
        background: color-mix(in oklab, var(--mm-danger-fill), var(--mm-text) 14%);
      }
      :host([data-theme-dark]) .danger:hover {
        background: color-mix(in oklab, var(--mm-danger-fill), var(--mm-paper) 18%);
      }
      .btn[aria-disabled='true'] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn[aria-disabled='true']:hover {
        background: revert-layer;
      }
      .primary[aria-disabled='true'] { background: var(--mm-primary-fill); }
      .secondary[aria-disabled='true'] { border-color: var(--mm-control-border); }
      .ghost[aria-disabled='true'] { background: transparent; color: var(--mm-text-2); }
      .danger[aria-disabled='true'] { background: var(--mm-danger-fill); }
      .label {
        display: inline-flex;
        align-items: center;
      }
      :host([icon-only]) .label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      ::slotted(mm-icon),
      mm-icon {
        flex: none;
      }
      .spinner {
        width: 14px;
        height: 14px;
        flex: none;
        border-radius: 50%;
        border: 1.5px solid currentColor;
        border-right-color: transparent;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-right-color: currentColor;
          opacity: 0.6;
        }
      }
      .tip {
        position: fixed;
        margin: 0;
        inset: auto;
        border: 0;
        padding: 6px 8px;
        border-radius: 0;
        background: var(--mm-text);
        color: var(--mm-on-inverse);
        font: var(--text-caption);
        white-space: nowrap;
        pointer-events: none;
      }
    `,
  ];

  /** `primary`, `secondary` (default), `ghost` or `danger`. */
  @property({ reflect: true }) accessor variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'secondary';
  /** `md` (36px, default) or `sm` (30px). */
  @property({ reflect: true }) accessor size: 'md' | 'sm' = 'md';
  /** Leading Material Symbols icon name. Required for `danger`. */
  @property() accessor icon = '';
  /** Accessible name for icon-only buttons; also shown as an instant tooltip. Setting it with no slotted text makes the button icon-only. */
  @property() accessor label = '';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Shows a spinner, keeps the label, and blocks activation. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** `button` (default), `submit` or `reset`. Submit and reset work with the closest form. */
  @property() accessor type: 'button' | 'submit' | 'reset' = 'button';
  /** Renders a link styled as a button. */
  @property() accessor href = '';
  @property() accessor target = '';
  /** With `href`: opens in a new tab, with a trailing arrow and "(opens in a new tab)" for screen readers. For places outside Marmot. */
  @property({ type: Boolean, reflect: true }) accessor external = false;
  @property({ reflect: true }) accessor name = '';
  @property() accessor value = '';
  /** Reflects aria-pressed for toggle buttons. */
  @property() accessor pressed: 'true' | 'false' | undefined;
  /** Reflects aria-expanded for buttons that control a menu or disclosure. */
  @property() accessor expanded: 'true' | 'false' | undefined;
  @property({ attribute: 'controls' }) accessor controls = '';
  @property({ attribute: 'haspopup' }) accessor haspopup: 'menu' | 'listbox' | 'dialog' | undefined;

  @query('.btn') accessor #btn!: HTMLElement;
  @query('.tip') accessor #tip!: HTMLElement | null;
  #internals = this.attachInternals();

  get form() {
    return this.#internals.form;
  }

  constructor() {
    super();
    // Handle activation on the host so element.click() and clicks on the padding behave like a native button.
    this.addEventListener('click', (e) => this.#onClick(e));
  }

  override focus(options?: FocusOptions) {
    this.#btn?.focus(options);
  }
  override blur() {
    this.#btn?.blur();
  }

  protected override willUpdate() {
    // Icon-only when a label is given and no text is slotted; decided before render so ARIA is right first time.
    this.toggleAttribute('icon-only', !!this.label && !this.textContent?.trim());
  }

  #onClick(e: MouseEvent) {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const form = this.#internals.form;
    if (!form || this.href) return;
    if (this.type === 'submit') {
      // Submit through a temporary native button so name/value and form validation behave natively.
      const proxy = document.createElement('button');
      proxy.type = 'submit';
      proxy.hidden = true;
      if (this.name) {
        proxy.name = this.name;
        proxy.value = this.value;
      }
      form.append(proxy);
      proxy.click();
      proxy.remove();
    } else if (this.type === 'reset') {
      form.reset();
    }
  }

  #showTip = () => {
    if (!this.hasAttribute('icon-only') || !this.#tip) return;
    const tip = this.#tip;
    try {
      tip.showPopover();
    } catch {
      return;
    }
    const r = this.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, r.left + r.width / 2 - t.width / 2)}px`;
    tip.style.top = `${r.top - t.height - 6 < 8 ? r.bottom + 6 : r.top - t.height - 6}px`;
  };
  #hideTip = () => {
    try {
      this.#tip?.hidePopover();
    } catch {
      /* not open */
    }
  };

  override render() {
    const disabled = this.disabled || this.loading;
    const inner = html`
      ${this.loading
        ? html`<span part="spinner" class="spinner" aria-hidden="true"></span>`
        : this.icon
          ? html`<mm-icon part="icon" name=${this.icon}></mm-icon>`
          : html`<slot name="icon"></slot>`}
      <span part="label" class="label"><slot @slotchange=${() => this.requestUpdate()}>${this.label}</slot></span>
      ${this.external && this.href
        ? html`<mm-icon class="ext" name="open-in-new" size="14" aria-hidden="true"></mm-icon><span class="visually-hidden"> ${tr('opensInNewTab', '(opens in a new tab)')}</span>`
        : nothing}
    `;
    const cls = `btn ${this.variant}`;
    const tip = this.label ? html`<div class="tip" popover="manual" role="tooltip" id="tip" aria-hidden="true">${this.label}</div>` : nothing;
    if (this.href && !disabled) {
      return html`<a
          part="button"
          class=${cls}
          href=${this.href}
          target=${ifDefined(this.external ? '_blank' : this.target || undefined)}
          rel=${ifDefined(this.external || this.target === '_blank' ? 'noopener noreferrer' : undefined)}
          aria-label=${ifDefined(this.hasAttribute('icon-only') ? this.label : undefined)}
          @pointerenter=${this.#showTip}
          @pointerleave=${this.#hideTip}
          @focus=${this.#showTip}
          @blur=${this.#hideTip}
          >${inner}</a
        >${tip}`;
    }
    return html`<button
        part="button"
        class=${cls}
        type="button"
        aria-disabled=${disabled ? 'true' : 'false'}
        aria-busy=${this.loading ? 'true' : 'false'}
        aria-label=${ifDefined(this.hasAttribute('icon-only') ? this.label : undefined)}
        aria-pressed=${ifDefined(this.pressed)}
        aria-expanded=${ifDefined(this.expanded)}
        aria-haspopup=${ifDefined(this.haspopup)}
        aria-controls=${ifDefined(this.controls || undefined)}
        @pointerenter=${this.#showTip}
        @pointerleave=${this.#hideTip}
        @focus=${this.#showTip}
        @blur=${this.#hideTip}
        @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && this.#hideTip()}
      >
        ${inner}
      </button>${tip}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-button': MmButton;
  }
}
