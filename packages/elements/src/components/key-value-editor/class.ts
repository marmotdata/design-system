import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import '../button/define.js';
import '../text-field/define.js';
import '../textarea/define.js';

export interface KeyValuePair {
  key: string;
  value: string;
}

/** Splits pasted text into pairs: one per line, `key: value`, `key = value` or tab separated. */
export function parsePairs(text: string): KeyValuePair[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^([^:=\t]+?)\s*(?::|=|\t)\s*(.*)$/.exec(l);
      return m ? { key: m[1]!.trim(), value: m[2]!.trim() } : { key: l, value: '' };
    });
}

/** Dotted keys become nested objects (`contact.slack` → `{ contact: { slack } }`). */
export function pairsToObject(pairs: KeyValuePair[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, value } of pairs) {
    if (!key.trim()) continue;
    const parts = key.split('.');
    let node = out;
    parts.slice(0, -1).forEach((p) => {
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p] as Record<string, unknown>;
    });
    node[parts.at(-1)!] = value;
  }
  return out;
}

/** Nested objects flatten back to dotted keys. */
export function objectToPairs(obj: unknown, prefix = ''): KeyValuePair[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [{ key: prefix, value: Array.isArray(obj) ? obj.join(', ') : String(obj ?? '') }] : [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => objectToPairs(v, prefix ? `${prefix}.${k}` : k));
}

type Row = KeyValuePair & { id: string };

/**
 * The key and value editor takes free-form pairs: an asset's metadata, a schema's columns and
 * types, a set of links. Rows are a key, a value and a remove button, with "Add field" below.
 * Pasting several `key: value` (or `key = value`, or tab separated) lines into any key splits them
 * into rows, so people can paste from a spreadsheet or a config file. Dotted keys
 * (`contact.slack`) mean nesting. With `json`, "Edit as JSON" swaps the rows for a JSON text box
 * for deeper structures, and back.
 *
 * Adding a row focuses its key; removing one focuses the next row, or Add field. Changes are
 * announced politely.
 *
 * @tagname mm-key-value-editor
 * @summary Edit free-form key and value pairs, with paste and an optional JSON mode.
 * @csspart row - Each pair.
 * @fires mm-change - {{ value: KeyValuePair[] }} The pairs changed.
 */
export class MmKeyValueEditor extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .rows {
        display: grid;
        gap: var(--space-2);
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) 2rem;
        gap: var(--space-2);
        align-items: center;
      }
      .actions {
        display: flex;
        gap: var(--space-1);
        margin-block-start: var(--space-2);
      }
      .error {
        margin: var(--space-2) 0 0;
        font: var(--text-caption);
        color: var(--mm-danger);
      }
    `,
  ];

  /** The pairs. */
  @property({ attribute: false }) accessor value: KeyValuePair[] = [];
  /** Accessible name of the group, such as "Metadata". */
  @property() accessor label = '';
  @property({ attribute: 'key-label' }) accessor keyLabel = '';
  @property({ attribute: 'value-label' }) accessor valueLabel = '';
  @property({ attribute: 'key-placeholder' }) accessor keyPlaceholder = '';
  @property({ attribute: 'value-placeholder' }) accessor valuePlaceholder = '';
  /** Text of the add button. Defaults to "Add field". */
  @property({ attribute: 'add-label' }) accessor addLabel = '';
  /** Offers "Edit as JSON" for nested values. */
  @property({ type: Boolean }) accessor json = false;

  @state() accessor #rows: Row[] = [];
  @state() accessor #jsonMode = false;
  @state() accessor #jsonText = '';
  @state() accessor #jsonError = '';
  @state() accessor #announce = '';
  #emitted: KeyValuePair[] | null = null;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value') && this.value !== this.#emitted) {
      this.#rows = (this.value.length ? this.value : [{ key: '', value: '' }]).map((p) => ({ ...p, id: uid('kv') }));
    }
  }

  #commit(rows: Row[], announce = '') {
    this.#rows = rows;
    if (announce) this.#announce = announce;
    const value = rows.filter((r) => r.key.trim() || r.value.trim()).map(({ key, value }) => ({ key, value }));
    this.#emitted = value;
    this.value = value;
    emit(this, 'mm-change', { value });
  }

  async #focusKey(i: number) {
    await this.updateComplete;
    this.renderRoot.querySelectorAll<HTMLElement>('.row mm-text-field.key')[i]?.focus();
  }

  #addRow() {
    this.#commit([...this.#rows, { key: '', value: '', id: uid('kv') }], tr('kvAdded', 'Field added'));
    void this.#focusKey(this.#rows.length - 1);
  }

  async #remove(i: number) {
    const rows = this.#rows.filter((_, k) => k !== i);
    this.#commit(rows.length ? rows : [{ key: '', value: '', id: uid('kv') }], tr('kvRemoved', 'Field removed'));
    await this.updateComplete;
    if (rows.length) void this.#focusKey(Math.min(i, rows.length - 1));
    else this.renderRoot.querySelector<HTMLElement>('.add')?.focus();
  }

  #onPaste(i: number, e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/\n|[:=\t]/.test(text.trim())) return;
    const pairs = parsePairs(text);
    if (pairs.length < 2 && !/[:=\t]/.test(text)) return;
    e.preventDefault();
    const rows = [...this.#rows];
    rows.splice(i, rows[i]?.key || rows[i]?.value ? 0 : 1, ...pairs.map((p) => ({ ...p, id: uid('kv') })));
    this.#commit(rows, tr('kvPasted', '{n} fields added from paste', { n: pairs.length }));
  }

  #toggleJson() {
    if (!this.#jsonMode) {
      this.#jsonText = JSON.stringify(pairsToObject(this.#rows), null, 2);
      this.#jsonError = '';
      this.#jsonMode = true;
      return;
    }
    try {
      const parsed = JSON.parse(this.#jsonText || '{}');
      this.#commit(objectToPairs(parsed).map((p) => ({ ...p, id: uid('kv') })));
      this.#jsonMode = false;
    } catch {
      this.#jsonError = tr('kvJsonError', 'This is not valid JSON. Check the brackets and quotes.');
    }
  }

  override render() {
    const keyLabel = this.keyLabel || tr('kvKey', 'Key');
    const valueLabel = this.valueLabel || tr('kvValue', 'Value');
    return html`<div role="group" aria-label=${this.label || tr('kvGroup', 'Fields')}>
      ${this.#jsonMode
        ? html`<mm-textarea label=${`${this.label || tr('kvGroup', 'Fields')} JSON`} hide-label mono rows="8" .value=${this.#jsonText} @mm-input=${(e: CustomEvent<{ value: string }>) => (this.#jsonText = e.detail.value)}></mm-textarea>
            ${this.#jsonError ? html`<p class="error" role="alert">${this.#jsonError}</p>` : nothing}`
        : html`<div class="rows">
            ${repeat(
              this.#rows,
              (r) => r.id,
              (r, i) => html`<div class="row" part="row">
                <mm-text-field
                  class="key"
                  label=${`${keyLabel} ${i + 1}`}
                  hide-label
                  placeholder=${this.keyPlaceholder || keyLabel}
                  value=${r.key}
                  @paste=${(e: ClipboardEvent) => this.#onPaste(i, e)}
                  @mm-input=${(e: CustomEvent<{ value: string }>) => ((r.key = e.detail.value), this.#commit([...this.#rows]))}
                ></mm-text-field>
                <mm-text-field
                  label=${`${valueLabel} ${i + 1}`}
                  hide-label
                  placeholder=${this.valuePlaceholder || valueLabel}
                  value=${r.value}
                  @mm-input=${(e: CustomEvent<{ value: string }>) => ((r.value = e.detail.value), this.#commit([...this.#rows]))}
                ></mm-text-field>
                <mm-button variant="ghost" size="sm" icon="close" label=${tr('kvRemove', 'Remove {key}', { key: r.key || `${keyLabel} ${i + 1}` })} @click=${() => this.#remove(i)}></mm-button>
              </div>`,
            )}
          </div>`}
      <div class="actions">
        ${this.#jsonMode ? nothing : html`<mm-button class="add" variant="ghost" size="sm" icon="add" @click=${() => this.#addRow()}>${this.addLabel || tr('kvAdd', 'Add field')}</mm-button>`}
        ${this.json
          ? html`<mm-button variant="ghost" size="sm" icon=${this.#jsonMode ? 'list' : 'data-object'} @click=${() => this.#toggleJson()}
              >${this.#jsonMode ? tr('kvEditRows', 'Edit as fields') : tr('kvEditJson', 'Edit as JSON')}</mm-button
            >`
          : nothing}
      </div>
      <span class="visually-hidden" role="status">${this.#announce}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-key-value-editor': MmKeyValueEditor;
  }
}
