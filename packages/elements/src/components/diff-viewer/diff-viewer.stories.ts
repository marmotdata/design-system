import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/diff-viewer.js';
import { diffColumns, diffLines, type DiffColumn } from './class.ts';

// ---- data -----------------------------------------------------------------

const v41: DiffColumn[] = [
  { name: 'order_id', type: 'int8', nullable: false },
  { name: 'customer_id', type: 'int8', nullable: false },
  { name: 'order_number', type: 'varchar(32)', nullable: false },
  { name: 'status', type: 'varchar(32)', nullable: false },
  { name: 'currency', type: 'char(3)', nullable: false },
  { name: 'subtotal', type: 'numeric(10,2)', nullable: false },
  { name: 'tax_total', type: 'numeric(10,2)', nullable: false },
  { name: 'total', type: 'numeric(10,2)', nullable: false },
  { name: 'legacy_flag', type: 'boolean', nullable: true },
  { name: 'email', type: 'varchar(255)', nullable: false },
  { name: 'shipping_address_id', type: 'int8', nullable: true },
  { name: 'placed_at', type: 'timestamptz', nullable: false },
  { name: 'updated_at', type: 'timestamptz', nullable: false },
];
const v42: DiffColumn[] = [
  ...v41.slice(0, 6),
  { name: 'discount_code', type: 'varchar(64)', nullable: true },
  { name: 'tax_total', type: 'numeric(10,2)', nullable: false },
  { name: 'total', type: 'numeric(12,2)', nullable: false },
  ...v41.slice(9),
];

const pipelineV7 = `name: shop-prod-postgres
plugin: postgresql
schedule: "0 */6 * * *"
config:
  host: shop-prod.cluster-c8x2.eu-west-2.rds.amazonaws.com
  port: 5432
  database: shop
  user: marmot_reader
  sslmode: require
  include_schemas:
    - public
    - audit
  exclude_tables:
    - public.schema_migrations
  profile:
    enabled: false
tags:
  - commerce
  - tier-1
owners:
  - Data Platform`;

const pipelineV8 = `name: shop-prod-postgres
plugin: postgresql
schedule: "0 */2 * * *"
config:
  host: shop-prod.cluster-c8x2.eu-west-2.rds.amazonaws.com
  port: 5432
  database: shop
  user: marmot_reader
  sslmode: verify-full
  include_schemas:
    - public
    - audit
  exclude_tables:
    - public.schema_migrations
    - public.ar_internal_metadata
  profile:
    enabled: true
    sample_rows: 100000
tags:
  - commerce
  - tier-1
owners:
  - Data Platform`;

const ddlOld = `CREATE TABLE public.orders (
  order_id bigint PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES public.customers (customer_id) ON DELETE RESTRICT,
  total numeric(10,2) NOT NULL,
  legacy_flag boolean
);`;
const ddlNew = `CREATE TABLE public.orders (
  order_id bigint PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES public.customers (customer_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  total numeric(12,2) NOT NULL CHECK (total >= 0) -- widened for wholesale orders above 99,999,999.99, see INC-2291 and the finance sign-off,
  discount_code varchar(64)
);`;

// ---- meta -------------------------------------------------------------------

type Args = { mode: 'columns' | 'text'; fromVersion: string; toVersion: string; actor: string; actorKind: 'person' | 'plugin' | 'agent' };

const meta: Meta<Args> = {
  title: 'Components/Data/Diff viewer',
  component: 'mm-diff-viewer',
  args: { mode: 'columns', fromVersion: '41', toVersion: '42', actor: 'postgresql plugin', actorKind: 'plugin' },
  argTypes: { actorKind: { control: 'inline-radio', options: ['person', 'plugin', 'agent'] } },
  render: (a) => html`<div style="max-width:820px">
    <mm-diff-viewer
      label="Changes to shop.public.orders"
      from-version=${a.fromVersion}
      to-version=${a.toVersion}
      actor=${a.actor}
      actor-kind=${a.actorKind}
      changed-at="2026-10-27T04:12:09Z"
      .oldColumns=${v41}
      .newColumns=${v42}
    ></mm-diff-viewer>
  </div>`,
  parameters: {
    layout: 'padded',
    usage: {
      html: `<mm-diff-viewer id="diff" label="Changes to shop.public.orders" from-version="41" to-version="42"
  actor="postgresql plugin" actor-kind="plugin" changed-at="2026-10-27T04:12:09Z"></mm-diff-viewer>
<script type="module">
  const diff = document.querySelector('#diff');
  diff.oldColumns = versions[41].columns;
  diff.newColumns = versions[42].columns;
</script>

<mm-diff-viewer mode="text" subject="Pipeline config version" from-version="7" to-version="8"></mm-diff-viewer>`,
      react: `import { MmDiffViewer } from '@marmotdata/react';

<MmDiffViewer label="Changes to shop.public.orders" fromVersion="41" toVersion="42" oldColumns={v41.columns} newColumns={v42.columns}
  actor="postgresql plugin" actorKind="plugin" changedAt={v42.recordedAt} />
<MmDiffViewer mode="text" subject="Pipeline config version" oldText={v7.yaml} newText={v8.yaml} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/diff-viewer.js';
  let { v41, v42 } = $props();
</script>

<mm-diff-viewer label="Changes to shop.public.orders" from-version="41" to-version="42" oldColumns={v41.columns} newColumns={v42.columns}></mm-diff-viewer>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const SchemaColumns: Story = {
  name: 'orders v41 → v42',
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector('mm-diff-viewer')!;
    const readout = d.shadowRoot!.querySelector('.readout')!.textContent!.replace(/\s+/g, ' ').trim();
    await expect(readout).toBe('Schema version 41 → 42 · 3 changes');
    const rows = [...d.shadowRoot!.querySelectorAll('tbody tr')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    await expect(rows).toEqual(['+Added discount_code None varchar(64)', '±Type changed total numeric(10,2) numeric(12,2)', '−Removed legacy_flag boolean None']);
  },
};

export const ShowUnchanged: Story = {
  name: 'Keyboard: show unchanged columns',
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector('mm-diff-viewer')!;
    await tab();
    const btn = d.shadowRoot!.querySelector('.fold')!;
    await expect(deepActive()).toBe(btn);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn.textContent).toContain('Show 11 unchanged columns');
    await press('{Enter}');
    await waitFor(() => expect(btn).toHaveAttribute('aria-expanded', 'true'));
    await expect(d.shadowRoot!.querySelectorAll('tbody tr').length).toBe(14);
    await press('{Space}');
    await waitFor(() => expect(btn).toHaveAttribute('aria-expanded', 'false'));
    await expect(d.shadowRoot!.querySelectorAll('tbody tr').length).toBe(3);
  },
};

export const TextYaml: Story = {
  name: 'Text: pipeline config YAML',
  render: () => html`<div style="max-width:820px">
    <mm-diff-viewer
      mode="text"
      label="Changes to shop-prod-postgres.yaml"
      subject="Pipeline config version"
      from-version="7"
      to-version="8"
      actor="Jane Doe"
      changed-at="2026-10-26T16:40:00Z"
      context="2"
      .oldText=${pipelineV7}
      .newText=${pipelineV8}
    ></mm-diff-viewer>
  </div>`,
};

export const TextFoldKeyboard: Story = {
  name: 'Keyboard: expand folded lines',
  render: TextYaml.render,
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector('mm-diff-viewer')!;
    const lineCount = () => d.shadowRoot!.querySelectorAll('tbody tr:not(.fold-row)').length;
    const before = lineCount();
    await tab(); // the scrolling region
    await expect(deepActive()).toBe(d.shadowRoot!.querySelector('.wrap'));
    await tab(); // first fold button
    const fold = deepActive() as HTMLButtonElement;
    await expect(fold.classList.contains('fold')).toBe(true);
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await press('{Enter}');
    await waitFor(() => expect(fold).toHaveAttribute('aria-expanded', 'true'));
    await expect(lineCount()).toBeGreaterThan(before);
    await expect(deepActive()).toBe(fold);
    await press('{Space}');
    await waitFor(() => expect(fold).toHaveAttribute('aria-expanded', 'false'));
    await expect(lineCount()).toBe(before);
  },
};

export const TextDdlLongLines: Story = {
  name: 'Text: DDL with long lines',
  render: () => html`<div style="max-width:640px;display:grid;gap:var(--space-6)">
    <mm-diff-viewer mode="text" label="DDL changes, scrolling" subject="DDL version" from-version="41" to-version="42" .oldText=${ddlOld} .newText=${ddlNew}></mm-diff-viewer>
    <mm-diff-viewer mode="text" wrap label="DDL changes, wrapped" subject="DDL version" from-version="41" to-version="42" .oldText=${ddlOld} .newText=${ddlNew}></mm-diff-viewer>
  </div>`,
};

export const NoChanges: Story = {
  name: 'No changes',
  render: () => html`<div style="max-width:820px;display:grid;gap:var(--space-6)">
    <mm-diff-viewer from-version="41" to-version="42" actor="postgresql plugin" actor-kind="plugin" changed-at="2026-10-27T04:12:09Z" .oldColumns=${v41} .newColumns=${v41}></mm-diff-viewer>
    <mm-diff-viewer mode="text" subject="Pipeline config version" from-version="7" to-version="8" .oldText=${pipelineV7} .newText=${pipelineV7}></mm-diff-viewer>
  </div>`,
  play: async ({ canvasElement }) => {
    const d = canvasElement.querySelector('mm-diff-viewer')!;
    await expect(d.shadowRoot!.querySelector('.empty')!.textContent!.trim()).toBe('The schema has not changed since version 41.');
  },
};

export const AgentActor: Story = { name: 'Changed by an agent', args: { actor: 'schema-steward-agent', actorKind: 'agent' } };
export const PersonActor: Story = { name: 'Changed by a person', args: { actor: 'Jane Doe', actorKind: 'person' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async () => {
    await tab();
    await expect(deepActive()?.classList.contains('fold')).toBe(true);
  },
};
export const Compact: Story = { name: 'Compact density', render: (a, c) => html`<div data-density="compact">${meta.render!(a, c)}</div>` };
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: (a, c) => html`<div style="display:grid;gap:var(--space-6)">${meta.render!(a, c)}${TextYaml.render!(a, c)}</div>` };
export const BothThemes: Story = { render: (a, c) => themes(html`<div style="display:grid;gap:var(--space-6)">${meta.render!(a, c)}${TextYaml.render!(a, c)}</div>`) };

export const Algorithm: Story = {
  name: 'LCS diff: unit checks',
  render: () => html`<p style="font:var(--text-caption);color:var(--mm-text-2)">Checks for the line and column diff helpers.</p>`,
  play: async () => {
    const ops = diffLines('a\nb\nc\nd', 'a\nc\nd\ne').map((l) => `${l.op}:${l.text}`);
    await expect(ops).toEqual(['eq:a', 'del:b', 'eq:c', 'eq:d', 'add:e']);
    await expect(diffLines('', 'x').map((l) => l.op)).toEqual(['add']);
    await expect(diffLines('same', 'same').every((l) => l.op === 'eq')).toBe(true);
    const lines = diffLines('x\ny', 'x\nz\ny');
    await expect(lines.find((l) => l.op === 'add')).toEqual({ op: 'add', text: 'z', b: 2 });
    const kinds = diffColumns(v41, v42).filter((c) => c.kind !== 'unchanged').map((c) => `${c.kind}:${c.column}`);
    await expect(kinds).toEqual(['added:discount_code', 'type:total', 'removed:legacy_flag']);
  },
};
