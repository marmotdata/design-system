import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { uiIcons } from '@marmotdata/icons/ui.js';
import { providerNames } from '@marmotdata/icons';
import '@marmotdata/icons/providers-all.js';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Iconography', tags: ['!autodocs'] };
export default meta;

export const Icons: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Iconography</h1>
    <p class="lede">Material Symbols Outlined at 16px for the interface, bundled at build time so self-hosted installs never call the Iconify API. Never in tinted circles, never as decoration, never a sparkle. Use <code>&lt;mm-icon name="…"&gt;</code>.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0;border-top:1px solid var(--mm-rule)">
      ${Object.keys(uiIcons).map((n) => html`<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-1);border-bottom:1px solid var(--mm-rule);font:var(--text-mono-dense);color:var(--mm-text-2)"><mm-icon name=${n} style="color:var(--mm-text)"></mm-icon>${n}</div>`)}
    </div>
    <h2>People and agents</h2>
    <p class="fd-prose">Agents and people are told apart by icon and label: <mm-icon name="smart-toy"></mm-icon> <strong>Agent</strong> and <mm-icon name="person"></mm-icon> <strong>Person</strong>. Tint is secondary.</p>
    <h2>Provider logos</h2>
    <p class="lede">The only full-colour artwork in working views. Never recoloured. Black marks are drawn in ink so they read on Peat. Providers without a bundled mark show a neutral glyph and are listed in <code>packages/icons/MISSING-MARKS.md</code>. Use <code>&lt;mm-provider-logo provider="postgresql"&gt;</code>.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));border-top:1px solid var(--mm-rule)">
      ${Object.entries(providerNames).map(([k, name]) => html`<div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-1);border-bottom:1px solid var(--mm-rule);font:var(--text-dense)"><mm-provider-logo provider=${k} size="20" decorative></mm-provider-logo><span>${name}</span><code style="margin-inline-start:auto;font:var(--text-mono-dense);color:var(--mm-text-2);background:none">${k}</code></div>`)}
    </div>
  </div>`,
};
