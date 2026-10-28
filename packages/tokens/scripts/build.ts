/**
 * Builds @marmotdata/tokens from ../source: tokens.json and motion.json (from the design system
 * export), the fonts and the wordmark. Never edit the outputs by hand; change the source.
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, '../source');
const outDir = join(here, '../dist');

type Themed = { light: string; dark: string };
interface ColorToken { name: string; value: Themed; usage: string }
interface TypeStyle {
  name: string; fontSize: string; lineHeight: number; fontWeight: number;
  letterSpacing?: string; sample: string; usage: string;
}
interface TokensJson {
  name: string; version: number;
  color: { themes: { id: string; name: string }[]; tokens: ColorToken[] };
  type: {
    fonts: { family: string; file: string; weight: string; style: string }[];
    families: Record<'display' | 'text' | 'mono', string>;
    groups: { name: string; family: 'display' | 'text' | 'mono'; styles: TypeStyle[] }[];
  };
  spacing: { tokens: { name: string; value: string; usage: string }[] };
  radius: { tokens: { name: string; value: string; usage: string }[] };
  size: { tokens: { name: string; value: string; usage: string }[] };
  shadow: { tokens: { name: string; value: Themed; usage: string }[] };
}

const tokens: TokensJson = JSON.parse(readFileSync(join(sourceDir, 'tokens.json'), 'utf8'));

/** Motion is not in tokens.json yet (docs/open-items.md, item 1), so it has its own file. */
const motion: Record<string, string> = JSON.parse(readFileSync(join(sourceDir, 'motion.json'), 'utf8'));
for (const k of ['mm-ease', 'mm-dur-press', 'mm-dur-menu', 'mm-dur-dialog']) {
  if (!motion[k]) throw new Error(`Motion token ${k} missing from source/motion.json`);
}

const typeStyles = tokens.type.groups.flatMap((g) => g.styles.map((s) => ({ ...s, family: g.family, group: g.name })));
const fontShorthand = (s: (typeof typeStyles)[number]) =>
  `${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${s.family})`;

/**
 * Library-level values with no token yet (docs/open-items.md, item 5).
 * Kept in one place so they are easy to move into tokens.json later.
 */
const local = {
  'focus-ring-width': '2px',
  'focus-ring-offset': '2px',
  'menu-row': '32px',
  'table-head-h': '32px',
  'z-sticky': '10',
  'z-blade': '20',
  'z-popover': '100',
  'z-toast': '200',
  'z-dialog': '300',
};

// ---------- CSS ----------
const light = (t: ColorToken) => `  --${t.name}: ${t.value.light};`;
const dark = (t: ColorToken) => `  --${t.name}: ${t.value.dark};`;
const shadowLight = tokens.shadow.tokens.map((t) => `  --${t.name}: ${t.value.light};`);
const shadowDark = tokens.shadow.tokens.map((t) => `  --${t.name}: ${t.value.dark};`);
// Library-level themed values not in tokens.json yet (docs/open-items.md): the modal scrim,
// the chrome surface behind the sidebar and top bar (paper on Light, sunken on Peat), and the
// neutral fill for selected and current items (a step of ink over paper, never the red tint).
const scrimLight = [
  '  --mm-scrim: color-mix(in oklab, var(--mm-text) 40%, transparent);',
  '  --mm-chrome: var(--mm-paper);',
  '  --mm-selected: color-mix(in oklab, var(--mm-text) 7%, var(--mm-paper));',
].join('\n');
const scrimDark = [
  '  --mm-scrim: color-mix(in oklab, var(--mm-paper) 64%, transparent);',
  '  --mm-chrome: var(--mm-sunken);',
  '  --mm-selected: color-mix(in oklab, var(--mm-text) 11%, var(--mm-paper));',
].join('\n');
const darkBlock = [...tokens.color.tokens.map(dark), ...shadowDark, scrimDark, '  color-scheme: dark;'].join('\n');

const staticVars = [
  ...tokens.spacing.tokens.map((t) => `  --${t.name}: ${t.value};`),
  ...tokens.radius.tokens.map((t) => `  --${t.name}: ${t.value};`),
  ...tokens.size.tokens.map((t) => `  --${t.name}: ${t.value};`),
  ...Object.entries(tokens.type.families).map(([k, v]) => `  --font-${k}: ${v};`),
  ...typeStyles.map((s) => `  --text-${s.name}: ${fontShorthand(s)};`),
  ...typeStyles.map((s) => `  --tracking-${s.name}: ${s.letterSpacing ?? '0'};`),
  ...Object.entries(motion).map(([k, v]) => `  --${k}: ${v};`),
  ...Object.entries(local).map(([k, v]) => `  --mm-${k}: ${v};`),
  // Density: elements read only --mm-row and --mm-control.
  '  --mm-row: var(--row-default);',
  '  --mm-control: var(--control-h);',
].join('\n');

const css = `/* @marmotdata/tokens: generated from source/tokens.json. Do not edit. */
:root, [data-theme="light"] {
${tokens.color.tokens.map(light).join('\n')}
${shadowLight.join('\n')}
${scrimLight}
  color-scheme: light;
}
[data-theme="dark"] {
${darkBlock}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkBlock.replace(/^/gm, '  ')}
  }
}
:root {
${staticVars}
}
[data-density="compact"] {
  --mm-row: var(--row-compact);
  --mm-control: var(--control-h-sm);
}
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) { --mm-dur-press: 0ms; --mm-dur-menu: 0ms; --mm-dur-dialog: 0ms; }
}
[data-motion="reduce"] { --mm-dur-press: 0ms; --mm-dur-menu: 0ms; --mm-dur-dialog: 0ms; }
`;

const fontFaces = tokens.type.fonts
  .map(
    (f) => `@font-face {
  font-family: "${f.family}";
  src: url("./fonts/${basename(f.file)}") format("woff2");
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: swap;
}`,
  )
  .join('\n');

// ---------- TS constants ----------
const colorNames = tokens.color.tokens.map((t) => t.name);
const ts = `/* @marmotdata/tokens: generated from source/tokens.json. Do not edit. */
export const themes = ${JSON.stringify(tokens.color.themes)} as const;
export type ThemeId = (typeof themes)[number]['id'];
export const colors = ${JSON.stringify(Object.fromEntries(tokens.color.tokens.map((t) => [t.name, { ...t.value, usage: t.usage }])), null, 2)} as const;
export type ColorToken = keyof typeof colors;
export const shadows = ${JSON.stringify(Object.fromEntries(tokens.shadow.tokens.map((t) => [t.name, { ...t.value, usage: t.usage }])), null, 2)} as const;
export const spacing = ${JSON.stringify(Object.fromEntries(tokens.spacing.tokens.map((t) => [t.name, t.value])), null, 2)} as const;
export const radius = ${JSON.stringify(Object.fromEntries(tokens.radius.tokens.map((t) => [t.name, t.value])), null, 2)} as const;
export const size = ${JSON.stringify(Object.fromEntries(tokens.size.tokens.map((t) => [t.name, t.value])), null, 2)} as const;
export const fonts = ${JSON.stringify(tokens.type.families, null, 2)} as const;
export const typeStyles = ${JSON.stringify(typeStyles, null, 2)} as const;
export type TypeStyleName = (typeof typeStyles)[number]['name'];
export const motion = ${JSON.stringify(motion, null, 2)} as const;
export const local = ${JSON.stringify(local, null, 2)} as const;
/** CSS custom property reference for a token, e.g. cssVar('mm-primary') === 'var(--mm-primary)'. */
export const cssVar = (name: ColorToken | keyof typeof spacing | keyof typeof radius | keyof typeof size | keyof typeof shadows): string => \`var(--\${name})\`;
`;

// ---------- Tailwind ----------
const twV4 = `/* @marmotdata/tokens Tailwind v4 theme. @import "tailwindcss"; @import "@marmotdata/tokens/tailwind.css";
   Keys are namespaced with mm- so they never shadow the token variables themselves:
   bg-mm-paper, text-mm-text, font-mm-display, text-mm-body, rounded-mm-md, shadow-mm-float, p-mm-space-4. */
@theme inline {
${colorNames.map((n) => `  --color-${n}: var(--${n});`).join('\n')}
  --font-mm-display: var(--font-display);
  --font-mm-text: var(--font-text);
  --font-mm-mono: var(--font-mono);
${tokens.radius.tokens.map((t) => `  --radius-mm-${t.name.replace('radius-', '')}: var(--${t.name});`).join('\n')}
${tokens.shadow.tokens.map((t) => `  --shadow-mm-${t.name.replace('shadow-', '')}: var(--${t.name});`).join('\n')}
${typeStyles.map((s) => `  --text-mm-${s.name}: ${s.fontSize};\n  --text-mm-${s.name}--line-height: ${s.lineHeight};\n  --text-mm-${s.name}--font-weight: ${s.fontWeight};\n  --text-mm-${s.name}--letter-spacing: ${s.letterSpacing ?? '0'};`).join('\n')}
${tokens.spacing.tokens.map((t) => `  --spacing-mm-${t.name}: var(--${t.name});`).join('\n')}
  --ease-mm: var(--mm-ease);
}
`;

const twV3 = `/* @marmotdata/tokens Tailwind v3 preset. presets: [require('@marmotdata/tokens/tailwind-preset')] */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: ${JSON.stringify(Object.fromEntries(colorNames.map((n) => [n, `var(--${n})`])), null, 6).replace(/\n}/, '\n      }')},
      fontFamily: {
        display: ['var(--font-display)'],
        text: ['var(--font-text)'],
        mono: ['var(--font-mono)'],
        sans: ['var(--font-text)'],
      },
      fontSize: ${JSON.stringify(Object.fromEntries(typeStyles.map((s) => [s.name, [s.fontSize, { lineHeight: String(s.lineHeight), fontWeight: String(s.fontWeight), letterSpacing: s.letterSpacing ?? '0' }]])), null, 6).replace(/\n}/, '\n      }')},
      borderRadius: ${JSON.stringify(Object.fromEntries(tokens.radius.tokens.map((t) => [t.name.replace('radius-', ''), `var(--${t.name})`])))},
      boxShadow: ${JSON.stringify(Object.fromEntries(tokens.shadow.tokens.map((t) => [t.name.replace('shadow-', ''), `var(--${t.name})`])))},
      spacing: ${JSON.stringify(Object.fromEntries(tokens.spacing.tokens.map((t) => [t.name, `var(--${t.name})`])))},
      transitionTimingFunction: { mm: 'var(--mm-ease)' },
      transitionDuration: { press: 'var(--mm-dur-press)', menu: 'var(--mm-dur-menu)', dialog: 'var(--mm-dur-dialog)' },
    },
  },
};
`;

// ---------- Write ----------
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'fonts'), { recursive: true });
writeFileSync(join(outDir, 'tokens.css'), css);
writeFileSync(join(outDir, 'fonts.css'), fontFaces + '\n');
writeFileSync(join(outDir, 'index.css'), `@import "./fonts.css";\n@import "./tokens.css";\n`);
mkdirSync(join(here, '../src-gen'), { recursive: true });
writeFileSync(join(here, '../src-gen/index.ts'), ts);
writeFileSync(join(outDir, 'tokens.json'), JSON.stringify({ ...tokens, motion, local }, null, 2));
writeFileSync(join(outDir, 'tailwind.css'), twV4);
writeFileSync(join(outDir, 'tailwind-preset.cjs'), twV3);
for (const f of tokens.type.fonts) copyFileSync(join(sourceDir, 'fonts', basename(f.file)), join(outDir, 'fonts', basename(f.file)));
// The SIL Open Font License must travel with the font files.
for (const f of readdirSync(join(sourceDir, 'fonts')).filter((n) => n.endsWith('.txt'))) copyFileSync(join(sourceDir, 'fonts', f), join(outDir, 'fonts', f));
for (const f of ['marmot-wordmark.svg', 'marmot-wordmark-light.svg']) {
  mkdirSync(join(outDir, 'logos'), { recursive: true });
  copyFileSync(join(sourceDir, 'logos', f), join(outDir, 'logos', f));
}
console.log(`tokens: ${colorNames.length} colours, ${typeStyles.length} type styles, ${Object.keys(motion).length} motion values`);
