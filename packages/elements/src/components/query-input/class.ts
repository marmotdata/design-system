import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { t, tr } from '../../core/strings.js';
import { MmFieldControl, fieldStyles, type ValidityResult } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

/** Kinds of token in Marmot's search syntax. */
export type QueryTokenType = 'text' | 'quoted' | 'field' | 'metadata' | 'operator' | 'value' | 'keyword' | 'paren' | 'whitespace';

export interface QueryToken {
  type: QueryTokenType;
  text: string;
  /** Offset of the first character in the query. */
  start: number;
  /** Offset just past the last character. */
  end: number;
  /** Set on a quoted string or value with no closing quote. */
  unterminated?: boolean;
}

export interface QuerySuggestion {
  /** Text shown in the list. */
  label: string;
  /** Text inserted; defaults to `label`. Ending in `:` or `.` keeps the list open for the next part. */
  insert?: string;
  /** Short description shown after the label, such as "Field" or "1,284 assets". */
  description?: string;
  /** Range of the query to replace. Defaults to the token at the cursor. */
  replace?: { start: number; end: number };
  /** Reopens the list after inserting, so the next part follows (field, then operator, then value). */
  chain?: boolean;
}

export type QuerySuggestFn = (query: string, cursor: number) => Promise<QuerySuggestion[]>;

const OPERATOR = /^(?:!=|<=|>=|[:=<>!])/;
const WORD_STOP = /[\s"()[\]:=<>!]/;
const VALUE_STOP = /[\s()[\]]/;
const BOOLEAN = /^(?:AND|OR|NOT)$/;

/**
 * Splits a Marmot search query into tokens covering every character, in order: free text,
 * quoted phrases, `field:value` pairs, `@metadata.path` keys, operators (`: = != < <= > >= !`),
 * `contains` and `range` after a field, `[a TO b]` ranges and the boolean keywords AND, OR and NOT.
 */
export function tokenize(query: string): QueryToken[] {
  const out: QueryToken[] = [];
  let i = 0;
  let expectValue = false;
  let inRange = false;
  const push = (type: QueryTokenType, start: number, end: number, unterminated = false) => {
    const tok: QueryToken = { type, text: query.slice(start, end), start, end };
    if (unterminated) tok.unterminated = true;
    out.push(tok);
  };
  const prevSignificant = () => {
    for (let k = out.length - 1; k >= 0; k--) if (out[k]!.type !== 'whitespace') return out[k]!;
    return undefined;
  };
  while (i < query.length) {
    const c = query[i]!;
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < query.length && /\s/.test(query[j]!)) j++;
      push('whitespace', i, j);
      i = j;
      continue;
    }
    if (c === '"') {
      const close = query.indexOf('"', i + 1);
      const end = close < 0 ? query.length : close + 1;
      push(expectValue || inRange ? 'value' : 'quoted', i, end, close < 0);
      expectValue = false;
      i = end;
      continue;
    }
    if (c === '(' || c === ')' || c === '[' || c === ']') {
      if (c === '[') inRange = prevSignificant()?.text === 'range';
      push('paren', i, i + 1);
      if (c === ']') inRange = false;
      expectValue = false;
      i++;
      continue;
    }
    const op = OPERATOR.exec(query.slice(i));
    if (op) {
      push('operator', i, i + op[0].length);
      // A leading "!" negates the next term; every other operator is followed by a value.
      expectValue = op[0] !== '!';
      i += op[0].length;
      continue;
    }
    let j = i + 1;
    while (j < query.length && !WORD_STOP.test(query[j]!)) j++;
    const word = query.slice(i, j);
    if (BOOLEAN.test(word) || (inRange && word === 'TO')) {
      push('keyword', i, j);
      expectValue = false;
      i = j;
      continue;
    }
    if (expectValue || inRange) {
      let k = i + 1;
      while (k < query.length && !VALUE_STOP.test(query[k]!)) k++;
      push('value', i, k);
      expectValue = false;
      i = k;
      continue;
    }
    const prev = prevSignificant();
    if (word.startsWith('@')) push('metadata', i, j);
    else if ((word === 'contains' || word === 'range') && (prev?.type === 'metadata' || prev?.type === 'field')) {
      push('keyword', i, j);
      expectValue = word === 'contains';
    } else if (j < query.length && /[:=<>!]/.test(query[j]!)) push('field', i, j);
    else push('text', i, j);
    i = j;
  }
  return out;
}

/**
 * The Discover search box. People type free text mixed with Marmot's search syntax
 * (`type:table`, `provider:snowflake`, `@metadata.owner = "Analytics Engineering"`, AND, OR, NOT),
 * and the structured parts are highlighted as they type: field keys in slate, values in ink,
 * operators and boolean keywords in ink-2. The field is a real `<input>` with transparent text under
 * an aria-hidden highlighted copy, so caret, selection, IME and screen readers behave natively. Every
 * token is set in the text face so the copy lines up with the caret to the pixel.
 *
 * Pass `createQuerySuggest({ fields })` as `suggest` for editor-style completion: `@` lists the
 * fields, then operators, values and AND, OR or NOT follow as the query is typed.
 *
 * Optional suggestions follow the WAI-ARIA combobox pattern with a listbox popup
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): ArrowDown opens and moves, ArrowUp moves,
 * Enter or Tab accepts the active suggestion, Escape closes. Enter with no active suggestion fires
 * `mm-search` and submits the owning form unless the event is cancelled. The `shortcut` key ("/" by
 * default) focuses the field from anywhere on the page.
 *
 * @tagname mm-query-input
 * @summary Search box with highlighting for Marmot's query syntax.
 * @csspart field - The bordered box.
 * @csspart icon - The leading search icon.
 * @csspart input - The native input.
 * @csspart listbox - The suggestions popup.
 * @csspart option - Each suggestion.
 * @fires mm-input - {{ value: string; tokens: QueryToken[] }} Fired on every edit.
 * @fires mm-change - {{ value: string }} Fired when the query is committed with Enter or on blur after an edit.
 * @fires mm-search - {{ query: string; tokens: QueryToken[] }} Fired on Enter with no active suggestion. Cancel it to stop form submission.
 * @fires change - Native change, re-dispatched from the host on commit.
 */
export class MmQueryInput extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      /* Field furniture (label, box, help, error, disabled) comes from fieldStyles; only the mirror layering lives here. */
      .box {
        position: relative;
      }
      .box.disabled .mirror,
      .box.disabled .mirror span {
        color: var(--mm-text-2);
      }
      .well {
        position: relative;
        flex: 1;
        min-width: 0;
        height: 100%;
        overflow: hidden;
      }
      /* The input and its highlighted copy must share every metric, so both get the same type settings. */
      input,
      .mirror {
        font: inherit;
        font-kerning: none;
        font-variant-ligatures: none;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        word-spacing: 0;
        text-transform: none;
      }
      .well .input {
        display: block;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        padding: 0;
        color: transparent;
        caret-color: var(--mm-text);
        text-overflow: clip;
      }
      input::selection {
        background: var(--mm-selected);
        color: transparent;
      }
      .mirror {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        white-space: pre;
        pointer-events: none;
        overflow: hidden;
        color: var(--mm-text);
      }
      .mirror-inner {
        display: block;
        white-space: pre;
        will-change: transform;
      }
      .tk-field,
      .tk-metadata {
        color: var(--mm-info);
      }
      .tk-value,
      .tk-text,
      .tk-quoted {
        color: var(--mm-text);
      }
      .tk-operator,
      .tk-paren {
        color: var(--mm-text-2);
      }
      /* Weight 600 without changing advance widths, so the caret stays aligned. */
      .tk-keyword {
        color: var(--mm-text-2);
        text-shadow:
          0.35px 0 0 currentColor,
          -0.35px 0 0 currentColor;
      }
      .tk-unterminated {
        text-decoration: underline wavy var(--mm-danger);
        text-decoration-skip-ink: none;
        text-underline-offset: 3px;
      }
      .kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 5px;
        font: var(--text-keycap, 500 13px/1 var(--font-mono));
        color: var(--mm-text-2);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-bottom-width: 2px;
        border-radius: var(--radius-sm);
        flex: none;
      }
      .spinner {
        width: 14px;
        height: 14px;
        flex: none;
        border-radius: 50%;
        border: 1.5px solid var(--mm-text-2);
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
          border-right-color: var(--mm-text-2);
          opacity: 0.6;
        }
      }
      .listbox {
        margin: 0;
        inset: auto;
        min-width: 240px;
        max-width: min(560px, calc(100vw - 16px));
        overflow: auto;
        padding: 4px;
        background: var(--mm-raised);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-float);
        font: var(--text-dense);
        z-index: var(--mm-z-popover);
      }
      .listbox.animate:popover-open {
        animation: appear var(--mm-dur-menu) var(--mm-ease);
      }
      @keyframes appear {
        from {
          opacity: 0;
        }
      }
      .option {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: var(--mm-menu-row, 32px);
        padding: 0 10px;
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .option:hover {
        background: var(--mm-sunken);
      }
      .option[aria-selected='true'] {
        background: var(--mm-selected);
        color: var(--mm-text);
      }
      .opt-label {
        flex: 1;
        min-width: 0;
        font: var(--text-mono-dense);
        overflow-wrap: anywhere;
      }
      .opt-desc {
        font: var(--text-caption);
        color: var(--mm-text-2);
        white-space: nowrap;
      }
      .status {
        padding: 6px 10px;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
    `,
  ];

  /** The query. */
  @property() accessor value = '';
  @property() accessor placeholder = '';
  /** Shows a spinner while results load. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** Key that focuses the field from anywhere on the page, shown as a keycap. Empty to turn off. */
  @property() accessor shortcut = '/';
  /** Returns suggestions for the query at the cursor. Calls are debounced and stale answers ignored. */
  @property({ attribute: false }) accessor suggest: QuerySuggestFn | undefined;
  /** Debounce in milliseconds before `suggest` is called while typing. */
  @property({ type: Number, attribute: 'suggest-delay' }) accessor suggestDelay = 120;

  @state() accessor #open = false;
  @state() accessor #focused = false;
  @state() accessor #suggestions: QuerySuggestion[] = [];
  /** Polite announcement of how many suggestions opened, since typing leaves no option active. */
  @state() accessor #announce = '';
  @state() accessor #active = -1;
  @state() accessor #fetching = false;

  @query('input') accessor #input!: HTMLInputElement;
  @query('.mirror-inner') accessor #mirror!: HTMLElement | null;
  @query('.listbox') accessor #listbox!: HTMLElement | null;
  @query('.box') accessor #field!: HTMLElement;

  #default = '';
  #committed = '';
  #req = 0;
  #timer?: ReturnType<typeof setTimeout>;
  #unfloat?: () => void;
  #spinner = new DelayedVisibility(this);
  #tokensFor = '';
  #tokens: QueryToken[] = [];

  /** Tokens of the current value. */
  get tokens(): QueryToken[] {
    if (this.#tokensFor !== this.value || !this.#tokens.length) {
      this.#tokens = tokenize(this.value);
      this.#tokensFor = this.value;
    }
    return this.#tokens;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasUpdated) this.#default = this.value;
    this.#committed = this.value;
    if (typeof document !== 'undefined') document.addEventListener('keydown', this.#onGlobalKey);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (typeof document !== 'undefined') document.removeEventListener('keydown', this.#onGlobalKey);
    clearTimeout(this.#timer);
    this.#unfloat?.();
  }

  override focus(options?: FocusOptions): void {
    this.#input?.focus(options);
  }
  override blur(): void {
    this.#input?.blur();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('loading')) this.#spinner.set(this.loading);
    if (changed.has('value') || changed.has('required') || changed.has('error') || changed.has('disabled')) {
      this.setFormValue(this.isDisabled ? null : this.value);
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.#sync();
  }

  protected override computeValidity(): ValidityResult {
    if (this.error) return { flags: { customError: true }, message: this.error };
    if (this.required && !this.value.trim()) return { flags: { valueMissing: true }, message: tr('queryRequired', 'Enter a search query.') };
    return { flags: {}, message: '' };
  }

  formResetCallback(): void {
    this.value = this.#default;
    this.#committed = this.#default;
    this.#close();
    this.resetField();
  }

  /** Keep the highlighted copy under the input's own horizontal scroll. */
  #sync = () => {
    const inp = this.#input;
    const m = this.#mirror;
    if (inp && m) m.style.transform = `translateX(${-inp.scrollLeft}px)`;
  };
  #syncSoon = () => {
    this.#sync();
    requestAnimationFrame(this.#sync);
  };

  #onGlobalKey = (e: KeyboardEvent) => {
    if (!this.shortcut || e.key !== this.shortcut || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.isDisabled) return;
    const target = e.composedPath()[0] as HTMLElement | undefined;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    e.preventDefault();
    this.focus();
  };

  #onInput = () => {
    this.value = this.#input.value;
    this.emitInput({ value: this.value, tokens: this.tokens });
    this.#syncSoon();
    this.#requestSuggestions(false);
  };

  #commit() {
    if (this.value === this.#committed) return;
    this.#committed = this.value;
    this.touched = true;
    this.emitChange({ value: this.value });
  }

  #requestSuggestions(explicit: boolean) {
    if (!this.suggest) return;
    clearTimeout(this.#timer);
    const id = ++this.#req;
    const query = this.value;
    const cursor = this.#input?.selectionStart ?? query.length;
    const run = async () => {
      this.#fetching = true;
      if (explicit) this.#show();
      let result: QuerySuggestion[] = [];
      try {
        result = (await this.suggest?.(query, cursor)) ?? [];
      } catch {
        result = [];
      }
      if (id !== this.#req) return;
      this.#fetching = false;
      this.#suggestions = result;
      this.#active = explicit && result.length ? 0 : -1;
      this.#announce = result.length ? tr('suggestionsCount', '{n} suggestions, use the arrow keys to choose', { n: result.length }) : explicit ? t('noResults') : '';
      if (result.length || explicit) this.#show();
      else this.#close();
    };
    if (explicit) void run();
    else this.#timer = setTimeout(() => void run(), this.suggestDelay);
  }

  async #show() {
    if (this.#open && this.#listbox?.matches(':popover-open')) return;
    this.#open = true;
    await this.updateComplete;
    const lb = this.#listbox;
    if (!lb) return;
    lb.classList.toggle('animate', !openedFromKeyboard());
    try {
      lb.showPopover();
    } catch {
      /* already open or unsupported */
    }
    this.#unfloat?.();
    this.#unfloat = float(this.#field, lb, { matchWidth: true });
  }

  #close() {
    clearTimeout(this.#timer);
    this.#announce = '';
    this.#req++;
    this.#fetching = false;
    this.#active = -1;
    if (!this.#open) return;
    this.#open = false;
    this.#unfloat?.();
    this.#unfloat = undefined;
    try {
      this.#listbox?.hidePopover();
    } catch {
      /* not open */
    }
  }

  #replaceRange(cursor: number): { start: number; end: number } {
    const tok = this.tokens.find((k) => k.start < cursor && cursor <= k.end);
    if (!tok || tok.type === 'whitespace' || tok.type === 'operator' || tok.type === 'paren') return { start: cursor, end: cursor };
    return { start: tok.start, end: tok.end };
  }

  #accept(index: number) {
    const s = this.#suggestions[index];
    if (!s) return;
    const insert = s.insert ?? s.label;
    const cursor = this.#input.selectionStart ?? this.value.length;
    const { start, end } = s.replace ?? this.#replaceRange(cursor);
    const joins = /[:.]$/.test(insert);
    const continues = joins || !!s.chain;
    const after = this.value.slice(end);
    const spacer = joins || /^\s/.test(after) ? '' : ' ';
    this.value = this.value.slice(0, start) + insert + spacer + after;
    const caret = start + insert.length + spacer.length;
    this.#input.value = this.value;
    this.#input.setSelectionRange(caret, caret);
    this.emitInput({ value: this.value, tokens: this.tokens }, true);
    this.#syncSoon();
    if (continues) this.#requestSuggestions(true);
    else this.#close();
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    const n = this.#suggestions.length;
    switch (e.key) {
      case 'ArrowDown':
        if (!this.suggest) return;
        e.preventDefault();
        if (!this.#open) this.#requestSuggestions(true);
        else if (n) this.#active = (this.#active + 1) % n;
        break;
      case 'ArrowUp':
        if (!this.#open || !n) return;
        e.preventDefault();
        this.#active = this.#active <= 0 ? n - 1 : this.#active - 1;
        break;
      case 'Enter':
        e.preventDefault();
        if (this.#open && this.#active >= 0) {
          this.#accept(this.#active);
          return;
        }
        this.#close();
        this.#commit();
        if (emit(this, 'mm-search', { query: this.value, tokens: this.tokens }, { cancelable: true })) this.implicitSubmit();
        break;
      case 'Tab':
        if (this.#open && this.#active >= 0 && !e.shiftKey) {
          e.preventDefault();
          this.#accept(this.#active);
        } else this.#close();
        break;
      case 'Escape':
        if (this.#open) {
          e.preventDefault();
          e.stopPropagation();
          this.#close();
        }
        break;
      default:
        this.#syncSoon();
    }
  };

  #onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (this.contains(to) || this.renderRoot.contains(to))) return;
    this.#focused = false;
    this.#close();
    this.#commit();
  };

  #tokenTemplate(k: QueryToken) {
    if (k.type === 'whitespace') return k.text;
    return html`<span class="tk-${k.type}${k.unterminated ? ' tk-unterminated' : ''}">${k.text}</span>`;
  }

  #renderListbox() {
    if (!this.suggest) return nothing;
    const label = this.label || t('search');
    return html`<div
      class="listbox"
      part="listbox"
      id="listbox"
      role="listbox"
      popover="manual"
      aria-label=${label}
      aria-busy=${this.#fetching ? 'true' : 'false'}
    >
      ${this.#open
        ? this.#suggestions.length
          ? this.#suggestions.map(
              (s, i) => html`<div
                class="option"
                part="option"
                id="opt-${i}"
                role="option"
                aria-selected=${i === this.#active ? 'true' : 'false'}
                @mousedown=${(e: Event) => e.preventDefault()}
                @click=${() => this.#accept(i)}
                @pointermove=${() => (this.#active = i)}
              >
                <span class="opt-label">${s.label}</span>${s.description ? html`<span class="opt-desc">${s.description}</span>` : nothing}
              </div>`,
            )
          : html`<div class="status" role="presentation">${this.#fetching ? t('loading') : t('noResults')}</div>`
        : nothing}
    </div>`;
  }

  override render() {
    const disabled = this.isDisabled;
    const err = this.errorText;
    const showKbd = !!this.shortcut && !this.#focused && !this.value && !disabled && !this.#spinner.visible;
    return html`<div class="field">
      ${this.label
        ? this.renderLabel()
        : html`<label class="visually-hidden" id=${this.ids.label} for=${this.ids.control}>${t('search')}</label>`}
      <div class="box ${disabled ? 'disabled' : ''} ${err ? 'invalid' : ''}" part="field" @click=${() => this.#input.focus()}>
        <mm-icon name="search" part="icon"></mm-icon>
        <div class="well">
          <input
            id=${this.ids.control}
            class="input"
            part="input"
            data-anchor
            type="text"
            role="combobox"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
            aria-autocomplete=${this.suggest ? 'list' : 'none'}
            aria-expanded=${this.#open ? 'true' : 'false'}
            aria-controls=${ifDefined(this.suggest ? 'listbox' : undefined)}
            aria-activedescendant=${ifDefined(this.#open && this.#active >= 0 ? `opt-${this.#active}` : undefined)}
            aria-describedby=${ifDefined(this.describedBy())}
            aria-invalid=${err ? 'true' : 'false'}
            aria-required=${this.required ? 'true' : 'false'}
            aria-keyshortcuts=${ifDefined(this.shortcut || undefined)}
            placeholder=${this.placeholder}
            .value=${live(this.value)}
            ?disabled=${disabled}
            @input=${this.#onInput}
            @keydown=${this.#onKeydown}
            @keyup=${this.#sync}
            @scroll=${this.#sync}
            @select=${this.#syncSoon}
            @click=${this.#syncSoon}
            @focus=${() => {
              this.#focused = true;
              this.#syncSoon();
            }}
            @blur=${this.#onFocusOut}
          />
          <div class="mirror" aria-hidden="true"><span class="mirror-inner">${this.tokens.map((k) => this.#tokenTemplate(k))}</span></div>
        </div>
        ${this.#spinner.visible
          ? html`<span class="spinner" role="status" aria-label=${t('loading')}></span>`
          : showKbd
            ? html`<kbd class="kbd" aria-hidden="true">${this.shortcut}</kbd>`
            : nothing}
      </div>
      ${this.renderMessages()} ${this.#renderListbox()}
      <span class="visually-hidden" role="status">${this.#announce}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-query-input': MmQueryInput;
  }
}
