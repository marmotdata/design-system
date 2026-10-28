import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, nextFrame, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/split-pane.js';
import '@marmotdata/elements/list.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/skeleton.js';
import '@marmotdata/icons/define.js';

type Args = { orientation: string; defaultPosition: number; minStart: number; minEnd: number; label: string };

const sep = (root: Element) => root.querySelector('mm-split-pane')!.shadowRoot!.querySelector<HTMLElement>('[role="separator"]')!;
const now = (root: Element) => Number(sep(root).getAttribute('aria-valuenow'));
const settle = async () => {
  await nextFrame();
  await nextFrame();
};

const frame = 'width:720px;height:320px;border:1px solid var(--mm-rule);border-radius:var(--radius-md);background:var(--mm-surface);overflow:hidden';

const tree = html`<nav aria-label="Sources" style="padding:var(--space-3) 0">
  <mm-list dense aria-label="Tables in shop.public">
    <mm-list-item href="#/q/orders"><mm-icon slot="start" name="table" aria-hidden="true"></mm-icon>orders</mm-list-item>
    <mm-list-item href="#/q/customers_dim"><mm-icon slot="start" name="table" aria-hidden="true"></mm-icon>customers_dim</mm-list-item>
    <mm-list-item href="#/q/orders_daily"><mm-icon slot="start" name="table-view" aria-hidden="true"></mm-icon>orders_daily</mm-list-item>
  </mm-list>
</nav>`;

const editor = html`<div style="padding:var(--space-4);display:grid;gap:var(--space-2)">
  <mm-text variant="label">Query</mm-text>
  <mm-text block variant="mono-dense">SELECT customer_id, sum(total) FROM shop.public.orders GROUP BY 1;</mm-text>
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Split pane',
  component: 'mm-split-pane',
  args: { orientation: 'horizontal', defaultPosition: 240, minStart: 200, minEnd: 240, label: 'Resize source tree' },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
  render: (a) => html`<div style=${frame}>
    <mm-split-pane orientation=${a.orientation} default-position=${a.defaultPosition} min-start=${a.minStart} min-end=${a.minEnd} label=${a.label}>
      <div slot="start">${tree}</div>
      <div slot="end">${editor}</div>
    </mm-split-pane>
  </div>`,
  parameters: {
    docs: {
      description: {
        component:
          'Keyboard: Tab to the separator. Left and Right (Up and Down when stacked) move it by 16px, flipped in right-to-left layouts. Home and End move it to the minimum and maximum. Double-click resets it.',
      },
    },
    usage: {
      html: `<mm-split-pane default-position="280" storage-key="query.tree" label="Resize source tree">
  <nav slot="start" aria-label="Sources">…</nav>
  <mm-split-pane slot="end" orientation="vertical" default-position="240" storage-key="query.editor" label="Resize editor">
    <div slot="start">editor</div>
    <div slot="end">results</div>
  </mm-split-pane>
</mm-split-pane>`,
      react: `import { MmSplitPane } from '@marmotdata/react';

<MmSplitPane defaultPosition={320} storageKey="glossary.list" label="Resize term list" onMmResize={(e) => save(e.detail.position)}>
  <TermList slot="start" />
  <TermArticle slot="end" />
</MmSplitPane>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/split-pane.js';
</script>

<mm-split-pane default-position={320} storage-key="glossary.list" label="Resize term list">
  <div slot="start">…</div>
  <div slot="end">…</div>
</mm-split-pane>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const QueryLayout: Story = {
  name: 'Query: tree, editor and results',
  render: () => html`<div style="${frame};height:420px">
    <mm-split-pane default-position="240" label="Resize source tree">
      <div slot="start">${tree}</div>
      <mm-split-pane slot="end" orientation="vertical" default-position="180" min-start="120" min-end="120" label="Resize editor">
        <div slot="start">${editor}</div>
        <div slot="end" style="padding:var(--space-4)"><mm-text variant="dense" tone="secondary">1,284,019 rows in 412&nbsp;ms</mm-text></div>
      </mm-split-pane>
    </mm-split-pane>
  </div>`,
};

export const GlossaryLayout: Story = {
  name: 'Glossary: list and article',
  render: () => html`<div style=${frame}>
    <mm-split-pane default-position="260" label="Resize term list">
      <div slot="start">
        <mm-list aria-label="Glossary terms">
          <mm-list-item interactive secondary="Finance">Annual recurring revenue</mm-list-item>
          <mm-list-item interactive selected secondary="Commerce">Gross merchandise value</mm-list-item>
          <mm-list-item interactive secondary="Commerce">Net revenue retention</mm-list-item>
        </mm-list>
      </div>
      <article slot="end" style="padding:var(--space-5);max-width:65ch">
        <mm-heading level="2">Gross merchandise value</mm-heading>
        <mm-text block variant="body" tone="secondary">The total value of orders placed before refunds, discounts and fees, in GBP. Calculated in <mm-text variant="mono-dense">orders_daily</mm-text>.</mm-text>
      </article>
    </mm-split-pane>
  </div>`,
};

export const Vertical: Story = { args: { orientation: 'vertical', defaultPosition: 140, minStart: 80, minEnd: 80, label: 'Resize editor' } };

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

const isolated = (orientation = 'horizontal', key = '') => html`<div style=${frame}>
  <mm-split-pane orientation=${orientation} default-position="240" min-start="200" min-end="240" storage-key=${key} label="Resize source tree">
    <div slot="start" style="padding:var(--space-4)"><mm-text variant="dense">Sources</mm-text></div>
    <div slot="end" style="padding:var(--space-4)"><mm-text variant="dense">Editor</mm-text></div>
  </mm-split-pane>
</div>`;

export const Focus: Story = {
  render: () => isolated(),
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(sep(canvasElement));
  },
};

const onResize = fn();
export const KeyboardResize: Story = {
  name: 'Keyboard: arrows, Home and End',
  render: () => html`<div @mm-resize=${(e: CustomEvent) => onResize(e.detail.position)}>${isolated()}</div>`,
  play: async ({ canvasElement }) => {
    onResize.mockClear();
    await settle();
    const s = sep(canvasElement);
    await expect(s).toHaveAttribute('aria-orientation', 'vertical');
    await expect(s).toHaveAttribute('aria-valuemin', '200');
    const max = Math.round(canvasElement.querySelector('mm-split-pane')!.getBoundingClientRect().width) - 240 - 1;
    await expect(s).toHaveAttribute('aria-valuemax', String(max));
    await tab();
    await expect(now(canvasElement)).toBe(240);
    await press('{ArrowRight}');
    await expect(now(canvasElement)).toBe(256);
    await press('{ArrowLeft}{ArrowLeft}');
    await expect(now(canvasElement)).toBe(224);
    await press('{Home}');
    await expect(now(canvasElement)).toBe(200);
    await press('{End}');
    await expect(now(canvasElement)).toBe(max);
    await expect(onResize).toHaveBeenLastCalledWith(max);
  },
};

export const KeyboardResizeRtl: Story = {
  name: 'Keyboard: right to left flips the arrows',
  parameters: { dir: 'rtl' },
  render: () => isolated(),
  play: async ({ canvasElement }) => {
    await settle();
    await tab();
    await press('{ArrowLeft}');
    await expect(now(canvasElement)).toBe(256);
    await press('{ArrowRight}{ArrowRight}');
    await expect(now(canvasElement)).toBe(224);
  },
};

export const KeyboardResizeVertical: Story = {
  name: 'Keyboard: stacked panes use Up and Down',
  render: () => html`<div style="${frame};height:600px">
    <mm-split-pane orientation="vertical" default-position="240" min-start="200" min-end="240" label="Resize editor">
      <div slot="start" style="padding:var(--space-4)"><mm-text variant="dense">Editor</mm-text></div>
      <div slot="end" style="padding:var(--space-4)"><mm-text variant="dense">Results</mm-text></div>
    </mm-split-pane>
  </div>`,
  play: async ({ canvasElement }) => {
    await settle();
    await expect(sep(canvasElement)).toHaveAttribute('aria-orientation', 'horizontal');
    await tab();
    await press('{ArrowDown}');
    await expect(now(canvasElement)).toBe(256);
    await press('{ArrowUp}{ArrowUp}');
    await expect(now(canvasElement)).toBe(224);
    await press('{ArrowRight}');
    await expect(now(canvasElement)).toBe(224);
  },
};

export const Persisted: Story = {
  name: 'Persisted position and double-click reset',
  render: () => {
    try {
      localStorage.removeItem('storybook.split-pane');
    } catch {
      /* storage blocked */
    }
    return isolated('horizontal', 'storybook.split-pane');
  },
  play: async ({ canvasElement }) => {
    await settle();
    await tab();
    await press('{ArrowRight}{ArrowRight}');
    await expect(localStorage.getItem('storybook.split-pane')).toBe('272');
    sep(canvasElement).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await settle();
    await expect(now(canvasElement)).toBe(240);
    await expect(localStorage.getItem('storybook.split-pane')).toBeNull();
  },
};

export const Loading: Story = {
  render: () => html`<div style=${frame}>
    <mm-split-pane default-position="240" label="Resize source tree">
      <div slot="start" style="padding:var(--space-4)"><mm-skeleton loading count="4"></mm-skeleton></div>
      <div slot="end" style="padding:var(--space-4)"><mm-skeleton loading shape="rect"></mm-skeleton></div>
    </mm-split-pane>
  </div>`,
};

export const Empty: Story = {
  render: () => html`<div style=${frame}>
    <mm-split-pane default-position="240" label="Resize source tree">
      <div slot="start" style="padding:var(--space-4)"><mm-text block variant="dense" tone="secondary">No sources connected.</mm-text></div>
      <div slot="end" style="padding:var(--space-4)"><mm-text block variant="dense" tone="secondary">Connect a plugin to query its tables.</mm-text></div>
    </mm-split-pane>
  </div>`,
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers and overflowing content',
  render: () => html`<div style=${frame}>
    <mm-split-pane default-position="200" label="Resize source tree">
      <div slot="start" style="padding:var(--space-3) 0">
        <mm-list dense aria-label="Tables">
          <mm-list-item href="#/a"><mm-text variant="mono-dense">orders_daily_by_customer_region_rollup_v2</mm-text></mm-list-item>
          <mm-list-item href="#/b"><mm-text variant="mono-dense">revenue_recognition_monthly_snapshot_v3</mm-text></mm-list-item>
        </mm-list>
      </div>
      <div slot="end" style="padding:var(--space-4)"><mm-text block variant="mono-dense" style="overflow-wrap:anywhere">mrn://postgresql/table/shop.public.orders_daily_by_customer_region_rollup_v2</mm-text></div>
    </mm-split-pane>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const CompactDensity: Story = { globals: { density: 'compact' } };
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="height:240px;border:1px solid var(--mm-rule);border-radius:var(--radius-md);background:var(--mm-surface);overflow:hidden">
      <mm-split-pane default-position="200" min-start="120" min-end="120" label="Resize source tree">
        <div slot="start" style="padding:var(--space-4)"><mm-text variant="dense">Sources</mm-text></div>
        <div slot="end" style="padding:var(--space-4)"><mm-text variant="dense">Editor</mm-text></div>
      </mm-split-pane>
    </div>`),
};
