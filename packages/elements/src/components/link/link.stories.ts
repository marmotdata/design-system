import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/link.js';

type Args = { href: string; external: boolean; muted: boolean; quiet: boolean; text: string };

const inner = (el: Element) => el.shadowRoot!.querySelector('a')!;

const prose = html`<p style="font:var(--text-body);max-width:62ch;margin:0">
  <mm-link href="#asset/orders_daily">orders_daily</mm-link> is built nightly from
  <mm-link href="#asset/shop.orders.v2">shop.orders.v2</mm-link>. Read the
  <mm-link href="https://marmotdata.io/docs/lineage" external>lineage guide</mm-link> before changing its upstream joins.
</p>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Link',
  component: 'mm-link',
  args: { href: '#asset/orders_daily', external: false, muted: false, quiet: false, text: 'orders_daily' },
  argTypes: { text: { name: 'link text (slot)' } },
  render: (a) => html`<mm-link href=${a.href} ?external=${a.external} ?muted=${a.muted} ?quiet=${a.quiet}>${a.text}</mm-link>`,
  parameters: {
    usage: {
      html: `<mm-link href="/discover/mrn://postgresql/table/shop.public.orders">orders</mm-link>
<mm-link href="https://marmotdata.io/docs" external>Marmot documentation</mm-link>
<mm-link href="/settings/members" muted>Members</mm-link>
<mm-link href="/discover/mrn://postgresql/table/shop.public.orders" quiet>orders</mm-link>`,
      react: `import { MmLink } from '@marmotdata/react';

<MmLink href="/discover/mrn://postgresql/table/shop.public.orders">orders</MmLink>
<MmLink href="https://marmotdata.io/docs" external>Marmot documentation</MmLink>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/link.js';
</script>

<mm-link href="/discover/mrn://postgresql/table/shop.public.orders">orders</mm-link>
<mm-link href="https://marmotdata.io/docs" external>Marmot documentation</mm-link>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const InProse: Story = { name: 'In running text', render: () => prose };

export const External: Story = {
  args: { href: 'https://marmotdata.io/docs/plugins/postgresql', external: true, text: 'PostgreSQL plugin documentation' },
  play: async ({ canvasElement }) => {
    const a = inner(canvasElement.querySelector('mm-link')!);
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(a.textContent).toContain('(opens in a new tab)');
  },
};

export const Quiet: Story = {
  name: 'Quiet, for rows',
  render: () => html`<ul style="list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2);font:var(--text-dense)">
    <li><mm-link href="#asset/orders_daily" quiet>orders_daily</mm-link></li>
    <li><mm-link href="#asset/customers_dim" quiet>customers_dim</mm-link></li>
    <li><mm-link href="https://marmotdata.io/docs/lineage" quiet external>Lineage guide</mm-link></li>
  </ul>`,
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelectorAll('mm-link');
    await expect(getComputedStyle(inner(links[0]!)).textDecorationLine).toBe('none');
    await expect(inner(links[2]!).textContent).toContain('(opens in a new tab)');
  },
};

export const QuietHover: Story = {
  name: 'Quiet, hover',
  parameters: { pseudo: { hover: true } },
  render: () => html`<p style="font:var(--text-dense);margin:0"><mm-link href="#asset/orders_daily" quiet>orders_daily</mm-link></p>`,
};

export const Muted: Story = {
  name: 'Muted, for chrome',
  render: () => html`<nav aria-label="Footer" style="display:flex;gap:var(--space-4);font:var(--text-caption)">
    <mm-link href="#docs" muted>Documentation</mm-link>
    <mm-link href="#changelog" muted>Changelog</mm-link>
    <mm-link href="https://github.com/marmotdata/marmot" muted external>Source on GitHub</mm-link>
  </nav>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: () => html`<p style="font:var(--text-body);margin:0;display:flex;gap:var(--space-4)"><mm-link href="#a">orders_daily</mm-link><mm-link href="#b" muted>Members</mm-link></p>` };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(inner(canvasElement.querySelector('mm-link')!));
  },
};

export const KeyboardActivation: Story = {
  name: 'Keyboard: Tab reaches each link and Enter follows it',
  render: () => html`<p style="font:var(--text-body);margin:0" @click=${(e: Event) => { e.preventDefault(); onFollow((e.composedPath()[0] as HTMLElement).closest('a')?.getAttribute('href')); }}>
    <mm-link href="#asset/orders_daily">orders_daily</mm-link> feeds <mm-link href="#asset/customers_dim" muted>customers_dim</mm-link>.
  </p>`,
  play: async ({ canvasElement }) => {
    onFollow.mockClear();
    const [first, second] = [...canvasElement.querySelectorAll('mm-link')];
    await tab();
    await expect(deepActive()).toBe(inner(first!));
    await press('{Enter}');
    await expect(onFollow).toHaveBeenLastCalledWith('#asset/orders_daily');
    await tab();
    await expect(deepActive()).toBe(inner(second!));
    await press('{Enter}');
    await expect(onFollow).toHaveBeenLastCalledWith('#asset/customers_dim');
    // Space does not follow a link.
    await press('{Space}');
    await expect(onFollow).toHaveBeenCalledTimes(2);
    await tab(true);
    await expect(deepActive()).toBe(inner(first!));
  },
};
const onFollow = fn();

export const FocusMethod: Story = {
  name: 'focus() moves to the anchor',
  play: async ({ canvasElement }) => {
    canvasElement.querySelector('mm-link')!.focus();
    await expect(deepActive()).toBe(inner(canvasElement.querySelector('mm-link')!));
  },
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<p style="font:var(--text-dense);width:280px;margin:0;overflow-wrap:anywhere">
    Source: <mm-link href="#asset/orders">mrn://postgresql/table/shop.public.orders_daily_rollup_by_region</mm-link>
  </p>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<p style="font:var(--text-body);margin:0">اقرأ <mm-link href="https://marmotdata.io/docs/lineage" external>دليل النسب</mm-link> قبل التعديل.</p>`,
};

export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">${prose}
      <p style="font:var(--text-caption);margin:0;display:flex;gap:var(--space-4)"><mm-link href="#docs" muted>Documentation</mm-link><mm-link href="#changelog" muted>Changelog</mm-link></p>
    </div>`),
};
