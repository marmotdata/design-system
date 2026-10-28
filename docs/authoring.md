# Authoring a Marmot element

Read the design guidelines first (`apps/storybook/src/foundations/guidelines.md`, quoted on the Foundations pages), then the rules below. Build properly: semantic markup, ARIA, keyboard, form association.

## Files

```
packages/elements/src/components/<name>/
  class.ts            the element class (no customElements.define here)
  define.ts           define('mm-<name>', Class); export { Class }
  <name>.stories.ts   every state, both themes, React and Svelte usage, keyboard tests
```

`<name>` is kebab-case without the `mm-` prefix (`text-field`, `data-table`). The public entry is `@marmotdata/elements/<name>.js`. A folder may define several related tags (for example `tabs` defines `mm-tabs`, `mm-tab` and `mm-tab-panel`); `define.ts` defines all of them.

Copy `packages/elements/src/components/button/` as the reference.

## Class rules

- `export class MmThing extends LitElement` (or `MmFormControl` from `../../core/form-control.js` for inputs). Lit standard decorators with `accessor`: `@property({ reflect: true }) accessor variant = 'x';`.
- JSDoc on the class: one-paragraph description in the guidelines' voice, then `@tagname mm-thing`, `@summary`, `@slot`, `@csspart`, `@cssprop`, and `@fires mm-change - {detail type} description` for every event. The Custom Elements Manifest is generated from this, and React wrappers, Svelte types and Storybook docs come from the manifest.
- `static override styles = [base, css\`...\`]` with `base` from `../../core/styles.js`.
- `declare global { interface HTMLElementTagNameMap { 'mm-thing': MmThing } }` at the end of class.ts.
- Import other elements you render by their define module, e.g. `import '../icon-shim.js'` is not needed: `import '@marmotdata/icons/define.js'` for `mm-icon`, `import '../button/define.js'` for `mm-button`.
- Use `override` on overridden members (TS `noImplicitOverride`). TypeScript is strict with `noUncheckedIndexedAccess`.

## Styling rules (non-negotiable)

- **Only tokens.** Never write a hex, rgb or named colour. Colours are `var(--mm-*)`; type is `font: var(--text-<style>)` plus `letter-spacing: var(--tracking-<style>)` where non-zero; spacing `var(--space-N)`; radius `var(--radius-sm|md|lg|full)`; shadow `var(--shadow-float|dialog)`; heights `var(--mm-control)` (density-aware, 36/30px), `var(--control-h-sm)`, rows `var(--mm-row)` (density-aware, 40/36px); menu rows `var(--mm-menu-row)`; z-index `var(--mm-z-*)`. If you need a value that does not exist, use the nearest token and note it in your report.
- Radius by role: 4 controls/inputs/tags/keycaps, 6 panels/buttons/menus/cards, 10 dialogs/palette, full only for avatars, status pills, filter pills.
- Burnt sienna (`--mm-primary*`) only for the primary button, links, active tab underline and brand. Never a status, never a large fill, never shifted towards red, at most once per row. Selection uses the neutral `--mm-selected`.
- Selection and current items use `--mm-selected` (a neutral ink mix, never the red tint) with ink text. Tertiary text inside a selected item switches to `--mm-text-2` (Peat contrast). Chrome surfaces (sidebar, top bar, blade) use `--mm-chrome`, not `--mm-sunken`.
- The logo is `<mm-logo>` (the wordmark); there is no pictorial mark. Contour drawings are only ever a faint background field, never an illustration or icon.
- Captions on raised layers (menus, popovers, dialogs) use `--mm-text-2`, not `--mm-text-3`.
- Focus ring: `base` already gives `:focus-visible` 2px ink outline, 2px offset. Apply it to the inner focusable part. Never burnt sienna.
- Motion: only `transform`, `opacity` and colours; durations `var(--mm-dur-press|menu|dialog)` with `var(--mm-ease)`. Never `transition: all`. No hover lift. Overlays opened from the keyboard appear instantly (`openedFromKeyboard()` from `core/floating.js`). Live pulse only for genuinely running things. Respect reduced motion (the duration tokens go to 0; stop any loop with `@media (prefers-reduced-motion: reduce)` and `:host-context` is not allowed, so also check `prefersReducedMotion()` in JS for loops).
- Mono only for machine strings (IDs, MRNs, SQL, types, timestamps, keys). There is no uppercase text. Labels and headers are sentence case `--text-label` in `--mm-text-2`.
- Numbers: `font-variant-numeric: tabular-nums`, right-aligned in tables.
- Use logical properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`) so RTL works.
- No cards in cards, no tinted icon circles, no coloured stripes, no gradients, no glass, no emoji, no sparkles, no "→" on buttons.
- Statuses always pair colour with a word, icon or shape.
- Touch: interactive targets at least 24×24px; inputs 16px font under `@media (pointer: coarse)`.

## Typography and density

Feedback: the UI was too busy and looked like too many fonts, mostly from overusing mono, the uppercase readout (now removed) and the display styles. These rules make it calmer.

**Two families, three roles, each with one job.**
- Display (`--text-display-*`, Geist at 600): the page title in `mm-page-header`, KPI values, and marketing heroes. Nothing else. Section and panel headings use `--text-heading` / `--text-heading-sm` / `--text-panel-title` (text face).
- Text (Geist): everything else, including numbers, timestamps, counts, durations, asset and table names in lists, owners, statuses, breadcrumbs and chart labels. Numbers use `font-variant-numeric: tabular-nums` so they still align.
- Mono (`--text-mono*`, Geist Mono): only text a person would copy or compare character by character. That means SQL, code, logs, JSON and YAML, the code editor, code samples, and the MRN shown once in the asset page header. Inside schema, diff and metadata viewers, column names, types and raw keys may stay mono. ID or key columns in tables (an API key prefix, a run ID) may be mono. Keycaps keep `--text-keycap`.
- Never mono: relative or absolute times ("3 minutes ago", "04:12 UTC"), counts and numbers, KPI values, chart axis and end labels, row metadata, kind labels ("Agent", "Table"), breadcrumbs, asset names in sentences or lists, or the asset title.

**No uppercase anywhere.** The uppercase readout and `--text-readout` are removed, and `mm-page-header` has no `readout`. Metadata under a title uses `caption` on `mm-page-header`, or `mm-readout` (always sentence case) in rows, cards, nodes and tiles: the text face in `--mm-text-2`, relative times, and only facts shown nowhere else (for example "1,284 rows · Updated 5 hours ago"). Don't repeat the kind the breadcrumbs give or a count shown on a tab.

**Calm rows and headers.**
- A row has one primary line and at most one quiet secondary line (`--text-caption`, `--mm-text-2`). Extra detail (a SQL preview, a long description) goes behind expand or hover, or into the blade.
- Don't badge the happy path. Show a status pill only when something needs attention (Denied, Failed, Partial, Stale, Expiring). "Allowed", "Succeeded", "Active" and similar are the default and get no pill.
- Kind labels: an agent is shown by its robot avatar, not an "AGENT" or "TEAM" text tag. Drop redundant kind words when an icon already says it.
- Links in lists, tables, rows and cards are ink (`--mm-text`), not underlined, with an underline on hover and focus. Burnt-sienna underlined links are for running prose only. Burnt sienna is then left for the one primary button, the current tab underline and real links in text.
- Page header: one primary button and at most one secondary. Occasional or destructive actions (Copy link, Delete) go into a "More" (`mm-menu-button`, icon `more-horiz`) menu. Actions that are the reason people come to a page are never hidden in "More". Never repeat a sidebar destination as a header button (Home has no "Query data"), and keep create actions on the page that owns them. Each action appears once per screen: not in the header and again in a section, the blade or the More menu. Home leads with "Jump back in" (recently viewed items and saved queries), not creation shortcuts.
- Design lists for hundreds of rows: paginate, search, and filter with dropdowns. Filter pills only for a short fixed set (about six). Search results are one ranked list, never split across sections.
- Modal dialogs only for short decisions and confirmations. Creating opens in place in the finished page's order, without faking system-assigned details. Linking or adding many items: chosen items in their own list, per-row Link/Remove that applies at once (Undo in a toast), never a mixed "untick to remove" checklist.
- Details blades used as previews: logo and name in the heading slot, an "At a glance" description list first, one question per section with a plain heading, identifiers in a `collapsible` "More details" section (never a nested `mm-disclosure`), and next steps as buttons in the `footer` slot instead of `full-view-href`.
- Data table columns: `width` is a preferred size, not a fixed one. Columns share the table in proportion and stop at `minWidth`, and the table scrolls only when the minimums do not fit. Give columns of buttons a `minWidth` equal to their `width` so actions never clip, and leave long text columns (descriptions, emails) without a width so they take the slack.
- Table action columns: at most one visible button per row plus a `more-horiz` menu-button for the rest; size the column for that, with `minWidth` equal to `width`.
- Rules and automations: render the condition in plain words (with the raw query in mono beneath, never alone), list what they add by name, and give each listed rule a visible `mm-switch` for on/off.
- Schemas use `mm-schema-table` (the outline): give `semantic` for everyday types the parser cannot infer (money, currency), `symbols` for enums and `source` for the original Avro or JSON Schema document so the JSON and YAML views show it.
- Page headers: owners, tags and links go in the `owners`, `tags` and `links` slots, which render as labelled rows. Subscribe and similar personal toggles are `variant="ghost"` icon buttons with `pressed`. Links are `mm-button size="sm" external` with the link's icon in the `icon` slot (`mm-provider-logo` for a known provider).
- Runs and traces: list + story layout; translate tool calls into plain steps with a timing bar; raw inputs behind a disclosure; tokens and IDs in a collapsible More details.
- Global search: `mm-top-bar` fires `mm-open-search` (click or ⌘K); the app opens one `mm-command-palette` with `commands`, `recents`, `search` and `search-href` (the Discover URL with `{query}`), so every query ends with "Search the catalog for …". In a single-page app, cancel `mm-search-all` and route with its `href`.
- Search uses `mm-search-bar` (tokens over the raw query) with `fields` giving everyday labels and known values. Its "Build query" opens `mm-query-builder` in place (groups of all / any / none); set `draft-count` from `mm-draft` for the live count. Never show a second editor for the same query beside it. Operators come from `operatorsFor` (it mirrors the backend parser: `@term` only `=` and wildcard, no comparisons on `@provider`, everything on `@metadata.*`); pass `loadFields` and `loadValues` to use the metadata suggestion endpoints.
- Create pages: no faked header or system-assigned details; small required core with defaults; optional groups behind "+" buttons; `mm-key-value-editor` for metadata, schema columns and links.
- Logs and long code in drawers and panels use `mm-code-sample wrap`, so nothing hides off the edge; give a `filename` and Copy moves up beside it.
- Show each piece of state once: applied filters show once (the search bar tokens where there is a search bar, with the facet sidebar set to `hide-applied`), result counts do not repeat the query, and one value is never edited in two places on screen at the same time.
- Fewer boxes: don't wrap single values in pills, tags or chips just to group them; prefer plain text separated by " · ".

**Plain words.** "Manually", not "by hand"; "automatically", not "on its own". Labels match: "Manual", "From rules".

**No filler copy.** Every piece of text must do a job for the person using the screen. Cut:
- figure labels and captions ("Figure 1", "An asset record as Marmot keeps it, here a dbt model in PostgreSQL"), "for example" notes, and lines that narrate what the UI is showing;
- helper text that restates the label, explains the obvious ("Click to open"), or describes how the product is built;
- decorative marks with no meaning (crosshairs, registration marks, corner ticks, stray "+" glyphs);
- more than one sentence of description under a heading. One short sentence at most, and none when the heading says it.
- sentences assembled from live data ("One pipeline failed overnight and 37 queries were refused"). They need counting, plural and translation logic for every combination. Keep copy static and put numbers in KPI tiles, counts and pills. A tile's context line is fixed text too ("Last 30 days"), and a second number gets its own tile;
- figures and ranks where a visual says enough ("Top 9%", "988 views" beside a popularity meter). Use the visual alone and keep exact numbers for values people act on.
**Marketing pages are scanned, not read.** No big tables or definition lists for "what you get" or "what is included". Use `.mm-points` (a short heading plus a line of at most about ten words, at most six items) or `.mm-lists` (two short lists side by side). A table only for a true comparison a buyer checks cell by cell (plan limits), with no more than about six rows. No static mock UI (fake log cards, fake records, timings) as hero art: the hero is the headline, one line, the actions and the background field.
Never show the product version, build, hostname, stack or internal names on screens a signed-out person can reach (sign-in, public error pages, status pages). They help an attacker pick an exploit. Versions belong in admin-only settings.
Empty states, errors and confirmations keep their one sentence that says what happened and what to do next. Code comments follow the same rule: say why, briefly, never restate the code.

## Behaviour rules

- Events: `emit(this, 'mm-change', detail)` from `../../core/events.js`. Prefix `mm-`, bubbling and composed. Document with `@fires`. Also let native `input`/`change` bubble where a native control is inside, or re-dispatch them, so Svelte `bind:` style code works.
- Form controls extend `MmFormControl`: call `this.setFormValue(...)` on every value change, `this.setValidity(...)` after validation (anchor element marked `data-anchor`), implement `formResetCallback()`. Expose `value` as a property and reflect `name`, `disabled`, `required`.
- Announce changes that happen without a page load (results, suggestions, items added or removed) through a visually hidden `role="status"` region. After adding an item, focus it; after removing one, focus the next item or the add control.
- Keyboard: follow the WAI-ARIA Authoring Practices pattern for the widget (links in the class JSDoc). Use `rovingKeydown` from `core/roving.js` for composite widgets. RTL flips horizontal arrows (`isRtl(this)`).
- Overlays: native `popover` attribute (`popover="auto"` for light-dismiss) or `<dialog>`, positioned with `float()` from `core/floating.js`. Return focus to the trigger on close. Trap focus in modal dialogs (native `<dialog>.showModal()` does this).
- Strings: any built-in text goes through `t('key')` from `core/strings.js`; add keys to `defaultStrings` if needed and list them in your report (do not edit strings.ts yourself if another worker might; put new keys in your report and use a local fallback `t('key' as never) ?? 'Text'` only if missing).
- Platform shortcuts: `formatShortcut('mod+k')` and `modKey()` from `core/platform.js`.
- Loading: `DelayedVisibility` from `core/delayed.js` (200ms delay, 400ms minimum).
- SSR: render must not touch `window`, `document` or measure in `render()` or the constructor. Do that in `firstUpdated`/`connectedCallback` guarded by `typeof window`.

## Stories

- Title `Components/<Group>/<Name>` with groups: Foundations, Actions, Forms, Status, Navigation, Layout, Overlays, Data, Data visualisation, Lineage, Query, Docs and marketing.
- `component: 'mm-thing'` so controls come from the manifest.
- `parameters.usage = { html, react, svelte }` (React imports `{ MmThing } from '@marmotdata/react'`, Svelte uses the element directly with `onmm-change={...}` and imports `@marmotdata/elements/<name>.js`).
- One story per state that applies: Default, Hover (`parameters: { pseudo: { hover: true } }`), Focus, Active (`pseudo: { active: true }`), Disabled, Loading, Empty, Error, Overflowing content, Long identifiers, Right to left (`parameters: { dir: 'rtl' }`), Both themes (`themes(...)` from `apps/storybook/src/support/themes.ts`).
- Realistic data only: `orders_daily`, `customers_dim`, `shop.orders.v2`, `mrn://postgresql/table/shop.public.orders`, 1,284,019 rows, owners like "Analytics Engineering", "Data Platform", people like "Jane Doe", agents like "support-triage-agent". Never lorem ipsum or Acme. Agents use neutral names ("support-triage-agent", "cli-agent") and `provider="agent"`, never a real vendor's product. British English, sentence case, no em dashes.
- Keyboard interaction tests in `play` for every interactive element, using `tab`, `press`, `click`, `deepActive` from `apps/storybook/src/support/keys.ts` (real key events under Vitest) and `expect`, `fn` from `storybook/test`. Test the full keyboard model (arrows, Home/End, Enter/Space, Escape, typeahead where specified) and form submission for form controls.
- Stories must pass axe (`a11y.test: 'error'`): label every control.

## Checking your work

From `apps/storybook`:

```
node_modules/.bin/vitest run --project=storybook ../../packages/elements/src/components/<name>
```

Storybook and Vitest run the packages from source, so no build is needed. Typecheck the package with `../../node_modules/.bin/tsc -p ../../packages/elements/tsconfig.build.json --noEmit`.

Before you finish, run the "Before you ship a screen" checklist (Foundations / Design philosophy) on your component and report the result.
