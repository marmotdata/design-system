/**
 * Generates one @lit/react wrapper per element from the Custom Elements Manifest, so props are
 * typed from the element class and every `mm-*` event becomes an `onMm*` callback prop.
 */
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain JS helper shared with the Svelte generator
import { detailType, importLines } from '../../elements/scripts/detail-types.mjs';

type Decl = { name: string; tagName?: string; customElement?: boolean; events?: { name: string; type?: { text: string } }[] };
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../elements/custom-elements.json', import.meta.url)), 'utf8'));
const src = fileURLToPath(new URL('../src', import.meta.url));
rmSync(src, { recursive: true, force: true });
mkdirSync(src, { recursive: true });

const camel = (e: string) => 'on' + e.split('-').map((p) => p[0]!.toUpperCase() + p.slice(1)).join('');

// Event detail types: see packages/elements/scripts/detail-types.mjs.

const exports: string[] = [];
for (const m of manifest.modules as { path: string; declarations?: Decl[] }[]) {
  const folder = /components\/([^/]+)\/class\.ts$/.exec(m.path)?.[1];
  if (!folder) continue;
  for (const d of m.declarations ?? []) {
    if (!d.tagName) continue;
    const events = (d.events ?? []).filter((e) => e.name?.startsWith('mm-'));
    const imports = new Map<string, Set<string>>();
    const eventMap = events.map((e) => `    ${camel(e.name)}: '${e.name}' as EventName<CustomEvent<${detailType(e.type?.text, imports)}>>,`).join('\n');
    const typeImports: string = importLines(imports);
    writeFileSync(
      `${src}/${d.tagName.replace(/^mm-/, '')}.ts`,
      `/* Generated from custom-elements.json. Do not edit. */
import * as React from 'react';
import { createComponent${events.length ? ', type EventName' : ''} } from '@lit/react';
import { ${d.name} as ${d.name}Element } from '@marmotdata/elements/${folder}.js';
${typeImports}
/** React wrapper for \`<${d.tagName}>\`. */
export const ${d.name} = createComponent({
  tagName: '${d.tagName}',
  elementClass: ${d.name}Element,
  react: React,
  displayName: '${d.name}',
  events: {
${eventMap}
  },
});
`,
    );
    exports.push(`export { ${d.name} } from './${d.tagName.replace(/^mm-/, '')}.js';`);
  }
}
writeFileSync(`${src}/index.ts`, `/* Generated. Do not edit. */\n${exports.join('\n')}\n`);
console.log(`react: ${exports.length} wrappers`);
