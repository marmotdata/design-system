/**
 * Roving tabindex helper for composite widgets (toolbars, tabs, segmented controls, menus, trees).
 * Exactly one item is tabbable; arrow keys, Home and End move focus.
 */
export interface RovingOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  /** RTL flips horizontal arrows. */
  rtl?: boolean;
}

export function rovingKeydown(e: KeyboardEvent, items: HTMLElement[], current: number, opts: RovingOptions = {}): number | null {
  const enabled = items.map((el, i) => (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' ? -1 : i)).filter((i) => i >= 0);
  if (!enabled.length) return null;
  const o = opts.orientation ?? 'horizontal';
  const wrap = opts.wrap ?? true;
  const fwdH = opts.rtl ? 'ArrowLeft' : 'ArrowRight';
  const backH = opts.rtl ? 'ArrowRight' : 'ArrowLeft';
  const pos = Math.max(0, enabled.indexOf(current));
  let next: number | null = null;
  const step = (d: number) => {
    let p = pos + d;
    if (wrap) p = (p + enabled.length) % enabled.length;
    else p = Math.min(enabled.length - 1, Math.max(0, p));
    return enabled[p]!;
  };
  switch (e.key) {
    case fwdH:
      if (o !== 'vertical') next = step(1);
      break;
    case backH:
      if (o !== 'vertical') next = step(-1);
      break;
    case 'ArrowDown':
      if (o !== 'horizontal') next = step(1);
      break;
    case 'ArrowUp':
      if (o !== 'horizontal') next = step(-1);
      break;
    case 'Home':
      next = enabled[0]!;
      break;
    case 'End':
      next = enabled[enabled.length - 1]!;
      break;
  }
  if (next === null) return null;
  e.preventDefault();
  items.forEach((el, i) => (el.tabIndex = i === next ? 0 : -1));
  items[next]!.focus();
  return next;
}

/** True when the element or an ancestor sets dir="rtl". */
export const isRtl = (el: Element) => getComputedStyle(el).direction === 'rtl';
