/** True on macOS and iOS, where shortcuts use ⌘ rather than Ctrl. Safe during SSR (returns false). */
export function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const p = uaData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(p);
}

/** The modifier key label for the current platform: "⌘" on Apple, "Ctrl" elsewhere. */
export function modKey(): string {
  return isApple() ? '⌘' : 'Ctrl';
}

/** True when the primary shortcut modifier is held (⌘ on Apple, Ctrl elsewhere). */
export function isModKey(e: KeyboardEvent | MouseEvent): boolean {
  return isApple() ? e.metaKey : e.ctrlKey;
}

/** Formats a shortcut such as "mod+k" for display, with non-breaking spaces between keys (guidelines). */
export function formatShortcut(shortcut: string): string[] {
  return shortcut.split('+').map((k) => {
    const key = k.trim().toLowerCase();
    if (key === 'mod') return modKey();
    if (key === 'shift') return '⇧';
    if (key === 'alt') return isApple() ? '⌥' : 'Alt';
    if (key === 'enter') return '↵';
    if (key === 'esc' || key === 'escape') return 'Esc';
    if (key === 'up') return '↑';
    if (key === 'down') return '↓';
    if (key === 'left') return '←';
    if (key === 'right') return '→';
    return key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1);
  });
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  const forced = document.documentElement.dataset.motion;
  if (forced === 'reduce') return true;
  if (forced === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
