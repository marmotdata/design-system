import { css } from 'lit';

/**
 * Helpers shared by `mm-data-table` and `mm-results-grid`: clipboard, downloads, CSV and TSV
 * encoding, and finding interactive content inside grid cells.
 */

/** Copies text, with the clipboard API where allowed and a hidden textarea where not. */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0;pointer-events:none';
  document.body.append(ta);
  const active = document.activeElement as HTMLElement | null;
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}

/** Starts a client-side download of `text`. */
export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A value as plain text for copying and export. NULL stays empty in CSV and becomes `NULL` in TSV. */
export function plain(value: unknown, nullText = ''): string {
  if (value === null || value === undefined) return nullText;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function csvField(value: unknown): string {
  const s = plain(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Tab-separated, as spreadsheets paste it: tabs and newlines inside a value become spaces. */
export function tsvField(value: unknown): string {
  return plain(value, 'NULL').replace(/[\t\r\n]+/g, ' ');
}

const FOCUSABLE = 'a[href],button,input,select,textarea,[contenteditable="true"],[data-grid-tab]';

/**
 * Interactive content inside a cell: native controls, links, anything with a tabindex we manage,
 * and custom elements that delegate focus (mm-button, mm-copy-button, mm-menu-button).
 */
export function focusablesIn(cell: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of cell.querySelectorAll<HTMLElement>('*')) {
    if (el.closest('[inert]')) continue;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
    if (el.matches(FOCUSABLE) || el.shadowRoot?.delegatesFocus) out.push(el);
  }
  return out;
}

/** Keeps cell content out of the Tab sequence (the grid is one tab stop) unless the cell is being interacted with. */
export function setCellContentTabbable(cell: Element, tabbable: boolean): HTMLElement[] {
  const els = focusablesIn(cell);
  for (const el of els) {
    el.setAttribute('data-grid-tab', '');
    el.tabIndex = tabbable ? 0 : -1;
  }
  return els;
}

/** Reads a length custom property (e.g. `--mm-row`) from an element that uses it. */
export function readPx(el: Element | null | undefined, fallback: number): number {
  if (!el) return fallback;
  const h = (el as HTMLElement).getBoundingClientRect().height;
  return h > 0 ? Math.round(h) : fallback;
}

/** The first element in an event path that carries `data-c` (a grid cell). */
export function cellFromPath(e: Event): HTMLElement | null {
  for (const n of e.composedPath()) {
    if (n instanceof HTMLElement && n.dataset.c !== undefined && n.dataset.r !== undefined) return n;
  }
  return null;
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The few `@marmotdata/css` classes that cell templates use, re-declared for the table's shadow
 * root (page stylesheets do not reach it), plus the `mm-mono` and `mm-muted` cell helpers.
 */
export const cellContentStyles = css`
  /* Links in tables are ink, underlined on hover and focus (the quiet link). */
  .cell .mm-link {
    color: var(--mm-text);
    text-decoration: none;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell .mm-link:hover,
  .cell .mm-link:focus-visible {
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
  }
  .cell code,
  .cell .mm-code-inline {
    font-family: var(--font-mono);
    font-size: calc(1em - 1px);
    background: var(--mm-sunken);
    border-radius: var(--radius-sm);
    padding: 1px 4px;
  }
  .cell .mm-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: 20px;
    block-size: 20px;
    padding: 0 5px;
    font: var(--text-keycap);
    color: var(--mm-text-2);
    background: var(--mm-surface);
    border: 1px solid var(--mm-rule);
    border-block-end-width: 2px;
    border-radius: var(--radius-sm);
  }
  .cell .mm-dense {
    font: var(--text-dense);
  }
  .cell .mm-label {
    font: var(--text-label);
    color: var(--mm-text-2);
  }
  .cell .mm-caption {
    font: var(--text-caption);
    color: var(--mm-text-2);
  }
  .cell .mm-mono {
    font: var(--text-mono-dense);
    font-variant-numeric: tabular-nums;
  }
  .cell .mm-muted {
    color: var(--mm-text-3);
  }
`;
