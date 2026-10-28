import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/pagination.js';
import type { MmPagination } from './class.ts';

type Args = { page: number; pageSize: number; total: number; variant: 'default' | 'compact'; pageSizes: string; disabled: boolean };

const onChange = fn();

const meta: Meta<Args> = {
  title: 'Components/Navigation/Pagination',
  component: 'mm-pagination',
  args: { page: 1, pageSize: 50, total: 1284019, variant: 'default', pageSizes: '25,50,100', disabled: false },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'compact'] } },
  render: (a) => html`<mm-pagination
    page=${a.page}
    page-size=${a.pageSize}
    total=${a.total}
    variant=${a.variant}
    page-sizes=${a.pageSizes}
    ?disabled=${a.disabled}
    @mm-page-change=${(e: CustomEvent) => onChange(e.detail)}
  ></mm-pagination>`,
  parameters: {
    usage: {
      html: `<mm-pagination page="1" page-size="50" total="1284019" page-sizes="25,50,100"></mm-pagination>
<mm-pagination variant="compact" page="3" page-size="50" total="1284"></mm-pagination>
<!-- Cursor pagination: no total -->
<mm-pagination page="3" page-size="50" has-next></mm-pagination>`,
      react: `import { MmPagination } from '@marmotdata/react';

<MmPagination
  page={page}
  pageSize={pageSize}
  total={1284019}
  pageSizes="25,50,100"
  onMmPageChange={(e) => { setPage(e.detail.page); setPageSize(e.detail.pageSize); }}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/pagination.js';
  let page = $state(1);
  let pageSize = $state(50);
</script>

<mm-pagination
  {page}
  page-size={pageSize}
  total={1284019}
  page-sizes="25,50,100"
  onmm-page-change={(e) => ({ page, pageSize } = e.detail)}
></mm-pagination>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const el = (root: HTMLElement) => root.querySelector('mm-pagination') as MmPagination;
const sr = (root: HTMLElement) => el(root).shadowRoot!;
const inner = (b: Element | null) => b!.shadowRoot!.querySelector('button')!;
const pageNumbers = (root: HTMLElement) =>
  [...sr(root).querySelectorAll('ol > li')].map((li) => li.textContent!.trim());

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await el(canvasElement).updateComplete;
    const nav = sr(canvasElement).querySelector('nav')!;
    await expect(nav).toHaveAttribute('aria-label', 'Pagination');
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 1–50 of 1,284,019');
    await expect(pageNumbers(canvasElement)).toEqual(['1', '2', '3', '4', '5', '…', '25,681']);
    await expect(sr(canvasElement).querySelector('[aria-current="page"]')).toHaveAccessibleName('Page 1');
    const [prev, next] = sr(canvasElement).querySelectorAll('mm-button');
    await expect(inner(prev!)).toHaveAccessibleName('Previous page');
    await expect(inner(prev!)).toHaveAttribute('aria-disabled', 'true');
    await expect(inner(next!)).toHaveAccessibleName('Next page');
  },
};

export const MiddlePage: Story = {
  name: 'Ellipses either side',
  args: { page: 12, total: 1284 },
  play: async ({ canvasElement }) => {
    await el(canvasElement).updateComplete;
    await expect(pageNumbers(canvasElement)).toEqual(['1', '…', '11', '12', '13', '…', '26']);
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 551–600 of 1,284');
  },
};

export const LastPage: Story = {
  args: { page: 26, total: 1284 },
  play: async ({ canvasElement }) => {
    await el(canvasElement).updateComplete;
    await expect(pageNumbers(canvasElement)).toEqual(['1', '…', '22', '23', '24', '25', '26']);
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 1,251–1,284 of 1,284');
    await expect(inner(sr(canvasElement).querySelectorAll('mm-button')[1]!)).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } }, args: { page: 3, total: 1284 } };

export const Focus: Story = {
  args: { page: 3, total: 1284, pageSizes: '' },
  play: async ({ canvasElement }) => {
    await el(canvasElement).updateComplete;
    await tab();
    await expect(deepActive()).toBe(inner(sr(canvasElement).querySelector('mm-button')));
  },
};

export const KeyboardPages: Story = {
  name: 'Keyboard: previous, next and page numbers',
  args: { pageSizes: '' },
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const p = el(canvasElement);
    await p.updateComplete;
    await tab();
    // Previous is disabled on page 1 but stays focusable.
    await expect(deepActive()).toBe(inner(sr(canvasElement).querySelector('mm-button')));
    await press('{Enter}');
    await expect(onChange).not.toHaveBeenCalled();
    await tab();
    await tab();
    await expect(deepActive()).toHaveAccessibleName('Page 2');
    await press('{Enter}');
    await expect(onChange).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
    await expect(p.page).toBe(2);
    await waitFor(() => expect(deepActive()).toHaveAttribute('aria-current', 'page'));
    await expect(deepActive()).toHaveAccessibleName('Page 2');
    await press('{Space}');
    await expect(onChange).toHaveBeenCalledTimes(1);
    // Tab on to Next and press it.
    const next = inner(sr(canvasElement).querySelectorAll('mm-button')[1]!);
    while (deepActive() !== next) await tab();
    await press('{Enter}');
    await expect(onChange).toHaveBeenLastCalledWith({ page: 3, pageSize: 50 });
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 101–150 of 1,284,019');
    // And back with Previous.
    await tab(true);
    while (deepActive() !== inner(sr(canvasElement).querySelector('mm-button'))) await tab(true);
    await press('{Enter}');
    await expect(p.page).toBe(2);
  },
};

export const KeyboardPageSize: Story = {
  name: 'Keyboard: page size',
  args: { page: 3 },
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const p = el(canvasElement);
    await p.updateComplete;
    await tab();
    const select = sr(canvasElement).querySelector('mm-select')!;
    await expect(select.shadowRoot!.querySelector('[role="combobox"]')).toHaveAccessibleName('Rows per page');
    await press('{Enter}');
    await press('{End}');
    await press('{Enter}');
    // Row 101 was first on screen; at 100 rows per page it is on page 2.
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ page: 2, pageSize: 100 }));
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 101–200 of 1,284,019');
  },
};

export const Compact: Story = {
  args: { variant: 'compact', page: 3, total: 1284 },
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    await el(canvasElement).updateComplete;
    await expect(sr(canvasElement).querySelector('.position')!.textContent).toBe('Page 3 of 26');
    await expect(sr(canvasElement).querySelector('ol')).toBeNull();
    await tab();
    await tab();
    await press('{Enter}');
    await expect(onChange).toHaveBeenLastCalledWith({ page: 4, pageSize: 50 });
    await expect(sr(canvasElement).querySelector('.position')!.textContent).toBe('Page 4 of 26');
  },
};

export const UnknownTotal: Story = {
  name: 'Cursor pagination (unknown total)',
  render: () => html`<mm-pagination page="3" page-size="50" has-next @mm-page-change=${(e: CustomEvent) => onChange(e.detail)}></mm-pagination>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    await el(canvasElement).updateComplete;
    await expect(sr(canvasElement).querySelector('.summary')!.textContent).toBe('Showing 101–150');
    await expect(sr(canvasElement).querySelector('.position')!.textContent).toBe('Page 3');
    await tab();
    await tab();
    await press('{Enter}');
    await expect(onChange).toHaveBeenLastCalledWith({ page: 4, pageSize: 50 });
  },
};

export const LastCursorPage: Story = {
  name: 'Cursor pagination, last page',
  render: () => html`<mm-pagination page="7" page-size="50"></mm-pagination>`,
  play: async ({ canvasElement }) => {
    await el(canvasElement).updateComplete;
    await expect(inner(sr(canvasElement).querySelectorAll('mm-button')[1]!)).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Empty: Story = { args: { total: 0 } };
export const Disabled: Story = { name: 'Disabled (loading a page)', args: { page: 4, total: 1284, disabled: true } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  args: { page: 12840, total: 1284019, pageSizes: '25,50,100' },
  render: (a) => html`<div style="width:360px;max-width:100%">${meta.render!(a, {} as never)}</div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { page: 3, total: 1284 } };
export const CompactDensity: Story = { name: 'Compact density', globals: { density: 'compact' }, args: { page: 3, total: 1284 } };
export const BothThemes: Story = {
  render: () => themes(html`<div style="display:grid;gap:var(--space-4)">
    <mm-pagination page="3" page-size="50" total="1284"></mm-pagination>
    <mm-pagination variant="compact" page="3" page-size="50" total="1284"></mm-pagination>
  </div>`),
  play: async ({ canvasElement }) => {
    // Landmarks need unique names when several share a page.
    const names = ['Audit log pages, light', 'Blade pages, light', 'Audit log pages, Peat', 'Blade pages, Peat'];
    canvasElement.querySelectorAll('mm-pagination').forEach((p, i) => (p.label = names[i]!));
    await Promise.all([...canvasElement.querySelectorAll('mm-pagination')].map((p) => p.updateComplete));
  },
};
