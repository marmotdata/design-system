import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/kbd.js';

type Args = { keys: string; platform: string; label: string; text: string };

const hidden = (el: Element) => el.shadowRoot!.querySelector('.visually-hidden')!.textContent;
const caps = (el: Element) => [...el.shadowRoot!.querySelectorAll('.keys .key')].map((k) => k.textContent);

const meta: Meta<Args> = {
  title: 'Components/Foundations/Kbd',
  component: 'mm-kbd',
  args: { keys: 'mod+k', platform: 'auto', label: '', text: '' },
  argTypes: {
    platform: { control: 'inline-radio', options: ['auto', 'apple', 'other'] },
    text: { name: 'single key (slot)' },
  },
  render: (a) => html`<mm-kbd keys=${a.keys} platform=${a.platform} label=${a.label}>${a.text}</mm-kbd>`,
  parameters: {
    usage: {
      html: `<mm-kbd keys="mod+k"></mm-kbd>
<mm-kbd>Esc</mm-kbd>`,
      react: `import { MmKbd } from '@marmotdata/react';

<MmKbd keys="mod+k" />
<MmKbd>Esc</MmKbd>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/kbd.js';
</script>

<mm-kbd keys="mod+k"></mm-kbd>
<mm-kbd>Esc</mm-kbd>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  name: 'Command palette shortcut',
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-kbd')!;
    await expect(caps(el)).toHaveLength(2);
    await expect(['Control K', 'Command K']).toContain(hidden(el));
  },
};

export const Platforms: Story = {
  name: 'Apple and other platforms',
  render: () => html`<dl style="display:grid;grid-template-columns:auto auto;gap:var(--space-2) var(--space-5);margin:0;font:var(--text-dense);align-items:center">
    <dt style="font:var(--text-label);color:var(--mm-text-2)">macOS and iOS</dt>
    <dd style="margin:0"><mm-kbd keys="mod+k" platform="apple"></mm-kbd></dd>
    <dt style="font:var(--text-label);color:var(--mm-text-2)">Windows and Linux</dt>
    <dd style="margin:0"><mm-kbd keys="mod+k" platform="other"></mm-kbd></dd>
  </dl>`,
  play: async ({ canvasElement }) => {
    const [apple, other] = [...canvasElement.querySelectorAll('mm-kbd')];
    await expect(caps(apple!)).toEqual(['⌘', 'K']);
    await expect(hidden(apple!)).toBe('Command K');
    await expect(caps(other!)).toEqual(['Ctrl', 'K']);
    await expect(hidden(other!)).toBe('Control K');
  },
};

export const SingleKey: Story = { name: 'Single key (slotted)', args: { keys: '', text: 'Esc' } };

export const Combinations: Story = {
  render: () => html`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2);font:var(--text-dense)">
    <li><mm-kbd keys="mod+k" platform="other"></mm-kbd> Open the command palette</li>
    <li><mm-kbd keys="mod+enter" platform="other"></mm-kbd> Run query</li>
    <li><mm-kbd keys="mod+shift+p" platform="apple"></mm-kbd> Open asset rules</li>
    <li><mm-kbd keys="alt+up" platform="other"></mm-kbd> Move to the upstream asset in lineage</li>
    <li><mm-kbd keys="/"></mm-kbd> Focus search in Discover</li>
    <li><mm-kbd>?</mm-kbd> Show keyboard shortcuts</li>
  </ul>`,
  play: async ({ canvasElement }) => {
    const all = [...canvasElement.querySelectorAll('mm-kbd')];
    await expect(hidden(all[1]!)).toBe('Control Enter');
    await expect(hidden(all[2]!)).toBe('Command Shift P');
    await expect(hidden(all[3]!)).toBe('Alt Up arrow');
  },
};

export const InMenuRow: Story = {
  name: 'Beside a menu action',
  render: () => html`<div style="display:flex;align-items:center;gap:10px;width:260px;height:32px;padding:0 10px;background:var(--mm-raised);border:1px solid var(--mm-rule);border-radius:var(--radius-md);font:var(--text-dense)">
    <span style="flex:1">Copy MRN</span><mm-kbd keys="mod+shift+c" platform="other"></mm-kbd>
  </div>`,
};

export const CustomLabel: Story = { args: { keys: 'g+d', label: 'G then D' } };

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => html`<p style="margin:0;font:var(--text-dense)">افتح لوحة الأوامر <mm-kbd keys="mod+k" platform="other"></mm-kbd></p>` };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-4);align-items:center;flex-wrap:wrap">
      <mm-kbd keys="mod+k" platform="apple"></mm-kbd><mm-kbd keys="mod+k" platform="other"></mm-kbd><mm-kbd>Esc</mm-kbd><mm-kbd keys="mod+enter" platform="other"></mm-kbd>
    </div>`),
};
