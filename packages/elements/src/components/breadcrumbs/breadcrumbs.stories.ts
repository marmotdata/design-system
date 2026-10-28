import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, waitFor } from 'storybook/test';
import { deepActive, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/breadcrumbs.js';
import type { MmBreadcrumb, MmBreadcrumbs } from './class.ts';
import type { MmMenuButton } from '../menu-button/class.ts';
import type { MmMenuItem } from '../menu/class.ts';

type Args = { max: number };

const assetPath = (a: Partial<Args>) => html`<mm-breadcrumbs max=${a.max ?? 4}>
  <mm-breadcrumb href="#/discover?provider=postgresql">postgresql</mm-breadcrumb>
  <mm-breadcrumb href="#/discover?db=shop">shop</mm-breadcrumb>
  <mm-breadcrumb href="#/discover?schema=public">public</mm-breadcrumb>
  <mm-breadcrumb>orders</mm-breadcrumb>
</mm-breadcrumbs>`;

const deepPath = (a: Partial<Args>) => html`<mm-breadcrumbs max=${a.max ?? 4}>
  <mm-breadcrumb href="#/settings" icon="settings">Settings</mm-breadcrumb>
  <mm-breadcrumb href="#/settings/access">Access</mm-breadcrumb>
  <mm-breadcrumb href="#/settings/teams">Teams</mm-breadcrumb>
  <mm-breadcrumb href="#/settings/teams/analytics-engineering">Analytics Engineering</mm-breadcrumb>
  <mm-breadcrumb href="#/settings/teams/analytics-engineering/webhooks">Webhooks</mm-breadcrumb>
  <mm-breadcrumb>Failed run alerts</mm-breadcrumb>
</mm-breadcrumbs>`;

const meta: Meta<Args> = {
  title: 'Components/Navigation/Breadcrumbs',
  component: 'mm-breadcrumbs',
  subcomponents: { Breadcrumb: 'mm-breadcrumb' } as never,
  args: { max: 4 },
  render: (a) => html`<div style="min-height:200px">${assetPath(a)}</div>`,
  parameters: {
    usage: {
      html: `<mm-breadcrumbs>
  <mm-breadcrumb href="/discover?provider=postgresql">postgresql</mm-breadcrumb>
  <mm-breadcrumb href="/discover?db=shop">shop</mm-breadcrumb>
  <mm-breadcrumb href="/discover?schema=public">public</mm-breadcrumb>
  <mm-breadcrumb>orders</mm-breadcrumb>
</mm-breadcrumbs>`,
      react: `import { MmBreadcrumbs, MmBreadcrumb } from '@marmotdata/react';

<MmBreadcrumbs>
  {path.map((p, i) => <MmBreadcrumb key={p.href} href={i < path.length - 1 ? p.href : undefined}>{p.name}</MmBreadcrumb>)}
</MmBreadcrumbs>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/breadcrumbs.js';
</script>

<mm-breadcrumbs>
  {#each data.path as p}
    <mm-breadcrumb href={p.href}>{p.name}</mm-breadcrumb>
  {/each}
</mm-breadcrumbs>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (root: HTMLElement) => {
  const bc = root.querySelector('mm-breadcrumbs') as MmBreadcrumbs;
  const crumbs = [...root.querySelectorAll<MmBreadcrumb>('mm-breadcrumb')];
  const link = (c: MmBreadcrumb) => c.shadowRoot!.querySelector<HTMLElement>('.crumb')!;
  const more = () => bc.shadowRoot!.querySelector('mm-menu-button') as MmMenuButton | null;
  const moreButton = () => more()?.shadowRoot!.querySelector('mm-button')!.shadowRoot!.querySelector('button') ?? null;
  return { bc, crumbs, link, more, moreButton };
};

export const AssetPath: Story = {
  name: 'Asset path',
  play: async ({ canvasElement }) => {
    const { bc, crumbs, link } = parts(canvasElement);
    await expect(bc.shadowRoot!.querySelector('nav')).toHaveAttribute('aria-label', 'Breadcrumbs');
    await expect(bc.shadowRoot!.querySelector('ol')).toBeTruthy();
    const last = crumbs.at(-1)!;
    await waitFor(() => expect(last.last).toBe(true));
    await waitFor(() => expect(link(last)).toHaveAttribute('aria-current', 'page'));
    await expect(link(last).tagName).toBe('SPAN');
    await expect(link(crumbs[0]!).tagName).toBe('A');
    await expect(crumbs[0]!.shadowRoot!.querySelector('.sep')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const PagePath: Story = {
  name: 'Page path',
  render: () => html`<mm-breadcrumbs>
    <mm-breadcrumb href="#/glossary">Glossary</mm-breadcrumb>
    <mm-breadcrumb href="#/glossary/finance">Finance</mm-breadcrumb>
    <mm-breadcrumb>Gross merchandise value</mm-breadcrumb>
  </mm-breadcrumbs>`,
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = {
  play: async ({ canvasElement }) => {
    const { crumbs, link } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(link(crumbs[0]!));
    await tab();
    await expect(deepActive()).toBe(link(crumbs[1]!));
  },
};

export const Collapsed: Story = {
  name: 'More than four collapse into a menu',
  render: (a) => html`<div style="min-height:260px">${deepPath(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { bc, crumbs, more } = parts(canvasElement);
    await waitFor(() => expect(more()).toBeTruthy());
    await expect(bc.overflowed.map((c) => c.text)).toEqual(['Access', 'Teams', 'Analytics Engineering']);
    // Overflowed crumbs are not rendered at all.
    await expect(crumbs[1]!.assignedSlot).toBeNull();
    await expect(crumbs[0]!.assignedSlot).not.toBeNull();
    await expect(crumbs.at(-1)!.assignedSlot).not.toBeNull();
  },
};

export const OverflowMenuKeyboard: Story = {
  name: 'Keyboard: the overflow menu opens and follows a hidden level',
  render: (a) => html`<div style="min-height:260px">${deepPath(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { more, moreButton, crumbs, link } = parts(canvasElement);
    await waitFor(() => expect(moreButton()).toBeTruthy());
    await tab();
    await expect(deepActive()).toBe(link(crumbs[0]!));
    await tab();
    await expect(deepActive()).toBe(moreButton());
    await expect(moreButton()).toHaveAttribute('aria-label', 'Show 3 more levels');
    await press('{Enter}');
    const menu = more()!.menu!;
    await waitFor(() => expect(menu.open).toBe(true));
    const items = [...menu.querySelectorAll<MmMenuItem>('mm-menu-item')];
    await expect(items.map((i) => i.text)).toEqual(['Access', 'Teams', 'Analytics Engineering']);
    await expect(deepActive()).toBe(items[0]);
    await press('{ArrowDown}');
    await expect(deepActive()).toBe(items[1]);
    // Activating a hidden level follows its link.
    let followed = '';
    const a = link(crumbs[2]!) as HTMLAnchorElement;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      followed = a.getAttribute('href') ?? '';
    }, { once: true });
    await press('{Enter}');
    await expect(followed).toBe('#/settings/teams');
    await waitFor(() => expect(menu.open).toBe(false));
    await expect(deepActive()).toBe(moreButton());
    await press('{Escape}');
  },
};

export const OverflowMenuEscape: Story = {
  name: 'Keyboard: Escape closes the overflow menu',
  render: (a) => html`<div style="min-height:260px">${deepPath(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { more, moreButton } = parts(canvasElement);
    await waitFor(() => expect(moreButton()).toBeTruthy());
    moreButton()!.focus();
    await press('{ArrowDown}');
    await waitFor(() => expect(more()!.menu!.open).toBe(true));
    await press('{Escape}');
    await waitFor(() => expect(more()!.menu!.open).toBe(false));
    await expect(deepActive()).toBe(moreButton());
  },
};

export const OutOfSpace: Story = {
  name: 'Collapses when space runs out',
  render: (a) => html`<div style="width:220px;min-height:200px">${assetPath(a)}</div>`,
  play: async ({ canvasElement }) => {
    const { more, bc } = parts(canvasElement);
    await waitFor(() => expect(more()).toBeTruthy());
    await expect(bc.overflowed.length).toBeGreaterThan(0);
  },
};

export const LongIdentifiers: Story = {
  name: 'Long identifiers',
  render: () => html`<div style="width:640px;min-height:200px">
    <mm-breadcrumbs>
      <mm-breadcrumb href="#/discover?provider=snowflake">snowflake</mm-breadcrumb>
      <mm-breadcrumb href="#/discover?db=analytics_prod">analytics_prod</mm-breadcrumb>
      <mm-breadcrumb href="#/discover?schema=finance_reporting">finance_reporting</mm-breadcrumb>
      <mm-breadcrumb>payments_reconciliation_by_region_and_currency_daily_snapshot</mm-breadcrumb>
    </mm-breadcrumbs>
  </div>`,
};

export const RightToLeft: Story = { parameters: { dir: 'rtl' }, render: (a) => html`<div style="min-height:260px">${deepPath(a)}</div>` };

export const BothThemes: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  render: () => themes(html`<div style="display:grid;gap:var(--space-3)">${assetPath({})}</div>`),
};
