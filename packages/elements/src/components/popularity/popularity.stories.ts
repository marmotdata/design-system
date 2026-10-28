import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/popularity.js';

type Args = { level: number };

const meta: Meta<Args> = {
  title: 'Components/Status/Popularity',
  component: 'mm-popularity',
  args: { level: 3 },
  argTypes: { level: { control: 'inline-radio', options: [1, 2, 3, 4] } },
  render: (a) => html`<mm-popularity level=${a.level}></mm-popularity>`,
  parameters: {
    usage: {
      html: `<mm-popularity level="3"></mm-popularity>`,
      react: `import { MmPopularity } from '@marmotdata/react';

<MmPopularity level={asset.popularity} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/popularity.js';
</script>

<mm-popularity level={asset.popularity}></mm-popularity>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Levels: Story = {
  render: () => html`<div style="display:flex;gap:var(--space-5);align-items:center">
    <mm-popularity level="1"></mm-popularity>
    <mm-popularity level="2"></mm-popularity>
    <mm-popularity level="3"></mm-popularity>
    <mm-popularity level="4"></mm-popularity>
  </div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: () => themes(Levels.render!({} as Args, {} as never)) };
export const AccessibleName: Story = {
  name: 'Level is the accessible name',
  args: { level: 4 },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-popularity')!;
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Popularity: very high');
  },
};
