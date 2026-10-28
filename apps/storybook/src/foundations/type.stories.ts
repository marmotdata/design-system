import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

type Style = { name: string; fontSize: string; lineHeight: number; fontWeight: number; letterSpacing?: string; sample: string; usage: string };

const meta: Meta = { title: 'Foundations/Type', tags: ['!autodocs'] };
export default meta;

export const Styles: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Type</h1>
    <p class="lede">Two free families, self-hosted: Geist for titles and the interface, Geist Mono for machine strings. Every sample below is set with its <code>--text-*</code> token.</p>
    ${tokens.type.groups.map((g) => html`
      <h2>${g.name}</h2>
      <table class="fd-table">
        <thead><tr><th style="width:46%">Sample</th><th>Token</th><th class="num">Size</th><th class="num">Line</th><th class="num">Weight</th><th>Use</th></tr></thead>
        <tbody>
          ${(g.styles as Style[]).map((s) => html`<tr>
            <td style="padding-block:var(--space-4)"><span style="font:var(--text-${s.name});letter-spacing:var(--tracking-${s.name});${s.name.startsWith('display') ? ';font-variant-numeric:tabular-nums' : ''}">${s.sample}</span></td>
            <td class="mono">${s.name}</td>
            <td class="num">${s.fontSize}</td>
            <td class="num">${s.lineHeight}</td>
            <td class="num">${s.fontWeight}</td>
            <td style="max-width:36ch">${s.usage}</td>
          </tr>`)}
        </tbody>
      </table>`)}
    <h2>Typefaces</h2>
    <table class="fd-table">
      <thead><tr><th>Role</th><th>Stack</th><th>Specimen</th></tr></thead>
      <tbody>
        ${Object.entries(tokens.type.families).map(([k, v]) => html`<tr><td class="mono">--font-${k}</td><td class="mono">${v}</td>
          <td style="font-family:var(--font-${k});font-size:20px;${k === 'display' ? 'font-weight:600' : ''}">Il1 O0 rn m · customer_id · 1,284,019</td></tr>`)}
      </tbody>
    </table>
    <h2>Rules</h2>
    ${md(section('Typography', 3))}
  </div>`,
};
