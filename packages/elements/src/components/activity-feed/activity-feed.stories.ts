import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/activity-feed.js';
import '@marmotdata/elements/tag.js';
import type { MmActivityFeed, MmActivityItem } from './class.ts';

type Args = { pending: number; hasMore: boolean; loading: boolean; error: string };

/** A fixed "now" so relative times and day headings are stable: Tuesday 27 October 2026, 10:00 UTC. */
const NOW = Date.UTC(2026, 9, 27, 10, 0);
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

const items = (interactive = true) => html`
  <mm-activity-item
    ?interactive=${interactive}
    actor="support-triage-agent"
    actor-kind="agent"
    verb="queried"
    target="orders_daily"
    target-href="#/assets/orders_daily"
    time=${at(18)}
    status="denied"
    detail="SELECT c.email, c.phone, o.total_gbp FROM orders_daily o JOIN customers_dim c USING (customer_id)"
  ></mm-activity-item>
  <mm-activity-item
    ?interactive=${interactive}
    actor="Jane Doe"
    actor-href="#/people/jane-doe"
    verb="certified"
    target="customers_dim"
    target-href="#/assets/customers_dim"
    time=${at(55)}
  ></mm-activity-item>
  <mm-activity-item
    ?interactive=${interactive}
    actor="dbt Cloud"
    actor-kind="plugin"
    actor-provider="dbt"
    verb="updated 1,284 assets from the analytics-prod project"
    time=${at(150)}
  ></mm-activity-item>
  <mm-activity-item
    ?interactive=${interactive}
    actor="Dana Price"
    verb="changed the schema of"
    target="shop.orders.v2"
    target-href="#/assets/shop.orders.v2"
    time=${at(60 * 20)}
    detail="Added column refund_reason (varchar); dropped column legacy_status"
  ></mm-activity-item>
  <mm-activity-item
    ?interactive=${interactive}
    actor="support-triage-agent"
    actor-kind="agent"
    verb="queried"
    target="orders_daily"
    target-href="#/assets/orders_daily"
    time=${at(60 * 22)}
    status="allowed"
    detail="SELECT order_date, count(*) AS orders FROM orders_daily WHERE order_date >= current_date - 7 GROUP BY 1"
  ></mm-activity-item>
  <mm-activity-item
    ?interactive=${interactive}
    actor="Jordan Lee"
    verb="queried"
    target="mrn://postgresql/table/shop.public.orders"
    target-href="#/assets/shop.public.orders"
    target-mono
    time=${at(60 * 34)}
    status="allowed"
    detail="SELECT status, sum(total_gbp) FROM shop.public.orders GROUP BY status"
  ></mm-activity-item>
`;

const panel = (content: unknown, width = '640px') =>
  html`<div style="max-width:${width};background:var(--mm-surface);border:1px solid var(--mm-rule);border-radius:var(--radius-md)">
    <div style="display:flex;align-items:center;gap:var(--space-2);padding:12px var(--space-4);border-bottom:1px solid var(--mm-rule)">
      <h2 style="margin:0;font:var(--text-panel-title);flex:1">Activity</h2>
    </div>
    ${content}
  </div>`;

const onActivate = fn();
const onShowNew = fn();
const onLoadMore = fn();

const meta: Meta<Args> = {
  title: 'Components/Data/Activity feed',
  component: 'mm-activity-feed',
  args: { pending: 0, hasMore: false, loading: false, error: '' },
  render: (a) =>
    panel(html`<mm-activity-feed
      .now=${NOW}
      pending=${a.pending}
      ?has-more=${a.hasMore}
      ?loading=${a.loading}
      error=${a.error}
      @mm-activate=${onActivate}
      @mm-show-new=${onShowNew}
      @mm-load-more=${onLoadMore}
      >${items()}</mm-activity-feed
    >`),
  parameters: {
    docs: {
      description: {
        component:
          'Keyboard: interactive items are one tab stop. Up and Down move between items, Home and End jump to the first and last, Enter or Space fires `mm-activate` (open the blade), and Tab reaches the links inside an item. The "new events" button sits in a polite live region.',
      },
    },
    usage: {
      html: `<mm-activity-feed pending="3" has-more>
  <mm-activity-item interactive actor="support-triage-agent" actor-kind="agent" verb="queried"
    target="orders_daily" target-href="/assets/orders_daily" time="2026-10-27T09:42:00Z" status="denied"
    detail="SELECT c.email, c.phone, o.total_gbp FROM orders_daily o JOIN customers_dim c USING (customer_id)"></mm-activity-item>
  <mm-activity-item interactive actor="Jane Doe" verb="certified" target="customers_dim"
    target-href="/assets/customers_dim" time="2026-10-27T09:05:00Z"></mm-activity-item>
</mm-activity-feed>`,
      react: `import { MmActivityFeed, MmActivityItem } from '@marmotdata/react';

<MmActivityFeed pending={pending} hasMore={hasMore} onMmShowNew={showNew} onMmLoadMore={loadMore}>
  {events.map((e) => (
    <MmActivityItem key={e.id} interactive actor={e.actor.name} actorKind={e.actor.kind} verb={e.verb}
      target={e.target.name} targetHref={e.target.href} time={e.time} status={e.decision}
      detail={e.sql?.split('\\n')[0]} onMmActivate={() => openBlade(e.id)} />
  ))}
</MmActivityFeed>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/activity-feed.js';
</script>

<mm-activity-feed pending={pending} has-more={hasMore} onmm-show-new={showNew} onmm-load-more={loadMore}>
  {#each events as e (e.id)}
    <mm-activity-item interactive actor={e.actor.name} actor-kind={e.actor.kind} verb={e.verb}
      target={e.target.name} target-href={e.target.href} time={e.time} status={e.decision}
      detail={e.sql?.split('\\n')[0]} onmm-activate={() => openBlade(e.id)}></mm-activity-item>
  {/each}
</mm-activity-feed>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const feed = (c: Element) => c.querySelector('mm-activity-feed') as MmActivityFeed;
const mains = (c: Element) =>
  Array.from(c.querySelectorAll<MmActivityItem>('mm-activity-item')).map((i) => i.shadowRoot!.querySelector('.main'));

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const root = feed(canvasElement).shadowRoot!;
    await waitFor(() => expect(root.querySelectorAll('.day').length).toBeGreaterThanOrEqual(2));
    await expect(root.querySelector('.day')!.textContent).toBe('Today');
    await expect(root.querySelector('.day')).toHaveAttribute('aria-level', '3');
  },
};

export const KeyboardNavigation: Story = {
  name: 'Keyboard: move and open items',
  play: async ({ canvasElement }) => {
    onActivate.mockClear();
    const m = mains(canvasElement);
    await tab();
    await expect(deepActive()).toBe(m[0]);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(m[1]);
    await press('{End}');
    await expect(deepActive()).toBe(m[5]);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(m[5]);
    await press('{Home}');
    await expect(deepActive()).toBe(m[0]);
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledTimes(1);
    await expect((onActivate.mock.calls[0]![0] as Event).target).toBe(canvasElement.querySelector('mm-activity-item'));
    await press('{ArrowDown}');
    await press('{Space}');
    await expect(onActivate).toHaveBeenCalledTimes(2);
    // Tab leaves the item for its own links: the first item's target link.
    await press('{ArrowUp}');
    await tab();
    await expect(deepActive()?.textContent).toBe('orders_daily');
  },
};

export const AccessibleName: Story = {
  name: 'Items name the actor, verb, target, status and time',
  play: async ({ canvasElement }) => {
    const item = canvasElement.querySelector('mm-activity-item')!;
    const btn = item.shadowRoot!.querySelector('.main')!;
    const ids = btn.getAttribute('aria-labelledby')!.split(' ');
    const text = ids.map((id) => item.shadowRoot!.getElementById(id)!.textContent!.replace(/\s+/g, ' ').trim()).join(' ');
    await expect(text).toContain('support-triage-agent');
    await expect(text).toContain('Agent');
    await expect(text).toContain('queried orders_daily');
    await expect(text).toContain('Denied');
    await expect(text).toContain('2026-10-27 09:42:00');
  },
};

export const NewEvents: Story = {
  name: 'New events waiting',
  args: { pending: 3 },
  play: async ({ canvasElement }) => {
    onShowNew.mockClear();
    const root = feed(canvasElement).shadowRoot!;
    const region = root.querySelector('[aria-live="polite"]')!;
    await expect(region.textContent).toContain('3 new events');
    await tab();
    await press('{Enter}');
    await expect(onShowNew).toHaveBeenCalledWith(expect.objectContaining({ detail: { count: 3 } }));
  },
};

export const LoadMore: Story = {
  args: { hasMore: true },
  play: async ({ canvasElement }) => {
    onLoadMore.mockClear();
    const btn = feed(canvasElement).shadowRoot!.querySelector('mm-button[part="more"]')!;
    await click(btn.shadowRoot!.querySelector('button')!);
    await expect(onLoadMore).toHaveBeenCalledTimes(1);
  },
};

export const LoadingMore: Story = { args: { hasMore: true, loading: true } };

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(mains(canvasElement)[0]);
  },
};
export const Selected: Story = {
  name: 'Active (blade open)',
  render: () =>
    panel(html`<mm-activity-feed .now=${NOW}>
      <mm-activity-item interactive selected actor="support-triage-agent" actor-kind="agent" verb="queried" target="orders_daily" target-href="#/assets/orders_daily" time=${at(18)} status="denied" detail="SELECT c.email, c.phone, o.total_gbp FROM orders_daily o JOIN customers_dim c USING (customer_id)"></mm-activity-item>
      <mm-activity-item interactive actor="Jane Doe" verb="certified" target="customers_dim" target-href="#/assets/customers_dim" time=${at(55)}></mm-activity-item>
    </mm-activity-feed>`),
};

export const ReadOnly: Story = {
  name: 'Not interactive',
  render: () => panel(html`<mm-activity-feed .now=${NOW}>${items(false)}</mm-activity-feed>`),
};

export const Loading: Story = { render: () => panel(html`<mm-activity-feed loading></mm-activity-feed>`) };
export const Empty: Story = { render: () => panel(html`<mm-activity-feed></mm-activity-feed>`) };
const onRetry = fn();
export const ErrorState: Story = {
  name: 'Error',
  render: () =>
    panel(html`<mm-activity-feed error="Activity could not be loaded because the catalog API did not respond." @mm-retry=${onRetry}></mm-activity-feed>`),
  play: async ({ canvasElement }) => {
    onRetry.mockClear();
    await tab();
    await press('{Enter}');
    await expect(onRetry).toHaveBeenCalledTimes(1);
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () =>
    panel(
      html`<mm-activity-feed .now=${NOW}>
        <mm-activity-item interactive actor="warehouse-cost-anomaly-detection-agent" actor-kind="agent" verb="queried" target="finance.payments_reconciliation_daily_snapshot" target-href="#" time=${at(4)} status="denied" detail="SELECT p.payment_id, p.card_fingerprint, p.amount_gbp, r.reconciled_at FROM finance.payments p JOIN finance.reconciliation r ON r.payment_id = p.payment_id WHERE r.reconciled_at IS NULL"></mm-activity-item>
        <mm-activity-item interactive actor="Alexandra Elizabeth Montgomery-Smith" verb="changed the description and owners of" target="customers_dim" target-href="#" time=${at(40)}>
          <mm-tag variant="pii"></mm-tag>
        </mm-activity-item>
      </mm-activity-feed>`,
      '380px',
    ),
};

export const LongIdentifiers: Story = {
  render: () =>
    panel(html`<mm-activity-feed .now=${NOW}>
      <mm-activity-item interactive actor="Jane Doe" verb="added lineage to" target="mrn://snowflake/table/analytics.marts.finance.fct_payments_reconciled_daily_v3" target-href="#" target-mono time=${at(12)}></mm-activity-item>
      <mm-activity-item interactive actor="dbt Cloud" actor-kind="plugin" actor-provider="dbt" verb="marked as stale" target="mrn://kafka/topic/prod.shop.orders.v2.dead-letter-queue" target-href="#" target-mono time=${at(70)}></mm-activity-item>
    </mm-activity-feed>`),
};

export const CompactDensity: Story = { globals: { density: 'compact' } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = {
  render: () => themes(html`<mm-activity-feed .now=${NOW} pending="3" has-more>${items()}</mm-activity-feed>`),
};

export const Narrow: Story = {
  name: 'Narrow container (390px)',
  render: () => html`<div style="width:390px">${panel(html`<mm-activity-feed .now=${NOW}>${items()}</mm-activity-feed>`)}</div>`,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('mm-activity-item')!.shadowRoot!;
    const sentence = root.querySelector('.sentence')!;
    // One line: the sentence truncates and the time stays at the end of the same line.
    await expect(getComputedStyle(sentence).whiteSpace).toBe('nowrap');
    await waitFor(() => expect(root.querySelector('.end')!.getBoundingClientRect().top).toBeLessThan(sentence.getBoundingClientRect().bottom));
    const actor = root.querySelector('.actor') as HTMLElement;
    // The actor stays on one line (a browser may still split it into several boxes on that line).
    await expect(new Set([...actor.getClientRects()].map((r) => Math.round(r.top))).size).toBe(1);
  },
};
