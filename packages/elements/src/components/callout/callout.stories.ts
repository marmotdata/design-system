import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/callout.js';
import '@marmotdata/elements/button.js';

type Args = { tone: string; heading: string; body: string; compact: boolean; dismissible: boolean; urgent: boolean };

const meta: Meta<Args> = {
  title: 'Components/Status/Callout',
  component: 'mm-callout',
  args: {
    tone: 'warning',
    heading: 'This source has not synced for 3 days.',
    body: 'The last successful run of the PostgreSQL plugin was on 24 October. Check the pipeline before trusting row counts.',
    compact: false,
    dismissible: false,
    urgent: false,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] },
    body: { name: 'body (slot)' },
  },
  render: (a) => html`<div style="max-width:640px">
    <mm-callout tone=${a.tone} heading=${a.heading} ?compact=${a.compact} ?dismissible=${a.dismissible} ?urgent=${a.urgent}>${a.body}</mm-callout>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-callout tone="warning" heading="Credentials for snowflake-prod expire on 2 November.">
  Rotate them in Plugins before then.
  <mm-button slot="actions" size="sm">Open Plugins</mm-button>
</mm-callout>

<mm-callout tone="info" compact dismissible heading="Results truncated.">Showing the first 1,000 of 1,284,019 rows.</mm-callout>`,
      react: `import { MmCallout, MmButton } from '@marmotdata/react';

<MmCallout tone="warning" heading="Credentials for snowflake-prod expire on 2 November." dismissible onMmDismiss={snooze}>
  Rotate them in Plugins before then.
  <MmButton slot="actions" size="sm" onClick={openPlugins}>Open Plugins</MmButton>
</MmCallout>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/callout.js';
  import '@marmotdata/elements/button.js';
</script>

<mm-callout tone="warning" heading="Credentials for snowflake-prod expire on 2 November." dismissible onmm-dismiss={snooze}>
  Rotate them in Plugins before then.
  <mm-button slot="actions" size="sm" onclick={openPlugins}>Open Plugins</mm-button>
</mm-callout>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

const tones = () => html`<div style="display:grid;gap:var(--space-3);max-width:640px">
  <mm-callout tone="info" heading="Lineage is still being inferred.">Query history from the last 7 days is being parsed. Edges will appear as runs finish.</mm-callout>
  <mm-callout tone="success" heading="snowflake-prod is connected.">The first run catalogued 1,284 assets. They now appear in Discover.</mm-callout>
  <mm-callout tone="warning" heading="This source has not synced for 3 days.">The last successful run was on 24 October. Check the pipeline before trusting row counts.</mm-callout>
  <mm-callout tone="danger" heading="The query was denied by policy.">Agents may not read columns tagged PII in <code>customers_dim</code>. Ask a governance lead for an exception.</mm-callout>
</div>`;

export const Tones: Story = { render: tones };

export const WithActions: Story = {
  name: 'With actions',
  render: () => html`<div style="max-width:640px">
    <mm-callout tone="warning" heading="Credentials for snowflake-prod expire on 2 November.">
      Rotate them in Plugins before then.
      <mm-button slot="actions" size="sm" variant="secondary">Open Plugins</mm-button>
      <mm-button slot="actions" size="sm" variant="ghost">Remind me tomorrow</mm-button>
    </mm-callout>
  </div>`,
};

export const Compact: Story = {
  name: 'Compact (inline alert)',
  render: () => html`<div style="display:grid;gap:var(--space-2);max-width:640px">
    <mm-callout compact tone="info" heading="Results truncated.">Showing the first 1,000 of 1,284,019 rows.</mm-callout>
    <mm-callout compact tone="warning" heading="Stale.">Last synced 3 days ago.<mm-button slot="actions" size="sm" variant="ghost">Run now</mm-button></mm-callout>
    <mm-callout compact tone="danger" dismissible>The connection test failed: password authentication failed for user "marmot".</mm-callout>
  </div>`,
};

const onDismiss = fn();
export const Dismissible: Story = {
  name: 'Keyboard: dismiss',
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:640px" @mm-dismiss=${(e: CustomEvent) => onDismiss(e.detail)}>
    <mm-callout tone="info" dismissible heading="Agents can now query through Marmot.">Set a policy per source in Governance before you invite support-triage-agent.</mm-callout>
    <mm-callout tone="warning" dismissible heading="This source has not synced for 3 days.">Check the pipeline before trusting row counts.</mm-callout>
  </div>`,
  play: async ({ canvasElement }) => {
    onDismiss.mockClear();
    const [first, second] = canvasElement.querySelectorAll('mm-callout');
    await tab();
    await expect(deepActive()).toBe(first!.shadowRoot!.querySelector('button'));
    await expect(deepActive()).toHaveAttribute('aria-label', 'Dismiss');
    await press('{Enter}');
    await expect(onDismiss).toHaveBeenCalledWith({ tone: 'info' });
    await expect(first).toHaveAttribute('hidden');
    await tab();
    await expect(deepActive()).toBe(second!.shadowRoot!.querySelector('button'));
    await press('{Escape}');
    await expect(second).toHaveAttribute('hidden');
    await expect(onDismiss).toHaveBeenCalledTimes(2);
  },
};

export const DismissCancelled: Story = {
  name: 'Dismiss can be cancelled',
  render: () => html`<mm-callout tone="warning" dismissible heading="Rotate credentials first." @mm-dismiss=${(e: Event) => e.preventDefault()}
    >snowflake-prod cannot be hidden until its credentials are rotated.</mm-callout
  >`,
  play: async ({ canvasElement }) => {
    await tab();
    await press('{Space}');
    await expect(canvasElement.querySelector('mm-callout')).not.toHaveAttribute('hidden');
  },
};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => html`<div style="max-width:640px"><mm-callout tone="info" dismissible heading="Lineage is still being inferred.">Edges appear as runs finish.</mm-callout></div>`,
};

export const Urgent: Story = {
  name: 'Urgent (role alert)',
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:640px">
    <mm-callout tone="danger" urgent heading="The query was denied by policy.">support-triage-agent may not read columns tagged PII in <code>customers_dim</code>.</mm-callout>
    <mm-callout tone="danger" heading="The last run failed.">kafka-events stopped at 04:12 UTC. Open the run log for the error.</mm-callout>
  </div>`,
  play: async ({ canvasElement }) => {
    const [urgent, calm] = canvasElement.querySelectorAll('mm-callout');
    await expect(urgent!.shadowRoot!.querySelector('.callout')).toHaveAttribute('role', 'alert');
    await expect(calm!.shadowRoot!.querySelector('.callout')).toHaveAttribute('role', 'status');
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:360px">
    <mm-callout tone="danger" dismissible heading="The connection to mrn://postgresql/table/shop.public.orders_daily_rollup_by_region failed.">
      Error: relation "shop.public.orders_daily_rollup_by_region" does not exist (SQLSTATE 42P01). Check that the plugin's schema filter still matches.
      <mm-button slot="actions" size="sm" variant="secondary">Open pipeline</mm-button>
    </mm-callout>
    <mm-callout compact tone="warning" heading="Stale.">customers_dim_with_a_very_long_identifier_v2 last synced 3 days ago.</mm-callout>
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="display:grid;gap:var(--space-3);max-width:640px">
    <mm-callout tone="warning" dismissible heading="لم تتم مزامنة هذا المصدر منذ 3 أيام.">تحقق من خط الأنابيب قبل الوثوق بعدد الصفوف.<mm-button slot="actions" size="sm">فتح الإضافات</mm-button></mm-callout>
    <mm-callout compact tone="info" heading="النتائج مقتطعة.">عرض أول 1,000 صف.</mm-callout>
  </div>`,
};

export const BothThemes: Story = { render: () => themes(tones()) };
