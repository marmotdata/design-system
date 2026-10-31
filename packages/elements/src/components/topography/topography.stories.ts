import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/topography.js';
import '@marmotdata/elements/button.js';
import { topographyLines } from './field.ts';

type Args = { seed: number; density: 'sparse' | 'normal'; fade: 'none' | 'edges' | 'start' | 'end' };

/** A box that hosts a field: positioned and isolated, so the field sits behind the text. */
const stage = (field: unknown, body: unknown = '', style = '') => html`<section
  style="position:relative;isolation:isolate;min-height:360px;padding:var(--space-12) var(--space-8);background:var(--mm-paper);color:var(--mm-text);${style}"
>
  ${field}
  <div style="max-width:46ch">${body}</div>
</section>`;

const copy = html`<h2 style="margin:0;font:var(--text-heading)">No assets yet</h2>
  <p style="margin:var(--space-3) 0 0;font:var(--text-body);color:var(--mm-text-2)">Connect a plugin to catalogue postgres-shop.</p>`;

const meta: Meta<Args> = {
  title: 'Components/Docs and marketing/Topography',
  component: 'mm-topography',
  args: { seed: 1, density: 'normal', fade: 'none' },
  argTypes: {
    density: { control: 'inline-radio', options: ['sparse', 'normal'] },
    fade: { control: 'inline-radio', options: ['none', 'edges', 'start', 'end'] },
  },
  render: (a) => stage(html`<mm-topography seed=${a.seed} density=${a.density} fade=${a.fade}></mm-topography>`, copy),
  parameters: {
    usage: {
      html: `<section style="position: relative; isolation: isolate">
  <mm-topography seed="3" fade="edges"></mm-topography>
  <h2>No assets yet</h2>
</section>

<!-- Zero JS, from @marmotdata/css: one fixed sheet drawn by the container itself. -->
<section class="mm-topography mm-topography--fade-edges">…</section>`,
      react: `import { MmTopography } from '@marmotdata/react';

<section style={{ position: 'relative', isolation: 'isolate' }}>
  <MmTopography seed={3} fade="edges" />
  <h2>No assets yet</h2>
</section>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/topography.js';
</script>

<section style="position: relative; isolation: isolate">
  <mm-topography seed="3" fade="edges"></mm-topography>
  <h2>No assets yet</h2>
</section>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-topography')!;
    await expect(el).toHaveAttribute('aria-hidden', 'true');
    await expect(el.shadowRoot!.querySelector('svg')).toHaveAttribute('preserveAspectRatio', 'xMidYMid slice');
    await expect(topographyLines(1)).toEqual(topographyLines(1));
  },
};

export const Sparse: Story = { args: { density: 'sparse', seed: 7 } };

export const FadeEdges: Story = { name: 'Fade at the edges', args: { fade: 'edges', seed: 3 } };

export const FadeStart: Story = { name: 'Fade towards the start', args: { fade: 'start', seed: 11 } };

export const FadeEnd: Story = { name: 'Fade towards the end', args: { fade: 'end', seed: 19 } };

export const Seeds: Story = {
  name: 'Different ground by seed',
  render: () => html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">
    ${[2, 8, 15, 23].map((seed) => stage(html`<mm-topography seed=${seed}></mm-topography>`, html`<span class="mm-mono">seed ${seed}</span>`, 'min-height:200px;padding:var(--space-4)'))}
  </div>`,
};

export const BehindAnAction: Story = {
  name: 'Behind a title and an action',
  render: () => stage(
    html`<mm-topography seed="5" fade="end"></mm-topography>`,
    html`${copy}<div style="margin-block-start:var(--space-4)"><mm-button variant="primary" icon="add">Add plugin</mm-button></div>`,
  ),
};

export const ZeroJs: Story = {
  name: 'Zero-JS class from @marmotdata/css',
  render: () => html`<section class="mm-topography mm-topography--fade-edges" style="min-height:360px;padding:var(--space-12) var(--space-8)">
    <div style="max-width:46ch">${copy}</div>
  </section>`,
};

export const Ultrawide: Story = {
  name: 'Ultrawide box',
  render: () => html`<div style="width:3440px">${stage(html`<mm-topography seed="3" fade="start"></mm-topography>`, copy, 'min-height:600px')}</div>`,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-topography')!;
    // A box far wider than 3:2 gets a wider sheet, not the standard one stretched.
    await waitFor(() => expect(Number(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[2])).toBeGreaterThan(2400));
    // Strokes stay hairlines however far the sheet is scaled.
    await expect(getComputedStyle(el.shadowRoot!.querySelector('path')!).vectorEffect).toBe('non-scaling-stroke');
    // The standard sheet is unchanged by the width option.
    await expect(topographyLines(1, 'normal', 1200)).toEqual(topographyLines(1));
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { fade: 'start', seed: 11 } };

export const BothThemes: Story = {
  render: () => themes(stage(html`<mm-topography seed="3" fade="edges"></mm-topography>`, copy, 'background:transparent')),
};
