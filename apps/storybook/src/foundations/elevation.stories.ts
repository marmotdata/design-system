import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Elevation', tags: ['!autodocs'] };
export default meta;

const layers = (theme: 'light' | 'dark') => html`
  <div data-theme=${theme} style="background:var(--mm-paper);color:var(--mm-text);padding:var(--space-6);border-radius:var(--radius-md);border:1px solid var(--mm-rule)">
    <div class="fd-caption" style="margin-bottom:var(--space-3)">${theme === 'dark' ? 'Peat' : 'Light'} · mm-paper</div>
    <div style="background:var(--mm-surface);border:1px solid var(--mm-rule);border-radius:var(--radius-md);padding:var(--space-5)">
      <div style="font:var(--text-panel-title)">Panel on mm-surface</div>
      <div style="font:var(--text-caption);color:var(--mm-text-2);margin-bottom:var(--space-4)">1px mm-rule border, no shadow</div>
      <div style="background:var(--mm-raised);border:1px solid var(--mm-rule);border-radius:var(--radius-md);box-shadow:var(--shadow-float);padding:var(--space-3) var(--space-4);width:220px">
        <div style="font:var(--text-dense)">Menu on mm-raised</div>
        <div style="font:var(--text-caption);color:var(--mm-text-2)">shadow-float</div>
      </div>
      <div style="background:var(--mm-raised);border:1px solid var(--mm-rule);border-radius:var(--radius-lg);box-shadow:var(--shadow-dialog);padding:var(--space-4) var(--space-5);width:300px;margin:var(--space-5) 0 0 auto">
        <div style="font:var(--text-heading-sm)">Dialog on mm-raised</div>
        <div style="font:var(--text-caption);color:var(--mm-text-2)">shadow-dialog, radius-lg</div>
      </div>
    </div>
    <div style="background:var(--mm-sunken);border-radius:var(--radius-sm);padding:var(--space-3) var(--space-4);margin-top:var(--space-4);font:var(--text-dense)">Well on mm-sunken: table header bands, sidebars, the details blade</div>
  </div>`;

export const Layers: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Elevation</h1>
    <p class="lede">Elevation is shown by lighter surfaces, paper then surface then raised, not by shadows. Only floating layers carry a shadow, and both shadows are two-layer and tinted with ink.</p>
    <div class="fd-grid" style="grid-template-columns:repeat(auto-fit,minmax(420px,1fr))">${layers('light')}${layers('dark')}</div>
    <h2>Shadows</h2>
    <table class="fd-table"><thead><tr><th>Token</th><th>Light</th><th>Peat</th><th>Use</th></tr></thead>
      <tbody>${tokens.shadow.tokens.map((t) => html`<tr><td class="mono">${t.name}</td><td class="mono">${t.value.light}</td><td class="mono">${t.value.dark}</td><td>${t.usage}</td></tr>`)}</tbody></table>
  </div>`,
};
