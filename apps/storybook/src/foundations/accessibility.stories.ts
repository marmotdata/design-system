import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import { contrast, threshold } from '../../../../tools/contrast/lib.ts';
import { pairs } from '../../../../tools/contrast/pairs.ts';
import { md, section } from '../support/readme.ts';
import manifest from '@marmotdata/elements/custom-elements.json';
import { defaultShortcuts } from '@marmotdata/elements/shortcut-help.js';
import '@marmotdata/elements/kbd.js';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Accessibility', tags: ['!autodocs'] };
export default meta;

const colors = Object.fromEntries((tokens.color.tokens as { name: string; value: { light: string; dark: string } }[]).map((t) => [t.name, t.value]));

export const Contrast: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Accessibility</h1>
    ${md(section('Accessibility'), 2)}
    <h2>Every checked pair</h2>
    <p class="lede">The same list CI checks (<code>tools/contrast/pairs.ts</code>), computed from the tokens on every build. Allowed exceptions are uses the guidelines forbids.</p>
    <table class="fd-table">
      <thead><tr><th>Sample</th><th>Foreground</th><th>Background</th><th>Theme</th><th class="num">Ratio</th><th class="num">Needs</th><th>Result</th><th>Used for</th></tr></thead>
      <tbody>${pairs.flatMap((p) => (p.themes ?? ['light', 'dark']).map((theme) => {
        const r = contrast(colors[p.fg]![theme], colors[p.bg]![theme]);
        const ok = r >= threshold[p.kind];
        return html`<tr>
          <td><span class="fd-sample" data-theme=${theme} role="img" aria-label="Sample" style="background:var(--${p.bg});color:var(--${p.fg})"></span></td>
          <td class="mono">${p.fg}</td><td class="mono">${p.bg}</td><td>${theme === 'dark' ? 'Peat' : 'Light'}</td>
          <td class="num">${r.toFixed(2)}</td><td class="num">${threshold[p.kind]}</td>
          <td>${ok ? 'Pass' : p.allow ? html`<span title=${p.allow}>Allowed exception</span>` : html`<strong style="color:var(--mm-danger)">Fails</strong>`}</td>
          <td>${p.where}</td></tr>`;
      }))}</tbody>
    </table>
  </div>`,
};

/* ------------------------------------------------------------------ Keyboard reference */

type ManifestDecl = { tagName?: string; summary?: string; description?: string };
const KEY_WORDS = /\bKeyboard\b|\bArrow|\bEscape\b|\bEnter\b|\bHome and End\b|\bTab\b|\bSpace\b/;

/** Each element's keyboard paragraph from its own docs, so this page never drifts from the components. */
const keyboardDocs = (manifest.modules as { declarations?: ManifestDecl[] }[])
  .flatMap((m) => m.declarations ?? [])
  .filter((d): d is ManifestDecl & { tagName: string } => !!d.tagName)
  .map((d) => {
    const paras = (d.description ?? '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim());
    const keys = paras.filter((p) => /^Keyboard\b/.test(p));
    const text = (keys.length ? keys : paras.filter((p) => KEY_WORDS.test(p)).slice(0, 1))
      .join(' ')
      .replace(/^Keyboard[^:]*:\s*/i, '')
      .replace(/\s*\(https?:\/\/[^)]+\)/g, '');
    return { tag: d.tagName, summary: d.summary ?? '', text };
  })
  .filter((d) => d.text)
  .sort((a, b) => a.tag.localeCompare(b.tag));

const common: [string, string][] = [
  ['tab', 'Move to the next control or widget. Shift+Tab moves back.'],
  ['up down left right', 'Move inside a widget: list items, tabs, segments, menu items, grid cells. Left and Right flip in right-to-left layouts.'],
  ['home end', 'Jump to the first or last item in a widget.'],
  ['enter', 'Follow a link, press a button, choose an option, or run a search.'],
  ['space', 'Press a button, toggle a switch or checkbox, choose a segment.'],
  ['esc', 'Close the innermost popup, menu, drawer or dialog. Focus returns to what opened it.'],
  ['a b c', 'Type to jump to a matching item in menus, selects and trees.'],
];

export const Keyboard: StoryObj = {
  name: 'Keyboard reference',
  render: () => html`<div class="fd">
    <h1>Keyboard reference</h1>
    <p class="lede">Every part of Marmot works without a mouse. ⌘ on Apple platforms is Ctrl elsewhere.</p>
    <h2>Shortcuts</h2>
    <table class="fd-table">
      <thead><tr><th>Area</th><th>Keys</th><th>Action</th></tr></thead>
      <tbody>${defaultShortcuts().map((s) => html`<tr><td>${s.group}</td><td><mm-kbd keys=${s.keys}></mm-kbd></td><td>${s.description}</td></tr>`)}</tbody>
    </table>
    <h2>Keys that work everywhere</h2>
    <table class="fd-table">
      <thead><tr><th>Keys</th><th>Action</th></tr></thead>
      <tbody>${common.map(([k, d]) => html`<tr><td style="white-space:nowrap">${k.split(' ').map((x) => html`<mm-kbd keys=${x}></mm-kbd> `)}</td><td>${d}</td></tr>`)}</tbody>
    </table>
    <h2>By component</h2>
    <p class="fd-prose">Taken from each component's documentation.</p>
    <table class="fd-table">
      <thead><tr><th>Component</th><th>Keyboard</th></tr></thead>
      <tbody>${keyboardDocs.map((d) => html`<tr><td style="white-space:nowrap"><code>${d.tag}</code></td><td>${d.text}</td></tr>`)}</tbody>
    </table>
  </div>`,
};
