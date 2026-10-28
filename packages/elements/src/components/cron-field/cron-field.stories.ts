import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/cron-field.js';
import { describeCron, nextRuns, parseCron } from './class.ts';

// Fixed reference time so upcoming runs are deterministic: Tuesday 27 October 2026, 09:14 UTC.
const NOW = '2026-10-27T09:14:00Z';

type Args = { value: string; label: string; help: string; error: string; required: boolean; disabled: boolean; hidePresets: boolean };

const meta: Meta<Args> = {
  title: 'Components/Forms/Cron field',
  component: 'mm-cron-field',
  args: { value: '0 2 * * *', label: 'Schedule', help: 'Runs of orders_daily start within a minute of the scheduled time.', error: '', required: false, disabled: false, hidePresets: false },
  render: (a) => html`<div style="max-width:28rem">
    <mm-cron-field
      name="schedule"
      now=${NOW}
      .value=${a.value}
      label=${a.label}
      help=${a.help}
      error=${a.error}
      ?required=${a.required}
      ?disabled=${a.disabled}
      ?hide-presets=${a.hidePresets}
    ></mm-cron-field>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-cron-field name="schedule" label="Schedule" value="0 2 * * *"></mm-cron-field>`,
      react: `import { MmCronField } from '@marmotdata/react';

<MmCronField
  name="schedule"
  label="Schedule"
  value={schedule}
  onMmChange={(e) => setSchedule(e.detail.value)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/cron-field.js';
  let schedule = $state('0 2 * * *');
</script>

<mm-cron-field
  name="schedule"
  label="Schedule"
  value={schedule}
  onmm-change={(e) => (schedule = e.detail.value)}
></mm-cron-field>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const field = (root: HTMLElement) => root.querySelector('mm-cron-field')!;
const sr = (root: HTMLElement) => field(root).shadowRoot!;
const radios = (root: HTMLElement) => [...sr(root).querySelectorAll<HTMLButtonElement>('[role=radio]')];
const checked = (root: HTMLElement) => radios(root).find((r) => r.getAttribute('aria-checked') === 'true')!.textContent!.trim();
const desc = (root: HTMLElement) => sr(root).querySelector('.desc')!.textContent!.trim();
const settle = (root: HTMLElement) => field(root).updateComplete;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(desc(canvasElement)).toBe('Every day at 02:00 UTC');
    await expect(checked(canvasElement)).toBe('Daily at 02:00');
    const times = [...sr(canvasElement).querySelectorAll('time')].map((t) => t.textContent);
    await expect(times).toEqual(['2026-10-28 02:00', '2026-10-29 02:00', '2026-10-30 02:00', '2026-10-31 02:00', '2026-11-01 02:00']);
  },
};
export const Custom: Story = { args: { value: '*/15 9-17 * * MON-FRI' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(radios(canvasElement)[1]);
    await tab();
    await expect(deepActive()).toBe(sr(canvasElement).querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { value: '', help: '' } };
export const Required: Story = { args: { value: '', required: true } };
export const ErrorState: Story = {
  name: 'Error',
  args: { value: '0 24 * * *' },
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const el = field(canvasElement);
    await expect(sr(canvasElement).querySelector('.error')!.textContent!.trim()).toBe('Hour 24 is out of range; use 0 to 23.');
    await expect(el.validity.badInput).toBe(true);
    await expect(sr(canvasElement).querySelector('input')).toHaveAttribute('aria-invalid', 'true');
  },
};
export const ServerError: Story = { args: { error: 'The Snowflake warehouse is suspended between 01:00 and 03:00 UTC. Choose another time.' } };
export const Macro: Story = { args: { value: '@weekly' } };
export const NoPresets: Story = { args: { hidePresets: true, value: '30 6 1 * *' } };
export const Loading: Story = {
  name: 'Loading (not applicable)',
  args: { help: 'The cron field parses locally and never loads; the runs list updates as you type.' },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="max-width:20rem">
    <mm-cron-field
      label="Schedule for mrn://snowflake/table/analytics.marts.customers_dim_snapshot_daily"
      now=${NOW}
      value="0,5,10,15,20,25,30,35,40,45,50,55 0-23/2 1,15 JAN-MAR,JUL-SEP MON-FRI"
    ></mm-cron-field>
  </div>`,
};
export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<div style="max-width:24rem">
    <mm-cron-field label="Schedule" help="Pipeline: shop_orders_v2_to_snowflake_analytics_marts_incremental_backfill" now=${NOW} value="0 2 29 2 *"></mm-cron-field>
  </div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'الجدول', help: '' } };
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-6)">
      <mm-cron-field label="Schedule" now=${NOW} value="0 2 * * 1"></mm-cron-field>
      <mm-cron-field label="Schedule" now=${NOW} value="0 2 * * 8"></mm-cron-field>
    </div>`),
};

/* ---------------------------------------------------------------- keyboard and form behaviour */

const onChange = fn();
const onInput = fn();

export const KeyboardPresets: Story = {
  name: 'Keyboard: presets radio group',
  render: () => html`<mm-cron-field label="Schedule" now=${NOW} value="0 2 * * *" @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}></mm-cron-field>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const el = field(canvasElement);
    const r = radios(canvasElement);
    await tab();
    await expect(deepActive()).toBe(r[1]);
    await press('{ArrowRight}');
    await settle(canvasElement);
    await expect(deepActive()).toBe(r[2]);
    await expect(el.value).toBe('0 2 * * 1');
    await expect(desc(canvasElement)).toBe('Every Monday at 02:00 UTC');
    await expect(onChange).toHaveBeenLastCalledWith('0 2 * * 1');
    await press('{ArrowDown}');
    await settle(canvasElement);
    await expect(checked(canvasElement)).toBe('Custom');
    await expect(el.value).toBe('0 2 * * 1');
    await press('{ArrowRight}');
    await settle(canvasElement);
    await expect(checked(canvasElement)).toBe('Hourly');
    await expect(el.value).toBe('0 * * * *');
    await press('{ArrowLeft}');
    await settle(canvasElement);
    await expect(checked(canvasElement)).toBe('Custom');
    await press('{Home}');
    await settle(canvasElement);
    await expect(checked(canvasElement)).toBe('Hourly');
    await expect(desc(canvasElement)).toBe('Every hour at minute 0');
    await press('{End}');
    await settle(canvasElement);
    await press('{Enter}');
    await settle(canvasElement);
    await expect(deepActive()).toBe(sr(canvasElement).querySelector('input'));
    await tab(true);
    await expect(deepActive()).toBe(r[3]);
    await press('{ArrowUp}');
    await press('{Space}');
    await settle(canvasElement);
    await expect(el.value).toBe('0 2 * * 1');
  },
};

export const KeyboardRtl: Story = {
  name: 'Keyboard: arrows flip in right to left',
  parameters: { dir: 'rtl' },
  render: () => html`<mm-cron-field label="Schedule" now=${NOW} value="0 * * * *"></mm-cron-field>`,
  play: async ({ canvasElement }) => {
    await tab();
    await press('{ArrowLeft}');
    await settle(canvasElement);
    await expect(checked(canvasElement)).toBe('Daily at 02:00');
  },
};

export const KeyboardTyping: Story = {
  name: 'Keyboard: type an expression and commit with Enter',
  render: () =>
    html`<mm-cron-field
      label="Schedule"
      now=${NOW}
      value="0 2 * * *"
      @mm-change=${(e: CustomEvent) => onChange(e.detail)}
      @mm-input=${(e: CustomEvent) => onInput(e.detail.value)}
    ></mm-cron-field>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    onInput.mockClear();
    const el = field(canvasElement);
    const input = sr(canvasElement).querySelector('input')!;
    await tab();
    await tab();
    await expect(deepActive()).toBe(input);
    await press('{Control>}a{/Control}{Backspace}');
    await press('*/15 * * * *');
    await expect(onInput).toHaveBeenLastCalledWith('*/15 * * * *');
    await expect(onChange).not.toHaveBeenCalled();
    await press('{Enter}');
    await settle(canvasElement);
    await expect(onChange).toHaveBeenCalledWith({ value: '*/15 * * * *', valid: true, description: 'Every 15 minutes' });
    await expect(desc(canvasElement)).toBe('Every 15 minutes');
    await expect(sr(canvasElement).querySelector('time')!.textContent).toBe('2026-10-27 09:15');
    await expect(checked(canvasElement)).toBe('Custom');

    // An invalid expression shows its error only once committed.
    await press('{Control>}a{/Control}{Backspace}');
    await press('0 24 * * *');
    await settle(canvasElement);
    await expect(sr(canvasElement).querySelector('.error')).toBeNull();
    await press('{Enter}');
    await settle(canvasElement);
    await expect(sr(canvasElement).querySelector('.error')!.textContent!.trim()).toBe('Hour 24 is out of range; use 0 to 23.');
    await expect(el.checkValidity()).toBe(false);
  },
};

const onSubmit = fn();
export const FormSubmissionAndReset: Story = {
  name: 'Form: submits, validates and resets',
  render: () => html`<form
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(new FormData(e.target as HTMLFormElement).get('schedule'));
    }}
  >
    <mm-cron-field name="schedule" label="Schedule" now=${NOW} value="0 2 * * *" required></mm-cron-field>
    <button type="submit">Save schedule</button>
    <button type="reset">Reset</button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = field(canvasElement);
    await settle(canvasElement);
    await expect(new FormData(form).get('schedule')).toBe('0 2 * * *');
    await tab();
    await press('{ArrowLeft}');
    await settle(canvasElement);
    await expect(new FormData(form).get('schedule')).toBe('0 * * * *');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith('0 * * * *');

    form.reset();
    await settle(canvasElement);
    await expect(el.value).toBe('0 2 * * *');
    await expect(checked(canvasElement)).toBe('Daily at 02:00');

    el.value = '';
    await settle(canvasElement);
    await expect(el.validity.valueMissing).toBe(true);
    await expect(form.checkValidity()).toBe(false);
    await settle(canvasElement);
    await expect(sr(canvasElement).querySelector('.error')!.textContent!.trim()).toBe('Enter a cron expression.');
    form.reset();
    await settle(canvasElement);
  },
};

export const FieldsetDisabled: Story = {
  name: 'Form: disabled fieldset excludes the value',
  render: () => html`<form>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <legend style="font:var(--text-label);color:var(--mm-text-2)">Pipeline schedule</legend>
      <mm-cron-field name="schedule" label="Schedule" now=${NOW} value="0 2 * * *"></mm-cron-field>
    </fieldset>
  </form>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(new FormData(canvasElement.querySelector('form')!).get('schedule')).toBeNull();
    for (const r of radios(canvasElement)) await expect(r).toBeDisabled();
    await expect(sr(canvasElement).querySelector('input')).toBeDisabled();
  },
};

export const Parser: Story = {
  name: 'Parser, description and next runs',
  play: async () => {
    const err = (e: string) => {
      const r = parseCron(e);
      return r.ok ? '' : r.error;
    };
    await expect(err('0 2 * *')).toBe('Expected 5 fields (minute hour day-of-month month day-of-week) but found 4.');
    await expect(err('0 0 2 * * *')).toBe('Expected 5 fields (minute hour day-of-month month day-of-week) but found 6. Seconds are not supported.');
    await expect(err('0 24 * * *')).toBe('Hour 24 is out of range; use 0 to 23.');
    await expect(err('60 * * * *')).toBe('Minute 60 is out of range; use 0 to 59.');
    await expect(err('0 0 0 * *')).toBe('Day of month 0 is out of range; use 1 to 31.');
    await expect(err('0 0 * 13 *')).toBe('Month 13 is out of range; use 1 to 12 or JAN to DEC.');
    await expect(err('0 0 * * MOO')).toBe('Day of week “MOO” is not a number or a day name such as MON.');
    await expect(err('*/0 * * * *')).toBe('Minute step must be at least 1.');
    await expect(err('0 17-9 * * *')).toBe('Hour range 17-9 runs backwards; write the smaller value first.');
    await expect(err('0,,5 * * * *')).toBe('Minute has an empty list item; remove the extra comma.');
    await expect(err('@fortnightly')).toBe('@fortnightly is not a supported macro; use @hourly, @daily, @weekly, @monthly or @yearly.');
    await expect(err('')).toBe('Enter a cron expression, such as 0 2 * * *.');

    const ok = parseCron('0-10/5 9-17 * JAN,jul mon-fri');
    await expect(ok.ok && ok.fields.minute).toEqual([0, 5, 10]);
    await expect(ok.ok && ok.fields.month).toEqual([1, 7]);
    await expect(ok.ok && ok.fields.dayOfWeek).toEqual([1, 2, 3, 4, 5]);
    const sun = parseCron('0 0 * * 7');
    await expect(sun.ok && sun.fields.dayOfWeek).toEqual([0]);

    await expect(describeCron('0 2 * * *')).toBe('Every day at 02:00 UTC');
    await expect(describeCron('@hourly')).toBe('Every hour at minute 0');
    await expect(describeCron('0 2 * * 1')).toBe('Every Monday at 02:00 UTC');
    await expect(describeCron('*/15 * * * *')).toBe('Every 15 minutes');
    await expect(describeCron('* * * * *')).toBe('Every minute');
    await expect(describeCron('@weekly')).toBe('Every Sunday at 00:00 UTC');
    await expect(describeCron('@monthly')).toBe('On day 1 of every month at 00:00 UTC');
    await expect(describeCron('30 6 * * 1-5')).toBe('Every weekday at 06:30 UTC');
    await expect(describeCron('0 2,14 * * *')).toBe('Every day at 02:00 and 14:00 UTC');
    await expect(describeCron('0 */6 * * *')).toBe('Every 6 hours at minute 0');
    await expect(describeCron('*/15 9-17 * * MON-FRI')).toBe('Every 15 minutes from 09:00 to 17:59 UTC on weekdays');
    await expect(describeCron('0 0 1 1,7 *')).toBe('On day 1 of January and July at 00:00 UTC');
    await expect(describeCron('0 24 * * *')).toBe('');

    const iso = (e: string, n = 5) => nextRuns(e, NOW, n).map((d) => d.toISOString().slice(0, 16));
    await expect(iso('0 2 * * 1', 2)).toEqual(['2026-11-02T02:00', '2026-11-09T02:00']);
    await expect(iso('*/15 * * * *', 3)).toEqual(['2026-10-27T09:15', '2026-10-27T09:30', '2026-10-27T09:45']);
    await expect(iso('@hourly', 1)).toEqual(['2026-10-27T10:00']);
    await expect(iso('0 0 29 2 *', 1)).toEqual(['2028-02-29T00:00']);
    // Day of month and day of week both restricted: either matches (13th of the month or any Friday).
    await expect(iso('0 0 13 * 5', 3)).toEqual(['2026-10-30T00:00', '2026-11-06T00:00', '2026-11-13T00:00']);
    await expect(iso('0 0 31 2 *')).toEqual([]);
    await expect(iso('nope')).toEqual([]);
  },
};

