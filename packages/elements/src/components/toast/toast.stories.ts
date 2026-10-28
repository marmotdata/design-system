import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import { toast } from '@marmotdata/elements/toast.js';
import '@marmotdata/elements/button.js';

type Args = { tone: string; message: string; action: string; duration: number };

/** Showcase toasters sit in the page flow; real ones are fixed bottom-end of the viewport. */
const inFlow = 'position:static';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const meta: Meta<Args> = {
  title: 'Components/Status/Toast',
  component: 'mm-toast',
  subcomponents: { MmToaster: 'mm-toaster' },
  args: { tone: 'success', message: 'Pipeline snowflake-prod finished: 1,284 assets updated.', action: 'View run', duration: 0 },
  argTypes: { tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] } },
  render: (a) => html`<mm-toaster style=${inFlow}>
    <mm-toast tone=${a.tone} message=${a.message} action=${a.action} duration=${a.duration}></mm-toast>
  </mm-toaster>`,
  parameters: {
    usage: {
      html: `<script type="module">
  import { toast } from '@marmotdata/elements/toast.js';
  toast({ tone: 'success', message: 'Pipeline snowflake-prod finished: 1,284 assets updated.', action: 'View run', onAction: openRun });
</script>

<!-- Or declaratively -->
<mm-toaster>
  <mm-toast tone="danger" message="kafka-events failed: broker kafka-1:9092 refused the connection."></mm-toast>
</mm-toaster>`,
      react: `import { toast } from '@marmotdata/elements/toast.js';

function onRunFinished(run) {
  toast({ tone: 'success', message: \`Pipeline \${run.name} finished: \${run.updated} assets updated.\`, action: 'View run', onAction: () => navigate(run.url) });
}`,
      svelte: `<script lang="ts">
  import { toast } from '@marmotdata/elements/toast.js';
  const saved = () => toast({ tone: 'success', message: 'Owners saved for customers_dim.' });
</script>

<mm-button variant="primary" onclick={saved}>Save owners</mm-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

const allTones = () => html`<mm-toaster style=${inFlow} label="Notifications preview">
  <mm-toast tone="success" duration="0" message="Pipeline snowflake-prod finished: 1,284 assets updated." action="View run"></mm-toast>
  <mm-toast tone="info" duration="0" message="Lineage for shop.orders.v2 is being inferred from 7 days of query history."></mm-toast>
  <mm-toast tone="warning" duration="0" message="dbt-analytics finished with 3 skipped models."></mm-toast>
</mm-toaster>`;

export const Tones: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-4);justify-items:end">
    ${allTones()}
    <mm-toaster style=${inFlow} label="Errors preview">
      <mm-toast tone="danger" message="kafka-events failed: broker kafka-1:9092 refused the connection." action="Open log"></mm-toast>
    </mm-toaster>
  </div>`,
};

const onDismiss = fn();
export const CloseButton: Story = {
  name: 'Close with the close button',
  render: () => html`<mm-toaster style=${inFlow} @mm-dismiss=${(e: CustomEvent) => onDismiss(e.detail)}>
    <mm-toast tone="success" duration="0" message="Owners saved for customers_dim."></mm-toast>
  </mm-toaster>`,
  play: async ({ canvasElement }) => {
    onDismiss.mockClear();
    const t = canvasElement.querySelector('mm-toast')!;
    (t.shadowRoot!.querySelector('.close') as HTMLButtonElement).click();
    await expect(onDismiss).toHaveBeenCalledWith({ reason: 'close' });
    await expect(canvasElement.querySelector('mm-toast')).toBeNull();
  },
};

export const KeyboardClose: Story = {
  name: 'Keyboard: Escape closes and focus returns',
  render: () => html`<div style="display:grid;gap:var(--space-4);justify-items:start">
    <mm-button variant="secondary">Run pipeline</mm-button>
    <mm-toaster style=${inFlow} @mm-dismiss=${(e: CustomEvent) => onDismiss(e.detail)}>
      <mm-toast tone="danger" message="kafka-events failed: broker kafka-1:9092 refused the connection." action="Open log"></mm-toast>
    </mm-toaster>
  </div>`,
  play: async ({ canvasElement }) => {
    onDismiss.mockClear();
    const trigger = canvasElement.querySelector('mm-button')!;
    await tab();
    await expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button'));
    await tab();
    await tab();
    const toastEl = canvasElement.querySelector('mm-toast')!;
    await expect(deepActive()).toBe(toastEl.shadowRoot!.querySelector('.close'));
    await expect(deepActive()).toHaveAttribute('aria-label', 'Close');
    await press('{Escape}');
    await expect(onDismiss).toHaveBeenCalledWith({ reason: 'escape' });
    await expect(canvasElement.querySelector('mm-toast')).toBeNull();
    await waitFor(() => expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button')));
  },
};

const onAction = fn();
export const Action: Story = {
  name: 'Keyboard: action button',
  render: () => html`<mm-toaster style=${inFlow} @mm-action=${onAction}>
    <mm-toast tone="success" duration="0" message="Pipeline snowflake-prod finished: 1,284 assets updated." action="View run"></mm-toast>
  </mm-toaster>`,
  play: async ({ canvasElement }) => {
    onAction.mockClear();
    await tab();
    await press('{Enter}');
    await expect(onAction).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelector('mm-toast')).toBeNull();
  },
};

export const AutoDismiss: Story = {
  name: 'Auto-dismiss, paused while focused',
  render: () => html`<mm-toaster style=${inFlow}>
    <mm-toast tone="info" duration="400" message="Copied mrn://postgresql/table/shop.public.orders."></mm-toast>
    <mm-toast tone="danger" duration="400" message="dbt-analytics failed: model orders_daily did not compile."></mm-toast>
  </mm-toaster>`,
  play: async ({ canvasElement }) => {
    const [info] = canvasElement.querySelectorAll('mm-toast');
    await tab();
    await expect(deepActive()).toBe(info!.shadowRoot!.querySelector('.close'));
    await wait(700);
    await expect(info!.isConnected).toBe(true);
    // Hovering also pauses the timer, and the test pointer may rest over the toast (Firefox): move it away.
    info!.shadowRoot!.querySelector('.toast')!.dispatchEvent(new PointerEvent('pointerleave'));
    (deepActive() as HTMLElement).blur();
    await waitFor(() => expect(info!.isConnected).toBe(false), { timeout: 2000 });
    await expect(canvasElement.querySelectorAll('mm-toast')).toHaveLength(1);
    await expect(canvasElement.querySelector('mm-toast')).toHaveAttribute('tone', 'danger');
  },
};

export const MaxThree: Story = {
  name: 'At most three visible',
  render: () => html`<mm-toaster style=${inFlow}>
    ${['postgres-shop', 'snowflake-prod', 'kafka-events', 'dbt-analytics', 'looker-prod'].map(
      (p, i) => html`<mm-toast tone="success" duration="0" message=${`Pipeline ${p} finished: ${[1284, 412, 96, 1031, 58][i]} assets updated.`}></mm-toast>`,
    )}
  </mm-toaster>`,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('mm-toast[data-queued]')).toHaveLength(2));
    const close = canvasElement.querySelector('mm-toast')!.shadowRoot!.querySelector('.close') as HTMLButtonElement;
    close.click();
    await waitFor(() => expect(canvasElement.querySelectorAll('mm-toast[data-queued]')).toHaveLength(1));
  },
};

export const Announces: Story = {
  name: 'Announces through the live region',
  render: () => html`<mm-toaster style=${inFlow}>
    <mm-toast tone="danger" message="kafka-events failed: broker kafka-1:9092 refused the connection."></mm-toast>
  </mm-toaster>`,
  play: async ({ canvasElement }) => {
    const toaster = canvasElement.querySelector('mm-toaster')!;
    await waitFor(() =>
      expect(toaster.shadowRoot!.querySelector('[aria-live="assertive"]')!.textContent).toContain('kafka-events failed'),
    );
  },
};

export const Helper: Story = {
  name: 'The toast() helper',
  render: () => html`<mm-button
    variant="primary"
    @click=${() => toast({ tone: 'success', message: 'Owners saved for customers_dim.', duration: 0 })}
    >Save owners</mm-button
  >`,
  play: async ({ canvasElement }) => {
    await tab();
    await press('{Enter}');
    const toaster = document.querySelector('mm-toaster[data-document]')!;
    await expect(toaster).not.toBeNull();
    await expect(toaster.querySelector('mm-toast')).toHaveAttribute('tone', 'success');
    await expect(getComputedStyle(toaster).position).toBe('fixed');
    // The canvas is reused between stories, so tidy up the document-level toaster.
    toaster.remove();
    await expect(canvasElement).toBeTruthy();
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-toaster style=${inFlow}>
    <mm-toast
      tone="danger"
      action="Open log"
      message="Pipeline postgres-shop failed: relation mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel does not exist (SQLSTATE 42P01)."
    ></mm-toast>
  </mm-toaster>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-toaster style=${inFlow}>
    <mm-toast tone="success" duration="0" message="انتهى خط الأنابيب snowflake-prod: تم تحديث 1,284 أصلًا." action="عرض التشغيل"></mm-toast>
  </mm-toaster>`,
};

export const BothThemes: Story = {
  render: () => themes(html`<mm-toaster style=${inFlow} label="Notifications">
  <mm-toast tone="success" duration="0" message="Pipeline snowflake-prod finished: 1,284 assets updated." action="View run"></mm-toast>
  <mm-toast tone="danger" message="kafka-events failed: broker kafka-1:9092 refused the connection."></mm-toast>
</mm-toaster>`),
  // Landmark names must be unique on a page; real apps have one toaster.
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>('[data-theme="dark"] mm-toaster')!.setAttribute('label', 'Notifications in Peat');
  },
};
