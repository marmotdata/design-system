import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/date-range-picker.js';
import type { DateRangePreset, DateRangeValue, MmDateRangePicker } from './class.ts';

/** A fixed "now" so stories and tests are deterministic: Tuesday 27 October 2026, 14:00 UTC. */
const NOW = new Date('2026-10-27T14:00:00Z');
const LAST_7: DateRangeValue = { kind: 'relative', preset: 'last-7-days' };
const INCIDENT: DateRangeValue = { kind: 'absolute', start: '2026-10-12T09:00:00.000Z', end: '2026-10-27T17:30:00.000Z' };

type Args = { label: string; help: string; error: string; timeZone: 'UTC' | 'local'; locale: string; disabled: boolean; required: boolean; value: DateRangeValue | null };

const picker = (a: Partial<Args>) => html`<mm-date-range-picker
  name="window"
  label=${a.label ?? 'Run window'}
  help=${a.help ?? ''}
  error=${a.error ?? ''}
  time-zone=${a.timeZone ?? 'UTC'}
  locale=${a.locale ?? 'en-GB'}
  ?disabled=${a.disabled ?? false}
  ?required=${a.required ?? false}
  .now=${NOW}
  .value=${a.value === undefined ? LAST_7 : a.value}
></mm-date-range-picker>`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Date range picker',
  component: 'mm-date-range-picker',
  args: { label: 'Run window', help: 'Pipeline runs that started inside this window are listed.', error: '', timeZone: 'UTC', locale: 'en-GB', disabled: false, required: false, value: LAST_7 },
  argTypes: { timeZone: { control: 'inline-radio', options: ['UTC', 'local'] } },
  render: (a) => picker(a),
  parameters: {
    usage: {
      html: `<mm-date-range-picker name="window" label="Run window" time-zone="UTC"
  value='{"kind":"relative","preset":"last-7-days"}'></mm-date-range-picker>
<!-- Submits window=last-7-days, or window-start and window-end as ISO strings -->`,
      react: `import { MmDateRangePicker } from '@marmotdata/react';

<MmDateRangePicker
  name="window"
  label="Run window"
  timeZone="UTC"
  value={{ kind: 'relative', preset: 'last-7-days' }}
  onMmChange={(e) => setWindow(e.detail.value)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/date-range-picker.js';
  let range = $state({ kind: 'relative', preset: 'last-7-days' });
</script>

<mm-date-range-picker
  name="window"
  label="Run window"
  time-zone="UTC"
  value={range}
  onmm-change={(e) => (range = e.detail.value)}
></mm-date-range-picker>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-date-range-picker')! as MmDateRangePicker;
const trigger = (root: HTMLElement) => host(root).shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!;
const pop = (root: HTMLElement) => host(root).shadowRoot!.querySelector<HTMLElement>('.pop')!;
const focusedDay = () => (deepActive() as HTMLElement | null)?.dataset.day;
/** Text of the focused control; for a focused mm-button, its slotted label. */
const activeText = () => {
  const el = deepActive() as HTMLElement | null;
  const root = el?.getRootNode();
  const owner = root instanceof ShadowRoot && root.host.tagName === 'MM-BUTTON' ? root.host : el;
  return owner?.textContent?.trim();
};
/** Waits out the pointer-open fade so axe measures settled colours. */
const settle = () => new Promise((r) => setTimeout(r, 300));
const isOpen = (root: HTMLElement) => pop(root).matches(':popover-open');

export const Default: Story = {};
export const AbsoluteRange: Story = { name: 'Absolute range', args: { value: INCIDENT, help: 'Times are in UTC.' } };
export const LocalTime: Story = { name: 'Local time zone', args: { value: INCIDENT, timeZone: 'local', help: 'Times are in your browser’s time zone.' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(trigger(canvasElement));
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { value: null, help: 'Choose a window to list pipeline runs.' } };
export const Error: Story = { args: { value: INCIDENT, error: 'Query audit keeps 90 days of history. Choose a start after 29 Jul 2026.' } };
export const Required: Story = {
  args: { value: null, required: true, help: '' },
  play: async ({ canvasElement }) => {
    const el = host(canvasElement);
    await expect(el.checkValidity()).toBe(false);
    await expect(el.validity.valueMissing).toBe(true);
    await expect(el.validationMessage).toBe('Choose a time range.');
  },
};

export const OpenAbsolute: Story = {
  name: 'Open: custom range',
  args: { value: INCIDENT },
  play: async ({ canvasElement }) => {
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    const sr = host(canvasElement).shadowRoot!;
    await expect(sr.querySelectorAll('td[aria-selected="true"]').length).toBe(16);
    await expect(sr.querySelector('td[aria-current="date"]')?.getAttribute('data-day')).toBe('2026-10-27');
    await expect(sr.querySelector('.month-name')?.textContent).toBe('October 2026');
    await settle();
  },
};

export const OpenRelative: Story = {
  name: 'Open: relative presets',
  play: async ({ canvasElement }) => {
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    const pressed = host(canvasElement).shadowRoot!.querySelector('.preset[aria-pressed="true"]');
    await expect(pressed?.textContent?.trim()).toBe('Last 7 days');
    await settle();
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px">${picker({ value: INCIDENT, label: 'Freshness window for mrn://snowflake/table/analytics.marts.orders_daily_rollup' })}</div>`,
};

const longPresets: DateRangePreset[] = [
  { key: 'since-last-success', label: 'Since the last successful run of orders_daily', duration: 19 * 3_600_000 },
  { key: 'last-6-hours', label: 'Last 6 hours', duration: 6 * 3_600_000 },
  { key: 'last-14-days', label: 'Last 14 days', duration: 14 * 86_400_000 },
  { key: 'retention', label: 'Full retention window for shop.orders.v2', duration: 180 * 86_400_000 },
];
export const LongIdentifiers: Story = {
  name: 'Long identifiers (custom presets)',
  render: () => html`<mm-date-range-picker
    name="window"
    label="Lag window"
    .presets=${longPresets}
    .now=${NOW}
    .value=${{ kind: 'relative', preset: 'since-last-success' }}
  ></mm-date-range-picker>`,
  play: async ({ canvasElement }) => {
    await expect(trigger(canvasElement).textContent).toContain('Since the last successful run of orders_daily');
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    await expect(host(canvasElement).shadowRoot!.querySelectorAll('.preset').length).toBe(4);
    await settle();
  },
};

export const Locale: Story = {
  name: 'Locale (French)',
  args: { locale: 'fr-FR', value: INCIDENT, label: 'Fenêtre d’exécution', help: '' },
  play: async ({ canvasElement }) => {
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    await expect(host(canvasElement).shadowRoot!.querySelector('.month-name')?.textContent).toBe('octobre 2026');
    await expect(host(canvasElement).shadowRoot!.querySelector('th')?.getAttribute('abbr')).toBe('lundi');
    await settle();
  },
};

export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { value: INCIDENT, locale: 'ar', label: 'نافذة التشغيل', help: '' },
  play: async ({ canvasElement }) => {
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    await waitFor(() => expect(focusedDay()).toBe('2026-10-12'));
    // RTL flips horizontal arrows: Left moves forward a day.
    await press('{ArrowLeft}');
    await expect(focusedDay()).toBe('2026-10-13');
    await press('{ArrowRight}');
    await expect(focusedDay()).toBe('2026-10-12');
    await settle();
  },
};

export const BothThemes: Story = {
  name: 'Both themes',
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      ${picker({ value: LAST_7 })} ${picker({ value: INCIDENT, label: 'Incident window' })}
      ${picker({ value: INCIDENT, label: 'Audit window', error: 'Query audit keeps 90 days of history.' })} ${picker({ value: null, label: 'Freshness window', disabled: true })}
    </div>`),
};

/* ---------- keyboard ---------- */

const onChange = fn();
const onInput = fn();

export const KeyboardPresets: Story = {
  name: 'Keyboard: presets',
  render: () => html`<mm-date-range-picker name="window" label="Run window" .now=${NOW} .value=${LAST_7} @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}></mm-date-range-picker>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    await waitFor(() => expect(activeText()).toBe('Last 7 days'));
    await press('{ArrowDown}');
    await expect(activeText()).toBe('Last 30 days');
    await press('{End}');
    await expect(activeText()).toBe('Last 90 days');
    await press('{Home}');
    await expect(activeText()).toBe('Last 15 minutes');
    await press('{ArrowUp}');
    await expect(activeText()).toBe('Last 15 minutes');
    await press('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(false));
    await expect(onChange).toHaveBeenCalledWith({ kind: 'relative', preset: 'last-24-hours' });
    await expect(deepActive()).toBe(trigger(canvasElement));
    await expect(trigger(canvasElement).textContent).toContain('Last 24 hours');
  },
};

export const KeyboardGrid: Story = {
  name: 'Keyboard: calendar grid',
  args: { value: INCIDENT },
  play: async ({ canvasElement }) => {
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    await waitFor(() => expect(focusedDay()).toBe('2026-10-12'));
    await press('{ArrowRight}');
    await expect(focusedDay()).toBe('2026-10-13');
    await press('{ArrowDown}');
    await expect(focusedDay()).toBe('2026-10-20');
    await press('{ArrowLeft}');
    await expect(focusedDay()).toBe('2026-10-19');
    await press('{ArrowUp}');
    await expect(focusedDay()).toBe('2026-10-12');
    await press('{End}');
    await expect(focusedDay()).toBe('2026-10-18');
    await press('{Home}');
    await expect(focusedDay()).toBe('2026-10-12');
    await press('{PageDown}');
    await expect(focusedDay()).toBe('2026-11-12');
    await expect(host(canvasElement).shadowRoot!.querySelector('.month-name')?.textContent).toBe('November 2026');
    await press('{PageUp}{PageUp}');
    await expect(focusedDay()).toBe('2026-09-12');
    await press('{Shift>}{PageDown}{/Shift}');
    await expect(focusedDay()).toBe('2027-09-12');
    await press('{Shift>}{PageUp}{/Shift}');
    await expect(focusedDay()).toBe('2026-09-12');
    // Month ends clamp: 31 Oct plus a month is 30 Nov.
    await press('{PageDown}');
    await press('{End}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(focusedDay()).toBe('2026-10-31');
    await press('{PageDown}');
    await expect(focusedDay()).toBe('2026-11-30');
    await press('{Escape}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(false));
    await expect(deepActive()).toBe(trigger(canvasElement));
    await expect(host(canvasElement).value).toEqual(INCIDENT);
  },
};

export const KeyboardSelectAndApply: Story = {
  name: 'Keyboard: select a range and apply',
  render: () => html`<mm-date-range-picker
    name="window"
    label="Incident window"
    .now=${NOW}
    .value=${null}
    @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}
    @mm-input=${(e: CustomEvent) => onInput(e.detail)}
  ></mm-date-range-picker>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    onInput.mockClear();
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    // Presets, previous month, next month, then the grid on today.
    await tab();
    await tab();
    await tab();
    await expect(focusedDay()).toBe('2026-10-27');
    await press('{Home}{Enter}');
    await expect(onInput).toHaveBeenLastCalledWith({ start: '2026-10-26T00:00:00.000Z', end: null });
    const apply = host(canvasElement).shadowRoot!.querySelector('.apply')!;
    await expect(apply.hasAttribute('disabled')).toBe(true);
    await press('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Space}');
    await expect(host(canvasElement).shadowRoot!.querySelectorAll('td[aria-selected="true"]').length).toBe(5);
    await tab();
    await press('0900');
    await tab();
    await press('1730');
    await tab();
    await expect(activeText()).toBe('Cancel');
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(false));
    await expect(onChange).toHaveBeenCalledWith({ kind: 'absolute', start: '2026-10-26T09:00:00.000Z', end: '2026-10-30T17:30:00.000Z' });
    await expect(trigger(canvasElement).textContent).toContain('26 Oct 2026, 09:00 to 30 Oct 2026, 17:30');
    await expect(trigger(canvasElement).textContent).toContain('UTC');
    await expect(deepActive()).toBe(trigger(canvasElement));
  },
};

export const KeyboardEndBeforeStart: Story = {
  name: 'Keyboard: end before start is rejected',
  args: { value: { kind: 'absolute', start: '2026-10-20T18:00:00.000Z', end: '2026-10-21T06:00:00.000Z' } },
  play: async ({ canvasElement }) => {
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(focusedDay()).toBe('2026-10-20'));
    await press('{Enter}{Enter}');
    // Same day, 18:00 to 06:00, cannot be applied.
    const sr = host(canvasElement).shadowRoot!;
    await expect(sr.querySelector('.status')?.textContent).toContain('The end must be after the start.');
    await expect(sr.querySelector('.apply')!.hasAttribute('disabled')).toBe(true);
    await press('{Escape}');
  },
};

export const KeyboardFocusWraps: Story = {
  name: 'Keyboard: Tab stays inside the popover',
  play: async ({ canvasElement }) => {
    await tab();
    await press('{Enter}');
    await waitFor(() => expect(activeText()).toBe('Last 7 days'));
    await tab(true);
    await expect(activeText()).toBe('Apply');
    await tab();
    await expect(activeText()).toBe('Last 7 days');
    await press('{Escape}');
    await waitFor(() => expect(isOpen(canvasElement)).toBe(false));
  },
};

export const PointerSelect: Story = {
  name: 'Pointer: click days and apply',
  args: { value: null },
  play: async ({ canvasElement }) => {
    await click(trigger(canvasElement));
    await waitFor(() => expect(isOpen(canvasElement)).toBe(true));
    const sr = host(canvasElement).shadowRoot!;
    await click(sr.querySelector('td[data-day="2026-10-05"]')!);
    await click(sr.querySelector('td[data-day="2026-10-02"]')!);
    // Picking an earlier end swaps the endpoints.
    await click(sr.querySelector('.apply')!);
    await waitFor(() => expect(isOpen(canvasElement)).toBe(false));
    await expect(host(canvasElement).value).toEqual({ kind: 'absolute', start: '2026-10-02T00:00:00.000Z', end: '2026-10-05T23:59:00.000Z' });
  },
};

/* ---------- forms ---------- */

const onSubmit = fn();
export const FormSubmissionAndReset: Story = {
  name: 'Form: submission and reset',
  render: () => html`<form
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit([...new FormData(e.target as HTMLFormElement).entries()]);
    }}
  >
    <mm-date-range-picker name="window" label="Run window" .now=${NOW} .value=${LAST_7}></mm-date-range-picker>
    <button type="submit">Filter runs</button>
    <button type="reset">Reset</button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    await expect([...new FormData(form).entries()]).toEqual([['window', 'last-7-days']]);
    host(canvasElement).value = INCIDENT;
    await host(canvasElement).updateComplete;
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith([
      ['window-start', '2026-10-12T09:00:00.000Z'],
      ['window-end', '2026-10-27T17:30:00.000Z'],
    ]);
    form.reset();
    await host(canvasElement).updateComplete;
    await expect(host(canvasElement).value).toEqual(LAST_7);
    await expect([...new FormData(form).entries()]).toEqual([['window', 'last-7-days']]);
  },
};

export const FieldsetDisabled: Story = {
  name: 'Form: disabled fieldset',
  render: () => html`<form>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <legend style="font:var(--text-label);color:var(--mm-text-2)">Schedule (paused)</legend>
      <mm-date-range-picker name="window" label="Run window" .now=${NOW} .value=${LAST_7}></mm-date-range-picker>
    </fieldset>
  </form>`,
  play: async ({ canvasElement }) => {
    await host(canvasElement).updateComplete;
    await expect(trigger(canvasElement).disabled).toBe(true);
    await expect([...new FormData(canvasElement.querySelector('form')!).entries()]).toEqual([]);
  },
};
