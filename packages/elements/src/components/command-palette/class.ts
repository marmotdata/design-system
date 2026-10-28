import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { virtualize, virtualizerRef, type VirtualizerHostElement } from '@lit-labs/virtualizer/virtualize.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { emit } from '../../core/events.js';
import { deepActive } from '../../core/floating.js';
import { uid } from '../../core/id.js';
import { isApple, isModKey } from '../../core/platform.js';
import { tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import '@marmotdata/icons/define.js';
import '../kbd/define.js';

/** A static command: a page to go to or an action to run. */
export interface PaletteCommand {
  id: string;
  label: string;
  /** Group heading, e.g. "Pages", "Settings", "Account". Defaults to "Pages" for links and "Commands" for actions. */
  group?: string;
  /** `page` (navigation, the Pages scope) or `action` (the `>` scope). Defaults to `page` when `href` is set and `run` is not. */
  kind?: 'page' | 'action';
  /** Material Symbols icon name. */
  icon?: string;
  /** Synonyms that also match, e.g. ["tokens", "credentials"] for Settings › API keys. */
  keywords?: string[];
  /** Shortcut shown on the row, e.g. `mod+b` or `g d`. Display only: register it in the app. */
  shortcut?: string;
  /** Secondary text in `mm-text-2`. */
  description?: string;
  href?: string;
  run?: () => void;
}

/** A live catalogue result returned by `search`. */
export interface PaletteResult {
  id: string;
  kind: 'asset' | 'glossary' | 'team' | 'data-product';
  label: string;
  /** Asset MRN, shown in mono and truncated in the middle. */
  mrn?: string;
  /** Provider key for assets (`postgresql`, `kafka`); shows the provider logo. */
  provider?: string;
  /** Secondary text for non-assets, e.g. a glossary definition or a team's member count. */
  description?: string;
  icon?: string;
  href?: string;
}

export type PaletteItem = PaletteCommand | PaletteResult;
export type PaletteScope = 'all' | 'assets' | 'glossary' | 'teams' | 'pages' | 'commands';
export type PaletteSearch = (query: string, signal: AbortSignal, scope: PaletteScope) => Promise<PaletteResult[]>;

export interface MmPaletteSelectDetail {
  item: PaletteItem;
}
export interface MmPaletteQueryDetail {
  query: string;
  scope: PaletteScope;
}
export interface MmPaletteSearchAllDetail {
  query: string;
  scope: PaletteScope;
  /** `search-href` with the query filled in. */
  href: string;
}

const resultKinds = ['asset', 'glossary', 'team', 'data-product'] as const;
const isResult = (i: PaletteItem): i is PaletteResult => (resultKinds as readonly string[]).includes(i.kind ?? '');
const commandKind = (c: PaletteCommand): 'page' | 'action' => c.kind ?? (c.href && !c.run ? 'page' : 'action');

/** Scopes reachable with Tab, in order. `commands` is reached with the `>` prefix. */
const tabScopes: PaletteScope[] = ['all', 'assets', 'glossary', 'teams', 'pages'];
const scopeLabel = (s: PaletteScope): string =>
  ({
    all: tr('paletteScopeAll', 'All'),
    assets: tr('paletteScopeAssets', 'Assets'),
    glossary: tr('paletteScopeGlossary', 'Glossary'),
    teams: tr('paletteScopeTeams', 'Teams'),
    pages: tr('paletteScopePages', 'Pages'),
    commands: tr('paletteScopeCommands', 'Commands'),
  })[s];
const kindGroup = (k: PaletteResult['kind']): string =>
  ({
    asset: tr('paletteGroupAssets', 'Assets'),
    glossary: tr('paletteGroupGlossary', 'Glossary terms'),
    team: tr('paletteGroupTeams', 'Teams'),
    'data-product': tr('paletteGroupDataProducts', 'Data products'),
  })[k];
const kindIcon = (k: PaletteResult['kind']): string =>
  ({ asset: 'table', glossary: 'book-2', team: 'groups', 'data-product': 'package-2' })[k];
const scopeKinds: Partial<Record<PaletteScope, PaletteResult['kind'][]>> = {
  all: ['asset', 'glossary', 'team', 'data-product'],
  assets: ['asset'],
  glossary: ['glossary'],
  teams: ['team'],
};

/* ------------------------------------------------------------------ scoring */

export type MatchRange = [start: number, end: number];
export interface FuzzyMatch {
  score: number;
  /** Ranges of the label to highlight. */
  ranges: MatchRange[];
}

const boundary = /[\s_.\-/:›>()]/;
/** Index of the first occurrence of `token` at a word start in `text` (after a separator or at a camelCase hump), or -1. */
function wordStart(text: string, lower: string, token: string): number {
  for (let i = lower.indexOf(token, 1); i > 0; i = lower.indexOf(token, i + 1)) {
    const prev = text[i - 1]!;
    const cur = text[i]!;
    if (boundary.test(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase())) return i;
  }
  return -1;
}

/**
 * Scores `label` (and its keyword synonyms) against a query, case-insensitively. Every
 * whitespace-separated token must match. Per token, a prefix of the label scores highest, then the
 * start of a word, then any substring; keyword matches score below label matches. Returns null when
 * a token does not match.
 */
export function fuzzyScore(queryText: string, label: string, keywords: readonly string[] = []): FuzzyMatch | null {
  const tokens = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { score: 0, ranges: [] };
  const lower = label.toLowerCase();
  const kws = keywords.map((k) => k.toLowerCase());
  let score = 0;
  const ranges: MatchRange[] = [];
  for (const tok of tokens) {
    if (lower.startsWith(tok)) {
      score += 100;
      ranges.push([0, tok.length]);
      continue;
    }
    const ws = wordStart(label, lower, tok);
    if (ws > 0) {
      score += 70;
      ranges.push([ws, ws + tok.length]);
      continue;
    }
    const sub = lower.indexOf(tok);
    if (sub >= 0) {
      score += 40;
      ranges.push([sub, sub + tok.length]);
      continue;
    }
    if (kws.some((k) => k.startsWith(tok))) score += 50;
    else if (kws.some((k) => wordStart(k, k, tok) > 0)) score += 35;
    else if (kws.some((k) => k.includes(tok))) score += 20;
    else return null;
  }
  if (lower === tokens.join(' ')) score += 50;
  // Shorter labels win ties: "Members" before "Members and roles audit".
  score -= Math.min(label.length, 60) / 100;
  return { score, ranges: mergeRanges(ranges) };
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: MatchRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** Highlight ranges for a label that the server already matched (results are not re-scored). */
function rangesFor(queryText: string, label: string): MatchRange[] {
  return fuzzyScore(queryText, label)?.ranges ?? [];
}

/* ------------------------------------------------------------------ view model */

interface Row {
  item: PaletteItem | 'retry' | 'search-all';
  ranges: MatchRange[];
}
interface Group {
  id: string;
  label: string;
  rows: Row[];
  /** Index of the group's first row in the flat option list. */
  start: number;
}

/** Groups with more rows than this are virtualised. Smaller groups render directly so opening stays within one frame. */
const VIRTUALISE_OVER = 40;
const DEBOUNCE = 120;

const ariaShortcut = (s: string): string | undefined => {
  if (/\s/.test(s.trim())) return undefined; // sequences such as "g d" have no aria-keyshortcuts form
  return s
    .split('+')
    .map((k) => {
      const key = k.trim().toLowerCase();
      if (key === 'mod') return isApple() ? 'Meta' : 'Control';
      if (key === 'shift') return 'Shift';
      if (key === 'alt') return 'Alt';
      if (key === 'enter') return 'Enter';
      if (key === 'esc' || key === 'escape') return 'Escape';
      return key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
    })
    .join('+');
};

const isTextEntry = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(el.type);
  if ((el as HTMLElement).isContentEditable) return true;
  const role = el.getAttribute('role');
  return role === 'textbox' || role === 'combobox' || role === 'searchbox';
};

/**
 * The command palette is the keyboard entry point to everything in the catalog. It mixes page
 * navigation and actions (`commands`, filtered locally with a prefix, then word-start, then
 * substring scorer that also matches keyword synonyms) with live catalogue results (`search`,
 * debounced 120ms, stale calls aborted). It opens and closes instantly: the guidelines bans animated
 * command palettes, so the dialog has no transition at all.
 *
 * Scope the search with Tab (All, Assets, Glossary, Teams, Pages) or the chips under the input, and
 * type `>` to see commands only. With an empty query it shows `recents`, then every command.
 *
 * Every row shows its own shortcut as a keycap when it has one, and the active row also shows the
 * Enter keycap, so the key that will act is always on screen. Rows without a shortcut show only the
 * Enter keycap when active.
 *
 * Built as a modal `<dialog>` containing an ARIA combobox (the input, with `aria-activedescendant`)
 * that controls a grouped listbox, following
 * https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/. Keys:
 * ArrowDown and ArrowUp move and wrap, Home and End jump to the first and last result, PageDown and
 * PageUp move by ten, Enter opens the active row, Tab and Shift+Tab change scope, Escape closes and
 * returns focus to where it was. Set `global-shortcut` to toggle with ⌘K or Ctrl+K anywhere.
 *
 * Selecting a row fires `mm-select`; unless that is cancelled, the palette then calls the command's
 * `run()` or navigates to its `href`. It always closes.
 *
 * With `search-href` (such as `/discover?q={query}`), every typed query ends with a "Search the
 * catalog for …" row that opens the full search page, so people can always get from the palette to
 * every result, including when nothing matched. It fires `mm-search-all`; cancel it to route in a
 * single-page app.
 *
 * @tagname mm-command-palette
 * @summary The ⌘K palette: navigation, commands and live catalogue search.
 * @csspart panel - The dialog panel (`mm-raised`, `radius-lg`, `shadow-dialog`).
 * @csspart input - The native input (role combobox).
 * @csspart scopes - The scope chip row.
 * @csspart listbox - The scrolling listbox.
 * @csspart option - Each option row.
 * @csspart footer - The navigation hints on `mm-sunken`.
 * @fires mm-select - {MmPaletteSelectDetail} When a row is chosen. Cancel it to handle `href` or `run` yourself.
 * @fires mm-open - {null} When the palette opens.
 * @fires mm-close - {null} When the palette closes.
 * @fires mm-query - {MmPaletteQueryDetail} When the query or scope changes.
 * @fires mm-search-all - {MmPaletteSearchAllDetail} When "Search the catalog for …" is chosen. Cancel it to route yourself.
 */
export class MmCommandPalette extends LitElement {
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
        display: flex;
        flex-direction: column;
        width: min(560px, calc(100vw - 2 * var(--space-4)));
        max-height: min(560px, 76vh);
        padding: 0;
        color: var(--mm-text);
        background: var(--mm-raised);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dialog);
        overflow: hidden;
        /* Guidelines: animated command palettes are banned. Open and close are instant. */
        transition: none;
        animation: none;
      }
      :host([inline]) .panel {
        max-width: 100%;
      }
      dialog.panel {
        position: fixed;
        inset: 0;
        margin: 12vh auto auto;
        z-index: var(--mm-z-dialog);
      }
      dialog.panel:not([open]) {
        display: none;
      }
      dialog::backdrop {
        /* No scrim token yet: a paper wash reads as a dimmed page in both themes. */
        background: var(--mm-scrim);
        transition: none;
      }
      .field {
        display: flex;
        flex: none;
        align-items: center;
        gap: 10px;
        height: 48px;
        padding-inline: var(--space-4);
        border-bottom: 1px solid var(--mm-rule);
      }
      .field mm-icon {
        color: var(--mm-text-2);
      }
      input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        background: none;
        color: var(--mm-text);
        font: var(--text-body);
        line-height: 1;
        outline: none;
      }
      input::placeholder {
        color: var(--mm-text-2);
        opacity: 1;
      }
      input::-webkit-search-cancel-button {
        display: none;
      }
      @media (pointer: coarse) {
        input {
          font-size: 16px;
        }
      }
      .scopes {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4) 0;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        height: 24px;
        padding-inline: 10px;
        border-radius: var(--radius-full);
        border: 1px solid var(--mm-rule);
        background: var(--mm-surface);
        color: var(--mm-text);
        font: var(--text-label);
        line-height: 1;
        cursor: pointer;
        transition:
          border-color var(--mm-dur-press) var(--mm-ease),
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .chip:hover {
        border-color: var(--mm-control-border);
      }
      .chip[aria-pressed='true'] {
        background: var(--mm-text);
        border-color: var(--mm-text);
        color: var(--mm-on-inverse);
      }
      .prefix {
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
      }
      .list {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-block: var(--space-1) var(--space-2);
      }
      .list:empty {
        display: none;
      }
      .heading {
        padding: var(--space-2) var(--space-4) var(--space-1);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      .vlist {
        width: 100%;
      }
      .vlist > [role='option'] {
        inset-inline-start: 0;
        width: 100%;
      }
      [role='option'],
      .status {
        display: flex;
        align-items: center;
        gap: 10px;
        height: var(--row-compact);
        padding-inline: var(--space-4);
        font: var(--text-dense);
        color: var(--mm-text);
        cursor: pointer;
        user-select: none;
      }
      .status {
        cursor: default;
        color: var(--mm-text-2);
      }
      [role='option'][aria-selected='true'] {
        background: var(--mm-selected);
      }
      [role='option'] > mm-icon,
      .status > mm-icon {
        flex: none;
        color: var(--mm-text-2);
      }
      .label {
        flex: 0 1 auto;
        min-width: 0;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .label:only-of-type,
      .label.wide {
        max-width: none;
        flex: 1 1 auto;
      }
      mark {
        background: none;
        color: inherit;
        font-weight: 600;
      }
      .secondary {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      /* MRNs as row metadata: the text face, middle-truncated so the last segment stays visible. */
      .mid {
        display: flex;
      }
      .mid .head {
        flex: 0 1 auto;
        min-width: 2ch;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mid .tail {
        flex: none;
      }
      .keys {
        display: inline-flex;
        flex: none;
        align-items: center;
        gap: var(--space-1);
        margin-inline-start: auto;
      }
      .retry > mm-icon {
        color: var(--mm-danger);
      }
      .empty {
        padding: var(--space-6) var(--space-4);
        font: var(--text-dense);
        color: var(--mm-text-2);
        text-align: center;
      }
      .empty q {
        quotes: '“' '”';
        color: var(--mm-text);
        font-weight: 600;
      }
      .foot {
        display: flex;
        flex: none;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1) var(--space-4);
        min-height: 36px;
        padding-inline: var(--space-4);
        border-top: 1px solid var(--mm-rule);
        background: var(--mm-sunken);
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .foot span {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
      }
    `,
  ];

  /** Opens the palette as a modal dialog. */
  @property({ type: Boolean, reflect: true }) accessor open = false;
  /** Renders the panel in place instead of as a modal, for documentation and embedded launchers. */
  @property({ type: Boolean, reflect: true }) accessor inline = false;
  /** Static navigation and actions, filtered locally. Filter by permission before passing them in. */
  @property({ attribute: false }) accessor commands: PaletteCommand[] = [];
  /** Shown above the commands when the query is empty. */
  @property({ attribute: false }) accessor recents: PaletteItem[] = [];
  /** Live catalogue search. Called 120ms after typing stops; the signal aborts when a newer query starts. */
  @property({ attribute: false }) accessor search: PaletteSearch | undefined;
  /** The search text, without the `>` prefix. */
  @property() accessor query = '';
  /** `all` (default), `assets`, `glossary`, `teams`, `pages` or `commands` (the `>` prefix). */
  @property({ reflect: true }) accessor scope: PaletteScope = 'all';
  @property() accessor placeholder = '';
  /** The full search page, with `{query}` where the encoded query goes, e.g. `/discover?q={query}`. Adds a "Search the catalog for …" row to every query. */
  @property({ attribute: 'search-href' }) accessor searchHref = '';
  /** Toggle with ⌘K on Apple platforms and Ctrl+K elsewhere, from anywhere on the page. */
  @property({ type: Boolean, attribute: 'global-shortcut' }) accessor globalShortcut = false;
  /** Also open with "/" when focus is not in a text field. */
  @property({ type: Boolean, attribute: 'slash-shortcut' }) accessor slashShortcut = false;

  @state() accessor #active = 0;
  @state() accessor #results: PaletteResult[] = [];
  @state() accessor #resultsFor = '';
  @state() accessor #pending = false;
  @state() accessor #error = false;

  @query('dialog') accessor #dialog!: HTMLDialogElement | null;
  @query('input') accessor #input!: HTMLInputElement | null;
  @query('.list') accessor #list!: HTMLElement | null;

  #id = uid('palette');
  #loading = new DelayedVisibility(this);
  #timer?: ReturnType<typeof setTimeout>;
  #abort?: AbortController;
  #returnFocus: Element | null = null;
  #groups: Group[] = [];
  #rows: Row[] = [];
  #wasOpen = false;
  #scrollPending = false;

  /** Opens the palette and focuses the input. */
  show() {
    this.open = true;
    // Synchronous, so the palette is open (and focus moved) before the next frame or the next listener.
    if (this.hasUpdated && !this.inline) this.#syncOpen();
  }
  /** Closes the palette and returns focus to where it was. */
  hide() {
    this.open = false;
    if (this.hasUpdated && !this.inline) this.#syncOpen();
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
    this.#abort?.abort();
    clearTimeout(this.#timer);
  }

  #onGlobalKey = (e: KeyboardEvent) => {
    if (this.inline || e.defaultPrevented) return;
    if (this.globalShortcut && e.key.toLowerCase() === 'k' && isModKey(e) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      this.toggle();
      return;
    }
    if (this.slashShortcut && !this.open && e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTextEntry(deepActive())) {
      e.preventDefault();
      this.show();
    }
  };

  /* --------------------------------------------------------------- data flow */

  /** The text that is matched, after the `>` prefix is removed. */
  get #text() {
    return this.query.trim();
  }

  #buildRows() {
    const q = this.#text;
    const scope = this.scope;
    const groups: Group[] = [];
    const add = (label: string, rows: Row[]) => {
      if (!rows.length) return;
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.rows.push(...rows);
      else groups.push({ id: `${this.#id}-g${groups.length}`, label, rows, start: 0 });
    };

    const commandInScope = (c: PaletteCommand) =>
      scope === 'all' || (scope === 'pages' && commandKind(c) === 'page') || (scope === 'commands' && commandKind(c) === 'action');
    const resultInScope = (r: PaletteResult) => scopeKinds[scope]?.includes(r.kind) ?? false;
    const groupOf = (c: PaletteCommand) => c.group ?? (commandKind(c) === 'page' ? tr('paletteGroupPages', 'Pages') : tr('paletteGroupCommands', 'Commands'));

    if (!q) {
      const recents = this.recents.filter((i) => (isResult(i) ? resultInScope(i) : commandInScope(i)));
      add(tr('paletteGroupRecent', 'Recent'), recents.map((item) => ({ item, ranges: [] })));
      for (const c of this.commands) if (commandInScope(c)) add(groupOf(c), [{ item: c, ranges: [] }]);
    } else {
      const scored = this.commands
        .filter(commandInScope)
        .map((c) => ({ c, m: fuzzyScore(q, c.label, c.keywords) }))
        .filter((x): x is { c: PaletteCommand; m: FuzzyMatch } => !!x.m)
        .sort((a, b) => b.m.score - a.m.score);
      // Groups appear in the order of their best match.
      for (const { c, m } of scored) add(groupOf(c), [{ item: c, ranges: m.ranges }]);
      if (this.#searches) {
        if (this.#error) add(tr('paletteGroupSearch', 'Catalog search'), [{ item: 'retry', ranges: [] }]);
        else if (this.#resultsFor === this.#searchKey)
          for (const kind of resultKinds) {
            const rows = this.#results.filter((r) => r.kind === kind && resultInScope(r)).map((item) => ({ item, ranges: rangesFor(q, item.label) }));
            add(kindGroup(kind), rows);
          }
      }
      if (this.searchHref && scope !== 'pages' && scope !== 'commands') add(tr('paletteGroupSearch', 'Catalog search'), [{ item: 'search-all', ranges: [] }]);
    }
    let start = 0;
    for (const g of groups) {
      g.start = start;
      start += g.rows.length;
    }
    this.#groups = groups;
    this.#rows = groups.flatMap((g) => g.rows);
  }

  /** True when the current scope and query call `search`. */
  get #searches() {
    return !!this.search && !!this.#text && this.scope !== 'pages' && this.scope !== 'commands';
  }
  get #searchKey() {
    return `${this.scope}\u0000${this.#text}`;
  }

  #schedule() {
    clearTimeout(this.#timer);
    this.#abort?.abort();
    this.#error = false;
    if (!this.#searches) {
      this.#pending = false;
      this.#loading.set(false);
      return;
    }
    this.#pending = true;
    this.#timer = setTimeout(() => void this.#runSearch(), DEBOUNCE);
  }

  async #runSearch() {
    const search = this.search;
    if (!search || !this.#searches) return;
    this.#abort?.abort();
    const ctl = new AbortController();
    this.#abort = ctl;
    const key = this.#searchKey;
    this.#pending = true;
    this.#error = false;
    this.#loading.set(true);
    try {
      const results = await search(this.#text, ctl.signal, this.scope);
      if (ctl.signal.aborted) return;
      this.#results = results;
      this.#resultsFor = key;
    } catch (err) {
      if (ctl.signal.aborted || (err as Error)?.name === 'AbortError') return;
      this.#error = true;
      this.#results = [];
      this.#resultsFor = '';
    }
    this.#pending = false;
    this.#loading.set(false);
  }

  #emitQuery() {
    emit<MmPaletteQueryDetail>(this, 'mm-query', { query: this.query, scope: this.scope });
  }

  #onInput = (e: Event) => {
    const raw = (e.target as HTMLInputElement).value;
    if (raw.startsWith('>')) {
      this.scope = 'commands';
      this.query = raw.slice(1).trimStart();
      (e.target as HTMLInputElement).value = this.query;
    } else {
      this.query = raw;
    }
    this.#active = 0;
  };

  #setScope(scope: PaletteScope) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.#active = 0;
  }

  /* --------------------------------------------------------------- keyboard */

  #move(to: number) {
    const n = this.#rows.length;
    if (!n) return;
    this.#setActive(((to % n) + n) % n);
  }

  /** Moves the active row from the keyboard and scrolls it into view after the update. */
  #setActive(i: number) {
    this.#active = i;
    this.#scrollPending = true;
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const n = this.#rows.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.#move(this.#active + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.#move(this.#active - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        if (n) this.#setActive(Math.min(n - 1, this.#active + 10));
        break;
      case 'PageUp':
        e.preventDefault();
        if (n) this.#setActive(Math.max(0, this.#active - 10));
        break;
      case 'Home':
        if (!n || e.shiftKey) return;
        e.preventDefault();
        this.#setActive(0);
        break;
      case 'End':
        if (!n || e.shiftKey) return;
        e.preventDefault();
        this.#setActive(n - 1);
        break;
      case 'Enter':
        e.preventDefault();
        this.#choose(this.#active);
        break;
      case 'Tab': {
        e.preventDefault();
        const i = tabScopes.indexOf(this.scope);
        const next = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + tabScopes.length) % tabScopes.length;
        this.#setScope(tabScopes[next]!);
        break;
      }
      case 'Backspace':
        // Backspace in an empty field leaves the `>` command scope, as if deleting the prefix.
        if (this.scope === 'commands' && !this.query) {
          e.preventDefault();
          this.#setScope('all');
        }
        break;
      case 'Escape':
        if (this.inline) return;
        e.preventDefault();
        this.hide();
        break;
    }
  };

  #choose(index: number) {
    const row = this.#rows[index];
    if (!row) return;
    if (row.item === 'retry') {
      void this.#runSearch();
      return;
    }
    if (row.item === 'search-all') {
      const href = this.searchHref.replaceAll('{query}', encodeURIComponent(this.#text));
      const go = emit<MmPaletteSearchAllDetail>(this, 'mm-search-all', { query: this.#text, scope: this.scope, href }, { cancelable: true });
      if (!this.inline) this.hide();
      if (go && typeof window !== 'undefined') window.location.assign(href);
      return;
    }
    const item = row.item;
    const proceed = emit<MmPaletteSelectDetail>(this, 'mm-select', { item }, { cancelable: true });
    if (!this.inline) this.hide();
    if (!proceed) return;
    if (!isResult(item) && item.run) item.run();
    else if (item.href && typeof window !== 'undefined') window.location.assign(item.href);
  }

  /* --------------------------------------------------------------- lifecycle */

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('query') || changed.has('scope')) {
      if (this.hasUpdated) this.#emitQuery();
      this.#schedule();
    }
    if (changed.has('search') && this.hasUpdated) this.#schedule();
    this.#buildRows();
    if (this.#active >= this.#rows.length) this.#active = Math.max(0, this.#rows.length - 1);
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open') && !this.inline) this.#syncOpen();
    this.#syncActiveDescendant();
    if (this.#scrollPending) {
      this.#scrollPending = false;
      void this.#scrollActive();
    }
  }

  /**
   * Points the input at the active option only once that option is in the DOM. A virtualised group
   * draws its rows a moment after the update, so the reference is set again when it has.
   */
  #syncActiveDescendant = (tries = 0) => {
    const input = this.#input;
    if (!input) return;
    const id = this.#rows.length ? this.#optId(this.#active) : '';
    if (id && this.renderRoot.querySelector(`#${id}`)) input.setAttribute('aria-activedescendant', id);
    else {
      input.removeAttribute('aria-activedescendant');
      // A few frames for the virtualiser to draw the row; a row scrolled out of view is simply not referenced.
      if (id && tries < 3 && typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => this.#syncActiveDescendant(tries + 1));
    }
  };

  #syncOpen() {
    const dialog = this.#dialog;
    if (!dialog) return;
    if (this.open && !dialog.open) {
      this.#returnFocus = deepActive();
      dialog.showModal();
      this.#input?.focus();
      this.#input?.select();
      this.#wasOpen = true;
      emit(this, 'mm-open', null);
    } else if (!this.open && dialog.open) {
      dialog.close();
    }
    if (!this.open && this.#wasOpen) {
      this.#wasOpen = false;
      const back = this.#returnFocus as HTMLElement | null;
      this.#returnFocus = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
      emit(this, 'mm-close', null);
    }
  }

  async #scrollActive() {
    const group = this.#groups.find((g) => this.#active >= g.start && this.#active < g.start + g.rows.length);
    if (!group) return;
    const local = this.#active - group.start;
    if (group.rows.length > VIRTUALISE_OVER) {
      const host = this.renderRoot.querySelector<HTMLElement>(`#${group.id}-v`) as (HTMLElement & VirtualizerHostElement) | null;
      const v = host?.[virtualizerRef];
      if (!v) return;
      const scroll = () => v.element(local)?.scrollIntoView({ block: 'nearest' });
      try {
        scroll();
      } catch {
        // The virtualiser has not laid out yet: try again once it has.
        try {
          await v.layoutComplete;
          scroll();
        } catch {
          /* the list was replaced before its layout finished */
        }
      }
    } else {
      const el = this.renderRoot.querySelector(`#${this.#optId(this.#active)}`);
      if (el && this.#list) {
        const r = el.getBoundingClientRect();
        const l = this.#list.getBoundingClientRect();
        if (r.top < l.top || r.bottom > l.bottom) el.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /* --------------------------------------------------------------- rendering */

  #optId(i: number) {
    return `${this.#id}-o${i}`;
  }

  #highlight(label: string, ranges: MatchRange[]): unknown {
    if (!ranges.length) return label;
    const out: unknown[] = [];
    let at = 0;
    for (const [s, e] of ranges) {
      if (s > at) out.push(label.slice(at, s));
      out.push(html`<mark>${label.slice(s, e)}</mark>`);
      at = e;
    }
    if (at < label.length) out.push(label.slice(at));
    return out;
  }

  /** MRNs keep their end visible: the head truncates with an ellipsis, the last segment stays. */
  #middle(text: string): TemplateResult {
    const cut = Math.max(text.lastIndexOf('.'), text.lastIndexOf('/'));
    const tailLen = cut >= 0 && text.length - cut <= 32 ? text.length - cut : Math.min(24, text.length);
    const head = text.slice(0, text.length - tailLen);
    const tail = text.slice(text.length - tailLen);
    return html`<span class="secondary mid" dir="ltr" title=${text}><span class="head">${head}</span><span class="tail">${tail}</span></span>`;
  }

  #renderOption = (row: Row, index: number, total: number): TemplateResult => {
    const active = index === this.#active;
    const id = this.#optId(index);
    const common = {
      id,
      onClick: () => this.#choose(index),
      onMove: () => {
        if (this.#active !== index) this.#active = index;
      },
    };
    const enter = active ? html`<mm-kbd keys="enter" aria-hidden="true"></mm-kbd>` : nothing;
    if (row.item === 'retry') {
      return html`<div
        role="option"
        part="option"
        class="retry"
        id=${common.id}
        aria-selected=${active ? 'true' : 'false'}
        aria-setsize=${total}
        aria-posinset=${index + 1}
        @click=${common.onClick}
        @pointermove=${common.onMove}
      >
        <mm-icon name="error" aria-hidden="true"></mm-icon>
        <span class="label">${tr('paletteSearchFailed', 'Catalog search failed')}</span>
        <span class="secondary">${tr('paletteRetry', 'Retry search')}</span>
        <span class="keys">${enter}</span>
      </div>`;
    }
    if (row.item === 'search-all') {
      return html`<div
        role="option"
        part="option"
        id=${common.id}
        aria-selected=${active ? 'true' : 'false'}
        aria-setsize=${total}
        aria-posinset=${index + 1}
        @click=${common.onClick}
        @pointermove=${common.onMove}
      >
        <mm-icon name="search" aria-hidden="true"></mm-icon>
        <span class="label wide">${tr('paletteSearchAll', 'Search the catalog for “{query}”', { query: this.#text })}</span>
        <span class="keys">${enter}</span>
      </div>`;
    }
    const item = row.item;
    const result = isResult(item) ? item : undefined;
    const command = result ? undefined : (item as PaletteCommand);
    const icon = result?.provider
      ? html`<mm-provider-logo provider=${result.provider} size="16" decorative></mm-provider-logo>`
      : html`<mm-icon name=${item.icon ?? (result ? kindIcon(result.kind) : 'arrow-forward')} aria-hidden="true"></mm-icon>`;
    const secondaryText = result?.mrn ?? item.description;
    const secondary = result?.mrn ? this.#middle(result.mrn) : secondaryText ? html`<span class="secondary">${secondaryText}</span>` : nothing;
    const shortcut = command?.shortcut;
    return html`<div
      role="option"
      part="option"
      id=${common.id}
      aria-selected=${active ? 'true' : 'false'}
      aria-setsize=${total}
      aria-posinset=${index + 1}
      aria-keyshortcuts=${ifDefined(shortcut ? ariaShortcut(shortcut) : undefined)}
      @click=${common.onClick}
      @pointermove=${common.onMove}
    >
      ${icon}
      <span class="label ${secondaryText ? '' : 'wide'}">${this.#highlight(item.label, row.ranges)}</span>
      ${secondary}
      <span class="keys">${shortcut ? this.#shortcut(shortcut) : nothing}${enter}</span>
    </div>`;
  };

  /** A shortcut such as `mod+b` is one keycap group; a sequence such as `g d` is one group per step. */
  #shortcut(s: string) {
    return s
      .trim()
      .split(/\s+/)
      .map((step) => html`<mm-kbd aria-hidden="true" keys=${step}></mm-kbd>`);
  }

  #renderGroup(g: Group, total: number) {
    const headingId = `${g.id}-h`;
    const body =
      g.rows.length > VIRTUALISE_OVER
        ? html`<div class="vlist" id=${`${g.id}-v`} role="presentation" @rangeChanged=${() => this.#syncActiveDescendant()} @visibilityChanged=${() => this.#syncActiveDescendant()}>
            ${virtualize({
              items: g.rows,
              keyFunction: (r: Row) => (typeof r.item === 'string' ? r.item : r.item.id),
              renderItem: (r: Row, i: number) => this.#renderOption(r, g.start + i, total),
            })}
          </div>`
        : g.rows.map((r, i) => this.#renderOption(r, g.start + i, total));
    return html`<div role="group" aria-labelledby=${headingId}>
      <div role="presentation" class="heading" id=${headingId}>${g.label}</div>
      ${body}
    </div>`;
  }

  #status(): string {
    if (this.#loading.visible) return tr('paletteSearching', 'Searching the catalog…');
    if (this.#error) return tr('paletteSearchFailed', 'Catalog search failed');
    if (this.#isEmpty) return this.#emptyText;
    if (!this.#text) return '';
    return tr('paletteResultCount', '{count} results', { count: this.#matches });
  }
  /** Rows other than "Search the catalog for …". */
  get #matches() {
    return this.#rows.filter((r) => r.item !== 'search-all').length;
  }
  get #isEmpty() {
    return !!this.#text && !this.#matches && !this.#pending;
  }
  get #emptyText() {
    return tr('paletteEmpty', 'No results for “{query}”. Try a table name, a column or an MRN.', { query: this.#text });
  }

  override render() {
    const listId = `${this.#id}-list`;
    const total = this.#rows.length;
    const expanded = total > 0;
    const label = tr('paletteLabel', 'Command palette');
    const placeholder =
      this.placeholder ||
      (this.scope === 'commands'
        ? tr('palettePlaceholderCommands', 'Type a command')
        : tr('palettePlaceholder', 'Search the catalog or type > for commands'));
    const body = html`
      <div class="field">
        <mm-icon name="search" aria-hidden="true"></mm-icon>
        ${this.scope === 'commands' ? html`<span class="prefix" aria-hidden="true">&gt;</span>` : nothing}
        <input
          part="input"
          type="text"
          role="combobox"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label=${this.scope === 'commands' ? `${label}, ${scopeLabel('commands')}` : label}
          aria-autocomplete="list"
          aria-expanded=${expanded ? 'true' : 'false'}
          aria-controls=${listId}
          placeholder=${placeholder}
          .value=${this.query}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
        />
      </div>
      <div class="scopes" part="scopes" role="group" aria-label=${tr('paletteScope', 'Search scope')}>
        ${tabScopes.map(
          (s) => html`<button
            type="button"
            class="chip"
            tabindex="-1"
            aria-pressed=${this.scope === s ? 'true' : 'false'}
            @mousedown=${(e: Event) => e.preventDefault()}
            @click=${() => {
              this.#setScope(s);
              this.#input?.focus();
            }}
          >
            ${scopeLabel(s)}
          </button>`,
        )}
      </div>
      <div class="list" part="listbox" id=${listId} role="listbox" aria-label=${label} @mousedown=${(e: Event) => e.preventDefault()}>
        ${this.#groups.map((g) => this.#renderGroup(g, total))}
      </div>
      ${this.#loading.visible && !this.#matches
        ? html`<div class="status" aria-hidden="true"><mm-icon name="hourglass-empty"></mm-icon>${tr('paletteSearching', 'Searching the catalog…')}</div>`
        : nothing}
      ${this.#isEmpty
        ? html`<div class="empty" aria-hidden="true">
            ${tr('paletteEmptyLead', 'No results for')} <q>${this.#text}</q>. ${tr('paletteEmptyHint', 'Try a table name, a column or an MRN.')}
          </div>`
        : nothing}
      <div class="visually-hidden" role="status" aria-live="polite">${this.#status()}</div>
      <div class="foot" part="footer">
        <span><mm-kbd keys="up"></mm-kbd><mm-kbd keys="down"></mm-kbd> ${tr('paletteHintMove', 'to move')}</span>
        <span><mm-kbd keys="enter"></mm-kbd> ${tr('paletteHintOpen', 'to open')}</span>
        ${this.inline ? nothing : html`<span><mm-kbd keys="esc"></mm-kbd> ${tr('paletteHintClose', 'to close')}</span>`}
        <span><mm-kbd>Tab</mm-kbd> ${tr('paletteHintScope', 'to switch scope')}</span>
      </div>
    `;
    if (this.inline) return html`<div class="panel" part="panel">${body}</div>`;
    return html`<dialog
      class="panel"
      part="panel"
      aria-label=${label}
      @cancel=${(e: Event) => {
        e.preventDefault();
        this.hide();
      }}
      @close=${() => {
        if (this.open) this.open = false;
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
    'mm-command-palette': MmCommandPalette;
  }
}
