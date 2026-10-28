// Event detail types are written `@fires mm-change - {MmValueDetail} description` in the class JSDoc.
// The analyzer keeps the `{...}` in the description; this moves it to `type.text` as
// `CustomEvent<...>`, so Storybook docs, the React wrappers and the Svelte types all see it.
function leadingType(description) {
  if (!description?.startsWith('{')) return undefined;
  let depth = 0;
  for (let i = 0; i < description.length; i++) {
    if (description[i] === '{') depth++;
    else if (description[i] === '}' && --depth === 0) return { type: description.slice(1, i).trim(), rest: description.slice(i + 1).trim() };
  }
  return undefined;
}

const eventDetailTypes = {
  name: 'marmot-event-detail-types',
  packageLinkPhase({ customElementsManifest }) {
    for (const mod of customElementsManifest.modules ?? []) {
      for (const decl of mod.declarations ?? []) {
        for (const event of decl.events ?? []) {
          const found = leadingType(event.description);
          if (!found) continue;
          let t = found.type;
          if (t === '{}' || t === '') t = 'Record<string, never>';
          else if (/^\w+\??\s*:/.test(t)) t = `{ ${t} }`; // single-brace object literal
          event.type = { text: `CustomEvent<${t}>` };
          event.description = found.rest;
        }
      }
    }
  },
};

// The analyzer lists modules in filesystem order, which differs between machines; sort them so
// the committed manifest is identical wherever it is generated.
const stableOrder = {
  name: 'marmot-stable-order',
  packageLinkPhase({ customElementsManifest }) {
    customElementsManifest.modules?.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  },
};

export default {
  litelement: true,
  globs: ['src/components/**/class.ts', 'src/core/form-control.ts'],
  outdir: '.',
  plugins: [eventDetailTypes, stableOrder],
};
