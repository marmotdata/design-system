import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/small-multiples.js';
import type { MmSmallMultiples, Sheet } from './class.ts';

const hours = Array.from({ length: 24 }, (_, i) => `2026-10-27T${String(i).padStart(2, '0')}:00:00Z`);
const wave = (base: number, amp: number, phase: number) => hours.map((_, i) => Math.max(0, Math.round((base + amp * Math.sin((i + phase) / 3.1)) * 10) / 10));

/** Freshness lag in minutes per provider over the last 24 hours. */
const sheets: Sheet[] = [
  { title: 'PostgreSQL', ref: 'postgresql', values: wave(4, 1.5, 0) },
  { title: 'Snowflake', ref: 'snowflake', values: wave(14, 5, 2).map((v, i) => (i === 7 ? 41 : v)) },
  { title: 'BigQuery', ref: 'bigquery', values: wave(11, 3, 5) },
  { title: 'Kafka', ref: 'kafka', values: wave(0.6, 0.3, 1) },
  { title: 'dbt', ref: 'dbt', values: hours.map((_, i) => [45, 38, 30, 22, 15, 9, 52, 44, 36, 28, 20, 12][i % 12]!) },
  { title: 'Looker', ref: 'looker', stale: true, values: hours.map((_, i) => (i < 16 ? 18 + (i % 4) * 2 : 18 + (i - 15) * 9)) },
];

type Args = { label: string; unit: string; type: 'line' | 'area'; highlight: string; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Small multiples',
  component: 'mm-small-multiples',
  args: { label: 'Freshness lag', unit: 'min', type: 'line', highlight: 'looker', loading: false, error: '' },
  argTypes: { type: { control: 'inline-radio', options: ['line', 'area'] } },
  render: (a) => html`<mm-small-multiples
    label=${a.label}
    unit=${a.unit}
    type=${a.type}
    highlight=${a.highlight}
    ?loading=${a.loading}
    error=${a.error}
    .x=${hours}
    .sheets=${sheets}
  ></mm-small-multiples>`,
  parameters: {
    usage: {
      html: `<mm-small-multiples id="fresh" label="Freshness lag" unit="min" highlight="looker"></mm-small-multiples>
<script type="module">
  const sm = document.querySelector('#fresh');
  sm.x = hours;
  sm.sheets = [
    { title: 'PostgreSQL', ref: 'postgresql', values: [4.1, 3.8 /* … */] },
    { title: 'Looker', ref: 'looker', stale: true, values: [18, 20 /* … */] },
  ];
</script>`,
      react: `import { MmSmallMultiples } from '@marmotdata/react';

<MmSmallMultiples label="Freshness lag" unit="min" highlight="looker" x={hours} sheets={sheets} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/small-multiples.js';
  let { hours, sheets } = $props();
</script>

<mm-small-multiples label="Freshness lag" unit="min" highlight="looker" x={hours} {sheets}></mm-small-multiples>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const sm = (root: HTMLElement) => root.querySelector('mm-small-multiples') as MmSmallMultiples;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = sm(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    // Only the series title above each plot: no "Sheet N · key" caption.
    await expect(sr.querySelectorAll('.readout').length).toBe(0);
    const titles = [...sr.querySelectorAll('.title')].map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
    await expect(titles[0]).toBe('PostgreSQL');
    await expect(titles[5]).toBe('Looker · Stale');
    await expect(sr.querySelectorAll('.frame').length).toBe(6);
    // One highlighted sheet; the stale one is hatched.
    await expect(sr.querySelectorAll('path.key').length).toBe(1);
    await expect(sr.querySelectorAll('path.hatch').length).toBe(1);
    await expect(sr.querySelectorAll('.frame')[5]!.getAttribute('aria-label')).toMatch(/^Looker, freshness lag over 24 hours, peaking at 90 min at 23:00, stale\.$/);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: each sheet is focusable',
  play: async ({ canvasElement }) => {
    const el = sm(canvasElement);
    await el.updateComplete;
    const frames = el.shadowRoot!.querySelectorAll<HTMLElement>('.frame');
    await tab();
    await expect(deepActive()).toBe(frames[0]);
    await press('{ArrowRight}{ArrowRight}');
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items[0]!.value).toBe('PostgreSQL');
    await expect(el.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('PostgreSQL, 27 Oct 01:00');
    await press('{Escape}');
    await waitFor(() => expect(tip.open).toBe(false));
    await tab();
    await expect(deepActive()).toBe(frames[1]);
    await press('{End}');
    await waitFor(() => expect(tip.open).toBe(true));
    await expect(tip.items[0]!.value).toBe('Snowflake');
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = sm(canvasElement);
    await el.updateComplete;
    const f = el.shadowRoot!.querySelectorAll<HTMLElement>('.frame')[4]!;
    const r = f.getBoundingClientRect();
    f.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + 20 }));
    await waitFor(() => expect(el.shadowRoot!.querySelector('mm-tooltip')!.open).toBe(true));
  },
};

export const Area: Story = { name: 'Area sheets', args: { type: 'area', highlight: 'dbt' } };
export const Narrow: Story = { name: 'Narrow container', render: (a, c) => html`<div style="max-width:360px">${meta.render!(a, c)}</div>` };
export const Empty: Story = { render: () => html`<mm-small-multiples label="Freshness lag" .x=${[]} .sheets=${[]}></mm-small-multiples>` };
export const EmptySheet: Story = {
  name: 'One sheet without data',
  render: () => html`<mm-small-multiples label="Freshness lag" unit="min" .x=${hours} .sheets=${[...sheets.slice(0, 5), { title: 'Redshift', ref: 'redshift', values: hours.map(() => null) }]}></mm-small-multiples>`,
};
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Freshness checks have not reported since 04:12 UTC.' } };
export const SinglePoint: Story = {
  name: 'Single point',
  render: () => html`<mm-small-multiples label="Freshness lag" unit="min" .x=${[hours[23]!]} .sheets=${sheets.map((s) => ({ ...s, values: s.values.slice(-1) }))}></mm-small-multiples>`,
};
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-small-multiples
    label="Rows ingested per hour"
    highlight="snowflake"
    .x=${hours}
    .sheets=${sheets.slice(0, 4).map((s, i) => ({ ...s, stale: false, values: s.values.map((v) => (v ?? 0) * (i + 1) * 4_812_019) }))}
  ></mm-small-multiples>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a, c) => themes(html`<div style="max-width:520px">${meta.render!(a, c)}</div>`) };
