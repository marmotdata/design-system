// Shared by the React and Svelte generators: resolves an event's `type.text` from the manifest
// (`CustomEvent<Detail>`, set by custom-elements-manifest.config.mjs) to a detail type plus the
// imports it needs. Named types are imported from the public module that exports them
// (`@marmotdata/elements/classes/<folder>.js` or `core/<file>.js`). A type that no public module
// exports makes the detail `unknown` rather than a broken import.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const homes = new Map();
function scan(dir, spec) {
  for (const f of readdirSync(dir, { recursive: true })) {
    const s = spec(String(f));
    if (!s) continue;
    for (const m of readFileSync(`${dir}/${f}`, 'utf8').matchAll(/export\s+(?:interface|type|class)\s+(\w+)/g)) if (!homes.has(m[1])) homes.set(m[1], s);
  }
}
scan(`${src}/core`, (f) => (/^[\w-]+\.ts$/.test(f) ? `@marmotdata/elements/core/${f.replace(/\.ts$/, '.js')}` : null));
scan(`${src}/components`, (f) => (/^[\w-]+\/class\.ts$/.test(f) ? `@marmotdata/elements/classes/${f.split('/')[0]}.js` : null));

const builtins = new Set(['Record', 'Array', 'Partial', 'Readonly', 'File', 'Date', 'HTMLElement', 'Element', 'Promise', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'Map', 'Set', 'Blob']);

/**
 * @param {string | undefined} typeText e.g. `CustomEvent<MmValueDetail>`
 * @param {Map<string, Set<string>>} imports collects `module -> names` to import
 * @returns {string} the detail type, or `unknown`
 */
export function detailType(typeText, imports) {
  const t = /^CustomEvent<([\s\S]*)>$/.exec(typeText ?? '')?.[1];
  if (t === undefined) return 'unknown';
  const names = [...new Set(t.match(/\b[A-Z]\w*\b/g) ?? [])].filter((n) => !builtins.has(n));
  if (names.some((n) => !homes.has(n))) return 'unknown';
  for (const n of names) {
    const from = homes.get(n);
    if (!imports.has(from)) imports.set(from, new Set());
    imports.get(from).add(n);
  }
  return t;
}

/** `import type` lines for what `detailType` collected. */
export const importLines = (imports) =>
  [...imports].map(([from, names]) => `import type { ${[...names].sort().join(', ')} } from '${from}';\n`).join('');
