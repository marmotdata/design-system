import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/timeline.js';
import '@marmotdata/elements/link.js';

type Args = { orientation: 'vertical' | 'horizontal' };

const approval = () => html`<mm-timeline label="Access request for finance.payments" style="max-width:560px">
  <mm-timeline-item state="done" state-label="Requested" heading="Access requested" time="2026-10-19T08:14:03Z" actor="Jane Doe">
    Read access to finance.payments for the quarterly reconciliation.
  </mm-timeline-item>
  <mm-timeline-item state="done" state-label="Approved" heading="Approved by Data Platform" time="2026-10-19T10:02:41Z" actor="Morgan Clark">
    Approved for 14 days. Columns tagged PII stay masked.
  </mm-timeline-item>
  <mm-timeline-item
    state="done"
    state-label="Applied"
    heading="Grant applied"
    time="2026-10-19T10:02:44Z"
    actor="access-provisioner-agent"
    actor-kind="agent"
    service-account="svc-access"
  ></mm-timeline-item>
  <mm-timeline-item state="pending" state-label="Scheduled" heading="Access expires" time="2026-11-02T10:02:44Z">
    Request an extension before 2 November to keep reading finance.payments.
  </mm-timeline-item>
</mm-timeline>`;

const phases = (variant: 'finished' | 'running' | 'failed' = 'finished') => html`<mm-timeline
  orientation="horizontal"
  label="Run 8121 phases"
  style="max-width:760px"
>
  <mm-timeline-item state="done" heading="Queued" time="2026-10-27T04:12:00.000Z"></mm-timeline-item>
  <mm-timeline-item state="done" heading="Started" time="2026-10-27T04:12:02.300Z"></mm-timeline-item>
  <mm-timeline-item
    state=${variant === 'running' ? 'running' : 'done'}
    heading="Extracting"
    time="2026-10-27T04:12:03.000Z"
  ></mm-timeline-item>
  <mm-timeline-item
    state=${variant === 'running' ? 'pending' : variant === 'failed' ? 'failed' : 'done'}
    heading="Writing"
    time=${variant === 'running' ? '' : '2026-10-27T04:15:15.000Z'}
  ></mm-timeline-item>
  <mm-timeline-item
    state=${variant === 'finished' ? 'done' : 'pending'}
    heading=${variant === 'failed' ? 'Not finished' : 'Finished'}
    time=${variant === 'finished' ? '2026-10-27T04:15:16.200Z' : ''}
  ></mm-timeline-item>
</mm-timeline>`;

const runs = () => html`<mm-timeline label="Run history for postgres-shop" style="max-width:560px">
  <mm-timeline-item state="done" state-label="Succeeded" heading="Run 8121" time="2026-10-27T04:12:00Z">
    Triggered by schedule. Catalogued 1,284,019 rows across 212 assets in 3.3 min.
  </mm-timeline-item>
  <mm-timeline-item state="failed" heading="Run 8120" time="2026-10-26T04:12:00Z">
    Triggered by schedule. Connection refused by db-shop-replica-2.internal:5432 after 3 attempts.
  </mm-timeline-item>
  <mm-timeline-item state="running" heading="Run 8122" time="2026-10-27T09:58:12Z" actor="Jane Doe">
    Extracting schema for shop.public.
  </mm-timeline-item>
</mm-timeline>`;

const meta: Meta<Args> = {
  title: 'Components/Data/Timeline',
  component: 'mm-timeline',
  args: { orientation: 'vertical' },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] } },
  render: (a) => (a.orientation === 'horizontal' ? phases() : approval()),
  parameters: {
    docs: {
      description: {
        component:
          'Node shapes and a word give each step\'s state. No keyboard model of its own.',
      },
    },
    usage: {
      html: `<mm-timeline label="Access request for finance.payments">
  <mm-timeline-item state="done" state-label="Requested" heading="Access requested" time="2026-10-19T08:14:03Z" actor="Jane Doe">
    Read access to finance.payments for the quarterly reconciliation.
  </mm-timeline-item>
  <mm-timeline-item state="pending" heading="Access expires" time="2026-11-02T10:02:44Z"></mm-timeline-item>
</mm-timeline>

<mm-timeline orientation="horizontal" label="Run 8121 phases">
  <mm-timeline-item state="done" heading="Queued" time="2026-10-27T04:12:00Z"></mm-timeline-item>
  <mm-timeline-item state="done" heading="Started" time="2026-10-27T04:12:02.3Z"></mm-timeline-item>
</mm-timeline>`,
      react: `import { MmTimeline, MmTimelineItem } from '@marmotdata/react';

<MmTimeline orientation="horizontal" label={\`Run \${run.id} phases\`}>
  {run.phases.map((p) => (
    <MmTimelineItem key={p.name} state={p.state} heading={p.name} time={p.startedAt} />
  ))}
</MmTimeline>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/timeline.js';
</script>

<mm-timeline label="Access request">
  {#each steps as s (s.id)}
    <mm-timeline-item state={s.state} state-label={s.word} heading={s.title} time={s.at} actor={s.by}>{s.note}</mm-timeline-item>
  {/each}
</mm-timeline>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Approval: Story = {
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll('mm-timeline-item');
    await expect(items[0]).toHaveAttribute('role', 'listitem');
    await expect(items[3]).toHaveAttribute('last');
    await expect(items[1]!.shadowRoot!.querySelector('.word')!.textContent).toBe('Approved');
    await expect(items[0]!.shadowRoot!.querySelector('time')!.textContent).toBe('2026-10-19 08:14:03\u00a0UTC');
  },
};

export const RunHistory: Story = {
  name: 'Run history with a failure',
  render: runs,
  play: async ({ canvasElement }) => {
    const failed = canvasElement.querySelectorAll('mm-timeline-item')[1]!.shadowRoot!;
    await expect(failed.querySelector('.word')!.textContent).toBe('Failed');
    await expect(failed.querySelector('.node path.x')).not.toBeNull();
  },
};

export const RunPhases: Story = {
  name: 'Horizontal: run phases',
  args: { orientation: 'horizontal' },
  play: async ({ canvasElement }) => {
    const items = Array.from(canvasElement.querySelectorAll('mm-timeline-item'));
    await waitFor(() => expect(items[0]!.shadowRoot!.querySelector('.dur')).not.toBeNull());
    const durs = items.map((i) => i.shadowRoot!.querySelector('.dur [aria-hidden]')?.textContent ?? '');
    await expect(durs).toEqual(['2.3\u00a0s', '700\u00a0ms', '3.2\u00a0min', '1.2\u00a0s', '']);
    await expect(items[0]!.shadowRoot!.querySelector('.dur .visually-hidden')!.textContent).toBe('2.3\u00a0s until Started');
  },
};

export const Running: Story = { name: 'Horizontal: running', render: () => phases('running') };
export const Failed: Story = { name: 'Horizontal: failed', render: () => phases('failed') };

export const Loading: Story = {
  render: () => html`<mm-timeline label="Run 8122 phases" orientation="horizontal">
    <mm-timeline-item state="running" heading="Queued" time="2026-10-27T09:58:12Z"></mm-timeline-item>
    <mm-timeline-item state="pending" heading="Started"></mm-timeline-item>
    <mm-timeline-item state="pending" heading="Extracting"></mm-timeline-item>
    <mm-timeline-item state="pending" heading="Writing"></mm-timeline-item>
    <mm-timeline-item state="pending" heading="Finished"></mm-timeline-item>
  </mm-timeline>`,
};

export const Empty: Story = {
  render: () => html`<mm-timeline label="Approval history"></mm-timeline>
    <p style="font:var(--text-dense);color:var(--mm-text-2);margin:0">This request has no history yet. Steps appear here as reviewers act on it.</p>`,
};

export const WithLinks: Story = {
  name: 'Focus: links in the body',
  render: () => html`<mm-timeline label="Schema changes for shop.orders.v2" style="max-width:560px">
    <mm-timeline-item state="done" state-label="Detected" heading="Column refund_reason added" time="2026-10-26T13:40:00Z">
      Picked up from the schema registry. <mm-link href="#/assets/shop.orders.v2/schema">View schema diff</mm-link>
    </mm-timeline-item>
    <mm-timeline-item state="pending" heading="Review by Analytics Engineering"></mm-timeline-item>
  </mm-timeline>`,
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:320px">
    <mm-timeline label="Access request">
      <mm-timeline-item state="done" heading="Access requested for finance.payments_reconciliation_daily_snapshot and three related views" time="2026-10-19T08:14:03Z" actor="Alexandra Elizabeth Montgomery-Smith">
        Needed to reconcile the October card settlements against the ledger before month end close.
      </mm-timeline-item>
      <mm-timeline-item state="failed" state-label="Denied" heading="Denied by Data Platform" time="2026-10-19T10:02:41Z" actor="warehouse-cost-anomaly-detection-agent" actor-kind="agent" service-account="svc-finops-anomaly"></mm-timeline-item>
    </mm-timeline>
    <div style="margin-top:var(--space-6)">${phases()}</div>
  </div>`,
};

export const LongIdentifiers: Story = {
  render: () => html`<mm-timeline label="Lineage changes" style="max-width:560px">
    <mm-timeline-item state="done" heading="Upstream added: mrn://snowflake/table/analytics.marts.finance.fct_payments_reconciled_daily_v3" time="2026-10-27T07:01:00Z" actor="dbt-docs-agent" actor-kind="agent" service-account="svc-dbt-docs"></mm-timeline-item>
  </mm-timeline>`,
};

export const CompactDensity: Story = { globals: { density: 'compact' }, render: () => html`${approval()}<div style="margin-top:var(--space-6)">${phases()}</div>` };
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => html`${approval()}<div style="margin-top:var(--space-6)">${phases()}</div>` };
export const BothThemes: Story = { render: () => themes(html`${runs()}<div style="margin-top:var(--space-6)">${phases('failed')}</div>`) };
