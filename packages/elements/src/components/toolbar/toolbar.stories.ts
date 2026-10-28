import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/toolbar.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/menu-button.js';
import '@marmotdata/elements/menu.js';
import '@marmotdata/elements/select.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/segmented-control.js';
import type { MmToolbar } from './class.ts';

type Args = { dense: boolean; orientation: 'horizontal' | 'vertical' };

const queryToolbar = (a: Partial<Args> = {}, opts: { runDisabled?: boolean; label?: string } = {}) => html`<mm-toolbar
  label=${opts.label ?? 'Query editor'}
  ?dense=${a.dense ?? false}
  orientation=${a.orientation ?? 'horizontal'}
>
  <mm-select label="Source" hide-label value="snowflake-prod" style="width:200px">
    <mm-option value="snowflake-prod"><mm-provider-logo slot="logo" provider="snowflake" decorative></mm-provider-logo>snowflake-prod</mm-option>
    <mm-option value="postgres-prod"><mm-provider-logo slot="logo" provider="postgresql" decorative></mm-provider-logo>postgres-prod</mm-option>
    <mm-option value="bigquery-analytics"><mm-provider-logo slot="logo" provider="bigquery" decorative></mm-provider-logo>bigquery-analytics</mm-option>
  </mm-select>
  <mm-status-pill status="neutral" icon="lock">Read only</mm-status-pill>
  <mm-toolbar-separator></mm-toolbar-separator>
  <mm-select label="Row limit" hide-label value="1000" style="width:132px">
    <mm-option value="100">100 rows</mm-option>
    <mm-option value="1000">1,000 rows</mm-option>
    <mm-option value="10000">10,000 rows</mm-option>
  </mm-select>
  <mm-menu-button slot="end" variant="ghost" icon="more-horiz" icon-only label="More query actions">
    <mm-menu>
      <mm-menu-item icon="content-copy">Copy SQL</mm-menu-item>
      <mm-menu-item icon="download">Export CSV</mm-menu-item>
    </mm-menu>
  </mm-menu-button>
  <mm-button slot="end" variant="primary" icon="play-arrow" ?disabled=${opts.runDisabled ?? false}>Run query</mm-button>
</mm-toolbar>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Toolbar',
  component: 'mm-toolbar',
  subcomponents: { 'mm-toolbar-separator': 'mm-toolbar-separator' } as never,
  args: { dense: false, orientation: 'horizontal' },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
  render: (a) => queryToolbar(a),
  parameters: {
    usage: {
      html: `<mm-toolbar label="Query editor" dense>
  <mm-select label="Source" hide-label value="snowflake-prod">…</mm-select>
  <mm-status-pill status="neutral" icon="lock">Read only</mm-status-pill>
  <mm-toolbar-separator></mm-toolbar-separator>
  <mm-select label="Row limit" hide-label value="1000">…</mm-select>
  <mm-button slot="end" variant="primary" icon="play-arrow">Run query</mm-button>
</mm-toolbar>`,
      react: `import { MmToolbar, MmToolbarSeparator, MmSelect, MmButton } from '@marmotdata/react';

<MmToolbar label="Query editor" dense>
  <MmSelect label="Source" hideLabel value={source} onMmChange={(e) => setSource(e.detail.value)}>…</MmSelect>
  <MmToolbarSeparator />
  <MmButton slot="end" variant="primary" icon="play-arrow" onClick={run}>Run query</MmButton>
</MmToolbar>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/toolbar.js';
</script>

<mm-toolbar label="Query editor" dense>
  <mm-select label="Source" hide-label value={source} onmm-change={(e) => (source = e.detail.value)}>…</mm-select>
  <mm-toolbar-separator></mm-toolbar-separator>
  <mm-button slot="end" variant="primary" icon="play-arrow" onclick={run}>Run query</mm-button>
</mm-toolbar>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const bar = (root: HTMLElement) => root.querySelector('mm-toolbar') as MmToolbar;
/** The toolbar item that holds focus. */
const activeItem = (root: HTMLElement) => {
  const items = bar(root).items;
  let node: Node | null = deepActive();
  while (node) {
    if (items.includes(node as HTMLElement)) return node as HTMLElement;
    node = node.parentNode ?? (node as ShadowRoot).host ?? null;
  }
  return null;
};
const nameOf = (el: HTMLElement | null) => el?.getAttribute('label') || el?.textContent?.trim();
const settle = async (root: HTMLElement) => {
  await bar(root).updateComplete;
  await Promise.all(bar(root).items.map((el) => (el as unknown as { updateComplete?: Promise<unknown> }).updateComplete));
};

export const QueryEditor: Story = {
  name: 'Query editor',
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(bar(canvasElement)).toHaveAttribute('role', 'toolbar');
    await expect(bar(canvasElement)).toHaveAttribute('aria-label', 'Query editor');
    await expect(bar(canvasElement).items.map(nameOf)).toEqual(['Source', 'Row limit', 'More query actions', 'Run query']);
    await expect(canvasElement.querySelector('mm-toolbar-separator')).toHaveAttribute('aria-orientation', 'vertical');
  },
};

export const Dense: Story = { args: { dense: true } };

export const KeyboardArrows: Story = {
  name: 'Keyboard: arrows, Home and End',
  render: () => html`${queryToolbar()}<button type="button" style="margin-top:var(--space-4)">Format SQL</button>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
    await press('{ArrowRight}');
    // The status pill and separator are skipped.
    await expect(nameOf(activeItem(canvasElement))).toBe('Row limit');
    await press('{ArrowRight}');
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
    await press('{ArrowRight}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Run query');
    await press('{ArrowRight}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
    await press('{ArrowLeft}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Run query');
    await press('{Home}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
    await press('{ArrowRight}{ArrowRight}');
    // The toolbar is one tab stop: Tab leaves it, Shift+Tab returns to the last control used.
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('button'));
    await tab(true);
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
    await press('{End}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Run query');
  },
};

export const KeyboardDisabled: Story = {
  name: 'Keyboard: disabled controls are skipped',
  render: () => queryToolbar({}, { runDisabled: true }),
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    // Wrapping back from the first control skips the disabled Run query.
    await press('{ArrowLeft}');
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
    await press('{ArrowRight}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
    // Home and End also skip it (from a button: a select keeps Home and End to open its list).
    await press('{ArrowLeft}{End}');
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
  },
};

export const KeyboardMenu: Story = {
  name: 'Keyboard: menu button in a toolbar',
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await press('{ArrowLeft}{ArrowLeft}');
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
    await press('{Enter}');
    const menu = canvasElement.querySelector('mm-menu')!;
    await expect(deepActive()).toBe(menu.querySelector('mm-menu-item'));
    // Arrows inside the open menu belong to the menu, not the toolbar.
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(menu.querySelectorAll('mm-menu-item')[1]);
    await press('{Escape}');
    await expect(nameOf(activeItem(canvasElement))).toBe('More query actions');
  },
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await press('{ArrowLeft}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Row limit');
    await press('{ArrowRight}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
  },
};

export const Vertical: Story = {
  render: () => html`<div style="width:220px;height:320px;display:flex">
    <mm-toolbar label="Lineage canvas" orientation="vertical">
      <mm-button variant="ghost" icon="zoom-in">Zoom in</mm-button>
      <mm-button variant="ghost" icon="zoom-out">Zoom out</mm-button>
      <mm-toolbar-separator></mm-toolbar-separator>
      <mm-button variant="ghost" icon="fit-screen">Fit to view</mm-button>
      <mm-button slot="end" variant="secondary" icon="fullscreen">Full screen</mm-button>
    </mm-toolbar>
  </div>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await expect(canvasElement.querySelector('mm-toolbar-separator')).toHaveAttribute('aria-orientation', 'horizontal');
    await tab();
    await press('{ArrowDown}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Zoom out');
    await press('{ArrowRight}');
    // Left and Right do nothing in a vertical toolbar.
    await expect(nameOf(activeItem(canvasElement))).toBe('Zoom out');
    await press('{End}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Full screen');
    await press('{ArrowUp}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Fit to view');
  },
};

export const WithSegmentedControl: Story = {
  name: 'With a segmented control',
  render: () => html`<mm-toolbar label="Results">
    <mm-button variant="ghost" icon="download">Export CSV</mm-button>
    <mm-button variant="ghost" icon="content-copy">Copy results</mm-button>
    <mm-segmented-control slot="end" label="Results view" hide-label value="grid">
      <mm-segment value="grid" icon="table">Grid</mm-segment>
      <mm-segment value="chart" icon="bar-chart">Chart</mm-segment>
    </mm-segmented-control>
  </mm-toolbar>`,
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await press('{End}');
    await expect(nameOf(activeItem(canvasElement))).toBe('Results view');
    // The segmented control keeps its arrows to change the view.
    await press('{ArrowRight}');
    await expect(canvasElement.querySelector('mm-segmented-control')!.value).toBe('chart');
    await expect(nameOf(activeItem(canvasElement))).toBe('Results view');
    await press('{Home}');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await settle(canvasElement);
    await tab();
    await expect(nameOf(activeItem(canvasElement))).toBe('Source');
  },
};
export const Empty: Story = {
  name: 'Empty end slot',
  render: () => html`<mm-toolbar label="Schema">
    <mm-button variant="ghost" icon="filter-list">Filter columns</mm-button>
    <mm-button variant="ghost" icon="content-copy">Copy column names</mm-button>
  </mm-toolbar>`,
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:420px;max-width:100%">${queryToolbar({ dense: true })}</div>`,
};
export const CompactDensity: Story = { name: 'Compact density', globals: { density: 'compact' } };
export const BothThemes: Story = {
  render: () => themes(queryToolbar({ dense: true })),
  play: async ({ canvasElement }) => {
    const [a, b] = [...canvasElement.querySelectorAll('mm-toolbar')];
    a!.label = 'Query editor (Light)';
    b!.label = 'Query editor (Peat)';
    await Promise.all([a!.updateComplete, b!.updateComplete]);
  },
};
