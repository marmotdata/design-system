import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/owner-chip.js';
import type { MmOwnerChip, OwnerRemoveDetail } from './class.ts';

type Args = { name: string; kind: string; href: string; serviceAccount: string; removable: boolean };

const meta: Meta<Args> = {
  title: 'Components/Data/Owner chip',
  component: 'mm-owner-chip',
  args: { name: 'Jane Doe', kind: 'person', href: '', serviceAccount: '', removable: false },
  argTypes: { kind: { control: 'inline-radio', options: ['person', 'agent', 'team'] } },
  render: (a) =>
    html`<mm-owner-chip name=${a.name} kind=${a.kind} href=${a.href} service-account=${a.serviceAccount} ?removable=${a.removable}></mm-owner-chip>`,
  parameters: {
    docs: {
      description: {
        component:
          'Keyboard: Tab reaches the name link and the remove button; Enter, Space, Delete or Backspace on the remove button fire `mm-remove`.',
      },
    },
    usage: {
      html: `<mm-owner-chip name="Jane Doe" href="/people/jane-doe" hover-card job-title="Analytics engineer"></mm-owner-chip>
<mm-owner-chip name="support-triage-agent" kind="agent" service-account="svc-support"></mm-owner-chip>
<mm-owner-chip name="Analytics Engineering" kind="team" removable></mm-owner-chip>`,
      react: `import { MmOwnerChip } from '@marmotdata/react';

{owners.map((o) => (
  <MmOwnerChip key={o.id} name={o.name} kind={o.kind} removable onMmRemove={() => removeOwner(o.id)} />
))}`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/owner-chip.js';
</script>

{#each owners as o (o.id)}
  <mm-owner-chip name={o.name} kind={o.kind} removable onmm-remove={() => removeOwner(o.id)}></mm-owner-chip>
{/each}`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const kinds = () => html`<div style="display:grid;gap:var(--space-3);justify-items:start">
  <mm-owner-chip name="Jane Doe"></mm-owner-chip>
  <mm-owner-chip name="support-triage-agent" kind="agent" service-account="svc-support"></mm-owner-chip>
  <mm-owner-chip name="Analytics Engineering" kind="team"></mm-owner-chip>
</div>`;

const removable = () => html`<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
  <mm-owner-chip removable name="Jane Doe"></mm-owner-chip>
  <mm-owner-chip removable name="support-triage-agent" kind="agent"></mm-owner-chip>
  <mm-owner-chip removable name="Analytics Engineering" kind="team"></mm-owner-chip>
</div>`;

export const Person: Story = {};
export const Agent: Story = {
  args: { name: 'support-triage-agent', kind: 'agent', serviceAccount: 'svc-support' },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('mm-owner-chip')!.shadowRoot!;
    // The kind word is for screen readers only; the robot avatar shows it visually.
    const kind = root.querySelector('[part="kind"]')!;
    await expect(kind.textContent).toContain('Agent');
    await expect(kind).toHaveClass('visually-hidden');
    await expect(root.querySelector('.sa')!.textContent).toContain('svc-support');
    await expect(root.querySelector('mm-avatar')).toHaveAttribute('kind', 'agent');
  },
};
export const Team: Story = { args: { name: 'Analytics Engineering', kind: 'team' } };
export const AllKinds: Story = { render: kinds };

export const Linked: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-3);justify-items:start">
    <mm-owner-chip name="Jane Doe" href="#/people/jane-doe"></mm-owner-chip>
    <mm-owner-chip name="Analytics Engineering" kind="team" href="#/teams/analytics-engineering"></mm-owner-chip>
  </div>`,
};

export const WithHoverCard: Story = {
  render: () => html`<div style="min-height:220px">
    <mm-owner-chip
      name="Jane Doe"
      href="#/people/jane-doe"
      hover-card
      job-title="Analytics engineer"
      team="Analytics Engineering"
      email="jane.doe@marmot.example"
    ></mm-owner-chip>
    <span style="margin-inline:var(--space-4)"></span>
    <mm-owner-chip
      name="support-triage-agent"
      kind="agent"
      href="#/agents/support-triage-agent"
      hover-card
      team="Customer Support"
      service-account="svc-support"
    ></mm-owner-chip>
  </div>`,
  play: async ({ canvasElement }) => {
    await tab();
    const chip = canvasElement.querySelector('mm-owner-chip')!;
    await expect(deepActive()?.textContent).toBe('Jane Doe');
    const card = chip.shadowRoot!.querySelector('mm-hover-card')!;
    await waitFor(() => expect(card.open).toBe(true), { timeout: 2000 });
    await press('{Escape}');
    await waitFor(() => expect(card.open).toBe(false));
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: () => html`${removable()}<div style="margin-top:var(--space-3)"><mm-owner-chip name="Jane Doe" href="#/people/jane-doe"></mm-owner-chip></div>` };

export const Focus: Story = {
  render: removable,
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-owner-chip')!.shadowRoot!.querySelector('.remove'));
  },
};

export const Removable: Story = { render: removable };

const onRemove = fn();
export const KeyboardRemove: Story = {
  name: 'Keyboard: remove owners',
  render: () => html`<div
    style="display:flex;gap:var(--space-2);flex-wrap:wrap"
    @mm-remove=${(e: CustomEvent<OwnerRemoveDetail>) => {
      onRemove(e.detail);
      const chip = e.target as MmOwnerChip;
      const next = (chip.nextElementSibling ?? chip.previousElementSibling) as MmOwnerChip | null;
      chip.remove();
      next?.shadowRoot?.querySelector<HTMLElement>('.remove')?.focus();
    }}
  >
    <mm-owner-chip removable name="Jane Doe"></mm-owner-chip>
    <mm-owner-chip removable name="support-triage-agent" kind="agent"></mm-owner-chip>
    <mm-owner-chip removable name="Analytics Engineering" kind="team"></mm-owner-chip>
  </div>`,
  play: async ({ canvasElement }) => {
    onRemove.mockClear();
    const first = canvasElement.querySelector('mm-owner-chip')!;
    await expect(first.shadowRoot!.querySelector('.remove')).toHaveAttribute('aria-label', 'Remove Jane Doe');
    await tab();
    await press('{Enter}');
    await expect(onRemove).toHaveBeenLastCalledWith({ name: 'Jane Doe', kind: 'person' });
    await waitFor(() => expect(deepActive()?.getAttribute('aria-label')).toBe('Remove support-triage-agent'));
    await press('{Delete}');
    await expect(onRemove).toHaveBeenLastCalledWith({ name: 'support-triage-agent', kind: 'agent' });
    await press('{Backspace}');
    await press('{Space}');
    await expect(onRemove).toHaveBeenCalledTimes(3);
    await expect(canvasElement.querySelectorAll('mm-owner-chip').length).toBe(0);
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:220px;display:grid;gap:var(--space-2);border:1px dashed var(--mm-rule);padding:var(--space-2)">
    <mm-owner-chip name="Alexandra Elizabeth Montgomery-Smith"></mm-owner-chip>
    <mm-owner-chip name="warehouse-cost-anomaly-agent" kind="agent" service-account="svc-warehouse-cost-anomaly-eu-west-1"></mm-owner-chip>
    <mm-owner-chip removable name="Customer Data Platform Governance" kind="team"></mm-owner-chip>
  </div>`,
};

export const LongIdentifiers: Story = {
  args: { name: 'warehouse-cost-anomaly-detection-agent-eu-west-1', kind: 'agent', serviceAccount: 'svc-finops-anomaly-detection-prod' },
};

export const InTableCell: Story = {
  name: 'Compact density',
  globals: { density: 'compact' },
  render: () => html`<div style="display:grid;gap:var(--space-1);font:var(--text-dense)">
    <mm-owner-chip name="Jane Doe" avatar-size="20"></mm-owner-chip>
    <mm-owner-chip name="support-triage-agent" kind="agent" service-account="svc-support"></mm-owner-chip>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => html`${kinds()}<div style="margin-top:var(--space-3)">${removable()}</div>` };

export const BothThemes: Story = { render: () => themes(html`${kinds()}<div style="margin-top:var(--space-3)">${removable()}</div>`) };
