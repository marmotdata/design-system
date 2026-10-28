import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { formatShortcut, isApple } from '../../core/platform.js';
import { t } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';

/** Built-in key names, read out instead of the symbols. Falls back to British English until the keys exist in `defaultStrings`. */
const word = (key: string, fallback: string): string => (t(key as never) as string | undefined) ?? fallback;

const spoken = (key: string, apple: boolean): string => {
  switch (key) {
    case 'mod':
      return apple ? word('keyCommand', 'Command') : word('keyControl', 'Control');
    case 'ctrl':
    case 'control':
      return word('keyControl', 'Control');
    case 'cmd':
    case 'meta':
      return word('keyCommand', 'Command');
    case 'shift':
      return word('keyShift', 'Shift');
    case 'alt':
    case 'option':
      return apple ? word('keyOption', 'Option') : word('keyAlt', 'Alt');
    case 'enter':
    case 'return':
      return word('keyEnter', 'Enter');
    case 'esc':
    case 'escape':
      return word('keyEscape', 'Escape');
    case 'up':
      return word('keyUp', 'Up arrow');
    case 'down':
      return word('keyDown', 'Down arrow');
    case 'left':
      return word('keyLeft', 'Left arrow');
    case 'right':
      return word('keyRight', 'Right arrow');
    case '/':
      return word('keySlash', 'Slash');
    case '?':
      return word('keyQuestion', 'Question mark');
    case '.':
      return word('keyFullStop', 'Full stop');
    case ',':
      return word('keyComma', 'Comma');
    default:
      return key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
  }
};

const glyph = (key: string, apple: boolean): string => {
  if (key === 'mod') return apple ? '⌘' : 'Ctrl';
  if (key === 'alt' || key === 'option') return apple ? '⌥' : 'Alt';
  if (key === 'ctrl' || key === 'control') return 'Ctrl';
  if (key === 'cmd' || key === 'meta') return '⌘';
  return formatShortcut(key)[0] ?? key;
};

/**
 * Keycaps show a keyboard shortcut as a physical key: 13px mono on `mm-surface` with a 1px rule
 * border, a 2px bottom border and `radius-sm`. Show them beside actions in menus, in search inputs and
 * on every command palette row. Give `keys` a shortcut such as `mod+k` and the platform decides the
 * modifier: `⌘` on macOS and iOS, `Ctrl` elsewhere. Each key is its own cap, separated by a
 * non-breaking space, and the shortcut is read out in words ("Control K", "Command K"). For a single
 * key, slot its name instead.
 *
 * @tagname mm-kbd
 * @summary A keyboard shortcut as physical keys.
 * @slot - A single key name, used when `keys` is not set.
 * @csspart group - The outer `kbd` holding the combination.
 * @csspart key - Each keycap.
 */
export class MmKbd extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        white-space: nowrap;
      }
      kbd {
        font: inherit;
      }
      .group {
        display: inline-flex;
        align-items: center;
      }
      .keys {
        display: inline-flex;
        align-items: center;
      }
      .key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        font: var(--text-keycap);
        letter-spacing: var(--tracking-keycap);
        color: var(--mm-text-2);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-bottom-width: 2px;
        border-radius: var(--radius-sm);
        font-variant-numeric: tabular-nums;
      }
      /* A real non-breaking space between caps, so copied text reads "Ctrl K"; its width is fixed to the grid. */
      .sep {
        display: inline-block;
        width: var(--space-1);
        overflow: hidden;
      }
    `,
  ];

  /** A shortcut such as `mod+k`, `mod+shift+p` or `esc`. `mod` is ⌘ on Apple platforms and Ctrl elsewhere. */
  @property({ reflect: true }) accessor keys = '';
  /** Overrides the words read out for the shortcut. */
  @property() accessor label = '';
  /** `auto` (default) detects the platform; `apple` or `other` force one, for documentation. */
  @property({ reflect: true }) accessor platform: 'auto' | 'apple' | 'other' = 'auto';

  override render() {
    if (!this.keys.trim()) {
      return html`<kbd part="group key" class="key"><slot></slot></kbd>`;
    }
    const apple = this.platform === 'auto' ? isApple() : this.platform === 'apple';
    const parts = this.keys
      .split('+')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    const words = this.label || parts.map((k) => spoken(k, apple)).join(' ');
    return html`<kbd part="group" class="group"><span class="visually-hidden">${words}</span><span class="keys" aria-hidden="true">${parts.map(
      (k, i) => html`${i ? html`<span class="sep">&nbsp;</span>` : nothing}<kbd part="key" class="key">${glyph(k, apple)}</kbd>`,
    )}</span></kbd>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-kbd': MmKbd;
  }
}
