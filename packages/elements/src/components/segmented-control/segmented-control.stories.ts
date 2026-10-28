import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/segmented-control.js';
import type { MmSegmentedControl } from './class.ts';

type Args = { label: string; hideLabel: boolean; value: string; disabled: boolean; help: string; error: string };

const ranges = html`<mm-segment value="24h">24h</mm-segment><mm-segment value="7d">7d</mm-segment><mm-segment value="30d">30d</mm-segment
  ><mm-segment value="90d">90d</mm-segment>`;

const meta: Meta<Args> = {
  title: 'Components/Forms/Segmented control',
  component: 'mm-segmented-control',
  args: { label: 'Time range', hideLabel: false, value: '7d', disabled: false, help: '', error: '' },
  render: (a) => html`<mm-segmented-control
    name="range"
    label=${a.label}
    value=${a.value}
    help=${a.help}
    error=${a.error}
    ?hide-label=${a.hideLabel}
    ?disabled=${a.disabled}
    >${ranges}</mm-segmented-control
  >`,
  parameters: {
    usage: {
      html: `<mm-segmented-control name="range" label="Time range" value="7d">
  <mm-segment value="24h">24h</mm-segment>
  <mm-segment value="7d">7d</mm-segment>
  <mm-segment value="30d">30d</mm-segment>
</mm-segmented-control>`,
      react: `import { MmSegmentedControl, MmSegment } from '@marmotdata/react';

<MmSegmentedControl label="View" hideLabel value={view} onMmChange={(e) => setView(e.detail.value)}>
  <MmSegment value="table" icon="table">Table</MmSegment>
  <MmSegment value="list" icon="view-list">List</MmSegment>
</MmSegmentedControl>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/segmented-control.js';
  let range = $state('7d');
</script>

<mm-segmented-control label="Time range" value={range} onmm-change={(e) => (range = e.detail.value)}>
  <mm-segment value="24h">24h</mm-segment>
  <mm-segment value="7d">7d</mm-segment>
  <mm-segment value="30d">30d</mm-segment>
</mm-segmented-control>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const host = (root: HTMLElement) => root.querySelector('mm-segmented-control') as MmSegmentedControl;
const seg = (c: MmSegmentedControl, v: string) => c.querySelector(`mm-segment[value="${v}"]`) as HTMLElement;

export const Default: Story = {};
export const View: Story = {
  name: 'With icons',
  render: () => html`<mm-segmented-control label="View" hide-label value="table">
    <mm-segment value="table" icon="table">Table</mm-segment>
    <mm-segment value="list" icon="view-list">List</mm-segment>
  </mm-segmented-control>`,
};
export const IconOnly: Story = {
  name: 'Icon only',
  render: () => html`<mm-segmented-control label="Asset view" hide-label value="schema">
    <mm-segment value="docs" icon="description" label="Documentation"></mm-segment>
    <mm-segment value="schema" icon="table" label="Schema"></mm-segment>
    <mm-segment value="lineage" icon="account-tree" label="Lineage"></mm-segment>
    <mm-segment value="runs" icon="history" label="Run history"></mm-segment>
  </mm-segmented-control>`,
  play: async ({ canvasElement }) => {
    await expect(seg(host(canvasElement), 'lineage')).toHaveAttribute('aria-label', 'Lineage');
  },
};
/** Text can come from `label` instead of slotted content. */
export const LabelAttribute: Story = {
  name: 'Text from the label attribute',
  render: () => html`<mm-segmented-control label="Theme" value="system">
    <mm-segment value="system" label="System"></mm-segment>
    <mm-segment value="light" label="Light"></mm-segment>
    <mm-segment value="dark" label="Peat"></mm-segment>
  </mm-segmented-control>`,
  play: async ({ canvasElement }) => {
    const seg = canvasElement.querySelector('mm-segment[value="light"]')!;
    await waitFor(() => expect(seg.shadowRoot!.querySelector('slot')!.textContent).toBe('Light'));
    await expect(seg).not.toHaveAttribute('aria-label');
  },
};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await expect(deepActive()).toBe(seg(host(canvasElement), '7d'));
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const DisabledSegment: Story = {
  name: 'Disabled segment',
  render: () => html`<mm-segmented-control label="Time range" value="24h">
    <mm-segment value="24h">24h</mm-segment><mm-segment value="7d">7d</mm-segment
    ><mm-segment value="90d" disabled>90d</mm-segment>
  </mm-segmented-control>`,
};
export const ErrorState: Story = {
  name: 'Error',
  args: { value: '', error: 'Choose a time range for the usage chart.', help: 'Usage is sampled hourly.' },
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:240px">
    <mm-segmented-control label="Time range" value="7d">
      <mm-segment value="24h">Last 24 hours</mm-segment><mm-segment value="7d">Last 7 days</mm-segment
      ><mm-segment value="30d">Last 30 days</mm-segment>
    </mm-segmented-control>
  </div>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-segmented-control label="العرض" value="table">
    <mm-segment value="table" icon="table">جدول</mm-segment><mm-segment value="list" icon="view-list">قائمة</mm-segment
    ><mm-segment value="lineage" icon="account-tree">النسب</mm-segment>
  </mm-segmented-control>`,
  play: async ({ canvasElement }) => {
    const c = host(canvasElement);
    await tab();
    await press('{ArrowLeft}');
    await expect(c.value).toBe('list');
    await press('{ArrowRight}');
    await expect(c.value).toBe('table');
  },
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-4);justify-items:start">
      <mm-segmented-control label="Time range" value="30d">${ranges}</mm-segmented-control>
      <mm-segmented-control label="View" hide-label value="list">
        <mm-segment value="table" icon="table">Table</mm-segment><mm-segment value="list" icon="view-list">List</mm-segment>
      </mm-segmented-control>
      <mm-segmented-control label="Time range" disabled value="24h">${ranges}</mm-segmented-control>
    </div>`),
};

const onChange = fn();
export const KeyboardModel: Story = {
  name: 'Keyboard: arrows select, one tab stop',
  render: () => html`<div style="display:flex;gap:var(--space-2);align-items:end">
    <mm-segmented-control label="Time range" value="7d" @mm-change=${(e: CustomEvent) => onChange(e.detail.value)}>
      <mm-segment value="24h">24h</mm-segment><mm-segment value="7d">7d</mm-segment
      ><mm-segment value="30d" disabled>30d</mm-segment><mm-segment value="90d">90d</mm-segment>
    </mm-segmented-control>
    <button type="button">Apply</button>
  </div>`,
  play: async ({ canvasElement }) => {
    onChange.mockClear();
    const c = host(canvasElement);
    await tab();
    await expect(deepActive()).toBe(seg(c, '7d'));
    await expect(seg(c, '7d')).toHaveAttribute('aria-checked', 'true');
    await press('{ArrowRight}');
    await expect(c.value).toBe('90d'); // 30d is disabled and skipped
    await expect(deepActive()).toBe(seg(c, '90d'));
    await expect(onChange).toHaveBeenLastCalledWith('90d');
    await press('{ArrowRight}');
    await expect(c.value).toBe('24h'); // wraps
    await press('{ArrowUp}');
    await expect(c.value).toBe('90d');
    await press('{ArrowDown}');
    await expect(c.value).toBe('24h');
    await press('{End}');
    await expect(c.value).toBe('90d');
    await press('{Home}');
    await expect(c.value).toBe('24h');
    await expect(seg(c, '24h').tabIndex).toBe(0);
    await expect(seg(c, '90d').tabIndex).toBe(-1);
    // One tab stop: Tab leaves the group.
    await tab();
    await expect(deepActive()).toBe(canvasElement.querySelector('button'));
    await tab(true);
    await expect(deepActive()).toBe(seg(c, '24h'));
    await click(seg(c, '7d'));
    await expect(c.value).toBe('7d');
    seg(c, '30d').click(); // disabled: real pointers cannot click it either
    await expect(c.value).toBe('7d');
  },
};

const onSubmit = fn();
export const FormSubmission: Story = {
  name: 'Form: submit, validate and reset',
  render: () => html`<form
    style="display:grid;gap:var(--space-3);justify-items:start"
    @submit=${(e: SubmitEvent) => {
      e.preventDefault();
      onSubmit(Object.fromEntries(new FormData(e.target as HTMLFormElement)));
    }}
  >
    <mm-segmented-control name="range" label="Time range" value="7d">${ranges}</mm-segmented-control>
    <mm-segmented-control name="view" label="View" required>
      <mm-segment value="table">Table</mm-segment><mm-segment value="list">List</mm-segment>
    </mm-segmented-control>
    <fieldset disabled style="border:0;padding:0;margin:0">
      <mm-segmented-control name="ignored" label="Disabled by its fieldset" value="24h">${ranges}</mm-segmented-control>
    </fieldset>
    <div style="display:flex;gap:var(--space-2)"><button type="submit">Save view</button><button type="reset">Reset</button></div>
  </form>`,
  play: async ({ canvasElement }) => {
    onSubmit.mockClear();
    const form = canvasElement.querySelector('form')!;
    const [range, view, ignored] = [...canvasElement.querySelectorAll('mm-segmented-control')] as MmSegmentedControl[];
    await expect(form.checkValidity()).toBe(false);
    await expect(view!.validity.valueMissing).toBe(true);
    await waitFor(() => expect(seg(ignored!, '24h').tabIndex).toBe(-1));
    view!.focus();
    await press('{Space}');
    await expect(view!.value).toBe('table');
    await press('{ArrowRight}');
    await expect(view!.value).toBe('list');
    range!.focus();
    await press('{ArrowRight}');
    await expect(range!.value).toBe('30d');
    form.requestSubmit();
    await expect(onSubmit).toHaveBeenCalledWith({ range: '30d', view: 'list' });
    form.reset();
    await range!.updateComplete;
    await expect(range!.value).toBe('7d');
    await expect(view!.value).toBe('');
  },
};
