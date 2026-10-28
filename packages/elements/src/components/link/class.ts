import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';

/**
 * Links take the reader somewhere: another asset, a run, the documentation. In running prose they
 * are burnt sienna with a 1px underline that thickens to 2px on hover. In lists, tables, rows and cards
 * use `quiet`: ink with no underline until hover or focus, so burnt sienna is left for the primary
 * button, the current tab and real links in text. Chrome links in toolbars and footers use `muted`
 * (ink-2). External links open in a new tab, carry an open-in-new icon and say so to screen readers,
 * in every variant. Focus shows the ink ring, never burnt sienna.
 *
 * Follows the WAI-ARIA link pattern: https://www.w3.org/WAI/ARIA/apg/patterns/link/
 *
 * @tagname mm-link
 * @summary A link: burnt sienna in prose, quiet ink in rows, muted for chrome.
 * @slot - The link text.
 * @csspart link - The native anchor.
 * @csspart icon - The open-in-new icon on external links.
 */
export class MmLink extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline;
      }
      a {
        color: var(--mm-primary);
        text-decoration-line: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
        border-radius: 1px;
        cursor: pointer;
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      a:hover {
        text-decoration-thickness: 2px;
      }
      :host([muted]) a {
        color: var(--mm-text-2);
      }
      /* Quiet: ink, underlined only on hover and focus. For links in lists, tables, rows and cards. */
      :host([quiet]) a {
        color: var(--mm-text);
        text-decoration-line: none;
      }
      :host([quiet]) a:hover,
      :host([quiet]) a:focus-visible {
        text-decoration-line: underline;
        text-decoration-thickness: 1px;
      }
      :host([muted]) a:hover {
        color: var(--mm-text);
      }
      a:not([href]) {
        cursor: default;
      }
      mm-icon {
        margin-inline-start: 2px;
        vertical-align: -0.15em;
      }
      /* Mirror the arrow in the icon so it points outward in right-to-left text. */
      :host(:dir(rtl)) mm-icon {
        transform: scaleX(-1);
      }
      @media (pointer: coarse) {
        a {
          padding-block: 2px;
        }
      }
    `,
  ];

  /** Destination URL. */
  @property({ reflect: true }) accessor href = '';
  /** Opens in a new tab with `rel="noopener noreferrer"`, shows an open-in-new icon and announces it. */
  @property({ type: Boolean, reflect: true }) accessor external = false;
  /** Ink-2 for chrome links (footers, toolbars, breadcrumbs) instead of burnt sienna. */
  @property({ type: Boolean, reflect: true }) accessor muted = false;
  /** Ink with no underline until hover or focus, for links in lists, tables, rows and cards. Prose links stay burnt sienna. */
  @property({ type: Boolean, reflect: true }) accessor quiet = false;
  /** Suggests a file name and downloads the target. */
  @property() accessor download: string | undefined;
  /** Marks the link as the current page, for example in a breadcrumb trail. */
  @property() accessor current: 'page' | 'step' | 'location' | undefined;

  override render() {
    const newTab = tr('opensInNewTab', '(opens in a new tab)');
    return html`<a
      part="link"
      href=${ifDefined(this.href || undefined)}
      target=${ifDefined(this.external ? '_blank' : undefined)}
      rel=${ifDefined(this.external ? 'noopener noreferrer' : undefined)}
      download=${ifDefined(this.download)}
      aria-current=${ifDefined(this.current)}
      ><slot></slot>${this.external
        ? html`<mm-icon part="icon" name="open-in-new" size="14"></mm-icon><span class="visually-hidden"> ${newTab}</span>`
        : nothing}</a
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-link': MmLink;
  }
}
