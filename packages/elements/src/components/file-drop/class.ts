import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { base } from '../../core/styles.js';
import { MmFieldControl, fieldStyles, type ValidityResult } from '../form-field/class.js';
import { emit } from '../../core/events.js';
import { formatBytes } from '../../core/format.js';
import { t, tr, onStringsChange } from '../../core/strings.js';
import { DelayedVisibility } from '../../core/delayed.js';
import '@marmotdata/icons/define.js';

/** A file that was not added, with the sentence that says why. */
export interface FileRejection {
  file: File;
  reason: 'size' | 'type' | 'count';
  message: string;
}

/** Parses `max-size`: a byte count, or a size with a unit such as `10 MB`, `500KB` or `1.5GB` (decimal, like formatBytes). */
export function parseSize(value: string | null): number {
  if (value == null || value === '') return 0;
  const m = /^\s*([\d.]+)\s*(b|kb|mb|gb|tb)?\s*$/i.exec(value);
  if (!m) return 0;
  const n = parseFloat(m[1]!);
  const unit = (m[2] ?? 'b').toLowerCase();
  const mult = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12 }[unit as 'b'] ?? 1;
  return Math.round(n * mult);
}

/** True when the file matches an `accept` list (extensions, exact MIME types, or `type/*`). */
export function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return tokens.some((tok) => {
    if (tok.startsWith('.')) return name.endsWith(tok);
    if (tok.endsWith('/*')) return type.startsWith(tok.slice(0, -1));
    return type === tok;
  });
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * File drops take one or more files for upload, such as a dbt `manifest.json` or a CSV seed. A dashed
 * zone accepts dragged files and always offers a visible "browse" button that opens the native file
 * picker, so the control works fully from the keyboard. While files are dragged over it, the zone turns
 * sunken and its text changes, so the state never relies on colour alone.
 *
 * Chosen files are listed with their name, their size in tabular figures and a remove button.
 * Files that are too large or of the wrong type are not added; a sentence names the file and the limit.
 * The element is form-associated: each file is appended to the form's FormData under `name`, `required`
 * blocks submission until a file is chosen, and form reset clears the list.
 *
 * @tagname mm-file-drop
 * @summary Drag-and-drop or browse for files, form-associated.
 * @csspart zone - The dashed drop zone.
 * @csspart browse - The browse button.
 * @csspart list - The list of chosen files.
 * @csspart file - One chosen file row.
 * @csspart remove - A remove button.
 * @fires mm-input - {File[]} The chosen files changed; fired before mm-change.
 * @fires mm-change - {File[]} The chosen files changed (added by drop or browse, or removed).
 * @fires mm-reject - {FileRejection[]} One or more files were not added, with the reason for each.
 * @fires change - Native change event, re-dispatched from the host when the files change.
 */
export class MmFileDrop extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .errors {
        display: grid;
        gap: 2px;
      }
      .zone {
        display: grid;
        justify-items: center;
        gap: var(--space-1);
        padding: var(--space-5) var(--space-4);
        text-align: center;
        background: var(--mm-surface);
        border: 1px dashed var(--mm-control-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          border-color var(--mm-dur-press) var(--mm-ease);
      }
      .zone:hover {
        border-color: var(--mm-text);
      }
      .zone.over {
        background: var(--mm-sunken);
        border-color: var(--mm-text);
        border-style: solid;
      }
      :host([data-invalid]) .zone {
        border-color: var(--mm-danger);
      }
      .zone mm-icon {
        color: var(--mm-text-2);
      }
      .prompt {
        margin: 0;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .hint {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .browse {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 2px;
        margin: 0;
        font: inherit;
        font-weight: 600;
        color: var(--mm-primary);
        background: none;
        border: 0;
        border-radius: var(--radius-sm);
        text-decoration: underline;
        text-underline-offset: 2px;
        text-decoration-thickness: 1px;
        cursor: pointer;
      }
      .browse:hover {
        text-decoration-thickness: 2px;
      }
      /* Disabled keeps readable contrast: sunken ground and secondary ink rather than opacity. */
      .zone[aria-disabled='true'] {
        cursor: not-allowed;
        border-color: var(--mm-control-border);
        background: var(--mm-sunken);
      }
      .zone[aria-disabled='true'] .prompt,
      .zone[aria-disabled='true'] .browse {
        color: var(--mm-text-2);
        cursor: not-allowed;
        text-decoration-thickness: 1px;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-surface);
      }
      .file {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-height: var(--mm-row, var(--row-default));
        padding-block: var(--space-1);
        padding-inline: var(--space-3) var(--space-2);
        border-top: 1px solid var(--mm-rule);
      }
      .file:first-child {
        border-top: 0;
      }
      .file > mm-icon {
        color: var(--mm-text-2);
      }
      .name {
        flex: 1;
        min-width: 0;
        font: var(--text-dense);
        overflow-wrap: anywhere;
      }
      .size {
        flex: none;
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
        text-align: end;
        min-width: 7ch;
      }
      .remove {
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        color: var(--mm-text-2);
        background: transparent;
        border: 0;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .remove:hover {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
      .remove:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: transparent;
      }
      .spinner {
        width: 14px;
        height: 14px;
        flex: none;
        border-radius: 50%;
        border: 1.5px solid var(--mm-text-2);
        border-inline-end-color: transparent;
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
          border-inline-end-color: var(--mm-text-2);
          opacity: 0.6;
        }
      }
      @media (pointer: coarse) {
        .browse,
        .remove {
          min-height: var(--target-touch);
          min-width: var(--target-touch);
        }
        .prompt {
          font-size: 16px;
        }
      }
    `,
  ];

  /** Accepted types, as for the native input: extensions (`.json`) and MIME types (`text/csv`, `image/*`). */
  @property() accessor accept = '';
  /** Allows more than one file. */
  @property({ type: Boolean, reflect: true }) accessor multiple = false;
  /** Largest file allowed, in bytes or with a unit (`10 MB`, `500KB`). Larger files are not added. */
  @property({ attribute: 'max-size', converter: { fromAttribute: parseSize, toAttribute: (v: number) => String(v) } })
  accessor maxSize = 0;
  /** Shows a spinner on each file and blocks changes while the files upload. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** The chosen files. */
  @property({ attribute: false }) accessor files: File[] = [];

  @state() accessor #over = false;
  @state() accessor #dragCount = 0;
  @state() accessor #rejections: FileRejection[] = [];

  @query('input[type=file]') accessor #input!: HTMLInputElement;
  @query('.browse') accessor #browse!: HTMLButtonElement;

  #depth = 0;
  #spinner = new DelayedVisibility(this);
  #offStrings?: () => void;

  /** The chosen files (alias of `files`). */
  get value(): File[] {
    return this.files;
  }
  set value(v: File[]) {
    this.files = v ?? [];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#offStrings = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#offStrings?.();
  }

  /** Opens the native file picker. */
  browse(): void {
    if (this.isDisabled || this.loading) return;
    this.#input?.click();
  }

  /** Validates and adds files as if they had been dropped. Returns the rejections. */
  addFiles(list: Iterable<File>): FileRejection[] {
    const incoming = [...list];
    const accepted: File[] = [];
    const rejected: FileRejection[] = [];
    for (const file of incoming) {
      if (this.accept && !matchesAccept(file, this.accept)) {
        rejected.push({
          file,
          reason: 'type',
          message: tr('fileTypeNotAccepted', '{name} is not an accepted file type. Choose {types} file.', {
            name: file.name,
            types: this.#article(this.#typeList()),
          }),
        });
      } else if (this.maxSize && file.size > this.maxSize) {
        rejected.push({
          file,
          reason: 'size',
          message: tr('fileTooLarge', '{name} is {size}; the limit is {limit}.', {
            name: file.name,
            size: formatBytes(file.size),
            limit: formatBytes(this.maxSize),
          }),
        });
      } else {
        accepted.push(file);
      }
    }
    let next: File[];
    if (this.multiple) {
      next = [...this.files, ...accepted.filter((f) => !this.files.some((g) => sameFile(f, g)))];
    } else {
      const keep = accepted[0];
      for (const extra of accepted.slice(1)) {
        rejected.push({
          file: extra,
          reason: 'count',
          message: tr('fileOnlyOne', 'Only one file can be added, so {name} was left out.', { name: extra.name }),
        });
      }
      next = keep ? [keep] : this.files;
    }
    this.#rejections = rejected;
    if (rejected.length) emit(this, 'mm-reject', rejected);
    if (next !== this.files) this.#commit(next);
    return rejected;
  }

  /** Removes one chosen file. */
  removeFile(file: File): void {
    this.#rejections = [];
    this.#commit(this.files.filter((f) => f !== file));
  }

  #commit(next: File[]) {
    this.files = next;
    this.touched = true;
    this.emitInput(next, true);
    this.emitChange(next);
  }

  formResetCallback(): void {
    this.resetField();
    this.files = [];
    this.#rejections = [];
    if (this.#input) this.#input.value = '';
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('loading')) this.#spinner.set(this.loading);
  }

  protected override computeValidity(): ValidityResult {
    if (this.error) return { flags: { customError: true }, message: this.error };
    if (this.required && !this.files.length) return { flags: { valueMissing: true }, message: tr('fileRequired', 'Choose a file to upload.') };
    return { flags: {}, message: '' };
  }

  protected override updated(changed: PropertyValues): void {
    const fd = new FormData();
    if (this.name) for (const f of this.files) fd.append(this.name, f);
    this.setFormValue(this.files.length && this.name ? fd : null);
    super.updated(changed);
    this.toggleAttribute('data-invalid', !!this.errorText || this.#rejections.length > 0);
  }

  #typeList(): string {
    const tokens = this.accept
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      return new Intl.ListFormat(document.documentElement.lang || 'en-GB', { type: 'disjunction' }).format(tokens);
    } catch {
      return tokens.join(', ');
    }
  }
  /** "a .json or .csv" / "an .xlsx": the English article for the type list. */
  #article(list: string): string {
    return /^[.]?[aeiou]/i.test(list) ? `an ${list}` : `a ${list}`;
  }

  #onDragEnter = (e: DragEvent) => {
    if (!this.#hasFiles(e)) return;
    e.preventDefault();
    if (this.isDisabled || this.loading) return;
    this.#depth++;
    this.#over = true;
    this.#dragCount = e.dataTransfer?.items?.length ?? 0;
  };
  #onDragOver = (e: DragEvent) => {
    if (!this.#hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = this.isDisabled || this.loading ? 'none' : 'copy';
  };
  #onDragLeave = () => {
    this.#depth = Math.max(0, this.#depth - 1);
    if (!this.#depth) this.#over = false;
  };
  #onDrop = (e: DragEvent) => {
    e.preventDefault();
    this.#depth = 0;
    this.#over = false;
    if (this.isDisabled || this.loading) return;
    const files = e.dataTransfer?.files;
    if (files?.length) this.addFiles(files);
  };
  #hasFiles(e: DragEvent) {
    const types = e.dataTransfer?.types;
    return !types || [...types].includes('Files');
  }

  #onZoneClick = (e: MouseEvent) => {
    // Clicking the zone's empty space opens the picker too; the browse button is the keyboard route.
    if ((e.target as HTMLElement).closest('button')) return;
    this.browse();
  };

  #onInputChange = (e: Event) => {
    e.stopPropagation();
    const input = e.target as HTMLInputElement;
    if (input.files?.length) this.addFiles(input.files);
    input.value = '';
  };

  #onRemove(file: File, index: number) {
    if (this.isDisabled || this.loading) return;
    this.removeFile(file);
    this.updateComplete.then(() => {
      const buttons = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.remove')];
      (buttons[Math.min(index, buttons.length - 1)] ?? this.#browse)?.focus();
    });
  }

  #prompt() {
    const disabled = this.isDisabled || this.loading;
    if (this.#over) {
      const text =
        this.#dragCount === 1
          ? tr('releaseToAddFile', 'Release to add the file')
          : tr('releaseToAddFiles', 'Release to add the files');
      return html`<p class="prompt" aria-live="polite">${text}</p>`;
    }
    const full = t('dropFiles');
    const word = t('browse');
    const at = full.toLowerCase().lastIndexOf(word.toLowerCase());
    const button = html`<button
      part="browse"
      class="browse"
      type="button"
      data-anchor
      ?disabled=${disabled}
      aria-describedby=${[this.label ? this.ids.label : '', this.#hint() ? 'hint' : ''].filter(Boolean).join(' ') || nothing}
      @click=${() => this.browse()}
    >${at >= 0 ? full.slice(at, at + word.length) : word}</button>`;
    return at >= 0
      ? html`<p class="prompt">${full.slice(0, at)}${button}${full.slice(at + word.length)}</p>`
      : html`<p class="prompt">${full} ${button}</p>`;
  }

  #hint() {
    const parts: string[] = [];
    if (this.accept) parts.push(tr('acceptedTypes', 'Accepts {types}.', { types: this.#typeList() }));
    if (this.maxSize)
      parts.push(
        this.multiple
          ? tr('maxFileSizeEach', 'Up to {limit} per file.', { limit: formatBytes(this.maxSize) })
          : tr('maxFileSize', 'Up to {limit}.', { limit: formatBytes(this.maxSize) }),
      );
    return parts.join(' ');
  }

  override render() {
    const disabled = this.isDisabled || this.loading;
    const rejections = this.#rejections.map((r) => r.message);
    const hint = this.#hint();
    const describedBy = this.describedBy(!!hint && 'hint', rejections.length > 0 && 'errors');
    return html`<div class="field">
      ${this.label ? this.renderLabel(false) : nothing}
      <div
        part="zone"
        class="zone ${this.#over ? 'over' : ''}"
        role="group"
        aria-labelledby=${this.label ? this.ids.label : nothing}
        aria-describedby=${describedBy ?? nothing}
        aria-disabled=${disabled ? 'true' : 'false'}
        aria-busy=${this.loading ? 'true' : 'false'}
        @dragenter=${this.#onDragEnter}
        @dragover=${this.#onDragOver}
        @dragleave=${this.#onDragLeave}
        @drop=${this.#onDrop}
        @click=${this.#onZoneClick}
      >
        <mm-icon name=${this.#over ? 'download' : 'upload-file'} size="20"></mm-icon>
        ${this.#prompt()}
        <p class="hint" id="hint" ?hidden=${!hint}>${hint}</p>
        <input
          type="file"
          hidden
          tabindex="-1"
          accept=${this.accept || nothing}
          ?multiple=${this.multiple}
          ?disabled=${disabled}
          @change=${this.#onInputChange}
          @cancel=${(e: Event) => e.stopPropagation()}
        />
      </div>
      ${this.files.length
        ? html`<ul part="list" class="list" aria-labelledby=${this.label ? this.ids.label : nothing}>
            ${repeat(
              this.files,
              (f) => f,
              (f, i) => html`<li part="file" class="file">
                ${this.#spinner.visible
                  ? html`<span class="spinner" role="img" aria-label=${t('loading')}></span>`
                  : html`<mm-icon name="description"></mm-icon>`}
                <span class="name">${f.name}</span>
                <span class="size">${formatBytes(f.size)}</span>
                <button
                  part="remove"
                  class="remove"
                  type="button"
                  ?disabled=${disabled}
                  aria-label="${t('remove')} ${f.name}"
                  @click=${() => this.#onRemove(f, i)}
                >
                  <mm-icon name="close"></mm-icon>
                </button>
              </li>`,
            )}
          </ul>`
        : nothing}
      <div class="errors" id="errors" aria-live="polite">
        ${rejections.map(
          (m) => html`<p class="error" part="error"><mm-icon name="error" size="14"></mm-icon><span>${m}</span></p>`,
        )}
      </div>
      ${this.renderMessages()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-file-drop': MmFileDrop;
  }
}
