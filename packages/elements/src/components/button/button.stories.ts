import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, userEvent } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/button.js';

type Args = { variant: string; size: string; icon: string; label: string; disabled: boolean; loading: boolean; text: string };

const meta: Meta<Args> = {
  title: 'Components/Actions/Button',
  component: 'mm-button',
  args: { variant: 'primary', size: 'md', icon: '', label: '', disabled: false, loading: false, text: 'Run query' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
    text: { name: 'label text (slot)' },
  },
  render: (a) =>
    html`<mm-button variant=${a.variant} size=${a.size} icon=${a.icon} label=${a.label} ?disabled=${a.disabled} ?loading=${a.loading}>${a.text}</mm-button>`,
  parameters: {
    usage: {
      html: `<mm-button variant="primary" icon="play-arrow">Run query</mm-button>
<mm-button variant="danger" icon="delete">Delete asset</mm-button>
<mm-button variant="ghost" icon="content-copy" label="Copy MRN"></mm-button>`,
      react: `import { MmButton } from '@marmotdata/react';

<MmButton variant="primary" icon="play-arrow" onClick={run}>Run query</MmButton>
<MmButton variant="danger" icon="delete" onClick={confirmDelete}>Delete asset</MmButton>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/button.js';
</script>

<mm-button variant="primary" icon="play-arrow" onclick={run}>Run query</mm-button>
<mm-button variant="danger" icon="delete" onclick={confirmDelete}>Delete asset</mm-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Primary: Story = { args: { icon: 'play-arrow' } };
export const Secondary: Story = { args: { variant: 'secondary', text: 'Add plugin', icon: 'add' } };
export const Ghost: Story = { args: { variant: 'ghost', text: 'View lineage', icon: 'account-tree' } };
export const Danger: Story = { args: { variant: 'danger', text: 'Delete asset', icon: 'delete' } };
export const Small: Story = { args: { size: 'sm', variant: 'secondary', text: 'Run now', icon: 'play-arrow' } };

export const AllVariants: Story = {
  render: () => html`<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center">
    <mm-button variant="primary" icon="play-arrow">Run query</mm-button>
    <mm-button variant="secondary" icon="add">Add plugin</mm-button>
    <mm-button variant="ghost" icon="account-tree">View lineage</mm-button>
    <mm-button variant="danger" icon="delete">Delete asset</mm-button>
    <mm-button variant="secondary" size="sm" icon="play-arrow">Run now</mm-button>
    <mm-button variant="ghost" icon="content-copy" label="Copy MRN"></mm-button>
  </div>`,
};

export const IconOnly: Story = {
  args: { variant: 'ghost', icon: 'more-horiz', label: 'More actions', text: '' },
  play: async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('mm-button')!;
    const inner = btn.shadowRoot!.querySelector('button')!;
    await expect(inner).toHaveAttribute('aria-label', 'More actions');
  },
};

export const Hover: Story = { args: { icon: 'play-arrow' }, parameters: { pseudo: { hover: true } }, render: () => html`<div style="display:flex;gap:var(--space-2)">
  <mm-button variant="primary">Run query</mm-button><mm-button variant="secondary">Add plugin</mm-button><mm-button variant="ghost">View lineage</mm-button><mm-button variant="danger" icon="delete">Delete asset</mm-button></div>` };
export const Active: Story = { parameters: { pseudo: { active: true } }, render: Hover.render };
export const Focus: Story = {
  args: { icon: 'play-arrow' },
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};
export const Disabled: Story = { render: () => html`<div style="display:flex;gap:var(--space-2)">
  <mm-button variant="primary" disabled>Run query</mm-button><mm-button variant="secondary" disabled>Add plugin</mm-button><mm-button variant="ghost" disabled>View lineage</mm-button><mm-button variant="danger" icon="delete" disabled>Delete asset</mm-button></div>` };
export const Loading: Story = { args: { loading: true, text: 'Running query' } };
export const LongLabel: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:260px;display:grid;gap:var(--space-2)">
    <mm-button variant="secondary" icon="table">Open mrn://postgresql/table/shop.public.orders_daily_rollup</mm-button>
    <p style="font:var(--text-caption);color:var(--mm-text-2);margin:0">Labels never wrap. Keep them to a verb and an object; long identifiers belong in the page, not the button.</p>
  </div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { icon: 'arrow-forward', text: 'تشغيل الاستعلام' } };

export const KeyboardActivation: Story = {
  name: 'Keyboard: Enter and Space activate',
  args: { text: 'Run query', icon: 'play-arrow' },
  render: (a) => html`<mm-button variant="primary" icon=${a.icon} @click=${onClick}>${a.text}</mm-button>`,
  play: async () => {
    onClick.mockClear();
    await tab();
    await press('{Enter}');
    await press('{Space}');
    await expect(onClick).toHaveBeenCalledTimes(2);
  },
};
const onClick = fn();

export const SubmitsForm: Story = {
  name: 'Submits a native form',
  render: () => html`<form @submit=${(e: SubmitEvent) => { e.preventDefault(); onSubmit(new FormData(e.target as HTMLFormElement, e.submitter).get('intent')); }}>
    <mm-button variant="primary" type="submit" name="intent" value="run">Run query</mm-button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    await userEvent.click(canvasElement.querySelector('mm-button')!);
    await expect(onSubmit).toHaveBeenCalledWith('run');
  },
};
const onSubmit = fn();

export const DisabledBlocksActivation: Story = {
  render: () => html`<mm-button variant="primary" disabled @click=${onClick}>Run query</mm-button>`,
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    await userEvent.click(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button')!);
    await expect(onClick).not.toHaveBeenCalled();
  },
};

export const BothThemes: Story = { render: () => themes(AllVariants.render!({} as Args, {} as never)) };
