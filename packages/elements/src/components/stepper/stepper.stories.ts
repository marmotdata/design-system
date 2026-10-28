import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/stepper.js';
import type { MmStepper } from './class.ts';

type Args = { value: string; orientation: 'horizontal' | 'vertical'; navigable: boolean };

const onStep = fn();

const pipeline = (a: Partial<Args> = {}, errorOn = '') => html`<mm-stepper
  label="New pipeline"
  value=${a.value ?? 'configure'}
  orientation=${a.orientation ?? 'horizontal'}
  ?navigable=${a.navigable ?? false}
  @mm-step-change=${(e: CustomEvent) => onStep(e.detail)}
>
  <mm-step value="plugin" label="Choose plugin" description="PostgreSQL" ?error=${errorOn === 'plugin'}></mm-step>
  <mm-step value="basics" label="Basic info" description="postgres-prod" ?error=${errorOn === 'basics'}></mm-step>
  <mm-step value="configure" label="Configure" description="Connection and schemas" ?error=${errorOn === 'configure'}></mm-step>
  <mm-step value="schedule" label="Schedule and filters" description="Every day at 04:00 UTC" ?error=${errorOn === 'schedule'}></mm-step>
</mm-stepper>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Stepper',
  component: 'mm-stepper',
  subcomponents: { 'mm-step': 'mm-step' } as never,
  args: { value: 'configure', orientation: 'horizontal', navigable: false },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
  render: (a) => pipeline(a),
  parameters: {
    usage: {
      html: `<mm-stepper label="New pipeline" value="configure" navigable>
  <mm-step value="plugin" label="Choose plugin" description="PostgreSQL"></mm-step>
  <mm-step value="basics" label="Basic info"></mm-step>
  <mm-step value="configure" label="Configure"></mm-step>
  <mm-step value="schedule" label="Schedule and filters"></mm-step>
</mm-stepper>`,
      react: `import { MmStepper, MmStep } from '@marmotdata/react';

<MmStepper label="New pipeline" value={step} navigable onMmStepChange={(e) => setStep(e.detail.value)}>
  <MmStep value="plugin" label="Choose plugin" description="PostgreSQL" />
  <MmStep value="basics" label="Basic info" />
  <MmStep value="configure" label="Configure" error={hasErrors} />
  <MmStep value="schedule" label="Schedule and filters" />
</MmStepper>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/stepper.js';
  let step = $state('configure');
</script>

<mm-stepper label="New pipeline" value={step} navigable onmm-step-change={(e) => (step = e.detail.value)}>
  <mm-step value="plugin" label="Choose plugin" description="PostgreSQL"></mm-step>
  <mm-step value="basics" label="Basic info"></mm-step>
  <mm-step value="configure" label="Configure"></mm-step>
  <mm-step value="schedule" label="Schedule and filters"></mm-step>
</mm-stepper>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const stepper = (root: HTMLElement) => root.querySelector('mm-stepper') as MmStepper;
const steps = (root: HTMLElement) => [...root.querySelectorAll('mm-step')];
const settle = async (root: HTMLElement) => {
  await stepper(root).updateComplete;
  await Promise.all(steps(root).map((s) => s.updateComplete));
};

export const Horizontal: Story = {
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const [plugin, , configure, schedule] = steps(canvasElement);
    await expect(stepper(canvasElement).shadowRoot!.querySelector('[role="list"]')).toHaveAttribute('aria-label', 'New pipeline');
    await expect(plugin).toHaveAttribute('state', 'complete');
    await expect(configure).toHaveAttribute('aria-current', 'step');
    await expect(schedule).toHaveAttribute('state', 'upcoming');
    await expect(plugin!.shadowRoot!.querySelector('.label')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Step 1: Choose plugin, completed');
    // Not navigable: nothing to tab to.
    await expect(plugin!.shadowRoot!.querySelector('button')).toBeNull();
  },
};

export const Vertical: Story = { args: { orientation: 'vertical' } };
export const FirstStep: Story = { name: 'Empty (first step)', args: { value: 'plugin' } };
export const AllComplete: Story = { name: 'Last step', args: { value: 'schedule', navigable: true } };

export const ErrorStep: Story = {
  name: 'Error',
  render: () => pipeline({ value: 'schedule', navigable: true }, 'basics'),
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    const basics = steps(canvasElement)[1]!;
    await expect(basics.shadowRoot!.querySelector('.error')!.textContent).toBe('Has errors');
    await expect(basics.shadowRoot!.querySelector('mm-icon[name="error"]')).not.toBeNull();
  },
};

export const KeyboardNavigable: Story = {
  name: 'Keyboard: go back to a completed step',
  args: { navigable: true, value: 'schedule' },
  play: async ({ canvasElement }) => {
    onStep.mockClear();
    await settle(canvasElement);
    const [plugin, basics, configure, schedule] = steps(canvasElement);
    // Only completed steps are tab stops.
    await tab();
    await expect(deepActive()).toBe(plugin!.shadowRoot!.querySelector('button'));
    await tab();
    await expect(deepActive()).toBe(basics!.shadowRoot!.querySelector('button'));
    await tab();
    await expect(deepActive()).toBe(configure!.shadowRoot!.querySelector('button'));
    await expect(schedule!.shadowRoot!.querySelector('button')).toBeNull();
    await press('{Enter}');
    await expect(onStep).toHaveBeenCalledWith({ value: 'configure', index: 2 });
    await waitFor(() => expect(stepper(canvasElement).value).toBe('configure'));
    await settle(canvasElement);
    await expect(configure).toHaveAttribute('aria-current', 'step');
    await expect(schedule).toHaveAttribute('state', 'upcoming');
    // Focus stays on the step, which is no longer a button.
    await waitFor(() => expect(deepActive()).toBe(configure));
    await tab(true);
    await expect(deepActive()).toBe(basics!.shadowRoot!.querySelector('button'));
    await press('{Space}');
    await waitFor(() => expect(stepper(canvasElement).value).toBe('basics'));
  },
};

export const CancelChange: Story = {
  name: 'Keyboard: cancelled change',
  args: { navigable: true, value: 'configure' },
  render: (a) => html`<div @mm-step-change=${(e: Event) => e.preventDefault()}>${pipeline(a)}</div>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await press('{Enter}');
    await new Promise((r) => setTimeout(r, 20));
    await expect(stepper(canvasElement).value).toBe('configure');
  },
};

export const LinkSteps: Story = {
  name: 'Navigable with links',
  render: () => html`<mm-stepper label="New asset" value="schema" navigable @click=${(e: Event) => e.preventDefault()}>
    <mm-step value="source" label="Source" href="#/assets/new/source"></mm-step>
    <mm-step value="details" label="Details" href="#/assets/new/details"></mm-step>
    <mm-step value="schema" label="Schema"></mm-step>
    <mm-step value="review" label="Review"></mm-step>
  </mm-stepper>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(steps(canvasElement)[0]!.shadowRoot!.querySelector('a')).toHaveAttribute('href', '#/assets/new/source');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, args: { navigable: true, value: 'schedule' } };
export const Focus: Story = {
  args: { navigable: true },
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await expect(deepActive()).toBe(steps(canvasElement)[0]!.shadowRoot!.querySelector('button'));
  },
};

export const LongLabels: Story = {
  name: 'Long labels',
  render: () => html`<div style="width:560px;max-width:100%"><mm-stepper label="New data product" value="rules">
    <mm-step value="assets" label="Choose assets from mrn://snowflake/table/analytics.marts.customer_lifetime_value_monthly_snapshot"></mm-step>
    <mm-step value="rules" label="Rules and freshness checks" description="Fail when orders_daily is more than 26 hours old"></mm-step>
    <mm-step value="owners" label="Owners"></mm-step>
  </mm-stepper></div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { navigable: true } };
export const VerticalRightToLeft: Story = { name: 'Vertical, right to left', parameters: { dir: 'rtl' }, args: { orientation: 'vertical' } };
export const CompactDensity: Story = { name: 'Compact density', globals: { density: 'compact' } };
export const BothThemes: Story = {
  render: () => themes(html`<div style="display:grid;gap:var(--space-6)">${pipeline({ orientation: 'vertical' }, 'basics')}</div>`),
  play: async ({ canvasElement }) => {
    const [a, b] = [...canvasElement.querySelectorAll('mm-stepper')];
    a!.label = 'New pipeline (Light)';
    b!.label = 'New pipeline (Peat)';
  },
};
