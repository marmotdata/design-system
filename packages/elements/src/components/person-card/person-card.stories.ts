import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/person-card.js';

type Args = { name: string; kind: string; jobTitle: string; team: string; email: string; serviceAccount: string; href: string; framed: boolean };

const meta: Meta<Args> = {
  title: 'Components/Overlays/Person card',
  component: 'mm-person-card',
  args: {
    name: 'Jane Doe',
    kind: 'person',
    jobTitle: 'Senior analytics engineer',
    team: 'Analytics Engineering',
    email: 'jane.doe@marmot.internal',
    serviceAccount: '',
    href: '#jane',
    framed: true,
  },
  argTypes: { kind: { control: 'inline-radio', options: ['person', 'agent'] } },
  render: (a) => html`<mm-person-card
    name=${a.name}
    kind=${a.kind}
    job-title=${a.jobTitle}
    team=${a.team}
    email=${a.email}
    service-account=${a.serviceAccount}
    href=${a.href}
    ?framed=${a.framed}
  ></mm-person-card>`,
  parameters: {
    usage: {
      html: `<mm-person-card framed name="Jane Doe" job-title="Senior analytics engineer" team="Analytics Engineering" email="jane.doe@marmot.internal"></mm-person-card>
<mm-person-card framed kind="agent" name="support-triage-agent" team="Customer Operations" service-account="svc-support-triage@marmot"></mm-person-card>`,
      react: `import { MmPersonCard } from '@marmotdata/react';

<MmPersonCard framed kind={p.isAgent ? 'agent' : 'person'} name={p.name} jobTitle={p.title} team={p.team}
  email={p.email} serviceAccount={p.serviceAccount} href={p.url} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/person-card.js';
</script>

<mm-person-card framed kind={p.isAgent ? 'agent' : 'person'} name={p.name} job-title={p.title} team={p.team}
  email={p.email} service-account={p.serviceAccount} href={p.url}></mm-person-card>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Person: Story = {};
export const Agent: Story = {
  args: {
    kind: 'agent',
    name: 'support-triage-agent',
    jobTitle: 'Routes support tickets using order history',
    team: 'Customer Operations',
    email: '',
    serviceAccount: 'svc-support-triage@marmot',
    href: '#support-triage-agent',
  },
};
export const Unframed: Story = { name: 'Unframed, for hover cards and popovers', args: { framed: false } };

export const Focus: Story = {
  name: 'Keyboard: name and email are links',
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelector('mm-person-card')!.shadowRoot!.querySelectorAll('a');
    await tab();
    await expect(deepActive()).toBe(links[0]);
    await tab();
    await expect(deepActive()).toBe(links[1]);
    await expect(links[1]).toHaveAttribute('href', 'mailto:jane.doe@marmot.internal');
  },
};

export const Empty: Story = { name: 'Empty: name only', render: () => html`<mm-person-card framed name="Lee Morgan"></mm-person-card>` };
export const Loading: Story = { render: () => html`<mm-person-card framed loading></mm-person-card>` };
export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-person-card framed error="This person could not be loaded. They may have left the workspace."></mm-person-card>`,
};
export const LongIdentifiers: Story = {
  name: 'Overflowing content and long identifiers',
  args: {
    kind: 'agent',
    name: 'finance-month-end-reconciliation-agent-eu-west-1-production',
    jobTitle: 'Reconciles order totals against the general ledger at month end',
    team: 'Finance Data',
    email: '',
    serviceAccount: 'svc-finance-month-end-reconciliation-eu-west-1@marmot-production.iam',
  },
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { name: 'ليلى حداد', jobTitle: 'مهندسة تحليلات', team: 'هندسة التحليلات' } };
export const BothThemes: Story = {
  render: (a) =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      ${meta.render!(a, {} as never)}
      ${meta.render!({ ...a, ...Agent.args } as Args, {} as never)}
    </div>`),
};
