import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/list.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/icons/define.js';

type Args = { dense: boolean };

const mains = (root: Element) =>
  Array.from(root.querySelectorAll('mm-list-item')).map((i) => i.shadowRoot!.querySelector('.main'));

const runs = (dense = false) => html`<mm-list ?dense=${dense} aria-label="Recent runs" style="max-width:560px;border:1px solid var(--mm-rule);border-radius:var(--radius-md);background:var(--mm-surface)">
  <mm-list-item href="#/runs/8121" secondary="Triggered by schedule · 1,284,019 rows">
    <mm-provider-logo slot="start" provider="postgresql" decorative></mm-provider-logo>
    postgres-shop
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>04:12 UTC</mm-text>
    <mm-status-pill slot="end" state="succeeded"></mm-status-pill>
  </mm-list-item>
  <mm-list-item href="#/runs/8120" secondary="Triggered by Jane Doe · 412 topics">
    <mm-provider-logo slot="start" provider="kafka" decorative></mm-provider-logo>
    kafka-orders
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>03:58 UTC</mm-text>
    <mm-status-pill slot="end" state="running" live></mm-status-pill>
  </mm-list-item>
  <mm-list-item href="#/runs/8119" secondary="Triggered by schedule · connection refused">
    <mm-provider-logo slot="start" provider="snowflake" decorative></mm-provider-logo>
    snowflake-finance
    <mm-text slot="end" variant="mono-dense" tone="tertiary" numeric>02:00 UTC</mm-text>
    <mm-status-pill slot="end" state="failed"></mm-status-pill>
  </mm-list-item>
</mm-list>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/List',
  component: 'mm-list',
  args: { dense: false },
  render: (a) => runs(a.dense),
  parameters: {
    docs: {
      description: {
        component:
          'Keyboard: an interactive list is one tab stop. Up and Down move between interactive items, Home and End jump to the first and last, Enter follows the link or activates the item, and Tab leaves the list. Moving never selects.',
      },
    },
    usage: {
      html: `<mm-list aria-label="Recent runs">
  <mm-list-item href="/runs/8121" secondary="Triggered by schedule · 1,284,019 rows">
    <mm-provider-logo slot="start" provider="postgresql" decorative></mm-provider-logo>
    postgres-shop
    <mm-status-pill slot="end" state="succeeded"></mm-status-pill>
  </mm-list-item>
</mm-list>`,
      react: `import { MmList, MmListItem, MmStatusPill } from '@marmotdata/react';

<MmList dense aria-label="Members">
  {members.map((m) => (
    <MmListItem key={m.id} interactive selected={m.id === current} secondary={m.email} onMmActivate={() => open(m.id)}>
      {m.name}
      <MmStatusPill slot="end" status="neutral">{m.role}</MmStatusPill>
    </MmListItem>
  ))}
</MmList>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/list.js';
</script>

<mm-list aria-label="Glossary terms">
  {#each terms as term (term.id)}
    <mm-list-item interactive selected={term.id === current} onmm-activate={() => (current = term.id)}>{term.name}</mm-list-item>
  {/each}
</mm-list>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Dense: Story = { args: { dense: true } };

export const Static: Story = {
  name: 'Non-interactive rows',
  render: () => html`<mm-list aria-label="Owners" style="max-width:480px">
    <mm-list-item secondary="Team · 14 members"><mm-icon slot="start" name="groups" aria-hidden="true"></mm-icon>Analytics Engineering</mm-list-item>
    <mm-list-item secondary="Steward"><mm-icon slot="start" name="person" aria-hidden="true"></mm-icon>Jane Doe</mm-list-item>
    <mm-list-item secondary="Agent · read only"><mm-icon slot="start" name="smart-toy" aria-hidden="true"></mm-icon>support-triage-agent</mm-list-item>
  </mm-list>`,
};

export const Selected: Story = {
  render: () => html`<mm-list aria-label="Glossary terms" style="max-width:320px">
    <mm-list-item interactive secondary="Finance">Annual recurring revenue</mm-list-item>
    <mm-list-item interactive selected secondary="Commerce">Gross merchandise value</mm-list-item>
    <mm-list-item interactive secondary="Commerce">Net revenue retention</mm-list-item>
    <mm-list-item interactive disabled secondary="Draft">Order fulfilment rate</mm-list-item>
  </mm-list>`,
  play: async ({ canvasElement }) => {
    const [, second] = mains(canvasElement);
    await expect(second).toHaveAttribute('aria-current', 'true');
    // The selected item is the list's tab stop.
    await tab();
    await expect(deepActive()).toBe(second);
  },
};

export const WithActions: Story = {
  name: 'Row actions',
  render: () => html`<mm-list aria-label="Subscriptions" style="max-width:560px">
    <mm-list-item href="#/assets/orders_daily" secondary="Schema changes and failed runs">
      <mm-icon slot="start" name="table" aria-hidden="true"></mm-icon>
      orders_daily
      <mm-button slot="end" variant="ghost" size="sm" icon="notifications-off" label="Unsubscribe from orders_daily"></mm-button>
    </mm-list-item>
    <mm-list-item href="#/assets/customers_dim" secondary="Failed runs only">
      <mm-icon slot="start" name="table" aria-hidden="true"></mm-icon>
      customers_dim
      <mm-button slot="end" variant="ghost" size="sm" icon="notifications-off" label="Unsubscribe from customers_dim"></mm-button>
    </mm-list-item>
  </mm-list>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(mains(canvasElement)[0]);
  },
};

export const KeyboardArrows: Story = {
  name: 'Keyboard: arrows, Home and End',
  play: async ({ canvasElement }) => {
    const [a, b, c] = mains(canvasElement);
    await tab();
    await expect(deepActive()).toBe(a);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(b);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(c);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(c);
    await press('{ArrowUp}');
    await expect(deepActive()).toBe(b);
    await press('{Home}');
    await expect(deepActive()).toBe(a);
    await press('{End}');
    await expect(deepActive()).toBe(c);
    // One tab stop: only the focused item is tabbable.
    await expect(a).toHaveAttribute('tabindex', '-1');
    await expect(c).toHaveAttribute('tabindex', '0');
  },
};

const onActivate = fn();
export const KeyboardActivate: Story = {
  name: 'Keyboard: Enter activates, disabled items are skipped',
  render: () => html`<mm-list aria-label="Glossary terms" style="max-width:320px" @mm-activate=${(e: Event) => onActivate((e.target as HTMLElement).textContent!.trim())}>
    <mm-list-item interactive>Annual recurring revenue</mm-list-item>
    <mm-list-item interactive disabled>Order fulfilment rate</mm-list-item>
    <mm-list-item interactive>Net revenue retention</mm-list-item>
  </mm-list>`,
  play: async ({ canvasElement }) => {
    onActivate.mockClear();
    const [a, , c] = mains(canvasElement);
    await tab();
    await expect(deepActive()).toBe(a);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(c);
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledWith('Net revenue retention');
    await press('{Space}');
    await expect(onActivate).toHaveBeenCalledTimes(2);
  },
};

export const Empty: Story = {
  render: () => html`<div style="max-width:480px">
    <mm-list aria-label="Subscriptions"></mm-list>
    <mm-text block variant="dense" tone="secondary" style="padding:var(--space-4)">You are not subscribed to any assets yet. Subscribe from an asset page to hear about schema changes and failed runs.</mm-text>
  </div>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-list aria-label="Downstream assets" style="max-width:340px">
    <mm-list-item href="#/a" secondary="Owned by Analytics Engineering and Finance Data Products, refreshed every 15 minutes from three upstream sources">
      Revenue recognition monthly snapshot for every region and currency
      <mm-status-pill slot="end" state="stale"></mm-status-pill>
    </mm-list-item>
    <mm-list-item href="#/b" secondary="Data Platform">customers_dim<mm-status-pill slot="end" state="succeeded"></mm-status-pill></mm-list-item>
  </mm-list>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<mm-list aria-label="Lineage" style="max-width:360px">
    <mm-list-item href="#/a"><mm-text variant="mono-dense">mrn://postgresql/table/shop.public.orders_daily_by_customer_region_rollup_v2</mm-text></mm-list-item>
    <mm-list-item href="#/b"><mm-text variant="mono-dense">mrn://kafka/topic/shop.orders.v2.dead_letter_queue_retry_attempts</mm-text></mm-list-item>
  </mm-list>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  play: KeyboardArrows.play,
};

export const CompactDensity: Story = { globals: { density: 'compact' } };

export const BothThemes: Story = {
  render: () =>
    themes(html`<mm-list aria-label="Glossary terms">
      <mm-list-item interactive secondary="Finance">Annual recurring revenue</mm-list-item>
      <mm-list-item interactive selected secondary="Commerce">Gross merchandise value</mm-list-item>
      <mm-list-item href="#/t" secondary="Commerce"><mm-icon slot="start" name="menu-book" aria-hidden="true"></mm-icon>Net revenue retention<mm-status-pill slot="end" state="stale"></mm-status-pill></mm-list-item>
    </mm-list>`),
};
