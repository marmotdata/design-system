import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/org-switcher.js';
import type { MmOrgSwitcher, Organisation } from './class.ts';

type Args = { collapsed: boolean; disabled: boolean; noCreate: boolean };

const orgs: Organisation[] = [
  {
    id: 'northwind',
    name: 'Northwind Freight',
    workspaces: [
      { id: 'nw-prod', name: 'Production', plan: 'Team' },
      { id: 'nw-staging', name: 'Staging', plan: 'Team' },
      { id: 'nw-sandbox', name: 'Analytics sandbox', plan: 'Free' },
    ],
  },
  {
    id: 'harbour',
    name: 'Harbour Logistics',
    workspaces: [
      { id: 'hb-prod', name: 'Production', plan: 'Enterprise' },
      { id: 'hb-research', name: 'Data platform research', plan: 'Enterprise' },
    ],
  },
];

const longOrgs: Organisation[] = [
  {
    id: 'rail',
    name: 'Great Western and Northern Rail Infrastructure Services Limited',
    workspaces: [
      { id: 'r1', name: 'Timetabling and capacity planning analytics (production, EU West)', plan: 'Enterprise' },
      { id: 'r2', name: 'Signalling telemetry ingestion staging environment', plan: 'Enterprise' },
    ],
  },
];

const onSwitch = fn();
/** Pointer opens fade in over --mm-dur-menu; let it finish before the accessibility check. */
const settle = () => new Promise((r) => setTimeout(r, 300));
const onCreate = fn();

const switcher = (a: Partial<Args>, data = orgs, org = 'northwind', ws = 'nw-prod') => html`<div
  style="height:440px;display:flex;align-items:flex-end;width:${a.collapsed ? '56px' : '240px'};padding:var(--space-2);background:var(--mm-sunken);border:1px solid var(--mm-rule)"
  @mm-switch=${(e: CustomEvent) => onSwitch(e.detail)}
  @mm-create-workspace=${(e: CustomEvent) => onCreate(e.detail)}
>
  <mm-org-switcher style="flex:1" .orgs=${data} org=${org} workspace=${ws} ?collapsed=${!!a.collapsed} ?disabled=${!!a.disabled} ?no-create=${!!a.noCreate}></mm-org-switcher>
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Org switcher',
  component: 'mm-org-switcher',
  args: { collapsed: false, disabled: false, noCreate: false },
  render: (a) => switcher(a),
  parameters: {
    usage: {
      html: `<mm-org-switcher slot="footer" org="northwind" workspace="nw-prod"></mm-org-switcher>
<script>
  document.querySelector('mm-org-switcher').orgs = [
    { id: 'northwind', name: 'Northwind Freight', workspaces: [{ id: 'nw-prod', name: 'Production', plan: 'Team' }] },
  ];
</script>`,
      react: `import { MmOrgSwitcher } from '@marmotdata/react';

<MmOrgSwitcher slot="footer" orgs={orgs} org={org.id} workspace={workspace.id}
  onMmSwitch={(e) => goto(\`/\${e.detail.org}/\${e.detail.workspace}\`)}
  onMmCreateWorkspace={() => setCreating(true)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/org-switcher.js';
</script>

<mm-org-switcher slot="footer" orgs={data.orgs} org={data.org} workspace={data.workspace}
  onmm-switch={(e) => goto(\`/\${e.detail.org}/\${e.detail.workspace}\`)}
  onmm-create-workspace={() => (creating = true)}></mm-org-switcher>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (root: HTMLElement) => {
  const el = root.querySelector('mm-org-switcher') as MmOrgSwitcher;
  const sr = el.shadowRoot!;
  return {
    el,
    trigger: sr.querySelector('.trigger') as HTMLButtonElement,
    pop: sr.querySelector('.pop') as HTMLElement,
    input: () => sr.querySelector('input') as HTMLInputElement,
    options: () => [...sr.querySelectorAll<HTMLElement>('[role="option"]')],
    active: () => {
      const id = sr.querySelector('input')?.getAttribute('aria-activedescendant');
      return id ? sr.getElementById(id) : null;
    },
    create: () => sr.querySelector('.create') as HTMLButtonElement | null,
  };
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const { trigger } = parts(canvasElement);
    await expect(trigger).toHaveTextContent('Northwind Freight');
    await expect(trigger).toHaveTextContent('Production');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(parts(canvasElement).trigger);
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { el, trigger, pop, input, active, options } = parts(canvasElement);
    await click(trigger);
    await waitFor(() => expect(pop.matches(':popover-open')).toBe(true));
    await expect(el.open).toBe(true);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await expect(options()).toHaveLength(5);
    await expect(active()).toHaveTextContent('Production');
    await expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    await expect(pop.querySelectorAll('[role="group"]')).toHaveLength(2);
    await settle();
  },
};

export const KeyboardNavigate: Story = {
  name: 'Keyboard: arrows move, Enter switches and returns focus',
  play: async ({ canvasElement }) => {
    onSwitch.mockClear();
    const { el, trigger, input, active } = parts(canvasElement);
    trigger.focus();
    await press('{ArrowDown}');
    await waitFor(() => expect(el.open).toBe(true));
    await waitFor(() => expect(deepActive()).toBe(input()));
    await press('{ArrowDown}');
    await expect(active()).toHaveTextContent('Staging');
    await press('{ArrowUp}{ArrowUp}');
    await expect(active()).toHaveTextContent('Data platform research');
    await press('{Home}');
    await expect(active()).toHaveTextContent('Production');
    await press('{End}');
    await expect(active()).toHaveTextContent('Data platform research');
    await press('{Enter}');
    await expect(onSwitch).toHaveBeenCalledWith({ org: 'harbour', workspace: 'hb-research' });
    await waitFor(() => expect(el.open).toBe(false));
    await expect(deepActive()).toBe(trigger);
    await expect(trigger).toHaveTextContent('Harbour Logistics');
  },
};

export const TypeaheadSearch: Story = {
  name: 'Keyboard: typing filters the workspaces',
  play: async ({ canvasElement }) => {
    onSwitch.mockClear();
    const { el, trigger, input, options, active } = parts(canvasElement);
    trigger.focus();
    await press('{Enter}');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await press('stag');
    await waitFor(() => expect(options()).toHaveLength(1));
    await expect(active()).toHaveTextContent('Staging');
    // Organisation names match too.
    await press('{Escape}');
    await expect(el.open).toBe(true);
    await expect(input().value).toBe('');
    await press('harbour');
    await waitFor(() => expect(options()).toHaveLength(2));
    await press('{ArrowDown}{Enter}');
    await expect(onSwitch).toHaveBeenCalledWith({ org: 'harbour', workspace: 'hb-research' });
  },
};

export const NoMatches: Story = {
  name: 'Search with no matches',
  play: async ({ canvasElement }) => {
    const { trigger, input, el } = parts(canvasElement);
    trigger.focus();
    await press('{Enter}');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await press('snowflake');
    await waitFor(() => expect(el.shadowRoot!.querySelector('.empty')).toHaveTextContent('No workspaces match “snowflake”.'));
    await expect(input()).not.toHaveAttribute('aria-activedescendant');
  },
};

export const EscapeCloses: Story = {
  name: 'Keyboard: Escape closes and returns focus',
  play: async ({ canvasElement }) => {
    const { el, trigger, input } = parts(canvasElement);
    trigger.focus();
    await press('{Space}');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await press('{Escape}');
    await waitFor(() => expect(el.open).toBe(false));
    await expect(deepActive()).toBe(trigger);
  },
};

export const CreateWorkspace: Story = {
  name: 'Keyboard: Tab reaches Create workspace',
  play: async ({ canvasElement }) => {
    onCreate.mockClear();
    const { el, trigger, input, create } = parts(canvasElement);
    trigger.focus();
    await press('{Enter}');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await tab();
    await expect(deepActive()).toBe(create());
    await press('{Enter}');
    await expect(onCreate).toHaveBeenCalledWith({ org: 'northwind' });
    await waitFor(() => expect(el.open).toBe(false));
    await expect(deepActive()).toBe(trigger);
  },
};

export const PointerChoose: Story = {
  name: 'Pointer: click a workspace',
  play: async ({ canvasElement }) => {
    onSwitch.mockClear();
    const { el, trigger, options } = parts(canvasElement);
    await click(trigger);
    await waitFor(() => expect(el.open).toBe(true));
    await click(options()[2]!);
    await expect(onSwitch).toHaveBeenCalledWith({ org: 'northwind', workspace: 'nw-sandbox' });
    await waitFor(() => expect(el.open).toBe(false));
  },
};

export const SwitchCancelled: Story = {
  name: 'Cancelling mm-switch keeps the workspace',
  render: (a) => html`<div @mm-switch=${(e: Event) => e.preventDefault()}>${switcher(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { el, trigger } = parts(canvasElement);
    trigger.focus();
    await press('{Enter}');
    await waitFor(() => expect(el.open).toBe(true));
    await press('{ArrowDown}{Enter}');
    await expect(el.workspace).toBe('nw-prod');
    await press('{Escape}');
  },
};

export const Collapsed: Story = {
  name: 'Collapsed rail',
  args: { collapsed: true },
  play: async ({ canvasElement }) => {
    const { trigger, el, input } = parts(canvasElement);
    await expect(trigger).toHaveTextContent('Switch workspace: Northwind Freight, Production');
    await expect(trigger.querySelector('.names')).toBeNull();
    trigger.focus();
    await press('{Enter}');
    await waitFor(() => expect(deepActive()).toBe(input()));
    await press('{Escape}');
    await waitFor(() => expect(el.open).toBe(false));
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const { el, trigger } = parts(canvasElement);
    await expect(trigger).toBeDisabled();
    trigger.click();
    await expect(el.open).toBe(false);
  },
};

export const WithoutCreate: Story = { name: 'Without Create workspace', args: { noCreate: true } };

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: (a) => switcher(a, longOrgs, 'rail', 'r1'),
  play: async ({ canvasElement }) => {
    const { el, trigger } = parts(canvasElement);
    await click(trigger);
    await waitFor(() => expect(el.open).toBe(true));
    await settle();
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-3);align-items:center;width:240px">
      <mm-org-switcher style="flex:1" .orgs=${orgs} org="northwind" workspace="nw-prod"></mm-org-switcher>
      <mm-org-switcher .orgs=${orgs} org="harbour" workspace="hb-prod" collapsed></mm-org-switcher>
    </div>`),
};
