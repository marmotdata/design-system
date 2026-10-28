import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/checkbox.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; description: string; help: string; error: string; checked: boolean; indeterminate: boolean; required: boolean; disabled: boolean };

const meta: Meta<Args> = {
  title: 'Components/Forms/Checkbox',
  component: 'mm-checkbox',
  args: { label: 'Notify me when this pipeline fails', description: 'Sent to your email and the #data-platform channel.', help: '', error: '', checked: false, indeterminate: false, required: false, disabled: false },
  render: (a) => html`<mm-checkbox
    label=${a.label}
    description=${a.description}
    help=${a.help}
    error=${a.error}
    ?checked=${a.checked}
    ?indeterminate=${a.indeterminate}
    ?required=${a.required}
    ?disabled=${a.disabled}
  ></mm-checkbox>`,
  parameters: {
    usage: {
      html: `<mm-checkbox name="notify" value="failures" label="Notify me when this pipeline fails" checked></mm-checkbox>`,
      react: `import { MmCheckbox } from '@marmotdata/react';

<MmCheckbox name="notify" value="failures" label="Notify me when this pipeline fails"
  checked={notify} onMmChange={(e) => setNotify(e.detail.checked)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/checkbox.js';
  let notify = $state(true);
</script>

<!-- Submits "notify=failures" only while ticked, like a native checkbox. -->
<mm-checkbox name="notify" value="failures" label="Notify me when this pipeline fails"
  checked={notify} onmm-change={(e) => (notify = e.detail.checked)}></mm-checkbox>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Checked: Story = { args: { checked: true } };
export const Indeterminate: Story = {
  args: { indeterminate: true, label: 'Select all columns in customers_dim', description: '12 of 31 columns selected.' },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('mm-checkbox')!.shadowRoot!.querySelector('input')!;
    await expect(input.indeterminate).toBe(true);
  },
};
export const Empty: Story = { args: { description: '' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-checkbox')!.shadowRoot!.querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-2)">
    <mm-checkbox label="Include deprecated assets" disabled></mm-checkbox>
    <mm-checkbox label="Mask PII in previews" disabled checked></mm-checkbox>
  </div>`,
};
export const Error: Story = {
  args: { label: 'I have read the data access policy', description: '', required: true, error: 'Tick this box to confirm you have read the policy.' },
};
export const LongIdentifier: Story = { name: 'Long identifiers', args: { label: 'Grant read on mrn://snowflake/table/analytics.marts.orders_daily_rollup_by_region_and_channel', description: '' } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:260px"><mm-checkbox
    label="Notify the owning team and every downstream consumer when a schema change removes or renames a column"
    description="Downstream consumers are found through lineage, including dashboards, agents and reverse ETL syncs."
  ></mm-checkbox></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'أعلمني عند فشل خط المعالجة', description: 'يرسل إلى بريدك الإلكتروني.' } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-3)">
    <mm-checkbox label="Notify me when this pipeline fails" checked></mm-checkbox>
    <mm-checkbox label="Include deprecated assets"></mm-checkbox>
    <mm-checkbox label="Select all columns" indeterminate></mm-checkbox>
    <mm-checkbox label="I have read the data access policy" required error="Tick this box to confirm you have read the policy."></mm-checkbox>
    <mm-checkbox label="Mask PII in previews" disabled checked></mm-checkbox>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

export const KeyboardSpace: Story = {
  name: 'Keyboard: Space toggles, label click toggles',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-checkbox')!;
    const mmChange = fn();
    const change = fn();
    const input = fn();
    el.addEventListener('mm-change', mmChange);
    el.addEventListener('change', change);
    el.addEventListener('input', input);
    await tab();
    await press(' ');
    await expect(el.checked).toBe(true);
    await expect(mmChange).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { checked: true, value: 'on' } }));
    await press(' ');
    await expect(el.checked).toBe(false);
    await userEvent.click(el.shadowRoot!.querySelector('label')!);
    await expect(el.checked).toBe(true);
    await expect(mmChange).toHaveBeenCalledTimes(3);
    await expect(change).toHaveBeenCalledTimes(3);
    await expect(input).toHaveBeenCalledTimes(3);
  },
};

export const IndeterminateClears: Story = {
  name: 'Keyboard: Space clears indeterminate',
  args: { indeterminate: true, label: 'Select all columns', description: '' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-checkbox')!;
    await tab();
    await press(' ');
    await expect(el.indeterminate).toBe(false);
    await expect(el.checked).toBe(true);
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-3)"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit([...new FormData(e.target as HTMLFormElement)]);
    }}
  >
    <mm-checkbox name="notify" value="failures" label="Notify me when a run fails" checked></mm-checkbox>
    <mm-checkbox name="notify" value="stale" label="Notify me when the asset is stale"></mm-checkbox>
    <mm-checkbox name="policy" label="I have read the data access policy" required></mm-checkbox>
    <div><mm-button variant="primary" type="submit">Save notifications</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [, stale, policy] = Array.from(canvasElement.querySelectorAll('mm-checkbox'));
    form.requestSubmit();
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(deepActive()).toBe(policy!.shadowRoot!.querySelector('input'));
    await press(' ');
    await tab(true);
    await press(' ');
    await expect(stale!.checked).toBe(true);
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith([
      ['notify', 'failures'],
      ['notify', 'stale'],
      ['policy', 'on'],
    ]);
    form.reset();
    await expect(stale!.checked).toBe(false);
    await expect(policy!.checked).toBe(false);
    await expect([...new FormData(form)]).toEqual([['notify', 'failures']]);
  },
};
