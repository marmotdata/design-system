import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/run-strip.js';
import type { MmRunStrip, Run, RunStatus } from './class.ts';

const pattern: RunStatus[] = [
  'succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'failed', 'failed', 'succeeded', 'succeeded',
  'succeeded', 'succeeded', 'succeeded', 'partial', 'succeeded', 'succeeded', 'succeeded', 'succeeded', 'failed', 'succeeded',
  'succeeded', 'skipped', 'succeeded', 'succeeded', 'succeeded', 'failed', 'succeeded', 'succeeded', 'succeeded', 'running',
];
const ids = ['8f2c1a', '1b9e44', 'c03d7f', '5e21a0', '9a7b3c', '2d4f88', 'e61c09', '7b30de', '4c8a12', 'f19e6b', '0a5d37', 'b82f41', '63e0c5', 'd7194a', '38b6f2',
  'a4c90e', '15f7b3', 'ce2a68', '70d3e1', '2b8c5f', '96e4a7', '4f1d0b', 'e3a729', '8c6b14', '1d9f52', 'b0e83c', '5a27d9', 'f6c041', '39d5ae', '0e7b96'];
/** Every four hours, ending with a run that started at 04:00 UTC on 27 Oct 2026. */
const runs: Run[] = pattern.map((status, i) => ({
  id: `run_${ids[i]}`,
  status,
  startedAt: Date.UTC(2026, 9, 27, 4) - (pattern.length - 1 - i) * 4 * 3_600_000,
  durationMs: status === 'skipped' ? 0 : status === 'running' ? 96_000 : status === 'failed' ? 41_000 + i * 1000 : 192_000 + ((i * 7919) % 90_000),
}));

type Args = { label: string; live: boolean; selectable: boolean };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Run strip',
  component: 'mm-run-strip',
  args: { label: 'Last 30 runs of postgres-shop', live: true, selectable: true },
  render: (a) => html`<mm-run-strip label=${a.label} ?live=${a.live} ?selectable=${a.selectable} .runs=${runs} @mm-select=${onSelect}></mm-run-strip>`,
  parameters: {
    usage: {
      html: `<mm-run-strip id="runs" label="Last 30 runs of postgres-shop" live selectable></mm-run-strip>
<script type="module">
  const strip = document.querySelector('#runs');
  strip.runs = runs; // oldest first: { id, status, startedAt, durationMs }
  strip.addEventListener('mm-select', (e) => openRun(e.detail.run.id));
</script>`,
      react: `import { MmRunStrip } from '@marmotdata/react';

<MmRunStrip label="Last 30 runs of postgres-shop" live selectable runs={runs} onMmSelect={(e) => openRun(e.detail.run.id)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/run-strip.js';
  let { runs } = $props();
</script>

<mm-run-strip label="Last 30 runs of postgres-shop" live selectable {runs} onmm-select={(e) => openRun(e.detail.run.id)}></mm-run-strip>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;
const onSelect = fn();

const strip = (root: HTMLElement) => root.querySelector('mm-run-strip') as MmRunStrip;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = strip(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('[role="grid"]')!.getAttribute('aria-label')).toBe(
      'Last 30 runs of postgres-shop: 30 runs, 23 succeeded, 4 failed, 1 partial, 1 running, 1 skipped. Latest run running.',
    );
    // Failed runs carry an ×, never colour alone.
    await expect(sr.querySelectorAll('.cell.failed path.glyph').length).toBe(4);
    await expect(sr.querySelectorAll('[role="gridcell"]').length).toBe(30);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows, Home, End, Enter, Escape',
  play: async ({ canvasElement }) => {
    onSelect.mockClear();
    const el = strip(canvasElement);
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector<HTMLElement>('[role="grid"]')!;
    await tab();
    await expect(deepActive()).toBe(grid);
    // Focus starts on the newest run.
    await waitFor(() => expect(grid.getAttribute('aria-activedescendant')).toMatch(/-29$/));
    await press('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await expect(grid.getAttribute('aria-activedescendant')).toMatch(/-25$/);
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items.map((i) => i.value)).toEqual(expect.arrayContaining(['run_b0e83c', 'Failed']));
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledTimes(1);
    await expect((onSelect.mock.calls[0]![0] as CustomEvent).detail.run.id).toBe('run_b0e83c');
    await press('{Home}');
    await expect(grid.getAttribute('aria-activedescendant')).toMatch(/-0$/);
    await press('{End}');
    await expect(grid.getAttribute('aria-activedescendant')).toMatch(/-29$/);
    await press('{Escape}');
    await waitFor(() => expect(tip.open).toBe(false));
    await press('{ArrowLeft}');
    await waitFor(() => expect(tip.open).toBe(true));
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = strip(canvasElement);
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelectorAll('[role="gridcell"]')[6]!;
    cell.dispatchEvent(new PointerEvent('pointerenter'));
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items[0]!.value).toBe('run_e61c09');
  },
};

export const AllStatuses: Story = {
  name: 'Every status',
  render: () => html`<div style="display:grid;gap:var(--space-2);font:var(--text-dense)">
    ${(['succeeded', 'failed', 'partial', 'skipped', 'queued', 'running'] as RunStatus[]).map(
      (s, i) => html`<div style="display:flex;align-items:center;gap:var(--space-3)">
        <mm-run-strip label=${`Example ${s} run`} live .runs=${[{ id: `run_${ids[i]}`, status: s, startedAt: '2026-10-27T04:00:00Z', durationMs: 192000 }]}></mm-run-strip>
        <span>${s[0]!.toUpperCase() + s.slice(1)}</span>
      </div>`,
    )}
  </div>`,
};

export const InATable: Story = {
  name: 'In a pipeline list',
  render: () => html`<table style="border-collapse:collapse;font:var(--text-dense);width:100%;max-width:720px">
    <thead><tr>
      <th style="text-align:start;font:var(--text-label);color:var(--mm-text-2);padding:8px">Pipeline</th>
      <th style="text-align:start;font:var(--text-label);color:var(--mm-text-2);padding:8px">Last 30 runs</th>
    </tr></thead>
    <tbody>
      ${[
        ['postgres-shop', runs],
        ['snowflake-prod', runs.map((r, i) => ({ ...r, id: `run_s${ids[i]}`, status: (i === 12 ? 'failed' : 'succeeded') as RunStatus }))],
        ['kafka-events', runs.map((r, i) => ({ ...r, id: `run_k${ids[i]}`, status: (i > 24 ? 'queued' : i % 9 === 4 ? 'partial' : 'succeeded') as RunStatus }))],
      ].map(
        ([name, rs]) => html`<tr style="border-top:1px solid var(--mm-rule)">
          <td style="padding:8px;font:var(--text-mono-dense)">${name}</td>
          <td style="padding:4px 8px"><mm-run-strip label=${`Last 30 runs of ${name}`} .runs=${rs}></mm-run-strip></td>
        </tr>`,
      )}
    </tbody>
  </table>`,
};

export const Empty: Story = {
  render: () => html`<mm-run-strip label="Runs of snowflake-prod" .runs=${[]}></mm-run-strip>`,
  play: async ({ canvasElement }) => {
    const el = strip(canvasElement);
    await el.updateComplete;
    await expect(el.shadowRoot!.textContent).toContain('No runs yet.');
  },
};
export const SingleRun: Story = { name: 'Single run', render: () => html`<mm-run-strip label="Runs of dbt-core" .runs=${runs.slice(-1)}></mm-run-strip>` };
export const NotLive: Story = { name: 'Running without the pulse', args: { live: false } };
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  play: async ({ canvasElement }) => {
    const el = strip(canvasElement);
    await el.updateComplete;
    const grid = el.shadowRoot!.querySelector<HTMLElement>('[role="grid"]')!;
    await tab();
    await waitFor(() => expect(grid.getAttribute('aria-activedescendant')).toMatch(/-29$/));
    // In right to left the newest run is on the left, so Right moves to older runs.
    await press('{ArrowRight}');
    await expect(grid.getAttribute('aria-activedescendant')).toMatch(/-28$/);
  },
};
export const BothThemes: Story = { render: () => themes(AllStatuses.render!({} as Args, {} as never)) };
