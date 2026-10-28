import { html, type TemplateResult } from 'lit';

/** Renders the same content in Light and Peat side by side. */
export const themes = (content: unknown): TemplateResult => html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin:calc(-1 * var(--space-8));min-height:100vh">
  ${(['light', 'dark'] as const).map((t) => html`<div data-theme=${t} style="background:var(--mm-paper);color:var(--mm-text);padding:var(--space-8);min-width:0">
    <div style="font:var(--text-caption);color:var(--mm-text-2);margin-bottom:var(--space-3)">${t === 'dark' ? 'Peat' : 'Light'}</div>${content}</div>`)}
</div>`;
