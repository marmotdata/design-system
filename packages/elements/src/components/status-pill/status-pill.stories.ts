import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/status-pill.js';
import { prefersReducedMotion } from '../../core/platform.ts';

type Args = { status: string; state: string; icon: string; dot: boolean; live: boolean; text: string };

const meta: Meta<Args> = {
  title: 'Components/Status/Status pill',
  component: 'mm-status-pill',
  args: { status: 'neutral', state: 'succeeded', icon: '', dot: false, live: false, text: '' },
  argTypes: {
    status: { control: 'inline-radio', options: ['success', 'warning', 'info', 'danger', 'neutral'] },
    state: { control: 'select', options: ['', 'succeeded', 'failed', 'running', 'queued', 'stale', 'denied', 'allowed', 'cancelled', 'skipped'] },
    text: { name: 'word (slot)' },
  },
  render: (a) =>
    html`<mm-status-pill status=${a.status} state=${a.state} icon=${a.icon} ?dot=${a.dot} ?live=${a.live}>${a.text}</mm-status-pill>`,
  parameters: {
    usage: {
      html: `<mm-status-pill state="succeeded"></mm-status-pill>
<mm-status-pill state="running" live></mm-status-pill>
<mm-status-pill status="warning" icon="schedule">Expiring</mm-status-pill>`,
      react: `import { MmStatusPill } from '@marmotdata/react';

<MmStatusPill state={run.status} live={run.status === 'running'} />
<MmStatusPill status="warning" icon="schedule">Expiring</MmStatusPill>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/status-pill.js';
  let { run } = $props();
</script>

<mm-status-pill state={run.status} live={run.status === 'running'}></mm-status-pill>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

const allStates = () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center">
  <mm-status-pill state="succeeded"></mm-status-pill>
  <mm-status-pill state="partial"></mm-status-pill>
  <mm-status-pill state="running" live></mm-status-pill>
  <mm-status-pill state="queued"></mm-status-pill>
  <mm-status-pill state="stale"></mm-status-pill>
  <mm-status-pill state="failed"></mm-status-pill>
  <mm-status-pill state="allowed"></mm-status-pill>
  <mm-status-pill state="denied"></mm-status-pill>
  <mm-status-pill state="cancelled"></mm-status-pill>
  <mm-status-pill state="skipped"></mm-status-pill>
</div>`;

export const States: Story = {
  name: 'Semantic states',
  render: allStates,
  play: async ({ canvasElement }) => {
    const failed = canvasElement.querySelector('mm-status-pill[state="failed"]')!;
    await expect(failed.shadowRoot!.querySelector('.pill')).toHaveClass('danger');
    await expect(failed.shadowRoot!.textContent).toContain('Failed');
    // Partial is warning-family with its own glyph, distinct from stale and failed.
    const partial = canvasElement.querySelector('mm-status-pill[state="partial"]')!;
    await expect(partial.shadowRoot!.querySelector('.pill')).toHaveClass('warning');
    await expect(partial.shadowRoot!.textContent).toContain('Partial');
    const glyph = (st: string) => canvasElement.querySelector(`mm-status-pill[state="${st}"]`)!.shadowRoot!.querySelector('mm-icon')?.getAttribute('name');
    await expect(glyph('partial')).not.toBe(glyph('stale'));
    await expect(glyph('partial')).not.toBe(glyph('failed'));
    // Colour is never the only signal: every pill carries a glyph and a word.
    for (const pill of canvasElement.querySelectorAll('mm-status-pill')) {
      await expect(pill.shadowRoot!.querySelector('mm-icon, .dot')).not.toBeNull();
    }
  },
};

export const Tones: Story = {
  render: () => html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center">
    <mm-status-pill status="success" icon="check-circle">Healthy</mm-status-pill>
    <mm-status-pill status="warning" icon="schedule">Expiring</mm-status-pill>
    <mm-status-pill status="info" dot>Syncing</mm-status-pill>
    <mm-status-pill status="danger" icon="cancel">Unreachable</mm-status-pill>
    <mm-status-pill status="neutral">Draft</mm-status-pill>
  </div>`,
};

export const Live: Story = {
  name: 'Live (running only)',
  render: () => html`<div style="display:grid;gap:var(--space-3);justify-items:start">
    <mm-status-pill state="running" live></mm-status-pill>
    <mm-status-pill state="succeeded" live></mm-status-pill>
    <p style="font:var(--text-caption);color:var(--mm-text-2);margin:0">
      The pulse is only for something running right now. <code>live</code> on a succeeded run is ignored.
    </p>
  </div>`,
  play: async ({ canvasElement }) => {
    const [running, done] = canvasElement.querySelectorAll('mm-status-pill');
    // Under reduced motion (as in the test runner) the pulse stays off; the dot is still shown.
    if (prefersReducedMotion()) await expect(running).not.toHaveAttribute('data-pulse');
    else await expect(running).toHaveAttribute('data-pulse');
    await expect(running!.shadowRoot!.querySelector('.dot')).not.toBeNull();
    await expect(done).not.toHaveAttribute('data-pulse');
  },
};

export const ReducedMotion: Story = {
  name: 'Reduced motion',
  globals: { motion: 'reduce' },
  render: () => html`<mm-status-pill state="running" live></mm-status-pill>`,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('mm-status-pill')).not.toHaveAttribute('data-pulse');
  },
};

export const InATable: Story = {
  name: 'In a run history table',
  render: () => html`<table style="border-collapse:collapse;font:var(--text-dense);min-width:520px">
    <thead>
      <tr style="font:var(--text-label);color:var(--mm-text-2);text-align:start">
        <th style="text-align:start;padding:var(--space-2)">Pipeline</th>
        <th style="text-align:start;padding:var(--space-2)">Status</th>
        <th style="text-align:end;padding:var(--space-2)">Assets</th>
      </tr>
    </thead>
    <tbody>
      ${[
        ['snowflake-prod', 'running', '412'],
        ['postgres-shop', 'succeeded', '1,284'],
        ['snowflake-finance', 'partial', '96'],
        ['kafka-events', 'failed', '0'],
        ['dbt-analytics', 'queued', '–'],
      ].map(
        ([name, state, n]) => html`<tr style="border-top:1px solid var(--mm-rule)">
          <td style="padding:var(--space-2);font:var(--text-mono-dense)">${name}</td>
          <td style="padding:var(--space-2)"><mm-status-pill state=${state!} ?live=${state === 'running'}></mm-status-pill></td>
          <td style="padding:var(--space-2);text-align:end;font-variant-numeric:tabular-nums">${n}</td>
        </tr>`,
      )}
    </tbody>
  </table>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:140px;display:grid;gap:var(--space-2);justify-items:start;border:1px dashed var(--mm-rule);padding:var(--space-2)">
    <mm-status-pill status="warning" icon="schedule">Credentials expiring in 3 days</mm-status-pill>
    <mm-status-pill state="succeeded"></mm-status-pill>
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<div style="display:flex;gap:var(--space-3)">
    <mm-status-pill state="succeeded">نجح</mm-status-pill>
    <mm-status-pill state="running" live>قيد التشغيل</mm-status-pill>
    <mm-status-pill state="failed">فشل</mm-status-pill>
  </div>`,
};

export const BothThemes: Story = { render: () => themes(allStates()) };
