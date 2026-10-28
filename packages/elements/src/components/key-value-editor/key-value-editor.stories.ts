import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { click } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/key-value-editor.js';
import { parsePairs, pairsToObject, type MmKeyValueEditor } from '@marmotdata/elements/key-value-editor.js';

const pairs = [
  { key: 'cadence', value: 'Weekly, Mondays' },
  { key: 'contact.slack', value: '#finance-data' },
  { key: 'sheet_tab', value: 'Q4 forecast' },
];

const meta: Meta = {
  title: 'Components/Forms/Key value editor',
  component: 'mm-key-value-editor',
  render: () => html`<div style="max-width:40rem"><mm-key-value-editor label="Metadata" json .value=${pairs}></mm-key-value-editor></div>`,
  parameters: {
    usage: {
      html: `<mm-key-value-editor label="Metadata" json></mm-key-value-editor>`,
      react: `import { MmKeyValueEditor } from '@marmotdata/react';

<MmKeyValueEditor label="Metadata" json value={pairs} onMmChange={(e) => setPairs(e.detail.value)} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/key-value-editor.js';
</script>

<mm-key-value-editor label="Metadata" json value={pairs} onmm-change={(e) => (pairs = e.detail.value)}></mm-key-value-editor>`,
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Empty: Story = { render: () => html`<div style="max-width:40rem"><mm-key-value-editor label="Metadata" json></mm-key-value-editor></div>` };
export const Schema: Story = {
  name: 'Schema columns',
  render: () => html`<div style="max-width:40rem"><mm-key-value-editor label="Schema" key-label="Column" value-label="Type" add-label="Add column" .value=${[{ key: 'category', value: 'string' }, { key: 'forecast_gbp', value: 'decimal' }]}></mm-key-value-editor></div>`,
};
export const RightToLeft: Story = { parameters: { dir: 'rtl' } };
export const BothThemes: Story = { render: () => themes(html`<mm-key-value-editor label="Metadata" json .value=${pairs}></mm-key-value-editor>`) };

export const PasteSplits: Story = {
  name: 'Pasted lines become rows',
  play: async () => {
    await expect(parsePairs('cadence: weekly\nowner = finance\nregion\tEU')).toEqual([
      { key: 'cadence', value: 'weekly' },
      { key: 'owner', value: 'finance' },
      { key: 'region', value: 'EU' },
    ]);
    await expect(pairsToObject(pairs)).toEqual({ cadence: 'Weekly, Mondays', contact: { slack: '#finance-data' }, sheet_tab: 'Q4 forecast' });
  },
};

export const AddRow: Story = {
  name: 'Add field focuses the new key',
  play: async ({ canvasElement }) => {
    const ed = canvasElement.querySelector<MmKeyValueEditor>('mm-key-value-editor')!;
    await ed.updateComplete;
    await click(ed.shadowRoot!.querySelector<HTMLElement>('.add')!.shadowRoot!.querySelector('button')!);
    await waitFor(() => expect(ed.shadowRoot!.querySelectorAll('.row').length).toBe(4));
  },
};
