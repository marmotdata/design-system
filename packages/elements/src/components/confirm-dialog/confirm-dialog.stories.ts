import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/confirm-dialog.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/callout.js';
import { MmConfirmDialog } from './class.ts';
import type { MmDialog } from '../dialog/class.ts';

type Args = { heading: string; body: string; confirmLabel: string; confirmText: string; tone: string; loading: boolean };

const BODY =
  'This removes orders_daily from the catalog with its 14 downstream lineage edges, its 3 owners and all of its documentation. The table in PostgreSQL is not touched.';

const confirmOf = (root: ParentNode) => root.querySelector('mm-confirm-dialog')!;
const innerDialog = (c: MmConfirmDialog) => c.shadowRoot!.querySelector<MmDialog>('mm-dialog')!;
const native = (c: MmConfirmDialog) => innerDialog(c).shadowRoot!.querySelector('dialog')!;
const btn = (c: MmConfirmDialog, part: 'cancel' | 'confirm') => c.shadowRoot!.querySelector(`[part="${part}"]`)!.shadowRoot!.querySelector('button')!;
const field = (c: MmConfirmDialog) => c.shadowRoot!.querySelector('mm-text-field')!.shadowRoot!.querySelector('input')!;
const opened = async (c: MmConfirmDialog) => {
  await waitFor(() => expect(native(c).open).toBe(true));
  await Promise.all(native(c).getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)));
};
const closed = (c: MmConfirmDialog) => waitFor(() => expect(native(c).open).toBe(false));
const openNext = (e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as MmConfirmDialog).show();

const meta: Meta<Args> = {
  title: 'Components/Overlays/Confirm dialog',
  component: 'mm-confirm-dialog',
  args: { heading: 'Delete orders_daily?', body: BODY, confirmLabel: 'Delete asset', confirmText: '', tone: 'danger', loading: false },
  argTypes: { tone: { control: 'inline-radio', options: ['danger', 'default'] } },
  render: (a) => html`
    <mm-button class="trigger" variant="danger" icon="delete" @click=${openNext}>Delete asset</mm-button>
    <mm-confirm-dialog
      heading=${a.heading}
      body=${a.body}
      confirm-label=${a.confirmLabel}
      confirm-text=${a.confirmText}
      tone=${a.tone}
      ?loading=${a.loading}
      @mm-confirm=${() => onConfirm()}
    ></mm-confirm-dialog>
  `,
  parameters: {
    usage: {
      html: `<mm-confirm-dialog
  id="delete-orders"
  heading="Delete orders_daily?"
  body="This removes orders_daily from the catalog with its 14 downstream lineage edges, its 3 owners and all of its documentation. The table in PostgreSQL is not touched."
  confirm-label="Delete asset"
  confirm-text="orders_daily"
></mm-confirm-dialog>

<script type="module">
  import { MmConfirmDialog } from '@marmotdata/elements/confirm-dialog.js';
  // Or without markup:
  const ok = await MmConfirmDialog.confirm({
    heading: 'Delete orders_daily?',
    body: 'This removes orders_daily from the catalog with its 14 downstream lineage edges, its 3 owners and all of its documentation.',
    confirmLabel: 'Delete asset',
    confirmText: 'orders_daily',
  });
  if (ok) await deleteAsset('mrn://postgresql/table/shop.public.orders_daily');
</script>`,
      react: `import { MmConfirmDialog } from '@marmotdata/react';
import { MmConfirmDialog as ConfirmDialog } from '@marmotdata/elements/confirm-dialog.js';

<MmConfirmDialog
  open={open}
  heading="Delete orders_daily?"
  body={body}
  confirmLabel="Delete asset"
  confirmText="orders_daily"
  onMmConfirm={() => deleteAsset(mrn)}
  onMmClose={() => setOpen(false)}
/>

// Or imperatively, from an event handler:
const onDelete = async () => {
  if (await ConfirmDialog.confirm({ heading: 'Delete orders_daily?', body, confirmLabel: 'Delete asset' })) deleteAsset(mrn);
};`,
      svelte: `<script lang="ts">
  import { MmConfirmDialog } from '@marmotdata/elements/confirm-dialog.js';

  async function onDelete() {
    const ok = await MmConfirmDialog.confirm({
      heading: 'Delete orders_daily?',
      body: 'This removes orders_daily from the catalog with its 14 downstream lineage edges, its 3 owners and all of its documentation.',
      confirmLabel: 'Delete asset',
      confirmText: 'orders_daily',
    });
    if (ok) await deleteAsset(mrn);
  }
</script>

<mm-button variant="danger" icon="delete" onclick={onDelete}>Delete asset</mm-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;
const onConfirm = fn();

export const Default: Story = {};

export const Open: Story = {
  name: 'Open: Cancel is focused first',
  play: async ({ canvasElement }) => {
    const c = confirmOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(c);
    await waitFor(() => expect(deepActive()).toBe(btn(c, 'cancel')));
    // An interruption that needs a response: announced as an alert dialog, named by the heading.
    await expect(native(c)).toHaveAttribute('role', 'alertdialog');
    await expect(native(c)).toHaveAccessibleName('Delete orders_daily?');
    await expect(c.shadowRoot!.querySelector('[part="confirm"]')).toHaveTextContent('Delete asset');
    await expect(c.shadowRoot!.querySelector('[part="confirm"]')).toHaveAttribute('icon', 'delete');
  },
};

export const TypeToConfirm: Story = {
  name: 'Keyboard: type-to-confirm enables the button only on an exact match',
  args: { confirmText: 'orders_daily' },
  play: async ({ canvasElement }) => {
    onConfirm.mockClear();
    const c = confirmOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(c);
    await expect(c).toHaveAttribute('open');
    await waitFor(() => expect(deepActive()).toBe(btn(c, 'cancel')));
    await expect(field(c)).toHaveAccessibleName('Type orders_daily to confirm');
    const confirm = btn(c, 'confirm');
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await tab(true);
    await expect(deepActive()).toBe(field(c));
    await press('Orders_daily');
    await waitFor(() => expect(c.confirmable).toBe(false));
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    // Enter does nothing until it matches.
    await press('{Enter}');
    await expect(onConfirm).not.toHaveBeenCalled();
    field(c).select();
    await press('orders_dail');
    await expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await press('y');
    await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'false'));
    await press(' ');
    await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'true'));
    await press('{Backspace}');
    await waitFor(() => expect(confirm).toHaveAttribute('aria-disabled', 'false'));
    await press('{Enter}');
    await expect(onConfirm).toHaveBeenCalledTimes(1);
    await closed(c);
    await expect(c.returnValue).toBe('confirm');
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button.trigger')!.shadowRoot!.querySelector('button'));
  },
};

export const DisabledBlocksConfirm: Story = {
  name: 'Disabled confirm ignores clicks',
  args: { confirmText: 'orders_daily' },
  play: async ({ canvasElement }) => {
    onConfirm.mockClear();
    const c = confirmOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(c);
    // Playwright refuses to click an aria-disabled button, so dispatch the click directly.
    btn(c, 'confirm').click();
    await expect(onConfirm).not.toHaveBeenCalled();
    await expect(native(c).open).toBe(true);
  },
};

export const EscapeCancels: Story = {
  name: 'Keyboard: Escape and Cancel close without confirming',
  play: async ({ canvasElement }) => {
    onConfirm.mockClear();
    const c = confirmOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(c);
    await waitFor(() => expect(deepActive()).toBe(btn(c, 'cancel')));
    await press('{Escape}');
    await closed(c);
    await expect(c.open).toBe(false);
    await press('{Enter}');
    await opened(c);
    await waitFor(() => expect(deepActive()).toBe(btn(c, 'cancel')));
    await press('{Enter}');
    await closed(c);
    await expect(c.returnValue).toBe('cancel');
    await expect(onConfirm).not.toHaveBeenCalled();
  },
};

const result = (root: HTMLElement) => root.querySelector('output')!;
export const PromiseApi: Story = {
  name: 'Promise API resolves true and false',
  render: () => html`
    <div style="display:flex;gap:var(--space-3);align-items:center">
      <mm-button
        class="trigger"
        variant="danger"
        icon="delete"
        @click=${async (e: Event) => {
          const out = (e.currentTarget as HTMLElement).nextElementSibling as HTMLOutputElement;
          out.value = 'Waiting';
          const ok = await MmConfirmDialog.confirm({ heading: 'Delete customers_dim?', body: BODY.replace('orders_daily', 'customers_dim'), confirmLabel: 'Delete asset' });
          out.value = ok ? 'Confirmed' : 'Cancelled';
        }}
        >Delete asset</mm-button
      >
      <output aria-live="polite" style="font:var(--text-dense);color:var(--mm-text-2)"></output>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('mm-button.trigger')!;
    await click(trigger);
    let c = await waitFor(() => {
      const el = [...document.querySelectorAll('mm-confirm-dialog')].find((x) => x.open);
      if (!el) throw new globalThis.Error('not created');
      return el;
    });
    await opened(c);
    await click(btn(c, 'confirm'));
    await waitFor(() => expect(result(canvasElement).value).toBe('Confirmed'));
    await waitFor(() => expect(c.isConnected).toBe(false));
    await click(trigger);
    c = await waitFor(() => {
      const el = [...document.querySelectorAll('mm-confirm-dialog')].find((x) => x.open);
      if (!el) throw new globalThis.Error('not created');
      return el;
    });
    await opened(c);
    await waitFor(() => expect(deepActive()).toBe(btn(c, 'cancel')));
    await press('{Escape}');
    await waitFor(() => expect(result(canvasElement).value).toBe('Cancelled'));
    await expect(deepActive()).toBe(trigger.shadowRoot!.querySelector('button'));
  },
};

export const DefaultTone: Story = {
  name: 'Default tone',
  args: {
    heading: 'Archive the Kafka plugin?',
    body: 'Archiving stops scheduled runs of the Kafka plugin. The 212 topics it catalogued stay in the catalog and you can restore the plugin at any time.',
    confirmLabel: 'Archive plugin',
    tone: 'default',
  },
  render: (a) => html`
    <mm-button class="trigger" variant="secondary" icon="archive" @click=${openNext}>Archive plugin</mm-button>
    <mm-confirm-dialog heading=${a.heading} body=${a.body} confirm-label=${a.confirmLabel} confirm-icon="archive" tone="default"></mm-confirm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const c = confirmOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(c);
    await expect(c.shadowRoot!.querySelector('[part="confirm"]')).toHaveAttribute('variant', 'primary');
  },
};

export const Loading: Story = {
  name: 'Loading: deletion in progress',
  render: () => html`
    <mm-button class="trigger" variant="danger" icon="delete" @click=${openNext}>Delete asset</mm-button>
    <mm-confirm-dialog
      heading="Delete orders_daily?"
      body=${BODY}
      confirm-label="Delete asset"
      @mm-confirm=${(e: Event) => {
        e.preventDefault();
        (e.currentTarget as MmConfirmDialog).loading = true;
      }}
    ></mm-confirm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const c = confirmOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(c);
    await click(btn(c, 'confirm'));
    await waitFor(() => expect(btn(c, 'confirm')).toHaveAttribute('aria-busy', 'true'));
    await expect(native(c).open).toBe(true);
  },
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`
    <mm-button class="trigger" variant="danger" icon="delete" @click=${openNext}>Delete asset</mm-button>
    <mm-confirm-dialog heading="Delete orders_daily?" confirm-label="Delete asset">
      <mm-callout tone="danger" heading="orders_daily was not deleted">The catalog API returned 409: a running pipeline holds a lock on it. Try again when the run finishes.</mm-callout>
      <p>${BODY}</p>
    </mm-confirm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const c = confirmOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(c);
  },
};

export const LongIdentifiers: Story = {
  args: {
    heading: 'Delete finance_orders_daily_rollup_by_region_and_currency_v2?',
    body: 'This removes mrn://snowflake/table/analytics.marts.finance_orders_daily_rollup_by_region_and_currency_v2 from the catalog with its 61 downstream lineage edges and 4 owners.',
    confirmText: 'finance_orders_daily_rollup_by_region_and_currency_v2',
  },
  play: ErrorState.play,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { heading: 'حذف orders_daily؟', body: 'يزيل هذا orders_daily من الكتالوج مع 14 رابط نسب لاحق و3 مالكين وكل وثائقه.', confirmLabel: 'حذف الأصل', confirmText: 'orders_daily' },
  play: ErrorState.play,
};

export const Peat: Story = { parameters: { theme: 'dark' }, args: { confirmText: 'orders_daily' }, play: ErrorState.play };

export const BothThemes: Story = {
  render: (a) =>
    themes(html`
      <mm-button class="trigger" variant="danger" icon="delete" @click=${openNext}>Delete asset</mm-button>
      <mm-confirm-dialog heading=${a.heading} body=${a.body} confirm-label=${a.confirmLabel}></mm-confirm-dialog>
    `),
  play: async ({ canvasElement }) => {
    const peat = canvasElement.querySelector('[data-theme="dark"]') as HTMLElement;
    const c = confirmOf(peat);
    await click(peat.querySelector('mm-button')!);
    await opened(c);
  },
};
