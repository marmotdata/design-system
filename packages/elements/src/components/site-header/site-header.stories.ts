import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { expect, fn, waitFor } from 'storybook/test';
import { click, deepActive, nextFrame, press, tab } from '../../../../../apps/storybook/src/support/keys.ts';
import { themes } from '../../../../../apps/storybook/src/support/themes.ts';
import '@marmotdata/elements/site-header.js';
import '@marmotdata/elements/button.js';
import type { MmSiteHeader, SiteNavItem } from './class.ts';

type Args = { current: string; signedIn: boolean; noCta: boolean };

const onTheme = fn();
const onMenu = fn();
const onNavigate = fn();

/** The header switches to its menu under 880px, so tests of the full row need a desktop-width page. */
const desktop = async () => {
  if (!(globalThis as { __vitest_browser__?: boolean }).__vitest_browser__) return;
  // Resolved from apps/storybook under Vitest; the Storybook UI aliases it to a stub without `page`.
  // @ts-ignore vitest is not a dependency of this package, so its types do not resolve from here.
  const mod = (await import('vitest/browser')) as unknown as { page?: { viewport?(w: number, h: number): Promise<void> } };
  await mod.page?.viewport?.(1280, 800);
  await nextFrame();
  await nextFrame();
};

/** A stand-in for the site's own search, as Docusaurus puts its search button in the slot. */
const search = () => html`<mm-button slot="search" variant="ghost" icon="search" label="Search the docs"></mm-button>`;

const header = (a: Partial<Args>, content: unknown = search()) => html`<mm-site-header
  current=${a.current ?? 'Docs'}
  ?signed-in=${a.signedIn ?? false}
  ?no-cta=${a.noCta ?? false}
  @mm-theme-change=${(e: CustomEvent) => onTheme(e.detail.theme)}
  @mm-menu-toggle=${(e: CustomEvent) => onMenu(e.detail.open)}
  @mm-navigate=${(e: CustomEvent) => {
    // Stories stay on the page: route nowhere, as a single-page app would route itself.
    e.preventDefault();
    onNavigate(e.detail.href);
  }}
  >${content}</mm-site-header
>`;

const page = (content: unknown) => html`<div style="min-height:360px;background:var(--mm-paper)">${content}</div>`;
const narrow = (content: unknown) => html`<div style="width:375px;min-height:520px;background:var(--mm-paper);border:1px solid var(--mm-rule)">${content}</div>`;

const meta: Meta<Args> = {
  title: 'Components/Docs and marketing/Site header',
  component: 'mm-site-header',
  args: { current: 'Docs', signedIn: false, noCta: false },
  render: (a) => page(header(a)),
  parameters: {
    layout: 'fullscreen',
    usage: {
      html: `<mm-site-header current="Plugins"></mm-site-header>`,
      react: `import { MmSiteHeader } from '@marmotdata/react';

<MmSiteHeader
  current="Docs"
  signedIn={signedIn}
  onMmThemeChange={(e) => { e.preventDefault(); setColorMode(e.detail.theme); }}
  onMmMenuToggle={(e) => { e.preventDefault(); mobileSidebar.toggle(); }}
  navExpanded={mobileSidebar.shown}
>
  <div slot="search"><SearchBar /></div>
</MmSiteHeader>`,
      svelte: `<script lang="ts">
  import '@marmotdata/elements/site-header.js';
</script>

<mm-site-header current="Plugins" signed-in={signedIn}></mm-site-header>`,
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

const parts = (root: HTMLElement) => {
  const el = root.querySelector('mm-site-header') as MmSiteHeader;
  const sr = el.shadowRoot!;
  const inner = (sel: string) => (sr.querySelector(sel) as HTMLElement).shadowRoot!.querySelector('a, button') as HTMLElement;
  return {
    el,
    brand: sr.querySelector('.brand') as HTMLAnchorElement,
    links: () => [...sr.querySelectorAll<HTMLAnchorElement>('.nav .link')],
    panelLinks: () => [...sr.querySelectorAll<HTMLAnchorElement>('.panel .link')],
    panel: sr.querySelector('.panel') as HTMLElement,
    menu: sr.querySelector('.menu-button') as HTMLButtonElement,
    github: () => inner('[part="github"]'),
    theme: () => inner('[part="theme"]'),
    signIn: () => inner('[part="sign-in"]'),
    primary: () => inner('[part="primary"]'),
    search: root.querySelector('[slot="search"]') as HTMLElement | null,
    host: (part: string) => sr.querySelector(`[part="${part}"]`) as HTMLElement,
  };
};

const resetTheme = () => {
  document.documentElement.dataset.theme = 'light';
  try {
    localStorage.removeItem('mm-theme');
  } catch {
    /* storage unavailable */
  }
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await desktop();
    const { links, brand, primary, signIn, github, menu, host } = parts(canvasElement);
    await expect(links().map((l) => l.textContent?.trim())).toEqual(['Docs', 'Plugins', 'Pricing', 'Resources', 'Blog', 'Community (opens in a new tab)']);
    await expect(links()[0]).toHaveAttribute('aria-current', 'page');
    await expect(links()[0]).toHaveAttribute('href', 'https://marmotdata.io/docs/introduction');
    await expect(links()[5]).toHaveAttribute('target', '_blank');
    await expect(links()[5]).toHaveAccessibleName('Community (opens in a new tab)');
    await expect(brand).toHaveAccessibleName('Marmot home');
    await expect(signIn()).toHaveAttribute('href', 'https://cloud.marmotdata.io/login');
    await expect(primary()).toHaveAttribute('href', 'https://cloud.marmotdata.io/signup');
    await expect(host('primary')).toHaveTextContent('Start for free');
    await expect(github()).toHaveAccessibleName('Marmot on GitHub (opens in a new tab)');
    await expect(menu.checkVisibility()).toBe(false);
  },
};

export const Current: Story = {
  name: 'Current section',
  args: { current: 'Plugins' },
  play: async ({ canvasElement }) => {
    await desktop();
    const { links, el } = parts(canvasElement);
    await expect(links()[1]).toHaveAttribute('aria-current', 'page');
    await expect(links().filter((l) => l.hasAttribute('aria-current'))).toHaveLength(1);
    // The rule sits on the header's own bottom edge: the active tab rule, flush with the hairline.
    const rule = getComputedStyle(links()[1]!, '::after');
    await expect(rule.blockSize).toBe('2px');
    const bottom = links()[1]!.getBoundingClientRect().bottom - parseFloat(rule.insetBlockEnd);
    await expect(Math.round(bottom)).toBe(Math.round(el.getBoundingClientRect().bottom));
  },
};

export const SignedIn: Story = {
  name: 'Signed in',
  args: { signedIn: true },
  play: async ({ canvasElement }) => {
    await desktop();
    const { el, primary, host } = parts(canvasElement);
    await expect(host('primary')).toHaveTextContent('Open console');
    await expect(primary()).toHaveAttribute('href', 'https://cloud.marmotdata.io/console');
    await expect(el.shadowRoot!.querySelector('[part="sign-in"]')).toBeNull();
  },
};

export const NoCallToAction: Story = {
  name: 'Without the primary action',
  args: { noCta: true },
  play: async ({ canvasElement }) => {
    await desktop();
    const { el } = parts(canvasElement);
    await expect(el.shadowRoot!.querySelector('[part="primary"]')).toBeNull();
  },
};

export const WithoutSearch: Story = {
  name: 'Without search',
  render: (a) => page(header(a, '')),
};

export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Active: Story = { parameters: { pseudo: { active: true } } };

export const Focus: Story = {
  play: async ({ canvasElement }) => {
    await desktop();
    const { brand, links } = parts(canvasElement);
    await tab();
    await expect(deepActive()).toBe(brand);
    await tab();
    await expect(deepActive()).toBe(links()[0]);
  },
};

export const KeyboardOrder: Story = {
  name: 'Keyboard: Tab order through the full row',
  play: async ({ canvasElement }) => {
    await desktop();
    const { brand, links, search, github, theme, signIn, primary } = parts(canvasElement);
    brand.focus();
    for (const link of links()) {
      await tab();
      await expect(deepActive()).toBe(link);
    }
    await tab();
    await expect(deepActive()).toBe(search!.shadowRoot!.querySelector('button'));
    for (const next of [github(), theme(), signIn(), primary()]) {
      await tab();
      await expect(deepActive()).toBe(next);
    }
  },
};

export const ThemeToggle: Story = {
  name: 'Keyboard: theme button switches to Peat and back',
  play: async ({ canvasElement }) => {
    await desktop();
    onTheme.mockClear();
    resetTheme();
    const { theme } = parts(canvasElement);
    await expect(theme()).toHaveAccessibleName('Dark theme');
    await waitFor(() => expect(theme()).toHaveAttribute('aria-pressed', 'false'));
    theme().focus();
    await press('{Enter}');
    await expect(onTheme).toHaveBeenLastCalledWith('dark');
    await expect(document.documentElement.dataset.theme).toBe('dark');
    await expect(localStorage.getItem('mm-theme')).toBe('dark');
    await waitFor(() => expect(theme()).toHaveAttribute('aria-pressed', 'true'));
    await press('{Space}');
    await expect(onTheme).toHaveBeenLastCalledWith('light');
    await expect(document.documentElement.dataset.theme).toBe('light');
    await waitFor(() => expect(theme()).toHaveAttribute('aria-pressed', 'false'));
    resetTheme();
    // Let colour transitions settle before the accessibility check.
    await new Promise((r) => setTimeout(r, 400));
  },
};

export const ThemeCancelled: Story = {
  name: 'Cancelling mm-theme-change leaves the document alone',
  render: (a) => page(html`<div @mm-theme-change=${(e: Event) => e.preventDefault()}>${header(a)}</div>`),
  play: async ({ canvasElement }) => {
    await desktop();
    resetTheme();
    const { theme } = parts(canvasElement);
    await click(theme());
    await expect(document.documentElement.dataset.theme).toBe('light');
    await expect(localStorage.getItem('mm-theme')).toBeNull();
    // The button follows data-theme however it changes, as when Docusaurus applies its colour mode.
    document.documentElement.dataset.theme = 'dark';
    await waitFor(() => expect(theme()).toHaveAttribute('aria-pressed', 'true'));
    resetTheme();
    await waitFor(() => expect(theme()).toHaveAttribute('aria-pressed', 'false'));
    await new Promise((r) => setTimeout(r, 400));
  },
};

export const Navigate: Story = {
  name: 'Cancelling mm-navigate routes in place',
  play: async ({ canvasElement }) => {
    await desktop();
    onNavigate.mockClear();
    const { links } = parts(canvasElement);
    links()[2]!.focus();
    await press('{Enter}');
    await expect(onNavigate).toHaveBeenCalledWith('https://marmotdata.io/pricing');
  },
};

export const CustomItems: Story = {
  name: 'Site-relative items',
  render: (a) =>
    page(html`<mm-site-header
      current="/pricing"
      home-href="/"
      .items=${[
        { label: 'Docs', href: '/docs/introduction' },
        { label: 'Plugins', href: 'https://plugins.marmotdata.io' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Blog', href: '/blog' },
        { label: 'Community', href: 'https://discord.gg/TWCk7hVFN4', external: true },
      ] satisfies SiteNavItem[]}
      ?signed-in=${a.signedIn}
    ></mm-site-header>`),
  play: async ({ canvasElement }) => {
    await desktop();
    const { links, brand } = parts(canvasElement);
    await expect(links()).toHaveLength(5);
    await expect(links()[2]).toHaveAttribute('aria-current', 'page');
    await expect(brand).toHaveAttribute('href', '/');
  },
};

export const Narrow: Story = {
  name: 'Narrow: menu closed',
  render: (a) => narrow(header(a)),
  play: async ({ canvasElement }) => {
    const { menu, panel, links } = parts(canvasElement);
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    await expect(links()[0]!.checkVisibility()).toBe(false);
    await expect(menu).toHaveAccessibleName('Menu');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.checkVisibility()).toBe(false);
  },
};

export const NarrowOpen: Story = {
  name: 'Narrow: menu open',
  render: (a) => narrow(header(a)),
  play: async ({ canvasElement }) => {
    const { menu, panel, panelLinks } = parts(canvasElement);
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    await click(menu);
    await waitFor(() => expect(panel.checkVisibility()).toBe(true));
    await expect(panelLinks().map((l) => l.textContent?.trim())).toEqual([
      'Docs',
      'Plugins',
      'Pricing',
      'Resources',
      'Blog',
      'Community (opens in a new tab)',
      'GitHub (opens in a new tab)',
      'Sign in',
    ]);
    await expect(panelLinks()[0]).toHaveAttribute('aria-current', 'page');
  },
};

export const MenuKeyboard: Story = {
  name: 'Keyboard: menu opens, Tab reaches the links, Escape closes and returns focus',
  render: (a) => narrow(header(a)),
  play: async ({ canvasElement }) => {
    onMenu.mockClear();
    const { el, menu, panel, panelLinks } = parts(canvasElement);
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    menu.focus();
    await press('{Enter}');
    await expect(onMenu).toHaveBeenLastCalledWith(true);
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveAttribute('aria-controls', 'panel');
    await waitFor(() => expect(panel.checkVisibility()).toBe(true));
    await tab();
    await expect(deepActive()).toBe(panelLinks()[0]);
    await tab();
    await expect(deepActive()).toBe(panelLinks()[1]);
    await press('{Escape}');
    await waitFor(() => expect(el.menuOpen).toBe(false));
    await expect(deepActive()).toBe(menu);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    // Space toggles it too, and a second press closes it.
    await press('{Space}');
    await waitFor(() => expect(el.menuOpen).toBe(true));
    await press('{Space}');
    await waitFor(() => expect(el.menuOpen).toBe(false));
    await expect(onMenu).toHaveBeenLastCalledWith(false);
  },
};

export const MenuCancelled: Story = {
  name: 'Cancelling mm-menu-toggle opens your own navigation',
  render: (a) =>
    narrow(html`<div
      @mm-menu-toggle=${(e: CustomEvent<{ open: boolean }>) => {
        e.preventDefault();
        (e.target as MmSiteHeader).navExpanded = e.detail.open;
      }}
    >
      ${header(a)}
    </div>`),
  play: async ({ canvasElement }) => {
    const { el, menu, panel } = parts(canvasElement);
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    menu.focus();
    await press('{Enter}');
    await expect(el.menuOpen).toBe(false);
    await expect(panel.checkVisibility()).toBe(false);
    await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'true'));
    await expect(menu).not.toHaveAttribute('aria-controls');
    await press('{Enter}');
    await waitFor(() => expect(menu).toHaveAttribute('aria-expanded', 'false'));
  },
};

export const SignedInNarrow: Story = {
  name: 'Narrow: signed in',
  args: { signedIn: true },
  render: (a) => narrow(header(a)),
  play: async ({ canvasElement }) => {
    const { menu, panelLinks, host } = parts(canvasElement);
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    await click(menu);
    await expect(panelLinks().map((l) => l.textContent?.trim()).at(-1)).toBe('GitHub (opens in a new tab)');
    await expect(host('primary')).toHaveTextContent('Open console');
  },
};

export const OverflowingContent: Story = {
  name: 'Overflowing content: collapses when the row does not fit',
  render: (a) =>
    html`<div style="width:1000px;min-height:520px;background:var(--mm-paper);border:1px solid var(--mm-rule)">
      ${header(a, html`<mm-button slot="search" variant="secondary" icon="search" style="width:320px">Search the docs</mm-button>`)}
    </div>`,
  play: async ({ canvasElement }) => {
    await desktop();
    const { menu, links } = parts(canvasElement);
    // 1,000px is above the 880px breakpoint, but the links, a wide search and the actions need more.
    await waitFor(() => expect(menu.checkVisibility()).toBe(true));
    await expect(links()[0]!.checkVisibility()).toBe(false);
  },
};

export const RightToLeft: Story = {
  parameters: { dir: 'rtl' },
  args: { current: 'Plugins' },
  play: async () => {
    await desktop();
  },
};

export const BothThemes: Story = {
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  render: () => themes(html`<mm-site-header current="Plugins"></mm-site-header>`),
};

export const BothThemesNarrow: Story = {
  name: 'Both themes, narrow',
  parameters: { a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } } },
  render: () => themes(html`<div style="max-width:375px;min-height:480px"><mm-site-header current="Plugins" menu-open></mm-site-header></div>`),
};

