import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/dialog.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/textarea.js';
import '@marmotdata/elements/callout.js';
import '@marmotdata/elements/empty-state.js';
import '@marmotdata/elements/skeleton.js';
import type { MmDialog } from './class.ts';

type Args = { heading: string; description: string; size: string; dismissible: boolean };

const dialogOf = (root: HTMLElement) => root.querySelector('mm-dialog')!;
const native = (d: MmDialog) => d.shadowRoot!.querySelector('dialog')!;
const inner = (el: Element | null) => el?.shadowRoot?.querySelector('button, input, textarea') ?? null;
const triggerOf = (root: HTMLElement) => root.querySelector<HTMLElement>('mm-button.trigger')!;
/** Waits until the dialog is open and its transition has finished, so axe sees final colours. */
const opened = async (d: MmDialog) => {
  await waitFor(() => expect(native(d).open).toBe(true));
  await Promise.all(native(d).getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)));
};
const closed = (d: MmDialog) => waitFor(() => expect(native(d).open).toBe(false));
const openFromTrigger = (e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as MmDialog).show();

const editForm = html`
  <div style="display:grid;gap:var(--space-4)">
    <mm-text-field label="Display name" value="Daily orders"></mm-text-field>
    <mm-textarea
      label="Description"
      value="One row per order per day, rolled up from shop.public.orders at 04:00 UTC. Use this for revenue reporting rather than the raw orders table."
    ></mm-textarea>
  </div>
`;
const editFooter = html`
  <mm-button slot="footer" variant="secondary" data-close="cancel">Cancel</mm-button>
  <mm-button slot="footer" variant="primary" data-close="save">Save changes</mm-button>
`;

const meta: Meta<Args> = {
  title: 'Components/Overlays/Dialog',
  component: 'mm-dialog',
  args: {
    heading: 'Edit orders_daily',
    description: 'Changes appear in Discover and on the asset page straight away.',
    size: 'md',
    dismissible: false,
  },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'full'] } },
  render: (a) => html`
    <mm-button class="trigger" variant="secondary" icon="edit" @click=${openFromTrigger}>Edit details</mm-button>
    <mm-dialog heading=${a.heading} description=${a.description} size=${a.size} ?dismissible=${a.dismissible}>
      ${editForm}${editFooter}
    </mm-dialog>
  `,
  parameters: {
    usage: {
      html: `<mm-button id="edit" variant="secondary" icon="edit">Edit details</mm-button>
<mm-dialog id="edit-dialog" heading="Edit orders_daily" description="Changes appear in Discover and on the asset page straight away.">
  <mm-text-field label="Display name" value="Daily orders"></mm-text-field>
  <mm-button slot="footer" variant="secondary" data-close="cancel">Cancel</mm-button>
  <mm-button slot="footer" variant="primary" data-close="save">Save changes</mm-button>
</mm-dialog>
<script>
  edit.addEventListener('click', () => document.getElementById('edit-dialog').show());
  document.getElementById('edit-dialog').addEventListener('mm-close', (e) => {
    if (e.detail.returnValue === 'save') save();
  });
</script>`,
      react: `import { MmButton, MmDialog, MmTextField } from '@marmotdata/react';

const [open, setOpen] = useState(false);

<MmButton variant="secondary" icon="edit" onClick={() => setOpen(true)}>Edit details</MmButton>
<MmDialog
  heading="Edit orders_daily"
  open={open}
  onMmClose={(e) => { setOpen(false); if (e.detail.returnValue === 'save') save(); }}
  onMmRequestClose={(e) => { if (dirty && !window.confirm('Discard your changes?')) e.preventDefault(); }}
>
  <MmTextField label="Display name" value={name} />
  <MmButton slot="footer" variant="secondary" data-close="cancel">Cancel</MmButton>
  <MmButton slot="footer" variant="primary" data-close="save">Save changes</MmButton>
</MmDialog>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/dialog.js';
  let open = $state(false);
</script>

<mm-button variant="secondary" icon="edit" onclick={() => (open = true)}>Edit details</mm-button>
<mm-dialog
  heading="Edit orders_daily"
  {open}
  onmm-close={(e) => { open = false; if (e.detail.returnValue === 'save') save(); }}
>
  <mm-text-field label="Display name" value={name}></mm-text-field>
  <mm-button slot="footer" variant="secondary" data-close="cancel">Cancel</mm-button>
  <mm-button slot="footer" variant="primary" data-close="save">Save changes</mm-button>
</mm-dialog>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

/** Closed, with the trigger that opens it. */
export const Default: Story = {};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(triggerOf(canvasElement));
    await opened(d);
    await expect(native(d)).toHaveAttribute('aria-labelledby', 'heading');
    await expect(native(d)).not.toHaveAttribute('role');
    await expect(d.shadowRoot!.querySelector('h2')!.textContent!.trim()).toBe(d.heading);
  },
};

export const AlertDialog: Story = {
  name: 'Alert dialog role',
  render: () => html`<mm-button class="trigger" variant="secondary" @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as MmDialog).show()}>Revoke key</mm-button>
    <mm-dialog alert size="sm" heading="Revoke key mk_live_c81R?" description="support-triage-agent stops working until it gets a new key.">
      <mm-button slot="footer" variant="secondary" data-close="cancel" autofocus>Cancel</mm-button>
      <mm-button slot="footer" variant="danger" icon="delete" data-close="revoke">Revoke key</mm-button>
    </mm-dialog>`,
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(canvasElement.querySelector('mm-button.trigger')!);
    await opened(d);
    await expect(native(d)).toHaveAttribute('role', 'alertdialog');
    await expect(native(d)).toHaveAccessibleName('Revoke key mk_live_c81R?');
    await press('{Escape}');
    await waitFor(() => expect(native(d).open).toBe(false));
  },
};

export const Sizes: Story = {
  render: () => html`<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
    ${(['sm', 'md', 'lg', 'full'] as const).map(
      (size) => html`<span style="display:contents">
        <mm-button variant="secondary" @click=${openFromTrigger}>Open ${size}</mm-button>
        <mm-dialog size=${size} heading="Rename customers_dim" description=${`The ${size} size.`}>
          <mm-text-field label="Name" value="customers_dim" mono></mm-text-field>
          ${editFooter}
        </mm-dialog>
      </span>`,
    )}
  </div>`,
};

export const KeyboardOpensInstantly: Story = {
  name: 'Keyboard: opens instantly and focuses the first field',
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(d);
    await expect(d).toHaveAttribute('data-instant');
    await waitFor(() => expect(deepActive()).toBe(inner(d.querySelector('mm-text-field'))));
  },
};

export const PointerOpensWithTransition: Story = {
  name: 'Pointer: opens with the dialog transition',
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(triggerOf(canvasElement));
    await opened(d);
    await expect(d).not.toHaveAttribute('data-instant');
  },
};

export const FocusTrap: Story = {
  name: 'Keyboard: Tab and Shift+Tab wrap inside the dialog',
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(d);
    const name = inner(d.querySelector('mm-text-field'));
    const desc = inner(d.querySelector('mm-textarea'));
    const [cancel, save] = [...d.querySelectorAll('mm-button')].map(inner);
    const close = inner(d.shadowRoot!.querySelector('.close'));
    await waitFor(() => expect(deepActive()).toBe(name));
    await tab();
    await expect(deepActive()).toBe(desc);
    await tab();
    await expect(deepActive()).toBe(cancel);
    await tab();
    await expect(deepActive()).toBe(save);
    await tab();
    await expect(deepActive()).toBe(close);
    await tab(true);
    await expect(deepActive()).toBe(save);
  },
};

export const EscapeReturnsFocus: Story = {
  name: 'Keyboard: Escape closes and returns focus',
  render: (a) => html`
    <mm-button class="trigger" variant="secondary" icon="edit" @click=${openFromTrigger}>Edit details</mm-button>
    <mm-dialog heading=${a.heading} @mm-close=${(e: CustomEvent) => onClose(e.detail.returnValue)}>${editForm}${editFooter}</mm-dialog>
  `,
  play: async ({ canvasElement }) => {
    onClose.mockClear();
    const d = dialogOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(d);
    await waitFor(() => expect(deepActive()).toBe(inner(d.querySelector('mm-text-field'))));
    await press('{Escape}');
    await closed(d);
    await expect(d.open).toBe(false);
    await expect(onClose).toHaveBeenCalledWith('');
    await expect(deepActive()).toBe(inner(triggerOf(canvasElement)));
    // A footer button with data-close closes with its value.
    await press('{Enter}');
    await opened(d);
    await click(d.querySelector('mm-button[data-close="save"]')!);
    await closed(d);
    await expect(onClose).toHaveBeenLastCalledWith('save');
    await expect(document.documentElement.style.overflow).toBe('');
  },
};
const onClose = fn();

export const CloseButton: Story = {
  name: 'Close button is labelled and closes',
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(triggerOf(canvasElement));
    await opened(d);
    const close = inner(d.shadowRoot!.querySelector('.close'))!;
    await expect(close).toHaveAttribute('aria-label', 'Close');
    await expect(document.documentElement.style.overflow).toBe('hidden');
    await click(close);
    await closed(d);
  },
};

export const UnsavedChanges: Story = {
  name: 'Cancelling mm-request-close keeps unsaved changes',
  render: () => html`
    <mm-button class="trigger" variant="secondary" icon="edit" @click=${openFromTrigger}>Edit details</mm-button>
    <mm-dialog
      heading="Edit orders_daily"
      @mm-request-close=${(e: CustomEvent) => {
        e.preventDefault();
        const callout = (e.currentTarget as HTMLElement).querySelector('mm-callout')!;
        callout.hidden = false;
      }}
    >
      <div style="display:grid;gap:var(--space-4)">
        <mm-callout tone="warning" heading="You have unsaved changes" hidden>Save them, or use Discard changes to close without saving.</mm-callout>
        ${editForm}
      </div>
      <mm-button slot="footer" variant="secondary" data-close="discard">Discard changes</mm-button>
      <mm-button slot="footer" variant="primary" data-close="save">Save changes</mm-button>
    </mm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await tab();
    await press('{Enter}');
    await opened(d);
    await waitFor(() => expect(deepActive()).toBe(inner(d.querySelector('mm-text-field'))));
    await press('{Escape}');
    await expect(native(d).open).toBe(true);
    await expect(d.querySelector('mm-callout')!.hidden).toBe(false);
  },
};

export const DismissibleBackdrop: Story = {
  name: 'Dismissible: a click on the backdrop closes',
  args: { dismissible: true, heading: 'Columns in orders_daily', description: '' },
  render: (a) => html`
    <mm-button class="trigger" variant="secondary" icon="view-column" @click=${openFromTrigger}>Show columns</mm-button>
    <mm-dialog heading=${a.heading} size="sm" dismissible>
      <p style="margin:0">order_id, customer_id, order_date, status, total_amount and currency.</p>
    </mm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(triggerOf(canvasElement));
    await opened(d);
    const dlg = native(d);
    const opts = { bubbles: true, composed: true, clientX: 2, clientY: 2 };
    dlg.dispatchEvent(new PointerEvent('pointerdown', opts));
    dlg.dispatchEvent(new MouseEvent('click', opts));
    await closed(d);
  },
};

export const LongContent: Story = {
  name: 'Overflowing content',
  render: () => html`
    <mm-button class="trigger" variant="secondary" icon="schema" @click=${openFromTrigger}>Review schema change</mm-button>
    <mm-dialog heading="Review schema change to shop.orders.v2" description="42 columns changed in the last run of the Kafka plugin.">
      <ol style="margin:0;padding-inline-start:var(--space-5);font:var(--text-dense)">
        ${Array.from({ length: 42 }, (_, i) => html`<li style="padding-block:var(--space-1)"><code style="font:var(--text-mono-dense)">line_item_${String(i + 1).padStart(2, '0')}_amount</code> changed from <code style="font:var(--text-mono-dense)">numeric(12,2)</code> to <code style="font:var(--text-mono-dense)">numeric(18,4)</code></li>`)}
      </ol>
      <mm-button slot="footer" variant="secondary" data-close="cancel">Cancel</mm-button>
      <mm-button slot="footer" variant="primary" data-close="accept">Accept changes</mm-button>
    </mm-dialog>
  `,
  play: async ({ canvasElement }) => {
    const d = dialogOf(canvasElement);
    await click(triggerOf(canvasElement));
    await opened(d);
    const body = d.shadowRoot!.querySelector<HTMLElement>('.body')!;
    await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight));
    await waitFor(() => expect(d.shadowRoot!.querySelector('.footer')).toHaveAttribute('data-edge'));
    body.scrollTop = 200;
    await waitFor(() => expect(d.shadowRoot!.querySelector('.header')).toHaveAttribute('data-edge'));
  },
};

export const LongIdentifiers: Story = {
  render: () => html`
    <mm-button class="trigger" variant="secondary" @click=${openFromTrigger}>Rename asset</mm-button>
    <mm-dialog heading="Rename mrn://snowflake/table/analytics.marts.finance_orders_daily_rollup_by_region_and_currency_v2">
      <mm-text-field label="New name" mono value="finance_orders_daily_rollup_by_region_and_currency_v3"></mm-text-field>
      ${editFooter}
    </mm-dialog>
  `,
  play: Open.play,
};

export const Loading: Story = {
  name: 'Loading content',
  render: () => html`
    <mm-button class="trigger" variant="secondary" @click=${openFromTrigger}>View owners</mm-button>
    <mm-dialog heading="Owners of orders_daily" size="sm">
      <mm-skeleton loading shape="text" count="4"></mm-skeleton>
      <mm-button slot="footer" variant="secondary" data-close="done">Done</mm-button>
    </mm-dialog>
  `,
  play: Open.play,
};

export const Empty: Story = {
  render: () => html`
    <mm-button class="trigger" variant="secondary" @click=${openFromTrigger}>View owners</mm-button>
    <mm-dialog heading="Owners of orders_daily" size="sm">
      <mm-empty-state compact heading="No owners yet" description="Nobody owns orders_daily yet. Add a team so questions about it reach someone." level="3">
        <mm-button slot="action" variant="secondary" icon="person-add">Add owner</mm-button>
      </mm-empty-state>
    </mm-dialog>
  `,
  play: Open.play,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`
    <mm-button class="trigger" variant="secondary" @click=${openFromTrigger}>Edit details</mm-button>
    <mm-dialog heading="Edit orders_daily">
      <div style="display:grid;gap:var(--space-4)">
        <mm-callout tone="danger" heading="Changes not saved">The catalog API returned 503. Your edits are kept here; try again in a moment.</mm-callout>
        ${editForm}
      </div>
      ${editFooter}
    </mm-dialog>
  `,
  play: Open.play,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`
    <mm-button class="trigger" variant="secondary" @click=${openFromTrigger}>تعديل التفاصيل</mm-button>
    <mm-dialog heading="تعديل orders_daily" description="تظهر التغييرات في صفحة الأصل مباشرة.">
      <mm-text-field label="الاسم المعروض" value="الطلبات اليومية"></mm-text-field>
      <mm-button slot="footer" variant="secondary" data-close="cancel">إلغاء</mm-button>
      <mm-button slot="footer" variant="primary" data-close="save">حفظ التغييرات</mm-button>
    </mm-dialog>
  `,
  play: Open.play,
};

export const Peat: Story = { parameters: { theme: 'dark' }, play: Open.play };

export const BothThemes: Story = {
  render: (a) =>
    themes(html`
      <mm-button class="trigger" variant="secondary" icon="edit" @click=${openFromTrigger}>Edit details</mm-button>
      <mm-dialog heading=${a.heading} description=${a.description}>${editForm}${editFooter}</mm-dialog>
    `),
  play: async ({ canvasElement }) => {
    // Opens the Peat copy; the Light one opens from its own trigger.
    const peat = canvasElement.querySelector('[data-theme="dark"]') as HTMLElement;
    const d = peat.querySelector('mm-dialog')!;
    await click(peat.querySelector('mm-button')!);
    await opened(d);
  },
};
