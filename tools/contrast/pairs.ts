import type { Kind } from './lib.ts';

/**
 * Every foreground/background pair the guidelines documents or the elements use.
 * `kind`: text (4.5:1), large (3:1, 24px+ or 19px bold), ui (3:1, control boundaries and marks).
 * `themes` limits a pair to one theme. `allow` documents a exception allowed by the guidelines: the pair
 * is reported but does not fail, because the guidelines forbids that use (the elements follow it).
 */
export interface Pair {
  fg: string;
  bg: string;
  kind: Kind;
  where: string;
  themes?: ('light' | 'dark')[];
  allow?: string;
}

const surfaces = ['mm-paper', 'mm-surface', 'mm-sunken', 'mm-raised'] as const;

export const pairs: Pair[] = [
  ...surfaces.map((bg) => ({ fg: 'mm-text', bg, kind: 'text' as const, where: 'Body text' })),
  ...surfaces.map((bg) => ({ fg: 'mm-text-2', bg, kind: 'text' as const, where: 'Secondary text, labels, table headers' })),
  ...(['mm-paper', 'mm-surface', 'mm-sunken'] as const).map((bg) => ({ fg: 'mm-text-3', bg, kind: 'text' as const, where: 'Captions, tertiary text' })),
  {
    fg: 'mm-text-3', bg: 'mm-raised', kind: 'text', where: 'Captions on popovers and dialogs', themes: ['dark'],
    allow: 'Guidelines: "In Peat mm-text-3 drops to 4.1:1 on mm-raised, so captions in popovers and dialogs use mm-text-2 there." Elements use mm-text-2 on raised layers in both themes.',
  },
  { fg: 'mm-text-3', bg: 'mm-raised', kind: 'text', where: 'Captions on popovers and dialogs', themes: ['light'] },
  {
    fg: 'mm-text-3', bg: 'mm-primary-tint', kind: 'text', where: 'Tertiary text in a selected row', themes: ['dark'],
    allow: 'docs/open-items.md, item 2. Elements switch tertiary text to mm-text-2 inside selected rows and items.',
  },
  { fg: 'mm-text-3', bg: 'mm-primary-tint', kind: 'text', where: 'Tertiary text in a selected row', themes: ['light'] },
  { fg: 'mm-text-2', bg: 'mm-primary-tint', kind: 'text', where: 'Secondary text in a selected row' },
  { fg: 'mm-text', bg: 'mm-primary-tint', kind: 'text', where: 'Selected row and nav item text' },
  ...(['mm-paper', 'mm-surface', 'mm-sunken'] as const).map((bg) => ({ fg: 'mm-primary', bg, kind: 'text' as const, where: 'Links and the active tab' })),
  { fg: 'mm-primary', bg: 'mm-primary-tint', kind: 'ui', where: 'Current lineage node border' },
  { fg: 'mm-on-primary', bg: 'mm-primary-fill', kind: 'text', where: 'Primary button label' },
  { fg: 'mm-on-primary', bg: 'mm-primary-hover', kind: 'text', where: 'Primary button label, hover' },
  { fg: 'mm-on-primary', bg: 'mm-danger-fill', kind: 'text', where: 'Danger button label' },
  { fg: 'mm-on-inverse', bg: 'mm-text', kind: 'text', where: 'Selected segment, filter pill, tooltip' },
  ...(['mm-paper', 'mm-surface'] as const).map((bg) => ({ fg: 'mm-success', bg, kind: 'text' as const, where: 'Moss status text' })),
  { fg: 'mm-success', bg: 'mm-success-soft', kind: 'text', where: 'Success pill' },
  ...(['mm-paper', 'mm-surface'] as const).map((bg) => ({ fg: 'mm-warning-text', bg, kind: 'text' as const, where: 'Ochre warning text' })),
  { fg: 'mm-warning-text', bg: 'mm-warning-soft', kind: 'text', where: 'Warning pill' },
  { fg: 'mm-warning', bg: 'mm-paper', kind: 'ui', where: 'Ochre icons and marks (never body text)' },
  { fg: 'mm-warning', bg: 'mm-warning-soft', kind: 'ui', where: 'Warning callout icon' },
  ...(['mm-paper', 'mm-surface'] as const).map((bg) => ({ fg: 'mm-info', bg, kind: 'text' as const, where: 'Slate status text' })),
  { fg: 'mm-info', bg: 'mm-info-soft', kind: 'text', where: 'Info pill' },
  ...(['mm-paper', 'mm-surface'] as const).map((bg) => ({ fg: 'mm-danger', bg, kind: 'text' as const, where: 'Crimson status and error text' })),
  { fg: 'mm-danger', bg: 'mm-danger-soft', kind: 'text', where: 'Failed pill, error callout' },
  { fg: 'mm-text', bg: 'mm-success-soft', kind: 'text', where: 'Callout title on soft fill' },
  { fg: 'mm-text', bg: 'mm-warning-soft', kind: 'text', where: 'Callout title on soft fill' },
  { fg: 'mm-text', bg: 'mm-info-soft', kind: 'text', where: 'Callout title on soft fill' },
  { fg: 'mm-text', bg: 'mm-danger-soft', kind: 'text', where: 'Callout title on soft fill' },
  { fg: 'mm-text-2', bg: 'mm-success-soft', kind: 'text', where: 'Callout body on soft fill' },
  { fg: 'mm-text-2', bg: 'mm-warning-soft', kind: 'text', where: 'Callout body on soft fill' },
  { fg: 'mm-text-2', bg: 'mm-info-soft', kind: 'text', where: 'Callout body on soft fill' },
  { fg: 'mm-text-2', bg: 'mm-danger-soft', kind: 'text', where: 'Callout body on soft fill' },
  ...(['mm-paper', 'mm-surface'] as const).map((bg) => ({ fg: 'mm-control-border', bg, kind: 'ui' as const, where: 'Input, checkbox and secondary button borders' })),
  ...surfaces.map((bg) => ({ fg: 'mm-text', bg, kind: 'ui' as const, where: 'Focus ring' })),
  { fg: 'mm-text', bg: 'mm-primary-fill', kind: 'ui', where: 'Focus ring around a primary button (ring sits on paper, offset 2px)', allow: 'The ring is drawn 2px outside the button on paper, so it is measured against mm-paper (covered above).' },
  { fg: 'mm-contour', bg: 'mm-paper', kind: 'ui', where: 'Contour motif (decorative)' },
  { fg: 'mm-text-3', bg: 'mm-paper', kind: 'ui', where: 'Chart axes and context series' },
  { fg: 'mm-code-text', bg: 'mm-code-bg', kind: 'text', where: 'Editor text' },
  ...(['mm-syn-keyword', 'mm-syn-function', 'mm-syn-string', 'mm-syn-number', 'mm-syn-comment'] as const).map((fg) => ({ fg, bg: 'mm-code-bg', kind: 'text' as const, where: 'Syntax colour' })),
  { fg: 'mm-syn-comment', bg: 'mm-code-bg', kind: 'ui', where: 'Code block copy button border (stand-in for token request 3)' },
];
