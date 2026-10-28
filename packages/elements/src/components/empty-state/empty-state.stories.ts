import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { deepActive, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/empty-state.js';
import '@marmotdata/elements/button.js';

type Args = { heading: string; description: string; compact: boolean; seed: number; action: string };

const meta: Meta<Args> = {
  title: 'Components/Status/Empty state',
  component: 'mm-empty-state',
  args: {
    heading: 'No assets yet',
    description: 'No assets have been catalogued from this source yet. Add a plugin to catalogue it.',
    compact: false,
    seed: 3,
    action: 'Add plugin',
  },
  render: (a) => html`<mm-empty-state heading=${a.heading} description=${a.description} ?compact=${a.compact} seed=${a.seed}>
    ${a.action ? html`<mm-button slot="action" variant="primary" icon="add">${a.action}</mm-button>` : ''}
  </mm-empty-state>`,
  parameters: {
    usage: {
      html: `<mm-empty-state heading="No assets yet" description="No assets have been catalogued from this source yet. Add a plugin to catalogue it.">
  <mm-button slot="action" variant="primary" icon="add">Add plugin</mm-button>
</mm-empty-state>`,
      react: `import { MmEmptyState, MmButton } from '@marmotdata/react';

<MmEmptyState heading="No assets yet" description="No assets have been catalogued from this source yet. Add a plugin to catalogue it.">
  <MmButton slot="action" variant="primary" icon="add" onClick={addPlugin}>Add plugin</MmButton>
</MmEmptyState>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/empty-state.js';
  import '@marmotdata/elements/button.js';
</script>

<mm-empty-state heading="No assets yet" description="No assets have been catalogued from this source yet. Add a plugin to catalogue it.">
  <mm-button slot="action" variant="primary" icon="add" onclick={addPlugin}>Add plugin</mm-button>
</mm-empty-state>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-empty-state')!;
    await expect(el.shadowRoot!.querySelector('[role="heading"]')).toHaveAttribute('aria-level', '2');
    // The field is a background behind the text, not a drawing above the heading.
    const field = el.shadowRoot!.querySelector('mm-topography')!;
    await expect(field).toHaveAttribute('fade', 'edges');
    await expect(field.shadowRoot!.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('mm-button')!.shadowRoot!.querySelector('button'));
  },
};

export const NoResults: Story = {
  name: 'Empty search',
  args: {
    heading: 'Nothing on this sheet',
    description: 'No assets match “orders_dialy”. Check the spelling or clear a filter.',
    seed: 11,
  },
  render: (a) => html`<mm-empty-state heading=${a.heading} description=${a.description} seed=${a.seed}>
    <mm-button slot="action" variant="secondary">Clear filters</mm-button>
  </mm-empty-state>`,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => html`<mm-empty-state heading="Out of reach" seed="21">
    Marmot could not reach <code>snowflake-prod</code> to list its schemas. Check the plugin's credentials, then try again.
    <mm-button slot="action" variant="secondary" icon="refresh">Retry connection</mm-button>
  </mm-empty-state>`,
};

export const Compact: Story = {
  name: 'Compact, inside a panel',
  render: () => html`<section
    aria-labelledby="runs-h"
    style="max-width:420px;background:var(--mm-surface);border:1px solid var(--mm-rule);border-radius:var(--radius-md)"
  >
    <h3 id="runs-h" style="margin:0;padding:12px var(--space-4);font:var(--text-panel-title);border-bottom:1px solid var(--mm-rule)">Pipelines</h3>
    <mm-empty-state compact level="4" heading="No pipelines yet" description="Pipelines run plugins on a schedule. Add one to start cataloguing." seed="5">
      <mm-button slot="action" size="sm" variant="secondary" icon="add">Add pipeline</mm-button>
    </mm-empty-state>
  </section>`,
};

export const NoAction: Story = {
  name: 'Without an action',
  args: { heading: 'No runs yet', description: 'This pipeline has not run. Runs appear here after the first schedule at 04:00 UTC.', action: '' },
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:320px;border:1px dashed var(--mm-rule)">
    <mm-empty-state heading="No columns in shop_analytics_reporting_orders_daily_rollup" seed="9">
      mrn://postgresql/table/shop.public.orders_daily_rollup_by_region_and_channel has no columns Marmot can read with the current grants.
      <mm-button slot="action" variant="secondary">Check grants</mm-button>
    </mm-empty-state>
  </div>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { heading: 'غير مُمسوح', description: 'لم تتم فهرسة أي أصول من هذا المصدر بعد. اربط إضافة لرسم خريطته.', action: 'إضافة إضافة' },
};

export const BothThemes: Story = {
  render: () => themes(html`<mm-empty-state heading="No assets yet" description="No assets have been catalogued from this source yet. Add a plugin to catalogue it.">
    <mm-button slot="action" variant="primary" icon="add">Add plugin</mm-button>
  </mm-empty-state>`),
};
