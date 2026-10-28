import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tokens from '@marmotdata/tokens/tokens.json';
import { md, section } from '../support/readme.ts';
import '../support/foundations.css';

const meta: Meta = { title: 'Foundations/Motion', tags: ['!autodocs'] };
export default meta;

const motion = (tokens as unknown as { motion: Record<string, string> }).motion;

export const Timing: StoryObj = {
  render: () => html`<div class="fd">
    <h1>Motion</h1>
    <p class="lede">Motion confirms and never performs. These values come from <code>/tokens</code>. Press each button to feel the duration; with reduced motion on (toolbar), every duration becomes zero.</p>
    <table class="fd-table">
      <thead><tr><th>Variable</th><th>Value</th><th>Demo</th></tr></thead>
      <tbody>
        ${Object.entries(motion).map(([k, v]) => html`<tr>
          <td class="mono">--${k}</td><td class="mono">${v}</td>
          <td>${k.startsWith('mm-dur') ? html`<mm-button variant="secondary" size="sm" @click=${(e: Event) => {
            const bar = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
            bar.style.transform = bar.style.transform === 'scaleX(1)' ? 'scaleX(0.1)' : 'scaleX(1)';
          }}>Play ${v}</mm-button><span style="display:inline-block;margin-inline-start:var(--space-3);width:160px;height:8px;background:var(--mm-text-3);transform:scaleX(0.1);transform-origin:left;transition:transform var(--${k}) var(--mm-ease);vertical-align:middle"></span>` : ''}</td>
        </tr>`)}
      </tbody>
    </table>
    ${md(section('Motion', 3))}
  </div>`,
};
