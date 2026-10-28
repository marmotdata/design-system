import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/logo.js';

type Args = { variant: string; size: number; label: string; clearSpace: boolean };

const sizes = { wordmark: [16, 24, 32, 48], monogram: [16, 24, 32] } as const;

const row = (variant: keyof typeof sizes) =>
  html`<div style="display:flex;gap:var(--space-6);align-items:flex-end;flex-wrap:wrap">
    ${sizes[variant].map(
      (s) => html`<figure style="margin:0;display:grid;gap:var(--space-2);justify-items:start">
        <mm-logo variant=${variant} size=${s}></mm-logo>
        <figcaption style="font:var(--text-mono-dense);color:var(--mm-text-2)">${s}px</figcaption>
      </figure>`,
    )}
  </div>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Logo',
  component: 'mm-logo',
  args: { variant: 'wordmark', size: 32, label: 'Marmot', clearSpace: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['wordmark', 'monogram'] },
    size: { control: { type: 'number', min: 12, max: 160, step: 4 } },
  },
  render: (a) => html`<mm-logo variant=${a.variant} size=${a.size} label=${a.label} ?clear-space=${a.clearSpace}></mm-logo>`,
  parameters: {
    usage: {
      html: `<a href="/" aria-label="Marmot home"><mm-logo size="24" label=""></mm-logo></a>
<mm-logo variant="monogram" size="24"></mm-logo>`,
      react: `import { MmLogo } from '@marmotdata/react';

<a href="/" aria-label="Marmot home"><MmLogo size={24} label="" /></a>
<MmLogo variant="monogram" size={24} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/logo.js';
</script>

<a href="/" aria-label="Marmot home"><mm-logo size="24" label=""></mm-logo></a>
<mm-logo variant="monogram" size="24"></mm-logo>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Wordmark: Story = {
  play: async ({ canvasElement }) => {
    const named = canvasElement.querySelector('mm-logo')!.shadowRoot!.querySelector('[part="logo"]')!;
    await expect(named).toHaveAttribute('role', 'img');
    await expect(named).toHaveAttribute('aria-label', 'Marmot');
  },
};
/** The wordmark's own "M", for the collapsed sidebar rail and other narrow places. */
export const Monogram: Story = { args: { variant: 'monogram', size: 32 } };

export const WordmarkSizes: Story = { name: 'Wordmark at several sizes, both themes', render: () => themes(row('wordmark')) };
export const MonogramSizes: Story = { name: 'Monogram at several sizes, both themes', render: () => themes(row('monogram')) };

/** The dashed rule marks the minimum clear space. Nothing else enters this area. */
export const ClearSpace: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-5);justify-items:start">
      ${(['wordmark', 'monogram'] as const).map(
        (v) => html`<mm-logo variant=${v} size="40" clear-space style="outline:1px dashed var(--mm-text-3);outline-offset:-1px"></mm-logo>`,
      )}
    </div>`),
};

export const Decorative: Story = {
  name: 'Inside a named link',
  render: () => html`<a href="#home" aria-label="Marmot home" style="display:inline-flex;color:inherit">
    <mm-logo size="24" label=""></mm-logo>
  </a>`,
  play: async ({ canvasElement }) => {
    const inner = canvasElement.querySelector('mm-logo')!.shadowRoot!.querySelector('[part="logo"]')!;
    await expect(inner).toHaveAttribute('aria-hidden', 'true');
  },
};

/** The wordmark is artwork, so it is never mirrored in right-to-left pages. */
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { size: 32 } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-8);align-items:center;flex-wrap:wrap">
      <mm-logo size="32"></mm-logo>
      <mm-logo variant="monogram" size="32"></mm-logo>
    </div>`),
};
