/**
 * Real keyboard input for interaction tests. Under Vitest browser mode this uses Playwright's
 * trusted key events (which move focus into shadow roots like a person would); in the Storybook UI
 * it falls back to dispatching through the focused element's shadow-aware active element.
 */
type Real = { keyboard(text: string): Promise<void>; tab(opts?: { shift?: boolean }): Promise<void> };

// In the Storybook UI build this import is aliased to a stub (see .storybook/main.ts).
import { userEvent as vitestUserEvent } from 'vitest/browser';

async function real(): Promise<Real | null> {
  if (!(globalThis as { __vitest_browser__?: boolean }).__vitest_browser__) return null;
  return (vitestUserEvent as unknown as Real) ?? null;
}

/** Real pointer click under Vitest; element.click() otherwise. */
export async function click(el: Element): Promise<void> {
  const r = (await real()) as unknown as { click?(el: Element): Promise<void> } | null;
  if (r?.click) return r.click(el);
  (el as HTMLElement).click();
}

/** Deepest focused element, through shadow roots. */
export function deepActive(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/** Press keys, e.g. press('{Enter}'), press('{ArrowDown}{ArrowDown}'), press('orders'). */
export async function press(keys: string): Promise<void> {
  const r = await real();
  if (r) return r.keyboard(keys);
  const target = deepActive() ?? document.body;
  for (const m of keys.matchAll(/\{([^}]+)\}|(.)/g)) {
    const key = m[1] ?? m[2]!;
    const k = key === 'Space' ? ' ' : key;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, composed: true }));
  }
}

export async function tab(shift = false): Promise<void> {
  const r = await real();
  if (!r) return;
  // Firefox sends the first Tab from an unfocused document to the browser chrome. Start from a
  // focusable sentinel at the top of the story root so every browser tabs into the story itself.
  if (!shift && (document.activeElement === document.body || document.activeElement === null)) {
    const root = document.querySelector('#storybook-root') ?? document.body;
    const sentinel = document.createElement('span');
    sentinel.tabIndex = -1;
    root.prepend(sentinel);
    sentinel.focus();
    await r.tab({ shift });
    sentinel.remove();
    return;
  }
  return r.tab({ shift });
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));
