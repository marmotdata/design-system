/**
 * The Marmot CodeMirror theme: the warm near-black code ground in both themes, Geist Mono,
 * and the `mm-syn-*` syntax colours. Every colour is a `var(--mm-…)` string, so the editor
 * follows the tokens without a rebuild. Selection, cursor, gutters, the active line and matching
 * brackets are mixed from `mm-code-text`, `mm-code-bg` and `mm-syn-keyword`.
 *
 * Importing this module pulls in `@codemirror/view` and `@codemirror/language`. `mm-code-editor`
 * only loads it lazily; import it yourself only where you build your own CodeMirror view.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

const mix = (a: string, pct: number, b = 'transparent') => `color-mix(in oklab, var(${a}) ${pct}%, ${b.startsWith('--') ? `var(${b})` : b})`;

/** Selection and the selected completion row: burnt sienna's code-ground keyword colour at low strength. */
const selection = mix('--mm-syn-keyword', 30, '--mm-code-bg');
/** Crimson lifted toward the code ink so the underline reads on the dark ground in Light as well as Peat. */
export const codeDanger = mix('--mm-danger', 72, '--mm-code-text');
/** Ochre for warnings on the code ground. */
export const codeWarning = 'var(--mm-syn-function)';
/** Slate for info diagnostics on the code ground. */
export const codeInfo = 'var(--mm-syn-number)';

/** The theme spec, as a plain object, for anyone composing their own `EditorView.theme`. */
export const marmotEditorThemeSpec: Record<string, Record<string, string>> = {
  '&': {
    backgroundColor: 'var(--mm-code-bg)',
    color: 'var(--mm-code-text)',
    font: 'var(--text-mono-editor)',
    height: '100%',
    borderRadius: 'inherit',
  },
  '&.cm-focused': {
    outline: 'var(--mm-focus-ring-width, 2px) solid var(--mm-text)',
    outlineOffset: 'var(--mm-focus-ring-offset, 2px)',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    overflow: 'auto',
    borderRadius: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--mm-code-text)',
    padding: '14px 0',
  },
  '.cm-line': { padding: '0 16px 0 6px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--mm-code-text)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: selection,
  },
  '.cm-selectionMatch': { backgroundColor: mix('--mm-code-text', 12) },
  '.cm-activeLine': { backgroundColor: mix('--mm-code-text', 5) },
  '.cm-gutters': {
    backgroundColor: 'var(--mm-code-bg)',
    color: 'var(--mm-syn-comment)',
    border: 'none',
    borderStartStartRadius: 'inherit',
    borderEndStartRadius: 'inherit',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px', minWidth: '2.5ch' },
  '.cm-activeLineGutter': { backgroundColor: mix('--mm-code-text', 5), color: 'var(--mm-code-text)' },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: mix('--mm-code-text', 16),
    outline: `1px solid ${mix('--mm-code-text', 45)}`,
    color: 'inherit',
  },
  '&.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'transparent',
    textDecoration: `underline wavy ${codeDanger}`,
  },
  '.cm-placeholder': { color: 'var(--mm-syn-comment)', fontStyle: 'italic' },
  '.cm-foldPlaceholder': {
    backgroundColor: mix('--mm-code-text', 10),
    border: 'none',
    color: 'var(--mm-code-text)',
  },
  '.cm-panels': { backgroundColor: 'var(--mm-code-bg)', color: 'var(--mm-code-text)' },
  '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${mix('--mm-code-text', 18)}` },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${mix('--mm-code-text', 18)}` },
  '.cm-searchMatch': { backgroundColor: mix('--mm-syn-function', 28), outline: `1px solid ${mix('--mm-syn-function', 60)}` },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: selection },
  '.cm-textfield': {
    backgroundColor: 'var(--mm-code-bg)',
    color: 'var(--mm-code-text)',
    border: '1px solid var(--mm-syn-comment)',
    borderRadius: 'var(--radius-sm)',
    font: 'var(--text-mono-dense)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'transparent',
    color: 'var(--mm-code-text)',
    border: '1px solid var(--mm-syn-comment)',
    borderRadius: 'var(--radius-sm)',
    font: 'var(--text-label)',
  },

  // Tooltips and completions sit on the code ground too: hairline border, radius-sm, the float shadow and no glow.
  '.cm-tooltip': {
    backgroundColor: 'var(--mm-code-bg)',
    color: 'var(--mm-code-text)',
    border: `1px solid ${mix('--mm-code-text', 22)}`,
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-float)',
    font: 'var(--text-mono-dense)',
    zIndex: 'var(--mm-z-popover)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
    maxHeight: '16em',
    minWidth: '18em',
    padding: '4px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 6px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: '1.45',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: selection,
    color: 'var(--mm-code-text)',
  },
  '&:not(.cm-focused) .cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: mix('--mm-code-text', 12),
  },
  '.cm-completionLabel': { flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '700', color: 'var(--mm-code-text)' },
  '.cm-completionDetail': {
    marginInlineStart: 'auto',
    paddingInlineStart: '12px',
    fontStyle: 'normal',
    font: 'var(--text-caption)',
    color: mix('--mm-code-text', 78, '--mm-code-bg'),
    whiteSpace: 'nowrap',
  },
  '.cm-completionIcon': { width: '1.2em', opacity: '0.8', color: 'var(--mm-syn-comment)', paddingRight: '0' },
  '.cm-completionIcon-keyword': { color: 'var(--mm-syn-keyword)' },
  '.cm-completionIcon-function, .cm-completionIcon-method': { color: 'var(--mm-syn-function)' },
  '.cm-completionIcon-property, .cm-completionIcon-variable': { color: 'var(--mm-syn-number)' },
  '.cm-completionInfo': {
    backgroundColor: 'var(--mm-code-bg)',
    color: 'var(--mm-code-text)',
    border: `1px solid ${mix('--mm-code-text', 22)}`,
    borderRadius: 'var(--radius-sm)',
    padding: '6px 8px',
    font: 'var(--text-caption)',
  },

  // Diagnostics: a wavy underline (shape) plus a gutter mark (icon) plus the message (word), never colour alone.
  '.cm-lintRange': { backgroundImage: 'none', paddingBottom: '0' },
  '.cm-lintRange-error': { textDecoration: `underline wavy ${codeDanger}`, textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { textDecoration: `underline wavy ${codeWarning}`, textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
  '.cm-lintRange-info, .cm-lintRange-hint': { textDecoration: `underline dotted ${codeInfo}`, textUnderlineOffset: '3px' },
  '.cm-diagnostic': { padding: '4px 8px', font: 'var(--text-caption)', borderLeft: 'none' },
  '.cm-diagnostic-error': { borderLeft: 'none' },
  '.cm-diagnostic-warning': { borderLeft: 'none' },
  '.cm-diagnosticText': { color: 'var(--mm-code-text)' },
  '.cm-tooltip-lint': { padding: '2px 0' },
  '.cm-gutter-lint': { width: '1.1em' },
  '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 6px' },
  '.cm-lint-marker': { width: '0.9em', height: '0.9em', content: 'normal' },
  '.cm-lintRange-active': { backgroundColor: mix('--mm-code-text', 10) },
  '.cm-lintPoint:after': { borderBottomColor: codeDanger },
  '.cm-lintPoint-warning:after': { borderBottomColor: codeWarning },
  '.cm-lintPoint-info:after, .cm-lintPoint-hint:after': { borderBottomColor: codeInfo },
  '.cm-panel.cm-panel-lint ul [aria-selected]': { backgroundColor: selection, color: 'var(--mm-code-text)' },
  '.cm-panel.cm-panel-lint ul:focus [aria-selected]': { backgroundColor: selection, color: 'var(--mm-code-text)' },
  '.cm-lint-marker-error': {
    content: 'normal',
    // An × in a circle, drawn with a mask so the colour stays a token.
    backgroundColor: codeDanger,
    maskImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm2.8 8.7-1.1 1.1L8 9.1l-1.7 1.7-1.1-1.1L6.9 8 5.2 6.3l1.1-1.1L8 6.9l1.7-1.7 1.1 1.1L9.1 8Z'/%3E%3C/svg%3E\")",
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
  },
  '.cm-lint-marker-warning': {
    content: 'normal',
    backgroundColor: codeWarning,
    maskImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1 15 14H1Zm-.8 4.5v4h1.6v-4Zm0 5.3v1.6h1.6v-1.6Z'/%3E%3C/svg%3E\")",
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
  },
  '.cm-lint-marker-info': {
    content: 'normal',
    backgroundColor: codeInfo,
    maskImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.8 3h1.6v1.6H7.2Zm0 3h1.6v5H7.2Z'/%3E%3C/svg%3E\")",
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
  },
};

/** The Marmot editor chrome as a CodeMirror extension. Always a dark theme: the code ground is dark in Light and Peat. */
export const marmotEditorTheme: Extension = EditorView.theme(marmotEditorThemeSpec, { dark: true });

/** Syntax colours from the `mm-syn-*` tokens, matching `.k .f .s .n .c` in code samples. */
export const marmotHighlightStyle: HighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.modifier], color: 'var(--mm-syn-keyword)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.standard(tags.name), tags.typeName, tags.className], color: 'var(--mm-syn-function)' },
  { tag: [tags.propertyName, tags.definition(tags.propertyName), tags.attributeName], color: 'var(--mm-syn-function)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--mm-syn-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit, tags.constant(tags.name)], color: 'var(--mm-syn-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--mm-syn-comment)', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.operator, tags.bracket, tags.separator], color: 'var(--mm-code-text)' },
  { tag: [tags.special(tags.name), tags.labelName], color: 'var(--mm-syn-number)' },
  { tag: tags.invalid, textDecoration: `underline wavy ${codeDanger}` },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
]);

/** Theme plus highlighting, ready to drop into an `extensions` array. */
export const marmotEditor: Extension = [marmotEditorTheme, syntaxHighlighting(marmotHighlightStyle)];
