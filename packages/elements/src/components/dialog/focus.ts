/**
 * Focus helpers shared by the modal overlays (dialog, drawer, confirm dialog) and the popovers.
 * They walk the flat tree (shadow roots and slot assignments) so slotted light DOM and controls
 * that render their native input in a shadow root are found in visual order.
 */

const NATIVE = 'a[href], area[href], button, input, select, textarea, iframe, summary, [contenteditable=""], [contenteditable="true"], [tabindex]';

function visible(el: Element): boolean {
  if ((el as HTMLElement).hidden || el.hasAttribute('inert')) return false;
  // Slots and display: contents wrappers have no box of their own, so checkVisibility() says false.
  if (el instanceof HTMLSlotElement || getComputedStyle(el).display === 'contents') return true;
  const check = (el as Element & { checkVisibility?(o?: object): boolean }).checkVisibility;
  return check ? check.call(el, { visibilityProperty: true }) : true;
}

function tabbable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.matches(NATIVE)) return false;
  if ((el as HTMLButtonElement).disabled) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  return el.tabIndex >= 0;
}

function walk(nodes: Iterable<Element>, out: HTMLElement[], autofocus: { el: HTMLElement | null }): void {
  for (const el of nodes) {
    if (!visible(el)) continue;
    if (!autofocus.el && el.hasAttribute('autofocus') && el instanceof HTMLElement) autofocus.el = el;
    if (el instanceof HTMLSlotElement) {
      walk(el.assignedElements({ flatten: true }), out, autofocus);
      continue;
    }
    if (tabbable(el)) out.push(el);
    if (el.shadowRoot) walk(el.shadowRoot.children, out, autofocus);
    else walk(el.children, out, autofocus);
  }
}

/** Tabbable elements inside `root`, in flat-tree order, and the first `autofocus` element if any. */
export function tabbables(root: Element | ShadowRoot): { list: HTMLElement[]; autofocus: HTMLElement | null } {
  const out: HTMLElement[] = [];
  const autofocus = { el: null as HTMLElement | null };
  const start = root instanceof Element && root.shadowRoot ? root.shadowRoot.children : root instanceof HTMLSlotElement ? [root] : root.children;
  walk(start, out, autofocus);
  return { list: out, autofocus: autofocus.el };
}

/** The deepest focused element, through shadow roots. */
export function activeDeep(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.activeElement as HTMLElement | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
  return el;
}

/** True when `node` is `container` or inside it, crossing shadow boundaries and slots. */
export function containsDeep(container: Node, node: Node | null): boolean {
  let n: Node | null = node;
  while (n) {
    if (n === container) return true;
    n = (n as Element).assignedSlot ?? n.parentNode ?? ((n as ShadowRoot).host || null);
  }
  return false;
}

/**
 * Keeps Tab inside `root`: from the last tabbable Tab goes to the first, and Shift+Tab from the
 * first goes to the last. Native modal dialogs make the page inert but let Tab escape to the
 * browser chrome; this wraps instead, as the APG dialog pattern asks.
 */
export function wrapTab(e: KeyboardEvent, root: Element | ShadowRoot): void {
  if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const { list } = tabbables(root);
  if (!list.length) {
    e.preventDefault();
    return;
  }
  const active = activeDeep();
  const i = active ? list.indexOf(active) : -1;
  const first = list[0]!;
  const last = list[list.length - 1]!;
  if (e.shiftKey && (i <= 0)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (i === -1 || i === list.length - 1)) {
    e.preventDefault();
    first.focus();
  }
}

let locks = 0;
let saved = '';
let savedGutter = '';

/** Locks page scrolling while a modal is open. Nested modals share one lock. */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = root.style.overflow;
    savedGutter = root.style.scrollbarGutter;
    // Keep the gutter so the page does not shift sideways when the scrollbar disappears.
    if (root.scrollHeight > root.clientHeight) root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      root.style.overflow = saved;
      root.style.scrollbarGutter = savedGutter;
    }
  };
}

/** Waits for every Lit element in the flat tree under `root` to finish rendering, so their inner controls exist. */
export async function settled(root: Element | ShadowRoot): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const visit = (nodes: Iterable<Element>) => {
    for (const el of nodes) {
      const done = (el as Element & { updateComplete?: Promise<unknown> }).updateComplete;
      if (done) pending.push(done);
      if (el instanceof HTMLSlotElement) visit(el.assignedElements({ flatten: true }));
      else visit(el.shadowRoot ? el.shadowRoot.children : el.children);
    }
  };
  visit(root instanceof Element && root.shadowRoot ? root.shadowRoot.children : root.children);
  await Promise.all(pending);
}
