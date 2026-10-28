import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/code-sample.js';
import type { MmCodeSample } from './class.ts';

const SQL = `-- Daily revenue for the last week
select date_trunc('day', created_at) as day,
       sum(total) as revenue,
       count(*) as orders
from shop.public.orders
where created_at > now() - interval '7 days'
group by 1
order by 1;`;

const CLI = `$ marmot query run --source shop-postgres \\
    --format csv --output orders_daily.csv \\
    "select * from analytics.orders_daily where day >= current_date - 30"
# Wrote 30 rows to orders_daily.csv in 412 ms`;

const API = `curl -X POST https://marmot.example.internal/api/v1/query \\
  -H "Authorization: Bearer $MARMOT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"source": "shop-postgres", "sql": "select count(*) from shop.public.orders"}'`;

const PYTHON = `from marmot import Client

client = Client(token=os.environ["MARMOT_TOKEN"])
result = client.query("shop-postgres", "select count(*) from shop.public.orders")
print(result.rows[0])  # (1284019,)`;

const JSON_SAMPLE = `{
  "mrn": "mrn://postgresql/table/shop.public.orders",
  "type": "table",
  "owners": ["Analytics Engineering"],
  "row_count": 1284019,
  "certified": true,
  "updated_at": "2026-10-27T04:12:09Z"
}`;

const YAML_SAMPLE = `name: shop-postgres
type: postgresql
schedule: "0 */6 * * *"
config:
  host: shop-db.internal
  port: 5432
  schemas:
    - public
    - analytics
  include_row_counts: true # slower on very large tables`;

const TS = `import { MarmotClient } from '@marmotdata/sdk';

const client = new MarmotClient({ token: process.env.MARMOT_TOKEN });
const asset = await client.assets.get('mrn://postgresql/table/shop.public.orders');
console.log(asset.owners, asset.rowCount); // ["Analytics Engineering"] 1284019`;

const HCL = `resource "marmot_pipeline" "shop_postgres" {
  name     = "shop-postgres"
  plugin   = "postgresql"
  schedule = "0 */6 * * *"

  config = jsonencode({
    host    = "shop-db.internal"
    port    = 5432
    schemas = ["public", "analytics"]
  })
}`;

const GO = `package main

import "github.com/marmotdata/marmot/sdk"

func main() {
	client := sdk.New(os.Getenv("MARMOT_TOKEN"))
	// Fetch the orders table and print its owners
	asset, err := client.Assets.Get("mrn://postgresql/table/shop.public.orders")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(asset.Owners, 1284019)
}`;

type Args = { language: string; code: string; filename: string; wrap: boolean; highlight: string; lineNumbers: boolean };

const meta: Meta<Args> = {
  title: 'Components/Docs and marketing/Code sample',
  component: 'mm-code-sample',
  args: { language: 'sql', code: SQL, filename: '', wrap: false, highlight: '', lineNumbers: false },
  argTypes: { language: { control: 'select', options: ['sql', 'bash', 'json', 'yaml', 'typescript', 'javascript', 'hcl', 'go', 'text'] } },
  render: (a) =>
    html`<mm-code-sample
      language=${a.language}
      .code=${a.code}
      filename=${a.filename}
      highlight=${a.highlight}
      ?wrap=${a.wrap}
      ?line-numbers=${a.lineNumbers}
      style="max-width:640px"
    ></mm-code-sample>`,
  parameters: {
    usage: {
      html: `<mm-code-sample language="sql" filename="queries/revenue.sql" highlight="2-3">
  select date_trunc('day', created_at) as day,
         sum(total) as revenue
  from shop.public.orders
  group by 1;
</mm-code-sample>

<mm-code-tabs label="Ways to run this query">
  <mm-code-sample tab="CLI" language="bash">marmot query run --source shop-postgres "select 1"</mm-code-sample>
  <mm-code-sample tab="API" language="bash">curl -X POST …/api/v1/query</mm-code-sample>
</mm-code-tabs>`,
      react: `import { MmCodeSample, MmCodeTabs } from '@marmotdata/react';

<MmCodeSample language="sql" code={sql} filename="queries/revenue.sql" />

<MmCodeTabs label="Ways to run this query">
  <MmCodeSample tab="CLI" language="bash" code={cli} />
  <MmCodeSample tab="Python" language="text" code={python} />
</MmCodeTabs>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/code-sample.js';
</script>

<mm-code-sample language="yaml" code={pipelineYaml} filename="pipelines/shop-postgres.yaml"></mm-code-sample>

<mm-code-tabs label="Ways to run this query" onmm-change={(e) => remember(e.detail.tab)}>
  <mm-code-sample tab="CLI" language="bash" code={cli}></mm-code-sample>
  <mm-code-sample tab="API" language="bash" code={api}></mm-code-sample>
</mm-code-tabs>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const sampleIn = (el: HTMLElement) => el.querySelector('mm-code-sample') as MmCodeSample;

export const Default: Story = {
  name: 'SQL',
  play: async ({ canvasElement }) => {
    const pre = sampleIn(canvasElement).shadowRoot!.querySelector('pre')!;
    await expect(pre.querySelector('.c')).toHaveTextContent('-- Daily revenue for the last week');
    await expect(pre.querySelector('.f')).toHaveTextContent('date_trunc');
    await expect(pre.querySelector('.s')).toHaveTextContent("'day'");
    await expect(pre).toHaveAttribute('aria-label', 'SQL sample');
  },
};
export const WithFilename: Story = { name: 'With filename', args: { filename: 'queries/revenue_last_week.sql', highlight: '2-3' } };
export const LineNumbers: Story = { name: 'Line numbers and highlighted lines', args: { lineNumbers: true, highlight: '6' } };

export const Languages: Story = {
  render: () => html`<div style="display:grid;gap:var(--space-5);max-width:680px">
    <mm-code-sample language="bash" .code=${CLI} filename="Terminal"></mm-code-sample>
    <mm-code-sample language="json" .code=${JSON_SAMPLE} filename="GET /api/v1/assets/{mrn}"></mm-code-sample>
    <mm-code-sample language="yaml" .code=${YAML_SAMPLE} filename="pipelines/shop-postgres.yaml"></mm-code-sample>
    <mm-code-sample language="typescript" .code=${TS} filename="scripts/owners.ts"></mm-code-sample>
    <mm-code-sample language="hcl" .code=${HCL} filename="marmot.tf"></mm-code-sample>
    <mm-code-sample language="go" .code=${GO} filename="main.go"></mm-code-sample>
  </div>`,
};

export const FromText: Story = {
  name: 'Code as element text',
  render: () => html`<mm-code-sample language="sql" style="max-width:640px">
    select customer_id, customer_name, region
    from analytics.customers_dim
    where first_order_at >= '2026-01-01';
  </mm-code-sample>`,
  play: async ({ canvasElement }) => {
    const sample = sampleIn(canvasElement);
    await waitFor(() => expect(sample.code.startsWith('select customer_id')).toBe(true));
  },
};

export const LongLinesScroll: Story = {
  name: 'Overflowing content: scrolls',
  args: { language: 'bash', code: API },
  play: async ({ canvasElement }) => {
    await tab();
    const sr = sampleIn(canvasElement).shadowRoot!;
    const pre = sr.querySelector('pre')!;
    await expect(deepActive()).toBe(pre);
    // The copy button sits beside the scrolling code, never over it, even scrolled to the end.
    await press('{End}');
    pre.scrollLeft = pre.scrollWidth;
    const copy = sr.querySelector('mm-copy-button')!.getBoundingClientRect();
    const port = pre.getBoundingClientRect();
    await expect(copy.left).toBeGreaterThanOrEqual(port.right - 0.5);
  },
};
export const LongLinesWrap: Story = {
  name: 'Overflowing content: wraps',
  args: { language: 'bash', code: API, wrap: true },
  play: async ({ canvasElement }) => {
    const sr = sampleIn(canvasElement).shadowRoot!;
    const copy = sr.querySelector('mm-copy-button')!.getBoundingClientRect();
    await expect(copy.left).toBeGreaterThanOrEqual(sr.querySelector('pre')!.getBoundingClientRect().right - 0.5);
  },
};
export const Empty: Story = { args: { code: '', language: 'text' } };
export const RightToLeft: Story = {
  name: 'Right to left',
  parameters: { dir: 'rtl' },
  args: { filename: 'استعلامات/الإيرادات.sql' },
  play: async ({ canvasElement }) => {
    await expect(sampleIn(canvasElement).shadowRoot!.querySelector('.block')).toHaveAttribute('dir', 'ltr');
  },
};
export const BothThemes: Story = {
  name: 'Both themes',
  render: () => themes(html`<mm-code-sample language="sql" .code=${SQL} filename="queries/revenue.sql" highlight="2"></mm-code-sample>`),
};

const writes = fn(async (_text: string) => {});
const onCopy = fn();
export const CopyConfirms: Story = {
  name: 'Keyboard: copy confirms "Copied"',
  render: () => html`<mm-code-sample language="sql" .code=${SQL} style="max-width:640px" @mm-copy=${(e: CustomEvent) => onCopy(e.detail.value)}></mm-code-sample>`,
  play: async ({ canvasElement }) => {
    writes.mockClear();
    onCopy.mockClear();
    Object.defineProperty(navigator.clipboard, 'writeText', { value: writes, configurable: true });
    const sample = sampleIn(canvasElement);
    await tab();
    await tab();
    const copy = sample.shadowRoot!.querySelector('mm-copy-button')!;
    const button = copy.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
    await expect(deepActive()).toBe(button);
    await press('{Enter}');
    await expect(writes).toHaveBeenCalledWith(SQL);
    await expect(onCopy).toHaveBeenCalledWith(SQL);
    await waitFor(() => expect(copy.shadowRoot!.querySelector('mm-button')).toHaveTextContent('Copied'));
    await waitFor(() => expect(copy.shadowRoot!.querySelector('[role="status"]')).toHaveTextContent('Copied'));
  },
};

const onTab = fn();
const tabsDemo = () => html`<mm-code-tabs label="Ways to run this query" style="max-width:680px" @mm-change=${(e: CustomEvent) => onTab(e.detail)}>
  <mm-code-sample tab="CLI" language="bash" .code=${CLI}></mm-code-sample>
  <mm-code-sample tab="API" language="bash" .code=${API}></mm-code-sample>
  <mm-code-sample tab="Python" language="text" .code=${PYTHON}></mm-code-sample>
</mm-code-tabs>`;

export const Tabs: Story = {
  name: 'Tabs: CLI, API, Python',
  render: tabsDemo,
  parameters: {
    usage: {
      html: `<mm-code-tabs label="Ways to run this query">
  <mm-code-sample tab="CLI" language="bash">…</mm-code-sample>
  <mm-code-sample tab="API" language="bash">…</mm-code-sample>
  <mm-code-sample tab="Python" language="text">…</mm-code-sample>
</mm-code-tabs>`,
    },
  },
};

export const TabsKeyboard: Story = {
  name: 'Keyboard: tabs move with arrows, Home and End',
  render: tabsDemo,
  play: async ({ canvasElement }) => {
    onTab.mockClear();
    const tabs = canvasElement.querySelector('mm-code-tabs')!;
    const samples = [...canvasElement.querySelectorAll('mm-code-sample')];
    const buttons = () => [...tabs.shadowRoot!.querySelectorAll<HTMLElement>('[role="tab"]')];
    await waitFor(() => expect(buttons()).toHaveLength(3));
    await expect(samples[1]).toHaveAttribute('data-tab-hidden');
    await tab();
    await expect(deepActive()).toBe(buttons()[0]);
    await press('{ArrowRight}');
    await expect(deepActive()).toBe(buttons()[1]);
    await expect(buttons()[1]).toHaveAttribute('aria-selected', 'true');
    await expect(onTab).toHaveBeenLastCalledWith({ index: 1, tab: 'API' });
    await expect(samples[1]).not.toHaveAttribute('data-tab-hidden');
    await expect(samples[0]).toHaveAttribute('data-tab-hidden');
    await press('{End}');
    await expect(buttons()[2]).toHaveAttribute('aria-selected', 'true');
    await press('{ArrowRight}');
    await expect(buttons()[0]).toHaveAttribute('aria-selected', 'true');
    await press('{Home}');
    await click(buttons()[2]!);
    await expect(onTab).toHaveBeenLastCalledWith({ index: 2, tab: 'Python' });
  },
};

export const TabsRightToLeft: Story = {
  name: 'Tabs: right to left',
  parameters: { dir: 'rtl' },
  render: tabsDemo,
  play: async ({ canvasElement }) => {
    const tabs = canvasElement.querySelector('mm-code-tabs')!;
    const buttons = () => [...tabs.shadowRoot!.querySelectorAll<HTMLElement>('[role="tab"]')];
    await waitFor(() => expect(buttons()).toHaveLength(3));
    await tab();
    await press('{ArrowLeft}');
    await expect(buttons()[1]).toHaveAttribute('aria-selected', 'true');
  },
};

export const TabsBothThemes: Story = { name: 'Tabs: both themes', render: () => themes(tabsDemo()) };
