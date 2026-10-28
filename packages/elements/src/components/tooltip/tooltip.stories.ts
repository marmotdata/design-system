import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/tooltip.js';
import type { MmTooltip, TooltipItem } from './class.ts';

type Args = { placement: string };

const trigger = 'font:var(--text-dense);color:var(--mm-text);text-decoration:underline dotted var(--mm-text-3);text-underline-offset:3px';

const rows: TooltipItem[] = [
  { label: 'Date', value: '27 Oct 2026' },
  { label: 'Rows', value: '1,284,019' },
  { label: 'Change', value: '+2.4%' },
  { label: 'Load time', value: '412 ms' },
];

const meta: Meta<Args> = {
  title: 'Components/Overlays/Tooltip',
  component: 'mm-tooltip',
  args: { placement: 'top' },
  argTypes: { placement: { control: 'select', options: ['top', 'bottom', 'left', 'right', 'top-start', 'bottom-start'] } },
  render: (a) => html`<div style="padding-block:var(--space-8)">
    <span id="orders-updated" tabindex="0" style=${trigger}>Updated 2 hours ago</span>
    <mm-tooltip for="orders-updated" placement=${a.placement}>27 Oct 2026 04:12:09 UTC, from the nightly dbt run</mm-tooltip>
  </div>`,
  parameters: {
    usage: {
      html: `<span id="orders-updated" tabindex="0">Updated 2 hours ago</span>
<mm-tooltip for="orders-updated">27 Oct 2026 04:12:09 UTC</mm-tooltip>

<mm-tooltip content="mrn://postgresql/table/shop.public.orders">
  <a href="/assets/orders">orders</a>
</mm-tooltip>`,
      react: `import { MmTooltip } from '@marmotdata/react';

<span id="orders-updated" tabIndex={0}>Updated 2 hours ago</span>
<MmTooltip for="orders-updated">27 Oct 2026 04:12:09 UTC</MmTooltip>

<MmTooltip variant="data" items={[{ label: 'Rows', value: '1,284,019' }]} open={hovered} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/tooltip.js';
</script>

<span id="orders-updated" tabindex="0">Updated 2 hours ago</span>
<mm-tooltip for="orders-updated">27 Oct 2026 04:12:09 UTC</mm-tooltip>

<mm-tooltip variant="data" items={rows} open={hovered}></mm-tooltip>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const tipIn = (el: HTMLElement) => el.querySelector('mm-tooltip') as MmTooltip;
const visible = (t: MmTooltip) => (t.htmlFor ? t : t.shadowRoot!.querySelector('.tip')!).matches(':popover-open');

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    const span = canvasElement.querySelector('#orders-updated')!;
    await expect(tip).toHaveAttribute('role', 'tooltip');
    await expect(span.getAttribute('aria-describedby')).toBe(tip.id);
  },
};

export const KeyboardFocusAndEscape: Story = {
  name: 'Keyboard: shows on focus, hides on Escape and blur',
  render: (a) => html`<div style="padding-block:var(--space-8);display:flex;gap:var(--space-4)">
    <span id="orders-updated-k" tabindex="0" style=${trigger}>Updated 2 hours ago</span>
    <mm-tooltip for="orders-updated-k" placement=${a.placement}>27 Oct 2026 04:12:09 UTC</mm-tooltip>
    <a href="#owners" style="font:var(--text-dense);color:var(--mm-primary)">Analytics Engineering</a>
  </div>`,
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('#orders-updated-k'));
    await waitFor(() => expect(visible(tip)).toBe(true));
    await press('{Escape}');
    await waitFor(() => expect(visible(tip)).toBe(false));
    // Come back with Shift+Tab from the link after it: from the first stop, Firefox's Shift+Tab leaves the frame.
    canvasElement.querySelector<HTMLElement>('a[href="#owners"]')!.focus();
    await tab(true);
    await expect(deepActive()).toBe(canvasElement.querySelector('#orders-updated-k'));
    await waitFor(() => expect(visible(tip)).toBe(true));
    await tab();
    await waitFor(() => expect(visible(tip)).toBe(false));
  },
};

export const Pointer: Story = {
  name: 'Pointer: shows on enter, hides on leave',
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    const span = canvasElement.querySelector('#orders-updated')!;
    span.dispatchEvent(new PointerEvent('pointerenter'));
    await waitFor(() => expect(visible(tip)).toBe(true));
    span.dispatchEvent(new PointerEvent('pointerleave'));
    await waitFor(() => expect(visible(tip)).toBe(false));
  },
};

export const Wrapping: Story = {
  name: 'Wrapping a trigger',
  render: () => html`<div style="padding-block:var(--space-8)">
    <mm-tooltip content="mrn://postgresql/table/shop.public.orders">
      <a href="#orders" style="font:var(--text-dense);color:var(--mm-primary)">orders</a>
    </mm-tooltip>
  </div>`,
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    const link = canvasElement.querySelector('a')!;
    await waitFor(() => expect(link).toHaveAttribute('aria-description', 'mrn://postgresql/table/shop.public.orders'));
    await tab();
    await expect(deepActive()).toBe(link);
    await waitFor(() => expect(visible(tip)).toBe(true));
    await press('{Escape}');
    await waitFor(() => expect(visible(tip)).toBe(false));
  },
};

export const Data: Story = {
  name: 'Data',
  render: () => html`<div style="padding-block:var(--space-12)">
    <mm-tooltip variant="data" .items=${rows} placement="right" open>
      <span tabindex="0" style=${trigger}>orders_daily, 27 Oct</span>
    </mm-tooltip>
  </div>`,
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    await waitFor(() => expect(visible(tip)).toBe(true));
    const dds = [...tip.shadowRoot!.querySelectorAll('dd')].map((d) => d.textContent);
    await expect(dds).toContain('1,284,019');
  },
};

export const DataAtPoint: Story = {
  name: 'Data at a chart point',
  render: () => html`<div style="padding-block:var(--space-8)">
    <svg width="240" height="64" role="img" aria-label="orders_daily row count, last 7 days" style="display:block;color:var(--mm-text-3)">
      <polyline points="0,48 40,44 80,40 120,42 160,30 200,26 236,20" fill="none" stroke="currentColor" stroke-width="1.25"></polyline>
      <circle cx="236" cy="20" r="3" fill="var(--mm-primary)"></circle>
    </svg>
    <mm-tooltip variant="data" .items=${rows}></mm-tooltip>
  </div>`,
  play: async ({ canvasElement }) => {
    const tip = tipIn(canvasElement);
    const r = canvasElement.querySelector('circle')!.getBoundingClientRect();
    tip.showAt(r.left + r.width / 2, r.top);
    await waitFor(() => expect(visible(tip)).toBe(true));
    tip.hide();
    await waitFor(() => expect(visible(tip)).toBe(false));
  },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="padding-block:var(--space-12)">
    <mm-tooltip open content="Owned by Analytics Engineering. Sourced from mrn://snowflake/table/analytics.marts.customers_dim_scd2_history and refreshed hourly.">
      <span tabindex="0" style=${trigger}>customers_dim</span>
    </mm-tooltip>
  </div>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="padding-block:var(--space-8)">
    <mm-tooltip open content="آخر تحديث 04:12 UTC"><span tabindex="0" style=${trigger}>محدّث قبل ساعتين</span></mm-tooltip>
  </div>`,
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="padding-block:var(--space-12)">
      <mm-tooltip open content="27 Oct 2026 04:12:09 UTC"><span tabindex="0" style=${trigger}>Updated 2 hours ago</span></mm-tooltip>
    </div>`),
};
