/**
 * Generates the Foundations and Components pages so the docs never drift from their sources:
 *
 * - Foundations: one page per section of `apps/storybook/src/foundations/guidelines.md`, the source
 *   of truth the Storybook Foundations pages also quote.
 * - Components: one page per element from `custom-elements.json` (summary, description, API),
 *   grouped like Storybook, with the story's usage markup as a live example.
 *
 * Also copies the wordmark from the tokens package. Run by `start` and `build`.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
const repo = join(here, '../..');
const docs = join(here, 'docs');
const storybook = process.env.STORYBOOK_URL ?? 'https://storybook.marmot.team';

/* ------------------------------------------------------------------ wordmark */

mkdirSync(join(here, 'static/img'), { recursive: true });
for (const f of ['marmot-wordmark.svg', 'marmot-wordmark-light.svg']) copyFileSync(join(repo, 'packages/tokens/dist/logos', f), join(here, 'static/img', f));

/* ------------------------------------------------------------------ foundations */

const guidelines = readFileSync(join(repo, 'apps/storybook/src/foundations/guidelines.md'), 'utf8');
const [intro, ...rest] = guidelines.split(/\n(?=## )/);
const sections = new Map(rest.map((s) => [s.split('\n')[0]!.replace(/^## /, '').trim(), s.split('\n').slice(1).join('\n').trim()]));
const take = (name: string) => {
  const body = sections.get(name);
  if (body === undefined) throw new Error(`guidelines.md has no "## ${name}" section`);
  return body;
};
// Turn the guideline's own top heading and lead paragraph into the opening of the Principles page.
const lead = intro!.replace(/^# .*\n+/, '').trim();

/** Splits "Using components" into its prose, the numbered "easy to get wrong" list and its subsections. */
const usingComponents = take('Using components');
const [usingProse, usingRest = ''] = usingComponents.split(/\n(?=1\. \*\*)/);
const [mistakes, ...usingSubs] = usingRest.split(/\n(?=### )/);
const sub = (name: string) => {
  const s = usingSubs.find((x) => x.startsWith(`### ${name}`));
  if (!s) throw new Error(`guidelines.md has no "### ${name}" under Using components`);
  return s.split('\n').slice(1).join('\n').trim();
};

const foundations: { slug: string; title: string; description: string; body: string; rules?: boolean }[] = [
  { slug: 'principles', title: 'Principles', description: 'What Marmot screens should be like, and why.', body: `${lead}\n\n${take('Principles')}\n\n## What to avoid\n\n${take('What to avoid')}` },
  { slug: 'easy-to-get-wrong', title: 'Easy to get wrong', description: 'The rules people break most often. Open a rule to read all of it.', body: mistakes!.trim(), rules: true },
  { slug: 'composing-screens', title: 'Composing screens', description: 'How to put components together into a screen.', body: `${usingProse!.replace(/\n*The components that are easiest to misuse:\s*$/, '').trim()}\n\nThe rules people break most often are in [Easy to get wrong](./easy-to-get-wrong).\n\n## Signature details\n\n${sub('Signature details')}` },
  { slug: 'tokens', title: 'Colour, type and space', description: 'The tokens every screen is built from.', body: take('Using tokens') },
  { slug: 'data-visualisation', title: 'Data visualisation', description: 'How to draw charts in Marmot.', body: sub('Data visualisation') },
  { slug: 'copy', title: 'Copy', description: 'How Marmot writes.', body: take('Copy') },
  { slug: 'accessibility', title: 'Accessibility', description: 'Keyboard, screen readers and how to check.', body: take('Accessibility') },
  { slug: 'logo', title: 'Logo', description: 'The wordmark and how to use it.', body: take('Logo') },
  { slug: 'checklist', title: 'Before you ship a screen', description: 'The checks every screen passes.', body: take('Before you ship a screen') },
];

/** Escapes text for MDX outside code spans: braces and angle brackets would otherwise be parsed. */
const mdx = (s: string) =>
  s
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' })[c]!)))
    .join('');
/** Inline Markdown to HTML for a <summary>, which MDX does not parse as Markdown. */
const inlineHtml = (s: string) =>
  s
    .split(/(`[^`]*`)/)
    .map((part, i) => {
      const esc = part.replace(/&/g, '&amp;').replace(/[{}<>]/g, (c) => ({ '{': '&#123;', '}': '&#125;', '<': '&lt;', '>': '&gt;' })[c]!);
      return i % 2 ? `<code>${esc.slice(1, -1)}</code>` : esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
/** The first sentence and the rest, splitting only outside code spans. */
function firstSentence(s: string): [string, string] {
  let at = 0;
  for (const [i, part] of s.split(/(`[^`]*`)/).entries()) {
    if (i % 2 === 0) {
      const m = /[.!?]["”)]?\s+(?=[A-Z“"(`])/.exec(part);
      if (m) return [s.slice(0, at + m.index + m[0].length).trim(), s.slice(at + m.index + m[0].length).trim()];
    }
    at += part.length;
  }
  return [s.trim(), ''];
}
const FOLD_OVER = 45;
/**
 * Long rules ("**Title.** text…" list items) fold to their title and first sentence; the rest opens
 * on click. With `rules`, every titled item becomes a row, folded or not, so a page of rules reads
 * as one even list.
 */
function fold(body: string, rules = false): string {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    const m = /^(?:\d+\.|-)\s+\*\*(.+?)\*\*:?\s*(.*)$/.exec(line);
    if (m && (rules || line.split(/\s+/).length > FOLD_OVER)) {
      const title = m[1]!.replace(/[.:]$/, '');
      const [lead, rest] = firstSentence(m[2]!);
      if (!rest && rules) {
        if (out.length && out.at(-1) !== '') out.push('');
        out.push(`<div className="rule"><strong>${inlineHtml(title)}.</strong> ${inlineHtml(lead)}</div>`, '');
        continue;
      }
      if (rest) {
        if (out.length && out.at(-1) !== '') out.push('');
        out.push('<details>', `<summary><strong>${inlineHtml(title)}.</strong> ${inlineHtml(lead)}</summary>`, '', mdx(rest), '', '</details>', '');
        continue;
      }
    }
    out.push(mdx(line));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

const foundationsDir = join(docs, 'foundations');
rmSync(foundationsDir, { recursive: true, force: true });
mkdirSync(foundationsDir, { recursive: true });
writeFileSync(join(foundationsDir, '_category_.json'), JSON.stringify({ label: 'Foundations', position: 4 }, null, 2) + '\n');
foundations.forEach((f, i) => {
  // Section bodies use ### for their subheadings; on their own page those become ##.
  const body = fold(f.body.replace(/^(#{3,6}) /gm, (_, h: string) => `${h.slice(1)} `), f.rules);
  writeFileSync(
    join(foundationsDir, `${f.slug}.mdx`),
    `---\ntitle: ${JSON.stringify(f.title)}\ndescription: ${JSON.stringify(f.description)}\nsidebar_position: ${i + 1}\n---\n\n${body}\n`,
  );
});

/* ------------------------------------------------------------------ components */

type Member = { kind: string; name: string; privacy?: string; static?: boolean; readonly?: boolean; type?: { text: string }; default?: string; description?: string; attribute?: string };
type Decl = {
  tagName?: string;
  name: string;
  summary?: string;
  description?: string;
  members?: Member[];
  attributes?: { name: string; fieldName?: string; type?: { text: string }; default?: string; description?: string }[];
  events?: { name: string; description?: string; type?: { text: string } }[];
  slots?: { name: string; description?: string }[];
  cssParts?: { name: string; description?: string }[];
  cssProperties?: { name: string; description?: string; default?: string }[];
};

const manifest = JSON.parse(readFileSync(join(repo, 'packages/elements/custom-elements.json'), 'utf8')) as { modules: { declarations?: Decl[] }[] };
const decls = new Map<string, Decl>();
for (const m of manifest.modules) for (const d of m.declarations ?? []) if (d.tagName) decls.set(d.tagName, d);

/** Story metadata per tag: its Storybook title (for grouping and links) and usage markup. */
const stories = new Map<string, { title: string; html?: string }>();
const componentsSrc = join(repo, 'packages/elements/src/components');
for (const dir of readdirSync(componentsSrc)) {
  const files = existsSync(join(componentsSrc, dir)) ? readdirSync(join(componentsSrc, dir)).filter((f) => f.endsWith('.stories.ts')) : [];
  for (const f of files) {
    const src = readFileSync(join(componentsSrc, dir, f), 'utf8');
    const title = /\btitle:\s*'([^']+)'/.exec(src)?.[1];
    const tag = /\bcomponent:\s*'(mm-[a-z-]+)'/.exec(src)?.[1];
    if (!title || !tag || stories.has(tag)) continue;
    const raw = /usage:\s*\{[^`]*?html:\s*`((?:\\.|[^`\\])*)`/.exec(src)?.[1];
    const usage = raw?.replace(/\\(.)/g, '$1');
    // Live examples are plain markup only: nothing interpolated and no scripts.
    const live = usage && !raw!.includes('${') && !/<script/i.test(usage) ? usage.trim() : undefined;
    stories.set(tag, { title, html: live });
  }
}

/** One table cell: a single line, pipes escaped. */
const cell = (s = '') => mdx(s.replace(/\s*\n\s*/g, ' ').trim()).replace(/\|/g, '\\|') || ' ';
const code = (s = '') => (s ? `\`${s.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|')}\`` : ' ');
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const storyId = (title: string) => `${slugify(title)}--docs`;

const componentsDir = join(docs, 'components');
rmSync(componentsDir, { recursive: true, force: true });
mkdirSync(componentsDir, { recursive: true });

const groups = new Map<string, { tag: string; name: string; summary: string }[]>();
for (const [tag, story] of [...stories].sort((a, b) => a[1].title.localeCompare(b[1].title))) {
  const d = decls.get(tag);
  if (!d) continue;
  const parts = story.title.split('/');
  if (parts[0] !== 'Components' || parts.length < 3) continue;
  const group = parts[1]!;
  const name = parts.at(-1)!;
  const groupDir = join(componentsDir, slugify(group));
  if (!groups.has(group)) {
    groups.set(group, []);
    mkdirSync(groupDir, { recursive: true });
    writeFileSync(join(groupDir, '_category_.json'), JSON.stringify({ label: group, collapsed: true }, null, 2) + '\n');
  }
  const summary = (d.summary ?? '').trim();
  groups.get(group)!.push({ tag, name, summary });

  const fields = (d.members ?? []).filter((m) => m.kind === 'field' && !m.static && m.privacy !== 'private' && m.privacy !== 'protected' && !m.name.startsWith('#') && !m.name.startsWith('_'));
  const attrOf = new Map((d.attributes ?? []).filter((a) => a.fieldName).map((a) => [a.fieldName!, a.name]));
  const methods = (d.members ?? []).filter((m) => m.kind === 'method' && !m.static && m.privacy !== 'private' && m.privacy !== 'protected' && !m.name.startsWith('#') && !m.name.startsWith('_') && m.description);

  const table = (head: string[], rows: string[][]) => (rows.length ? `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n` : '');
  const sectionOf = (title: string, body: string) => (body ? `\n## ${title}\n\n${body}` : '');

  const page = `---
title: ${JSON.stringify(name)}
description: ${JSON.stringify(summary || name)}
---

${mdx(summary)}

${story.html ? `<Example html={${JSON.stringify(story.html)}} />\n` : ''}
## Guidance

${mdx((d.description ?? '').trim())}
${sectionOf(
  'Properties',
  table(
    ['Property', 'Attribute', 'Type', 'Default', 'Description'],
    fields.map((f) => [code(f.name), code(attrOf.get(f.name) ?? ''), code(f.type?.text), code(f.default), cell(f.description)]),
  ),
)}${sectionOf('Methods', table(['Method', 'Description'], methods.map((m) => [code(`${m.name}()`), cell(m.description)])))}${sectionOf(
  'Events',
  table(['Event', 'Detail', 'Description'], (d.events ?? []).filter((e) => e.name).map((e) => [code(e.name), code(e.type?.text), cell(e.description)])),
)}${sectionOf('Slots', table(['Slot', 'Description'], (d.slots ?? []).map((s) => [s.name ? code(s.name) : 'Default', cell(s.description)])))}${sectionOf(
  'CSS parts',
  table(['Part', 'Description'], (d.cssParts ?? []).map((p) => [code(p.name), cell(p.description)])),
)}${sectionOf('CSS custom properties', table(['Property', 'Description'], (d.cssProperties ?? []).map((p) => [code(p.name), cell(p.description)])))}
## Examples

[Every state of \`${tag}\` in Storybook](${storybook}/?path=/docs/${storyId(story.title)}), with keyboard and screen reader tests.
`;
  writeFileSync(join(groupDir, `${slugify(name)}.mdx`), page);
}

const overview = [...groups]
  .map(([group, items]) => `## ${group}\n\n| Component | Use it for |\n|---|---|\n${items.map((c) => `| [${c.name}](./components/${slugify(group)}/${slugify(c.name)}) | ${cell(c.summary)} |`).join('\n')}\n`)
  .join('\n');
writeFileSync(
  join(docs, 'components-overview.mdx'),
  `---\ntitle: Components\ndescription: Every Marmot component, grouped by what it is for.\nslug: /\nsidebar_label: All components\n---\n\nWeb components (\`mm-*\`) that work in any framework, with React wrappers and Svelte types. Each page has a live example, guidance and the full API.\n\n${overview}`,
);

const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
console.log(`docs: ${foundations.length} foundation pages, ${total} component pages in ${groups.size} groups`);
