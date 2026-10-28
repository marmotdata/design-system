Marmot gives people and agents context about an organisation's data and governed access to it. It catalogs every asset (tables, topics, dashboards, pipelines, agents), records lineage and ownership, and decides and audits who and what may query that data. The people using it could be anyone in the organisation: someone in finance looking for the right revenue table, a support lead checking what a dashboard means, an analyst running SQL, an engineer tracing lineage or a governance lead reading audit logs, and increasingly agents acting on their behalf. Some visit once a week; others live in it for hours.

These guidelines describe how Marmot looks and how it speaks. Read them before you design a screen or write copy.

We want Marmot to feel calm, precise and trustworthy, like a well-made instrument rather than another generic software product. Plenty of tools describe themselves the same way, so the words will not make Marmot stand out. The design and the writing have to.

The visual idea is **Earth & survey**: warm paper and ink, one burnt-sienna accent, muted natural colours for status, and touches borrowed from maps and technical drawings. Marmot is a map of your data, drawn by a careful surveyor.

## Principles

### Make it clear

- Every screen should make sense to someone who is not technical. Use everyday words and keep jargon for where it helps.
- Show real things: real table names, real numbers, real provider logos. Never placeholder art or stock imagery.
- Never rely on colour alone. Every status has a word, an icon or a shape as well as a colour.
- Make the common path obvious. What people come to a page to do is a visible button; creating something opens in place, in the finished page's order, not in a cramped dialog.
- Lead with what decides the next step. In previews and summaries, the facts that tell someone whether they can use a thing come first; detail folds away.
- Explain what automation does in plain words. A rule or filter is described the way a person would say it, with the query syntax available but never first.

### Keep it calm

- The content comes first. Navigation, sidebars and toolbars stay quieter than the data they frame.
- Give each row one main line and at most one quiet line under it. Put extra detail in a hover, a side panel or a tab.
- Separate things with spacing and thin rules, not boxes inside boxes.
- Use three typefaces, each for one job. Monospace is only for text people copy, such as SQL, IDs and keys.
- Motion confirms that something happened. Keep it quick, never decorative, and skip it for keyboard actions.

### Use colour with care

- There is one accent colour, burnt sienna (`mm-primary`). It marks the main button, links, the active tab and the logo, and covers less than 5% of any screen.
- Selected items use a neutral tint, never the accent.
- The warm neutrals (`mm-paper`, `mm-text`, `mm-rule`) carry the brand, not gradients or tinted cards.
- Decoration has to earn its place. The contour pattern appears on empty states, sign-in, marketing and loading screens, never behind working data.

### Say it once

- Show each piece of information in one place. Active filters show as tokens in the search bar; a count is not repeated in the heading and the tab.
- Never let people edit the same thing in two places on screen at once. Search is one bar that is also the filter builder; the facets edit that same query.
- When the exact number does not change what someone does, show a visual instead. Popularity is four bars, not "Top 9%".

### Build what the product can deliver

- Copy is fixed text. It never stitches live numbers into sentences; numbers belong in tiles, counts and status pills.
- Every label, count and message must come from data the product really has, without special logic for one screen.
- Tables are fine. People scan, so a well-set table beats a grid of cards.

## What to avoid

Many products now look alike because they are built from the same templates and trends. Avoid these, and do not just swap colours and fonts on a template layout.

- **Type:** one plain system font for everything, the same handful of fashionable fonts, serif headlines, gradient text, a single word recoloured in a headline, small uppercase labels above every heading, monospace used as decoration.
- **Colour:** purple-to-blue gradients, neon on black, glows and coloured shadows, a default framework palette, rainbow categories that mean nothing, the cream-and-terracotta look, coral.
- **Layout:** the template page of a centred headline, two buttons and three identical icon cards; badges with pulsing dots; big-number strips; bento grids; logo walls; 01, 02, 03 numbering on things that are not steps; the same radius and padding on everything.
- **Surfaces:** everything in identical rounded cards with soft shadows, frosted glass, gradient blobs, cards inside cards, a coloured stripe down the side of a card, fake window buttons on code blocks.
- **Icons and imagery:** icons in tinted circles, emoji as icons, sparkles to mean “smart”, 3D blobs, "connected nodes" art.
- **Dashboards:** a row of KPI cards with green "+12%" arrows over a gradient chart, badges that mean nothing, only the happy path designed.
- **Motion:** everything fading and sliding up as you scroll, cards lifting on hover, animated menus.
- **Copy:** hype words ("Supercharge", "Unlock", "Seamless"), punchy fragments ("Build faster. Ship smarter."), em dashes, arrows on buttons, sentences built from live numbers.

Adding extra effects to look different (textures, parallax) is just as bad as following the template.

## Using tokens

Every value is a CSS custom property named after its token (`--mm-text`, `--mm-primary`, `--space-4`, `--radius-md`). Components reference semantic tokens and never raw hex. There are two themes: **Light** and **Peat** (`data-theme="dark"`), a separately tuned warm graphite, not an inversion. Load `components/bundle.css` after the tokens for the `mm-*` component classes.

### Colour

| Role | Token | Light | Peat | Use |
| --- | --- | --- | --- | --- |
| Paper | `mm-paper` | #fdfbfa | #151210 | Page background. Never cream. |
| Surface | `mm-surface` | #ffffff | #1c1916 | Panels, tables and the editor |
| Raised | `mm-raised` | #ffffff | #26221f | Popovers, menus, dialogs |
| Sunken | `mm-sunken` | #f6f3ef | #181513 | Wells, table header bands, sidebars, the blade, inline code |
| Rule | `mm-rule` | #e1ddd8 | #36322f | Hairlines and panel borders, decorative only |
| Control border | `mm-control-border` | #948d86 | #76706a | Inputs, selects, checkboxes, secondary buttons |
| Ink | `mm-text` | #191511 | #eae7e3 | Primary text, inverse fills, focus ring |
| Ink-2 | `mm-text-2` | #595450 | #a8a49f | Secondary text, labels, table headers |
| Ink-3 | `mm-text-3` | #6f6a65 | #86817c | Tertiary text and captions |
| Burnt sienna | `mm-primary` | #b05019 | #eb9666 | Links, active tab, brand |
| Burnt sienna fill | `mm-primary-fill` | #b05019 | #b3531d | Primary button fill, with `mm-on-primary` |
| Hover | `mm-primary-hover` | #97400d | #9d4616 | Hover and pressed |
| Tint | `mm-primary-tint` | #fcede2 | #322219 | Agent tint, the current lineage node. Selection uses `mm-selected` (neutral) |
| Contour | `mm-contour` | #a17651 | #b08560 | The contour motif only, never UI state |
| Index contour | `mm-contour-index` | #915828 | #c49a6c | The heavier every-fifth contour |
| Moss | `mm-success` | #4d7455 | #8fb594 | Succeeded, healthy, allowed |
| Ochre | `mm-warning` | #a27825 | #d4a75a | Icons and fills: stale, truncated, expiring |
| Ochre text | `mm-warning-text` | #85611a | #d4a75a | Warning text |
| Slate | `mm-info` | #506775 | #93aab8 | Running, informational, people |
| Crimson | `mm-danger` | #a83634 | #ef8a84 | Failed, denied, destructive |

Each status has a `-soft` fill (`mm-success-soft`, `mm-warning-soft`, `mm-info-soft`, `mm-danger-soft`): the same hue at about 95% lightness. Text on a soft fill uses `mm-text` or the status text colour, never a lighter step. The editor has its own fixed set: `mm-code-bg` #171513 with `mm-code-text` and the `mm-syn-*` syntax colours.

Lineage: these values refine Marmot's existing earthy palette. The old `earthy-terracotta-700` maps to `mm-primary` and `earthy-brown-50` maps to `mm-paper`. If an existing screen uses an `earthy-*` class, translate it to the nearest semantic token rather than keeping the old value.

In Peat, keep neutral chroma at or below about 0.008 so it reads as warm graphite, not coffee-shop brown. Never use pure #000 or #fff for working surfaces. Show elevation with lighter surfaces (`mm-paper`, then `mm-surface`, then `mm-raised`), not shadows. Accents are desaturated and lightened so nothing glows.

### Colour rules

- The accent is burnt sienna: an earthy orange, deeper than the bright terracotta of many tools and well clear of crimson, so the primary button can't be mistaken for an error or a delete. Keep at least that distance from red.
- Burnt sienna is for the primary button, links, the active tab underline and the logo only. It carries no status meaning and is not used as a large fill. Selected items use the neutral `mm-selected`. Per row or card, burnt sienna appears at most once.
- Destructive actions use crimson plus an icon plus the word ("Delete asset"), so they can never be mistaken for the primary.
- Agents and people are told apart by icon and label (Material Symbols `smart-toy` versus `person`). The tint is secondary: `mm-primary-tint` for agents, `mm-info-soft` for people.
- Provider logos (PostgreSQL, Kafka, Snowflake and so on) are the only full-colour artwork in working views. They identify sources and are never recoloured.

### Typography

Two free font families under the SIL Open Font License: Geist for all text, titles included, and its companion Geist Mono for machine strings. They were drawn as a pair, so code and prose sit together without a change of voice. Both are plain and easy to read at small sizes, with clear, evenly fitted figures for a product full of counts and measures, and they sit quietly beside the wordmark. The interface uses no serif type; the one serif is the Marmot wordmark (QT Friz Quad, a free version of Friz Quadrata), which is fixed artwork. Character comes from the wordmark, burnt sienna and the contours, not from a stylised typeface. The fonts are self-hosted (Fontsource packages `@fontsource-variable/geist` and `@fontsource-variable/geist-mono`), so self-hosted installs make no calls to Google.

- **Display, `--font-display` (Geist).** The same family as the text, set large in semibold. Page titles (`display-title`, 34px), KPI values (`display-kpi`, 32px), section titles of 24px and above (`display-section`, 26px), empty-state headlines and marketing (`display-hero`, 56px). Weight 600, tracking −0.02em to −0.03em (tighter as the size grows), line height 1.0–1.15, at least weight 600 and 24px. Smaller headings use `heading` or `heading-sm`, and body text, buttons, labels, navigation and table cells use the text styles. Numbers in it use tabular figures. One display title per view region.
- **Text, `--font-text` (Geist).** All interface text. `body` is 16px/1.55; dense contexts (lists, tables, sidebars, metadata, toolbars, forms) use `dense` at 15px/1.45; captions use `caption` at 14px. Nothing is smaller than 13px. Every style moves together: change the scale as a whole rather than one context on its own. Weight 400 for text, 600 for emphasis, buttons and labels, 700 for headings under 24px. Sentence case everywhere. Field labels and column headers use `label`: 14px, 600, sentence case, `mm-text-2`.
- **Mono, `--font-mono` (Geist Mono).** Machine strings only: MRNs and asset identifiers, SQL and the editor, column types, IDs and hashes, log timestamps, result-grid cells and keyboard keys. Set it about 1px smaller than the surrounding text (`mono`, `mono-dense`, `mono-editor`). Its zero, O, one, l and I are distinct by design, so no slashed-zero feature is needed.
- **No uppercase.** Nothing in the interface is set in capitals: no uppercase labels, eyebrows, metadata strips or buttons. Metadata under a title is a sentence-case caption in the text face and `mm-text-2` ("1,284 rows · Updated 5 hours ago"), with relative times and only facts shown nowhere else on the page. Keyboard keys keep their own keycap style.
- **Numbers:** `tabular-nums` wherever numbers are compared. Right-align numbers and their column headers. Format compactly (`1.28M`, `412 ms`) with a non-breaking space before units.
- **Measure:** prose runs 60–75 characters. Tables and logs are exempt.

### Space, shape and elevation

- 4px base grid (`space-1` to `space-12`). Page gutters are `space-8` (32px) on desktop and `space-4` (16px) on mobile. Within a panel, `space-4` to `space-5`. Between related controls, `space-2`.
- Radius follows role: `radius-sm` (4px) for controls, inputs, tags and keycaps; `radius-md` (6px) for panels, cards, buttons and menus; `radius-lg` (10px) for dialogs; `radius-full` for avatars, status pills and filter pills only. A child's radius is never larger than its parent's.
- Panels and tables have no shadow: a 1px `mm-rule` border and the paper-to-surface step are enough. Only floating layers get a shadow: `shadow-float` for popovers, menus and toasts, `shadow-dialog` for dialogs and the command palette. Both are two-layer and ink-tinted.
- Do not nest panels. Inside a panel, separate sections with hairline rules or spacing.
- Table rows are `row-compact` (36px) or `row-default` (40px). Reduce row height rather than font size. Controls are `control-h` (36px) or `control-h-sm` (30px). The details blade is `blade-w` (36rem).

### Motion

- 120–160ms for presses and hovers, 150–200ms for menus and popovers, 200–250ms for dialogs and blades. Nothing exceeds 300ms. `bundle.css` exposes `--mm-ease` (`cubic-bezier(0.23, 1, 0.32, 1)`) and `--mm-dur-press`, `--mm-dur-menu`, `--mm-dur-dialog`.
- Animate only transform and opacity (and colour for state). Never write `transition: all`.
- The command palette, context menus and anything triggered from the keyboard appear instantly.
- No scroll-triggered fade-ups. Cards do not lift on hover; their border darkens instead.
- Delay spinners and skeletons about 200ms so fast loads never flash, then keep them visible for at least 400ms.
- A pulse is allowed only on something genuinely live, such as a running pipeline (`mm-status--live`).
- Under `prefers-reduced-motion`, movement becomes an opacity change and every loop stops.

## Using components

Components are web components (`mm-*`) from `@marmotdata/elements`, with React wrappers and Svelte types; `@marmotdata/css` has plain classes for static pages. Interface icons are Material Symbols Outlined at 16px and provider marks come from `@marmotdata/icons`, all bundled so nothing is fetched at runtime.

Redesign existing screens in place: keep each page's layout, sections, copy and controls, and apply this system on top.

The components that are easiest to misuse:

1. **Uppercase.** There is no uppercase text. Headings, labels, buttons and metadata are sentence case. A page header's metadata is a quiet caption that never repeats the kind the breadcrumbs give ("Term", "Data product") or a count shown on a tab.
2. **Burnt sienna.** One burnt-sienna thing per row at most, and it never means "good" or "warning".
3. **Cards.** Do not put cards inside a panel or lay out a grid of identical icon cards. Use a table, a list with thin rules or a single panel.
4. **Repeated state.** Show each piece of state once. Where there is a search bar, its tokens are the one summary of active filters, and the facet sidebar shows only its checkboxes (`hide-applied`). Do not echo the whole query back in the result count ("23 results" is enough). In step-by-step flows, the stepper names the step and shows what each finished step chose, so the step does not repeat its own name as a heading and the side summary only says what is still to come ("First run 10:00 UTC today"). Finished steps are quiet ticks; only the current step carries weight.
5. **Two editors for one value.** Give each value one editor. Search is one bar: free text and conditions as tokens, with the facets editing the same query. The query builder opens in place of the bar and writes back to it, so only one is on screen at a time.
6. **Page actions.** The More menu is for occasional or destructive actions. If people come to a page to do something, make it a visible button. Do not repeat sidebar destinations as header buttons, and keep "create" actions on the page that owns them. Each action appears once per screen: not in the header and again in a section, the blade or the More menu. Home is for getting back to work: recent items, things that need you, and the setup checklist on a new instance. A personal toggle such as Subscribe is a quiet icon button that shows its state (a filled bell when on), so it doesn't compete with the primary. Places to go (the source's own docs, a runbook) sit in a visible Links row under the header as small outlined buttons with the link's own icon (a provider logo, or a symbol for anything else) and an arrow showing they open a new tab. They stay out of More, and More leaves out anything already on screen (such as Copy MRN beside the MRN's own copy button).
7. **Lists that grow.** Design every list for hundreds of items: pagination, a search box, and dropdown filters (owner, tag). Filter pills only suit a short, fixed set of about six. A personal section such as "Your teams" shows five at most with Show all, and searching collapses everything into one ranked list. Tables fill the space they are given: no dead space beside a table and no clipped columns. Only scroll sideways when the columns truly cannot fit.
8. **Creating things.** A modal dialog is for a short decision or confirmation. Creating something opens in place and uses the finished page's sections, names and order, but leaves out what the system assigns: no MRN, caption, refresh status or other details until the thing exists. Ask for as little as possible, starting with what people came to write (the name), and fill in what you can (the owner as you). Do not put a helper field such as "paste a link" first; it does not fit every case and slows down the common one. Optional groups start as one "+ Add" button each and expand in place, so there's no wall of empty fields. Validate when a field is left and on submit, not while typing; a duplicate links to the existing record. Offer the better path once, as a quiet line next to the field it depends on ("Google Drive has a plugin that keeps assets like this up to date" under Where it lives), as a hint rather than a gate or a step. A "Create another" checkbox is not a second primary action. Options that add work or cost (a schedule, notifications) start off, and fields that depend on a switch appear only when it is on.
9. **Picking many things.** Show what is already chosen separately from search results, and give each result its own Link or Remove button that acts at once, with Undo in a toast. Never mix chosen and unchosen items in one checklist with "untick to remove". Show results with their logo and type, not their MRN.
10. **Previews and side panels.** A preview answers, in order: what is it, can I trust it, who do I ask, what does it mean, where does it flow. Lead with the logo, name and an "At a glance" list of the facts that decide whether someone can use it (type, freshness, personal data, popularity, size). Give each section one question to answer, with a plain heading ("Who to ask", "What it means", "Where it flows"). Fold identifiers and timestamps into a collapsible "More details" section, and put the next steps ("Open", "Query") in the footer, not a text link. Leave out histories that belong on the full page, such as a 30-run strip.
11. **Row actions.** A table row shows one visible button: the action that row needs most (Rotate key on an expiring key, Revoke on an active one). Everything else goes in a More menu at the end of the row. Two or three buttons side by side crowd the row and get cut off when space is tight.
12. **Rules and automations.** Anything that runs on its own (asset rules, data product rules, saved searches) reads as "Matches, then Adds or Does, then Applied to", in plain words first ("Tagged pii", "From Kafka") with the exact query second. Show what it adds by name, not as a count ("PII handling runbook", not "1 link"), keep its on/off switch visible where it is listed, and show one page per rule rather than splitting it across tabs. When a list mixes things people added and things rules brought in, group them by how they got there ("Added manually", then "From rules" under each rule) instead of a "How added" column; only the manual ones have Remove.
13. **Schemas.** Show a schema as an outline, not a grid of columns. Each field is two lines: name, type in everyday words ("Text", "Money (GBP)", "One of 3 values: WEB, IOS, ANDROID") and markers (Key, PII, Certified), then its description with glossary terms. Mark only exceptions ("Optional", "Edited", "92% filled"). Nesting becomes a tree only where it exists, top level open. Exact types, statistics, allowed values, who can see the field and its path live in a field panel opened by selecting it. Offer Structure, JSON and YAML views with Copy, showing the original Avro or JSON Schema when known.
14. **Runs and traces.** Show agent and pipeline runs as a list on the left and the selected run on the right, read as a story. A run is named by what it was asked ("Where is my order?"), with when, how long and how many steps as a caption, and a pill only when it failed. Each step reads in plain words ("Ran a query on orders → 5 rows") with a thin timing bar on the run's own clock. A refused or failed step is marked with its reason and the rule behind it. Raw inputs (SQL, arguments) fold away under "Show query", and tokens, model and IDs sit in More details. Never lead with function-call syntax or token counts.
15. **Search and filters.** Conditions are neutral tokens in plain words inside the search bar ("Type is Table", "Provider is Snowflake or BigQuery"). Click any part to change it, with a picker that fits the field. Several values of one field read as "is X or Y" instead of a separate OR. Typing `@` completes field, operator and value, and facets add and remove the same tokens. "Show as text" reveals the raw query in place, and a query the tokens cannot show opens as text, never a dead end. Avoid row-by-row builders with a joiner on every row. For anything more, "Build query" opens the query builder in place of the bar: groups with an All, Any or None switch and a plain hint ("Every condition must match"), rows that read as a sentence ("Where … and …") in the same columns at every level, nested up to three deep with a rule rather than a box, a live result count, and Apply or Cancel. A query the tokens cannot show offers Build query, so nothing is ever stuck as text. Offer only the operators the query engine accepts for each field: a glossary term "is" or "matches" a pattern; type, kind, provider and name take is, is not, contains and matches; metadata takes everything, including comparisons and "between" for numbers. Wildcards read as "matches" ("Name matches orders_*"). Any metadata key can be typed as a field.
16. **Key and value pairs.** Free-form metadata is rows of key, value and remove, with Add field. Pasting `key: value` lines splits them into rows, dotted keys mean nesting, and "Edit as JSON" is there for deeper structures.
17. **First use.** Before something is in use, hide panels that can only say "nothing yet". The welcome and the setup checklist may sit on the faint contour field; panels join as they gain something to show.
18. **Stay in the interface.** Setup flows do not hand people code to copy (CLI commands, SQL grants) unless that code is the task. Say what is needed in a sentence and link to the docs for the exact commands; keep actions such as Test connection as buttons.
19. **Lead with the headline feature.** Querying is what people connect sources for: where a plugin supports it, "Answer queries" sits at the top of its setup, on by default, and plugin lists mark "Supports querying" with its icon.
20. **Timelines.** A horizontal timeline is one straight line with a dot per step, the step's name and time under its dot, and the time between steps as a quiet caption on the line. No end ticks or drawing marks.
21. **Global search.** The search in the top bar opens the command palette (⌘K or Ctrl+K), never a separate search page or an inline dropdown. It mixes pages, commands and live catalog results, shows recent items before anything is typed, and every typed query ends with "Search the catalog for …", which opens Discover with that query. People can always get from the palette to every result, including when nothing matched.

### Data visualisation

- Grey is the main colour. Context series use `mm-text-3` or `mm-rule`. The one series that matters uses `mm-primary` or `mm-info`, and that is the only colour on the chart.
- Label lines and bars directly at their ends in 13px mono. Avoid legends.
- Range-frame axes span only the data's minimum to maximum, with endpoint values labelled. At most three 1px dotted gridlines, outward 4px ticks, no chart box.
- Bars have square or 1px tops. Area fills are a flat 8–12% tint, never a gradient. Hatch estimated or stale data.
- Sparklines are word-sized (64×16) with the last point marked by a 3px dot and its value printed in mono beside it.
- Annotate like a technical drawing: a 1px leader line with a dot terminal and a mono caption, and dimension brackets for time ranges such as an incident window.
- Use small multiples for per-source or per-domain health, with a shared scale, laid out like map sheets and labelled with a sentence-case caption.
- The signature chart is a contour or isoline density view (lineage density, query heat, usage) in `mm-contour` with 4–6 bands, the heaviest as an index contour in `mm-contour-index`.
- Categorical status colours sit at similar lightness so no category shouts.
- Structured values (metadata, JSON) use one text face and ink for every value; only the keys are mono, because people copy them. No colour by type. True and false read "Yes" and "No", a missing value reads "Not set", lists of plain values read inline, comma separated, and only objects fold open (clicking anywhere on the row). The raw JSON is one click away.
- Tooltips are square-cornered and ink-filled (`mm-tooltip`), with mono key/value pairs and tabular numbers, no blur, shown instantly.

### Signature details

- **Selection** is `mm-selected`, a neutral ink tint, with ink text, in place of browser blue or the accent tint.
- **Focus ring** is a 2px `mm-text` outline with a 2px offset on paper: at least 3:1 on every surface in both themes, and deliberately not burnt sienna so it can never be confused with selection.
- **Drawing conventions** appear sparingly in charts and empty states: leader lines with dots and dimension ticks where they explain something. Never decorative marks such as crosshairs, corner ticks or stray "+" glyphs.
- **Typographic details:** curly quotes, a real ellipsis (…), non-breaking spaces in `10 MB` and `⌘ K`, and numerals for counts.
- **Sample data** is specific and plausible: `orders_daily`, `customers_dim`, `shop.orders.v2`, `mrn://postgresql/table/shop.public.orders`, row counts like 1,284,019, owners like "Analytics Engineering", people like "Jane Doe". No lorem ipsum or "Acme Corp". Agents and other clients have neutral names ("support-triage-agent", "cli-agent") and the generic agent logo rather than a real vendor's.

## Logo

The logo is the Marmot wordmark only (`mm-logo`, with an "M" monogram in the collapsed sidebar). There is no mascot or pictorial mark anywhere: it reads as more professional. The wordmark is fixed artwork in ink or paper: use it as supplied, without redrawing, re-typesetting or a gradient tile. Empty states use the contour motif as a faint background field instead of an illustration.

## Copy

### Voice

- British English in sentence case, written in full sentences in a calm, specific, human voice. Write for any employee, not just engineers: someone in finance or support should understand every label and message.
- Explain in everyday words first and keep the technical term for where it helps ("Who can see this data", not "ACL"). When a technical word is the right one (SQL, schema, MRN), use it without apology.
- The product term is "catalog".
- Say what happened and what to do next. Nothing else.
- No em dashes, hype verbs ("Supercharge", "Unlock", "Seamless"), staccato fragments or grouping in threes for rhythm.

### Words

- Use the plain, common word over an idiom: "manually" not "by hand", "automatically" not "on its own", "remove" not "get rid of".
- Labels use the same words as the sentences around them: "Manual" and "From rules", not "Added by hand" and "Dynamic".
- One name per thing, everywhere: a data product is never also a "bundle" or a "collection".

### Buttons and labels

- Buttons are a verb plus an object ("Run query", "Add plugin", "Delete asset"). No "→" on buttons.
- Labels and headers are sentence case. A heading does not need a description when it already says it.
- Destructive actions say what they destroy ("Delete data product", not "Delete").

### Numbers and live data

- Never write sentences that summarise live data, such as "One pipeline failed overnight and 37 queries were refused." The app has to count, pluralise and translate every combination, and the sentence goes stale the moment a number changes. Headings and descriptions stay static; numbers live in the components made for them (KPI tiles, counts, status pills, lists).
- A KPI tile's context line is fixed text too ("Last 30 days", "Refused by policy before running"), never "27 of 30 runs succeeded". A second number gets its own tile or field.
- Do not spell out counts that a shape already shows. A folded object or list shows a brace and a preview of what is inside, not "6 keys" or "1 item"; screen readers still hear the count.
- Prefer a visual to a figure when the exact value does not change what someone does. Popularity is four bars, not "Top 9%" or "988 views"; keep exact numbers for things people act on or compare.
- Do not repeat state. "23 results" is enough; never echo the whole query or the applied filters back in the count.
- Numerals for counts (3 owners, not three owners).

### Cut

- Filler: figure captions, "for example" notes, lines that narrate what the screen shows, helper text that restates the label or explains the obvious ("Click to open").
- More than one short sentence of description under a heading.
- Badges for the happy path. "Succeeded", "Allowed" and "Active" are the default and need no pill.
- Product versions, builds and hostnames on any screen a signed-out person can reach.

### Empty states and errors

- Empty states say what is missing and what to do about it: "No assets have been catalogued from this source yet. Add a plugin to catalogue it."
- Errors say what failed, why if known, and the next step: "The run failed after 412 ms because the credentials expired. Update them in Plugins."
- Content a plugin or an agent generated carries a small "Plugin" or "Generated" tag, never a sparkle.

## Accessibility

Verified WCAG 2.2 contrast, light on `mm-paper` unless stated: ink 17.6:1, ink-2 7.3:1 (6.8:1 on sunken), ink-3 5.2:1, burnt sienna 5.1:1 (4.7:1 on sunken), white on burnt sienna 5.2:1, white on hover 6.9:1, moss 5.2:1, slate 5.8:1, crimson 6.3:1, white on crimson 6.5:1, ochre text 5.5:1, control border 3.2:1. Ochre #a27825 (3.9:1) and contour (3.9:1) are for marks and large text only. Peat on `mm-surface`: text 15.1:1, text-2 7.1:1, text-3 4.5:1, burnt sienna text 7.6:1, white on the button fill 5.0:1, moss 7.7:1, ochre 7.9:1, slate 7.2:1, crimson 7.2:1, control border 3.6:1. In Peat `mm-text-3` drops to 4.1:1 on `mm-raised`, so captions in popovers and dialogs use `mm-text-2` there.

- Body text targets 7:1 (`mm-text`, `mm-text-2`). Nothing that must be read falls below 4.5:1.
- `mm-rule` (1.3:1) is decorative only. Inputs and checkboxes use `mm-control-border`.
- Focus is always visible through `:focus-visible`; sticky headers never hide the focused element.
- Interactive targets are at least 24×24px on desktop and 44×44px (`target-touch`) on touch.
- Never rely on colour alone. Status pills carry words. Run strips and lineage edges carry a pattern or icon too (failed runs show an ×, observed edges are dashed). Charts use direct labels. Destructive actions say what they destroy.
- Hover, active and focus states increase contrast, never reduce it.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`. Set `color-scheme` on the root and a `theme-color` meta matching `mm-paper`.
- Mobile inputs are at least 16px so iOS does not zoom.

### Keyboard

- Everything you can do with a mouse, you can do with a keyboard, in a sensible Tab order.
- Composite widgets (lists, tabs, segmented controls, grids, menus) are one Tab stop with arrow keys inside, following the WAI-ARIA Authoring Practices pattern for that widget.
- Escape closes the innermost popup, menu, drawer or dialog, and focus returns to what opened it.
- When something is added, focus moves to it (a new query condition focuses its first field). When something is removed, focus moves to the next item, or to the control that adds more.
- Enter in a search or filter box runs it. Keyboard-opened popups appear instantly, with no animation.

### Screen readers

- Every control has a name: a visible label, or a hidden one when the design shows none. Hidden labels are specific ("Remove condition 2", not "Remove").
- Icons beside text are decorative and hidden. Icon-only buttons carry the name.
- Visual summaries have a text alternative: popularity bars read "Popularity: high", run strips "Last 7 runs of postgres-shop", charts offer their values.
- Changes that happen without a page load are announced politely: result counts, suggestion lists opening, items added or removed, copy confirmations.
- Nothing essential lives only in a tooltip or a `title`.
- Pages use landmarks (navigation, main) and headings in order, so people can jump between sections.

### Checking

- Every interactive component has keyboard tests in its stories and passes axe with violations treated as errors.
- Before shipping a screen, use it with the keyboard alone, then with a screen reader (VoiceOver or NVDA): can you reach, understand and complete every task?

## Before you ship a screen

1. Cover the logo. Would people still recognise the screen as Marmot, or could it belong to any other product?
2. Is burnt sienna on less than about 5% of the screen, and on no more than one thing per row?
3. Could someone outside the data team understand every label and message?
4. Is any piece of information shown twice, or any value editable in two places at once?
5. Does any sentence depend on live numbers? Move the numbers into a tile, count or pill.
6. Are there cards inside cards, icons in tinted circles, coloured stripes, glass, gradients or scroll animations?
7. Do corner radii follow their roles (4px controls, 6px panels and buttons, 10px dialogs)?
8. Are numbers right-aligned with even-width digits, and is monospace used only for text people copy?
9. Does every status have a word or icon as well as a colour?
10. Can you complete every task with the keyboard alone, and does a screen reader announce what changed?
11. Does the dark theme (Peat) use its own palette, with no pure black or white?
12. Is the sample data realistic ("orders_daily", "Jane Doe")?
13. Is there one bold idea on the screen, not several? If in doubt, remove something.
