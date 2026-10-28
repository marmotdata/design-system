# Contributing

Thanks for helping. Bug reports, fixes and small improvements are all welcome. For a new component or a change to how something looks, open an issue first so we can agree the design before you build it.

## Read first

- **Design philosophy and guidelines:** the Foundations pages in Storybook, written in [`apps/storybook/src/foundations/guidelines.md`](apps/storybook/src/foundations/guidelines.md). Every change has to follow them.
- **Authoring rules:** [`docs/authoring.md`](docs/authoring.md), for how components and pages are written.

## Set up

Needs Node 24 and pnpm.

```sh
pnpm install
pnpm build
pnpm storybook   # http://localhost:6006
pnpm docs:dev    # the docs site, http://localhost:3000
```

The docs site's Foundations and component pages are generated from the guidelines and each component's own description, so change those rather than the generated pages. Do and don't examples live in `apps/docs/docs/do-and-dont.mdx`.

Storybook doesn't watch package `dist` folders. After changing tokens, CSS or a component, rebuild that package (for example `pnpm --filter @marmotdata/elements build`) and restart Storybook.

## Before you open a pull request

```sh
pnpm turbo run build --filter="./packages/*"
pnpm contrast
cd apps/storybook && npx tsc --noEmit -p tsconfig.json
```

- Use design tokens, never raw colours. CI fails on hex or `rgb()` values in components.
- Commit the regenerated `custom-elements.json` and `strings.json` if your change alters them. CI checks they're up to date.
- If a change alters how something should be designed, update the guidelines and `docs/authoring.md` in the same pull request.
- Use small conventional commits (`feat:`, `fix:`, `docs:`).

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
