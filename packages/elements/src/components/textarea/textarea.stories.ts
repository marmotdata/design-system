import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, nothing } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/textarea.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; help: string; error: string; value: string; placeholder: string; rows: number; autosize: boolean; mono: boolean; required: boolean; disabled: boolean; maxlength?: number };

const description = 'Daily rollup of shop orders by region and channel. Deduplicated against the payments ledger before 04:00 UTC.';

const meta: Meta<Args> = {
  title: 'Components/Forms/Textarea',
  component: 'mm-textarea',
  args: { label: 'Description', help: 'Shown at the top of the asset page. Markdown is supported.', error: '', value: description, placeholder: '', rows: 3, autosize: false, mono: false, required: false, disabled: false },
  render: (a) => html`<div style="max-width:480px">
    <mm-textarea
      label=${a.label}
      help=${a.help}
      error=${a.error}
      value=${a.value}
      placeholder=${a.placeholder}
      rows=${a.rows}
      maxlength=${a.maxlength ?? nothing}
      ?autosize=${a.autosize}
      ?mono=${a.mono}
      ?required=${a.required}
      ?disabled=${a.disabled}
    ></mm-textarea>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-textarea name="description" label="Description" rows="4" maxlength="500" autosize
  help="Shown at the top of the asset page."></mm-textarea>`,
      react: `import { MmTextarea } from '@marmotdata/react';

<MmTextarea name="description" label="Description" rows={4} maxlength={500} autosize
  onMmChange={(e) => saveDescription(e.detail.value)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/textarea.js';
</script>

<form method="POST" action="?/describe">
  <mm-textarea name="description" label="Description" rows="4" maxlength="500" autosize></mm-textarea>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Empty: Story = { args: { value: '', placeholder: 'What does this asset hold, and who should use it?' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-textarea')!.shadowRoot!.querySelector('textarea'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { args: { disabled: true } };
export const Error: Story = { args: { value: 'tbd', error: 'Write at least one sentence about what this asset holds.', required: true } };
export const Counter: Story = { name: 'Character counter', args: { maxlength: 140 } };
export const Mono: Story = {
  name: 'Long identifiers',
  args: {
    label: 'Upstream assets',
    mono: true,
    rows: 4,
    help: 'One MRN per line.',
    value: 'mrn://postgresql/table/shop.public.orders\nmrn://kafka/topic/shop.orders.v2\nmrn://snowflake/table/analytics.marts.orders_daily_rollup_by_region_and_channel',
  },
};
export const Autosize: Story = {
  args: { autosize: true, rows: 2, help: 'Grows as you type.' },
  play: async ({ canvasElement }) => {
    const ta = canvasElement.querySelector('mm-textarea')!.shadowRoot!.querySelector('textarea')!;
    const before = ta.getBoundingClientRect().height;
    await tab();
    await press('{End}{Enter}Owned by Analytics Engineering.{Enter}Ask Jane Doe about late-arriving refunds.');
    await expect(ta.getBoundingClientRect().height).toBeGreaterThan(before);
  },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  args: { rows: 3, value: `${description} ${description} ${description} ${description}` },
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'الوصف', help: 'يظهر أعلى صفحة الأصل.', value: 'تجميع يومي لطلبات المتجر حسب المنطقة.' } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:420px">
    <mm-textarea label="Description" value=${description}></mm-textarea>
    <mm-textarea label="Review comment" optional placeholder="Leave a note for the data owner"></mm-textarea>
    <mm-textarea label="Upstream assets" mono rows="2" value="mrn://kafka/topic/shop.orders.v2"></mm-textarea>
    <mm-textarea label="Reason for access" required error="Say why you need access, so the owner can approve it." value=""></mm-textarea>
    <mm-textarea label="Retention policy" disabled value="Kept for 400 days, then archived."></mm-textarea>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

export const KeyboardTyping: Story = {
  name: 'Keyboard: Enter adds a line, events fire',
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:420px"><mm-textarea label="Description"></mm-textarea><mm-button>Save description</mm-button></div>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-textarea')!;
    const mmInput = fn();
    const change = fn();
    el.addEventListener('mm-input', mmInput);
    el.addEventListener('change', change);
    await tab();
    await press('Orders{Enter}Refunds');
    await expect(el.value).toBe('Orders\nRefunds');
    await expect(mmInput).toHaveBeenCalledTimes(14);
    await tab();
    await expect(change).toHaveBeenCalledOnce();
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-4);max-width:420px"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-textarea name="description" label="Description" value="Daily orders rollup." minlength="10" required></mm-textarea>
    <div><mm-button variant="primary" type="submit">Save description</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const el = canvasElement.querySelector('mm-textarea')!;
    await tab();
    await press('{Control>}{End}{/Control} Owned by Data Platform.');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ description: 'Daily orders rollup. Owned by Data Platform.' });
    form.reset();
    await expect(el.value).toBe('Daily orders rollup.');
    await expect(Object.fromEntries(new FormData(form))).toEqual({ description: 'Daily orders rollup.' });
  },
};
