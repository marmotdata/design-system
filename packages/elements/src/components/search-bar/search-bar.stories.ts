import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { click, press } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/search-bar.js';
import type { MmSearchBar, SearchBarField } from '@marmotdata/elements/search-bar.js';

const fields: SearchBarField[] = [
  { value: 'type', label: 'Type', values: [{ value: 'table', label: 'Table' }, { value: 'view', label: 'View' }, { value: 'topic', label: 'Topic' }, { value: 'dashboard', label: 'Dashboard' }] },
  { value: 'provider', label: 'Provider', values: [{ value: 'snowflake', label: 'Snowflake' }, { value: 'postgresql', label: 'PostgreSQL' }, { value: 'bigquery', label: 'BigQuery' }, { value: 'kafka', label: 'Kafka' }] },
  { value: 'name', label: 'Name' },
  { value: 'term', label: 'Glossary term', kind: 'term', values: ['Gross merchandise value', 'Net revenue', 'Active customer'] },
  { value: 'kind', label: 'Kind', values: [{ value: 'asset', label: 'Asset' }, { value: 'glossary', label: 'Glossary term' }, { value: 'team', label: 'Team' }, { value: 'product', label: 'Data product' }] },
  { value: 'metadata.team', label: 'Team' },
  { value: 'metadata.row_count', label: 'Row count', kind: 'number' },
];

type Args = { value: string; raw: boolean };

const meta: Meta<Args> = {
  title: 'Components/Query/Search bar',
  component: 'mm-search-bar',
  args: { value: 'orders AND @type = table AND (@provider = snowflake OR @provider = bigquery)', raw: false },
  render: (a) => html`<mm-search-bar label="Search the catalog" placeholder="Search, or type @ to filter" value=${a.value} ?raw=${a.raw} .fields=${fields}></mm-search-bar>`,
  parameters: {
    usage: {
      html: `<mm-search-bar label="Search the catalog" placeholder="Search, or type @ to filter"></mm-search-bar>
<script>
  const bar = document.querySelector('mm-search-bar');
  bar.fields = [{ value: 'type', label: 'Type', values: [{ value: 'table', label: 'Table' }] }, { value: 'metadata.owner', label: 'Owner' }];
  bar.addEventListener('mm-input', (e) => search(e.detail.value));
</script>`,
      react: `import { MmSearchBar } from '@marmotdata/react';

<MmSearchBar label="Search the catalog" fields={fields} value={query} onMmInput={(e) => setQuery(e.detail.value)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/search-bar.js';
  let query = $state('');
</script>

<mm-search-bar label="Search the catalog" {fields} value={query} onmm-input={(e) => (query = e.detail.value)}></mm-search-bar>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const barOf = (root: Element) => root.querySelector<MmSearchBar>('mm-search-bar')!;
const tokens = (b: MmSearchBar) => [...b.shadowRoot!.querySelectorAll<HTMLElement>('.token')];

export const Default: Story = {};
export const Empty: Story = { args: { value: '' } };
export const NumberRange: Story = { name: 'Number range', args: { value: '@metadata.row_count range [1000 TO 50000] AND @name = "orders_*"' } };
export const ShownAsText: Story = { name: 'Show as text', args: { raw: true } };
export const NeedsText: Story = { name: 'A query the tokens cannot show', args: { value: '@type = table OR @provider = kafka' } };
export const Narrow: Story = { render: (a) => html`<div style="max-width:24rem">${meta.render!(a, {} as never)}</div>` };
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: (a) => themes(meta.render!(a, {} as never)) };

export const TokensReadPlainly: Story = {
  name: 'Tokens read in plain words',
  play: async ({ canvasElement }) => {
    const b = barOf(canvasElement);
    await b.updateComplete;
    const t = tokens(b);
    await expect(t.length).toBe(2);
    await expect(t[0]).toHaveAttribute('aria-label', 'Filter: Type is Table');
    await expect(t[1]).toHaveAttribute('aria-label', 'Filter: Provider is Snowflake or BigQuery');
  },
};

export const KeyboardRemove: Story = {
  name: 'Keyboard: Backspace twice removes the last token',
  play: async ({ canvasElement }) => {
    const b = barOf(canvasElement);
    await b.updateComplete;
    const input = b.shadowRoot!.querySelector('mm-query-input')!.shadowRoot!.querySelector('input')!;
    input.focus();
    // Clear the free text first, then Backspace selects, and again removes.
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await press('{Backspace}');
    await waitFor(() => expect(tokens(b)[1]!.classList.contains('selected')).toBe(true));
    await press('{Backspace}');
    await waitFor(() => expect(tokens(b).length).toBe(1));
    await expect(b.value).not.toContain('@provider');
  },
};

export const EditValue: Story = {
  name: 'Click a value to change it',
  args: { value: '@type = table' },
  play: async ({ canvasElement }) => {
    const b = barOf(canvasElement);
    await b.updateComplete;
    await click(b.shadowRoot!.querySelector<HTMLElement>('.token .part.val')!);
    const editor = b.shadowRoot!.querySelector<HTMLElement>('.editor')!;
    await waitFor(() => expect(editor.matches(':popover-open')).toBe(true));
    const view = [...editor.querySelectorAll('mm-checkbox')].find((c) => c.getAttribute('label') === 'View')!;
    await click(view.shadowRoot!.querySelector('input')!);
    await click(editor.querySelector('mm-button')!.shadowRoot!.querySelector('button')!);
    await waitFor(() => expect(b.value).toBe('(@type = table OR @type = view)'));
  },
};
