/**
 * Built-in interface strings, with British English defaults. Apps pass translations once
 * (for example from Paraglide) with `setStrings({ close: m.close() })`.
 */
export const defaultStrings = {
  close: 'Close',
  copy: 'Copy',
  copied: 'Copied',
  clear: 'Clear',
  search: 'Search',
  loading: 'Loading',
  noResults: 'No results',
  more: 'More',
  moreActions: 'More actions',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  page: 'Page',
  of: 'of',
  required: 'Required',
  optional: 'Optional',
  remove: 'Remove',
  selectAll: 'Select all rows',
  selectRow: 'Select row',
  sortAscending: 'Sorted ascending',
  sortDescending: 'Sorted descending',
  expand: 'Expand',
  collapse: 'Collapse',
  collapseSidebar: 'Collapse sidebar',
  expandSidebar: 'Expand sidebar',
  breadcrumbs: 'Breadcrumbs',
  pagination: 'Pagination',
  dismiss: 'Dismiss',
  notifications: 'Notifications',
  cancel: 'Cancel',
  confirm: 'Confirm',
  dropFiles: 'Drop files here or browse',
  browse: 'browse',
  last15Minutes: 'Last 15 minutes',
  lastHour: 'Last hour',
  last24Hours: 'Last 24 hours',
  last7Days: 'Last 7 days',
  last30Days: 'Last 30 days',
  last90Days: 'Last 90 days',
  customRange: 'Custom range',
  apply: 'Apply',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fitView: 'Fit to view',
  run: 'Run query',
  exportCsv: 'Export CSV',
  exportJson: 'Export JSON',
  keyboardShortcuts: 'Keyboard shortcuts',
} as const;

export type StringKey = keyof typeof defaultStrings;
/**
 * Components may also use keys that are not in `defaultStrings`, with an English fallback at the
 * call site. Apps can translate those too: `setStrings` accepts any key. The full list of keys is
 * generated into `strings.json` in the package for translators.
 */
let current: Record<string, string> = { ...defaultStrings };
const listeners = new Set<() => void>();

export function setStrings(strings: Partial<Record<StringKey, string>> & Record<string, string>): void {
  current = { ...current, ...strings };
  listeners.forEach((l) => l());
}

/** Returns the string for a key, with `{name}` placeholders filled from `vars`. Unknown keys return undefined. */
export function t(key: StringKey, vars?: Record<string, string | number>): string;
export function t(key: string, vars?: Record<string, string | number>): string | undefined;
export function t(key: string, vars?: Record<string, string | number>): string | undefined {
  const raw = current[key];
  if (raw === undefined || !vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** `t()` with an English fallback for keys that are not in `defaultStrings`. */
export function tr(key: string, fallback: string, vars?: Record<string, string | number>): string {
  const raw = current[key] ?? fallback;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw;
}

export function onStringsChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
