/**
 * Shared keyboard and persistence model for resize handles (`mm-split-pane` separator and the
 * `mm-details-blade` edge). Follows the WAI-ARIA window splitter pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 */

/** Pixels moved per arrow key press. */
export const RESIZE_STEP = 16;

export interface ResizeKeyOptions {
  value: number;
  min: number;
  max: number;
  /** `vertical` separators (side-by-side panes) use Left/Right; `horizontal` ones use Up/Down. */
  orientation: 'vertical' | 'horizontal';
  rtl: boolean;
  /**
   * True when the controlled size grows as the handle moves toward the inline end (a start pane).
   * False when it grows toward the inline start (a blade on the end edge).
   */
  growsTowardEnd: boolean;
  step?: number;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Returns the new value for a key press, or null when the key is not part of the model. */
export function resizeForKey(e: KeyboardEvent, o: ResizeKeyOptions): number | null {
  const step = o.step ?? RESIZE_STEP;
  let delta = 0;
  if (o.orientation === 'vertical') {
    if (e.key === 'ArrowRight') delta = step;
    else if (e.key === 'ArrowLeft') delta = -step;
    // Physical arrows: in RTL the inline end is on the left.
    if (o.rtl) delta = -delta;
    if (!o.growsTowardEnd) delta = -delta;
  } else {
    if (e.key === 'ArrowDown') delta = step;
    else if (e.key === 'ArrowUp') delta = -step;
    if (!o.growsTowardEnd) delta = -delta;
  }
  if (delta) return clamp(o.value + delta, o.min, Math.max(o.min, o.max));
  if (e.key === 'Home') return o.min;
  if (e.key === 'End') return Math.max(o.min, o.max);
  return null;
}

export function readStored(key: string): number | undefined {
  if (!key || typeof localStorage === 'undefined') return undefined;
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export function writeStored(key: string, value: number | undefined): void {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, String(Math.round(value)));
  } catch {
    /* storage blocked: the size still applies for this page */
  }
}
