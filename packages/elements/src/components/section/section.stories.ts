import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/section.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/list.js';
import '@marmotdata/elements/status-pill.js';
import '@marmotdata/elements/skeleton.js';

type Args = { heading: string; description: string; divider: boolean };

const runs = html`<mm-list aria-label="Run history">
  <mm-list-item href="#/runs/8121" secondary="1,284,019 rows · 4 min 12 s">Run 8121<mm-status-pill slot="end" state="succeeded"></mm-status-pill></mm-list-item>
  <mm-list-item href="#/runs/8120" secondary="Connection refused by orders-db.internal">Run 8120<mm-status-pill slot="end" state="failed"></mm-status-pill></mm-list-item>
</mm-list>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Section',
  component: 'mm-section',
  args: { heading: 'Run history', description: 'Every run of postgres-shop in the last 30 days.', divider: false },
  render: (a) => html`<mm-section heading=${a.heading} description=${a.description} ?divider=${a.divider} style="max-width:720px">
    <mm-button slot="actions" size="sm" icon="play-arrow">Run now</mm-button>
    ${runs}
  </mm-section>`,
  parameters: {
    usage: {
      html: `<mm-section heading="Run history" description="Every run of postgres-shop in the last 30 days.">
  <mm-button slot="actions" size="sm" icon="play-arrow">Run now</mm-button>
  …
</mm-section>`,
      react: `import { MmSection } from '@marmotdata/react';

<MmSection heading="Schema" divider>
  <SchemaTable columns={columns} />
</MmSection>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/section.js';
</script>

<mm-section heading="Members" description="People and agents with access to this workspace.">…</mm-section>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};

export const Stack: Story = {
  name: 'Sections on a page',
  render: () => html`<div style="max-width:720px">
    <mm-section heading="Run history">${runs}</mm-section>
    <mm-section heading="Configuration" divider description="Read from the plugin's YAML at the last deploy.">
      <mm-text block variant="dense">Hourly, schemas <mm-text variant="mono-dense">public</mm-text> and <mm-text variant="mono-dense">reporting</mm-text>.</mm-text>
    </mm-section>
  </div>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};

export const Loading: Story = {
  render: () => html`<mm-section heading="Run history" style="max-width:720px"><mm-skeleton loading shape="table-row" count="3"></mm-skeleton></mm-section>`,
};

export const Empty: Story = {
  render: () => html`<mm-section heading="Run history" style="max-width:720px">
    <mm-text block variant="dense" tone="secondary">postgres-shop has not run yet. Run it now or wait for the next scheduled run at 05:12 UTC.</mm-text>
  </mm-section>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  args: {
    heading: 'Downstream dashboards that read from orders_daily_by_customer_region_rollup_v2',
    description: 'Includes Looker, Metabase and Superset dashboards discovered by the BI plugins in the last 90 days, refreshed nightly.',
  },
  render: (a) => html`<mm-section heading=${a.heading} description=${a.description} style="max-width:420px">
    <mm-button slot="actions" size="sm" variant="secondary" icon="download">Export CSV</mm-button>
    <mm-button slot="actions" size="sm" icon="play-arrow">Run now</mm-button>
    ${runs}
  </mm-section>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, args: { heading: 'سجل التشغيل', description: 'كل عمليات التشغيل خلال آخر 30 يومًا.' } };
export const CompactDensity: Story = { globals: { density: 'compact' } };
export const BothThemes: Story = {
  render: () =>
    themes(html`<mm-section heading="Run history" divider description="Every run of postgres-shop in the last 30 days.">${runs}</mm-section>`),
};
