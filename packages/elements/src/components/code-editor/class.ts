import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { Extension } from '@codemirror/state';
import { MmFormControl } from '../../core/form-control.js';
import { emit } from '../../core/events.js';
import { DelayedVisibility } from '../../core/delayed.js';
import { onStringsChange, t, tr } from '../../core/strings.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tokenizeLines, renderTokens } from '../code-sample/highlight.js';
import type * as Setup from './setup.js';
import type { EditorDiagnostic, EditorHandle } from './setup.js';
import '@marmotdata/icons/define.js';

export type { EditorDiagnostic } from './setup.js';
export type CodeEditorLanguage = 'sql' | 'json' | 'yaml' | 'text';
export type SetupModule = typeof Setup;

/** 1-based line and column for a document offset, computed from the string so it works before CodeMirror loads. */
export function lineColumn(text: string, pos: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, pos));
  const line = before.split('\n').length;
  const column = pos - (before.lastIndexOf('\n') + 1) + 1;
  return { line, column };
}

/** Document offset for a 1-based line and column, clamped to the text. */
export function offsetOf(text: string, line: number, column: number): number {
  let pos = 0;
  for (let l = 1; l < line; l++) {
    const nl = text.indexOf('\n', pos);
    if (nl < 0) return text.length;
    pos = nl + 1;
  }
  const end = text.indexOf('\n', pos);
  const lineEnd = end < 0 ? text.length : end;
  return Math.min(lineEnd, pos + Math.max(0, column - 1));
}

/** Shared styles for the frame, fallback and footer, reused by `mm-sql-editor`. */
export const codeEditorStyles = css`
  :host {
    display: block;
    /* Shrink inside grid and flex layouts; long lines scroll inside the editor instead of widening the page. */
    min-width: 0;
    --mm-code-editor-height: 240px;
  }
  .frame {
    position: relative;
    height: var(--mm-code-editor-height);
    min-height: 96px;
    border-radius: var(--radius-md);
    background: var(--mm-code-bg);
    color: var(--mm-code-text);
    font: var(--text-mono-editor);
    overflow: hidden;
    /* A faint edge from the code palette: on Peat the code ground is close to the page paper. */
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--mm-code-text) 12%, var(--mm-code-bg));
  }
  :host([resize='vertical']) .frame {
    resize: vertical;
  }
  .frame.focused,
  .frame:has(.fallback:focus-visible) {
    outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
    outline-offset: var(--mm-focus-ring-offset, 2px);
  }
  /* The frame draws the ring, so the editor's own one would be clipped and doubled. */
  .frame .cm-editor.cm-focused {
    outline: none;
  }
  :host([disabled]) .frame,
  :host([data-form-disabled]) .frame {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* A disabled editor cannot take focus, so it does not scroll either. */
  :host([disabled]) .cm-scroller,
  :host([data-form-disabled]) .cm-scroller {
    overflow: hidden;
  }
  .host-mount {
    height: 100%;
  }
  .fallback {
    display: flex;
    height: 100%;
    overflow: auto;
    margin: 0;
    border-radius: inherit;
  }
  .fallback:focus-visible {
    outline: none;
  }
  .gutter {
    flex: none;
    padding: 14px 8px 14px 16px;
    min-width: calc(2.5ch + 24px);
    text-align: right;
    color: var(--mm-syn-comment);
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
  /* Leaves room for the lint gutter CodeMirror adds, so nothing shifts when it loads. */
  .gutter::after {
    content: '';
    display: inline-block;
    width: calc(1.1em + 6px);
  }
  pre {
    margin: 0;
    padding: 14px 16px 14px 6px;
    font: inherit;
    white-space: pre;
    flex: 1 1 auto;
    min-width: 0;
  }
  .gutter span,
  pre .ln {
    display: block;
  }
  .placeholder {
    color: var(--mm-syn-comment);
    font-style: italic;
  }
  .k {
    color: var(--mm-syn-keyword);
  }
  .f {
    color: var(--mm-syn-function);
  }
  .s {
    color: var(--mm-syn-string);
  }
  .n {
    color: var(--mm-syn-number);
  }
  .c {
    color: var(--mm-syn-comment);
    font-style: italic;
  }
  .loading {
    position: absolute;
    inset-block-end: var(--space-2);
    inset-inline-end: var(--space-3);
    font: var(--text-caption);
    color: var(--mm-code-text);
    opacity: 0.8;
  }
  .footer {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    margin-block-start: var(--space-2);
    font: var(--text-dense);
    color: var(--mm-text-2);
    min-height: 0;
  }
  .footer[hidden] {
    display: none;
  }
  .messages {
    flex: 1 1 auto;
    min-width: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  .message {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    color: var(--mm-text);
  }
  .message mm-icon {
    flex: none;
    align-self: center;
  }
  .message.error mm-icon {
    color: var(--mm-danger);
  }
  .message.warning mm-icon {
    color: var(--mm-warning);
  }
  .message.info mm-icon {
    color: var(--mm-info);
  }
  .where {
    flex: none;
    font: var(--text-label);
    letter-spacing: var(--tracking-label, 0);
    color: var(--mm-text-2);
    font-variant-numeric: tabular-nums;
  }
  .text {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .end {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-inline-start: auto;
    flex: none;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font: var(--text-label);
    letter-spacing: var(--tracking-label, 0);
    color: var(--mm-text-2);
  }
  @media (pointer: coarse) {
    .frame {
      font-size: 16px;
    }
  }
`;

/**
 * The code editor is CodeMirror 6 on the warm near-black code ground, in Light and Peat alike:
 * Geist Mono at `mono-editor`, the `mm-syn-*` syntax colours, a line-number gutter
 * and `radius-md`. It edits SQL, JSON (role documents) and YAML (pipeline configs), or plain text.
 *
 * CodeMirror is loaded with a dynamic import in `firstUpdated`, so the element costs almost nothing
 * until it is used. Until then, and during SSR, it renders a static highlighted copy of `value` with
 * the same metrics, so nothing moves when the editor arrives. Set `lazy="interaction"` to wait for
 * the first focus or pointer press before loading at all, for pages with many editors.
 *
 * Tab indents. To leave the editor from the keyboard, press Escape and then Tab (CodeMirror's
 * tab-focus mode), which the editor announces in its description. When a completion list is open,
 * the first Escape closes it, so press Escape again before Tab. Code always runs left to right,
 * even in a right-to-left page.
 *
 * Diagnostics (`diagnostics`) draw a wavy crimson underline, a gutter mark and a message under the
 * editor with the line and column, so an error never relies on colour alone.
 *
 * The element is form-associated and submits `value` under `name`.
 *
 * @tagname mm-code-editor
 * @summary CodeMirror editor for SQL, JSON and YAML on the code ground.
 * @slot badge - Status shown under the editor, such as a read-only note. Defaults to "Read only" with a lock when `readonly`.
 * @csspart frame - The code ground holding the editor.
 * @csspart fallback - The static highlighted copy shown before CodeMirror loads.
 * @csspart footer - The row under the editor with diagnostics and the badge.
 * @csspart messages - The list of diagnostic messages.
 * @cssprop --mm-code-editor-height - Initial height of the editor. Defaults to 240px; people can drag it taller when `resize="vertical"`.
 * @fires mm-input - {{ value: string }} The text changed.
 * @fires mm-change - {{ value: string }} The text changed and the editor lost focus.
 * @fires mm-ready - {{}} CodeMirror loaded and the editor is interactive.
 */
export class MmCodeEditor extends MmFormControl {
  static override styles = [base, visuallyHidden, codeEditorStyles];

  /** Loads the CodeMirror half. Replaceable for tests and custom bundling. */
  static loadSetup: () => Promise<SetupModule> = () => import('./setup.js');

  /** `sql`, `json`, `yaml` or `text`. */
  @property({ reflect: true }) accessor language: CodeEditorLanguage = 'text';
  /** The text. */
  @property() accessor value = '';
  /** Accessible name of the editor ("Role document", "Pipeline config"). */
  @property() accessor label = '';
  /** Shown when the editor is empty. Never a substitute for `label`. */
  @property() accessor placeholder = '';
  /** Selectable and copyable but not editable. */
  @property({ type: Boolean, reflect: true }) accessor readonly = false;
  /** Inline diagnostics: `[{ from, to, severity, message }]` with document offsets. */
  @property({ attribute: false }) accessor diagnostics: EditorDiagnostic[] = [];
  /** `vertical` (default) lets people drag the editor taller; `none` fixes the height. */
  @property({ reflect: true }) accessor resize: 'vertical' | 'none' = 'vertical';
  /** `load` (default) loads CodeMirror after first render; `interaction` waits for the first focus or press. */
  @property({ reflect: true }) accessor lazy: 'load' | 'interaction' = 'load';

  /** True once CodeMirror is mounted. */
  @state() accessor ready = false;
  @state() accessor #focused = false;
  @state() accessor #loadingStarted = false;

  @query('.host-mount') accessor #mount!: HTMLElement | null;
  @query('.fallback') accessor #fallback!: HTMLElement | null;

  protected handle: EditorHandle | null = null;
  protected setup: SetupModule | null = null;
  #defaultValue = '';
  #valueAtFocus = '';
  #fromEditor = false;
  #focusWhenReady = false;
  #fallbackFocused = false;
  #loader = new DelayedVisibility(this);
  #unsubscribe?: () => void;
  #ids = { hint: 'mm-ce-hint', messages: 'mm-ce-messages' };

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unsubscribe = onStringsChange(() => {
      this.requestUpdate();
      this.syncAttributes();
    });
    if (this.#remountOnConnect) {
      this.#remountOnConnect = false;
      void this.load();
    }
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    // CodeMirror listens on the document and window, so a view left alive keeps this element, its
    // document and its DOM in memory after removal. Destroy it unless the element was only moved
    // (reconnected in the same task); a later reconnect mounts a fresh view from `value`.
    queueMicrotask(() => {
      if (this.isConnected || !this.handle) return;
      this.handle.destroy();
      this.handle = null;
      this.#loadingStarted = false;
      this.#remountOnConnect = true;
    });
  }
  #remountOnConnect = false;

  /** The CodeMirror view, once loaded. */
  get view() {
    return this.handle?.view ?? null;
  }

  /** The selected text, or the empty string when nothing is selected or the editor has not loaded. */
  get selectedText(): string {
    return this.handle?.selection().text ?? '';
  }

  /** Loads CodeMirror now. Resolves when the editor is interactive. */
  async load(): Promise<void> {
    if (this.handle || this.#loadingStarted) return this.#whenReady;
    this.#loadingStarted = true;
    this.#loader.set(true);
    this.#whenReady = this.#mountEditor();
    return this.#whenReady;
  }
  #whenReady: Promise<void> = Promise.resolve();

  override focus(options?: FocusOptions): void {
    if (this.handle) this.handle.focus();
    else {
      this.#focusWhenReady = true;
      this.#fallback?.focus(options);
      void this.load();
    }
  }

  protected override firstUpdated(): void {
    this.#defaultValue = this.value;
    if (this.lazy === 'load') void this.load();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) {
      this.setFormValue(this.isDisabled ? null : this.value);
      this.#validate();
    }
    if (changed.has('required')) this.#validate();
    this.toggleAttribute('data-form-disabled', this.isDisabled && !this.disabled);
  }

  protected override updated(changed: PropertyValues): void {
    const h = this.handle;
    if (!h) return;
    if (changed.has('value') && !this.#fromEditor) h.setValue(this.value);
    if (changed.has('readonly') || changed.has('disabled')) h.setEditable(this.readonly, this.isDisabled);
    if (changed.has('placeholder')) h.setPlaceholder(this.placeholder);
    if (changed.has('language')) void this.reconfigureLanguage();
    if (changed.has('diagnostics') || changed.has('value')) h.setDiagnostics(this.effectiveDiagnostics());
    if (changed.has('label') || changed.has('readonly') || changed.has('disabled') || changed.has('diagnostics')) this.syncAttributes();
  }

  formResetCallback(): void {
    this.value = this.#defaultValue;
  }
  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }
  override formDisabledCallback(disabled: boolean): void {
    super.formDisabledCallback(disabled);
    this.handle?.setEditable(this.readonly, this.isDisabled);
  }

  #validate() {
    if (this.required && !this.value.trim()) this.setValidity({ valueMissing: true }, t('required'));
    else this.setValidity({});
  }

  /** The default accessible name when `label` is empty. */
  protected defaultLabel(): string {
    return tr('codeEditorLabel', 'Code editor');
  }

  /** The language extension. `mm-sql-editor` overrides this to add dialects and schema completion. */
  protected languageExtension(setup: SetupModule): Promise<Extension> {
    return setup.languageFor(this.language);
  }

  /** Extra extensions (keymaps, completion sources). Empty in the base editor. */
  protected extraExtensions(_setup: SetupModule): Promise<Extension> | Extension {
    return [];
  }

  /** Diagnostics drawn in the editor and listed under it. */
  protected effectiveDiagnostics(): EditorDiagnostic[] {
    return this.diagnostics;
  }

  /** Re-runs `languageExtension` and swaps it in. */
  protected async reconfigureLanguage(): Promise<void> {
    if (!this.setup || !this.handle) return;
    const ext = await this.languageExtension(this.setup);
    this.handle?.setLanguage(ext);
  }

  /** Re-runs `extraExtensions` and swaps them in. */
  protected async reconfigureExtra(): Promise<void> {
    if (!this.setup || !this.handle) return;
    const ext = await this.extraExtensions(this.setup);
    this.handle?.setExtra(ext);
  }

  protected contentAttributes(): Record<string, string> {
    const described = [this.#ids.hint, this.effectiveDiagnostics().length ? this.#ids.messages : ''].filter(Boolean).join(' ');
    const attrs: Record<string, string> = {
      'aria-label': this.label || this.defaultLabel(),
      'aria-describedby': described,
      // An explicit tabindex tells checkers the scroller has keyboard access through the content.
      tabindex: this.isDisabled ? '-1' : '0',
      spellcheck: 'false',
      autocorrect: 'off',
      autocapitalize: 'off',
      translate: 'no',
    };
    if (this.readonly) attrs['aria-readonly'] = 'true';
    if (this.isDisabled) attrs['aria-disabled'] = 'true';
    if (this.required) attrs['aria-required'] = 'true';
    if (this.effectiveDiagnostics().some((d) => d.severity === 'error')) attrs['aria-invalid'] = 'true';
    return attrs;
  }

  protected syncAttributes(): void {
    this.handle?.setAttributes(this.contentAttributes());
  }

  async #mountEditor(): Promise<void> {
    const setup = await (this.constructor as typeof MmCodeEditor).loadSetup();
    this.setup = setup;
    const [language, extra] = await Promise.all([this.languageExtension(setup), this.extraExtensions(setup)]);
    const fallback = this.#fallback;
    this.#fallbackFocused = !!fallback && this.shadowRoot?.activeElement === fallback;
    this.ready = true;
    await this.updateComplete;
    const mount = this.#mount;
    if (!mount || !this.shadowRoot) return;
    const hadFocus = this.#focusWhenReady || this.#fallbackFocused;
    this.handle = setup.createEditor({
      parent: mount,
      root: this.shadowRoot,
      value: this.value,
      language,
      extra,
      readonly: this.readonly,
      disabled: this.isDisabled,
      attributes: this.contentAttributes(),
      placeholder: this.placeholder,
      diagnostics: this.effectiveDiagnostics(),
      onChange: (value) => this.#onEditorChange(value),
      onFocusChange: (focused) => this.#onFocusChange(focused),
    });
    // Stop CodeMirror's native input events here; the host re-dispatches one per change instead.
    mount.addEventListener('input', stopInput);
    this.#loader.set(false);
    this.requestUpdate();
    if (hadFocus) this.handle.focus();
    emit(this, 'mm-ready', {});
  }

  #onEditorChange(value: string) {
    this.#fromEditor = true;
    this.value = value;
    void this.updateComplete.then(() => (this.#fromEditor = false));
    emit(this, 'mm-input', { value });
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  #onFocusChange(focused: boolean) {
    this.#focused = focused;
    if (focused) this.#valueAtFocus = this.value;
    else if (this.value !== this.#valueAtFocus) {
      emit(this, 'mm-change', { value: this.value });
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  #onFallbackActivate = () => {
    if (this.isDisabled) return;
    this.#focusWhenReady = true;
    void this.load();
  };

  /** The static highlighted copy: same gutter, padding and line height as the editor. */
  protected renderFallback(): TemplateResult {
    const lines = tokenizeLines(this.value, this.language === 'text' ? 'text' : this.language);
    const empty = !this.value;
    return html`<div
      class="fallback"
      part="fallback"
      role="textbox"
      aria-multiline="true"
      aria-readonly=${this.readonly ? 'true' : 'false'}
      aria-disabled=${this.isDisabled ? 'true' : 'false'}
      aria-busy=${this.#loadingStarted ? 'true' : 'false'}
      aria-label=${this.label || this.defaultLabel()}
      aria-describedby=${this.#ids.hint}
      tabindex=${this.isDisabled ? '-1' : '0'}
      @focus=${this.#onFallbackActivate}
      @pointerdown=${this.#onFallbackActivate}
    >
      <div class="gutter" aria-hidden="true">${lines.map((_, i) => html`<span>${i + 1}</span>`)}</div>
      <pre dir="ltr">${empty && this.placeholder
        ? html`<span class="placeholder">${this.placeholder}</span>`
        : lines.map((line) => html`<span class="ln">${renderTokens(line)}${line.length ? '' : '​'}</span>`)}</pre>
    </div>`;
  }

  /** Extra content at the end of the footer row. `mm-sql-editor` puts the run shortcut here. */
  protected renderFooterEnd(): unknown {
    return nothing;
  }

  protected renderMessages(diagnostics: EditorDiagnostic[]): unknown {
    const icon = { error: 'error', warning: 'warning', info: 'info' } as const;
    const word = {
      error: tr('diagnosticError', 'Error'),
      warning: tr('diagnosticWarning', 'Warning'),
      info: tr('diagnosticInfo', 'Note'),
    } as const;
    return html`<ul class="messages" part="messages" id=${this.#ids.messages} aria-live="polite">
      ${diagnostics.map((d) => {
        const at = lineColumn(this.value, d.from);
        return html`<li class="message ${d.severity}">
          <mm-icon name=${icon[d.severity]} aria-hidden="true"></mm-icon>
          <span class="visually-hidden">${word[d.severity]}:</span>
          <span class="where">${tr('lineColumn', 'Line {line}, column {column}', at)}</span>
          <span class="text">${d.message}</span>
        </li>`;
      })}
    </ul>`;
  }

  override render() {
    const diagnostics = this.effectiveDiagnostics();
    const end = this.renderFooterEnd();
    const showFooter = diagnostics.length > 0 || this.readonly || end !== nothing || this.querySelector?.('[slot="badge"]');
    return html`<div class="frame ${this.#focused ? 'focused' : ''}" part="frame" dir="ltr" translate="no">
        ${this.ready ? html`<div class="host-mount"></div>` : this.renderFallback()}
        ${this.#loader.visible && !this.ready ? html`<span class="loading" aria-hidden="true">${tr('loadingEditor', 'Loading editor')}</span>` : nothing}
      </div>
      <span class="visually-hidden" id=${this.#ids.hint}>${tr('codeEditorHint', 'Press Escape then Tab to leave the editor.')}</span>
      <div class="footer" part="footer" ?hidden=${!showFooter}>
        ${diagnostics.length ? this.renderMessages(diagnostics) : html`<span class="messages"></span>`}
        <div class="end">
          <slot name="badge" @slotchange=${() => this.requestUpdate()}
            >${this.readonly
              ? html`<span class="badge"><mm-icon name="lock" aria-hidden="true"></mm-icon>${tr('readOnly', 'Read only')}</span>`
              : nothing}</slot
          >
          ${end}
        </div>
      </div>`;
  }
}

/** One shared listener, so remounting never stacks duplicates. */
const stopInput = (e: Event) => e.stopPropagation();

declare global {
  interface HTMLElementTagNameMap {
    'mm-code-editor': MmCodeEditor;
  }
}
