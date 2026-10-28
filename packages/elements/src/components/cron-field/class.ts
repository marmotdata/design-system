import { css, html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { PropertyValues } from 'lit';
import { base } from '../../core/styles.js';
import { rovingKeydown, isRtl } from '../../core/roving.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import { MmFieldControl, fieldStyles, type ValidityResult } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

/* ------------------------------------------------------------------------------------------------
 * Cron parser. Five fields (minute hour day-of-month month day-of-week), with *, lists, ranges,
 * steps, month and day names, and the @hourly, @daily, @weekly, @monthly and @yearly macros.
 * All times are UTC.
 * ---------------------------------------------------------------------------------------------- */

export interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  /** 0 is Sunday. */
  dayOfWeek: number[];
  /** The five expanded source fields (macros resolved). */
  source: [string, string, string, string, string];
  /** True when the day-of-month field starts with `*` (unrestricted for the either/or day rule). */
  domStar: boolean;
  dowStar: boolean;
}

export type CronParseResult = { ok: true; fields: CronFields } | { ok: false; error: string };

export const CRON_MACROS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: string[];
  /** Value of names[0]. */
  nameBase?: number;
  hint: string;
}

const SPECS: FieldSpec[] = [
  { name: 'Minute', min: 0, max: 59, hint: 'use 0 to 59' },
  { name: 'Hour', min: 0, max: 23, hint: 'use 0 to 23' },
  { name: 'Day of month', min: 1, max: 31, hint: 'use 1 to 31' },
  { name: 'Month', min: 1, max: 12, names: MONTH_NAMES, nameBase: 1, hint: 'use 1 to 12 or JAN to DEC' },
  { name: 'Day of week', min: 0, max: 7, names: DAY_NAMES, nameBase: 0, hint: 'use 0 to 7 or SUN to SAT' },
];

class CronError extends Error {}

function parseAtom(tok: string, spec: FieldSpec): number {
  let v: number | undefined;
  if (/^\d+$/.test(tok)) v = Number(tok);
  else if (spec.names) {
    const i = spec.names.indexOf(tok.toUpperCase());
    if (i >= 0) v = i + (spec.nameBase ?? 0);
  }
  if (v === undefined) {
    const kind = spec.names ? (spec.names === MONTH_NAMES ? 'a number or a month name such as JAN' : 'a number or a day name such as MON') : 'a number';
    throw new CronError(`${spec.name} “${tok}” is not ${kind}.`);
  }
  if (v < spec.min || v > spec.max) throw new CronError(`${spec.name} ${v} is out of range; ${spec.hint}.`);
  return v;
}

function parseField(raw: string, spec: FieldSpec): number[] {
  const out = new Set<number>();
  for (const item of raw.split(',')) {
    if (!item) throw new CronError(`${spec.name} has an empty list item; remove the extra comma.`);
    const parts = item.split('/');
    if (parts.length > 2) throw new CronError(`${spec.name} “${item}” has more than one step.`);
    const [range, stepRaw] = parts as [string, string | undefined];
    let step = 1;
    if (stepRaw !== undefined) {
      if (!/^\d+$/.test(stepRaw)) throw new CronError(`${spec.name} step “${stepRaw}” is not a whole number.`);
      step = Number(stepRaw);
      if (step < 1) throw new CronError(`${spec.name} step must be at least 1.`);
    }
    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = spec.min;
      hi = spec === SPECS[4] ? 6 : spec.max;
    } else if (range.includes('-')) {
      const bits = range.split('-');
      if (bits.length !== 2 || !bits[0] || !bits[1]) throw new CronError(`${spec.name} range “${range}” needs a start and an end, such as 1-5.`);
      lo = parseAtom(bits[0], spec);
      hi = parseAtom(bits[1], spec);
      if (lo > hi) throw new CronError(`${spec.name} range ${range} runs backwards; write the smaller value first.`);
    } else {
      lo = parseAtom(range, spec);
      hi = stepRaw !== undefined ? spec.max : lo;
    }
    for (let v = lo; v <= hi; v += step) out.add(spec === SPECS[4] ? v % 7 : v);
  }
  return [...out].sort((a, b) => a - b);
}

/** Parses a five-field cron expression or macro. Errors are full sentences saying what to fix. */
export function parseCron(expr: string): CronParseResult {
  let text = (expr ?? '').trim();
  if (!text) return { ok: false, error: 'Enter a cron expression, such as 0 2 * * *.' };
  if (text.startsWith('@')) {
    const m = CRON_MACROS[text.toLowerCase()];
    if (!m) return { ok: false, error: `${text} is not a supported macro; use @hourly, @daily, @weekly, @monthly or @yearly.` };
    text = m;
  }
  const raw = text.split(/\s+/);
  if (raw.length !== 5) {
    const extra = raw.length === 6 ? ' Seconds are not supported.' : '';
    return { ok: false, error: `Expected 5 fields (minute hour day-of-month month day-of-week) but found ${raw.length}.${extra}` };
  }
  try {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = raw.map((r, i) => parseField(r, SPECS[i]!)) as [number[], number[], number[], number[], number[]];
    return {
      ok: true,
      fields: {
        minute,
        hour,
        dayOfMonth,
        month,
        dayOfWeek,
        source: raw as CronFields['source'],
        domStar: raw[2]!.startsWith('*'),
        dowStar: raw[4]!.startsWith('*'),
      },
    };
  } catch (e) {
    if (e instanceof CronError) return { ok: false, error: e.message };
    throw e;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const listFmt = (items: string[]) => (items.length < 2 ? (items[0] ?? '') : new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(items));
const dayName = (d: number) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(2023, 0, 1 + d));
const monthName = (m: number) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2023, m - 1, 1));

/** [1,2,3,4,9] → "1 to 4 and 9". */
function compress(nums: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++;
    if (j - i >= 2) parts.push(`${nums[i]} to ${nums[j]}`);
    else for (let k = i; k <= j; k++) parts.push(String(nums[k]));
    i = j + 1;
  }
  return listFmt(parts);
}
const contiguous = (nums: number[]) => nums.every((n, i) => i === 0 || n === nums[i - 1]! + 1);

/** Describes an expression in words, in UTC: "Every day at 02:00 UTC". Returns '' when invalid. */
export function describeCron(expr: string): string {
  const r = parseCron(expr);
  if (!r.ok) return '';
  const f = r.fields;
  const { minute: m, hour: h } = f;
  const allMin = m.length === 60;
  const allHour = h.length === 24;
  const minStep = /^\*\/(\d+)$/.exec(f.source[0]);
  const hourStep = /^\*\/(\d+)$/.exec(f.source[1]);
  const minutesPhrase = m.length === 1 ? `minute ${m[0]}` : `minutes ${compress(m)}`;

  let kind: 'at' | 'freq' = 'freq';
  let time: string;
  if (allMin && allHour) time = 'Every minute';
  else if (minStep && allHour) time = `Every ${minStep[1]} minutes`;
  else if (allHour) time = `Every hour at ${minutesPhrase}`;
  else if (hourStep && m.length === 1) time = `Every ${hourStep[1]} hours at minute ${m[0]}`;
  else if (m.length * h.length <= 4) {
    kind = 'at';
    time = `${listFmt(h.flatMap((hh) => m.map((mm) => `${pad(hh)}:${pad(mm)}`)))} UTC`;
  } else if ((allMin || minStep) && contiguous(h)) {
    time = `Every ${allMin ? 'minute' : `${minStep![1]} minutes`} from ${pad(h[0]!)}:00 to ${pad(h[h.length - 1]!)}:59 UTC`;
  } else time = `At ${minutesPhrase} past hours ${compress(h)} UTC`;

  const domAll = f.dayOfMonth.length === 31;
  const dowAll = f.dayOfWeek.length === 7;
  const monthAll = f.month.length === 12;
  const months = listFmt(f.month.map(monthName));
  const weekdays = f.dayOfWeek.join() === '1,2,3,4,5';
  const days = listFmt(f.dayOfWeek.map(dayName));
  const dom = compress(f.dayOfMonth);

  if (kind === 'at') {
    const inMonths = monthAll ? '' : ` in ${months}`;
    if (domAll && dowAll) return `Every day at ${time}${inMonths}`;
    if (domAll) return `Every ${weekdays ? 'weekday' : days} at ${time}${inMonths}`;
    const ofMonths = monthAll ? 'every month' : months;
    if (dowAll) return `On day ${dom} of ${ofMonths} at ${time}`;
    return `On day ${dom} of ${ofMonths} and every ${days} at ${time}`;
  }
  let out = time;
  if (!dowAll && domAll) out += weekdays ? ' on weekdays' : ` on ${days}`;
  else if (!domAll && dowAll) out += ` on day ${dom} of the month`;
  else if (!domAll && !dowAll) out += ` on day ${dom} of the month or on ${days}`;
  if (!monthAll) out += ` in ${months}`;
  return out;
}

/** The next `count` run times strictly after `from`, in UTC. Empty when the expression is invalid. */
export function nextRuns(expr: string, from: Date | number | string = Date.now(), count = 5): Date[] {
  const r = parseCron(expr);
  if (!r.ok) return [];
  const f = r.fields;
  const start = Math.floor(new Date(from).getTime() / 60_000) * 60_000 + 60_000;
  const s = new Date(start);
  const months = new Set(f.month);
  const doms = new Set(f.dayOfMonth);
  const dows = new Set(f.dayOfWeek);
  const out: Date[] = [];
  // Eight years covers 29 February and other rare matches.
  for (let i = 0; i < 366 * 8 && out.length < count; i++) {
    const day = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + i));
    if (!months.has(day.getUTCMonth() + 1)) continue;
    const domHit = doms.has(day.getUTCDate());
    const dowHit = dows.has(day.getUTCDay());
    const hit = f.domStar && f.dowStar ? true : f.domStar ? dowHit : f.dowStar ? domHit : domHit || dowHit;
    if (!hit) continue;
    for (const hh of f.hour) {
      for (const mm of f.minute) {
        const at = day.getTime() + hh * 3_600_000 + mm * 60_000;
        if (at >= start) {
          out.push(new Date(at));
          if (out.length === count) return out;
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------ */

export interface CronPreset {
  id: 'hourly' | 'daily' | 'weekly' | 'custom';
  expression: string;
}
const PRESETS: CronPreset[] = [
  { id: 'hourly', expression: '0 * * * *' },
  { id: 'daily', expression: '0 2 * * *' },
  { id: 'weekly', expression: '0 2 * * 1' },
  { id: 'custom', expression: '' },
];

const STR = {
  presets: () => tr('cronPresets', 'Schedule presets'),
  hourly: () => tr('cronHourly', 'Hourly'),
  daily: () => tr('cronDaily', 'Daily at 02:00'),
  weekly: () => tr('cronWeekly', 'Weekly on Monday'),
  custom: () => tr('cronCustom', 'Custom'),
  nextRuns: () => tr('cronNextRuns', 'Next runs (UTC)'),
  noRuns: () => tr('cronNoRuns', 'Enter a valid expression to see the next runs.'),
  required: () => tr('cronRequired', 'Enter a cron expression.'),
  expression: () => tr('cronExpression', 'Cron expression'),
};

export interface CronChangeDetail {
  value: string;
  valid: boolean;
  description: string;
}

/**
 * Cron fields set a schedule, as on the pipeline schedule step. Pick a preset (Hourly, Daily at
 * 02:00, Weekly on Monday) or choose Custom and type a five-field expression in mono. The helper
 * line says what the expression means in words ("Every day at 02:00 UTC"), syntax errors say
 * exactly what to fix, and the next five run times are listed in UTC so there is no doubt about when
 * a pipeline will run.
 *
 * The presets are a radio group (https://www.w3.org/WAI/ARIA/apg/patterns/radio/): arrow keys move
 * and select, Home and End jump to the ends, and Enter or Space on Custom moves focus to the
 * expression. In the expression, Enter commits the value.
 *
 * @tagname mm-cron-field
 * @summary A cron expression field with presets, a plain-English description and the next runs.
 * @csspart presets - The preset radio group.
 * @csspart control - The bordered input wrapper.
 * @csspart input - The native text input.
 * @csspart description - The description line.
 * @csspart runs - The list of upcoming runs.
 * @fires mm-input - {{ value: string }} On every keystroke in the expression.
 * @fires mm-change - {CronChangeDetail} When the value is committed: a preset is chosen, Enter is pressed or the field loses focus after an edit.
 * @fires change - Native change event, re-dispatched from the host on commit.
 */
export class MmCronField extends MmFieldControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
        color: var(--mm-text);
        font: var(--text-dense);
      }
      .desc {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      .desc:empty {
        display: none;
      }
      .presets {
        display: inline-flex;
        flex-wrap: wrap;
        justify-self: start;
        max-width: 100%;
        padding: 2px;
        gap: 2px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-md);
      }
      .preset {
        height: 26px;
        min-width: 24px;
        padding: 0 10px;
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text-2);
        font: var(--text-label);
        white-space: nowrap;
        cursor: pointer;
        /* No transition: preset changes come from arrow keys, and keyboard actions are instant. */
      }
      .preset:hover {
        color: var(--mm-text);
        background: var(--mm-sunken);
      }
      .preset[aria-checked='true'] {
        background: var(--mm-text);
        color: var(--mm-on-inverse);
      }
      .preset:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .runs {
        margin-top: var(--space-2);
        display: grid;
        gap: var(--space-1);
      }
      ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 2px;
      }
      li {
        display: flex;
        gap: var(--space-2);
        align-items: baseline;
      }
      .dow {
        font: var(--text-caption);
        color: var(--mm-text-2);
        min-width: 3.5ch;
      }
      time {
        font: var(--text-caption);
        font-variant-numeric: tabular-nums;
        unicode-bidi: isolate;
        direction: ltr;
      }
      .muted {
        font: var(--text-caption);
        color: var(--mm-text-2);
        margin: 0;
      }
    `,
  ];

  /** The cron expression, five fields or a macro such as `@daily`. */
  @property() accessor value = '';
  @property() accessor placeholder = '0 2 * * *';
  /** Hides the preset radio group. */
  @property({ type: Boolean, attribute: 'hide-presets' }) accessor hidePresets = false;
  /** Number of upcoming runs listed. */
  @property({ type: Number, attribute: 'run-count' }) accessor runCount = 5;
  /** Reference time for upcoming runs (ISO string, Date or epoch ms). Defaults to the current time. */
  @property({ attribute: 'now' }) accessor now: string | number | Date | undefined;

  @query('input') accessor #input!: HTMLInputElement;

  #runsId = uid('mm-runs');
  #default: string | undefined;
  #custom = false;
  #typing = false;
  #committed = '';

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.#default === undefined) {
      this.#default = this.value;
      this.#committed = this.value;
    }
  }

  /** The expression in words, or '' when it is invalid. */
  get description(): string {
    return describeCron(this.value);
  }

  formResetCallback(): void {
    this.value = this.#default ?? '';
    this.#committed = this.value;
    this.#custom = false;
    this.#typing = false;
    this.resetField();
  }

  formStateRestoreCallback(state: string | null): void {
    this.value = state ?? '';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const v = this.value.trim();
    this.setFormValue(v ? v : null, this.value);
    // A value set from outside (attribute, property, preset) is shown with its error straight away.
    if (changed.has('value') && !this.#typing && v) this.touched = true;
  }

  protected override computeValidity(): ValidityResult {
    const v = this.value.trim();
    if (!v) return this.required ? { flags: { valueMissing: true }, message: STR.required() } : { flags: {}, message: '' };
    const parsed = parseCron(v);
    return parsed.ok ? { flags: {}, message: '' } : { flags: { badInput: true }, message: parsed.error };
  }

  /** Syntax errors wait until the value is committed, so they never flash while typing. */
  protected override get errorText(): string {
    return this.#typing ? this.error : super.errorText;
  }

  #checkedPreset(): CronPreset['id'] {
    if (this.#custom) return 'custom';
    const v = this.value.trim().replace(/\s+/g, ' ');
    return PRESETS.find((p) => p.id !== 'custom' && p.expression === v)?.id ?? 'custom';
  }

  #commit() {
    this.#typing = false;
    this.touched = true;
    this.requestUpdate();
    if (this.value === this.#committed) return;
    this.#committed = this.value;
    this.emitChange<CronChangeDetail>({ value: this.value, valid: parseCron(this.value).ok, description: this.description });
  }

  #choose(p: CronPreset, focusInput: boolean) {
    if (this.isDisabled) return;
    if (p.id === 'custom') {
      this.#custom = true;
      this.requestUpdate();
      if (focusInput) this.updateComplete.then(() => this.#input?.focus());
      return;
    }
    this.#custom = false;
    this.value = p.expression;
    this.#commit();
  }

  #onPresetKey = (e: KeyboardEvent) => {
    const items = [...this.renderRoot.querySelectorAll<HTMLElement>('.preset')];
    const current = items.indexOf(e.target as HTMLElement);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#choose(PRESETS[current]!, true);
      return;
    }
    const next = rovingKeydown(e, items, current, { orientation: 'both', rtl: isRtl(this) });
    if (next !== null) this.#choose(PRESETS[next]!, false);
  };

  #onInput = (e: Event) => {
    this.#typing = true;
    this.#custom = false;
    this.value = (e.target as HTMLInputElement).value;
    this.emitInput({ value: this.value });
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.#commit();
    }
  };

  override render() {
    const disabled = this.isDisabled;
    const err = this.errorText;
    const desc = this.#typing && !parseCron(this.value).ok ? '' : this.description;
    const checked = this.#checkedPreset();
    const runs = this.value.trim() ? nextRuns(this.value, this.now ?? Date.now(), this.runCount) : [];
    const dow = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

    return html`<div class="field">
      ${this.label ? this.renderLabel() : nothing}
      ${this.hidePresets
        ? nothing
        : html`<div part="presets" class="presets" role="radiogroup" aria-label="${this.label ? `${this.label}: ` : ''}${STR.presets()}" @keydown=${this.#onPresetKey}>
            ${PRESETS.map(
              (p) => html`<button
                type="button"
                class="preset"
                role="radio"
                aria-checked=${p.id === checked ? 'true' : 'false'}
                tabindex=${p.id === checked ? 0 : -1}
                ?disabled=${disabled}
                @click=${() => this.#choose(p, true)}
              >
                ${STR[p.id]()}
              </button>`,
            )}
          </div>`}
      <div part="control" class="box mono ${err ? 'invalid' : ''} ${disabled ? 'disabled' : ''}">
        <mm-icon name="schedule"></mm-icon>
        <input
          part="input"
          class="input"
          id=${this.ids.control}
          data-anchor
          type="text"
          dir="ltr"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          .value=${live(this.value)}
          placeholder=${this.placeholder}
          ?disabled=${disabled}
          ?required=${this.required}
          aria-invalid=${err ? 'true' : 'false'}
          aria-label=${ifDefined(this.label ? undefined : STR.expression())}
          aria-describedby=${ifDefined(this.describedBy(desc ? this.ids.desc : undefined))}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
          @change=${(e: Event) => e.stopPropagation()}
          @blur=${() => this.#commit()}
        />
      </div>
      <p part="description" class="desc" id=${this.ids.desc} aria-live="polite">${desc}</p>
      ${this.renderMessages()}
      <div part="runs" class="runs">
        <span class="label" id=${this.#runsId}>${STR.nextRuns()}</span>
        ${runs.length
          ? html`<ol aria-labelledby=${this.#runsId}>
              ${runs.map((d) => {
                const iso = d.toISOString();
                return html`<li><span class="dow">${dow.format(d)}</span><time datetime=${iso}>${iso.slice(0, 16).replace('T', ' ')}</time></li>`;
              })}
            </ol>`
          : html`<p class="muted">${STR.noRuns()}</p>`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-cron-field': MmCronField;
  }
}
