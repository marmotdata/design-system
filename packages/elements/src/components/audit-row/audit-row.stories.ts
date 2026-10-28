import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/audit-row.js';
import '@marmotdata/elements/button.js';
import type { MmAuditRow } from './class.ts';

type Args = { loading: boolean; error: string };

const DENIED_SQL = `SELECT c.email, c.phone, o.total_gbp
FROM orders_daily o
JOIN customers_dim c USING (customer_id)
WHERE o.order_date = current_date
LIMIT 100;`;

const rows = (opts: { expandFirst?: boolean } = {}) => html`
  <mm-audit-row
    ?expanded=${opts.expandFirst}
    time="2026-10-27T09:42:11Z"
    actor="support-triage-agent"
    actor-kind="agent"
    service-account="svc-support"
    client="mcp"
    source="postgres-shop"
    provider="postgresql"
    .query=${DENIED_SQL}
    outcome="denied"
    reason="Denied because svc-support has no grant on shop.public.customers. customers_dim is tagged PII."
    .duration=${38}
    tables="mrn://postgresql/table/shop.public.orders_daily,mrn://postgresql/table/shop.public.customers"
    query-id="q_01JBK7Z3D9W4R6"
  ></mm-audit-row>
  <mm-audit-row
    time="2026-10-27T09:31:02Z"
    actor="Jane Doe"
    client="editor"
    source="snowflake-analytics"
    provider="snowflake"
    .query=${`SELECT order_date, count(*) AS orders, sum(total_gbp) AS revenue_gbp
FROM analytics.marts.orders_daily
GROUP BY order_date
ORDER BY order_date DESC;`}
    .rows=${1000}
    truncated
    outcome="allowed"
    reason="Allowed by the Analytics Engineering read grant on analytics.marts."
    .duration=${2300}
    tables="mrn://snowflake/table/analytics.marts.orders_daily"
    query-id="q_01JBK6V0F2T8M1"
  ></mm-audit-row>
  <mm-audit-row
    time="2026-10-27T09:12:45Z"
    actor="Jordan Lee"
    client="cli"
    source="postgres-shop"
    provider="postgresql"
    .query=${'SELECT status, sum(total_gbp) FROM shop.public.orders GROUP BY status;'}
    .rows=${6}
    outcome="allowed"
    .duration=${412}
    tables="mrn://postgresql/table/shop.public.orders"
  ></mm-audit-row>
  <mm-audit-row
    time="2026-10-27T08:58:30Z"
    actor="support-triage-agent"
    actor-kind="agent"
    service-account="svc-support"
    client="mcp"
    source="postgres-shop"
    provider="postgresql"
    .query=${'SELECT order_date, orders FROM orders_daily WHERE order_date >= current_date - 7;'}
    .rows=${7}
    outcome="allowed"
    .duration=${51}
    tables="mrn://postgresql/table/shop.public.orders_daily"
  ></mm-audit-row>
  <mm-audit-row
    time="2026-10-27T08:40:19Z"
    actor="Dana Price"
    client="api"
    source="bigquery-events"
    provider="bigquery"
    .query=${'SELECT refund_reason, count(*) FROM shop.orders_v2 GROUP BY 1;'}
    outcome="failed"
    reason="Failed because column refund_reason does not exist in shop.orders_v2 on the source yet."
    .duration=${1180}
    tables="mrn://bigquery/table/shop.orders_v2"
  ></mm-audit-row>
`;

const onEditor = fn();
const onRunAgain = fn();
const onToggle = fn();

const meta: Meta<Args> = {
  title: 'Components/Data/Audit row',
  component: 'mm-audit-log',
  args: { loading: false, error: '' },
  render: (a) => html`<mm-audit-log
    ?loading=${a.loading}
    error=${a.error}
    @mm-open-in-editor=${onEditor}
    @mm-run-again=${onRunAgain}
    @mm-toggle=${onToggle}
    >${rows()}</mm-audit-log
  >`,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An ARIA table with a disclosure button per record. Keyboard: the log is one tab stop; Up and Down move between records, Home and End jump to the first and last, Enter or Space expands, Escape collapses from anywhere in the record and returns focus to its row, and Tab moves into an expanded record.',
      },
    },
    usage: {
      html: `<mm-audit-log style="--mm-audit-max-height: 70vh">
  <mm-audit-row time="2026-10-27T09:42:11Z" actor="support-triage-agent" actor-kind="agent"
    service-account="svc-support" client="mcp" source="postgres-shop" provider="postgresql"
    query="SELECT c.email, c.phone, o.total_gbp FROM orders_daily o JOIN customers_dim c USING (customer_id)"
    outcome="denied" reason="Denied because svc-support has no grant on shop.public.customers."
    duration="38" tables="mrn://postgresql/table/shop.public.orders_daily,mrn://postgresql/table/shop.public.customers"></mm-audit-row>
</mm-audit-log>`,
      react: `import { MmAuditLog, MmAuditRow } from '@marmotdata/react';

<MmAuditLog loading={loading} onMmOpenInEditor={(e) => openEditor(e.detail.query)} onMmRunAgain={(e) => rerun(e.detail.queryId)}>
  {queries.map((q) => (
    <MmAuditRow key={q.id} queryId={q.id} time={q.started_at} actor={q.subject.name} actorKind={q.subject.kind}
      serviceAccount={q.subject.service_account} client={q.client} source={q.source.name} provider={q.source.type}
      query={q.sql} rows={q.rows_returned ?? undefined} truncated={q.truncated} outcome={q.outcome}
      reason={q.decision_detail?.reason ?? q.error} duration={q.duration_ms} tables={q.tables} />
  ))}
</MmAuditLog>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/audit-row.js';
</script>

<mm-audit-log loading={loading} onmm-open-in-editor={(e) => openEditor(e.detail.query)}>
  {#each queries as q (q.id)}
    <mm-audit-row query-id={q.id} time={q.started_at} actor={q.subject.name} actor-kind={q.subject.kind}
      service-account={q.subject.service_account} client={q.client} source={q.source.name} provider={q.source.type}
      query={q.sql} rows={q.rows_returned} truncated={q.truncated} outcome={q.outcome}
      reason={q.decision_detail?.reason ?? q.error} duration={q.duration_ms} tables={q.tables}></mm-audit-row>
  {/each}
</mm-audit-log>`,
    },
  },
  decorators: [(story) => html`<div style="padding:var(--space-8)">${story()}</div>`],
};
export default meta;
type Story = StoryObj<Args>;

const toggles = (c: Element) =>
  Array.from(c.querySelectorAll<MmAuditRow>('mm-audit-row')).map((r) => r.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!);

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const first = canvasElement.querySelector('mm-audit-row')!.shadowRoot!;
    await expect(first.querySelector('.client')!.textContent).toBe('MCP');
    await expect(first.querySelector('.none')!.textContent).toBe('Not run');
    const second = canvasElement.querySelectorAll('mm-audit-row')[1]!.shadowRoot!;
    await expect(second.querySelector('.num span')!.textContent).toBe('1,000');
    await expect(second.querySelector('.trunc')!.textContent).toBe('Truncated');
  },
};

export const KeyboardNavigation: Story = {
  name: 'Keyboard: move, expand and collapse',
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const t = toggles(canvasElement);
    const rowsEls = canvasElement.querySelectorAll<MmAuditRow>('mm-audit-row');
    await tab();
    await expect(deepActive()).toBe(t[0]);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(t[1]);
    await press('{End}');
    await expect(deepActive()).toBe(t[4]);
    await press('{Home}');
    await expect(deepActive()).toBe(t[0]);
    await press('{Enter}');
    await expect(rowsEls[0]!.expanded).toBe(true);
    await expect(t[0]).toHaveAttribute('aria-expanded', 'true');
    await expect(onToggle).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { expanded: true } }));
    await press('{Escape}');
    await expect(rowsEls[0]!.expanded).toBe(false);
    await expect(deepActive()).toBe(t[0]);
    await press('{ArrowDown}');
    await press('{Space}');
    await expect(rowsEls[1]!.expanded).toBe(true);
    // Tab enters the detail: the statement region, then its copy button.
    await tab();
    await expect(deepActive()?.getAttribute('aria-label')).toBe('Statement');
    await press('{Escape}');
    await expect(rowsEls[1]!.expanded).toBe(false);
    await expect(deepActive()).toBe(t[1]);
  },
};

export const Expanded: Story = {
  name: 'Expanded: denied query',
  render: () => html`<mm-audit-log @mm-open-in-editor=${onEditor} @mm-run-again=${onRunAgain}>${rows({ expandFirst: true })}</mm-audit-log>`,
  play: async ({ canvasElement }) => {
    onEditor.mockClear();
    onRunAgain.mockClear();
    const row = canvasElement.querySelector('mm-audit-row')!;
    const root = row.shadowRoot!;
    await expect(root.querySelector('.decision')!.textContent).toContain('Denied because svc-support has no grant on shop.public.customers');
    await expect(root.querySelectorAll('.tables li').length).toBe(2);
    await expect(root.querySelector('code')!.textContent).toBe(DENIED_SQL);
    // The statement sizes to its five lines instead of stretching to the facts beside it.
    const pre = root.querySelector('pre')!;
    const lineH = parseFloat(getComputedStyle(pre).lineHeight) || 20;
    await expect(pre.getBoundingClientRect().height).toBeLessThan(lineH * 5 + 48);
    // The copy button sits beside the statement, never over it.
    await expect(root.querySelector('.code mm-copy-button')!.getBoundingClientRect().left).toBeGreaterThanOrEqual(pre.getBoundingClientRect().right - 0.5);
    const [editor, again] = Array.from(root.querySelectorAll('.actions mm-button'));
    await click(editor!.shadowRoot!.querySelector('button')!);
    await expect(onEditor).toHaveBeenCalledWith(expect.objectContaining({ detail: { query: DENIED_SQL, source: 'postgres-shop', queryId: 'q_01JBK7Z3D9W4R6' } }));
    again!.shadowRoot!.querySelector('button')!.focus();
    await press('{Enter}');
    await expect(onRunAgain).toHaveBeenCalledTimes(1);
  },
};

export const ClickExpands: Story = {
  name: 'Active: click a row to expand',
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelectorAll<MmAuditRow>('mm-audit-row')[2]!;
    await click(row.shadowRoot!.querySelector('.toggle')!);
    await waitFor(() => expect(row.expanded).toBe(true));
    await expect(row.shadowRoot!.querySelector('.detail')).not.toBeNull();
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(toggles(canvasElement)[0]);
  },
};
export const Selected: Story = {
  render: () => html`<mm-audit-log>
    <mm-audit-row selected time="2026-10-27T09:12:45Z" actor="Jordan Lee" client="cli" source="postgres-shop" provider="postgresql" .query=${'SELECT status, sum(total_gbp) FROM shop.public.orders GROUP BY status;'} .rows=${6} outcome="allowed"></mm-audit-row>
  </mm-audit-log>`,
};

export const StickyHeader: Story = {
  name: 'Sticky header in a scrolling log',
  render: () => html`<mm-audit-log style="--mm-audit-max-height:220px">${rows()}${rows()}</mm-audit-log>`,
};

export const Loading: Story = { args: { loading: true }, render: (a) => html`<mm-audit-log ?loading=${a.loading}></mm-audit-log>` };
export const Empty: Story = { render: () => html`<mm-audit-log></mm-audit-log>` };

export const EmptyNarrow: Story = {
  name: 'Empty in a narrow column, with an action',
  render: () => html`<div style="width:560px">
    <mm-audit-log empty-heading="No queries in the last 24 hours">
      <mm-button slot="empty-action" variant="secondary" icon="history">Show the last 7 days</mm-button>
    </mm-audit-log>
  </div>`,
  play: async ({ canvasElement }) => {
    const log = canvasElement.querySelector('mm-audit-log')!;
    await log.updateComplete;
    const wrap = log.shadowRoot!.querySelector('.wrap') as HTMLElement;
    // Nothing to scroll, so no keyboard-unreachable scroll area (axe scrollable-region-focusable).
    await expect(getComputedStyle(wrap).overflowX).toBe('hidden');
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};

export const DefaultColumns: Story = {
  name: 'Default columns in a 1440px page',
  // The main column of a 1440px screen: less the sidebar and the page gutters.
  render: () => html`<div style="width:1136px"><mm-audit-log>${rows()}</mm-audit-log></div>`,
  play: async ({ canvasElement }) => {
    const all = [...canvasElement.querySelectorAll<MmAuditRow>('mm-audit-row')];
    await Promise.all(all.map((r) => r.updateComplete));
    for (const row of all) {
      const cells = row.shadowRoot!.querySelectorAll<HTMLElement>('.row > .td');
      // Time, Who, Client and Outcome show in full: nothing is cut off.
      for (const i of [1, 2, 3, 6]) {
        const cell = cells[i]!;
        await expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
      }
      const chip = cells[2]!.querySelector('mm-owner-chip') as HTMLElement & { updateComplete: Promise<unknown> };
      await chip.updateComplete;
      const name = chip.shadowRoot!.querySelectorAll<HTMLElement>('*');
      for (const n of name) if (getComputedStyle(n).textOverflow === 'ellipsis') await expect(n.scrollWidth).toBeLessThanOrEqual(n.clientWidth + 1);
    }
  },
};
const onRetry = fn();
export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-audit-log error="The audit log could not be loaded because the query service timed out after 30 s." @mm-retry=${onRetry}></mm-audit-log>`,
  play: async () => {
    onRetry.mockClear();
    await tab();
    await press('{Enter}');
    await expect(onRetry).toHaveBeenCalledTimes(1);
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="max-width:720px">
    <mm-audit-log>
      <mm-audit-row
        expanded
        time="2026-10-27T09:42:11Z"
        actor="warehouse-cost-anomaly-detection-agent"
        actor-kind="agent"
        service-account="svc-finops-anomaly-detection-prod"
        client="mcp"
        source="snowflake-finance-reporting-eu-west-1"
        provider="snowflake"
        .query=${`WITH unreconciled AS (SELECT p.payment_id, p.card_fingerprint, p.amount_gbp, p.settled_at FROM finance.payments p LEFT JOIN finance.reconciliation r ON r.payment_id = p.payment_id WHERE r.payment_id IS NULL AND p.settled_at >= dateadd(day, -30, current_date))
SELECT date_trunc('day', settled_at) AS day, count(*) AS payments, sum(amount_gbp) AS amount_gbp
FROM unreconciled
GROUP BY 1
ORDER BY 1;`}
        .rows=${1284019}
        truncated
        outcome="allowed"
        .duration=${192000}
        tables="mrn://snowflake/table/finance.reporting.payments_reconciliation_daily_snapshot_v3,mrn://snowflake/table/finance.reporting.reconciliation"
      ></mm-audit-row>
    </mm-audit-log>
  </div>`,
};

export const LongIdentifiers: Story = { render: OverflowingContent.render };

export const CompactDensity: Story = { globals: { density: 'compact' } };
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => html`<mm-audit-log>${rows({ expandFirst: true })}</mm-audit-log>` };
export const BothThemes: Story = {
  parameters: { layout: 'padded' },
  decorators: [(story) => story()],
  render: () => themes(html`<mm-audit-log>${rows({ expandFirst: true })}</mm-audit-log>`),
};

export const Narrow: Story = {
  name: 'Narrow container (390px)',
  render: () => html`<div style="width:390px"><mm-audit-log>${rows({ expandFirst: true })}</mm-audit-log></div>`,
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('mm-audit-row')!;
    const cell = row.shadowRoot!.querySelector('.cell')!;
    await waitFor(() => expect(cell.getBoundingClientRect().width).toBeLessThanOrEqual(392));
    await expect(getComputedStyle(row.shadowRoot!.querySelector('.decision')!).overflowWrap).toBe('normal');
  },
};
