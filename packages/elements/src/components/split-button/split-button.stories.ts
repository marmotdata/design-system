import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/split-button.js';
import type { MmSplitButton } from './class.ts';
import type { MmMenu, MmMenuItem } from '../menu/class.ts';

type Args = { variant: string; size: string; label: string; icon: string; menuLabel: string; disabled: boolean; loading: boolean };

const runMenu = () => html`<mm-menu>
  <mm-menu-item icon="download" value="run-export" shortcut="mod+shift+enter">Run and export CSV</mm-menu-item>
  <mm-menu-item icon="account-tree" value="explain">Explain query</mm-menu-item>
</mm-menu>`;

const meta: Meta<Args> = {
  title: 'Components/Actions/Split button',
  component: 'mm-split-button',
  args: { variant: 'primary', size: 'md', label: 'Run query', icon: 'play-arrow', menuLabel: 'More run options', disabled: false, loading: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (a) => html`<div style="min-height:160px">
    <mm-split-button variant=${a.variant} size=${a.size} label=${a.label} icon=${a.icon} menu-label=${a.menuLabel}
      ?disabled=${a.disabled} ?loading=${a.loading}
      @mm-action=${() => onAction()} @mm-select=${(e: CustomEvent) => onSelect(e.detail.value)}>${runMenu()}</mm-split-button>
  </div>`,
  parameters: {
    usage: {
      html: `<mm-split-button label="Run query" icon="play-arrow" menu-label="More run options">
  <mm-menu>
    <mm-menu-item icon="download" value="run-export">Run and export CSV</mm-menu-item>
    <mm-menu-item icon="account-tree" value="explain">Explain query</mm-menu-item>
  </mm-menu>
</mm-split-button>`,
      react: `import { MmSplitButton, MmMenu, MmMenuItem } from '@marmotdata/react';

<MmSplitButton label="Run query" icon="play-arrow" menuLabel="More run options" onMmAction={run}>
  <MmMenu onMmSelect={(e) => runWith(e.detail.value)}>
    <MmMenuItem icon="download" value="run-export">Run and export CSV</MmMenuItem>
    <MmMenuItem icon="account-tree" value="explain">Explain query</MmMenuItem>
  </MmMenu>
</MmSplitButton>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/split-button.js';
</script>

<mm-split-button label="Run query" icon="play-arrow" menu-label="More run options" onmm-action={run}>
  <mm-menu onmm-select={(e) => runWith(e.detail.value)}>
    <mm-menu-item icon="download" value="run-export">Run and export CSV</mm-menu-item>
    <mm-menu-item icon="account-tree" value="explain">Explain query</mm-menu-item>
  </mm-menu>
</mm-split-button>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const onAction = fn();
const onSelect = fn();
const parts = (el: HTMLElement) => {
  const sb = el.querySelector('mm-split-button') as MmSplitButton;
  const action = sb.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
  const toggle = sb.toggle!.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button')!;
  const menu = el.querySelector('mm-menu') as MmMenu;
  const items = [...el.querySelectorAll<MmMenuItem>('mm-menu-item')];
  return { sb, action, toggle, menu, items };
};

export const Primary: Story = {
  play: async ({ canvasElement }) => {
    const { sb, toggle } = parts(canvasElement);
    await expect(sb.shadowRoot!.querySelector('[role="group"]')).toHaveAttribute('aria-label', 'Run query');
    await expect(toggle).toHaveAttribute('aria-label', 'More run options');
    await expect(toggle).toHaveAttribute('aria-haspopup', 'menu');
  },
};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Small: Story = { args: { size: 'sm', variant: 'secondary' } };

export const KeyboardModel: Story = {
  name: 'Keyboard: two tab stops, chevron opens the menu',
  play: async ({ canvasElement }) => {
    onAction.mockClear();
    onSelect.mockClear();
    const { action, toggle, menu, items } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(action);
    await press('{Enter}');
    await press('{Space}');
    await expect(onAction).toHaveBeenCalledTimes(2);
    await tab();
    await expect(deepActive()).toBe(toggle);
    await press('{ArrowDown}');
    await waitFor(() => expect(menu.open).toBe(true));
    await expect(deepActive()).toBe(items[0]);
    await press('{End}');
    await expect(deepActive()).toBe(items[1]);
    await press('{Escape}');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(deepActive()).toBe(toggle);
    await press('{ArrowUp}');
    await waitFor(() => expect(menu.open).toBe(true));
    await expect(deepActive()).toBe(items[1]);
    await press('{Enter}');
    await expect(onSelect).toHaveBeenCalledWith('explain');
    await expect(onAction).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(menu.open).toBe(false));
  },
};

export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { toggle, menu } = parts(canvasElement);
    await click(toggle);
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
  },
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await tab();
    await tab();
    await expect(deepActive()).toBe(parts(canvasElement).toggle);
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    onAction.mockClear();
    const { action } = parts(canvasElement);
    // Playwright refuses to click aria-disabled controls, so dispatch the click directly.
    action.click();
    await expect(onAction).not.toHaveBeenCalled();
  },
};
export const Loading: Story = { args: { loading: true, label: 'Running query' } };
export const Overflowing: Story = {
  name: 'Overflowing content',
  render: () => html`<div style="width:260px;min-height:160px">
    <mm-split-button variant="secondary" label="Run against analytics.marts.customers_dim" icon="play-arrow" menu-label="More run options">${runMenu()}</mm-split-button>
  </div>`,
};
export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { label: 'تشغيل الاستعلام', menuLabel: 'خيارات تشغيل أخرى' },
};
export const BothThemes: Story = {
  render: () =>
    themes(html`<div style="display:flex;gap:var(--space-3);flex-wrap:wrap">
      <mm-split-button label="Run query" icon="play-arrow" menu-label="More run options">${runMenu()}</mm-split-button>
      <mm-split-button variant="secondary" label="Run query" icon="play-arrow" menu-label="More run options">${runMenu()}</mm-split-button>
    </div>`),
};
