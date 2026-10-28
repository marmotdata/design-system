import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/proportion-bar.js';
import type { MmProportionBar, ProportionDatum } from './class.ts';

const assetTypes: ProportionDatum[] = [
  { label: 'Table', value: 18402 },
  { label: 'View', value: 3118 },
  { label: 'Topic', value: 1206 },
  { label: 'Dashboard', value: 884 },
  { label: 'Pipeline', value: 412 },
  { label: 'Agent', value: 37 },
];

type Args = { label: string; highlight: string; threshold: number; list: boolean; tone: 'primary' | 'info'; loading: boolean; error: string };

const meta: Meta<Args> = {
  title: 'Components/Data visualisation/Proportion bar',
  component: 'mm-proportion-bar',
  args: { label: 'Catalogued assets by type', highlight: 'View', threshold: 0.02, list: false, tone: 'primary', loading: false, error: '' },
  argTypes: { tone: { control: 'inline-radio', options: ['primary', 'info'] } },
  render: (a) => html`<div style="max-width:640px"><mm-proportion-bar
    label=${a.label}
    highlight=${a.highlight}
    threshold=${a.threshold}
    ?list=${a.list}
    tone=${a.tone}
    ?loading=${a.loading}
    error=${a.error}
    category-label="Asset type"
    unit=""
    .data=${assetTypes}
  ></mm-proportion-bar></div>`,
  parameters: {
    usage: {
      html: `<mm-proportion-bar id="types" label="Catalogued assets by type" highlight="View" category-label="Asset type" list></mm-proportion-bar>
<script type="module">
  document.querySelector('#types').data = [
    { label: 'Table', value: 18402 }, { label: 'View', value: 3118 }, { label: 'Topic', value: 1206 },
    { label: 'Dashboard', value: 884 }, { label: 'Pipeline', value: 412 }, { label: 'Agent', value: 37 },
  ];
</script>`,
      react: `import { MmProportionBar } from '@marmotdata/react';

<MmProportionBar label="Catalogued assets by type" highlight="View" categoryLabel="Asset type" list data={assetTypes} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/proportion-bar.js';
  let { assetTypes } = $props();
</script>

<mm-proportion-bar label="Catalogued assets by type" highlight="View" category-label="Asset type" list data={assetTypes}></mm-proportion-bar>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const bar = (root: HTMLElement) => root.querySelector('mm-proportion-bar') as MmProportionBar;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = bar(canvasElement);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    await expect(sr.querySelector('.frame')!.getAttribute('aria-label')).toBe(
      'Catalogued assets by type: 24,059 in total. Table 18,402 (76%), View 3,118 (13%), Topic 1,206 (5.0%), Dashboard 884 (3.7%), Other 449 (1.9%).',
    );
    // Pipeline and Agent are grouped as Other; one segment is in the key colour; no legend.
    await expect(sr.querySelectorAll('rect.seg').length).toBe(5);
    await expect(sr.querySelectorAll('rect.key-bar').length).toBe(1);
  },
};

export const WithList: Story = {
  name: 'With a ranked list',
  args: { list: true },
  play: async ({ canvasElement }) => {
    const el = bar(canvasElement);
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('.list li');
    await expect(items.length).toBe(6);
    await expect(items[5]!.textContent).toContain('Agent');
  },
};

export const Keyboard: Story = {
  name: 'Keyboard: arrows move between segments',
  play: async ({ canvasElement }) => {
    const el = bar(canvasElement);
    await el.updateComplete;
    await tab();
    await expect(deepActive()).toBe(el.shadowRoot!.querySelector('.frame'));
    await press('{ArrowRight}');
    await expect(el.activeIndex).toBe(0);
    await press('{End}');
    await expect(el.activeIndex).toBe(4);
    const tip = el.shadowRoot!.querySelector('mm-tooltip')!;
    await waitFor(() => expect(tip.open).toBe(true));
    // The Other tooltip lists what it groups.
    await expect(tip.items.map((i) => i.label)).toEqual(expect.arrayContaining(['Pipeline', 'Agent']));
    await press('{Escape}');
    await expect(el.activeIndex).toBe(-1);
  },
};

export const Hover: Story = {
  name: 'Hover tooltip',
  play: async ({ canvasElement }) => {
    const el = bar(canvasElement);
    await el.updateComplete;
    const r = el.shadowRoot!.querySelector('svg.plot')!.getBoundingClientRect();
    el.shadowRoot!.querySelector('.frame')!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width * 0.82, clientY: r.top + 6 }));
    await waitFor(() => expect(el.shadowRoot!.querySelector('mm-tooltip')!.open).toBe(true));
    await expect(el.activeIndex).toBe(1);
  },
};

export const NoHighlight: Story = { name: 'No highlight', args: { highlight: '' } };
export const Narrow: Story = {
  name: 'Narrow container',
  render: (a, c) => html`<div style="max-width:320px">${meta.render!({ ...a, list: true }, c)}</div>`,
};
export const Empty: Story = { render: () => html`<mm-proportion-bar label="Catalogued assets by type" .data=${[]} empty-text="No assets have been catalogued yet. Connect a plugin to map a source."></mm-proportion-bar>` };
export const Loading: Story = { args: { loading: true } };
export const ErrorState: Story = { name: 'Error', args: { error: 'Asset counts are unavailable while the search index rebuilds.' } };
export const SingleSegment: Story = { name: 'Single segment', render: () => html`<mm-proportion-bar label="Assets in shop.orders.v2" .data=${[{ label: 'Topic', value: 1 }]}></mm-proportion-bar>` };
export const LargeNumbers: Story = {
  name: 'Very large numbers',
  render: () => html`<mm-proportion-bar
    label="Rows by warehouse"
    highlight="Snowflake"
    list
    .data=${[
      { label: 'Snowflake', value: 8_402_118_004 },
      { label: 'BigQuery', value: 3_118_402_911 },
      { label: 'PostgreSQL', value: 1_284_019_442 },
      { label: 'Redshift', value: 41_220_118 },
    ]}
  ></mm-proportion-bar>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { list: true } };
export const BothThemes: Story = { render: (a, c) => themes(meta.render!({ ...a, list: true }, c)) };

/** Checks every label against every other label and every leader line, using rendered boxes. */
async function expectNoCollisions(el: MmProportionBar) {
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await el.updateComplete;
  const sr = el.shadowRoot!;
  // Labels are laid out again once their real widths are measured (and again when the web font
  // arrives), so wait for the layout to settle rather than checking the first frame.
  await waitFor(() => {
    const labels = [...sr.querySelectorAll<SVGTextElement>('text.seg-label')].map((t) => t.getBBox());
    const leaders = [...sr.querySelectorAll<SVGLineElement>('line.leader')].map((l) => ({ x: l.x1.baseVal.value, y1: l.y1.baseVal.value, y2: l.y2.baseVal.value }));
    labels.forEach((a, i) => {
      labels.forEach((b, j) => {
        if (i < j) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      });
      leaders.forEach((l) => {
        const crosses = l.x > a.x + 0.5 && l.x < a.x + a.width - 0.5 && l.y2 > a.y + 1 && l.y1 < a.y + a.height - 1;
        expect(crosses).toBe(false);
      });
    });
  });
}

const crowded: ProportionDatum[] = [
  { label: 'Table', value: 14_210 },
  { label: 'View', value: 3_118 },
  { label: 'Topic', value: 1_829 },
  { label: 'Dashboard', value: 1_402 },
  { label: 'Pipeline', value: 1_190 },
  { label: 'Model', value: 988 },
  { label: 'Notebook', value: 702 },
  { label: 'Agent', value: 620 },
];

export const Crowded: Story = {
  name: 'Crowded segments without collisions',
  render: () => html`<div style="width:1100px;max-width:100%"><mm-proportion-bar
    label="Catalogued assets by type"
    highlight="Topic"
    category-label="Asset type"
    list
    .data=${crowded}
  ></mm-proportion-bar></div>`,
  play: async ({ canvasElement }) => {
    await expectNoCollisions(bar(canvasElement));
  },
};

export const CrowdedNarrow: Story = {
  name: 'Crowded segments in a narrow panel',
  render: () => html`<div style="width:300px"><mm-proportion-bar label="Catalogued assets by type" highlight="Topic" .threshold=${0} .data=${crowded}></mm-proportion-bar></div>`,
  play: async ({ canvasElement }) => {
    const el = bar(canvasElement);
    await expectNoCollisions(el);
    // Segments without room for a label move into Other; nothing is lost from the table.
    await expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(8);
  },
};

export const DefaultHasNoCollisions: Story = {
  name: 'Default without collisions',
  render: (a, c) => html`<div style="width:1100px;max-width:100%">${meta.render!(a, c)}</div>`,
  play: async ({ canvasElement }) => {
    await expectNoCollisions(bar(canvasElement));
  },
};
