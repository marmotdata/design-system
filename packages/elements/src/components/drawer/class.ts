import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { MmDialog, modalStyles } from '../dialog/class.js';

export type DrawerPlacement = 'start' | 'end' | 'bottom';

/**
 * Drawers are modal side sheets for work that needs more room than a dialog but should not leave
 * the page: connecting an agent or a source (CLI and API snippets), or a create form. They slide in
 * from the inline end by default (`placement="start"` or `"bottom"` for the others), on
 * `mm-raised` with `shadow-dialog` over the same flat ink scrim as a dialog. Widths are `sm`
 * (360px), `md` (`--blade-w`, 36rem, default) and `lg` (800px); `full` takes the viewport.
 *
 * Behaviour is the dialog's: a native modal `<dialog>`, focus to the first `autofocus` element or
 * the first control, Tab wraps, Escape and the close button fire a cancelable `mm-request-close`,
 * focus returns to the opener and page scrolling is locked. The slide is a transform over
 * `--mm-dur-dialog` (220ms), instant when opened from the keyboard and still under reduced motion.
 * Placement follows the writing direction, so `end` is the left edge in right-to-left pages.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 *
 * @tagname mm-drawer
 * @summary A modal side sheet for connect flows and create forms.
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
 * @fires mm-open - {} The drawer opened and focus moved into it.
 * @fires mm-close - {DialogCloseDetail} The drawer closed.
 * @fires mm-request-close - {DialogRequestCloseDetail} Escape, the close button or the backdrop asked to close. Cancel it to keep the drawer open.
 */
export class MmDrawer extends MmDialog {
  static override styles = [
    base,
    modalStyles,
    css`
      dialog {
        --_w: var(--blade-w);
        --_from: translateX(100%);
        position: fixed;
        margin: 0;
        inset-block: 0;
        inset-inline-start: auto;
        inset-inline-end: 0;
        width: min(var(--_w), 100vw);
        max-width: none;
        height: 100dvh;
        max-height: none;
        border-radius: 0;
        border-block: 0;
        border-inline-end: 0;
      }
      dialog:dir(rtl) {
        --_from: translateX(-100%);
      }
      :host([placement='start']) dialog {
        --_from: translateX(-100%);
        inset-inline-start: 0;
        inset-inline-end: auto;
        border-inline-start: 0;
        border-inline-end: 1px solid var(--mm-rule);
      }
      :host([placement='start']) dialog:dir(rtl) {
        --_from: translateX(100%);
      }
      :host([placement='bottom']) dialog {
        --_from: translateY(100%);
        inset: auto 0 0 0;
        width: 100vw;
        height: auto;
        max-height: min(85dvh, 720px);
        border-inline: 0;
        border-block-start: 1px solid var(--mm-rule);
      }
      :host([size='sm']) dialog {
        --_w: 360px;
      }
      :host([size='lg']) dialog {
        --_w: 800px;
      }
      :host([size='full']) dialog {
        --_w: 100vw;
      }
      /* The slide is the motion; the sheet itself does not fade. */
      dialog,
      dialog[open] {
        opacity: 1;
      }
      @starting-style {
        dialog[open] {
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        dialog {
          transform: none;
        }
      }
    `,
  ];

  /** Edge the drawer comes from: `end` (default, the inline end), `start` or `bottom`. */
  @property({ reflect: true }) accessor placement: DrawerPlacement = 'end';
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-drawer': MmDrawer;
  }
}
