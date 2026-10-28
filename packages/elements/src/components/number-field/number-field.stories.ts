import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/number-field.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; help: string; error: string; value: string; unit: string; min?: number; max?: number; step?: number; required: boolean; disabled: boolean };

const meta: Meta<Args> = {
  title: 'Components/Forms/Number field',
  component: 'mm-number-field',
  args: { label: 'Query timeout', help: 'Queries running longer than this are cancelled.', error: '', value: '500', unit: 'ms', min: 100, max: 30000, step: 100, required: false, disabled: false },
  render: (a) => html`<div style="max-width:240px">
    <mm-number-field
      label=${a.label}
      help=${a.help}
      error=${a.error}
      value=${a.value}
      unit=${a.unit}
      min=${a.min ?? nothing}
      max=${a.max ?? nothing}
      step=${a.step ?? nothing}
      ?required=${a.required}
      ?disabled=${a.disabled}
    ></mm-number-field>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-number-field name="timeout" label="Query timeout" unit="ms" min="100" max="30000" step="100" value="500"></mm-number-field>`,
      react: `import { MmNumberField } from '@marmotdata/react';

<MmNumberField name="timeout" label="Query timeout" unit="ms" min={100} max={30000} step={100}
  value={String(timeout)} onMmChange={(e) => setTimeout(Number(e.detail.value))} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/number-field.js';
</script>

<!-- Submits as text; parse with Number(formData.get('limit')) in the action. -->
<form method="POST" action="?/limits">
  <mm-number-field name="limit" label="Row limit" unit="rows" min="0" max="100000" step="1000" value="10000"></mm-number-field>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Empty: Story = { args: { value: '', unit: '', label: 'Retention', help: 'Leave empty to keep forever.' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-number-field')!.shadowRoot!.querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = { args: { value: '45000', error: 'Enter a timeout of 30,000 ms or less.' } };
export const LongValue: Story = { name: 'Long identifiers', args: { label: 'Row count', unit: 'rows', value: '1284019', min: 0, max: undefined, step: 1, help: 'Rows in shop.public.orders at the last scan.' } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:180px"><mm-number-field label="Maximum rows returned to an agent in a single tool call" unit="rows" value="1284019"></mm-number-field></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'مهلة الاستعلام', help: 'يتم إلغاء الاستعلامات الأطول.' } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:240px">
    <mm-number-field label="Query timeout" unit="ms" value="500" min="100" max="30000" step="100"></mm-number-field>
    <mm-number-field label="Row limit" unit="rows" value="10000" step="1000"></mm-number-field>
    <mm-number-field label="Sample rate" value="0.25" step="0.05" min="0" max="1"></mm-number-field>
    <mm-number-field label="Retention" unit="days" value="" required error="Enter how many days to keep run history."></mm-number-field>
    <mm-number-field label="Replicas" value="3" disabled></mm-number-field>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

export const KeyboardSpin: Story = {
  name: 'Keyboard: arrows, Page keys, Home and End',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-number-field')!;
    const input = el.shadowRoot!.querySelector('input')!;
    await expect(input).toHaveAttribute('aria-valuetext', '500 ms');
    const change = fn();
    el.addEventListener('mm-change', change);
    await tab();
    await press('{ArrowUp}');
    await expect(el.value).toBe('600');
    await press('{ArrowDown}{ArrowDown}');
    await expect(el.value).toBe('400');
    await press('{PageUp}');
    await expect(el.value).toBe('1400');
    await press('{PageDown}{PageDown}');
    await expect(el.value).toBe('100');
    await press('{ArrowDown}');
    await expect(el.value).toBe('100');
    await press('{End}');
    await expect(el.value).toBe('30000');
    await press('{Home}');
    await expect(el.value).toBe('100');
    await expect(change).toHaveBeenCalledTimes(8);
  },
};

export const Steppers: Story = {
  name: 'Stepper buttons are labelled',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-number-field')!;
    const [dec, inc] = Array.from(el.shadowRoot!.querySelectorAll('button'));
    await expect(dec).toHaveAttribute('aria-label', 'Decrease');
    await expect(inc).toHaveAttribute('aria-label', 'Increase');
    inc!.click();
    await expect(el.value).toBe('600');
    dec!.click();
    dec!.click();
    await expect(el.value).toBe('400');
  },
};

export const StepBase: Story = {
  name: 'Steps count from zero, not from min',
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:240px">
    <mm-number-field label="Row limit" unit="rows" value="1000" min="1" max="10000" step="100"></mm-number-field>
    <mm-number-field label="Port" value="5432" min="1024" max="65535" step="10" step-base="2"></mm-number-field>
  </div>`,
  play: async ({ canvasElement }) => {
    const [limit, port] = Array.from(canvasElement.querySelectorAll('mm-number-field'));
    // min="1" no longer shifts the grid to 1, 101, 201: 1,000 is valid and steps stay round.
    await expect(limit!.matches(':invalid')).toBe(false);
    await tab();
    await press('{ArrowUp}');
    await expect(limit!.value).toBe('1100');
    await press('{Home}{ArrowUp}');
    await expect(limit!.value).toBe('100');
    await press('{ArrowDown}');
    await expect(limit!.value).toBe('1');
    limit!.value = '950';
    await limit!.updateComplete;
    await expect(limit!.matches(':invalid')).toBe(true);
    // step-base moves the grid: 5432 sits on 2, 12, 22 and so on.
    await expect(port!.matches(':invalid')).toBe(false);
    await tab();
    await press('{ArrowUp}');
    await expect(port!.value).toBe('5442');
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-4);max-width:240px"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-number-field name="limit" label="Row limit" unit="rows" min="0" max="100000" step="1000" value="10000"></mm-number-field>
    <div><mm-button variant="primary" type="submit">Save limits</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = canvasElement.querySelector('mm-number-field')!;
    await tab();
    await press('{ArrowUp}{Enter}');
    await expect(onSubmit).toHaveBeenCalledWith({ limit: '11000' });
    // Out of range blocks submission.
    el.value = '250000';
    await el.updateComplete;
    onSubmit.mockClear();
    form.requestSubmit();
    await expect(onSubmit).not.toHaveBeenCalled();
    await expect(el.matches(':invalid')).toBe(true);
    form.reset();
    await expect(el.value).toBe('10000');
    await expect(Object.fromEntries(new FormData(form))).toEqual({ limit: '10000' });
  },
};
