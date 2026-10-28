import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, queryAssignedElements, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { rovingKeydown, isRtl } from '../../core/roving.js';
import { uid } from '../../core/id.js';
import { tr } from '../../core/strings.js';
import { dedent, parseLineRanges, tokenizeLines, renderTokens } from './highlight.js';
import '../copy-button/define.js';

export type { SampleLanguage } from './highlight.js';

const LANGUAGE_NAMES: Record<string, string> = {
  sql: 'SQL',
  bash: 'Shell',
  shell: 'Shell',
  sh: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  hcl: 'HCL',
  terraform: 'Terraform',
  go: 'Go',
};

/**
 * Code samples show read-only code in documentation and marketing: the warm near-black code ground
 * in both themes, Geist Mono at `mono-editor`, and a copy button that confirms with
 * "Copied". There are no window dots and no language badge; an optional `filename` sits above the
 * block in `mm-text-2`, outside the dark ground.
 *
 * Highlighting is a small built-in tokenizer for SQL, shell, JSON, YAML, TypeScript and JavaScript,
 * HCL and Go. It runs in `render()`, so the sample is highlighted during SSR too. Give the code in
 * `code`, or as the element's text (indentation is removed). Long lines scroll, or wrap with `wrap`
 * (use it for logs in narrow places such as drawers). With a `filename`, Copy sits beside it so the
 * code keeps its full width; without one, Copy keeps its own column at the end of the block, so
 * code never runs under it.
 * Use `highlight="3,5-7"` to pick out lines. Code always reads left to right, even in RTL pages.
 *
 * @tagname mm-code-sample
 * @summary Read-only highlighted code with a copy button.
 * @slot - The code as plain text, used when `code` is not set.
 * @csspart filename - The filename caption.
 * @csspart block - The dark code ground.
 * @csspart pre - The scrolling `pre`.
 * @csspart copy - The copy button.
 * @fires mm-copy - {{ value: string }} The code was copied (from the inner `mm-copy-button`).
 */
export class MmCodeSample extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
      }
      figure {
        margin: 0;
        display: grid;
        gap: var(--space-2);
        min-width: 0;
      }
      .filename {
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .block {
        position: relative;
        /* The copy button has its own column at the end, outside the scrolling pre, so scrolled or
           long lines can never run under it. */
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        background: var(--mm-code-bg);
        color: var(--mm-code-text);
        border-radius: var(--radius-md);
        /* A faint edge from the code palette: on Peat the code ground is close to the page paper. */
        box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--mm-code-text) 12%, var(--mm-code-bg));
        min-width: 0;
      }
      pre {
        margin: 0;
        padding: 14px 16px;
        overflow: auto;
        font: var(--text-mono-editor);
        letter-spacing: var(--tracking-mono-editor, 0);
        tab-size: 2;
        border-radius: inherit;
      }
      :host([no-copy]) .block {
        grid-template-columns: minmax(0, 1fr);
      }
      code {
        display: inline-block;
        min-width: 100%;
        font: inherit;
      }
      :host([wrap]) pre {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      :host([wrap]) code {
        display: block;
      }
      .line {
        display: block;
        padding-inline: 16px;
        margin-inline: -16px;
      }
      .line.hl {
        background: color-mix(in oklab, var(--mm-code-text) 9%, transparent);
      }
      .no {
        display: inline-block;
        min-width: 3ch;
        margin-inline-end: var(--space-4);
        text-align: right;
        color: var(--mm-syn-comment);
        user-select: none;
        font-variant-numeric: tabular-nums;
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
      mm-copy-button {
        margin-block-start: var(--space-2);
        margin-inline-end: var(--space-2);
      }
      /* With a filename, Copy moves up beside it, so the code keeps its full width. */
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      .head mm-copy-button {
        margin: 0;
      }
      :host([data-head]) .block {
        grid-template-columns: minmax(0, 1fr);
      }
      .raw {
        display: none;
      }
    `,
  ];

  /** `sql`, `bash`/`shell`, `json`, `yaml`, `typescript`/`javascript`, `hcl`, `go` or `text`. */
  @property({ reflect: true }) accessor language = 'text';
  /** The code. Defaults to the element's text, de-indented. */
  @property() accessor code = '';
  /** Optional filename or path, shown above the block. */
  @property() accessor filename = '';
  /** Accessible name for the block. Defaults to the filename, or "SQL sample" and so on. */
  @property() accessor label = '';
  /** Lines to highlight, 1-based: `3`, `2,4-6`. */
  @property() accessor highlight = '';
  /** Wraps long lines instead of scrolling. */
  @property({ type: Boolean, reflect: true }) accessor wrap = false;
  /** Shows line numbers. */
  @property({ type: Boolean, reflect: true, attribute: 'line-numbers' }) accessor lineNumbers = false;
  /** Hides the copy button, for fragments that are not meant to be pasted. */
  @property({ type: Boolean, reflect: true, attribute: 'no-copy' }) accessor noCopy = false;
  /** Tab label when the sample sits in `mm-code-tabs`. */
  @property({ reflect: true }) accessor tab = '';

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.code && this.textContent?.trim()) this.code = dedent(this.textContent);
  }

  #onSlotChange = (e: Event) => {
    if (this.code) return;
    const text = (e.target as HTMLSlotElement).assignedNodes().map((n) => n.textContent ?? '').join('');
    if (text.trim()) this.code = dedent(text);
  };

  /** The accessible name of the block. */
  get accessibleName(): string {
    if (this.label) return this.label;
    if (this.filename) return this.filename;
    const lang = LANGUAGE_NAMES[this.language.toLowerCase()];
    return lang ? tr('codeSampleNamed', '{language} sample', { language: lang }) : tr('codeSample', 'Code sample');
  }

  protected override willUpdate(): void {
    this.toggleAttribute('data-head', !!this.filename && !this.noCopy);
  }

  override render() {
    const lines = this.code ? tokenizeLines(this.code, this.language) : null;
    const marked = this.highlight ? parseLineRanges(this.highlight) : new Set<number>();
    const name = this.accessibleName;
    const copy = this.noCopy
      ? nothing
      : html`<mm-copy-button part="copy" tone=${this.filename ? 'default' : 'code'} size="sm" icon-only="false" .value=${this.code} label=${tr('copy', 'Copy')}></mm-copy-button>`;
    return html`<figure>
      ${this.filename ? html`<div class="head"><figcaption class="filename" part="filename">${this.filename}</figcaption>${copy}</div>` : nothing}
      <div class="block" part="block" dir="ltr" translate="no">
        <pre part="pre" tabindex="0" role="group" aria-label=${name}><code>${lines
          ? lines.map(
              (line, i) =>
                html`<span class="line ${marked.has(i + 1) ? 'hl' : ''}">${this.lineNumbers
                  ? html`<span class="no" aria-hidden="true">${i + 1}</span>`
                  : nothing}${renderTokens(line)}${'\n'}</span>`,
            )
          : html`<slot @slotchange=${this.#onSlotChange}></slot>`}</code></pre>
        ${lines ? html`<span class="raw"><slot @slotchange=${this.#onSlotChange}></slot></span>` : nothing}
        ${this.filename ? nothing : copy}
      </div>
    </figure>`;
  }
}

/**
 * Code tabs show the same task in several forms, such as CLI, API and Python, as tabs above one
 * code sample. The tabs follow the Tabs visuals: `mm-text-2` labels, the active tab in ink with a
 * 2px burnt-sienna underline, switching instantly. Each slotted `mm-code-sample` gives its tab label in
 * `tab`. Arrow keys move between tabs (flipped in RTL), Home and End jump to the ends, and the
 * selection follows focus.
 *
 * Keyboard: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * @tagname mm-code-tabs
 * @summary Tabs of alternative code samples.
 * @slot - `mm-code-sample` elements, each with a `tab` label.
 * @csspart tablist - The row of tabs.
 * @csspart tab - Each tab.
 * @csspart panel - The panel holding the active sample.
 * @fires mm-change - {{ index: number, tab: string }} Another tab was chosen.
 */
export class MmCodeTabs extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      [role='tablist'] {
        display: flex;
        gap: var(--space-5);
        border-block-end: 1px solid var(--mm-rule);
        margin-block-end: var(--space-3);
        overflow-x: auto;
      }
      [role='tab'] {
        position: relative;
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 10px 2px;
        font: var(--text-dense);
        font-weight: 600;
        color: var(--mm-text-2);
        background: none;
        border: 0;
        cursor: pointer;
        white-space: nowrap;
        transition: color var(--mm-dur-press) var(--mm-ease);
      }
      [role='tab']:hover,
      [role='tab'][aria-selected='true'] {
        color: var(--mm-text);
      }
      [role='tab'][aria-selected='true']::after {
        content: '';
        position: absolute;
        inset-inline: 2px;
        inset-block-end: -1px;
        height: 2px;
        background: var(--mm-primary);
      }
      [role='tab']:focus-visible {
        outline-offset: -2px;
      }
      ::slotted([data-tab-hidden]) {
        display: none;
      }
    `,
  ];

  /** Index of the selected tab. */
  @property({ type: Number, reflect: true }) accessor selected = 0;
  /** Accessible name of the tab list ("Ways to run this query"). */
  @property() accessor label = '';

  @queryAssignedElements({ selector: 'mm-code-sample' }) accessor #samples!: MmCodeSample[];
  @state() accessor #tabs: string[] = [];
  #id = uid('mm-code-tabs');

  #sync = () => {
    const samples = this.#samples;
    this.#tabs = samples.map((s) => s.tab || s.filename || LANGUAGE_NAMES[s.language] || s.language);
    this.#applyHidden();
  };

  #applyHidden() {
    const i = Math.min(Math.max(0, this.selected), Math.max(0, this.#samples.length - 1));
    this.#samples.forEach((s, k) => s.toggleAttribute('data-tab-hidden', k !== i));
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('selected')) this.#applyHidden();
  }

  #select(index: number, focus = false) {
    if (index === this.selected) return;
    this.selected = index;
    emit(this, 'mm-change', { index, tab: this.#tabs[index] ?? '' });
    if (focus) void this.updateComplete.then(() => this.#tabButtons()[index]?.focus());
  }

  #tabButtons(): HTMLElement[] {
    return [...(this.renderRoot.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
  }

  #onKeydown = (e: KeyboardEvent) => {
    const next = rovingKeydown(e, this.#tabButtons(), this.selected, { orientation: 'horizontal', rtl: isRtl(this) });
    if (next !== null) this.#select(next);
  };

  override render() {
    const selected = Math.min(this.selected, Math.max(0, this.#tabs.length - 1));
    return html`<div role="tablist" part="tablist" aria-label=${this.label || tr('codeTabs', 'Code samples')} @keydown=${this.#onKeydown}>
        ${this.#tabs.map(
          (label, i) =>
            html`<button
              type="button"
              role="tab"
              part="tab"
              id="${this.#id}-tab-${i}"
              aria-selected=${i === selected ? 'true' : 'false'}
              aria-controls="${this.#id}-panel"
              tabindex=${i === selected ? '0' : '-1'}
              @click=${() => this.#select(i)}
            >
              ${label}
            </button>`,
        )}
      </div>
      <div role="tabpanel" part="panel" id="${this.#id}-panel" aria-labelledby="${this.#id}-tab-${selected}">
        <slot @slotchange=${this.#sync}></slot>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-code-sample': MmCodeSample;
    'mm-code-tabs': MmCodeTabs;
  }
}
