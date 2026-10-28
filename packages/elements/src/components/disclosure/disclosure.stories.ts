import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/disclosure.js';
import '@marmotdata/elements/text.js';
import '@marmotdata/elements/description-list.js';

type Args = { summary: string; open: boolean; disabled: boolean; headingLevel: number };

const trigger = (d: Element) => d.shadowRoot!.querySelector('button')!;

const accordion = (single = false) => html`<mm-accordion ?single=${single} style="max-width:560px">
  <mm-disclosure summary="Connection">
    <mm-description-list>
      <mm-description term="Host" mono>orders-db.internal:5432</mm-description>
      <mm-description term="Database" mono>shop</mm-description>
      <mm-description term="SSL mode" mono>verify-full</mm-description>
    </mm-description-list>
  </mm-disclosure>
  <mm-disclosure summary="Schedule">
    <mm-text block variant="dense">Runs every hour at 12 minutes past. The last run took 4 min 12 s.</mm-text>
  </mm-disclosure>
  <mm-disclosure summary="Filters">
    <mm-text block variant="dense">Include schemas matching <mm-text variant="mono-dense">public</mm-text> and <mm-text variant="mono-dense">reporting</mm-text>; exclude tables ending in <mm-text variant="mono-dense">_tmp</mm-text>.</mm-text>
  </mm-disclosure>
</mm-accordion>`;

const meta: Meta<Args> = {
  title: 'Components/Layout/Disclosure',
  component: 'mm-disclosure',
  args: { summary: 'Show raw run payload', open: false, disabled: false, headingLevel: 0 },
  render: (a) => html`<mm-disclosure summary=${a.summary} ?open=${a.open} ?disabled=${a.disabled} heading-level=${a.headingLevel} style="max-width:560px">
    <mm-text block variant="mono-dense">{"run_id": "run_8121", "pipeline": "postgres-shop", "rows": 1284019, "status": "succeeded"}</mm-text>
  </mm-disclosure>`,
  parameters: {
    usage: {
      html: `<mm-disclosure summary="Advanced settings">…</mm-disclosure>

<mm-accordion single>
  <mm-disclosure summary="Connection" heading-level="3">…</mm-disclosure>
  <mm-disclosure summary="Schedule" heading-level="3">…</mm-disclosure>
</mm-accordion>`,
      react: `import { MmAccordion, MmDisclosure } from '@marmotdata/react';

<MmAccordion single>
  <MmDisclosure summary="Connection" headingLevel={3} onMmToggle={(e) => track(e.detail.open)}>…</MmDisclosure>
  <MmDisclosure summary="Schedule" headingLevel={3}>…</MmDisclosure>
</MmAccordion>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/disclosure.js';
  let open = $state(false);
</script>

<mm-disclosure summary="Advanced settings" {open} onmm-toggle={(e) => (open = e.detail.open)}>…</mm-disclosure>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {};
export const Open: Story = { args: { open: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(trigger(canvasElement.querySelector('mm-disclosure')!));
  },
};

const onToggle = fn();
export const KeyboardToggle: Story = {
  name: 'Keyboard: Enter and Space toggle',
  render: (a) => html`<mm-disclosure summary=${a.summary} @mm-toggle=${(e: CustomEvent) => onToggle(e.detail.open)}>
    <mm-text block variant="dense">The payload is shown as it was received from the plugin.</mm-text>
  </mm-disclosure>`,
  play: async ({ canvasElement }) => {
    onToggle.mockClear();
    const d = canvasElement.querySelector('mm-disclosure')!;
    const btn = trigger(d);
    const region = d.shadowRoot!.querySelector('[part="content"]')!;
    await expect(btn).toHaveAttribute('aria-controls', region.id);
    await tab();
    await press('{Enter}');
    await expect(d.open).toBe(true);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(region).not.toHaveAttribute('hidden');
    await press('{Space}');
    await expect(d.open).toBe(false);
    await expect(region).toHaveAttribute('hidden');
    await expect(onToggle.mock.calls).toEqual([[true], [false]]);
  },
};

export const Accordion: Story = {
  render: () => accordion(),
  play: async ({ canvasElement }) => {
    const items = Array.from(canvasElement.querySelectorAll('mm-disclosure'));
    // The accordion gives headers a real heading level and makes the content a labelled region.
    await expect(trigger(items[0]!).parentElement!.localName).toBe('h3');
    await expect(items[0]!.shadowRoot!.querySelector('[part="content"]')).toHaveAttribute('role', 'region');
  },
};

export const AccordionKeyboard: Story = {
  name: 'Keyboard: accordion arrows, Home and End',
  render: () => accordion(),
  play: async ({ canvasElement }) => {
    const [a, b, c] = Array.from(canvasElement.querySelectorAll('mm-disclosure')).map(trigger);
    await tab();
    await expect(deepActive()).toBe(a);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(b);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(c);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(a);
    await press('{ArrowUp}');
    await expect(deepActive()).toBe(c);
    await press('{Home}');
    await expect(deepActive()).toBe(a);
    await press('{End}');
    await expect(deepActive()).toBe(c);
  },
};

export const SingleOpen: Story = {
  name: 'Accordion: one open at a time',
  render: () => accordion(true),
  play: async ({ canvasElement }) => {
    const items = Array.from(canvasElement.querySelectorAll('mm-disclosure'));
    await tab();
    await press('{Enter}');
    await expect(items[0]!.open).toBe(true);
    await press('{ArrowDown}');
    await press('{Enter}');
    await expect(items[1]!.open).toBe(true);
    await expect(items[0]!.open).toBe(false);
  },
};

export const Loading: Story = {
  render: () => html`<mm-disclosure summary="Run logs" open style="max-width:560px">
    <mm-text block variant="dense" tone="secondary" aria-busy="true">Loading the last 200 log lines…</mm-text>
  </mm-disclosure>`,
};

export const Empty: Story = {
  render: () => html`<mm-disclosure summary="Column descriptions" open style="max-width:560px">
    <mm-text block variant="dense" tone="secondary">No column has a description yet. Add one from the schema tab.</mm-text>
  </mm-disclosure>`,
};

export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<mm-disclosure open style="max-width:320px" summary="Why orders_daily_by_customer_region_rollup_v2 was marked stale on 12 Mar 2026">
    <mm-text block variant="dense">The upstream table <mm-text variant="mono-dense">mrn://postgresql/table/shop.public.orders</mm-text> has not refreshed for 3 days.</mm-text>
  </mm-disclosure>`,
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-accordion style="max-width:560px">
    <mm-disclosure summary="الاتصال" open><mm-text block variant="dense">orders-db.internal:5432</mm-text></mm-disclosure>
    <mm-disclosure summary="الجدول الزمني"><mm-text block variant="dense">كل ساعة</mm-text></mm-disclosure>
  </mm-accordion>`,
};

export const CompactDensity: Story = { globals: { density: 'compact' }, render: () => accordion() };

export const BothThemes: Story = { render: () => themes(accordion()) };
