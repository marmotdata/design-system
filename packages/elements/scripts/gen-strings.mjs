// Writes strings.json: every built-in string key with its English text, for translators.
// Keys come from `defaultStrings` in src/core/strings.ts and from `tr('key', 'fallback')` call sites.
// Fails if one key has two different fallbacks, a fallback disagrees with defaultStrings,
// or `t('key')` names a key that has no English text anywhere.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const lit = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|\x60((?:[^\x60\\$]|\\.)*)\x60`;
const unescape = (s) => s.replace(/\\(.)/g, '$1');
const pick = (m, i) => unescape(m[i] ?? m[i + 1] ?? m[i + 2] ?? '');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(name) && !/\.(stories|test|generated)\.ts$/.test(name) ? [p] : [];
  });
}

const stringsSrc = readFileSync(join(src, 'core/strings.ts'), 'utf8');
const block = stringsSrc.slice(stringsSrc.indexOf('defaultStrings = {'), stringsSrc.indexOf('} as const'));
const defaults = {};
for (const m of block.matchAll(new RegExp(String.raw`^\s*(\w+):\s*(?:${lit})`, 'gm'))) defaults[m[1]] = pick(m, 2);

const fallbacks = new Map(); // key -> { text, where[] }
const used = new Map();
const errors = [];
const trRe = new RegExp(String.raw`\btr\(\s*(?:${lit})\s*,\s*(?:${lit})`, 'g');
const tRe = new RegExp(String.raw`\bt\(\s*(?:${lit})`, 'g');

for (const file of files(src)) {
  const text = readFileSync(file, 'utf8');
  const where = relative(root, file);
  for (const m of text.matchAll(trRe)) {
    const key = pick(m, 1);
    const fb = pick(m, 4);
    const prev = fallbacks.get(key);
    if (prev && prev.text !== fb) errors.push(`${key}: "${prev.text}" (${prev.where[0]}) vs "${fb}" (${where})`);
    if (key in defaults && defaults[key] !== fb) errors.push(`${key}: fallback "${fb}" (${where}) differs from defaultStrings "${defaults[key]}"`);
    if (prev) prev.where.push(where);
    else fallbacks.set(key, { text: fb, where: [where] });
  }
  for (const m of text.matchAll(tRe)) {
    const key = pick(m, 1);
    if (!used.has(key)) used.set(key, where);
  }
}
for (const [key, where] of used) {
  if (!(key in defaults) && !fallbacks.has(key)) errors.push(`${key}: used with t() in ${where} but has no English text`);
}

const catalogue = { ...defaults };
for (const [key, { text }] of [...fallbacks].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) catalogue[key] ??= text;
const sorted = Object.fromEntries(Object.entries(catalogue).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

if (errors.length) {
  console.error(`strings: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
writeFileSync(join(root, 'strings.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`strings.json: ${Object.keys(sorted).length} keys (${Object.keys(defaults).length} in defaultStrings, ${fallbacks.size} tr() call sites)`);
