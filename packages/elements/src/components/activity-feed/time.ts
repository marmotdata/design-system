import { css, html } from 'lit';
import { formatRelative, formatTimestamp } from '../../core/format.js';
import { tr } from '../../core/strings.js';
import '../tooltip/define.js';

/** Shared by the activity feed, timeline and notifications: relative time in the text face with tabular figures, absolute UTC in a tooltip. */
export const parseTime = (t: string | number | Date | undefined): Date | null => {
  if (t === undefined || t === '') return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function relativeTime(time: string | number | Date | undefined, now?: number) {
  const d = parseTime(time);
  if (!d) return html``;
  const abs = formatTimestamp(d);
  return html`<mm-tooltip content=${abs} placement="top"
    ><time class="time" datetime=${d.toISOString()}>${formatRelative(d, now ?? Date.now())}</time></mm-tooltip
  >`;
}

/** Plain text "2 hours ago, 2026-10-27 04:12:09 UTC" for accessible names. */
export function timeText(time: string | number | Date | undefined, now?: number): string {
  const d = parseTime(time);
  if (!d) return '';
  return `${formatRelative(d, now ?? Date.now())}, ${formatTimestamp(d)}`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Sentence-case day heading: "Today", "Yesterday", "Monday 26 October", with the year when it differs. */
export function dayHeading(d: Date, now = Date.now(), locale = 'en-GB'): string {
  const today = startOfDay(new Date(now));
  const day = startOfDay(d);
  const diff = Math.round((today - day) / 86_400_000);
  if (diff === 0) return tr('today', 'Today');
  if (diff === 1) return tr('yesterday', 'Yesterday');
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' })
    .format(d)
    .replace(',', '');
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const timeStyles = css`
  .time {
    font: var(--text-caption);
    font-variant-numeric: tabular-nums;
    color: var(--mm-text-3);
    white-space: nowrap;
  }
`;
