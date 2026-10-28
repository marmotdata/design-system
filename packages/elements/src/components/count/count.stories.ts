import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect } from 'storybook/test';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/count.js';
import '@marmotdata/icons/define.js';

type Args = { value: number; max: number | undefined; compact: boolean; tone: string; label: string };

const shown = (el: Element) => el.shadowRoot!.querySelector('[part="count"]')?.textContent ?? '';

/* Stand-ins for the tab and filter pill elements, built here only to show the count in context. */
const tab = (label: string, n: number, selected = false) =>
  html`<span style="display:inline-flex;align-items:center;gap:6px;padding:10px 2px;font:var(--text-button);color:${selected ? 'var(--mm-text)' : 'var(--mm-text-2)'};${selected ? 'box-shadow:inset 0 -2px var(--mm-primary)' : ''}">${label} <mm-count .value=${n}></mm-count></span>`;
const pill = (label: string, n: number, selected = false) =>
  html`<span style="display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:var(--radius-full);border:1px solid ${selected ? 'var(--mm-text)' : 'var(--mm-rule)'};background:${selected ? 'var(--mm-text)' : 'var(--mm-surface)'};color:${selected ? 'var(--mm-on-inverse)' : 'var(--mm-text)'};font:var(--text-label)">${label} <mm-count .value=${n} tone=${selected ? 'inverse' : 'default'}></mm-count></span>`;

const inContext = html`<div style="display:grid;gap:var(--space-5)">
  <div style="display:flex;gap:var(--space-5);border-bottom:1px solid var(--mm-rule)">
    ${tab('Schema', 14, true)}${tab('Lineage', 6)}${tab('Run history', 128)}
  </div>
  <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
    ${pill('Tables', 412, true)}${pill('Topics', 38)}${pill('Dashboards', 1284)}
  </div>
  <span style="display:inline-flex;align-items:center;gap:var(--space-1);font:var(--text-dense)">
    <mm-icon name="notifications" label="Notifications"></mm-icon>
    <mm-count .value=${12} label="12 unread notifications"></mm-count>
  </span>
</div>`;

const meta: Meta<Args> = {
  title: 'Components/Foundations/Count',
  component: 'mm-count',
  args: { value: 128, max: undefined, compact: false, tone: 'default', label: '' },
  argTypes: { tone: { control: 'inline-radio', options: ['default', 'inverse'] } },
  render: (a) => html`<mm-count .value=${a.value} .max=${a.max} ?compact=${a.compact} tone=${a.tone} label=${a.label}></mm-count>`,
  parameters: {
    usage: {
      html: `<mm-count value="14"></mm-count>
<mm-count value="1284019" compact></mm-count>
<mm-count value="140" max="99" label="140 unread notifications"></mm-count>`,
      react: `import { MmCount } from '@marmotdata/react';

<MmCount value={14} />
<MmCount value={unread} max={99} label={\`\${unread} unread notifications\`} />`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/count.js';
</script>

<mm-count value={14}></mm-count>
<mm-count value={unread} max={99} label={\`\${unread} unread notifications\`}></mm-count>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(shown(canvasElement.querySelector('mm-count')!)).toBe('128');
  },
};

export const Grouped: Story = {
  name: 'Thousands separators',
  args: { value: 1284019 },
  play: async ({ canvasElement }) => {
    await expect(shown(canvasElement.querySelector('mm-count')!)).toBe('1,284,019');
  },
};

export const Compact: Story = {
  args: { value: 1284019, compact: true },
  play: async ({ canvasElement }) => {
    await expect(shown(canvasElement.querySelector('mm-count')!)).toBe('1.28M');
  },
};

export const OverMax: Story = {
  name: 'Over the maximum',
  args: { value: 140, max: 99, label: '140 unread notifications' },
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector('mm-count')!;
    await expect(shown(el)).toBe('99+');
    await expect(el.shadowRoot!.querySelector('.visually-hidden')!.textContent).toBe('140 unread notifications');
    await expect(el.shadowRoot!.querySelector('[part="count"]')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const Zero: Story = { args: { value: 0 } };

export const Empty: Story = {
  name: 'Empty (no value)',
  render: () => html`<mm-count></mm-count>`,
  play: async ({ canvasElement }) => {
    await expect(shown(canvasElement.querySelector('mm-count')!)).toBe('');
  },
};

export const InContext: Story = { name: 'In tabs, filter pills and a badge', render: () => inContext };

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: () => inContext };

export const BothThemes: Story = { render: () => themes(inContext) };
