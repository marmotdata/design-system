import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/banner.js';

type Args = { tone: string; surface: string; text: string; href: string; linkText: string; dismissible: boolean };

const meta: Meta<Args> = {
  title: 'Components/Status/Banner',
  component: 'mm-banner',
  args: {
    tone: 'info',
    surface: 'soft',
    text: 'Marmot will be read-only from 22:00 to 23:00 UTC on 2 November while the catalog is upgraded to v0.9.',
    href: '#release-notes',
    linkText: 'Read the release notes',
    dismissible: true,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['info', 'warning', 'danger'] },
    surface: { control: 'inline-radio', options: ['soft', 'sunken'] },
    text: { name: 'message (slot)' },
  },
  parameters: {
    layout: 'fullscreen',
    usage: {
      html: `<mm-banner tone="info" href="/docs/releases/0.9" link-text="Read the release notes" dismissible>
  Marmot will be read-only from 22:00 to 23:00 UTC on 2 November while the catalog is upgraded to v0.9.
</mm-banner>`,
      react: `import { MmBanner } from '@marmotdata/react';

{config.banner && (
  <MmBanner tone={config.banner.variant} href={config.banner.link} linkText={config.banner.linkText} dismissible={config.banner.dismissible} onMmDismiss={rememberDismissed}>
    {config.banner.message}
  </MmBanner>
)}`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/banner.js';
  let { banner } = $props();
</script>

{#if banner}
  <mm-banner tone={banner.variant} href={banner.link} link-text={banner.linkText} dismissible={banner.dismissible} onmm-dismiss={rememberDismissed}>
    {banner.message}
  </mm-banner>
{/if}`,
    },
  },
  render: (a) => html`<mm-banner tone=${a.tone} surface=${a.surface} href=${a.href} link-text=${a.linkText} ?dismissible=${a.dismissible}>${a.text}</mm-banner>`,
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

const all = () => html`<div style="display:grid">
  <mm-banner tone="info" label="Maintenance notice">Marmot will be read-only from 22:00 to 23:00 UTC on 2 November while the catalog is upgraded to v0.9.</mm-banner>
  <mm-banner tone="warning" label="Licence notice" href="#settings" link-text="Open Settings">The SSO certificate for this instance expires on 9 November.</mm-banner>
  <mm-banner tone="danger" label="Incident notice" href="#status" link-text="View status">Lineage ingestion is paused while the search index rebuilds. Catalog reads are unaffected.</mm-banner>
  <mm-banner tone="info" surface="sunken" label="Demo notice">This is the public demo instance. Data resets every night at 03:00 UTC.</mm-banner>
</div>`;

export const Tones: Story = { render: () => all() };

const onDismiss = fn();
export const Dismiss: Story = {
  name: 'Keyboard: dismiss',
  render: () => html`<mm-banner tone="warning" dismissible href="#settings" link-text="Open Settings" @mm-dismiss=${(e: CustomEvent) => onDismiss(e.detail)}
    >The SSO certificate for this instance expires on 9 November.</mm-banner
  >`,
  play: async ({ canvasElement }) => {
    onDismiss.mockClear();
    const banner = canvasElement.querySelector('mm-banner')!;
    await tab();
    await expect(deepActive()).toBe(banner.shadowRoot!.querySelector('a'));
    await tab();
    await expect(deepActive()).toHaveAttribute('aria-label', 'Dismiss');
    await press('{Enter}');
    await expect(onDismiss).toHaveBeenCalledWith({ tone: 'warning' });
    await expect(banner).toHaveAttribute('hidden');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-banner')!.shadowRoot!.querySelector('a'));
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="max-width:420px">
    <mm-banner tone="danger" dismissible href="#status" link-text="View status"
      >Ingestion from mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel is failing on every run since 04:12 UTC. Catalog reads are unaffected.</mm-banner
    >
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { text: 'سيكون Marmot للقراءة فقط من 22:00 إلى 23:00 بالتوقيت العالمي في 2 نوفمبر.', linkText: 'اقرأ ملاحظات الإصدار' },
};

export const BothThemes: Story = {
  render: () => themes(all()),
  // Region names must be unique on a page; a real app shows one banner.
  play: async ({ canvasElement }) => {
    canvasElement.querySelectorAll('[data-theme="dark"] mm-banner').forEach((b) => b.setAttribute('label', `${b.getAttribute('label')} in Peat`));
  },
};
