import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { press } from '../../../../../apps/storybook/src/support/keys.ts';
import '@marmotdata/elements/coachmark.js';
import '@marmotdata/elements/button.js';
import type { MmCoachmark } from './class.ts';

type Args = { heading: string; step: number; steps: number; placement: string; blocking: boolean };

const card = (c: MmCoachmark) => c.shadowRoot!.querySelector<HTMLElement>('.card')!;
const shown = (c: MmCoachmark) => waitFor(() => expect(card(c).hasAttribute('data-shown')).toBe(true));

const onDismiss = fn();
const meta: Meta<Args> = {
  title: 'Components/Overlays/Coachmark',
  component: 'mm-coachmark',
  args: { heading: 'Run your first pipeline', step: 3, steps: 7, placement: 'bottom-start', blocking: false },
  argTypes: { placement: { control: 'select', options: ['bottom-start', 'bottom-end', 'top-start', 'right-start', 'left-start'] } },
  render: (a) => html`<div style="display:grid;gap:var(--space-6);justify-items:start;padding:var(--space-8)">
      <mm-button id="new-pipeline" variant="primary" icon="add">New pipeline</mm-button>
      <p style="margin:0;font:var(--text-dense);color:var(--mm-text-2)">orders_daily · 1,284,019 rows</p>
    </div>
    <mm-coachmark
      open
      for="new-pipeline"
      heading=${a.heading}
      step=${a.step}
      steps=${a.steps}
      placement=${a.placement}
      ?blocking=${a.blocking}
      @mm-dismiss=${(e: CustomEvent) => onDismiss(e.detail.reason)}
    >
      A pipeline reads a system on a schedule and catalogues what it finds. Choose the tutorial source to load a demo coffee shop.
      <mm-button slot="actions" variant="ghost">Back</mm-button>
      <mm-button slot="actions" variant="primary">Next</mm-button>
    </mm-coachmark>`,
  parameters: {
    usage: {
      html: `<mm-button id="new-pipeline" variant="primary" icon="add">New pipeline</mm-button>

<mm-coachmark open for="new-pipeline" heading="Run your first pipeline" step="3" steps="7">
  A pipeline reads a system on a schedule and catalogues what it finds.
  <mm-button slot="actions" variant="ghost">Back</mm-button>
  <mm-button slot="actions" variant="primary">Next</mm-button>
</mm-coachmark>`,
      react: `import { MmButton, MmCoachmark } from '@marmotdata/react';

<MmCoachmark open target={buttonRef.current} heading="Run your first pipeline" step={3} steps={7} onMmDismiss={endTour}>
  A pipeline reads a system on a schedule and catalogues what it finds.
  <MmButton slot="actions" variant="primary" onClick={next}>Next</MmButton>
</MmCoachmark>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/coachmark.js';
</script>

<mm-coachmark open target={button} heading="Run your first pipeline" step={3} steps={7} onmm-dismiss={endTour}>
  A pipeline reads a system on a schedule and catalogues what it finds.
  <mm-button slot="actions" variant="primary" onclick={next}>Next</mm-button>
</mm-coachmark>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const c = canvasElement.querySelector('mm-coachmark')!;
    await shown(c);
    await expect(c.shadowRoot!.querySelector('.progress')?.textContent).toBe('3 of 7');
    await waitFor(() => expect(c.shadowRoot!.activeElement).toBe(card(c)));
  },
};

export const EscapeAsksToDismiss: Story = {
  play: async ({ canvasElement }) => {
    onDismiss.mockClear();
    const c = canvasElement.querySelector('mm-coachmark')!;
    await shown(c);
    await waitFor(() => expect(c.shadowRoot!.activeElement).toBe(card(c)));
    await press('{Escape}');
    await expect(onDismiss).toHaveBeenCalledWith('escape');
  },
};

export const Centred: Story = {
  args: { heading: 'Welcome to Marmot', step: 1, steps: 7 },
  render: (a) => html`<mm-coachmark open heading=${a.heading} step=${a.step} steps=${a.steps}>
    Take two minutes to load a demo source, explore what it catalogues and ask a question of its data.
    <mm-button slot="actions" variant="ghost">Skip the tour</mm-button>
    <mm-button slot="actions" variant="primary">Start</mm-button>
  </mm-coachmark>`,
  play: async ({ canvasElement }) => {
    const c = canvasElement.querySelector('mm-coachmark')!;
    await shown(c);
    await expect(card(c).hasAttribute('data-centred')).toBe(true);
  },
};

export const Blocking: Story = { args: { blocking: true } };

export const LongContent: Story = {
  args: { heading: 'mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel' },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };

// The coachmark sits in the top layer, so two side by side would overlap: Peat gets its own story.
export const Peat: Story = {
  render: (a, ctx) => html`<div data-theme="dark" style="background:var(--mm-paper);color:var(--mm-text);min-height:100vh;margin:calc(-1 * var(--space-8))">
    ${meta.render!(a, ctx)}
  </div>`,
};
