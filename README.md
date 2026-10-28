# marmot-ui

Marmot's component library: design tokens, CSS and web components, with React and Svelte bindings.

## Packages

| Package | |
|---|---|
| `@marmotdata/tokens` | Colours, type, spacing and motion as CSS variables, plus TypeScript, Tailwind presets and fonts |
| `@marmotdata/css` | Plain CSS classes for static pages |
| `@marmotdata/elements` | The `mm-*` web components (Lit) |
| `@marmotdata/react` | React wrappers |
| `@marmotdata/svelte` | Svelte 5 types |
| `@marmotdata/icons` | Icons and provider logos |

```js
import '@marmotdata/tokens/index.css';
import '@marmotdata/elements/button.js';
```

```html
<mm-button variant="primary">Query table</mm-button>
```

Set `data-theme="dark"` on `<html>` for the dark theme.

## Development

Needs Node 24 and pnpm.

```sh
pnpm install
pnpm build              # all packages
pnpm storybook          # http://localhost:6006
pnpm storybook:calm     # without live reload
pnpm storybook:public   # what gets deployed
pnpm docs:dev           # the docs site, http://localhost:3000
```

Story tests run with `pnpm --filter @marmotdata/storybook test`.

## More

- [docs/authoring.md](docs/authoring.md): how to write components and pages
- [docs/open-items.md](docs/open-items.md): missing tokens and guidelines to update

- [apps/docs](apps/docs): the docs site. Foundations and component pages are generated from the guidelines and the component manifest, so edit those, not the generated pages
- [CONTRIBUTING.md](CONTRIBUTING.md): how to set up, check and propose changes

Storybook deploys to storybook.marmot.team on push to `main`. Publishing to npm is a manual workflow.

## Licence

The code is [MIT](LICENSE). The Geist fonts in `@marmotdata/tokens` are under the SIL Open Font License, and the icon artwork in `@marmotdata/icons` is under its own licences (see its [third-party notices](packages/icons/THIRD-PARTY-NOTICES.md)).

The Marmot name and logo are trademarks and are not licensed under MIT. Provider names and logos belong to their owners and are used only to identify the systems Marmot connects to.
