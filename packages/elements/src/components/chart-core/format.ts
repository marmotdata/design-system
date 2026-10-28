import { formatCompact, formatCount } from '../../core/format.js';

/** Non-breaking space, used before every unit (guidelines: "412 ms", "10 MB"). */
export const NBSP = ' ';
/** The typographic minus sign, so negative numbers never use a hyphen. */
export const MINUS = '−';

/** A chart x value: a time (Date, ISO string or epoch ms when `x-type` is time) or a plain number. */
export type XValue = Date | string | number;

/**
 * Formats a number for a chart label: counts with grouping below 100,000 and compact above
 * ("1,284", "1.28M"), with a real minus sign and an optional unit after a non-breaking space.
 */
export function fmtNum(v: number, unit = '', compactFrom = 100_000): string {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10;
  const body = abs >= compactFrom ? formatCompact(abs) : formatCount(rounded);
  const signed = v < 0 && rounded !== 0 ? `${MINUS}${body}` : body;
  return unit ? `${signed}${NBSP}${unit}` : signed;
}

/** Signed delta, "+214" or "−37", for KPI context sentences. */
export function fmtDelta(v: number, unit = ''): string {
  const s = fmtNum(v, unit);
  return v > 0 ? `+${s}` : s;
}

/** True when the x values are times rather than plain numbers. */
export function isTimeX(xs: readonly XValue[]): boolean {
  const first = xs[0];
  return first instanceof Date || (typeof first === 'string' && !Number.isNaN(Date.parse(first)));
}

/** Converts an x value to a number: epoch ms for times, the number itself otherwise. */
export function xNum(x: XValue): number {
  if (x instanceof Date) return x.getTime();
  if (typeof x === 'string') {
    const t = Date.parse(x);
    return Number.isNaN(t) ? Number(x) : t;
  }
  return x;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Returns a formatter for x values. Times within two days show "14:00"; longer spans show
 * "14 Oct". Times are formatted in `timeZone` (UTC by default) so server and client agree.
 */
export function xFormatter(xs: readonly XValue[], timeZone = 'UTC', locale = 'en-GB'): (x: XValue) => string {
  if (!isTimeX(xs)) return (x) => fmtNum(xNum(x));
  const nums = xs.map(xNum);
  const span = Math.max(...nums) - Math.min(...nums);
  const opts: Intl.DateTimeFormatOptions =
    span <= 2 * DAY ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone } : { day: 'numeric', month: 'short', timeZone };
  const f = new Intl.DateTimeFormat(locale, opts);
  return (x) => f.format(new Date(xNum(x)));
}

/** A longer formatter for tooltips and tables: "27 Oct 14:00" or "27 Oct 2026". */
export function xLongFormatter(xs: readonly XValue[], timeZone = 'UTC', locale = 'en-GB'): (x: XValue) => string {
  if (!isTimeX(xs)) return (x) => fmtNum(xNum(x));
  const nums = xs.map(xNum);
  const step = medianStep(nums);
  const opts: Intl.DateTimeFormatOptions =
    step < DAY
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone };
  const f = new Intl.DateTimeFormat(locale, opts);
  // "27 Oct 14:00", without the comma en-GB puts between date and time.
  return (x) => f.format(new Date(xNum(x))).replace(', ', ' ');
}

export function medianStep(nums: readonly number[]): number {
  if (nums.length < 2) return 0;
  const steps = nums.slice(1).map((n, i) => Math.abs(n - nums[i]!)).sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)]!;
}

/** "24 hours", "90 days", "12 weeks", or "30 points", for summary sentences. */
export function periodPhrase(xs: readonly XValue[]): string {
  const n = xs.length;
  if (!isTimeX(xs)) return `${formatCount(n)} ${n === 1 ? 'point' : 'points'}`;
  const step = medianStep(xs.map(xNum));
  const unit =
    Math.abs(step - 60_000) < 1000 ? 'minute' : Math.abs(step - HOUR) < 60_000 ? 'hour' : Math.abs(step - DAY) < HOUR ? 'day' : Math.abs(step - 7 * DAY) < DAY ? 'week' : '';
  if (!unit) return `${formatCount(n)} ${n === 1 ? 'point' : 'points'}`;
  return `${formatCount(n)} ${unit}${n === 1 ? '' : 's'}`;
}

/** Approximate rendered width of 11px label text, for layout without measuring (SSR-safe). Labels are in the
 * text face now; this mono-width estimate is a deliberate overestimate, so labels always get enough room. */
export const monoWidth = (s: string, size = 11) => s.length * size * 0.66;

/** Approximate rendered width of proportional caption text. */
export const textWidth = (s: string, size = 12) => s.length * size * 0.55;

/** Truncates to a width in px with a real ellipsis. */
export function clip(s: string, px: number, size = 11): string {
  const max = Math.max(1, Math.floor((px + 1) / (size * 0.66)));
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`;
}
