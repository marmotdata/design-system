import readme from '../foundations/guidelines.md?raw';
import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

/** Returns the body of a README section by heading text, so Foundations pages quote the guidelines instead of retyping them. */
export function section(heading: string, level = 2): string {
  const lines = readme.split('\n');
  const marker = '#'.repeat(level) + ' ';
  const start = lines.findIndex((l) => l.trim() === marker + heading);
  if (start < 0) throw new Error(`README section not found: ${heading}`);
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^(#+) /.exec(l);
    if (m && m[1]!.length <= level) break;
    out.push(l);
  }
  return out.join('\n').trim();
}

/** The opening paragraphs, before the first section. */
export function intro(): string {
  return readme.split(/\n## /)[0]!.trim();
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

/** A deliberately small Markdown subset: headings, paragraphs, lists, tables, inline code and bold. */
/** `top` is the heading level a `###` becomes, so a page without its own h2 keeps the outline in order. */
export function mdToHtml(src: string, top = 3): string {
  const blocks = src.split(/\n{2,}/);
  const out = blocks.map((b) => {
    const lines = b.split('\n');
    if (/^#{3,4} /.test(lines[0]!)) {
      const lvl = lines[0]!.startsWith('####') ? top + 1 : top;
      return `<h${lvl}>${inline(lines[0]!.replace(/^#+ /, ''))}</h${lvl}>` + (lines.length > 1 ? mdToHtml(lines.slice(1).join('\n'), top) : '');
    }
    if (lines.every((l) => /^\s*(- |\d+\. )/.test(l) || /^\s{2,}/.test(l))) {
      const ordered = /^\d+\. /.test(lines[0]!);
      const items = lines.join('\n').split(/\n(?=\s*(?:- |\d+\. ))/).map((l) => `<li>${inline(l.replace(/^\s*(- |\d+\. )/, ''))}</li>`);
      return ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`;
    }
    if (lines[0]!.startsWith('|')) {
      const rows = lines.filter((l) => !/^\|\s*-/.test(l)).map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const [head, ...body] = rows;
      return `<table class="fd-table"><thead><tr>${head!.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if (lines[0] === '---') return '';
    return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
  });
  return out.join('\n');
}

export function md(src: string, top = 3): TemplateResult {
  return html`<div class="fd-prose">${unsafeHTML(mdToHtml(src, top))}</div>`;
}

export { readme };
