import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/visually-hidden.js';
import '@marmotdata/elements/link.js';

type Args = { focusable: boolean; text: string };

const skip = html`<div style="position:relative;min-height:120px;padding-block-start:var(--space-12)">
  <mm-visually-hidden focusable><mm-link href="#main-content">Skip to main content</mm-link></mm-visually-hidden>
  <div style="display:flex;gap:var(--space-4);font:var(--text-dense)">
    <mm-link href="#discover" muted>Discover</mm-link><mm-link href="#query" muted>Query</mm-link><mm-link href="#insights" muted>Insights</mm-link>
  </div>
  <div id="main-content" tabindex="-1" style="margin-block-start:var(--space-4);font:var(--text-body)">Main content (a <code>main</code> landmark in the app)</div>
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Visually hidden',
  component: 'mm-visually-hidden',
  args: { focusable: false, text: 'Sorted by last run, newest first' },
  argTypes: { text: { name: 'hidden text (slot)' } },
  render: (a) => html`<p style="font:var(--text-dense);margin:0">The hidden text below is read by screen readers only.</p>
    <mm-visually-hidden ?focusable=${a.focusable}>${a.text}</mm-visually-hidden>`,
  parameters: {
    usage: {
      html: `<mm-visually-hidden focusable><mm-link href="#main">Skip to main content</mm-link></mm-visually-hidden>
<mm-visually-hidden>Sorted by last run, newest first</mm-visually-hidden>`,
      react: `import { MmVisuallyHidden, MmLink } from '@marmotdata/react';

<MmVisuallyHidden focusable><MmLink href="#main">Skip to main content</MmLink></MmVisuallyHidden>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/visually-hidden.js';
</script>

<mm-visually-hidden focusable><mm-link href="#main">Skip to main content</mm-link></mm-visually-hidden>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-visually-hidden')!;
    const r = el.getBoundingClientRect();
    await expect(r.width).toBeLessThanOrEqual(1);
    await expect(el.textContent).toContain('Sorted by last run');
  },
};

export const IconButtonContext: Story = {
  name: 'Adding context to a short label',
  render: () => html`<p style="font:var(--text-dense);margin:0">
    3 failed runs <mm-visually-hidden>for the orders_daily pipeline in the last 24 hours</mm-visually-hidden>
  </p>`,
};

export const SkipLink: Story = {
  name: 'Skip link: shown on focus',
  render: () => skip,
  play: async ({ canvasElement }) => {
    const wrapper = canvasElement.querySelector('mm-visually-hidden')!;
    await expect(wrapper.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await tab();
    const link = canvasElement.querySelector('mm-visually-hidden mm-link')!;
    await expect(deepActive()).toBe(link.shadowRoot!.querySelector('a'));
    await expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(24);
    await tab();
    await expect(wrapper.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => skip };

export const BothThemes: Story = {
  render: () => themes(skip),
  play: async ({ canvasElement }) => {
    await tab();
    await expect(canvasElement.querySelector('mm-visually-hidden')!.getBoundingClientRect().width).toBeGreaterThan(24);
  },
};
