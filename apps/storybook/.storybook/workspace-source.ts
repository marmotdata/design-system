import { transform } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const pkgs = fileURLToPath(new URL('../../../packages/', import.meta.url));

/**
 * Storybook and Vitest run the packages from source. Vite's transformer does not lower TC39
 * decorators yet, so workspace TypeScript goes through esbuild first.
 */
const cssSrc = `${pkgs}css/src/`;
/** `@marmotdata/css` is served from its source layers (concatenated as the package build does), so a stale dist never shows. */
const cssEntry = `${cssSrc}__marmot.css`;

export function workspaceSource(): Plugin {
  return {
    name: 'marmot-workspace-source',
    enforce: 'pre',
    resolveId(id) {
      return id === '@marmotdata/css' ? cssEntry : null;
    },
    load(id) {
      if (id.split('?')[0] !== cssEntry) return null;
      const files = readdirSync(cssSrc).filter((f) => /^\d.*\.css$/.test(f)).sort();
      for (const f of files) this.addWatchFile(cssSrc + f);
      // Same layer order as packages/css/scripts/build.ts.
      return `@layer mm-base, mm-components, mm-layouts, mm-docs, mm-marketing;\n${files.map((f) => readFileSync(cssSrc + f, 'utf8')).join('\n')}`;
    },
    async transform(code, id) {
      const file = id.split('?')[0]!;
      if (!file.startsWith(pkgs) || !file.endsWith('.ts') || file.endsWith('.stories.ts') || file.endsWith('.d.ts')) return null;
      if (!code.includes('@')) return null;
      const out = await transform(code, { loader: 'ts', target: 'es2022', sourcemap: true, sourcefile: file, tsconfigRaw: { compilerOptions: { useDefineForClassFields: false, experimentalDecorators: false } } });
      return { code: out.code, map: out.map };
    },
  };
}

/** Stories live under packages/, which do not depend on Storybook; resolve its entry points from the app. */
const fromApp = (spec: string) => fileURLToPath(import.meta.resolve(spec));

/** Maps public package specifiers to their source files. */
export const sourceAliases = [
  { find: /^storybook\/test$/, replacement: fromApp('storybook/test') },
  { find: /^@storybook\/web-components-vite$/, replacement: fromApp('@storybook/web-components-vite') },
  { find: /^@marmotdata\/elements$/, replacement: `${pkgs}elements/src/index.ts` },
  { find: /^@marmotdata\/elements\/custom-elements\.json$/, replacement: `${pkgs}elements/custom-elements.json` },
  { find: /^@marmotdata\/elements\/core\/(.+)\.js$/, replacement: `${pkgs}elements/src/core/$1.ts` },
  { find: /^@marmotdata\/elements\/classes\/([^.]+)(?:\.js)?$/, replacement: `${pkgs}elements/src/components/$1/class.ts` },
  { find: /^@marmotdata\/elements\/(.+)\.js$/, replacement: `${pkgs}elements/src/components/$1/define.ts` },
  { find: /^@marmotdata\/react$/, replacement: `${pkgs}react/src/index.ts` },
  { find: /^@marmotdata\/icons$/, replacement: `${pkgs}icons/src/index.ts` },
  { find: /^@marmotdata\/icons\/(.+)\.js$/, replacement: `${pkgs}icons/src/$1.ts` },
];
