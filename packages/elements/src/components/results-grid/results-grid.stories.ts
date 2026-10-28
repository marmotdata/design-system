import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/results-grid.js';
import type { MmResultsGrid, ResultColumn } from './class.ts';

// ---- select * from shop.public.orders limit 1000 ----

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');
const uuid = (r: () => number) => `${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-a${hex(r, 3)}-${hex(r, 12)}`;

const ORDER_COLUMNS: ResultColumn[] = [
  { name: 'order_id', type: 'int8' },
  { name: 'customer_id', type: 'uuid' },
  { name: 'total', type: 'numeric' },
  { name: 'currency', type: 'varchar' },
  { name: 'status', type: 'varchar' },
  { name: 'is_gift', type: 'bool' },
  { name: 'created_at', type: 'timestamptz' },
  { name: 'shipped_at', type: 'timestamptz' },
  { name: 'metadata', type: 'jsonb' },
];
const STATUSES = ['paid', 'paid', 'shipped', 'shipped', 'delivered', 'refunded', 'cancelled'];
const CHANNELS = ['web', 'ios', 'android', 'pos'];
const ORDERS: unknown[][] = (() => {
  const r = rng(42);
  return Array.from({ length: 1000 }, (_, i) => {
    const created = Date.UTC(2026, 9, 27, 4, 12, 9) - i * 517_000;
    const status = STATUSES[Math.floor(r() * STATUSES.length)]!;
    const shipped = status === 'shipped' || status === 'delivered' ? new Date(created + 86_400_000 * (1 + r())).toISOString().replace('T', ' ').replace('Z', '+00') : null;
    return [
      9_812_400 - i,
      uuid(r),
      (12 + r() ** 2 * 480).toFixed(2),
      r() > 0.85 ? 'EUR' : 'GBP',
      status,
      r() > 0.92,
      new Date(created).toISOString().replace('T', ' ').replace('Z', '+00'),
      shipped,
      r() > 0.1
        ? { channel: CHANNELS[Math.floor(r() * CHANNELS.length)], items: 1 + Math.floor(r() * 6), promo: r() > 0.7 ? 'AUTUMN26' : null, warehouse: r() > 0.5 ? 'MAN-2' : 'BRS-1' }
        : null,
    ];
  });
})();

// ---- 200 columns × 1,000,000 rows, generated on demand ----

const TYPES = ['int8', 'varchar', 'numeric', 'timestamptz', 'bool', 'uuid', 'jsonb', 'int4'];
const WIDE_COLUMNS: ResultColumn[] = Array.from({ length: 200 }, (_, c) => {
  const type = c === 0 ? 'int8' : TYPES[c % TYPES.length]!;
  const stems = ['event', 'session', 'page', 'device', 'region', 'campaign', 'basket', 'sku'];
  return { name: c === 0 ? 'event_id' : `${stems[c % stems.length]}_${type === 'bool' ? 'is_' : ''}${['value', 'code', 'count', 'at', 'flag', 'ref', 'attrs', 'rank'][c % 8]}_${c}`, type };
});
const cache = new Map<number, unknown[]>();
function wideRow(i: number): unknown[] {
  const hit = cache.get(i);
  if (hit) return hit;
  const r = rng(i * 7919 + 1);
  const row = WIDE_COLUMNS.map((col, c) => {
    if (c === 0) return 50_000_000 + i;
    if (r() < 0.04) return null;
    switch (col.type) {
      case 'int8':
        return Math.floor(r() * 9_000_000);
      case 'int4':
        return Math.floor(r() * 5000);
      case 'numeric':
        return (r() * 1200).toFixed(2);
      case 'timestamptz':
        return new Date(Date.UTC(2026, 9, 27) - Math.floor(r() * 9e9)).toISOString().replace('T', ' ').replace('Z', '+00');
      case 'bool':
        return r() > 0.5;
      case 'uuid':
        return uuid(r);
      case 'jsonb':
        return { source: 'segment', v: 2 };
      default:
        return ['GB', 'IE', 'FR', 'DE', 'NL'][Math.floor(r() * 5)];
    }
  });
  if (cache.size > 5000) cache.clear();
  cache.set(i, row);
  return row;
}

// ---- Helpers ----

const gridIn = (el: HTMLElement) => el.querySelector('mm-results-grid') as MmResultsGrid;
const sr = (el: HTMLElement) => gridIn(el).shadowRoot!;
const cellAt = (el: HTMLElement, r: number, c: number) => sr(el).querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`);
const pos = (node: Element | null) => {
  const cell = node as HTMLElement | null;
  return cell?.dataset?.c !== undefined ? { r: Number(cell.dataset.r), c: Number(cell.dataset.c) } : null;
};
const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const writes = fn(async (_text: string) => {});
const stubClipboard = () => {
  writes.mockClear();
  Object.defineProperty(navigator.clipboard, 'writeText', { value: writes, configurable: true });
};
const onExport = fn();
const onCopy = fn();
const onResize = fn();

type Args = { duration: number; truncated: boolean; noExport: boolean };

const orders = (a: Partial<Args> & { rows?: unknown[][]; columns?: ResultColumn[]; style?: string } = {}) =>
  html`<mm-results-grid
    label="Results of select * from shop.public.orders limit 1000"
    filename="shop_public_orders"
    .columns=${a.columns ?? ORDER_COLUMNS}
    .rows=${a.rows ?? ORDERS}
    duration=${a.duration ?? 412}
    ?truncated=${a.truncated ?? true}
    ?no-export=${a.noExport ?? false}
    style=${a.style ?? ''}
    @mm-export=${(e: CustomEvent) => {
      e.preventDefault();
      onExport(e.detail);
    }}
    @mm-copy=${(e: CustomEvent) => onCopy(e.detail)}
    @mm-column-resize=${(e: CustomEvent) => onResize(e.detail)}
  ></mm-results-grid>`;

const meta: Meta<Args> = {
  title: 'Components/Data/Results grid',
  component: 'mm-results-grid',
  args: { duration: 412, truncated: true, noExport: false },
  render: (a) => orders(a),
  parameters: {
    usage: {
      html: `<mm-results-grid id="results" duration="412" truncated filename="shop_public_orders"></mm-results-grid>
<script type="module">
  import '@marmotdata/elements/results-grid.js';
  const grid = document.getElementById('results');
  grid.columns = [{ name: 'order_id', type: 'int8' }, { name: 'total', type: 'numeric' }, { name: 'metadata', type: 'jsonb' }];
  grid.rows = [[9812400, '149.90', { channel: 'web' }]];
  // Streaming: grid.rowCount = 1000000; grid.getRow = (i) => cache.get(i); then grid.refresh() as pages arrive.
</script>`,
      react: `import { MmResultsGrid } from '@marmotdata/react';

<MmResultsGrid
  columns={result.columns}
  rows={result.rows}
  duration={result.durationMs}
  truncated={result.truncated}
  filename="shop_public_orders"
  onMmExport={(e) => { e.preventDefault(); exportOnServer(e.detail.format); }}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/results-grid.js';
  let { result } = $props();
</script>

<mm-results-grid
  columns={result.columns}
  rows={result.rows}
  duration={result.durationMs}
  truncated={result.truncated}
  filename="shop_public_orders"
  onmm-copy={(e) => toast(\`Copied \${e.detail.rows} rows\`)}
></mm-results-grid>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const status = sr(canvasElement).querySelector('[part="status"]')!;
    await expect(status.textContent!.replace(/\s+/g, ' ').replace(/ ?· ?/g, ' · ').trim()).toBe('1,000 rows · 9 columns · 412 ms · Truncated at 1,000 rows');
    await expect(sr(canvasElement).querySelector('.warn mm-icon')).toHaveAttribute('name', 'warning');
    // NULL is a word, booleans read true/false, numbers sit right.
    await expect(cellAt(canvasElement, 1, 5)).toHaveTextContent(/^(true|false)$/);
    const nullCell = sr(canvasElement).querySelector('.cell.null')!;
    await expect(nullCell).toHaveTextContent('NULL');
    await expect(cellAt(canvasElement, 1, 2)).toHaveClass('num');
  },
};

export const WideAndLong: Story = {
  name: '200 columns × 1,000,000 rows',
  // Stress data: kept out of the Storybook UI (see .storybook/main.ts), still run as a test.
  tags: ['!dev', 'stress'],
  render: () => html`<mm-results-grid
    label="Results of select * from events.web_events"
    duration=${2_310}
    .columns=${WIDE_COLUMNS}
    .getRow=${wideRow}
    row-count="1000000"
    @mm-export=${(e: Event) => e.preventDefault()}
  ></mm-results-grid>`,
  play: async ({ canvasElement }) => {
    const grid = gridIn(canvasElement);
    await grid.updateComplete;
    await settle();
    const count = () => ({ rows: sr(canvasElement).querySelectorAll('.rows [role="row"]').length, cells: sr(canvasElement).querySelectorAll('[role="gridcell"]').length });
    await expect(count().rows).toBeLessThan(200);
    await expect(count().cells).toBeLessThan(1500);
    await expect(sr(canvasElement).querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '1000001');
    await expect(sr(canvasElement).querySelector('[role="grid"]')).toHaveAttribute('aria-colcount', '201');
    const scroller = sr(canvasElement).querySelector<HTMLElement>('.scroller')!;
    const t0 = performance.now();
    scroller.scrollTop = 28 * 600_000;
    scroller.scrollLeft = 160 * 100;
    await settle();
    await grid.updateComplete;
    const ms = performance.now() - t0;
    await expect(ms).toBeLessThan(1000);
    const first = Number(sr(canvasElement).querySelector('.rows [role="row"]')!.getAttribute('aria-rowindex'));
    await expect(first).toBeGreaterThan(590_000);
    await expect(count().cells).toBeLessThan(1500);
    await tab();
    await press('{Control>}{End}{/Control}');
    await waitFor(() => expect(pos(deepActive())).toEqual({ r: 1_000_000, c: 199 }));
    await expect(count().rows).toBeLessThan(200);
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, render: () => orders({ rows: ORDERS.slice(0, 8) }) };

export const Focus: Story = {
  render: () => orders({ rows: ORDERS.slice(0, 8) }),
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(cellAt(canvasElement, 0, 0));
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(cellAt(canvasElement, 1, 0));
  },
};

export const RangeSelected: Story = {
  name: 'Selected range',
  render: () => orders({ rows: ORDERS.slice(0, 12) }),
  play: async ({ canvasElement }) => {
    await tab();
    await press('{ArrowDown}{ArrowRight}{ArrowRight}');
    await press('{Shift>}{ArrowDown}{ArrowDown}{ArrowRight}{/Shift}');
    await waitFor(() => expect(sr(canvasElement).querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(6));
  },
};

export const Resizing: Story = {
  render: () => orders({ rows: ORDERS.slice(0, 8) }),
  play: async ({ canvasElement }) => {
    cellAt(canvasElement, 0, 1)!.querySelector('.resize')!.classList.add('active');
  },
};

export const Loading: Story = {
  name: 'Loading (streaming rows)',
  render: () => html`<mm-results-grid
    label="Results of select * from shop.public.orders"
    .columns=${ORDER_COLUMNS}
    .getRow=${(i: number) => (i < 6 ? ORDERS[i] : undefined)}
    row-count="1000"
  ></mm-results-grid>`,
  play: async ({ canvasElement }) => {
    await expect(cellAt(canvasElement, 8, 0)).toHaveAttribute('aria-busy', 'true');
  },
};

export const Empty: Story = {
  render: () => orders({ rows: [], truncated: false, duration: 38 }),
  play: async ({ canvasElement }) => {
    await expect(sr(canvasElement).querySelector('.empty')).toHaveTextContent('The query ran and returned no rows.');
  },
};

const LONG_ROWS = ORDERS.slice(0, 6).map((r, i) =>
  i === 0
    ? [r[0], r[1], r[2], r[3], 'awaiting_manual_fraud_review_by_payments_operations_team', r[5], r[6], r[7], { ...(r[8] as object), note: 'Customer asked for the parcel to be left with the neighbour at number 14 if nobody answers the door.', lines: [{ sku: 'TEA-ASSAM-250', qty: 2 }, { sku: 'MUG-STONE-GRY', qty: 1 }] }]
    : r,
);
export const Overflowing: Story = { name: 'Overflowing content', render: () => html`<div style="max-inline-size:640px">${orders({ rows: LONG_ROWS })}</div>` };

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () =>
    orders({
      columns: [
        { name: 'fulfilment_centre_identifier_from_warehouse_management_system', type: 'varchar' },
        { name: 'order_total_including_tax_and_shipping_in_minor_units', type: 'int8' },
        { name: 'mrn', type: 'text' },
      ],
      rows: [
        ['MAN-2', 14990, 'mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_fulfilment_centre'],
        ['BRS-1', 2350, 'mrn://snowflake/table/analytics.marts.customers_dim'],
      ],
      truncated: false,
    }),
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => orders({ rows: ORDERS.slice(0, 10) }) };

export const BothThemes: Story = { render: () => themes(orders({ rows: ORDERS.slice(0, 8), style: '--mm-results-grid-height:260px' })) };

// ---- Keyboard ----

export const KeyboardGrid: Story = {
  name: 'Keyboard: grid navigation',
  play: async ({ canvasElement }) => {
    await tab();
    await expect(pos(deepActive())).toEqual({ r: 0, c: 0 });
    await press('{ArrowDown}{ArrowDown}{ArrowRight}');
    await expect(pos(deepActive())).toEqual({ r: 2, c: 1 });
    await press('{End}');
    await expect(pos(deepActive())).toEqual({ r: 2, c: 8 });
    await press('{Home}');
    await expect(pos(deepActive())).toEqual({ r: 2, c: 0 });
    await press('{PageDown}');
    await waitFor(() => expect(pos(deepActive())!.r).toBeGreaterThan(8));
    await press('{Control>}{End}{/Control}');
    await waitFor(() => expect(pos(deepActive())).toEqual({ r: 1000, c: 8 }));
    await expect(deepActive()!.closest('[role="row"]')).toHaveAttribute('aria-rowindex', '1001');
    await press('{Control>}{Home}{/Control}');
    await waitFor(() => expect(pos(deepActive())).toEqual({ r: 0, c: 0 }));
    await press('{ArrowDown}');
    const head = sr(canvasElement).querySelector('.head')!.getBoundingClientRect();
    await expect((deepActive() as HTMLElement).getBoundingClientRect().top).toBeGreaterThanOrEqual(head.bottom - 1);
  },
};

export const KeyboardCopy: Story = {
  name: 'Keyboard: copy a range as TSV',
  render: () => orders({ rows: ORDERS.slice(0, 12) }),
  play: async () => {
    stubClipboard();
    onCopy.mockClear();
    await tab();
    await press('{ArrowDown}');
    await press('{Shift>}{ArrowDown}{ArrowRight}{ArrowRight}{/Shift}');
    await press('{Control>}c{/Control}');
    const expected = ORDERS.slice(0, 2)
      .map((r) => [r[0], r[1], r[2]].join('\t'))
      .join('\n');
    await waitFor(() => expect(writes).toHaveBeenCalledWith(expected));
    await expect(onCopy).toHaveBeenCalledWith({ value: expected, rows: 2, columns: 3 });
  },
};

export const KeyboardInspector: Story = {
  name: 'Keyboard: inspect a cell',
  render: () => orders({ rows: ORDERS.slice(0, 12) }),
  play: async ({ canvasElement }) => {
    await tab();
    await press('{ArrowDown}{End}');
    await expect(pos(deepActive())).toEqual({ r: 1, c: 8 });
    await press('{Enter}');
    const panel = await waitFor(() => {
      const p = sr(canvasElement).querySelector('[part="inspector"]');
      expect(p).not.toBeNull();
      return p!;
    });
    await expect(panel).toHaveAttribute('role', 'dialog');
    const pre = panel.querySelector('pre')!;
    await expect(deepActive()).toBe(pre);
    await expect(pre.textContent).toBe(JSON.stringify(ORDERS[0]![8], null, 2));
    await expect(panel).toHaveTextContent('metadata');
    await expect(panel).toHaveTextContent('jsonb');
    await press('{Escape}');
    await waitFor(() => expect(sr(canvasElement).querySelector('[part="inspector"]')).toBeNull());
    await expect(pos(deepActive())).toEqual({ r: 1, c: 8 });
    // Double-click opens it too.
    cellAt(canvasElement, 2, 3)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await waitFor(() => expect(sr(canvasElement).querySelector('[part="inspector"] pre')).toHaveTextContent(String(ORDERS[1]![3])));
  },
};

export const KeyboardResize: Story = {
  name: 'Keyboard: resize a column',
  render: () => orders({ rows: ORDERS.slice(0, 8) }),
  play: async ({ canvasElement }) => {
    onResize.mockClear();
    await tab();
    await press('{ArrowRight}{Enter}');
    const handle = deepActive() as HTMLElement;
    await expect(handle).toHaveAttribute('role', 'separator');
    await expect(handle).toHaveAttribute('aria-label', 'Resize customer_id column');
    const before = Number(handle.getAttribute('aria-valuenow'));
    await press('{ArrowRight}{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(Number(cellAt(canvasElement, 0, 1)!.querySelector('.resize')!.getAttribute('aria-valuenow'))).toBe(before + 30));
    await expect(onResize).toHaveBeenLastCalledWith({ index: 1, name: 'customer_id', width: before + 30 });
    await press('{Escape}');
    await expect(pos(deepActive())).toEqual({ r: 0, c: 1 });
  },
};

export const Export: Story = {
  name: 'CSV and JSON views',
  render: () => orders({ rows: ORDERS.slice(0, 4) }),
  play: async ({ canvasElement }) => {
    onExport.mockClear();
    const grid = canvasElement.querySelector('mm-results-grid')!;
    const segs = [...sr(canvasElement).querySelectorAll('mm-segment')];
    await expect(segs.map((x) => x.textContent?.trim())).toEqual(['Table', 'CSV', 'JSON']);
    await click(segs[1]!);
    await grid.updateComplete;
    await expect(sr(canvasElement).querySelector('pre.text')).toHaveTextContent('order_id');
    const download = sr(canvasElement).querySelector<HTMLElement>('.actions mm-button')!;
    await click(download.shadowRoot!.querySelector('button')!);
    await expect(onExport).toHaveBeenNthCalledWith(1, { format: 'csv' });
    await click(segs[2]!);
    await grid.updateComplete;
    await expect(sr(canvasElement).querySelector('pre.text')!.textContent!.trim().startsWith('[')).toBe(true);
  },
};
export const JsonView: Story = { name: 'JSON view', render: () => html`${orders({ rows: ORDERS.slice(0, 6) })}`, play: async ({ canvasElement }) => {
  const grid = canvasElement.querySelector('mm-results-grid')!;
  grid.view = 'json';
  await grid.updateComplete;
} };
