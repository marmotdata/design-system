import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/page-header.js';
import '@marmotdata/elements/owner-chip.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/menu-button.js';
import '@marmotdata/elements/menu.js';
import '@marmotdata/elements/tag.js';
import '@marmotdata/elements/link.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/skeleton.js';
import '@marmotdata/icons/define.js';

/** True when `el` is `host` or sits inside it, through shadow roots. */
const within = (host: Element, el: Element | null): boolean => {
  let n: Node | null = el;
  while (n) {
    if (n === host) return true;
    n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null);
  }
  return false;
};

type Args = { heading: string; provider: string; caption: string; mrn: string; description: string; backHref: string; compact: boolean };

const extras = html`
  <mm-owner-chip slot="owners" name="Analytics Engineering" kind="team"></mm-owner-chip>
  <mm-owner-chip slot="owners" name="Jane Doe"></mm-owner-chip>
  <mm-tag slot="tags" href="#/domains/commerce">Commerce</mm-tag>
  <mm-tag slot="tags" variant="pii"></mm-tag>
  <mm-tag slot="tags" variant="certified"></mm-tag>
  <mm-button slot="links" size="sm" href="https://docs.shopwell.io/dbt/#!/model/model.analytics.orders_daily" external
    ><mm-provider-logo slot="icon" provider="dbt" size="16" decorative></mm-provider-logo>dbt docs</mm-button
  >
  <mm-button slot="links" size="sm" href="https://wiki.shopwell.io/data/pii-handling" external icon="menu-book">PII handling runbook</mm-button>
  <mm-button slot="actions" variant="ghost" icon="notifications-active" label="Subscribe to changes" pressed="true"></mm-button>
  <mm-menu-button slot="actions" variant="secondary" icon="more-horiz" label="More actions" icon-only>
    <mm-menu>
      <mm-menu-item icon="edit-note">Edit notes</mm-menu-item>
      <mm-menu-separator></mm-menu-separator>
      <mm-menu-item icon="delete" danger>Delete asset</mm-menu-item>
    </mm-menu>
  </mm-menu-button>
  <mm-button slot="actions" variant="primary" icon="terminal">Query table</mm-button>
`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Page header',
  component: 'mm-page-header',
  args: {
    heading: 'orders',
    provider: 'postgresql',
    caption: '1.28M rows · Updated 5 hours ago',
    mrn: 'mrn://postgresql/table/shop.public.orders',
    description: 'Every order placed through the storefront and partner API, one row per order, restated nightly when refunds settle.',
    backHref: '#/discover',
    compact: false,
  },
  render: (a) => html`<mm-page-header
    heading=${a.heading}
    provider=${a.provider}
    caption=${a.caption}
    mrn=${a.mrn}
    description=${a.description}
    back-href=${a.backHref}
    back-label="Discover"
    ?compact=${a.compact}
    >${extras}</mm-page-header
  >`,
  parameters: {
    usage: {
      html: `<mm-page-header heading="orders" provider="postgresql"
  caption="1.28M rows · Updated 5 hours ago"
  mrn="mrn://postgresql/table/shop.public.orders"
  description="Every order placed through the storefront and partner API."
  back-href="/discover" back-label="Discover">
  <mm-tag slot="tags">Commerce</mm-tag>
  <mm-button slot="actions" variant="primary">Query table</mm-button>
</mm-page-header>`,
      react: `import { MmPageHeader, MmButton } from '@marmotdata/react';

<MmPageHeader compact heading="Pipelines" count={pipelines.length}>
  <MmButton slot="actions" variant="primary" icon="add">Add plugin</MmButton>
</MmPageHeader>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/page-header.js';
</script>

<mm-page-header heading={asset.name} provider={asset.provider} mrn={asset.mrn} caption={asset.caption}>
  <mm-button slot="actions" variant="primary">Query table</mm-button>
</mm-page-header>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Compact: Story = {
  name: 'Compact (list pages)',
  render: () => html`<mm-page-header compact heading="Pipelines" count="24">
    <mm-button slot="actions" variant="secondary" icon="upload">Import</mm-button>
    <mm-button slot="actions" variant="primary" icon="add">Add plugin</mm-button>
  </mm-page-header>`,
};

export const CompactWithCaption: Story = {
  name: 'Compact with a caption',
  render: () => html`<mm-page-header compact heading="Lineage of orders_daily" caption="42 assets · 57 edges · Depth 10">
    <mm-button slot="actions" variant="secondary" icon="arrow-back" href="#asset/orders_daily">Back to orders_daily</mm-button>
  </mm-page-header>`,
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('mm-page-header')!;
    await header.updateComplete;
    const caption = header.shadowRoot!.querySelector('.caption')!;
    await expect(caption.textContent).toBe('42 assets · 57 edges · Depth 10');
    // No uppercase anywhere in the design system.
    await expect(getComputedStyle(caption).textTransform).toBe('none');
  },
};

export const WithCaption: Story = {
  name: 'With a caption (subtitle)',
  render: () => html`<mm-page-header heading="Production" caption="eu-west-1.marmot.cloud · Team plan">
    <mm-button slot="actions" variant="primary" icon="add">Invite members</mm-button>
  </mm-page-header>`,
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('mm-page-header')!;
    await header.updateComplete;
    await expect(header.shadowRoot!.querySelector('[part="caption"]')).toHaveTextContent('eu-west-1.marmot.cloud · Team plan');
  },
};

export const ActionsWrap: Story = {
  name: 'Actions wrap to the start in a narrow column',
  decorators: [(story) => html`<div style="max-width:560px">${story()}</div>`],
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('mm-page-header')!;
    await header.updateComplete;
    const sr = header.shadowRoot!;
    const actions = sr.querySelector('.actions')!.getBoundingClientRect();
    const title = sr.querySelector('.titleblock')!.getBoundingClientRect();
    // On their own row under the title block, starting at the same edge rather than orphaned at the end.
    await expect(actions.top).toBeGreaterThanOrEqual(title.bottom - 1);
    await expect(Math.abs(actions.left - title.left)).toBeLessThan(2);
  },
};

export const WithBreadcrumbs: Story = {
  name: 'Breadcrumbs and icon',
  render: () => html`<mm-page-header heading="Gross merchandise value" icon="menu-book" description="The total value of orders placed before refunds, discounts and fees, in GBP.">
    <nav slot="breadcrumbs" aria-label="Breadcrumbs" style="font:var(--text-label);color:var(--mm-text-2);display:flex;gap:var(--space-2)">
      <mm-link muted href="#/glossary">Glossary</mm-link><span aria-hidden="true">/</span><mm-link muted href="#/glossary/commerce">Commerce</mm-link>
    </nav>
    <mm-button slot="actions" variant="secondary" icon="edit">Edit term</mm-button>
  </mm-page-header>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  name: 'Focus order',
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('mm-page-header')!;
    await tab();
    await expect(deepActive()).toBe(header.shadowRoot!.querySelector('a.back'));
    await tab();
    // The MRN copy button comes next, then the actions with the primary last.
    await expect(within(header.shadowRoot!.querySelector('mm-copy-button')!, deepActive())).toBe(true);
  },
};

export const Loading: Story = {
  render: () => html`<mm-page-header heading="orders" provider="postgresql">
    <mm-skeleton slot="description" loading count="2"></mm-skeleton>
  </mm-page-header>`,
};

export const Empty: Story = {
  name: 'Minimal (title only)',
  render: () => html`<mm-page-header heading="customers_dim"></mm-page-header>`,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('mm-page-header')!.shadowRoot!;
    await expect(root.querySelector('.desc')).toHaveAttribute('hidden');
    await expect(root.querySelector('.actions')).toHaveAttribute('hidden');
  },
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  args: {
    heading: 'orders_daily_by_customer_region_rollup_v2',
    mrn: 'mrn://postgresql/table/shop.reporting.orders_daily_by_customer_region_rollup_v2',
    caption: '12.4M rows · Updated 5 hours ago',
  },
  decorators: [(story) => html`<div style="max-width:420px">${story()}</div>`],
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  args: {
    heading: 'Revenue recognition monthly snapshot for every region, currency and sales channel',
    description:
      'A monthly snapshot of recognised revenue, deferred revenue and refunds for every region, currency and sales channel, reconciled with the general ledger on the third working day of each month and signed off by Finance Data Products.',
  },
  decorators: [(story) => html`<div style="max-width:640px">${story()}</div>`],
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { heading: 'الطلبات', description: 'كل طلب تم عبر المتجر وواجهة الشركاء.' },
};

export const CompactDensity: Story = { globals: { density: 'compact' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<mm-page-header heading="orders" provider="postgresql" caption="1.28M rows · Updated 5 hours ago" mrn="mrn://postgresql/table/shop.public.orders">
      <mm-tag slot="tags">Commerce</mm-tag>
      <mm-button slot="actions" variant="primary" icon="play-arrow">Query table</mm-button>
    </mm-page-header>`),
};
