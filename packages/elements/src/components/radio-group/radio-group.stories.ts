import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/radio-group.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; help: string; error: string; value: string; orientation: string; required: boolean; disabled: boolean };

const options = html`
  <mm-radio value="hourly">Every hour</mm-radio>
  <mm-radio value="daily" description="At 04:00 UTC, after the warehouse load.">Every day</mm-radio>
  <mm-radio value="weekly">Every week</mm-radio>
  <mm-radio value="manual" disabled description="Turned off by your workspace admin.">Only when run manually</mm-radio>
`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Radio group',
  component: 'mm-radio-group',
  subcomponents: { MmRadio: 'mm-radio' } as never,
  args: { label: 'Refresh schedule', help: 'How often Marmot re-scans this source for schema changes.', error: '', value: 'daily', orientation: 'vertical', required: false, disabled: false },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] } },
  render: (a) => html`<mm-radio-group
    label=${a.label}
    help=${a.help}
    error=${a.error}
    value=${a.value}
    orientation=${a.orientation}
    ?required=${a.required}
    ?disabled=${a.disabled}
    >${options}</mm-radio-group
  >`,
  parameters: {
    usage: {
      html: `<mm-radio-group name="schedule" label="Refresh schedule" value="daily">
  <mm-radio value="hourly">Every hour</mm-radio>
  <mm-radio value="daily">Every day</mm-radio>
  <mm-radio value="weekly">Every week</mm-radio>
</mm-radio-group>`,
      react: `import { MmRadioGroup, MmRadio } from '@marmotdata/react';

<MmRadioGroup name="schedule" label="Refresh schedule" value={schedule}
  onMmChange={(e) => setSchedule(e.detail.value)}>
  <MmRadio value="hourly">Every hour</MmRadio>
  <MmRadio value="daily">Every day</MmRadio>
</MmRadioGroup>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/radio-group.js';
  let schedule = $state('daily');
</script>

<mm-radio-group name="schedule" label="Refresh schedule" value={schedule}
  onmm-change={(e) => (schedule = e.detail.value)}>
  <mm-radio value="hourly">Every hour</mm-radio>
  <mm-radio value="daily">Every day</mm-radio>
</mm-radio-group>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Empty: Story = { name: 'Empty (nothing chosen)', args: { value: '' } };
export const Horizontal: Story = {
  args: { orientation: 'horizontal', label: 'Lineage depth', help: '', value: '2' },
  render: (a) => html`<mm-radio-group label=${a.label} value=${a.value} orientation="horizontal">
    <mm-radio value="1">1 hop</mm-radio><mm-radio value="2">2 hops</mm-radio><mm-radio value="3">3 hops</mm-radio><mm-radio value="all">All</mm-radio>
  </mm-radio-group>`,
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-radio[value="daily"]'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = { args: { value: '', required: true, error: 'Choose how often to refresh this source.' } };
export const LongIdentifier: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-radio-group label="Primary source" value="pg">
    <mm-radio value="pg"><span style="font:var(--text-mono-dense)">mrn://postgresql/table/shop.public.orders</span></mm-radio>
    <mm-radio value="sf"><span style="font:var(--text-mono-dense)">mrn://snowflake/table/analytics.marts.orders_daily_rollup_by_region_and_channel</span></mm-radio>
  </mm-radio-group>`,
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:260px"><mm-radio-group label="What should happen when a column is removed upstream?" value="warn">
    <mm-radio value="warn" description="Owners of every downstream asset get an email and a Slack message.">Warn the owners and keep the column in the catalog until it is confirmed gone</mm-radio>
    <mm-radio value="remove">Remove it straight away</mm-radio>
  </mm-radio-group></div>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-radio-group label="جدول التحديث" value="daily" orientation="horizontal">
    <mm-radio value="hourly">كل ساعة</mm-radio><mm-radio value="daily">كل يوم</mm-radio><mm-radio value="weekly">كل أسبوع</mm-radio>
  </mm-radio-group>`,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('mm-radio-group')!;
    await tab();
    await press('{ArrowLeft}');
    await expect(group.value).toBe('weekly');
    await press('{ArrowRight}{ArrowRight}');
    await expect(group.value).toBe('hourly');
  },
};
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-5)">
    <mm-radio-group label="Refresh schedule" value="daily">${options}</mm-radio-group>
    <mm-radio-group label="Sampling" required error="Choose a sampling strategy." orientation="horizontal">
      <mm-radio value="none">None</mm-radio><mm-radio value="random">Random</mm-radio><mm-radio value="stratified">Stratified</mm-radio>
    </mm-radio-group>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

export const KeyboardArrows: Story = {
  name: 'Keyboard: arrows move and choose, skipping disabled',
  render: () => html`<div style="display:grid;gap:var(--space-4)"><mm-radio-group label="Refresh schedule">${options}</mm-radio-group><mm-button>Save schedule</mm-button></div>`,
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('mm-radio-group')!;
    const radios = Array.from(canvasElement.querySelectorAll('mm-radio'));
    const change = fn();
    group.addEventListener('mm-change', change);
    await tab();
    await expect(deepActive()).toBe(radios[0]);
    await expect(group.value).toBe('');
    await press(' ');
    await expect(group.value).toBe('hourly');
    await expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await press('{ArrowDown}');
    await expect(group.value).toBe('daily');
    await press('{ArrowRight}');
    await expect(group.value).toBe('weekly');
    // The disabled option is skipped and the group wraps.
    await press('{ArrowDown}');
    await expect(group.value).toBe('hourly');
    await press('{ArrowUp}');
    await expect(group.value).toBe('weekly');
    await expect(deepActive()).toBe(radios[2]);
    await expect(radios.map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
    await expect(change).toHaveBeenCalledTimes(5);
    // Tab leaves the group in one step.
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};

export const ClickChooses: Story = {
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('mm-radio-group')!;
    await userEvent.click(canvasElement.querySelector('mm-radio[value="weekly"]')!);
    await expect(group.value).toBe('weekly');
    await userEvent.click(canvasElement.querySelector('mm-radio[value="manual"]')!);
    await expect(group.value).toBe('weekly');
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-4)"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-radio-group name="schedule" label="Refresh schedule">
      <mm-radio value="hourly">Every hour</mm-radio>
      <mm-radio value="daily" checked>Every day</mm-radio>
    </mm-radio-group>
    <mm-radio-group name="sampling" label="Sampling" required orientation="horizontal">
      <mm-radio value="none">None</mm-radio>
      <mm-radio value="random">Random</mm-radio>
    </mm-radio-group>
    <div><mm-button variant="primary" type="submit">Save source</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [schedule, sampling] = Array.from(canvasElement.querySelectorAll('mm-radio-group'));
    await expect(schedule!.value).toBe('daily');
    form.requestSubmit();
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(deepActive()).toBe(sampling!.querySelector('mm-radio'));
    await press('{ArrowRight}');
    await tab(true);
    await press('{ArrowUp}');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ schedule: 'hourly', sampling: 'random' });
    form.reset();
    await expect(schedule!.value).toBe('daily');
    await expect(sampling!.value).toBe('');
    await expect(Object.fromEntries(new FormData(form))).toEqual({ schedule: 'daily' });
  },
};
