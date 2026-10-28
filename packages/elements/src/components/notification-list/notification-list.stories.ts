import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/notification-list.js';
import type { MmNotificationItem, MmNotificationList } from './class.ts';

type Args = { filters: boolean; filter: string; loading: boolean; error: string };

/** A fixed "now": Tuesday 27 October 2026, 10:00 UTC. */
const NOW = Date.UTC(2026, 9, 27, 10, 0);
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

const items = () => html`
  <mm-notification-item
    notification-id="n_8841"
    type="schema_change"
    heading="The schema of shop.orders.v2 changed"
    message="Column refund_reason (varchar) was added and legacy_status was dropped."
    target="shop.orders.v2"
    target-href="#/assets/shop.orders.v2/schema"
    time=${at(25)}
  ></mm-notification-item>
  <mm-notification-item
    notification-id="n_8839"
    type="access_expiry"
    heading="Your read access to finance.payments expires on 2 November"
    message="Ask Data Platform for an extension to keep querying it."
    target="finance.payments"
    target-href="#/assets/finance.payments"
    time=${at(70)}
  ></mm-notification-item>
  <mm-notification-item
    notification-id="n_8830"
    type="mention"
    heading="Jane Doe mentioned you on customers_dim"
    message="“Can you confirm the email column is masked for support-triage-agent?”"
    target="customers_dim"
    target-href="#/assets/customers_dim"
    time=${at(180)}
  ></mm-notification-item>
  <mm-notification-item
    notification-id="n_8812"
    type="job_complete"
    heading="dbt Cloud finished syncing"
    message="1,284 assets were updated from the analytics-prod project in 3.2 min."
    time=${at(60 * 9)}
    read
  ></mm-notification-item>
  <mm-notification-item
    notification-id="n_8790"
    type="upstream_schema_change"
    heading="An upstream schema change affects orders_daily"
    message="shop.orders.v2 dropped legacy_status, which orders_daily reads."
    target="orders_daily"
    target-href="#/assets/orders_daily/lineage"
    time=${at(60 * 20)}
    read
  ></mm-notification-item>
  <mm-notification-item
    notification-id="n_8771"
    type="team_invite"
    heading="Morgan Clark added you to Analytics Engineering"
    message="You can now edit the 212 assets the team owns."
    time=${at(60 * 30)}
    read
  ></mm-notification-item>
`;

const popover = (content: unknown, width = '400px') =>
  html`<div style="width:${width};max-width:100%;background:var(--mm-raised);border:1px solid var(--mm-rule);border-radius:var(--radius-md);box-shadow:var(--shadow-float)">
    ${content}
  </div>`;

const onActivate = fn();
const onRead = fn();
const onDelete = fn();
const onReadAll = fn();

/** Removes deleted items, as an app would after its API call succeeds. */
const removeOnDelete = (e: CustomEvent<{ id: string }>) => {
  onDelete(e.detail);
  (e.target as Element).remove();
};

const meta: Meta<Args> = {
  title: 'Components/Data/Notification list',
  component: 'mm-notification-list',
  args: { filters: false, filter: 'all', loading: false, error: '' },
  argTypes: { filter: { control: 'inline-radio', options: ['all', 'unread', 'read'] } },
  render: (a) =>
    popover(html`<mm-notification-list
      .now=${NOW}
      ?filters=${a.filters}
      filter=${a.filter}
      ?loading=${a.loading}
      error=${a.error}
      @mm-activate=${onActivate}
      @mm-read=${onRead}
      @mm-delete=${removeOnDelete}
      @mm-read-all=${onReadAll}
      >${items()}</mm-notification-list
    >`),
  parameters: {
    docs: {
      description: {
        component:
          'Keyboard: one tab stop on the item titles; Up and Down move, Home and End jump, Enter opens (`mm-activate`), Tab reaches the target link and the item buttons. After a delete, focus moves to the next notification.',
      },
    },
    usage: {
      html: `<mm-notification-list filters>
  <mm-notification-item notification-id="n_8841" type="schema_change"
    heading="The schema of shop.orders.v2 changed"
    message="Column refund_reason (varchar) was added and legacy_status was dropped."
    target="shop.orders.v2" target-href="/assets/shop.orders.v2/schema" time="2026-10-27T09:35:00Z"></mm-notification-item>
</mm-notification-list>`,
      react: `import { MmNotificationList, MmNotificationItem } from '@marmotdata/react';

<MmNotificationList filters onMmReadAll={markAllRead}>
  {notifications.map((n) => (
    <MmNotificationItem key={n.id} notificationId={n.id} type={n.type} heading={n.title} message={n.message}
      target={n.target?.name} targetHref={n.target?.href} time={n.created_at} read={n.read}
      onMmActivate={() => open(n)} onMmRead={(e) => setRead(n.id, e.detail.read)} onMmDelete={() => remove(n.id)} />
  ))}
</MmNotificationList>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/notification-list.js';
</script>

<mm-notification-list filters onmm-read-all={markAllRead}>
  {#each notifications as n (n.id)}
    <mm-notification-item notification-id={n.id} type={n.type} heading={n.title} message={n.message}
      target={n.target?.name} target-href={n.target?.href} time={n.created_at} read={n.read}
      onmm-activate={() => open(n)} onmm-read={(e) => setRead(n.id, e.detail.read)} onmm-delete={() => remove(n.id)}></mm-notification-item>
  {/each}
</mm-notification-list>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const list = (c: Element) => c.querySelector('mm-notification-list') as MmNotificationList;
const all = (c: Element) => Array.from(c.querySelectorAll<MmNotificationItem>('mm-notification-item'));
const main = (i: MmNotificationItem) => i.shadowRoot!.querySelector<HTMLElement>('.main')!;
const actions = (i: MmNotificationItem) =>
  Array.from(i.shadowRoot!.querySelectorAll('mm-button')).map((b) => b.shadowRoot!.querySelector('button')!);

export const BellPopover: Story = {
  name: 'Default: bell popover',
  play: async ({ canvasElement }) => {
    const first = all(canvasElement)[0]!;
    await expect(main(first).textContent).toContain('Unread');
    await expect(getComputedStyle(main(first)).fontWeight).toBe('600');
    const read = all(canvasElement)[3]!;
    await expect(main(read).textContent).not.toContain('Unread');
    await expect(getComputedStyle(main(read)).fontWeight).toBe('400');
  },
};

export const Page: Story = { name: 'Notifications page with filters', args: { filters: true }, render: (a) => meta.render!(a, {} as never) };

export const KeyboardNavigation: Story = {
  name: 'Keyboard: move, open, mark read and delete',
  play: async ({ canvasElement }) => {
    onActivate.mockClear();
    onRead.mockClear();
    onDelete.mockClear();
    const items0 = all(canvasElement);
    // Tab: "Mark all as read", then the list.
    await tab();
    await tab();
    await expect(deepActive()).toBe(main(items0[0]!));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(main(items0[1]!));
    await press('{End}');
    await expect(deepActive()).toBe(main(items0[5]!));
    await press('{Home}');
    await expect(deepActive()).toBe(main(items0[0]!));
    await press('{Enter}');
    await expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ detail: { id: 'n_8841' } }));
    // Tab to the target link, then "Mark as read".
    await tab();
    await expect(deepActive()?.textContent).toBe('shop.orders.v2');
    await tab();
    await expect(deepActive()).toBe(actions(items0[0]!)[0]);
    await expect(deepActive()).toHaveAttribute('aria-label', 'Mark as read');
    await press('{Enter}');
    await expect(onRead).toHaveBeenCalledWith(expect.objectContaining({ detail: { id: 'n_8841', read: true } }));
    await expect(items0[0]!.read).toBe(true);
    await waitFor(() => expect(deepActive()).toHaveAttribute('aria-label', 'Mark as unread'));
    // Tab to "Delete notification" and delete it: focus moves to the next notification.
    await tab();
    await expect(deepActive()).toHaveAttribute('aria-label', 'Delete notification');
    await press('{Enter}');
    await expect(onDelete).toHaveBeenCalledWith({ id: 'n_8841' });
    await waitFor(() => expect(deepActive()).toBe(main(items0[1]!)));
    await expect(all(canvasElement).length).toBe(5);
  },
};

export const KeyboardFilter: Story = {
  name: 'Keyboard: filter and mark read under Unread',
  args: { filters: true },
  render: (a) => meta.render!(a, {} as never),
  play: async ({ canvasElement }) => {
    const l = list(canvasElement);
    const items0 = all(canvasElement);
    await tab();
    await press('{ArrowRight}');
    await waitFor(() => expect(l.filter).toBe('unread'));
    const visible = () => l.shadowRoot!.querySelector('slot')!.assignedElements();
    await waitFor(() => expect(visible().length).toBe(3));
    await press('{ArrowRight}');
    await waitFor(() => expect(visible().length).toBe(3));
    await expect(l.filter).toBe('read');
    await press('{ArrowLeft}');
    await waitFor(() => expect(l.filter).toBe('unread'));
    // Into the list, over to "Mark as read" on the first unread one: it leaves the Unread view and focus moves on.
    await tab();
    await tab();
    await expect(deepActive()).toBe(main(items0[0]!));
    await tab();
    await tab();
    await expect(deepActive()).toHaveAttribute('aria-label', 'Mark as read');
    await press('{Enter}');
    await waitFor(() => expect(visible().length).toBe(2));
    await waitFor(() => expect(deepActive()).toBe(main(items0[1]!)));
  },
};

export const MarkAllAsRead: Story = {
  play: async ({ canvasElement }) => {
    onReadAll.mockClear();
    await tab();
    await expect(((deepActive()?.getRootNode() as ShadowRoot).host as HTMLElement).textContent?.trim()).toBe('Mark all as read');
    await press('{Enter}');
    await expect(onReadAll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(all(canvasElement).every((i) => i.read)).toBe(true));
    await waitFor(() => expect(list(canvasElement).shadowRoot!.textContent).not.toContain('Mark all as read'));
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await tab();
    await expect(deepActive()).toBe(main(all(canvasElement)[0]!));
  },
};

export const Unread: Story = { name: 'Unread filter', args: { filters: true, filter: 'unread' }, render: (a) => meta.render!(a, {} as never) };

export const Empty: Story = {
  render: () => popover(html`<mm-notification-list filters></mm-notification-list>`),
  play: async ({ canvasElement }) => {
    await expect(list(canvasElement).shadowRoot!.querySelector('mm-empty-state')).toHaveAttribute('heading', 'You’re up to date');
  },
};
export const AllRead: Story = {
  name: 'Empty: nothing unread',
  render: () =>
    popover(html`<mm-notification-list .now=${NOW} filters filter="unread">
      <mm-notification-item read type="job_complete" heading="dbt Cloud finished syncing" message="1,284 assets were updated from the analytics-prod project in 3.2 min." time=${at(60 * 9)}></mm-notification-item>
    </mm-notification-list>`),
};
export const Loading: Story = { args: { loading: true }, render: (a) => popover(html`<mm-notification-list ?loading=${a.loading}></mm-notification-list>`) };
export const ErrorState: Story = {
  name: 'Error',
  render: () => popover(html`<mm-notification-list error="Notifications could not be loaded. Check your connection and try again."></mm-notification-list>`),
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () =>
    popover(
      html`<mm-notification-list .now=${NOW}>
        <mm-notification-item
          type="downstream_schema_change"
          heading="A schema change on shop.orders.v2 affects 14 downstream assets owned by Analytics Engineering and Finance Reporting"
          message="Dashboards reading legacy_status, including Weekly revenue by channel and Refunds by reason, may show empty values until they are updated."
          target="finance.reporting.payments_reconciliation_daily_snapshot_v3"
          target-href="#"
          time=${at(3)}
        ></mm-notification-item>
      </mm-notification-list>`,
      '320px',
    ),
};

export const LongIdentifiers: Story = {
  render: () =>
    popover(html`<mm-notification-list .now=${NOW}>
      <mm-notification-item type="asset_deleted" heading="An asset you subscribe to was deleted" message="It was removed by the kafka-orders plugin run 8121." target="mrn://kafka/topic/prod.shop.orders.v2.dead-letter-queue" time=${at(44)}></mm-notification-item>
      <mm-notification-item type="lineage_change" heading="New lineage for customers_dim" message="An observed edge was added from the dbt model below." target="mrn://dbt/model/analytics.marts.finance.fct_payments_reconciled_daily_v3" target-href="#" time=${at(90)} read></mm-notification-item>
    </mm-notification-list>`),
};

export const AllTypes: Story = {
  render: () =>
    popover(
      html`<mm-notification-list .now=${NOW}>
        ${(
          [
            ['system', 'Marmot will be upgraded to 0.9 on Saturday at 02:00 UTC'],
            ['schema_change', 'The schema of shop.orders.v2 changed'],
            ['asset_change', 'Jane Doe updated the description of customers_dim'],
            ['team_invite', 'Morgan Clark added you to Analytics Engineering'],
            ['mention', 'Jane Doe mentioned you on customers_dim'],
            ['job_complete', 'dbt Cloud finished syncing'],
            ['upstream_schema_change', 'An upstream schema change affects orders_daily'],
            ['downstream_schema_change', 'Your change to shop.orders.v2 affects 14 downstream assets'],
            ['lineage_change', 'New lineage for customers_dim'],
            ['asset_deleted', 'prod.shop.orders.v2.dead-letter-queue was deleted'],
            ['access_expiry', 'Your read access to finance.payments expires on 2 November'],
          ] as const
        ).map(([type, heading], i) => html`<mm-notification-item type=${type} heading=${heading} time=${at(i * 47 + 5)} ?read=${i > 4}></mm-notification-item>`)}
      </mm-notification-list>`,
      '440px',
    ),
};

export const CompactDensity: Story = { globals: { density: 'compact' } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { filters: true } };
export const BothThemes: Story = {
  render: () => themes(popover(html`<mm-notification-list .now=${NOW} filters>${items()}</mm-notification-list>`, '100%')),
};

export const Narrow: Story = {
  name: 'Narrow container (390px)',
  render: () => popover(html`<mm-notification-list .now=${NOW}>${items()}</mm-notification-list>`, '390px'),
  play: async ({ canvasElement }) => {
    const root = all(canvasElement)[1]!.shadowRoot!;
    // The message and target are one quiet line, truncated.
    await expect(getComputedStyle(root.querySelector('.message')!).whiteSpace).toBe('nowrap');
    await waitFor(() =>
      expect(root.querySelector('.end')!.getBoundingClientRect().top).toBeGreaterThanOrEqual(root.querySelector('.text')!.getBoundingClientRect().bottom - 1),
    );
  },
};
