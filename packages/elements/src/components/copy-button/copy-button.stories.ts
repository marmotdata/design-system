import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/copy-button.js';

type Args = { value: string; label: string; iconOnly: boolean; tone: string; size: string; disabled: boolean };

const MRN = 'mrn://postgresql/table/shop.public.orders';

const meta: Meta<Args> = {
  title: 'Components/Actions/Copy button',
  component: 'mm-copy-button',
  args: { value: MRN, label: 'Copy MRN', iconOnly: true, tone: 'default', size: 'md', disabled: false },
  argTypes: {
    tone: { control: 'inline-radio', options: ['default', 'code'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (a) => html`<div style="display:flex;align-items:center;gap:var(--space-2)">
    <code>${a.value}</code>
    <mm-copy-button value=${a.value} label=${a.label} icon-only=${a.iconOnly ? '' : 'false'} tone=${a.tone} size=${a.size} ?disabled=${a.disabled}
      @mm-copy=${(e: CustomEvent) => onCopy(e.detail.value)}></mm-copy-button>
  </div>`,
  parameters: {
    usage: {
      html: `<code>mrn://postgresql/table/shop.public.orders</code>
<mm-copy-button value="mrn://postgresql/table/shop.public.orders" label="Copy MRN"></mm-copy-button>`,
      react: `import { MmCopyButton } from '@marmotdata/react';

<MmCopyButton value={asset.mrn} label="Copy MRN" onMmCopy={(e) => track(e.detail.value)} />
<MmCopyButton value={sql} tone="code" iconOnly={false} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/copy-button.js';
</script>

<mm-copy-button value={asset.mrn} label="Copy MRN" onmm-copy={(e) => track(e.detail.value)}></mm-copy-button>
<mm-copy-button value={sql} tone="code" icon-only="false"></mm-copy-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const onCopy = fn();
const writes = fn(async (_text: string) => {});
/** Replaces the clipboard so tests never depend on browser permissions. */
const stubClipboard = () => {
  writes.mockClear();
  Object.defineProperty(navigator.clipboard, 'writeText', { value: writes, configurable: true });
};
const parts = (el: HTMLElement) => {
  const host = el.querySelector('mm-copy-button')!;
  const button = host.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
  const status = host.shadowRoot!.querySelector('[role="status"]')!;
  return { host, button, status };
};

export const IconOnly: Story = {
  name: 'Icon only',
  play: async ({ canvasElement }) => {
    await expect(parts(canvasElement).button).toHaveAttribute('aria-label', 'Copy MRN');
  },
};

export const WithText: Story = { name: 'With text', args: { iconOnly: false, label: '' } };

export const Copied: Story = {
  play: async ({ canvasElement }) => {
    stubClipboard();
    onCopy.mockClear();
    const { button, status } = parts(canvasElement);
    await click(button);
    await expect(writes).toHaveBeenCalledWith(MRN);
    await expect(onCopy).toHaveBeenCalledWith(MRN);
    await waitFor(() => expect(status).toHaveTextContent('Copied'));
  },
};

export const CopiedResets: Story = {
  name: 'Copied resets after 1.5 seconds',
  args: { iconOnly: false, label: '' },
  play: async ({ canvasElement }) => {
    stubClipboard();
    const { host, button, status } = parts(canvasElement);
    await click(button);
    await waitFor(() => expect(host.shadowRoot!.querySelector('mm-button')).toHaveTextContent('Copied'));
    await waitFor(() => expect(status).toHaveTextContent(''), { timeout: 2500 });
    await expect(host.shadowRoot!.querySelector('mm-button')).toHaveTextContent('Copy');
  },
};

export const KeyboardActivation: Story = {
  name: 'Keyboard: Enter and Space copy',
  play: async ({ canvasElement }) => {
    stubClipboard();
    const { button } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(button);
    await press('{Enter}');
    await press('{Space}');
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  },
};

export const Fallback: Story = {
  name: 'Clipboard API refused',
  play: async ({ canvasElement }) => {
    Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')), configurable: true });
    const { button } = parts(canvasElement);
    await click(button);
    // The textarea fallback runs; whether execCommand succeeds depends on the browser, but nothing throws.
    await expect(document.querySelector('textarea[readonly]')).toBeNull();
  },
};

export const CodeTone: Story = {
  name: 'Code tone',
  render: () => html`<div style="position:relative;background:var(--mm-code-bg);color:var(--mm-code-text);border-radius:var(--radius-md);padding:14px 16px;font:var(--text-mono-editor)">
    <pre style="margin:0;padding-inline-end:96px">SELECT order_id, customer_id, total_gbp
FROM shop.public.orders
WHERE created_at &gt;= now() - interval '1 day';</pre>
    <mm-copy-button tone="code" icon-only="false" label="Copy" value="SELECT order_id FROM shop.public.orders" style="position:absolute;inset-block-start:var(--space-2);inset-inline-end:var(--space-2)"></mm-copy-button>
  </div>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, args: { iconOnly: false, label: '' } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(parts(canvasElement).button);
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    stubClipboard();
    parts(canvasElement).button.click();
    await expect(writes).not.toHaveBeenCalled();
  },
};
export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  args: { value: 'mrn://kafka/topic/prod-eu-west-1.shop.orders.v2.dead-letter-queue.retry' },
  render: (a) => html`<div style="display:flex;align-items:center;gap:var(--space-2);width:320px">
    <code style="min-width:0;overflow-wrap:anywhere">${a.value}</code>
    <mm-copy-button value=${a.value} label="Copy MRN"></mm-copy-button>
  </div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { iconOnly: false, label: 'نسخ المعرّف' } };
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-2);align-items:center">
      <mm-copy-button value=${MRN} label="Copy MRN"></mm-copy-button>
      <mm-copy-button value=${MRN} label="Copy MRN" icon-only="false"></mm-copy-button>
      <span style="background:var(--mm-code-bg);padding:var(--space-2);border-radius:var(--radius-md)"><mm-copy-button tone="code" value="SELECT 1" icon-only="false"></mm-copy-button></span>
    </div>`),
};
