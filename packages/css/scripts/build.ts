/** Concatenates src/*.css in order into dist/marmot.css and copies each layer for à la carte imports. Fails on raw colours. */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const out = fileURLToPath(new URL('../dist/', import.meta.url));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.css')).sort();
const parts: string[] = [];
for (const f of files) {
  const css = readFileSync(src + f, 'utf8');
  const bad = css.split('\n').map((l, i) => [l, i + 1] as const).filter(([l]) => /#[0-9a-f]{3,8}\b|rgba?\(|\btransition:\s*all/i.test(l.replace(/\/\*.*?\*\//g, '')));
  if (bad.length) throw new Error(`${f}: raw colour or transition: all on line(s) ${bad.map(([, n]) => n).join(', ')}`);
  writeFileSync(out + f.replace(/^\d+-/, ''), css);
  parts.push(`/* ${f} */\n${css}`);
}
writeFileSync(out + 'marmot.css', `/* @marmotdata/css. Load @marmotdata/tokens/index.css first. */\n@layer mm-base, mm-components, mm-layouts, mm-docs, mm-marketing;\n${parts.join('\n')}`);
console.log(`css: ${files.length} layers`);
