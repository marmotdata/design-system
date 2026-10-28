import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/button-group.js';
import '@marmotdata/elements/button.js';
import '@marmotdata/elements/menu-button.js';

type Args = { label: string; orientation: string; attached: boolean };

const zoom = () => html`
  <mm-button variant="secondary" icon="zoom-out" label="Zoom out"></mm-button>
  <mm-button variant="secondary" icon="fit-screen" label="Fit to view"></mm-button>
  <mm-button variant="secondary" icon="zoom-in" label="Zoom in"></mm-button>
`;

const meta: Meta<Args> = {
  title: 'Components/Actions/Button group',
  component: 'mm-button-group',
  args: { label: 'Zoom', orientation: 'horizontal', attached: true },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
  render: (a) => html`<mm-button-group label=${a.label} orientation=${a.orientation} ?attached=${a.attached}>${zoom()}</mm-button-group>`,
  parameters: {
    usage: {
      html: `<mm-button-group label="Zoom" attached>
  <mm-button variant="secondary" icon="zoom-out" label="Zoom out"></mm-button>
  <mm-button variant="secondary" icon="fit-screen" label="Fit to view"></mm-button>
  <mm-button variant="secondary" icon="zoom-in" label="Zoom in"></mm-button>
</mm-button-group>`,
      react: `import { MmButtonGroup, MmButton } from '@marmotdata/react';

<MmButtonGroup label="Zoom" attached>
  <MmButton variant="secondary" icon="zoom-out" label="Zoom out" onClick={zoomOut} />
  <MmButton variant="secondary" icon="fit-screen" label="Fit to view" onClick={fit} />
  <MmButton variant="secondary" icon="zoom-in" label="Zoom in" onClick={zoomIn} />
</MmButtonGroup>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/button-group.js';
  import '@marmotdata/elements/button.js';
</script>

<mm-button-group label="Zoom" attached>
  <mm-button variant="secondary" icon="zoom-out" label="Zoom out" onclick={zoomOut}></mm-button>
  <mm-button variant="secondary" icon="fit-screen" label="Fit to view" onclick={fit}></mm-button>
  <mm-button variant="secondary" icon="zoom-in" label="Zoom in" onclick={zoomIn}></mm-button>
</mm-button-group>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const onClick = fn();
const inner = (el: Element) => el.shadowRoot!.querySelector('button')!;

export const Attached: Story = {
  play: async ({ canvasElement }) => {
    const group = canvasElement.querySelector('mm-button-group')!;
    await expect(group).toHaveAttribute('role', 'group');
    await expect(group).toHaveAttribute('aria-label', 'Zoom');
    const [first, middle] = [...group.querySelectorAll('mm-button')].map(inner);
    await expect(getComputedStyle(first!).borderStartEndRadius).toBe('0px');
    await expect(getComputedStyle(first!).borderStartStartRadius).not.toBe('0px');
    await expect(getComputedStyle(middle!).borderStartStartRadius).toBe('0px');
  },
};

export const Spaced: Story = {
  args: { label: 'Asset actions', attached: false },
  render: (a) => html`<mm-button-group label=${a.label}>
    <mm-button variant="secondary" icon="notifications">Subscribe</mm-button>
    <mm-button variant="secondary" icon="account-tree">View lineage</mm-button>
    <mm-menu-button variant="secondary" icon="more-horiz" label="More actions" icon-only>
      <mm-menu><mm-menu-item icon="content-copy">Copy MRN</mm-menu-item></mm-menu>
    </mm-menu-button>
  </mm-button-group>`,
};

export const AttachedText: Story = {
  name: 'Attached with text',
  args: { label: 'Lineage direction' },
  render: (a) => html`<mm-button-group label=${a.label} attached>
    <mm-button variant="secondary" icon="arrow-back">Upstream</mm-button>
    <mm-button variant="secondary" icon="compare-arrows">Both</mm-button>
    <mm-button variant="secondary" icon="arrow-forward">Downstream</mm-button>
  </mm-button-group>`,
};

export const Vertical: Story = { args: { orientation: 'vertical' } };

export const KeyboardTabOrder: Story = {
  name: 'Keyboard: every button is a tab stop',
  render: (a) => html`<mm-button-group label=${a.label} attached @click=${(e: Event) => onClick((e.target as HTMLElement).getAttribute('label'))}>${zoom()}</mm-button-group>`,
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    const buttons = [...canvasElement.querySelectorAll('mm-button')];
    await tab();
    await expect(deepActive()).toBe(inner(buttons[0]!));
    await tab();
    await expect(deepActive()).toBe(inner(buttons[1]!));
    await press('{Enter}');
    await tab();
    await press('{Space}');
    await expect(deepActive()).toBe(inner(buttons[2]!));
    await tab(true);
    await expect(deepActive()).toBe(inner(buttons[1]!));
    await expect(onClick).toHaveBeenNthCalledWith(1, 'Fit to view');
    await expect(onClick).toHaveBeenNthCalledWith(2, 'Zoom in');
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await tab();
    await expect(deepActive()).toBe(inner(canvasElement.querySelectorAll('mm-button')[1]!));
  },
};
export const Disabled: Story = {
  render: (a) => html`<mm-button-group label=${a.label} attached>
    <mm-button variant="secondary" icon="zoom-out" label="Zoom out" disabled></mm-button>
    <mm-button variant="secondary" icon="fit-screen" label="Fit to view"></mm-button>
    <mm-button variant="secondary" icon="zoom-in" label="Zoom in"></mm-button>
  </mm-button-group>`,
};
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:320px">
    <mm-button-group label="Open in">
      <mm-button variant="secondary" icon="terminal">Open in Query</mm-button>
      <mm-button variant="secondary" icon="account-tree">View lineage</mm-button>
      <mm-button variant="secondary" icon="history">Run history</mm-button>
    </mm-button-group>
    <p style="font:var(--text-caption);color:var(--mm-text-2)">Spaced groups wrap onto a new line; attached groups never wrap.</p>
  </div>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  render: () => html`<mm-button-group label="اتجاه النسب" attached>
    <mm-button variant="secondary" icon="arrow-forward">المصدر</mm-button>
    <mm-button variant="secondary" icon="compare-arrows">كلاهما</mm-button>
    <mm-button variant="secondary" icon="arrow-back">الوجهة</mm-button>
  </mm-button-group>`,
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:grid;gap:var(--space-3);justify-items:start">
      <mm-button-group label="Zoom" attached>${zoom()}</mm-button-group>
      <mm-button-group label="Lineage direction" attached>
        <mm-button variant="secondary">Upstream</mm-button><mm-button variant="secondary">Both</mm-button><mm-button variant="secondary">Downstream</mm-button>
      </mm-button-group>
    </div>`),
};
