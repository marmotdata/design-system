/** Generates Svelte 5 element types from @marmotdata/elements' Custom Elements Manifest. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateSvelteTypes } from 'custom-element-svelte-integration';
// @ts-expect-error plain JS helper shared with the React generator
import { detailType, importLines } from '../../elements/scripts/detail-types.mjs';

const manifestPath = fileURLToPath(new URL('../../elements/custom-elements.json', import.meta.url));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const folderOf = new Map<string, string>();
for (const m of manifest.modules as { path: string; declarations?: { name: string }[] }[]) {
  const folder = /components\/([^/]+)\/class\.ts$/.exec(m.path)?.[1];
  for (const d of m.declarations ?? []) if (folder) folderOf.set(d.name, folder);
}
// Resolve event detail types (and the imports they need) before generating, so the integration
// writes `CustomEvent<MmValueDetail>` rather than `CustomEvent<CustomEvent<MmValueDetail>>`.
const detailImports = new Map<string, Set<string>>();
for (const m of manifest.modules as { declarations?: { events?: { type?: { text: string } }[] }[] }[]) {
  for (const d of m.declarations ?? []) for (const e of d.events ?? []) e.type = { text: detailType(e.type?.text, detailImports) };
}
const out = fileURLToPath(new URL('../dist', import.meta.url));
mkdirSync(out, { recursive: true });
generateSvelteTypes(manifest, {
  outdir: out,
  fileName: 'elements.d.ts',
  componentTypePath: (name: string) => `@marmotdata/elements/classes/${folderOf.get(name)}.js`,
  hideLogs: true,
});
// The integration imports each element's event detail types from that element's own module, which
// is wrong for shared types (and includes DOM globals). Keep only the element classes in its imports;
// the detail types are imported from their real modules by `importLines` below.
// Svelte 5 attributes events as `onmm-change`; the integration only writes the legacy `on:` form,
// so add the Svelte 5 form next to it.
const typesFile = `${out}/elements.d.ts`;
writeFileSync(
  typesFile,
  importLines(detailImports) +
  readFileSync(typesFile, 'utf8')
    // The integration's base props are written for JSX; in Svelte 5 children are a Snippet and style is a string.
    .replace('children?: JSX.Element;', "children?: import('svelte').Snippet;")
    .replace('style?: JSX.CSSProperties;', 'style?: string;')
    .replace(/^(\s*)"on:([\w-]+)"\?: (.*)$/gm, (_l, sp: string, name: string, rest: string) => `${sp}"on${name}"?: ${rest}\n${sp}"on:${name}"?: ${rest}`)
    .replace(/^import type \{([^}]+)\} from (".*?");$/gm, (_line, names: string, from: string) => {
      const keep = [...new Set(names.split(',').map((n) => n.trim()).filter((n) => folderOf.has(n)))];
      return keep.length ? `import type { ${keep.join(', ')} } from ${from};` : '';
    }),
);
writeFileSync(
  `${out}/index.d.ts`,
  `/// <reference path="./elements.d.ts" />\nexport { setTheme, getTheme, type Theme } from './theme.js';\n`,
);
console.log(`svelte: types for ${folderOf.size} elements`);
