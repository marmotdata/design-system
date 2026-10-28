/** Number and time formatting to the guidelines rules: compact, tabular, non-breaking space before units. */
const NBSP = ' ';

export function formatCount(n: number, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** 1284019 → "1.28M"; 4120 → "4.1K". */
export function formatCompact(n: number, locale = 'en-GB'): string {
  // en-GB compact notation gives "1.28m" and "1.2bn"; the guidelines wants "1.28M", so English uses en-US symbols.
  const loc = locale.toLowerCase().startsWith('en') ? 'en-US' : locale;
  return new Intl.NumberFormat(loc, { notation: 'compact', maximumSignificantDigits: 3 }).format(n);
}

/** 412 → "412 ms", 2300 → "2.3 s", 192000 → "3.2 min". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}${NBSP}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}${NBSP}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}${NBSP}min`;
  return `${(ms / 3_600_000).toFixed(1)}${NBSP}h`;
}

export function formatBytes(b: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1000 && i < units.length - 1) {
    b /= 1000;
    i++;
  }
  return `${b < 10 && i > 0 ? b.toFixed(1) : Math.round(b)}${NBSP}${units[i]}`;
}

export function formatRelative(date: Date | string | number, now = Date.now(), locale = 'en-GB'): string {
  const d = new Date(date).getTime();
  const s = Math.round((d - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(s, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** Log timestamp in UTC: "2026-10-27 04:12:09 UTC". */
export function formatTimestamp(date: Date | string | number): string {
  const d = new Date(date);
  return `${d.toISOString().slice(0, 19).replace('T', ' ')}${NBSP}UTC`;
}
