import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Space and radius', tags: ['!autodocs'] };
export default meta;

export const Scale: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Space and radius</h1>
    <p class="lede">A 4px grid. Radius follows role, so a child's radius is never larger than its parent's.</p>
    <h2>Spacing</h2>
    <table class="fd-table">
      <thead><tr><th>Token</th><th class="num">Value</th><th style="width:40%">Scale</th><th>Use</th></tr></thead>
      <tbody>${tokens.spacing.tokens.map((t) => html`<tr>
        <td class="mono">${t.name}</td><td class="num">${t.value}</td>
        <td><span style="display:block;height:12px;width:var(--${t.name});background:var(--mm-text-3)"></span></td>
        <td>${t.usage}</td></tr>`)}</tbody>
    </table>
    <h2>Radius</h2>
    <table class="fd-table">
      <thead><tr><th>Token</th><th class="num">Value</th><th>Shape</th><th>Use</th></tr></thead>
      <tbody>${tokens.radius.tokens.map((t) => html`<tr>
        <td class="mono">${t.name}</td><td class="num">${t.value}</td>
        <td><span style="display:block;width:${t.name === 'radius-full' ? '64px' : '80px'};height:40px;border:1px solid var(--mm-control-border);background:var(--mm-surface);border-radius:var(--${t.name})"></span></td>
        <td>${t.usage}</td></tr>`)}</tbody>
    </table>
    <h2>Fixed sizes</h2>
    <table class="fd-table">
      <thead><tr><th>Token</th><th class="num">Value</th><th>Use</th></tr></thead>
      <tbody>${tokens.size.tokens.map((t) => html`<tr><td class="mono">${t.name}</td><td class="num">${t.value}</td><td>${t.usage}</td></tr>`)}</tbody>
    </table>
    ${md(section('Space, shape and elevation', 3))}
  </div>`,
};
