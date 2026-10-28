import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/lineage-legend.js';

type Args = { compact: boolean; open: boolean };

const meta: Meta<Args> = {
  title: 'Components/Lineage/Lineage legend',
  component: 'mm-lineage-legend',
  args: { compact: false, open: false },
  render: (a) => html`<mm-lineage-legend ?compact=${a.compact} ?open=${a.open}></mm-lineage-legend>`,
  parameters: {
    usage: {
      html: `<mm-lineage-legend></mm-lineage-legend>
<mm-lineage-legend compact></mm-lineage-legend>`,
      react: `import { MmLineageLegend } from '@marmotdata/react';

<MmLineageLegend compact />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/lineage-legend.js';
</script>

<mm-lineage-legend compact onmm-toggle={(e) => (legendOpen = e.detail.open)}></mm-lineage-legend>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Compact: Story = { args: { compact: true } };
export const CompactOpen: Story = { name: 'Compact, open', args: { compact: true, open: true } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: () => themes(html`<mm-lineage-legend></mm-lineage-legend>`) };

const onToggle = fn();
export const KeyboardCompact: Story = {
  name: 'Keyboard: open, close with Escape',
  render: () => html`<mm-lineage-legend compact @mm-toggle=${(e: CustomEvent) => onToggle(e.detail)}></mm-lineage-legend>`,
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const legend = canvasElement.querySelector('mm-lineage-legend')!;
    await tab();
    const btn = legend.shadowRoot!.querySelector('button')!;
    await expect(deepActive()).toBe(btn);
    await press('{Enter}');
    await legend.updateComplete;
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(legend.shadowRoot!.querySelector('.panel')).not.toBeNull();
    await press('{Escape}');
    await legend.updateComplete;
    await expect(legend.open).toBe(false);
    await expect(deepActive()).toBe(btn);
    await press('{Space}');
    await expect(onToggle).toHaveBeenLastCalledWith({ open: true });
  },
};
