import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/popover.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/checkbox.js';
import '@marmotdata/elements/text-field.js';
import '@marmotdata/elements/copy-button.js';
import '@marmotdata/elements/skeleton.js';
import type { MmPopover } from './class.ts';

type Args = { placement: string; offset: number; matchWidth: boolean; label: string };

const popOf = (root: ParentNode) => root.querySelector('mm-popover')!;
const panel = (p: MmPopover) => p.shadowRoot!.querySelector<HTMLElement>('.panel')!;
const innerBtn = (el: Element | null) => el?.shadowRoot?.querySelector('button, input') ?? null;
const isOpen = (p: MmPopover) => panel(p).matches(':popover-open');
const shown = async (p: MmPopover) => {
  await waitFor(() => expect(isOpen(p)).toBe(true));
  await Promise.all(panel(p).getAnimations().map((a) => a.finished.catch(() => undefined)));
};
const hidden = (p: MmPopover) => waitFor(() => expect(isOpen(p)).toBe(false));

const columns = html`<fieldset style="border:0;margin:0;padding:0;display:grid;gap:var(--space-2)">
  <legend style="font:var(--text-label);color:var(--mm-text-2);padding:0;margin-block-end:var(--space-2)">Visible columns</legend>
  <mm-checkbox checked label="Owner"></mm-checkbox>
  <mm-checkbox checked label="Rows"></mm-checkbox>
  <mm-checkbox label="Last updated"></mm-checkbox>
  <mm-checkbox label="Provider"></mm-checkbox>
</fieldset>`;

const onToggle = fn();
const meta: Meta<Args> = {
  title: 'Components/Overlays/Popover',
  component: 'mm-popover',
  args: { placement: 'bottom-start', offset: 4, matchWidth: false, label: 'Column options' },
  argTypes: { placement: { control: 'select', options: ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'right-start', 'left-start'] } },
  render: (a) => html`<div style="display:grid;gap:var(--space-6);justify-items:start">
    <mm-popover placement=${a.placement} offset=${a.offset} ?match-width=${a.matchWidth} label=${a.label} @mm-toggle=${(e: CustomEvent) => onToggle(e.detail.open)}>
      <mm-button slot="trigger" variant="secondary" icon="view-column">Columns</mm-button>
      ${columns}
    </mm-popover>
    <p class="outside" style="margin:0;margin-block-start:220px;font:var(--text-dense);color:var(--mm-text-2)">Showing 4 of 1,284 assets in shop.public.</p>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-popover label="Column options">
  <mm-button slot="trigger" variant="secondary" icon="view-column">Columns</mm-button>
  <mm-checkbox checked label="Owner"></mm-checkbox>
  <mm-checkbox checked label="Rows"></mm-checkbox>
</mm-popover>

<!-- Or point at a trigger elsewhere; place the popover right after it so Tab reaches the content. -->
<mm-button id="share" variant="secondary" icon="share">Share</mm-button>
<mm-popover for="share" label="Share orders_daily">…</mm-popover>`,
      react: `import { MmButton, MmCheckbox, MmPopover } from '@marmotdata/react';

<MmPopover label="Column options" onMmToggle={(e) => setOpen(e.detail.open)}>
  <MmButton slot="trigger" variant="secondary" icon="view-column">Columns</MmButton>
  <MmCheckbox checked>Owner</MmCheckbox>
  <MmCheckbox checked>Rows</MmCheckbox>
</MmPopover>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/popover.js';
</script>

<mm-popover label="Column options" onmm-toggle={(e) => (open = e.detail.open)}>
  <mm-button slot="trigger" variant="secondary" icon="view-column">Columns</mm-button>
  <mm-checkbox checked label="Owner"></mm-checkbox>
  <mm-checkbox checked label="Rows"></mm-checkbox>
</mm-popover>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Open: Story = {
  name: 'Open with the pointer',
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const p = popOf(canvasElement);
    const trigger = innerBtn(p.querySelector('mm-button'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await click(p.querySelector('mm-button')!);
    await shown(p);
    await expect(panel(p)).not.toHaveAttribute('data-instant');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(p)).toHaveAttribute('role', 'dialog');
    await expect(onToggle).toHaveBeenCalledWith(true);
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };

export const KeyboardAndEscape: Story = {
  name: 'Keyboard: opens instantly, Tab enters, Escape returns focus',
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    const trigger = innerBtn(p.querySelector('mm-button'));
    await tab();
    await expect(deepActive()).toBe(trigger);
    await press('{Enter}');
    await shown(p);
    await expect(panel(p)).toHaveAttribute('data-instant');
    await expect(deepActive()).toBe(trigger);
    await tab();
    await expect(deepActive()).toBe(innerBtn(p.querySelector('mm-checkbox')));
    await press('{Escape}');
    await hidden(p);
    await expect(p.open).toBe(false);
    await expect(deepActive()).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Enter toggles it open and closed again.
    await press('{Enter}');
    await shown(p);
    await press('{Enter}');
    await hidden(p);
  },
};

export const LightDismiss: Story = {
  name: 'Pointer: a click outside closes it',
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    await click(p.querySelector('mm-button')!);
    await shown(p);
    await click(canvasElement.querySelector('.outside')!);
    await hidden(p);
    await expect(p.open).toBe(false);
    // Clicking the trigger while open closes it rather than reopening.
    await click(p.querySelector('mm-button')!);
    await shown(p);
    await click(p.querySelector('mm-button')!);
    await hidden(p);
  },
};

export const TabOutCloses: Story = {
  name: 'Keyboard: tabbing past the content closes it',
  render: (a) => html`<div style="display:flex;gap:var(--space-3)">
    ${meta.render!(a, {} as never)}
    <mm-button class="after" variant="ghost">Export CSV</mm-button>
  </div>`,
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    await tab();
    await press('{Enter}');
    await shown(p);
    for (let i = 0; i < 4; i++) await tab();
    await expect(deepActive()).toBe(innerBtn(p.querySelectorAll('mm-checkbox')[3]!));
    await tab();
    await hidden(p);
    await expect(deepActive()).toBe(innerBtn(canvasElement.querySelector('mm-button.after')));
  },
};

export const ForAttribute: Story = {
  name: 'Attached with for',
  render: () => html`
    <mm-button id="share-orders" variant="secondary" icon="share">Share</mm-button>
    <mm-popover for="share-orders" label="Share orders_daily" placement="bottom-end">
      <div style="display:grid;gap:var(--space-3);width:300px">
        <mm-text-field label="Link to this asset" mono readonly value="https://marmot.internal/assets/mrn://postgresql/table/shop.public.orders_daily"></mm-text-field>
        <p style="margin:0;font:var(--text-caption);color:var(--mm-text-2)">Anyone with catalog access can open this link.</p>
      </div>
    </mm-popover>
  `,
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    const trigger = innerBtn(canvasElement.querySelector('#share-orders'));
    await click(canvasElement.querySelector('#share-orders')!);
    await shown(p);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  },
};

export const MatchWidth: Story = {
  name: 'Match trigger width',
  render: () => html`<mm-popover match-width label="Saved filters">
    <mm-button slot="trigger" variant="secondary" icon="filter-list" style="width:320px">Saved filters for shop.public</mm-button>
    <p style="margin:0;font:var(--text-dense)">PII tables owned by Analytics Engineering</p>
  </mm-popover>`,
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    await click(p.querySelector('mm-button')!);
    await shown(p);
    await waitFor(() => expect(panel(p).getBoundingClientRect().width).toBeGreaterThanOrEqual(319));
  },
};

export const Placement: Story = { name: 'Placement: top-end', args: { placement: 'top-end' }, render: (a) => html`<div style="padding-block-start:200px">${meta.render!(a, {} as never)}</div>`, play: Open.play };

export const Loading: Story = {
  name: 'Loading content',
  render: () => html`<mm-popover label="Recent queries">
    <mm-button slot="trigger" variant="secondary" icon="history">Recent queries</mm-button>
    <div style="width:260px"><mm-skeleton loading shape="text" count="3"></mm-skeleton></div>
  </mm-popover>`,
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    await click(p.querySelector('mm-button')!);
    await shown(p);
  },
};

export const Empty: Story = {
  render: () => html`<mm-popover label="Saved filters">
    <mm-button slot="trigger" variant="secondary" icon="filter-list">Saved filters</mm-button>
    <p style="margin:0;font:var(--text-dense);color:var(--mm-text-2);max-width:32ch">No saved filters yet. Set facets in Discover, then save them from the filter bar.</p>
  </mm-popover>`,
  play: Loading.play,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-popover label="Recent queries">
    <mm-button slot="trigger" variant="secondary" icon="history">Recent queries</mm-button>
    <p role="alert" style="margin:0;font:var(--text-dense);color:var(--mm-danger);display:flex;gap:var(--space-2)"><mm-icon name="error"></mm-icon>Recent queries could not be loaded.</p>
  </mm-popover>`,
  play: Loading.play,
};

export const LongIdentifiers: Story = {
  name: 'Overflowing content and long identifiers',
  render: () => html`<mm-popover label="Upstream sources">
    <mm-button slot="trigger" variant="secondary" icon="account-tree">Upstream sources</mm-button>
    <ul style="margin:0;padding:0;list-style:none;display:grid;gap:var(--space-2);font:var(--text-mono-dense);overflow-wrap:anywhere">
      ${Array.from({ length: 24 }, (_, i) => html`<li>mrn://snowflake/table/analytics.staging.stg_finance_orders_by_region_and_currency_${String(i + 1).padStart(2, '0')}</li>`)}
    </ul>
  </mm-popover>`,
  play: async ({ canvasElement }) => {
    const p = popOf(canvasElement);
    await click(p.querySelector('mm-button')!);
    await shown(p);
    // The size middleware caps the height to the viewport; the panel scrolls.
    await waitFor(() => expect(panel(p).scrollHeight).toBeGreaterThan(panel(p).clientHeight));
  },
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { label: 'خيارات الأعمدة' }, play: Open.play };

export const Peat: Story = { parameters: { theme: 'dark' }, play: Open.play };

export const BothThemes: Story = {
  render: (a) => themes(html`<mm-popover label=${a.label}><mm-button slot="trigger" variant="secondary" icon="view-column">Columns</mm-button>${columns}</mm-popover>`),
  play: async ({ canvasElement }) => {
    const p = canvasElement.querySelector('[data-theme="dark"] mm-popover') as MmPopover;
    await click(p.querySelector('mm-button')!);
    await shown(p);
  },
};
