export interface IconData {
  body: string;
  width: number;
  height: number;
}

/**
 * A provider mark. `artwork` marks keep their own colours and are never recoloured.
 * `ink` marks are black artwork or neutral glyphs drawn in mm-text so they read on Peat.
 * `brand` marks are single-colour official marks drawn in their published brand colour.
 */
export interface ProviderMark {
  name: string;
  light: IconData;
  dark?: IconData;
  tone: 'artwork' | 'ink' | 'brand';
  brand?: string;
  generic?: boolean;
}

const icons = new Map<string, IconData>();
const providers = new Map<string, ProviderMark>();
const listeners = new Set<() => void>();

// Coalesce: many registrations in one task notify listeners once.
let queued = false;
const notify = () => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    listeners.forEach((l) => l());
  });
};

/** Adds icons to the registry, e.g. a build-time subset from `@marmotdata/icons/subset`. */
export function registerIcons(map: Record<string, IconData>): void {
  let added = false;
  for (const [k, v] of Object.entries(map)) if (icons.get(k) !== v) (icons.set(k, v), (added = true));
  if (added) notify();
}

export function getIcon(name: string): IconData | undefined {
  return icons.get(name);
}

export function registerProviders(map: Record<string, ProviderMark>): void {
  let added = false;
  for (const [k, v] of Object.entries(map)) if (providers.get(k) !== v) (providers.set(k, v), (added = true));
  if (added) notify();
}

export function getProvider(name: string): ProviderMark | undefined {
  return providers.get(name);
}

export function onRegistryChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
