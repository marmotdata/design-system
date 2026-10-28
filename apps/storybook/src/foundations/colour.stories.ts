import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import { contrast } from '../../../../tools/contrast/lib.ts';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

type ColorToken = { name: string; value: { light: string; dark: string }; usage: string };
const colors = tokens.color.tokens as ColorToken[];
const byName = Object.fromEntries(colors.map((c) => [c.name, c]));

const groups: [string, (n: string) => boolean][] = [
  ['Surfaces', (n) => ['mm-paper', 'mm-surface', 'mm-raised', 'mm-sunken', 'mm-rule', 'mm-control-border'].includes(n)],
  ['Ink', (n) => /^mm-(text|on-inverse)/.test(n)],
  ['Burnt sienna', (n) => /^mm-(primary|on-primary)/.test(n)],
  ['Contour', (n) => n.startsWith('mm-contour')],
  ['Status', (n) => /^mm-(success|warning|info|danger)/.test(n)],
  ['Editor', (n) => /^mm-(code|syn)/.test(n)],
];

/** The background a token is read against, for the ratio column. */
const against = (n: string) =>
  /-soft$|paper|surface|raised|sunken|rule|tint|contour/.test(n) && !n.startsWith('mm-contour') ? null
  : n.startsWith('mm-syn') || n === 'mm-code-text' ? 'mm-code-bg'
  : n === 'mm-on-primary' ? 'mm-primary-fill'
  : n === 'mm-on-inverse' ? 'mm-text'
  : n.endsWith('-fill') || n.endsWith('-hover') || n === 'mm-code-bg' ? null
  : 'mm-paper';

const swatch = (hex: string, theme: 'light' | 'dark') => html`
  <div data-theme=${theme} style="display:flex;align-items:center;gap:var(--space-2);background:var(--mm-paper);padding:var(--space-2);border-radius:var(--radius-sm)">
    <span style="width:40px;height:28px;border-radius:var(--radius-sm);background:${hex};border:1px solid var(--mm-rule);flex:none"></span>
    <code style="font:var(--text-mono-dense);color:var(--mm-text-2)">${hex}</code>
  </div>`;

const ratio = (name: string, theme: 'light' | 'dark') => {
  const bg = against(name);
  if (!bg) return html`<span class="mm-faint">–</span>`;
  return html`${contrast(byName[name]!.value[theme], byName[bg]!.value[theme]).toFixed(2)}`;
};

const meta: Meta = {
  title: 'Foundations/Colour',
  parameters: { layout: 'padded', a11y: { test: 'error' } },
  tags: ['!autodocs'],
};
export default meta;

export const Palette: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Colour</h1>
    <p class="lede">Earth and survey: warm paper and ink, one burnt-sienna accent, dusty natural status colours. Every value below is read from <code>/tokens</code>; ratios are computed live against the background named in the last column.</p>
    ${groups.map(([title, match]) => html`
      <h2>${title}</h2>
      <table class="fd-table">
        <thead><tr><th>Token</th><th>Light</th><th>Peat</th><th class="num">Light ratio</th><th class="num">Peat ratio</th><th>Use</th></tr></thead>
        <tbody>
          ${colors.filter((c) => match(c.name)).map((c) => html`<tr>
            <td class="mono">${c.name}</td>
            <td>${swatch(c.value.light, 'light')}</td>
            <td>${swatch(c.value.dark, 'dark')}</td>
            <td class="num">${ratio(c.name, 'light')}</td>
            <td class="num">${ratio(c.name, 'dark')}</td>
            <td style="max-width:44ch">${c.usage}${against(c.name) ? html` <span style="font:var(--text-caption);color:var(--mm-text-2)">Ratio against ${against(c.name)}.</span>` : ''}</td>
          </tr>`)}
        </tbody>
      </table>`)}
    <h2>Rules</h2>
    ${md(section('Colour rules', 3))}
  </div>`,
};
