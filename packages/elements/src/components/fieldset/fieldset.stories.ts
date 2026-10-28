import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/fieldset.js';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/number-field.js';
import '@marmotdata/elements/checkbox.js';
import '@marmotdata/elements/switch.js';
import '@marmotdata/elements/button.js';

type Args = { label: string; description: string; error: string; bordered: boolean; disabled: boolean };

const controls = html`
  <mm-text-field name="host" label="Host" mono value="analytics.eu-west-2.snowflakecomputing.com"></mm-text-field>
  <mm-number-field name="port" label="Port" value="443"></mm-number-field>
  <mm-checkbox name="ssl" label="Require TLS" checked></mm-checkbox>
`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Fieldset',
  component: 'mm-fieldset',
  args: { label: 'Connection', description: 'Marmot connects with a read-only service account.', error: '', bordered: false, disabled: false },
  render: (a) => html`<div style="max-width:420px">
    <mm-fieldset label=${a.label} description=${a.description} error=${a.error} ?bordered=${a.bordered} ?disabled=${a.disabled}>${controls}</mm-fieldset>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-fieldset label="Connection" description="Marmot connects with a read-only service account.">
  <mm-text-field name="host" label="Host" mono></mm-text-field>
  <mm-number-field name="port" label="Port" value="443"></mm-number-field>
</mm-fieldset>`,
      react: `import { MmFieldset, MmTextField } from '@marmotdata/react';

<MmFieldset label="Connection" disabled={saving}>
  <MmTextField name="host" label="Host" mono />
</MmFieldset>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/fieldset.js';
  import '@marmotdata/elements/text-field.js';
  let { form } = $props();
</script>

<form method="POST" action="?/connect">
  <mm-fieldset label="Connection" disabled={form?.saving}>
    <mm-text-field name="host" label="Host" mono></mm-text-field>
  </mm-fieldset>
</form>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Bordered: Story = { args: { bordered: true } };
export const Empty: Story = { name: 'Empty (legend only)', args: { description: '' }, render: (a) => html`<mm-fieldset label=${a.label}></mm-fieldset>` };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-text-field')!.shadowRoot!.querySelector('input'));
  },
};
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const fs = canvasElement.querySelector('mm-fieldset')!;
    await fs.updateComplete;
    const fields = Array.from(canvasElement.querySelectorAll('mm-text-field, mm-number-field, mm-checkbox')) as Array<HTMLElement & { disabled: boolean }>;
    await expect(fields.every((f) => f.disabled)).toBe(true);
    await tab();
    await expect(canvasElement.contains(deepActive())).toBe(false);
    fs.disabled = false;
    await fs.updateComplete;
    await expect(fields.every((f) => !f.disabled)).toBe(true);
  },
};
export const KeepsOwnDisabled: Story = {
  name: 'Re-enabling keeps controls that were already disabled',
  render: () => html`<mm-fieldset label="Notifications" disabled>
    <mm-checkbox label="Email me when a run fails" checked></mm-checkbox>
    <mm-checkbox label="Page the on-call engineer" disabled></mm-checkbox>
  </mm-fieldset>`,
  play: async ({ canvasElement }) => {
    const fs = canvasElement.querySelector('mm-fieldset')!;
    const [email, page] = Array.from(canvasElement.querySelectorAll('mm-checkbox'));
    await fs.updateComplete;
    fs.disabled = false;
    await fs.updateComplete;
    await expect(email!.disabled).toBe(false);
    await expect(page!.disabled).toBe(true);
  },
};
export const Error: Story = {
  render: () => html`<mm-fieldset label="Notification channels" required error="Choose at least one channel so failures reach someone.">
    <mm-checkbox name="channel" value="email" label="Email"></mm-checkbox>
    <mm-checkbox name="channel" value="slack" label="Slack, #data-platform"></mm-checkbox>
  </mm-fieldset>`,
};
export const LongIdentifier: Story = {
  name: 'Long identifiers',
  args: { label: 'Source mrn://snowflake/database/analytics_production_eu_west_2', description: '' },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:260px"><mm-fieldset bordered label="Masking and retention for personally identifiable columns" description="Applies to every asset tagged PII in this domain, including dashboards, agents and reverse ETL syncs that read from them.">
    <mm-switch label="Mask PII in query results" checked></mm-switch>
    <mm-number-field label="Retention" unit="days" value="400"></mm-number-field>
  </mm-fieldset></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'الاتصال', description: 'يتصل Marmot بحساب خدمة للقراءة فقط.', bordered: true } };
export const All: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-6);max-width:420px">
    <mm-fieldset label="Connection" description="Marmot connects with a read-only service account.">${controls}</mm-fieldset>
    <mm-fieldset label="Schedule" bordered>
      <mm-switch label="Run this pipeline on a schedule" checked></mm-switch>
    </mm-fieldset>
  </div>`,
};
export const BothThemes: Story = { render: () => themes(All.render!({} as Args, {} as never)) };

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
    <mm-fieldset label="Connection">${controls}</mm-fieldset>
    <mm-fieldset label="Advanced" disabled>
      <mm-text-field name="role" label="Warehouse role" value="MARMOT_READER" mono></mm-text-field>
    </mm-fieldset>
    <div><mm-button variant="primary" type="submit">Save connection</mm-button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    await canvasElement.querySelectorAll('mm-fieldset')[1]!.updateComplete;
    form.requestSubmit();
    // The disabled group's controls are excluded, as with a native disabled fieldset.
    await expect(onSubmit).toHaveBeenCalledWith({ host: 'analytics.eu-west-2.snowflakecomputing.com', port: '443', ssl: 'on' });
    const host = canvasElement.querySelector('mm-text-field')!;
    host.value = 'analytics.us-east-1.snowflakecomputing.com';
    form.reset();
    await expect(host.value).toBe('analytics.eu-west-2.snowflakecomputing.com');
  },
};
