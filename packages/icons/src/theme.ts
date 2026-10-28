import type { ReactiveController, ReactiveControllerHost } from 'lit';

type Host = ReactiveControllerHost & HTMLElement;
const hosts = new Set<SchemeController>();
let observing = false;

function startObserving() {
  if (observing || typeof window === 'undefined') return;
  observing = true;
  const update = () => hosts.forEach((h) => schedule(h));
  new MutationObserver(update).observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-theme'],
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
}

// Reading computed style forces a style recalculation. Hosts connecting one by one while the page
// renders would force one each (very slow in Firefox with many logos), so read them all in one frame.
const pending = new Set<SchemeController>();
let frame = 0;
function schedule(c: SchemeController) {
  pending.add(c);
  if (frame || typeof requestAnimationFrame === 'undefined') return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const batch = [...pending];
    pending.clear();
    batch.forEach((h) => h.update());
  });
}

/**
 * Tracks whether the host renders in Light or Peat. Reads the computed `color-scheme`, which the
 * tokens set on :root, [data-theme] and the prefers-color-scheme fallback, so nested themes work.
 */
export class SchemeController implements ReactiveController {
  scheme: 'light' | 'dark' = 'light';
  constructor(private host: Host) {
    host.addController(this);
  }
  hostConnected(): void {
    hosts.add(this);
    startObserving();
    schedule(this);
  }
  hostDisconnected(): void {
    hosts.delete(this);
    pending.delete(this);
  }
  update(): void {
    if (!this.host.isConnected) return;
    const next = getComputedStyle(this.host).colorScheme.includes('dark') ? 'dark' : 'light';
    if (next !== this.scheme) {
      this.scheme = next;
      this.host.requestUpdate();
    }
  }
}
