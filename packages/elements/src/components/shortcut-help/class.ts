import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { emit } from '../../core/events.js';
import { deepActive } from '../../core/floating.js';
import { uid } from '../../core/id.js';
import { formatShortcut } from '../../core/platform.js';
import { t, tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';
import '../kbd/define.js';
import '../button/define.js';

export interface Shortcut {
  /** Group heading, e.g. "Global", "Query editor". */
  group: string;
  /** What the shortcut does, in sentence case. */
  description: string;
  /**
   * The keys. `mod+k` is a combination (⌘ on Apple, Ctrl elsewhere); a space separates the steps of
   * a sequence (`g d`); a single symbol such as `+` or `?` is one key.
   */
  keys: string;
}

/** The Marmot default set. Descriptions go through `tr()` so apps can translate them. */
export function defaultShortcuts(): Shortcut[] {
  const g = {
    global: tr('shortcutGroupGlobal', 'Global'),
    nav: tr('shortcutGroupNavigation', 'Navigation'),
    query: tr('shortcutGroupQuery', 'Query editor'),
    lineage: tr('shortcutGroupLineage', 'Lineage'),
    tables: tr('shortcutGroupTables', 'Tables'),
  };
  return [
    { group: g.global, keys: 'mod+k', description: tr('shortcutPalette', 'Open the command palette') },
    { group: g.global, keys: '/', description: tr('shortcutFocusSearch', 'Focus search') },
    { group: g.global, keys: 'mod+b', description: tr('shortcutSidebar', 'Show or hide the sidebar') },
    { group: g.global, keys: '?', description: tr('shortcutHelp', 'Show keyboard shortcuts') },
    { group: g.global, keys: 'esc', description: tr('shortcutClose', 'Close a dialog, menu or blade') },
    { group: g.nav, keys: 'g d', description: tr('shortcutGoDiscover', 'Go to Discover') },
    { group: g.nav, keys: 'g q', description: tr('shortcutGoQuery', 'Go to Query') },
    { group: g.query, keys: 'mod+enter', description: tr('shortcutRunQuery', 'Run query') },
    { group: g.lineage, keys: '+', description: tr('shortcutZoomIn', 'Zoom in') },
    { group: g.lineage, keys: '-', description: tr('shortcutZoomOut', 'Zoom out') },
    { group: g.lineage, keys: '0', description: tr('shortcutFit', 'Fit the graph to the view') },
    { group: g.lineage, keys: 'f', description: tr('shortcutFocusNode', 'Focus the selected node') },
    { group: g.tables, keys: 'j', description: tr('shortcutNextRow', 'Next row') },
    { group: g.tables, keys: 'k', description: tr('shortcutPrevRow', 'Previous row') },
    { group: g.tables, keys: 'x', description: tr('shortcutSelectRow', 'Select or deselect the row') },
  ];
}

const isTextEntry = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(el.type);
  if ((el as HTMLElement).isContentEditable) return true;
  const role = el.getAttribute('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox';
};

/**
 * The keyboard shortcuts dialog lists every shortcut, grouped (Global, Navigation, Query editor,
 * Lineage, Tables), as a two-column table of what it does and its keys. Keys are formatted for the
 * platform: `⌘` on macOS and iOS, `Ctrl` elsewhere. A filter at the top matches descriptions,
 * groups and key names.
 *
 * Set `global-shortcut` to open it with "?" from anywhere, except while typing in a text field, an
 * editor or a combobox. Open it from the command palette's "Show keyboard shortcuts" command with
 * `show()`. It opens instantly because it is opened from the keyboard. Escape closes it and focus
 * returns to where it was.
 *
 * @tagname mm-shortcut-help
 * @summary A dialog listing keyboard shortcuts by group.
 * @csspart panel - The dialog.
 * @csspart filter - The filter input.
 * @csspart table - Each group's table.
 * @fires mm-open - {null} When the dialog opens.
 * @fires mm-close - {null} When the dialog closes.
 */
export class MmShortcutHelp extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: contents;
      }
      :host([inline]) {
        display: block;
      }
      .panel {
        position: fixed;
        inset: 0;
        display: none;
        flex-direction: column;
        width: min(600px, calc(100vw - 2 * var(--space-4)));
        max-height: min(640px, 84vh);
        margin: 8vh auto auto;
        padding: 0;
        color: var(--mm-text);
        background: var(--mm-raised);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dialog);
        overflow: hidden;
        z-index: var(--mm-z-dialog);
        /* Opened from the keyboard, so it appears instantly. */
        transition: none;
        animation: none;
      }
      dialog.panel[open],
      div.panel {
        display: flex;
      }
      div.panel {
        position: static;
        margin: 0;
        max-width: 100%;
        max-height: none;
      }
      div.panel .body {
        overflow: visible;
      }
      dialog::backdrop {
        background: var(--mm-scrim);
      }
      .head {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding-block: var(--space-4) var(--space-3);
        padding-inline: var(--space-5) var(--space-4);
      }
      h2 {
        margin: 0;
        font: var(--text-heading);
        letter-spacing: var(--tracking-heading);
      }
      .filter {
        display: flex;
        flex: none;
        align-items: center;
        gap: var(--space-2);
        height: var(--mm-control, var(--control-h));
        margin: 0 var(--space-5) var(--space-3);
        padding-inline: 10px;
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
      }
      .filter:focus-within {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
      }
      .filter mm-icon {
        color: var(--mm-text-2);
      }
      .filter input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: none;
        background: none;
        color: var(--mm-text);
        font: var(--text-dense);
      }
      .filter input::placeholder {
        color: var(--mm-text-2);
        opacity: 1;
      }
      @media (pointer: coarse) {
        .filter input {
          font-size: 16px;
        }
      }
      .body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 0 var(--space-5) var(--space-5);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: var(--space-4);
      }
      table:first-child {
        margin-top: 0;
      }
      caption {
        padding-bottom: var(--space-1);
        text-align: start;
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      td {
        height: var(--row-compact);
        padding: 0;
        border-top: 1px solid var(--mm-rule);
        font: var(--text-dense);
        vertical-align: middle;
      }
      td.keys {
        text-align: end;
        white-space: nowrap;
        padding-inline-start: var(--space-4);
      }
      .then {
        margin-inline: var(--space-1);
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .empty {
        margin: var(--space-6) 0;
        text-align: center;
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Renders the panel in place instead of as a modal, for documentation. */
  @property({ type: Boolean, reflect: true }) accessor inline = false;
  /** The shortcuts to list. Defaults to the Marmot set from `defaultShortcuts()`. */
  @property({ attribute: false }) accessor shortcuts: Shortcut[] = defaultShortcuts();
  /** Open with "?" when focus is not in a text field. */
  @property({ type: Boolean, attribute: 'global-shortcut' }) accessor globalShortcut = false;
  @property({ attribute: 'dialog-title' }) accessor dialogTitle = '';

  @state() accessor #filter = '';
  @query('dialog') accessor #dialog!: HTMLDialogElement | null;
  @query('input') accessor #input!: HTMLInputElement | null;

  #id = uid('shortcuts');
  #returnFocus: Element | null = null;
  #wasOpen = false;

  show() {
    this.open = true;
    if (this.hasUpdated && !this.inline) this.#sync();
  }
  hide() {
    this.open = false;
    if (this.hasUpdated && !this.inline) this.#sync();
  }
  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.#onGlobalKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.#onGlobalKey);
  }

  #onGlobalKey = (e: KeyboardEvent) => {
    if (!this.globalShortcut || this.open || e.defaultPrevented) return;
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTextEntry(deepActive())) return;
    e.preventDefault();
    this.show();
  };

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open') && !this.inline) this.#sync();
  }

  #sync() {
    const dialog = this.#dialog;
    if (!dialog) return;
    if (this.open && !dialog.open) {
      this.#returnFocus = deepActive();
      dialog.showModal();
      this.#input?.focus();
      this.#wasOpen = true;
      emit(this, 'mm-open', null);
    } else if (!this.open && dialog.open) {
      dialog.close();
    }
    if (!this.open && this.#wasOpen) {
      this.#wasOpen = false;
      this.#filter = '';
      const back = this.#returnFocus as HTMLElement | null;
      this.#returnFocus = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
      emit(this, 'mm-close', null);
    }
  }

  /** Words a key is matched by in the filter, so "ctrl", "cmd" and "enter" find shortcuts. */
  #keyText(keys: string) {
    return `${keys} ${keys
      .split(/\s+/)
      .flatMap((s) => (s.length === 1 ? [s] : formatShortcut(s)))
      .join(' ')}`.toLowerCase();
  }

  #renderKeys(keys: string) {
    const steps = keys.trim().split(/\s+/);
    return steps.map(
      (step, i) =>
        html`${i ? html`<span class="then">${tr('shortcutThen', 'then')}</span>` : nothing}${step.length === 1
          ? html`<mm-kbd>${step}</mm-kbd>`
          : html`<mm-kbd keys=${step}></mm-kbd>`}`,
    );
  }

  override render() {
    const title = this.dialogTitle || t('keyboardShortcuts');
    const needle = this.#filter.trim().toLowerCase();
    const matches = this.shortcuts.filter(
      (s) => !needle || s.description.toLowerCase().includes(needle) || s.group.toLowerCase().includes(needle) || this.#keyText(s.keys).includes(needle),
    );
    const groups: [string, Shortcut[]][] = [];
    for (const s of matches) {
      const g = groups.find(([name]) => name === s.group);
      if (g) g[1].push(s);
      else groups.push([s.group, [s]]);
    }
    const titleId = `${this.#id}-title`;
    const body = html`<div class="head">
        <h2 id=${titleId}>${title}</h2>
        <mm-button variant="ghost" size="sm" icon="close" label=${t('close')} @click=${() => this.hide()}></mm-button>
      </div>
      <label class="filter">
        <mm-icon name="search" aria-hidden="true"></mm-icon>
        <span class="visually-hidden">${tr('shortcutFilter', 'Filter shortcuts')}</span>
        <input
          part="filter"
          type="search"
          autocomplete="off"
          spellcheck="false"
          placeholder=${tr('shortcutFilter', 'Filter shortcuts')}
          .value=${this.#filter}
          @input=${(e: Event) => (this.#filter = (e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            // Escape clears a filter first, then closes.
            if (e.key === 'Escape' && this.#filter) {
              e.preventDefault();
              this.#filter = '';
            }
          }}
        />
      </label>
      <div class="body" role=${this.inline ? nothing : 'region'} tabindex=${this.inline ? nothing : '0'} aria-labelledby=${this.inline ? nothing : titleId}>
        ${groups.length
          ? groups.map(
              ([name, rows]) => html`<table part="table">
                <caption>${name}</caption>
                <thead class="visually-hidden">
                  <tr>
                    <th scope="col">${tr('shortcutAction', 'Action')}</th>
                    <th scope="col">${tr('shortcutKeys', 'Keys')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((s) => html`<tr><td>${s.description}</td><td class="keys">${this.#renderKeys(s.keys)}</td></tr>`)}
                </tbody>
              </table>`,
            )
          : html`<p class="empty" role="status">${tr('shortcutNoMatch', 'No shortcuts match “{query}”.', { query: this.#filter.trim() })}</p>`}
      </div>`;
    if (this.inline) return html`<div class="panel" part="panel">${body}</div>`;
    return html`<dialog
      class="panel"
      part="panel"
      aria-labelledby=${titleId}
      @cancel=${(e: Event) => {
        e.preventDefault();
        this.hide();
      }}
      @close=${() => {
        if (this.open) this.hide();
      }}
      @click=${(e: MouseEvent) => {
        // A click on the backdrop lands on the dialog itself, outside its box.
        if (e.target !== this.#dialog) return;
        const r = this.#dialog!.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.hide();
      }}
    >
      ${body}
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-shortcut-help': MmShortcutHelp;
  }
}
