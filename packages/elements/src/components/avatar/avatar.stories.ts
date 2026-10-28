import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/avatar.js';

type Args = { name: string; kind: string; size: number; src: string; decorative: boolean };

const meta: Meta<Args> = {
  title: 'Components/Data/Avatar',
  component: 'mm-avatar',
  args: { name: 'Jane Doe', kind: 'person', size: 24, src: '', decorative: false },
  argTypes: {
    kind: { control: 'inline-radio', options: ['person', 'agent', 'team'] },
    size: { control: 'inline-radio', options: [20, 24, 32, 40] },
  },
  render: (a) => html`<mm-avatar name=${a.name} kind=${a.kind} size=${a.size} src=${a.src} ?decorative=${a.decorative}></mm-avatar>`,
  parameters: {
    docs: {
      description: {
        component:
          'The icon carries the kind (robot for agents, groups for teams) and the accessible name says it. Not interactive.',
      },
    },
    usage: {
      html: `<mm-avatar name="Jane Doe"></mm-avatar>
<mm-avatar name="support-triage-agent" kind="agent"></mm-avatar>
<mm-avatar name="Analytics Engineering" kind="team" size="32"></mm-avatar>

<mm-avatar-stack label="Owners" max="3">
  <mm-avatar name="Jane Doe"></mm-avatar>
  <mm-avatar name="Dana Price"></mm-avatar>
  <mm-avatar name="support-triage-agent" kind="agent"></mm-avatar>
  <mm-avatar name="Jordan Lee"></mm-avatar>
</mm-avatar-stack>`,
      react: `import { MmAvatar, MmAvatarStack } from '@marmotdata/react';

<MmAvatarStack label="Owners" max={3}>
  {owners.map((o) => (
    <MmAvatar key={o.id} name={o.name} kind={o.kind} src={o.photoUrl} />
  ))}
</MmAvatarStack>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/avatar.js';
</script>

<mm-avatar-stack label="Owners" max={3}>
  {#each owners as o (o.id)}
    <mm-avatar name={o.name} kind={o.kind} src={o.photoUrl}></mm-avatar>
  {/each}
</mm-avatar-stack>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const span = canvasElement.querySelector('mm-avatar')!.shadowRoot!.querySelector('.avatar')!;
    await expect(span).toHaveAttribute('role', 'img');
    await expect(span).toHaveAttribute('aria-label', 'Jane Doe');
    await expect(span.textContent!.trim()).toBe('JD');
  },
};

const kinds = () => html`<div style="display:flex;gap:var(--space-4);align-items:center">
  <mm-avatar name="Jane Doe"></mm-avatar>
  <mm-avatar name="support-triage-agent" kind="agent"></mm-avatar>
  <mm-avatar name="Analytics Engineering" kind="team"></mm-avatar>
</div>`;

export const Kinds: Story = {
  render: kinds,
  play: async ({ canvasElement }) => {
    const [, agent, team] = Array.from(canvasElement.querySelectorAll('mm-avatar')).map((a) => a.shadowRoot!.querySelector('.avatar')!);
    await expect(agent).toHaveAttribute('aria-label', 'support-triage-agent, agent');
    await expect(agent!.querySelector('mm-icon')).toHaveAttribute('name', 'smart-toy');
    await expect(team).toHaveAttribute('aria-label', 'Analytics Engineering, team');
  },
};

const sizes = () => html`<div style="display:grid;gap:var(--space-3)">
  ${(['person', 'agent', 'team'] as const).map(
    (k) => html`<div style="display:flex;gap:var(--space-4);align-items:center">
      ${[20, 24, 32, 40].map(
        (s) =>
          html`<mm-avatar size=${s} kind=${k} name=${k === 'person' ? 'Jane Doe' : k === 'agent' ? 'support-triage-agent' : 'Data Platform'}></mm-avatar>`,
      )}
    </div>`,
  )}
</div>`;

export const Sizes: Story = { render: sizes };

export const ImageFailsToLoad: Story = {
  name: 'Error: photo fails to load',
  args: { src: '/missing/jane-doe.jpg', size: 40 },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('mm-avatar')!.shadowRoot!;
    await waitFor(() => expect(root.querySelector('img')).toBeNull());
    await expect(root.querySelector('[part="initials"]')!.textContent).toBe('JD');
  },
};

export const Decorative: Story = {
  render: () => html`<span style="display:inline-flex;gap:var(--space-2);align-items:center;font:var(--text-dense)">
    <mm-avatar name="Jane Doe" decorative size="20"></mm-avatar>Jane Doe
  </span>`,
  play: async ({ canvasElement }) => {
    const span = canvasElement.querySelector('mm-avatar')!.shadowRoot!.querySelector('.avatar')!;
    await expect(span).toHaveAttribute('aria-hidden', 'true');
    await expect(span).not.toHaveAttribute('role');
  },
};

const stack = (size = 24) => html`<mm-avatar-stack label="Owners of customers_dim" size=${size}>
  <mm-avatar name="Jane Doe"></mm-avatar>
  <mm-avatar name="support-triage-agent" kind="agent"></mm-avatar>
  <mm-avatar name="Analytics Engineering" kind="team"></mm-avatar>
  <mm-avatar name="Dana Price"></mm-avatar>
  <mm-avatar name="Jordan Lee"></mm-avatar>
  <mm-avatar name="Morgan Clark"></mm-avatar>
  <mm-avatar name="dbt-docs-agent" kind="agent"></mm-avatar>
</mm-avatar-stack>`;

export const Stack: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4)">${stack(20)}${stack(24)}${stack(32)}</div>`,
  play: async ({ canvasElement }) => {
    const s = canvasElement.querySelector('mm-avatar-stack')!;
    await waitFor(() => expect(s.shadowRoot!.querySelector('.count')).not.toBeNull());
    const count = s.shadowRoot!.querySelector('.count')!;
    await expect(count.textContent).toContain('+4');
    await expect(count.textContent).toContain('and 4 more: Dana Price, Jordan Lee, Morgan Clark, dbt-docs-agent');
    await expect(s.querySelectorAll('[data-mm-overflow]').length).toBe(4);
  },
};

export const StackOnPanel: Story = {
  name: 'Stack on a panel surface',
  render: () => html`<div style="background:var(--mm-surface);border:1px solid var(--mm-rule);border-radius:var(--radius-md);padding:var(--space-4);--mm-avatar-stack-ring:var(--mm-surface)">
    ${stack()}
  </div>`,
};

export const LongIdentifiers: Story = {
  render: () => html`<div style="display:flex;gap:var(--space-4);align-items:center">
    <mm-avatar name="warehouse-cost-anomaly-detection-agent-eu-west-1" kind="agent" size="32"></mm-avatar>
    <mm-avatar name="Alexandra Elizabeth Montgomery-Smith" size="32"></mm-avatar>
    <mm-avatar name="o'brien.siobhan@marmot.example" size="32"></mm-avatar>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => html`${kinds()}<div style="margin-top:var(--space-4)">${stack()}</div>` };

export const BothThemes: Story = { render: () => themes(html`${sizes()}<div style="margin-top:var(--space-4)">${stack()}</div>`) };
