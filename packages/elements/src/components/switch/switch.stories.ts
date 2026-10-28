import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/switch.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; description: string; error: string; checked: boolean; stateLabel: boolean; required: boolean; disabled: boolean };

const meta: Meta<Args> = {
  title: 'Components/Forms/Switch',
  component: 'mm-switch',
  args: { label: 'Run this pipeline on a schedule', description: 'Every day at 04:00 UTC.', error: '', checked: true, stateLabel: false, required: false, disabled: false },
  render: (a) => html`<mm-switch
    label=${a.label}
    description=${a.description}
    error=${a.error}
    ?checked=${a.checked}
    ?state-label=${a.stateLabel}
    ?required=${a.required}
    ?disabled=${a.disabled}
  ></mm-switch>`,
  parameters: {
    usage: {
      html: `<mm-switch name="masking" label="Mask PII in query results" checked></mm-switch>`,
      react: `import { MmSwitch } from '@marmotdata/react';

<MmSwitch name="masking" label="Mask PII in query results"
  checked={masking} onMmChange={(e) => setMasking(e.detail.checked)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/switch.js';
  let masking = $state(true);
</script>

<mm-switch name="masking" label="Mask PII in query results"
  checked={masking} onmm-change={(e) => (masking = e.detail.checked)}></mm-switch>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const On: Story = {};
export const Off: Story = { args: { checked: false } };
export const StateLabel: Story = { name: 'With state word', args: { stateLabel: true } };
export const Empty: Story = { args: { description: '' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-switch')!.shadowRoot!.querySelector('[role="switch"]'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-3)">
    <mm-switch label="Mask PII in query results" disabled checked></mm-switch>
    <mm-switch label="Allow agents to run write queries" disabled></mm-switch>
  </div>`,
};
export const Error: Story = { args: { checked: false, label: 'Enable audit logging', description: '', required: true, error: 'Turn on audit logging before connecting a production source.' } };
export const LongIdentifier: Story = { name: 'Long identifiers', args: { label: 'Sync mrn://kafka/topic/shop.orders.v2.dead_letter_queue_retry_partition_14', description: '' } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px"><mm-switch checked
    label="Allow support-triage-agent to query customer tables with masked columns"
    description="Masked columns return a hash. The agent never sees email addresses or card numbers."></mm-switch></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'تشغيل خط المعالجة وفق جدول', description: 'يوميا الساعة 04:00 بالتوقيت العالمي.' } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-3)">
    <mm-switch label="Run this pipeline on a schedule" checked></mm-switch>
    <mm-switch label="Allow agents to run write queries"></mm-switch>
    <mm-switch label="Mask PII in query results" checked state-label></mm-switch>
    <mm-switch label="Enable audit logging" required error="Turn on audit logging before connecting a production source."></mm-switch>
    <mm-switch label="Sync deleted assets" disabled></mm-switch>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

export const KeyboardToggle: Story = {
  name: 'Keyboard: Space and Enter toggle',
  args: { checked: false },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-switch')!;
    const sw = el.shadowRoot!.querySelector('[role="switch"]')!;
    const mmChange = fn();
    const change = fn();
    el.addEventListener('mm-change', mmChange);
    el.addEventListener('change', change);
    await tab();
    await press(' ');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await press('{Enter}');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(el.shadowRoot!.querySelector('label')!);
    await expect(el.checked).toBe(true);
    await expect(mmChange).toHaveBeenCalledTimes(3);
    await expect(change).toHaveBeenCalledTimes(3);
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
    <mm-switch name="schedule" label="Run this pipeline on a schedule" checked></mm-switch>
    <mm-switch name="audit" value="enabled" label="Enable audit logging" required></mm-switch>
    <div><mm-button variant="primary" type="submit">Save pipeline</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [schedule, audit] = Array.from(canvasElement.querySelectorAll('mm-switch'));
    form.requestSubmit();
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(deepActive()).toBe(audit!.shadowRoot!.querySelector('[role="switch"]'));
    await press(' ');
    await tab(true);
    await press(' ');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith([['audit', 'enabled']]);
    form.reset();
    await expect(schedule!.checked).toBe(true);
    await expect(audit!.checked).toBe(false);
    await expect([...new FormData(form)]).toEqual([['schedule', 'on']]);
  },
};
