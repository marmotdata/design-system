import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/drawer.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/textarea.js';
import '@marmotdata/elements/copy-button.js';
import '@marmotdata/elements/callout.js';
import '@marmotdata/elements/skeleton.js';
import type { MmDrawer } from './class.ts';

type Args = { heading: string; description: string; size: string; placement: string };

const drawerOf = (root: ParentNode) => root.querySelector('mm-drawer')!;
const native = (d: MmDrawer) => d.shadowRoot!.querySelector('dialog')!;
const inner = (el: Element | null) => el?.shadowRoot?.querySelector('button, input, textarea') ?? null;
const opened = async (d: MmDrawer) => {
  await waitFor(() => expect(native(d).open).toBe(true));
  await Promise.all(native(d).getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)));
};
const closed = (d: MmDrawer) => waitFor(() => expect(native(d).open).toBe(false));
const openNext = (e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as MmDrawer).show();

const CLI = `marmot agents connect support-triage-agent \\
  --service-account svc-support-triage@marmot \\
  --scope "catalog:read lineage:read query:run"`;
const API = `curl -X POST https://marmot.internal/api/v1/agents \\
  -H "Authorization: Bearer $MARMOT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"support-triage-agent","service_account":"svc-support-triage@marmot"}'`;

const snippet = (label: string, code: string) => html`<section style="display:grid;gap:var(--space-2)">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)">
    <h3 style="margin:0;font:var(--text-heading-sm)">${label}</h3>
    <mm-copy-button value=${code} label=${`Copy ${label.toLowerCase()}`} size="sm"></mm-copy-button>
  </div>
  <pre
    dir="ltr"
    tabindex="0"
    aria-label=${label}
    style="margin:0;padding:var(--space-3) var(--space-4);overflow:auto;background:var(--mm-code-bg);color:var(--mm-code-text);border-radius:var(--radius-md);font:var(--text-mono-editor)"
  >${code}</pre>
</section>`;

const connectBlade = html`<div style="display:grid;gap:var(--space-6)">
  <p style="margin:0;font:var(--text-dense);color:var(--mm-text-2);max-width:65ch">
    Run either command from a machine that can reach Marmot. The agent appears on Home under Agents once it makes its first request.
  </p>
  ${snippet('CLI', CLI)} ${snippet('API', API)}
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Overlays/Drawer',
  component: 'mm-drawer',
  args: { heading: 'Connect an agent', description: 'Agents query the catalog with their own service account and scopes.', size: 'md', placement: 'end' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'full'] },
    placement: { control: 'inline-radio', options: ['end', 'start', 'bottom'] },
  },
  render: (a) => html`
    <mm-button class="trigger" variant="primary" icon="smart-toy" @click=${openNext}>Connect agent</mm-button>
    <mm-drawer heading=${a.heading} description=${a.description} size=${a.size} placement=${a.placement}>
      ${connectBlade}
      <mm-button slot="footer" variant="secondary" data-close="done">Done</mm-button>
    </mm-drawer>
  `,
  parameters: {
    usage: {
      html: `<mm-button id="connect" variant="primary" icon="smart-toy">Connect agent</mm-button>
<mm-drawer id="connect-drawer" heading="Connect an agent" description="Agents query the catalog with their own service account and scopes.">
  …CLI and API snippets…
  <mm-button slot="footer" variant="secondary" data-close="done">Done</mm-button>
</mm-drawer>
<script>
  connect.addEventListener('click', () => document.getElementById('connect-drawer').show());
</script>`,
      react: `import { MmButton, MmDrawer } from '@marmotdata/react';

<MmButton variant="primary" icon="smart-toy" onClick={() => setOpen(true)}>Connect agent</MmButton>
<MmDrawer heading="Connect an agent" open={open} onMmClose={() => setOpen(false)}>
  <ConnectSnippets agent="support-triage-agent" />
  <MmButton slot="footer" variant="secondary" data-close="done">Done</MmButton>
</MmDrawer>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/drawer.js';
  let open = $state(false);
</script>

<mm-button variant="primary" icon="smart-toy" onclick={() => (open = true)}>Connect agent</mm-button>
<mm-drawer heading="Connect an agent" {open} onmm-close={() => (open = false)}>
  <ConnectSnippets agent="support-triage-agent" />
  <mm-button slot="footer" variant="secondary" data-close="done">Done</mm-button>
</mm-drawer>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

/** The ConnectBlade: CLI and API snippets to connect an agent. */
export const ConnectBlade: Story = {
  name: 'Open: connect an agent',
  play: async ({ canvasElement }) => {
    const d = drawerOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(d);
    await expect(d).not.toHaveAttribute('data-instant');
  },
};

const onCreate = fn();
export const CreateForm: Story = {
  name: 'Create form',
  render: () => html`
    <mm-button class="trigger" variant="primary" icon="add" @click=${openNext}>New data product</mm-button>
    <mm-drawer heading="New data product" @mm-close=${(e: CustomEvent) => e.detail.returnValue === 'create' && onCreate()}>
      <div style="display:grid;gap:var(--space-4)">
        <mm-text-field label="Name" value="Order analytics" required></mm-text-field>
        <mm-text-field label="Owner" value="Analytics Engineering"></mm-text-field>
        <mm-textarea label="Description" value="Daily order facts and customer dimensions for revenue reporting."></mm-textarea>
      </div>
      <mm-button slot="footer" variant="secondary" data-close="cancel">Cancel</mm-button>
      <mm-button slot="footer" variant="primary" data-close="create">Create data product</mm-button>
    </mm-drawer>
  `,
  play: async ({ canvasElement }) => {
    onCreate.mockClear();
    const d = drawerOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(d);
    await expect(d).toHaveAttribute('data-instant');
    await waitFor(() => expect(deepActive()).toBe(inner(d.querySelector('mm-text-field'))));
    const close = inner(d.shadowRoot!.querySelector('.close'));
    const create = inner(d.querySelector('mm-button[data-close="create"]'));
    await tab(true);
    await expect(deepActive()).toBe(close);
    await tab(true);
    await expect(deepActive()).toBe(create);
    await press('{Enter}');
    await closed(d);
    await expect(onCreate).toHaveBeenCalled();
  },
};

export const EscapeReturnsFocus: Story = {
  name: 'Keyboard: Escape closes and returns focus',
  play: async ({ canvasElement }) => {
    const d = drawerOf(canvasElement);
    const trigger = canvasElement.querySelector('mm-button.trigger')!;
    await tab();
    await press('{Enter}');
    await opened(d);
    await press('{Escape}');
    await closed(d);
    await expect(deepActive()).toBe(inner(trigger));
    await expect(document.documentElement.style.overflow).toBe('');
  },
};

export const Start: Story = { name: 'Placement: start', args: { placement: 'start', size: 'sm' }, play: ConnectBlade.play };
export const Bottom: Story = { name: 'Placement: bottom', args: { placement: 'bottom' }, play: ConnectBlade.play };
export const Large: Story = { name: 'Size: lg', args: { size: 'lg' }, play: ConnectBlade.play };

export const Loading: Story = {
  name: 'Loading content',
  render: () => html`
    <mm-button class="trigger" variant="primary" icon="smart-toy" @click=${openNext}>Connect agent</mm-button>
    <mm-drawer heading="Connect an agent" size="sm">
      <mm-skeleton loading shape="text" count="6"></mm-skeleton>
    </mm-drawer>
  `,
  play: ConnectBlade.play,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`
    <mm-button class="trigger" variant="primary" icon="smart-toy" @click=${openNext}>Connect agent</mm-button>
    <mm-drawer heading="Connect an agent">
      <mm-callout tone="danger" heading="Could not create a token">
        Your role cannot create service account tokens. Ask a workspace admin in Settings, then open this again.
      </mm-callout>
      <mm-button slot="footer" variant="secondary" data-close="close">Close</mm-button>
    </mm-drawer>
  `,
  play: ConnectBlade.play,
};

export const LongContent: Story = {
  name: 'Overflowing content and long identifiers',
  render: () => html`
    <mm-button class="trigger" variant="primary" icon="smart-toy" @click=${openNext}>Connect agent</mm-button>
    <mm-drawer heading="Connect finance-month-end-reconciliation-agent-eu-west-1-production">
      <div style="display:grid;gap:var(--space-6)">
        ${Array.from({ length: 6 }, (_, i) => snippet(`Step ${i + 1}`, i % 2 ? API : CLI))}
      </div>
      <mm-button slot="footer" variant="secondary" data-close="done">Done</mm-button>
    </mm-drawer>
  `,
  play: ConnectBlade.play,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { heading: 'ربط وكيل', description: 'تستعلم الوكلاء عن الكتالوج بحساب خدمة خاص بها.' },
  play: ConnectBlade.play,
};

export const Peat: Story = { parameters: { theme: 'dark' }, play: ConnectBlade.play };

export const BothThemes: Story = {
  render: (a) =>
    themes(html`
      <mm-button class="trigger" variant="primary" icon="smart-toy" @click=${openNext}>Connect agent</mm-button>
      <mm-drawer heading=${a.heading} description=${a.description}>${connectBlade}</mm-drawer>
    `),
  play: async ({ canvasElement }) => {
    const peat = canvasElement.querySelector('[data-theme="dark"]') as HTMLElement;
    const d = drawerOf(peat);
    await click(peat.querySelector('mm-button')!);
    await opened(d);
  },
};
