// One-off: derives src/providers.data.json from the OSS app's provider map (product data, not styling).
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(process.argv[2], 'utf8');
const imports = {};
for (const m of src.matchAll(/import (\w+) from '~icons\/([\w-]+)\/([\w-]+)'/g)) imports[m[1]] = `${m[2]}:${m[3]}`;
const start = src.indexOf('export const providerIconMap');
const body = src.slice(start, src.indexOf('\n};', start));
const out = {};
for (const m of body.matchAll(/^\t'?([\w-]+)'?: \{([\s\S]*?)\},?$/gm)) {
  const [, key, inner] = m;
  const def = /default: (\w+)/.exec(inner)?.[1];
  const dark = /dark: (\w+)/.exec(inner)?.[1];
  const name = /displayName: '([^']+)'/.exec(inner)?.[1];
  const cls = /class: '([^']+)'/.exec(inner)?.[1] ?? '';
  const hex = /text-\[(#[0-9A-Fa-f]{6})\]/.exec(cls)?.[1];
  const ink = /text-gray-900|dark:text-gray-100/.test(cls);
  if (!def || !imports[def]) continue;
  const icon = imports[def];
  const generic = icon.startsWith('material-symbols:') || icon.startsWith('heroicons:');
  out[key] = { name, icon, ...(dark && imports[dark] ? { dark: imports[dark] } : {}), ...(hex ? { color: hex } : {}), ...(ink && !hex ? { color: 'ink' } : {}), ...(generic ? { generic: true } : {}) };
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + '\n');
console.log(Object.keys(out).length, 'providers');
