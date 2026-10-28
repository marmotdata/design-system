import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/code-editor.js';
import '@marmotdata/elements/button.js';
import type { EditorDiagnostic, MmCodeEditor } from './class.ts';

const SQL = `-- Revenue per customer over the last 30 days, ranked within each region
with recent_orders as (
  select o.customer_id, o.total, o.created_at
  from shop.public.orders o
  where o.status = 'completed'
    and o.created_at >= now() - interval '30 days'
)
select c.region,
       c.customer_name,
       sum(r.total) as revenue,
       rank() over (partition by c.region order by sum(r.total) desc) as region_rank
from recent_orders r
join analytics.customers_dim c on c.customer_id = r.customer_id
group by c.region, c.customer_name
order by c.region, region_rank
limit 50;`;

const ROLE = `{
  "role": "analyst",
  "description": "Read access to curated shop data for Analytics Engineering",
  "grants": [
    {
      "resource": "mrn://postgresql/table/shop.public.orders",
      "actions": ["query", "read_metadata"]
    },
    {
      "resource": "mrn://postgresql/table/analytics.customers_dim",
      "actions": ["query"],
      "mask_columns": ["email", "phone"]
    }
  ],
  "max_rows": 100000,
  "require_approval": false
}`;

const PIPELINE = `# Catalogs the shop database every six hours
name: shop-postgres
type: postgresql
schedule: "0 */6 * * *"
config:
  host: shop-db.internal
  port: 5432
  database: shop
  schemas:
    - public
    - analytics
  include_row_counts: true
  exclude:
    - "*_tmp"
owners:
  - Analytics Engineering
tags: [pii, certified]`;

const BROKEN = `select o.order_id,
       o.total,
       o.custmer_id
from shop.public.orders o
where o.created_at >= current_date - 7;`;
const at = BROKEN.indexOf('custmer_id');
const DIAGNOSTICS: EditorDiagnostic[] = [{ from: at, to: at + 'custmer_id'.length, severity: 'error', message: 'column "custmer_id" does not exist' }];

const LONG = `select order_id, customer_id, total, status, created_at, updated_at, shipping_country, shipping_postcode, payment_method, discount_code, currency, exchange_rate_to_gbp from shop.public.orders where created_at >= '2026-10-01' and status in ('completed', 'refunded', 'partially_refunded');`;

type Args = { language: string; value: string; label: string; readonly: boolean; disabled: boolean; placeholder: string };

const meta: Meta<Args> = {
  title: 'Components/Query/Code editor',
  component: 'mm-code-editor',
  args: { language: 'sql', value: SQL, label: 'Query', readonly: false, disabled: false, placeholder: '' },
  argTypes: {
    language: { control: 'inline-radio', options: ['sql', 'json', 'yaml', 'text'] },
    value: { control: 'text' },
  },
  render: (a) =>
    html`<mm-code-editor
      language=${a.language}
      .value=${a.value}
      label=${a.label}
      placeholder=${a.placeholder}
      ?readonly=${a.readonly}
      ?disabled=${a.disabled}
    ></mm-code-editor>`,
  parameters: {
    usage: {
      html: `<mm-code-editor language="json" label="Role document" name="document"></mm-code-editor>
<script type="module">
  import '@marmotdata/elements/code-editor.js';
  const editor = document.querySelector('mm-code-editor');
  editor.value = JSON.stringify(role, null, 2);
  editor.addEventListener('mm-change', (e) => save(e.detail.value));
  editor.diagnostics = [{ from: 41, to: 50, severity: 'error', message: 'Unknown action "admin"' }];
</script>`,
      react: `import { MmCodeEditor } from '@marmotdata/react';

<MmCodeEditor
  language="yaml"
  label="Pipeline config"
  value={config}
  diagnostics={problems}
  onMmInput={(e) => setConfig(e.detail.value)}
/>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/code-editor.js';
  let { document } = $props();
</script>

<mm-code-editor
  language="json"
  label="Role document"
  name="document"
  value={document}
  onmm-change={(e) => save(e.detail.value)}
></mm-code-editor>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const editorIn = (el: HTMLElement) => el.querySelector('mm-code-editor') as MmCodeEditor;
const loaded = async (el: HTMLElement) => {
  const editor = editorIn(el);
  await editor.load();
  await waitFor(() => expect(editor.shadowRoot!.querySelector('.cm-content')).toBeTruthy());
  return editor;
};
const content = (editor: MmCodeEditor) => editor.shadowRoot!.querySelector('.cm-content') as HTMLElement;

export const Default: Story = {
  name: 'SQL',
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(content(editor)).toHaveAttribute('aria-label', 'Query');
    await expect(editor.shadowRoot!.querySelector('.cm-gutters')).toBeTruthy();
  },
};
export const RoleDocument: Story = {
  name: 'JSON role document',
  args: { language: 'json', value: ROLE, label: 'Role document' },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.cm-content')).toHaveTextContent('mrn://postgresql/table/shop.public.orders');
  },
};
export const PipelineConfig: Story = {
  name: 'YAML pipeline config',
  args: { language: 'yaml', value: PIPELINE, label: 'Pipeline config' },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await expect(deepActive()).toBe(content(editor));
    await waitFor(() => expect(editor.shadowRoot!.querySelector('.frame')).toHaveClass('focused'));
  },
};

export const ReadOnly: Story = {
  name: 'Read only',
  args: { readonly: true, language: 'json', value: ROLE, label: 'Role document' },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(content(editor)).toHaveAttribute('aria-readonly', 'true');
    await tab();
    await press('x');
    await expect(editor.value).toBe(ROLE);
    await expect(editor.shadowRoot!.querySelector('.badge')).toHaveTextContent('Read only');
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(content(editor)).toHaveAttribute('contenteditable', 'false');
    await expect(content(editor)).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Loading: Story = {
  name: 'Loading (lazy until focused)',
  render: (a) => html`<mm-code-editor lazy="interaction" language="sql" .value=${a.value} label="Query"></mm-code-editor>
    <p style="font:var(--text-caption);color:var(--mm-text-2);margin:var(--space-2) 0 0">
      Until CodeMirror loads, the editor shows a static highlighted copy with the same metrics, so nothing moves when it arrives.
    </p>`,
  play: async ({ canvasElement }) => {
    const editor = editorIn(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.cm-editor')).toBeNull();
    const fallback = editor.shadowRoot!.querySelector('.fallback') as HTMLElement;
    await expect(fallback).toHaveAttribute('role', 'textbox');
    await expect(fallback.querySelector('.k')).toHaveTextContent('with');
    await tab();
    await waitFor(() => expect(deepActive()).toBe(content(editor)));
  },
};

export const ErrorDiagnostic: Story = {
  name: 'Error with inline diagnostic',
  render: () => html`<mm-code-editor language="sql" label="Query" .value=${BROKEN} .diagnostics=${DIAGNOSTICS}></mm-code-editor>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await waitFor(() => expect(editor.shadowRoot!.querySelector('.cm-lintRange-error')).toHaveTextContent('custmer_id'));
    const message = editor.shadowRoot!.querySelector('.message')!;
    await expect(message).toHaveTextContent('Line 3, column 10');
    await expect(message).toHaveTextContent('column "custmer_id" does not exist');
    await expect(content(editor)).toHaveAttribute('aria-invalid', 'true');
    await expect(editor.shadowRoot!.querySelector('.cm-lint-marker-error')).toBeTruthy();
  },
};

export const LongLines: Story = {
  name: 'Long lines',
  args: { value: LONG },
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};
export const Empty: Story = {
  args: { value: '', placeholder: 'Write a query against the catalog' },
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.cm-placeholder')).toHaveTextContent('Write a query against the catalog');
  },
};
export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { language: 'yaml', value: PIPELINE, label: 'إعدادات خط الأنابيب', readonly: true },
  play: async ({ canvasElement }) => {
    const editor = editorIn(canvasElement);
    await expect(editor.shadowRoot!.querySelector('.frame')).toHaveAttribute('dir', 'ltr');
  },
};
export const BothThemes: Story = {
  name: 'Both themes',
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4)">
      <mm-code-editor language="sql" label="Query" .value=${BROKEN} .diagnostics=${DIAGNOSTICS} style="--mm-code-editor-height:140px"></mm-code-editor>
      <mm-code-editor language="json" label="Role document" .value=${ROLE} readonly style="--mm-code-editor-height:180px"></mm-code-editor>
    </div>`),
};

const onInput = fn();
const onChange = fn();
export const Typing: Story = {
  name: 'Keyboard: typing',
  render: () => html`<mm-code-editor language="sql" label="Query" .value=${''} @mm-input=${(e: CustomEvent) => onInput(e.detail.value)} @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}></mm-code-editor>
    <mm-button style="margin-top:var(--space-3)">Save query</mm-button>`,
  play: async ({ canvasElement }) => {
    onInput.mockClear();
    onChange.mockClear();
    const editor = await loaded(canvasElement);
    await tab();
    await press('select 1');
    await waitFor(() => expect(editor.value).toBe('select 1'));
    await expect(onInput).toHaveBeenLastCalledWith('select 1');
    // The first Escape closes the keyword completion if it is open; the next arms Tab to leave.
    await press('{Escape}{Escape}');
    await tab();
    await expect(editor.value).toBe('select 1');
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('select 1'));
  },
};

export const EscapeThenTab: Story = {
  name: 'Keyboard: Tab indents, Escape then Tab leaves',
  render: () => html`<mm-code-editor language="yaml" label="Pipeline config" .value=${'name: shop-postgres'}></mm-code-editor>
    <mm-button style="margin-top:var(--space-3)">Save config</mm-button>`,
  play: async ({ canvasElement }) => {
    const editor = await loaded(canvasElement);
    await tab();
    await expect(deepActive()).toBe(content(editor));
    await press('{Tab}');
    await expect(deepActive()).toBe(content(editor));
    await waitFor(() => expect(editor.value).toBe('  name: shop-postgres'));
    await press('{Escape}');
    await tab();
    const button = canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button');
    await expect(deepActive()).toBe(button);
  },
};

const onSubmit = fn();
export const SubmitsForm: Story = {
  name: 'Submits a native form',
  render: () => html`<form
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(new FormData(e.target as HTMLFormElement).get('document'));
    }}
    style="display:grid;gap:var(--space-3)"
  >
    <mm-code-editor name="document" language="json" label="Role document" value='{ "role": "analyst" }'></mm-code-editor>
    <mm-button type="submit" variant="primary">Save role</mm-button>
    <mm-button type="reset">Discard changes</mm-button>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const editor = await loaded(canvasElement);
    await tab();
    await press('{End}');
    await press('{Enter}');
    await waitFor(() => expect(editor.value).toBe('{ "role": "analyst" }\n'));
    const form = canvasElement.querySelector('form')!;
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith('{ "role": "analyst" }\n');
    form.reset();
    await expect(editor.value).toBe('{ "role": "analyst" }');
  },
};
