import { LitElement, css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { deepActive } from '../../core/floating.js';
import { onStringsChange, t } from '../../core/strings.js';
import '../button/define.js';
import type { MmButton } from '../button/class.js';

/** Copies text, with the clipboard API where allowed and a hidden textarea where not. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0;pointer-events:none';
  document.body.append(ta);
  // The deepest focused element: document.activeElement is only the outermost shadow host.
  const active = deepActive() as HTMLElement | null;
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}

/**
 * A copy button copies a machine string, usually an MRN, an ID or a SQL statement, and confirms
 * with "Copied" and a check for 1.5 seconds. The confirmation is announced through a polite live
 * region. It is an icon-only ghost button by default; set `icon-only="false"` to show the label.
 * On a code block, use `tone="code"` so it sits on the fixed dark ground.
 *
 * @tagname mm-copy-button
 * @summary Copies a value to the clipboard.
 * @csspart button - The inner `mm-button`.
 * @fires mm-copy - {{ value: string }} The value was copied.
 */
export class MmCopyButton extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
      mm-button {
        flex: 1;
      }
      .copied::part(icon) {
        color: var(--mm-success);
      }
      /* Code ground: fixed dark in both themes. The focus ring and tooltip read the ink tokens, so remap them here. */
      :host([tone='code']) mm-button {
        --mm-text: var(--mm-code-text);
        --mm-on-inverse: var(--mm-code-bg);
      }
      :host([tone='code']) mm-button::part(button) {
        height: 24px;
        padding: 0 var(--space-2);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-code-text);
        background: transparent;
        /* docs/open-items.md, item 3: mm-code-control-border does not exist yet; the comment colour stands in. */
        border-color: var(--mm-syn-comment);
        border-radius: var(--radius-sm);
      }
      :host([tone='code']:not([icon-only='false'])) mm-button::part(button) {
        width: 24px;
        padding: 0;
      }
      :host([tone='code']) mm-button::part(button):hover {
        border-color: var(--mm-code-text);
      }
      :host([tone='code']) .copied::part(icon) {
        color: var(--mm-syn-string);
      }
    `,
  ];

  /** The text to copy. */
  @property() accessor value = '';
  /** Accessible name and visible text. Defaults to "Copy". Name the thing where you can ("Copy MRN"). */
  @property() accessor label = '';
  /**
   * Shows only the icon (the default). Set `icon-only="false"` to show the label beside it.
   */
  @property({
    attribute: 'icon-only',
    reflect: true,
    converter: { fromAttribute: (v: string | null) => v !== 'false', toAttribute: (v: boolean) => (v ? '' : 'false') },
  })
  accessor iconOnly = true;
  /** `default`, or `code` for the dark code block ground. */
  @property({ reflect: true }) accessor tone: 'default' | 'code' = 'default';
  /** `md` (default) or `sm`. */
  @property({ reflect: true }) accessor size: 'md' | 'sm' = 'md';
  @property({ type: Boolean, reflect: true }) accessor disabled = false;

  @state() accessor #copied = false;
  @query('mm-button') accessor #button!: MmButton | null;
  #timer?: ReturnType<typeof setTimeout>;
  #unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unsubscribe = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
    this.#unsubscribe?.();
  }

  override focus(options?: FocusOptions): void {
    this.#button?.focus(options);
  }

  /** Copies `value` now. Resolves to whether the copy succeeded. */
  async copy(): Promise<boolean> {
    if (this.disabled) return false;
    const ok = await writeClipboard(this.value);
    if (!ok) return false;
    this.#copied = true;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.#copied = false), 1500);
    emit(this, 'mm-copy', { value: this.value });
    return true;
  }

  override render() {
    const label = this.label || t('copy');
    const text = this.#copied ? t('copied') : label;
    return html`<mm-button
        part="button"
        class=${this.#copied ? 'copied' : ''}
        variant="ghost"
        size=${this.size}
        icon=${this.#copied ? 'check' : 'content-copy'}
        label=${this.iconOnly ? label : ''}
        ?disabled=${this.disabled}
        @click=${() => this.copy()}
        >${this.iconOnly ? '' : text}</mm-button
      ><span class="visually-hidden" role="status">${this.#copied ? t('copied') : ''}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-copy-button': MmCopyButton;
  }
}
