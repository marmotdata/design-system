import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { click, deepActive, nextFrame, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import '@marmotdata/elements/details-blade.js';
import '@marmotdata/elements/description-list.js';
import '@marmotdata/elements/list.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/tag.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/link.js';
import '@marmotdata/elements/skeleton.js';
import '@marmotdata/elements/empty-state.js';
import '@marmotdata/icons/define.js';

type Args = { heading: string; mode: string; resizable: boolean; collapsible: boolean; collapsed: boolean; fullViewHref: string };

const blade = (root: Element) => root.querySelector('mm-details-blade')!;
const handle = (root: Element) => blade(root).shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!;
const now = (root: Element) => Number(handle(root).getAttribute('aria-valuenow'));
const settle = async () => {
  await nextFrame();
  await nextFrame();
};
/** True when `el` is `host` or sits inside it, through shadow roots. */
const within = (host: Element, el: Element | null): boolean => {
  let n: Node | null = el;
  while (n) {
    if (n === host) return true;
    n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
  }
  return false;
};
/** The blade's maximum is half the viewport, so keyboard tests need a desktop-width page. */
const desktop = async () => {
  if (!(globalThis as { __vitest_browser__?: boolean }).__vitest_browser__) return;
  // Resolved from apps/storybook under Vitest; the Storybook UI aliases it to a stub without `page`.
  // @ts-ignore vitest is not a dependency of this package, so its types do not resolve from here.
  const mod = (await import('vitest/browser')) as unknown as { page?: { viewport?(w: number, h: number): Promise<void> } };
  await mod.page?.viewport?.(1280, 800);
  await settle();
};

const frame = (content: unknown, height = 640) =>
  html`<div style="display:flex;justify-content:flex-end;height:${height}px;background:var(--mm-paper);border:1px solid var(--mm-rule)">${content}</div>`;

const details = html`<mm-blade-section heading="Details">
  <mm-description-list>
    <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.orders</mm-description>
    <mm-description term="Provider"><span style="display:inline-flex;gap:6px;align-items:center"><mm-provider-logo provider="postgresql" size="14" decorative></mm-provider-logo>PostgreSQL</span></mm-description>
    <mm-description term="Rows">1,284,019</mm-description>
    <mm-description term="Created">12 Mar 2026</mm-description>
    <mm-description term="Last surveyed">Today, 04:12 UTC</mm-description>
  </mm-description-list>
</mm-blade-section>`;

const owners = html`<mm-blade-section heading="Owners">
  <mm-description-list>
    <mm-description term="Team"><mm-link href="#/teams/analytics-engineering">Analytics Engineering</mm-link></mm-description>
    <mm-description term="Steward">Jane Doe</mm-description>
  </mm-description-list>
</mm-blade-section>`;

/** The asset details blade with realistic content, as on the Asset page. */
const assetBlade = (attrs: { heading?: string; resizable?: boolean; collapsible?: boolean; storageKey?: string } = {}) => html`<mm-details-blade
  heading=${attrs.heading ?? 'orders'}
  full-view-href="#/assets/postgresql/shop.public.orders"
  ?resizable=${attrs.resizable ?? true}
  ?collapsible=${attrs.collapsible ?? true}
  storage-key=${attrs.storageKey ?? ''}
>
  <mm-blade-section heading="Description">
    <mm-button slot="actions" variant="ghost" size="sm" icon="edit" label="Edit description"></mm-button>
    <div style="display:grid;gap:var(--space-2);justify-items:start">
      <mm-text block variant="dense">One row per order placed through the storefront or the partner API. Refunds settle overnight and restate the row.</mm-text>
      <mm-tag variant="plugin"></mm-tag>
      <mm-text block variant="dense" tone="secondary">Imported from the PostgreSQL table comment by postgres-shop.</mm-text>
    </div>
  </mm-blade-section>
  <mm-blade-section heading="Owners" flush>
    <mm-button slot="actions" variant="ghost" size="sm" icon="person-add" label="Add owner"></mm-button>
    <mm-list dense aria-label="Owners" style="--mm-list-inset:var(--space-5)">
      <mm-list-item href="#/teams/analytics-engineering" secondary="Team · 14 members"><mm-icon slot="start" name="groups" aria-hidden="true"></mm-icon>Analytics Engineering</mm-list-item>
      <mm-list-item href="#/people/jane-doe" secondary="Steward"><mm-icon slot="start" name="person" aria-hidden="true"></mm-icon>Jane Doe</mm-list-item>
    </mm-list>
  </mm-blade-section>
  <mm-blade-section heading="Glossary terms">
    <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
      <mm-tag href="#/glossary/gross-merchandise-value">Gross merchandise value</mm-tag>
      <mm-tag href="#/glossary/order">Order</mm-tag>
      <mm-tag variant="pii"></mm-tag>
    </div>
  </mm-blade-section>
  <mm-blade-section heading="Lineage" flush>
    <mm-link slot="actions" href="#/lineage/shop.public.orders">Open lineage</mm-link>
    <mm-list dense aria-label="Nearest lineage" style="--mm-list-inset:var(--space-5)">
      <mm-list-item href="#/assets/kafka/shop.orders.v2" secondary="Upstream · Kafka topic"><mm-provider-logo slot="start" provider="kafka" size="16" decorative></mm-provider-logo><mm-text variant="mono-dense">shop.orders.v2</mm-text></mm-list-item>
      <mm-list-item href="#/assets/postgresql/orders_daily" secondary="Downstream · dbt model"><mm-icon slot="start" name="table-view" aria-hidden="true"></mm-icon><mm-text variant="mono-dense">orders_daily</mm-text></mm-list-item>
      <mm-list-item href="#/assets/postgresql/customers_dim" secondary="Downstream · dbt model"><mm-icon slot="start" name="table-view" aria-hidden="true"></mm-icon><mm-text variant="mono-dense">customers_dim</mm-text></mm-list-item>
    </mm-list>
  </mm-blade-section>
  <mm-blade-section heading="Run history" flush>
    <mm-list dense aria-label="Recent runs" style="--mm-list-inset:var(--space-5)">
      <mm-list-item href="#/runs/8121">postgres-shop<mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>04:12 UTC</mm-text><mm-status-pill slot="end" state="succeeded"></mm-status-pill></mm-list-item>
      <mm-list-item href="#/runs/8120">postgres-shop<mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>03:12 UTC</mm-text><mm-status-pill slot="end" state="failed"></mm-status-pill></mm-list-item>
      <mm-list-item href="#/runs/8119">postgres-shop<mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>02:12 UTC</mm-text><mm-status-pill slot="end" state="succeeded"></mm-status-pill></mm-list-item>
    </mm-list>
  </mm-blade-section>
  ${details}
  <mm-blade-section heading="Danger zone">
    <div style="display:grid;gap:var(--space-3);justify-items:start">
      <mm-text block variant="dense" tone="secondary">Deleting removes the asset, its documentation and its lineage edges from the catalog. The source table is not touched.</mm-text>
      <mm-button variant="danger" icon="delete">Delete asset</mm-button>
    </div>
  </mm-blade-section>
</mm-details-blade>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Details blade',
  component: 'mm-details-blade',
  args: { heading: 'orders', mode: 'static', resizable: false, collapsible: false, collapsed: false, fullViewHref: '#/assets/postgresql/shop.public.orders' },
  argTypes: { mode: { control: 'inline-radio', options: ['static', 'overlay'] } },
  render: (a) =>
    frame(
      html`<mm-details-blade
        heading=${a.heading}
        mode=${a.mode}
        ?open=${a.mode === 'overlay'}
        ?resizable=${a.resizable}
        ?collapsible=${a.collapsible}
        ?collapsed=${a.collapsed}
        full-view-href=${a.fullViewHref}
        >${details}${owners}</mm-details-blade
      >`,
      420,
    ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Keyboard: Tab to the edge handle and use Left and Right to resize by 16px (flipped in right-to-left layouts), Home and End for 320px and half the viewport. In overlay mode Escape closes the blade and focus returns to where it was.',
      },
    },
    usage: {
      html: `<mm-details-blade heading="orders" full-view-href="/assets/postgresql/shop.public.orders" resizable collapsible storage-key="asset.blade">
  <mm-blade-section heading="Details">
    <mm-description-list>
      <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.orders</mm-description>
      <mm-description term="Created">12 Mar 2026</mm-description>
    </mm-description-list>
  </mm-blade-section>
</mm-details-blade>`,
      react: `import { MmDetailsBlade, MmBladeSection } from '@marmotdata/react';

<MmDetailsBlade mode="overlay" open={!!selected} heading={selected?.name} onMmClose={() => setSelected(null)}>
  <MmBladeSection heading="Details">…</MmBladeSection>
</MmDetailsBlade>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/details-blade.js';
  let open = $state(false);
</script>

<mm-details-blade mode="overlay" {open} heading="orders" onmm-close={() => (open = false)}>
  <mm-blade-section heading="Details">…</mm-blade-section>
</mm-details-blade>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const AssetBlade: Story = {
  name: 'Asset details blade',
  render: () => frame(assetBlade(), 900),
};

export const Collapsed: Story = {
  name: 'Collapsed to a rail',
  args: { collapsible: true, collapsed: true },
};

export const CollapseToggle: Story = {
  name: 'Collapse and expand',
  args: { collapsible: true },
  play: async ({ canvasElement }) => {
    const b = blade(canvasElement);
    const toggle = b.shadowRoot!.querySelector('mm-button.collapse')!;
    await click(toggle);
    await expect(b.collapsed).toBe(true);
    await expect(toggle.shadowRoot!.querySelector('button')).toHaveAttribute('aria-expanded', 'false');
    await expect(Math.round(b.getBoundingClientRect().width)).toBe(48);
    await click(toggle);
    await expect(b.collapsed).toBe(false);
  },
};

export const Hover: Story = { args: { resizable: true }, parameters: { pseudo: { hover: true } } };
export const Active: Story = { args: { resizable: true }, parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  name: 'Focus: resize handle',
  args: { resizable: true },
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(handle(canvasElement));
  },
};

const onResize = fn();
export const KeyboardResize: Story = {
  name: 'Keyboard: resize with arrows, Home and End',
  render: () => html`<div @mm-resize=${(e: CustomEvent) => onResize(e.detail.width)}>
    ${frame(html`<mm-details-blade heading="orders" resizable .width=${400}>${details}</mm-details-blade>`, 420)}
  </div>`,
  play: async ({ canvasElement }) => {
    onResize.mockClear();
    await desktop();
    const h = handle(canvasElement);
    await expect(h).toHaveAttribute('aria-orientation', 'vertical');
    await expect(h).toHaveAttribute('aria-valuemin', '320');
    await expect(h).toHaveAttribute('aria-valuemax', String(Math.floor(window.innerWidth / 2)));
    await tab();
    await expect(deepActive()).toBe(h);
    await expect(now(canvasElement)).toBe(400);
    // The handle is on the inline-start (left) edge, so Left widens the blade.
    await press('{ArrowLeft}');
    await expect(now(canvasElement)).toBe(416);
    await expect(Math.round(blade(canvasElement).getBoundingClientRect().width)).toBe(416);
    await press('{ArrowRight}{ArrowRight}');
    await expect(now(canvasElement)).toBe(384);
    await press('{Home}');
    await expect(now(canvasElement)).toBe(320);
    await press('{End}');
    await expect(now(canvasElement)).toBe(Math.floor(window.innerWidth / 2));
    await expect(onResize).toHaveBeenLastCalledWith(Math.floor(window.innerWidth / 2));
  },
};

export const KeyboardResizeRtl: Story = {
  name: 'Keyboard: right to left flips the arrows',
  parameters: { dir: 'rtl' },
  render: () => frame(html`<mm-details-blade heading="orders" resizable .width=${400}>${details}</mm-details-blade>`, 420),
  play: async ({ canvasElement }) => {
    await desktop();
    await tab();
    // In RTL the blade sits on the left with its handle on the right edge, so Right widens it.
    await press('{ArrowRight}');
    await expect(now(canvasElement)).toBe(416);
    await press('{ArrowLeft}{ArrowLeft}');
    await expect(now(canvasElement)).toBe(384);
  },
};

export const Persisted: Story = {
  name: 'Width persisted to localStorage',
  render: () => {
    try {
      localStorage.setItem('storybook.asset.blade', '448');
    } catch {
      /* storage blocked */
    }
    return frame(html`<mm-details-blade heading="orders" resizable storage-key="storybook.asset.blade">${details}</mm-details-blade>`, 420);
  },
  play: async ({ canvasElement }) => {
    await desktop();
    await expect(now(canvasElement)).toBe(448);
    await tab();
    await press('{ArrowLeft}');
    await expect(localStorage.getItem('storybook.asset.blade')).toBe('464');
    localStorage.removeItem('storybook.asset.blade');
  },
};

const overlay = html`<div style="padding:var(--space-8)">
  <mm-button id="open-blade" variant="secondary" icon="info" @click=${(e: Event) => {
    const b = (e.currentTarget as HTMLElement).parentElement!.querySelector('mm-details-blade')!;
    b.open = true;
  }}>Show details</mm-button>
  <mm-details-blade mode="overlay" heading="customers_dim" full-view-href="#/assets/postgresql/customers_dim" resizable>
    <mm-blade-section heading="Details">
      <mm-description-list>
        <mm-description term="MRN" mono>mrn://postgresql/table/shop.public.customers_dim</mm-description>
        <mm-description term="Rows">412,906</mm-description>
        <mm-description term="Created">12 Mar 2026</mm-description>
      </mm-description-list>
    </mm-blade-section>
    ${owners}
  </mm-details-blade>
</div>`;

const onClose = fn();
export const Overlay: Story = {
  name: 'Overlay: Escape closes and focus returns',
  render: () => html`<div @mm-close=${() => onClose()}>${overlay}</div>`,
  play: async ({ canvasElement }) => {
    onClose.mockClear();
    const b = blade(canvasElement);
    const trigger = canvasElement.querySelector('#open-blade')!;
    await expect(getComputedStyle(b).visibility).toBe('hidden');
    await tab();
    await press('{Enter}');
    await expect(b.open).toBe(true);
    await settle();
    // Opened from the keyboard: no slide, and focus moves to the close button.
    await expect(b).toHaveAttribute('data-instant');
    await expect(getComputedStyle(b).visibility).toBe('visible');
    await expect(within(b.shadowRoot!.querySelector('mm-button.close')!, deepActive())).toBe(true);
    await expect(b.shadowRoot!.querySelector('[role="dialog"]')).toHaveAttribute('aria-label', 'customers_dim');
    await press('{Escape}');
    await expect(b.open).toBe(false);
    await expect(onClose).toHaveBeenCalledTimes(1);
    await expect(within(trigger, deepActive())).toBe(true);
  },
};

export const OverlayCloseButton: Story = {
  name: 'Overlay: close button',
  render: () => overlay,
  play: async ({ canvasElement }) => {
    const b = blade(canvasElement);
    await tab();
    await press('{Enter}');
    await settle();
    await press('{Enter}');
    await expect(b.open).toBe(false);
    await expect(within(canvasElement.querySelector('#open-blade')!, deepActive())).toBe(true);
  },
};

export const OverlayOpen: Story = {
  name: 'Overlay: open over content',
  args: { mode: 'overlay', resizable: true },
  render: (a) => html`<div style="padding:var(--space-8);display:grid;gap:var(--space-3);max-width:640px">
    <mm-heading level="1">orders</mm-heading>
    <mm-text block>The overlay blade sits over the page from the inline-end edge, with the float shadow.</mm-text>
    <mm-details-blade mode="overlay" open heading="customers_dim" ?resizable=${a.resizable} full-view-href="#/assets/postgresql/customers_dim">${details}</mm-details-blade>
  </div>`,
};

export const Loading: Story = {
  render: () =>
    frame(
      html`<mm-details-blade heading="orders">
        <mm-blade-section heading="Details"><mm-skeleton loading count="4"></mm-skeleton></mm-blade-section>
        <mm-blade-section heading="Owners"><mm-skeleton loading count="2"></mm-skeleton></mm-blade-section>
      </mm-details-blade>`,
      420,
    ),
};

export const Empty: Story = {
  render: () =>
    frame(
      html`<mm-details-blade heading="orders_daily">
        <mm-blade-section heading="Owners">
          <mm-text block variant="dense" tone="secondary">No one owns orders_daily yet. Add a team or a person so questions reach someone.</mm-text>
        </mm-blade-section>
        <mm-blade-section heading="Details">
          <mm-description-list>
            <mm-description term="Steward"></mm-description>
            <mm-description term="Retention"></mm-description>
          </mm-description-list>
        </mm-blade-section>
      </mm-details-blade>`,
      420,
    ),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () =>
    frame(
      html`<mm-details-blade heading="orders">
        <mm-blade-section heading="Run history">
          <mm-text block variant="dense" tone="danger"><mm-icon name="error" aria-hidden="true"></mm-icon> Run history could not be loaded. The plugin service did not respond.</mm-text>
        </mm-blade-section>
        ${details}
      </mm-details-blade>`,
      420,
    ),
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers and overflowing content',
  render: () =>
    frame(
      html`<mm-details-blade heading="orders_daily_by_customer_region_rollup_v2" full-view-href="#/a" .width=${360}>
        <mm-blade-section heading="Details">
          <mm-description-list>
            <mm-description term="MRN" mono>mrn://postgresql/table/shop.reporting.orders_daily_by_customer_region_rollup_v2</mm-description>
            <mm-description term="Upstream" mono>mrn://kafka/topic/shop.orders.v2.dead_letter_queue_retry_attempts</mm-description>
            <mm-description term="Description">Rolls orders up by day, customer and region, restated nightly when refunds settle and when late partner orders arrive.</mm-description>
          </mm-description-list>
        </mm-blade-section>
      </mm-details-blade>`,
      420,
    ),
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { resizable: true, collapsible: true },
};

export const CompactDensity: Story = { globals: { density: 'compact' }, render: () => frame(assetBlade(), 900) };

export const BothThemes: Story = {
  render: () => html`<div style="display:grid;grid-template-columns:1fr 1fr">
    ${(['light', 'dark'] as const).map(
      (t) => html`<div data-theme=${t} style="background:var(--mm-paper);color:var(--mm-text);padding:var(--space-8) 0 0;min-width:0;display:flex;justify-content:flex-end;height:900px">
        ${assetBlade({ heading: t === 'dark' ? 'orders (Peat)' : 'orders (Light)' })}
      </div>`,
    )}
  </div>`,
};

export const CollapsibleSection: Story = {
  name: 'Collapsible section (More details)',
  render: () => html`<mm-details-blade heading="orders" style="height:420px">
    <mm-blade-section heading="About"><mm-text variant="dense" block>One row per customer order placed through the web shop.</mm-text></mm-blade-section>
    <mm-blade-section heading="More details" collapsible>
      <mm-description-list>
        <mm-description term="MRN" mono>mrn://table/postgresql/shop.public.orders</mm-description>
        <mm-description term="Created by">postgres-shop</mm-description>
      </mm-description-list>
    </mm-blade-section>
  </mm-details-blade>`,
  play: async ({ canvasElement }) => {
    const section = canvasElement.querySelectorAll('mm-blade-section')[1]!;
    const toggle = section.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    await press('{Enter}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(section.shadowRoot!.querySelector('.body')!.hasAttribute('hidden')).toBe(false);
    await press(' ');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
};
