import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/form-field.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; help: string; error: string; required: boolean; optional: boolean; hideLabel: boolean };

/** A stand-in custom control: a native select styled with tokens, as an app might compose one. */
const select = (value = 'analytics-engineering', disabled = false) => html`<select
  name="team"
  ?disabled=${disabled}
  style="height:var(--mm-control);padding-inline:8px;font:var(--text-dense);color:var(--mm-text);background:var(--mm-surface);border:1px solid var(--mm-control-border);border-radius:var(--radius-sm)"
>
  <option value="analytics-engineering" ?selected=${value === 'analytics-engineering'}>Analytics Engineering</option>
  <option value="data-platform" ?selected=${value === 'data-platform'}>Data Platform</option>
  <option value="" ?selected=${value === ''}>No owner</option>
</select>`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Form field',
  component: 'mm-form-field',
  args: { label: 'Owning team', help: 'The team paged when this asset fails a freshness check.', error: '', required: false, optional: false, hideLabel: false },
  render: (a) => html`<div style="max-width:360px">
    <mm-form-field label=${a.label} help=${a.help} error=${a.error} ?required=${a.required} ?optional=${a.optional} ?hide-label=${a.hideLabel}>${select()}</mm-form-field>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-form-field label="Owning team" help="The team paged when this asset fails a freshness check.">
  <my-team-picker name="team"></my-team-picker>
</mm-form-field>`,
      react: `import { MmFormField } from '@marmotdata/react';

<MmFormField label="Owning team" error={errors.team}>
  <TeamPicker name="team" />
</MmFormField>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/form-field.js';
  let { form } = $props();
</script>

<mm-form-field label="Owning team" error={form?.errors?.team ?? ''}>
  <select name="team">…</select>
</mm-form-field>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const sel = canvasElement.querySelector('select')!;
    await expect(sel).toHaveAttribute('aria-label', 'Owning team');
    await expect(sel).toHaveAttribute('aria-description', 'The team paged when this asset fails a freshness check.');
  },
};
export const Empty: Story = { args: { help: '' }, render: (a) => html`<div style="max-width:360px"><mm-form-field label=${a.label}>${select('')}</mm-form-field></div>` };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('select'));
  },
};
export const LabelClickFocuses: Story = {
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector('mm-form-field')!.shadowRoot!.querySelector('[part="label"]') as HTMLElement).click();
    await expect(document.activeElement).toBe(canvasElement.querySelector('select'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = { render: (a) => html`<div style="max-width:360px"><mm-form-field label=${a.label} help=${a.help}>${select('data-platform', true)}</mm-form-field></div>` };
export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('select')).toHaveAttribute('aria-required', 'true');
  },
};
export const Optional: Story = { args: { optional: true } };
export const HiddenLabel: Story = { args: { hideLabel: true, help: '' } };
export const Error: Story = {
  args: { error: 'Choose a team. Assets without an owner cannot be certified.', required: true },
  play: async ({ canvasElement }) => {
    const sel = canvasElement.querySelector('select')!;
    await expect(sel).toHaveAttribute('aria-invalid', 'true');
    await expect(sel.getAttribute('aria-description')).toContain('Choose a team.');
  },
};
export const SlottedMessages: Story = {
  name: 'Rich label, help and error slots',
  render: () => html`<div style="max-width:360px"><mm-form-field>
    <span slot="label">Owner of <code style="font:var(--text-mono-dense)">orders_daily</code></span>
    ${select()}
    <span slot="help">See <a href="#teams" style="color:var(--mm-primary)">Settings, Teams</a> to add a team.</span>
    <span slot="error">Analytics Engineering has no on-call rota. Add one or choose another team.</span>
  </mm-form-field></div>`,
  play: async ({ canvasElement }) => {
    const sel = canvasElement.querySelector('select')!;
    const label = canvasElement.querySelector('[slot="label"]')!;
    await expect(sel.getAttribute('aria-labelledby')).toBe(label.id);
    await expect(sel.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
    await expect(sel).toHaveAttribute('aria-invalid', 'true');
  },
};
export const AuthorAttributesWin: Story = {
  name: 'Author ARIA is never overwritten',
  render: () => html`<mm-form-field label="Owning team"><input aria-label="Team name" value="Data Platform" /></mm-form-field>`,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('input')).toHaveAttribute('aria-label', 'Team name');
  },
};
export const LongIdentifier: Story = {
  name: 'Long identifiers',
  render: () => html`<div style="max-width:360px"><mm-form-field label="Source MRN" help="mrn://snowflake/table/analytics.marts.orders_daily_rollup_by_region_and_channel">
    <input style="font:var(--text-mono-dense);height:var(--mm-control);border:1px solid var(--mm-control-border);border-radius:var(--radius-sm);padding-inline:10px;background:var(--mm-surface);color:var(--mm-text)" value="mrn://snowflake/table/analytics.marts.orders_daily_rollup_by_region_and_channel" />
  </mm-form-field></div>`,
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px"><mm-form-field required label="Team that owns this asset and answers questions about it in the catalog" error="Choose a team that exists in Settings. Assets without an owner cannot be certified or shared with agents.">${select()}</mm-form-field></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'الفريق المالك', help: 'الفريق الذي يتم تنبيهه.', required: true } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);max-width:360px">
    <mm-form-field label="Owning team" help="The team paged when this asset fails a freshness check.">${select()}</mm-form-field>
    <mm-form-field label="Owning team" required error="Choose a team. Assets without an owner cannot be certified.">${select('')}</mm-form-field>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits and resets with a native form',
  render: () => html`<form
    style="display:grid;gap:var(--space-4);max-width:360px"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-form-field label="Owning team">${select()}</mm-form-field>
    <div><mm-button variant="primary" type="submit">Save owner</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const sel = canvasElement.querySelector('select')!;
    await tab();
    await press('{ArrowDown}');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ team: 'data-platform' });
    form.reset();
    await expect(sel.value).toBe('analytics-engineering');
  },
};
