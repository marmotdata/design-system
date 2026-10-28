# Open items

## Values that should become tokens

The library fills these locally, using existing tokens where it can.

| # | Value | Where it lives now |
|---|---|---|
| 1 | Motion: `ease` and the press 140ms, menu 180ms and dialog 220ms durations. | `packages/tokens/source/motion.json`, outside `tokens.json`. |
| 2 | Tertiary text inside a selected row. Peat `text-3` on the selection fill is under 4.5:1. | Elements switch to `--mm-text-2` in selected rows. |
| 3 | `code-control-border` (proposal `#8d8883`, 5.19:1 on `code-bg`). | The copy button borrows `--mm-syn-comment`. |
| 4 | `danger-hover`. | `color-mix(in oklab, var(--mm-danger-fill), var(--mm-text) 12%)`. |
| 5a | Scrim: ink at 40% on Light, paper at 64% on Peat. | `--mm-scrim` in the tokens build. |
| 5b | Z-index layers. | `--mm-z-*` in the tokens build. |
| 5c | Breakpoints (720px and 880px). | Literal values in `@container` rules. |
| 5d | Focus ring width and offset (2px, 2px). | `--mm-focus-*` in the tokens build. |
| 5e | Control and row sizes: 32px menu row and table header, 24px icon button, 40×24 switch, 12×20 slider thumb, 320px popup height, 6px field gap, 10px menu-row padding. | Local values in components. |
| 5f | 11px regular mono for chart text. | Nearest mono style. |
| 5g | Lineage "selected, not current" and minimap colours. | Mixes of `--mm-rule` and `--mm-text-3`. |
| 5h | Error colour on the code ground. | `color-mix` of `--mm-danger` and `--mm-code-text`. |
| 5i | Hatch spacing for estimated data. | Local value in chart-core. |
| 6 | A tag fill that shows on Peat (`sunken` is too close to paper). | None; text contrast passes, only the chip shape is lost. |
| 7 | `chrome` (sidebar, top bar, blade) and `selected` (neutral selection fill). | `--mm-chrome` and `--mm-selected` in the tokens build. |

## Guidelines to update

`apps/storybook/src/foundations/guidelines.md` still describes these the old way; the library already follows the new rule.

- Logo: wordmark only, plus the "M" monogram for the collapsed sidebar. No illustration.
- Decoration: contours only as a faint background field, never an illustration.
- Light sidebar on paper; selection is a neutral fill, never the red tint.
- Typography: mono only for code, SQL, the asset MRN and ID columns; no uppercase text; display face for page titles, KPI values and marketing heroes. Full rules in `docs/authoring.md`.

## Artwork

38 providers have no mark and fall back to a generic icon, and Pulsar needs a Peat variant. See `packages/icons/MISSING-MARKS.md`.
