import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { MmFieldControl, fieldStyles, type ValidityResult } from '../form-field/class.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { rovingKeydown, isRtl } from '../../core/roving.js';
import { t, tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import '@marmotdata/icons/define.js';
import '../button/define.js';

/** A relative range such as "Last 7 days", measured back from now. */
export interface DateRangePreset {
  /** Submitted to forms and stored in the value, e.g. `last-7-days`. */
  key: string;
  /** Shown in the list and on the trigger. */
  label: string;
  /** Length of the range in milliseconds. */
  duration: number;
}

export type DateRangeValue =
  | { kind: 'relative'; preset: string }
  | { kind: 'absolute'; start: string; end: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NBSP = ' ';

/** The default relative presets, labelled from the string table. */
export const defaultPresets = (): DateRangePreset[] => [
  { key: 'last-15-minutes', label: t('last15Minutes'), duration: 15 * MIN },
  { key: 'last-hour', label: t('lastHour'), duration: HOUR },
  { key: 'last-24-hours', label: t('last24Hours'), duration: DAY },
  { key: 'last-7-days', label: t('last7Days'), duration: 7 * DAY },
  { key: 'last-30-days', label: t('last30Days'), duration: 30 * DAY },
  { key: 'last-90-days', label: t('last90Days'), duration: 90 * DAY },
];

/** Resolves a value to concrete start and end instants. Relative presets end at `now`. */
export function resolveRange(value: DateRangeValue, now: Date = new Date(), presets: DateRangePreset[] = defaultPresets()): { start: Date; end: Date } | null {
  if (value.kind === 'absolute') return { start: new Date(value.start), end: new Date(value.end) };
  const p = presets.find((x) => x.key === value.preset);
  if (!p) return null;
  return { start: new Date(now.getTime() - p.duration), end: new Date(now.getTime()) };
}

/* Strings this element needs that core/strings.ts does not have yet (listed in the hand-off report). */
const local = {
  chooseTimeRange: 'Choose a time range',
  relativeRange: 'Relative range',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  start: 'Start',
  end: 'End',
  startTime: 'Start time',
  endTime: 'End time',
  pickStart: 'Select a start date.',
  pickEnd: 'Select an end date.',
  timeFormat: 'Enter times as HH:MM, for example 09:00.',
  endBeforeStart: 'The end must be after the start.',
  rangeRequired: 'Choose a time range.',
  rangeTo: 'to',
} as const;
const s = (key: keyof typeof local): string => tr(key, local[key]);

/* Calendar maths on whole days since the epoch, so the grid never depends on the browser's zone. */
const dayNum = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d) / DAY);
const dayDate = (n: number) => new Date(n * DAY);
const ymd = (n: number) => {
  const d = dayDate(n);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};
/** Monday is 0. */
const weekday = (n: number) => (dayDate(n).getUTCDay() + 6) % 7;
const isoDay = (n: number) => dayDate(n).toISOString().slice(0, 10);
const addMonths = (n: number, delta: number) => {
  const { y, m, d } = ymd(n);
  const last = new Date(Date.UTC(y, m + delta + 1, 0)).getUTCDate();
  return dayNum(y, m + delta, Math.min(d, last));
};
const TIME_RE = /^([01]?\d|2[0-3]):?([0-5]\d)$/;
const normaliseTime = (v: string): string | null => {
  const m = TIME_RE.exec(v.trim());
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : null;
};

/**
 * The date range picker sets the time window for run history, query audit and Insights. The trigger
 * reads as a sentence ("Last 7 days", or "12 Oct 2026, 09:00 to 27 Oct 2026, 17:30 UTC") with the
 * zone always shown. The popover holds relative presets on one side, which apply at once, and a
 * custom range on the other: a calendar grid, start and end times, then Apply or Cancel. The range is
 * marked with the selection tint, the endpoints with an ink fill and today with an underline, so
 * nothing relies on colour alone.
 *
 * Keyboard follows the WAI-ARIA date picker dialog pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/): arrows move
 * by day and week, Page Up and Page Down by month (with Shift, by year), Home and End to the start
 * and end of the week, Enter or Space picks the start and then the end. Arrow keys move through the
 * presets. Escape closes without applying. Tab cycles within the open popover.
 *
 * Submits `${name}` with the preset key for relative ranges, or `${name}-start` and `${name}-end`
 * as ISO 8601 strings for absolute ranges.
 *
 * @tagname mm-date-range-picker
 * @summary Picks a relative or absolute time range.
 * @csspart trigger - The button that opens the popover.
 * @csspart popover - The popover dialog.
 * @csspart presets - The relative preset list.
 * @csspart calendar - The calendar grid.
 * @csspart label - The field label.
 * @csspart help - The helper text.
 * @csspart error - The error message.
 * @fires mm-change - {{ value: DateRangeValue }} The range was applied, from a preset or the Apply button.
 * @fires mm-input - {{ start: string | null; end: string | null }} The draft custom range changed inside the popover.
 * @fires change - Native change event, re-dispatched after mm-change for `bind:` style code.
 */
export class MmDateRangePicker extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: inline-block;
        min-width: 0;
        max-width: 100%;
        color: var(--mm-text);
        font: var(--text-dense);
      }
      .label {
        cursor: default;
      }
      /* The trigger is a .box from fieldStyles, so it matches every other field. */
      .trigger {
        min-width: 15rem;
        max-width: 100%;
        padding-inline: 10px 8px;
        font-variant-numeric: tabular-nums;
        text-align: start;
        cursor: pointer;
      }
      .trigger[aria-expanded='true'] {
        border-color: var(--mm-text);
      }
      .trigger.disabled {
        cursor: not-allowed;
      }
      .trigger mm-icon {
        color: var(--mm-text-2);
      }
      .trigger .text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .trigger .placeholder {
        color: var(--mm-text-3);
      }
      .trigger .zone {
        color: var(--mm-text-2);
      }
      @media (pointer: coarse) {
        .time input {
          font-size: 16px;
        }
      }

      .pop {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        width: max-content;
        max-width: calc(100vw - 16px);
        overflow: auto;
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        background: var(--mm-raised);
        color: var(--mm-text);
        box-shadow: var(--shadow-float);
        z-index: var(--mm-z-popover);
        font: var(--text-dense);
        opacity: 1;
        /* Fades in only; closing is instant so focus returns to a settled page. */
        transition: opacity var(--mm-dur-menu) var(--mm-ease);
      }
      @starting-style {
        .pop:popover-open {
          opacity: 0;
        }
      }
      .pop[data-instant] {
        transition: none;
      }
      .body {
        display: flex;
        flex-wrap: wrap;
      }
      .heading {
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
        margin: 0 0 var(--space-2);
      }
      .presets {
        display: grid;
        align-content: start;
        gap: 2px;
        min-width: 11rem;
        padding: var(--space-3);
        border-inline-end: 1px solid var(--mm-rule);
      }
      .preset {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        height: var(--mm-menu-row, 32px);
        padding-inline: 10px;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text);
        font: var(--text-dense);
        text-align: start;
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .preset:hover {
        background: var(--mm-sunken);
      }
      .preset[aria-pressed='true'] {
        background: var(--mm-selected);
        font-weight: 600;
      }
      .preset .tick {
        margin-inline-start: auto;
        visibility: hidden;
      }
      .preset[aria-pressed='true'] .tick {
        visibility: visible;
      }
      .custom {
        padding: var(--space-3);
        display: grid;
        gap: var(--space-3);
      }
      .month {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .month-name {
        flex: 1;
        text-align: center;
        font: var(--text-dense);
        font-weight: 600;
      }
      :host(:dir(rtl)) .month mm-button::part(icon) {
        transform: scaleX(-1);
      }
      table {
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      th {
        width: 34px;
        height: 24px;
        padding: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        text-align: center;
      }
      td {
        width: 34px;
        height: 32px;
        padding: 0;
        text-align: center;
        font: var(--text-dense);
        font-variant-numeric: tabular-nums;
      }
      td.day {
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      td.day:hover {
        background: var(--mm-sunken);
      }
      td.in-range {
        background: var(--mm-selected);
        border-radius: 0;
      }
      td.in-range:hover {
        background: var(--mm-selected);
      }
      td.edge {
        background: var(--mm-text);
        color: var(--mm-on-inverse);
        font-weight: 600;
        border-radius: var(--radius-sm);
      }
      td.edge:hover {
        background: var(--mm-text);
      }
      td.today span {
        text-decoration: underline;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
      }
      td:focus-visible {
        outline-offset: -2px;
        position: relative;
      }
      td.edge:focus-visible {
        outline-color: var(--mm-primary);
        outline-offset: 1px;
      }
      .times {
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: var(--space-2) var(--space-2);
      }
      .times .k {
        font: var(--text-label);
        color: var(--mm-text-2);
      }
      .times .d {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .times .d.empty {
        color: var(--mm-text-2);
      }
      .time input {
        width: 7ch;
        height: var(--control-h-sm);
        padding-inline: var(--space-2);
        background: var(--mm-surface);
        color: var(--mm-text);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        font: var(--text-dense);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .time input:focus-visible {
        border-color: var(--mm-text);
      }
      .time input[aria-invalid='true'] {
        border-color: var(--mm-danger);
      }
      .zone-tag {
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .status {
        font: var(--text-caption);
        color: var(--mm-text-2);
        margin: 0;
        max-width: 17rem;
      }
      .status.bad {
        color: var(--mm-danger);
        display: flex;
        gap: calc(var(--space-1) * 1.5);
      }
      .foot {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3);
        border-top: 1px solid var(--mm-rule);
      }
    `,
  ];

  /** The current range, or `null` for none. As an attribute, JSON such as `{"kind":"relative","preset":"last-7-days"}`. */
  @property({ type: Object }) accessor value: DateRangeValue | null = null;
  /** The relative presets offered. Defaults to Last 15 minutes through Last 90 days. */
  @property({ attribute: false }) accessor presets: DateRangePreset[] | undefined;
  /** `UTC` (default) or `local`. Times are entered and shown in this zone, and the zone is always printed. */
  @property({ attribute: 'time-zone', reflect: true }) accessor timeZone: 'UTC' | 'local' = 'UTC';
  /** BCP 47 locale for month, weekday and date names. Weeks always start on Monday. */
  @property({ reflect: true }) accessor locale = 'en-GB';
  /** Trigger text when there is no value. */
  @property() accessor placeholder = '';
  /** Reference time for presets and the today marker. Defaults to the current time. */
  @property({ attribute: false }) accessor now: Date | undefined;

  @state() accessor _focusDay = 0;
  @state() accessor _start: number | null = null;
  @state() accessor _end: number | null = null;
  @state() accessor _startTime = '00:00';
  @state() accessor _endTime = '23:59';
  @state() accessor _presetIndex = 0;
  @state() accessor _open = false;

  @query('.trigger') accessor _trigger!: HTMLButtonElement;
  @query('.pop') accessor _pop!: HTMLElement;

  #ids = { value: uid('drp-value'), month: uid('drp-month'), pop: uid('drp-pop'), status: uid('drp-status') };
  #initial: DateRangeValue | null = null;
  #captured = false;
  #cleanupFloat?: () => void;

  get #presets(): DateRangePreset[] {
    return this.presets ?? defaultPresets();
  }
  get #now(): Date {
    return this.now ?? new Date();
  }
  get #utc() {
    return this.timeZone !== 'local';
  }

  override focus(options?: FocusOptions) {
    this._trigger?.focus(options);
  }

  /** Opens the popover. */
  show() {
    if (this.isDisabled) return;
    this._pop?.showPopover();
  }
  /** Closes the popover without applying the draft. */
  hide() {
    try {
      this._pop?.hidePopover();
    } catch {
      /* not open */
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    if (!this.#captured) {
      this.#captured = true;
      this.#initial = this.value;
    }
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#cleanupFloat?.();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('value') || changed.has('name') || changed.has('disabled')) {
      this.#syncForm();
    }
  }

  protected override computeValidity(): ValidityResult {
    if (this.required && !this.value) return { flags: { valueMissing: true }, message: s('rangeRequired') };
    return { flags: {}, message: '' };
  }

  formResetCallback() {
    this.value = this.#initial;
    this.hide();
    this.resetField();
  }

  #syncForm() {
    const v = this.value;
    if (!v || !this.name) {
      this.setFormValue(null);
    } else {
      const fd = new FormData();
      if (v.kind === 'relative') fd.append(this.name, v.preset);
      else {
        fd.append(`${this.name}-start`, v.start);
        fd.append(`${this.name}-end`, v.end);
      }
      this.setFormValue(fd);
    }
  }

  /* ---------- formatting ---------- */

  #zoneLabel(at: Date): string {
    if (this.#utc) return 'UTC';
    const part = new Intl.DateTimeFormat(this.locale, { timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  }
  #formatInstant(d: Date): string {
    return new Intl.DateTimeFormat(this.locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: this.#utc ? 'UTC' : undefined,
    }).format(d);
  }
  #formatDay(n: number, long = false): string {
    return new Intl.DateTimeFormat(this.locale, long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(dayDate(n));
  }
  /** The trigger text: the preset label, or both instants and the zone. */
  get displayText(): string {
    const v = this.value;
    if (!v) return '';
    if (v.kind === 'relative') return this.#presets.find((p) => p.key === v.preset)?.label ?? v.preset;
    const a = new Date(v.start);
    const b = new Date(v.end);
    return `${this.#formatInstant(a)} ${s('rangeTo')} ${this.#formatInstant(b)}${NBSP}${this.#zoneLabel(b)}`;
  }

  /* ---------- civil date helpers in the chosen zone ---------- */

  #civil(d: Date): { day: number; time: string } {
    const u = this.#utc;
    const y = u ? d.getUTCFullYear() : d.getFullYear();
    const m = u ? d.getUTCMonth() : d.getMonth();
    const dd = u ? d.getUTCDate() : d.getDate();
    const h = u ? d.getUTCHours() : d.getHours();
    const mi = u ? d.getUTCMinutes() : d.getMinutes();
    return { day: dayNum(y, m, dd), time: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
  }
  #instant(day: number, time: string): Date {
    const { y, m, d } = ymd(day);
    const [h, mi] = time.split(':').map(Number) as [number, number];
    return this.#utc ? new Date(Date.UTC(y, m, d, h, mi)) : new Date(y, m, d, h, mi);
  }
  get #today() {
    return this.#civil(this.#now).day;
  }

  /* ---------- open and close ---------- */

  #onBeforeToggle = (e: Event) => {
    const ev = e as ToggleEvent;
    if (ev.newState !== 'open') return;
    // Seed the draft from the current value so a relative range shows where it falls on the calendar.
    const presets = this.#presets;
    const v = this.value;
    const r = v ? resolveRange(v, this.#now, presets) : null;
    if (r) {
      const a = this.#civil(r.start);
      const b = this.#civil(r.end);
      this._start = a.day;
      this._end = b.day;
      this._startTime = a.time;
      this._endTime = b.time;
      this._focusDay = a.day;
    } else {
      this._start = this._end = null;
      this._startTime = '00:00';
      this._endTime = '23:59';
      this._focusDay = this.#today;
    }
    const idx = v?.kind === 'relative' ? presets.findIndex((p) => p.key === v.preset) : -1;
    this._presetIndex = Math.max(0, idx);
    this._pop.toggleAttribute('data-instant', openedFromKeyboard());
    this.#cleanupFloat?.();
    this.#cleanupFloat = float(this._trigger, this._pop, { placement: 'bottom-start' });
  };

  #onToggle = async (e: Event) => {
    const ev = e as ToggleEvent;
    this._open = ev.newState === 'open';
    if (this._open) {
      await this.updateComplete;
      const v = this.value;
      if (v?.kind === 'absolute') this.#focusCell();
      else this.#presetButtons()[this._presetIndex]?.focus();
    } else {
      this.#cleanupFloat?.();
      this.#cleanupFloat = undefined;
      const active = this.shadowRoot?.activeElement;
      if (!active || this._pop.contains(active) || document.activeElement === document.body) this._trigger.focus();
    }
  };

  #close() {
    this.hide();
    this._trigger.focus();
  }

  #commit(value: DateRangeValue) {
    this.value = value;
    this.touched = true;
    this.emitChange({ value });
    this.#close();
  }

  /* ---------- presets ---------- */

  #presetButtons(): HTMLElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLElement>('.preset') ?? [])];
  }
  #onPresetKey(e: KeyboardEvent) {
    const next = rovingKeydown(e, this.#presetButtons(), this._presetIndex, { orientation: 'vertical', wrap: false });
    if (next !== null) this._presetIndex = next;
  }

  /* ---------- calendar ---------- */

  #focusCell() {
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLElement>(`td[data-day="${isoDay(this._focusDay)}"]`)?.focus();
    });
  }
  #moveFocus(n: number) {
    this._focusDay = n;
    this.#focusCell();
  }
  #onGridKey(e: KeyboardEvent) {
    const f = this._focusDay;
    const rtl = isRtl(this);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = f + (rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        next = f + (rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        next = f + 7;
        break;
      case 'ArrowUp':
        next = f - 7;
        break;
      case 'PageDown':
        next = addMonths(f, e.shiftKey ? 12 : 1);
        break;
      case 'PageUp':
        next = addMonths(f, e.shiftKey ? -12 : -1);
        break;
      case 'Home':
        next = f - weekday(f);
        break;
      case 'End':
        next = f + (6 - weekday(f));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.#pick(f);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.#moveFocus(next);
  }
  #pick(n: number) {
    this._focusDay = n;
    if (this._start === null || this._end !== null) {
      this._start = n;
      this._end = null;
    } else if (n < this._start) {
      this._end = this._start;
      this._start = n;
    } else {
      this._end = n;
    }
    this.#emitDraft();
  }
  #emitDraft() {
    const ok = this._start !== null && normaliseTime(this._startTime);
    const ok2 = this._end !== null && normaliseTime(this._endTime);
    emit(this, 'mm-input', {
      start: ok ? this.#instant(this._start!, normaliseTime(this._startTime)!).toISOString() : null,
      end: ok2 ? this.#instant(this._end!, normaliseTime(this._endTime)!).toISOString() : null,
    });
  }
  #shiftMonth(delta: number) {
    this._focusDay = addMonths(this._focusDay, delta);
  }

  /* ---------- times and apply ---------- */

  get #draftProblem(): string | null {
    const a = normaliseTime(this._startTime);
    const b = normaliseTime(this._endTime);
    if (!a || !b) return s('timeFormat');
    if (this._start === null || this._end === null) return null;
    if (this.#instant(this._end, b) <= this.#instant(this._start, a)) return s('endBeforeStart');
    return null;
  }
  get #canApply() {
    return this._start !== null && this._end !== null && !this.#draftProblem;
  }
  #apply() {
    if (!this.#canApply) return;
    const start = this.#instant(this._start!, normaliseTime(this._startTime)!).toISOString();
    const end = this.#instant(this._end!, normaliseTime(this._endTime)!).toISOString();
    this.#commit({ kind: 'absolute', start, end });
  }
  #onTime(which: 'start' | 'end', e: Event) {
    const v = (e.target as HTMLInputElement).value;
    if (which === 'start') this._startTime = v;
    else this._endTime = v;
    this.#emitDraft();
  }
  #onTimeBlur(which: 'start' | 'end', e: Event) {
    const input = e.target as HTMLInputElement;
    const n = normaliseTime(input.value);
    if (!n) return;
    input.value = n;
    if (which === 'start') this._startTime = n;
    else this._endTime = n;
  }

  /** Keeps Tab inside the open popover, as the date picker dialog pattern asks. */
  #onPopKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.#close();
      return;
    }
    if (e.key !== 'Tab') return;
    const first = this.#presetButtons()[this._presetIndex];
    const last = this.shadowRoot?.querySelector<HTMLElement>('.apply');
    const active = this.shadowRoot?.activeElement;
    if (!first || !last || !active) return;
    if (!e.shiftKey && (active === last || last.contains(active))) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    }
  }

  /* ---------- render ---------- */

  #renderGrid() {
    const f = this._focusDay;
    const { y, m } = ymd(f);
    const first = dayNum(y, m, 1);
    const gridStart = first - weekday(first);
    const today = this.#today;
    const lo = this._start;
    const hi = this._end ?? (this._start !== null && f > this._start ? f : this._start);
    const weekdayFmt = new Intl.DateTimeFormat(this.locale, { weekday: 'short', timeZone: 'UTC' });
    const weekdayLong = new Intl.DateTimeFormat(this.locale, { weekday: 'long', timeZone: 'UTC' });
    const dayFmt = new Intl.DateTimeFormat(this.locale, { day: 'numeric', timeZone: 'UTC' });
    const monday = dayNum(2024, 0, 1);
    const rows = [0, 1, 2, 3, 4, 5].filter((r) => r === 0 || ymd(gridStart + r * 7).m === m);
    return html`<table
      role="grid"
      part="calendar"
      aria-labelledby=${this.#ids.month}
      @keydown=${this.#onGridKey}
    >
      <thead>
        <tr>
          ${[0, 1, 2, 3, 4, 5, 6].map(
            (i) => html`<th scope="col" abbr=${weekdayLong.format(dayDate(monday + i))}>${weekdayFmt.format(dayDate(monday + i))}</th>`,
          )}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (r) => html`<tr>
            ${[0, 1, 2, 3, 4, 5, 6].map((c) => {
              const n = gridStart + r * 7 + c;
              if (ymd(n).m !== m) return html`<td></td>`;
              const edge = n === this._start || n === this._end;
              const inRange = lo !== null && hi !== null && n >= lo && n <= hi;
              return html`<td
                class=${classMap({ day: true, edge, 'in-range': inRange && !edge, today: n === today })}
                data-day=${isoDay(n)}
                tabindex=${n === f ? 0 : -1}
                aria-selected=${inRange || edge ? 'true' : 'false'}
                aria-current=${ifDefined(n === today ? 'date' : undefined)}
                aria-label=${this.#formatDay(n, true)}
                @click=${() => {
                  this.#pick(n);
                  this.#focusCell();
                }}
              ><span>${dayFmt.format(dayDate(n))}</span></td>`;
            })}
          </tr>`,
        )}
      </tbody>
    </table>`;
  }

  override render() {
    const presets = this.#presets;
    const v = this.value;
    const text = this.displayText;
    const disabled = this.isDisabled;
    const invalid = !!this.errorText;
    const monthLabel = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dayDate(this._focusDay));
    const zone = this.#zoneLabel(this.#now);
    const problem = this.#draftProblem;
    const startOk = !!normaliseTime(this._startTime);
    const endOk = !!normaliseTime(this._endTime);
    const status = problem ?? (this._start === null ? s('pickStart') : this._end === null ? s('pickEnd') : '');

    return html`
      <div class="field" @click=${(e: Event) => (e.target as Element).closest?.('.label') && this._trigger.focus()}>
      ${this.label ? this.renderLabel(false) : nothing}
      <button
        part="trigger"
        class=${classMap({ trigger: true, box: true, invalid, disabled })}
        type="button"
        data-anchor
        popovertarget=${this.#ids.pop}
        aria-haspopup="dialog"
        aria-expanded=${this._open ? 'true' : 'false'}
        aria-labelledby=${this.label ? `${this.ids.label} ${this.#ids.value}` : this.#ids.value}
        aria-describedby=${ifDefined(this.describedBy())}
        aria-invalid=${invalid ? 'true' : 'false'}
        ?disabled=${disabled}
      >
        <mm-icon name="calendar-month"></mm-icon>
        <span class="text" id=${this.#ids.value}
          >${text
            ? text
            : html`<span class="placeholder">${this.placeholder || s('chooseTimeRange')}</span>`}</span
        >
        <mm-icon name="expand-more"></mm-icon>
      </button>
      ${this.renderMessages()}
      </div>

      <div
        part="popover"
        class="pop"
        id=${this.#ids.pop}
        popover="auto"
        role="dialog"
        aria-label=${this.label || s('chooseTimeRange')}
        @beforetoggle=${this.#onBeforeToggle}
        @toggle=${this.#onToggle}
        @keydown=${this.#onPopKey}
      >
        <div class="body">
          <div class="presets" part="presets" role="group" aria-labelledby="${this.#ids.pop}-rel" @keydown=${this.#onPresetKey}>
            <p class="heading" id="${this.#ids.pop}-rel">${s('relativeRange')}</p>
            ${presets.map(
              (p, i) => html`<button
                class="preset"
                type="button"
                tabindex=${i === this._presetIndex ? 0 : -1}
                aria-pressed=${v?.kind === 'relative' && v.preset === p.key ? 'true' : 'false'}
                @click=${() => {
                  this._presetIndex = i;
                  this.#commit({ kind: 'relative', preset: p.key });
                }}
              >
                <span>${p.label}</span><mm-icon class="tick" name="check"></mm-icon>
              </button>`,
            )}
          </div>
          <div class="custom">
            <p class="heading">${t('customRange')}</p>
            <div class="month">
              <mm-button variant="ghost" size="sm" icon="chevron-left" label=${s('previousMonth')} @click=${() => this.#shiftMonth(-1)}></mm-button>
              <div class="month-name" id=${this.#ids.month} aria-live="polite">${monthLabel}</div>
              <mm-button variant="ghost" size="sm" icon="chevron-right" label=${s('nextMonth')} @click=${() => this.#shiftMonth(1)}></mm-button>
            </div>
            ${this._open ? this.#renderGrid() : nothing}
            <div class="times">
              <span class="k">${s('start')}</span>
              <span class="d ${this._start === null ? 'empty' : ''}">${this._start === null ? '-' : this.#formatDay(this._start)}</span>
              <span class="time"
                ><input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  spellcheck="false"
                  maxlength="5"
                  aria-label="${s('startTime')} (${zone})"
                  aria-invalid=${startOk ? 'false' : 'true'}
                  aria-describedby=${this.#ids.status}
                  .value=${this._startTime}
                  @focus=${(e: Event) => (e.target as HTMLInputElement).select()}
                  @input=${(e: Event) => this.#onTime('start', e)}
                  @blur=${(e: Event) => this.#onTimeBlur('start', e)}
                  @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.#apply()}
              /></span>
              <span class="zone-tag">${zone}</span>
              <span class="k">${s('end')}</span>
              <span class="d ${this._end === null ? 'empty' : ''}">${this._end === null ? '-' : this.#formatDay(this._end)}</span>
              <span class="time"
                ><input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  spellcheck="false"
                  maxlength="5"
                  aria-label="${s('endTime')} (${zone})"
                  aria-invalid=${endOk ? 'false' : 'true'}
                  aria-describedby=${this.#ids.status}
                  .value=${this._endTime}
                  @focus=${(e: Event) => (e.target as HTMLInputElement).select()}
                  @input=${(e: Event) => this.#onTime('end', e)}
                  @blur=${(e: Event) => this.#onTimeBlur('end', e)}
                  @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.#apply()}
              /></span>
              <span class="zone-tag">${zone}</span>
            </div>
            <p class="status ${problem ? 'bad' : ''}" id=${this.#ids.status} aria-live="polite">
              ${problem ? html`<mm-icon name="error" size="14"></mm-icon>` : nothing}<span>${status}</span>
            </p>
          </div>
        </div>
        <div class="foot">
          <mm-button variant="secondary" size="sm" class="cancel" @click=${() => this.#close()}>${t('cancel')}</mm-button>
          <mm-button variant="primary" size="sm" class="apply" ?disabled=${!this.#canApply} @click=${() => this.#apply()}>${t('apply')}</mm-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-date-range-picker': MmDateRangePicker;
  }
}
