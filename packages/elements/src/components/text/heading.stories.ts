import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/text.js';

type Args = { level: number; variant: string; text: string };

const scale = html`<div style="display:grid;gap:var(--space-5)">
  <mm-heading level="1" variant="display-title">orders_daily</mm-heading>
  <mm-heading level="2" variant="heading">Run history</mm-heading>
  <mm-heading level="3" variant="heading-sm">Upstream assets</mm-heading>
  <mm-heading level="4" variant="panel-title">Needs attention</mm-heading>
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Heading',
  component: 'mm-heading',
  args: { level: 1, variant: 'display-title', text: 'orders_daily' },
  argTypes: {
    level: { control: { type: 'number', min: 1, max: 6 } },
    variant: { control: 'select', options: ['display-hero', 'display-title', 'display-section', 'heading', 'heading-sm', 'panel-title'] },
    text: { name: 'heading text (slot)' },
  },
  render: (a) => html`<mm-heading level=${a.level} variant=${a.variant}>${a.text}</mm-heading>`,
  parameters: {
    usage: {
      html: `<mm-heading level="1">orders_daily</mm-heading>
<mm-heading level="2" variant="panel-title">Needs attention</mm-heading>`,
      react: `import { MmHeading } from '@marmotdata/react';

<MmHeading level={1}>orders_daily</MmHeading>
<MmHeading level={2} variant="panel-title">Needs attention</MmHeading>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/text.js';
</script>

<mm-heading level="1">orders_daily</mm-heading>
<mm-heading level="2" variant="panel-title">Needs attention</mm-heading>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const PageTitle: Story = {
  play: async ({ canvasElement }) => {
    const h = canvasElement.querySelector('mm-heading')!.shadowRoot!.querySelector('h1')!;
    await expect(h).toBeTruthy();
    await expect(getComputedStyle(h).fontVariantNumeric).toContain('tabular-nums');
  },
};

export const Scale: Story = { name: 'Type scale', render: () => scale };

export const LevelIndependentOfLook: Story = {
  name: 'Level and look are independent',
  render: () => html`<section aria-labelledby="pipelines" style="display:grid;gap:var(--space-2);max-width:360px">
    <mm-heading id="pipelines" level="2" variant="panel-title">Pipelines</mm-heading>
    <p style="margin:0;font:var(--text-dense);color:var(--mm-text-2)">3 of 12 pipelines failed in the last 24 hours.</p>
  </section>`,
  play: async ({ canvasElement }) => {
    const h = canvasElement.querySelector('mm-heading')!.shadowRoot!.querySelector('h2')!;
    await expect(h.className).toContain('panel-title');
  },
};

export const DefaultsFromLevel: Story = {
  name: 'Variant defaults from level',
  render: () => html`<div style="display:grid;gap:var(--space-3)">
    <mm-heading level="1">Insights</mm-heading>
    <mm-heading level="2">Asset activity</mm-heading>
    <mm-heading level="3">Most queried assets</mm-heading>
    <mm-heading level="4">This week</mm-heading>
  </div>`,
  play: async ({ canvasElement }) => {
    const cls = [...canvasElement.querySelectorAll('mm-heading')].map((h) => h.shadowRoot!.querySelector('.h')!.className);
    await expect(cls).toEqual(['h display-title', 'h heading', 'h heading-sm', 'h panel-title']);
  },
};

export const DisplayNumbers: Story = {
  name: 'Display numbers are tabular',
  render: () => html`<mm-heading level="1" variant="display-hero">1,284,019 rows</mm-heading>`,
};

export const DisplayFloor: Story = {
  name: 'Display face is never below 24px',
  render: () => html`<style>
      .too-small::part(heading) { font-size: 18px; }
    </style>
    <mm-heading class="too-small" level="2" variant="display-section">Recent runs</mm-heading>
    <p style="margin:var(--space-2) 0 0;font:var(--text-caption);color:var(--mm-text-2)">Styled to 18px, so it falls back to the text face.</p>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-heading')!;
    await new Promise((r) => requestAnimationFrame(r));
    await el.updateComplete;
    await expect(el.shadowRoot!.querySelector('.h')!.className).toBe('h heading');
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:320px"><mm-heading level="1">customer_lifetime_value_by_acquisition_channel_monthly</mm-heading></div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { text: 'الطلبات اليومية' } };

export const BothThemes: Story = { render: () => themes(scale) };
