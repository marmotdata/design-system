import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { click, deepActive, nextFrame, press } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import { isApple } from '@marmotdata/elements/core/platform.js';
import '@marmotdata/elements/shortcut-help.js';
import '@marmotdata/elements/button.js';
import type { MmShortcutHelp, Shortcut } from './class.ts';

const help = (root: HTMLElement) => root.querySelector('mm-shortcut-help')!;
const shadow = (root: HTMLElement) => help(root).shadowRoot!;
const captions = (root: HTMLElement) => [...shadow(root).querySelectorAll('caption')].map((c) => c.textContent!.trim());

type Args = { open: boolean };

const meta: Meta<Args> = {
  title: 'Components/Overlays/Keyboard shortcuts',
  component: 'mm-shortcut-help',
  args: { open: true },
  render: (a) => html`<mm-shortcut-help ?open=${a.open}></mm-shortcut-help>`,
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, iframeHeight: 720 } },
    usage: {
      html: `<mm-shortcut-help global-shortcut></mm-shortcut-help>
<script type="module">
  import '@marmotdata/elements/shortcut-help.js';
  // Optional: replace or extend the default Marmot set.
  // document.querySelector('mm-shortcut-help').shortcuts = [...defaultShortcuts(), { group: 'Lineage', description: 'Expand upstream', keys: 'u' }];
</script>`,
      react: `import { MmShortcutHelp } from '@marmotdata/react';
import { defaultShortcuts } from '@marmotdata/elements/shortcut-help.js';

<MmShortcutHelp globalShortcut shortcuts={[...defaultShortcuts(), { group: 'Lineage', description: 'Expand upstream', keys: 'u' }]} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/shortcut-help.js';
</script>

<!-- Opens with "?" when focus is not in a text field. Call .show() from the command palette. -->
<mm-shortcut-help global-shortcut></mm-shortcut-help>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const DefaultOpen: Story = {
  name: 'Default open',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('dialog')!.open).toBe(true));
    await expect(captions(canvasElement)).toEqual(['Global', 'Navigation', 'Query editor', 'Lineage', 'Tables']);
    // Keys are formatted for the platform.
    const first = shadow(canvasElement).querySelector('mm-kbd')!;
    await expect(first.getAttribute('keys')).toBe('mod+k');
    await expect(first.shadowRoot!.querySelector('.key')!.textContent).toBe(isApple() ? '⌘' : 'Ctrl');
  },
};

export const Filtered: Story = {
  name: 'Filtered',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('dialog')!.open).toBe(true));
    await expect(deepActive()).toBe(shadow(canvasElement).querySelector('input'));
    await press('zoom');
    await expect(captions(canvasElement)).toEqual(['Lineage']);
    await expect(shadow(canvasElement).querySelectorAll('tbody tr').length).toBe(2);
  },
};

export const NoMatches: Story = {
  name: 'Empty filter result',
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(shadow(canvasElement).querySelector('dialog')!.open).toBe(true));
    await press('rollback');
    await expect(shadow(canvasElement).querySelector('.empty')!.textContent).toBe('No shortcuts match “rollback”.');
    // Escape clears the filter first, then closes.
    await press('{Escape}');
    await expect(help(canvasElement).open).toBe(true);
    await expect(captions(canvasElement).length).toBe(5);
    await press('{Escape}');
    await expect(help(canvasElement).open).toBe(false);
  },
};

const custom: Shortcut[] = [
  { group: 'Query editor', description: 'Run query', keys: 'mod+enter' },
  { group: 'Query editor', description: 'Run the selected statement', keys: 'mod+shift+enter' },
  { group: 'Query editor', description: 'Format SQL', keys: 'mod+shift+f' },
  { group: 'Query editor', description: 'Toggle comment', keys: 'mod+/' },
  { group: 'Asset page', description: 'Go to lineage tab', keys: 'g l' },
  { group: 'Asset page', description: 'Copy MRN', keys: 'mod+shift+c' },
];
export const CustomSet: Story = {
  name: 'Custom shortcuts',
  render: () => html`<mm-shortcut-help open .shortcuts=${custom}></mm-shortcut-help>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };

export const BothThemes: Story = {
  parameters: { layout: 'padded', docs: { story: { inline: true } } },
  render: () => themes(html`<mm-shortcut-help inline></mm-shortcut-help>`),
};

export const KeyboardQuestionMark: Story = {
  name: 'Keyboard: ? opens, not while typing; Escape returns focus',
  args: { open: false },
  parameters: { layout: 'padded' },
  render: () => html`<mm-shortcut-help global-shortcut></mm-shortcut-help>
    <div style="display:flex;gap:var(--space-4);align-items:end">
      <mm-button variant="secondary" icon="keyboard">Keyboard shortcuts</mm-button>
      <label style="display:grid;gap:var(--space-1)"
        ><span style="font:var(--text-label);color:var(--mm-text-2)">Query name</span><input id="name" style="font:var(--text-dense)"
      /></label>
    </div>`,
  play: async ({ canvasElement }) => {
    const el = help(canvasElement) as MmShortcutHelp;
    const field = canvasElement.querySelector<HTMLInputElement>('#name')!;
    await click(field);
    await press('?');
    await expect(el.open).toBe(false);
    await expect(field.value).toBe('?');

    const trigger = canvasElement.querySelector('mm-button')!;
    trigger.focus();
    const before = deepActive();
    // Measure: open in the same frame, with no transition.
    let openAtFrame = false;
    const frame = new Promise<void>((r) => requestAnimationFrame(() => ((openAtFrame = el.open && shadow(canvasElement).querySelector('dialog')!.open), r())));
    await press('?');
    await frame;
    await expect(openAtFrame).toBe(true);
    await expect(getComputedStyle(shadow(canvasElement).querySelector('dialog')!).transitionDuration).toBe('0s');
    await expect(deepActive()).toBe(shadow(canvasElement).querySelector('input'));
    await press('{Escape}');
    await nextFrame();
    await expect(el.open).toBe(false);
    await expect(deepActive()).toBe(before);
  },
};
