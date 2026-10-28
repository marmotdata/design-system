import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

export type BannerTone = 'info' | 'warning' | 'danger';

const ICONS: Record<BannerTone, string> = { info: 'info', warning: 'warning', danger: 'error' };
const s = (key: string, fallback: string): string => (t(key as never) as string | undefined) ?? fallback;

/**
 * The system banner runs full width across the top of the app shell for messages that apply to
 * the whole instance, such as the server-configured banner in Marmot OSS or planned maintenance.
 * An icon, one sentence, an optional link and an optional dismiss button, on a soft status fill
 * or `mm-sunken`, closed by a hairline rule. No stripe. One banner at a time.
 *
 * It is a labelled region, so people can jump to it. With `dismissible`, the close button fires
 * `mm-dismiss` and hides the banner unless cancelled; persist the choice yourself.
 *
 * @tagname mm-banner
 * @summary Full-width system message at the top of the app shell.
 * @slot - The message.
 * @csspart banner - The bar.
 * @csspart icon - The status icon.
 * @csspart message - The message.
 * @csspart link - The link.
 * @csspart dismiss - The close button.
 * @fires mm-dismiss - {{ tone: string }} The close button was activated. Cancel it to keep the banner.
 */
export class MmBanner extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .banner {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-block-size: 40px;
        padding-block: var(--space-2);
        padding-inline: var(--space-8) var(--space-4);
        border-block-end: 1px solid var(--mm-rule);
        font: var(--text-dense);
        color: var(--mm-text);
      }
      @media (max-width: 640px) {
        .banner {
          padding-inline: var(--space-4) var(--space-2);
          align-items: flex-start;
        }
      }
      .info {
        background: var(--mm-info-soft);
        --_icon: var(--mm-info);
      }
      .warning {
        background: var(--mm-warning-soft);
        --_icon: var(--mm-warning);
      }
      .danger {
        background: var(--mm-danger-soft);
        --_icon: var(--mm-danger);
      }
      :host([surface='sunken']) .banner {
        background: var(--mm-sunken);
      }
      .icon {
        flex: none;
        color: var(--_icon);
      }
      .message {
        flex: 1;
        min-inline-size: 0;
        overflow-wrap: anywhere;
      }
      .link {
        margin-inline-start: var(--space-2);
        color: var(--mm-primary);
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
        white-space: nowrap;
      }
      .link:hover {
        text-decoration-thickness: 2px;
      }
      .dismiss {
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
      .dismiss:hover {
        color: var(--mm-text);
        background: color-mix(in oklab, var(--mm-text) 8%, transparent);
      }
    `,
  ];

  /** `info` (default), `warning` or `danger`. */
  @property({ reflect: true }) accessor tone: BannerTone = 'info';
  /** `soft` status fill (default) or `sunken`, for quieter notices. */
  @property({ reflect: true }) accessor surface: 'soft' | 'sunken' = 'soft';
  /** Optional link URL, e.g. the status page or release notes. */
  @property() accessor href = '';
  /** Link text, e.g. "Read the release notes". */
  @property({ attribute: 'link-text' }) accessor linkText = '';
  /** Shows a close button that fires `mm-dismiss`. */
  @property({ type: Boolean, reflect: true }) accessor dismissible = false;
  /** Accessible name of the region. Defaults to "System message". */
  @property() accessor label = '';

  /** Dismisses the banner as if the close button were pressed. */
  dismiss(): void {
    if (emit(this, 'mm-dismiss', { tone: this.tone }, { cancelable: true })) this.hidden = true;
  }

  override render() {
    const tone = ICONS[this.tone] ? this.tone : 'info';
    return html`<section part="banner" class="banner ${tone}" aria-label=${this.label || s('systemMessage', 'System message')}>
      <mm-icon part="icon" class="icon" name=${ICONS[tone]}></mm-icon>
      <div part="message" class="message">
        <slot></slot>${this.href && this.linkText
          ? html`<a part="link" class="link" href=${this.href}>${this.linkText}</a>`
          : nothing}
      </div>
      ${this.dismissible
        ? html`<button part="dismiss" class="dismiss" type="button" aria-label=${t('dismiss')} @click=${() => this.dismiss()}>
            <mm-icon name="close"></mm-icon>
          </button>`
        : nothing}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-banner': MmBanner;
  }
}
