/**
 * The CodeMirror half of `mm-code-editor`. Everything here is reached through a dynamic import from
 * `firstUpdated`, so CodeMirror never sits in the bundle of a page that only renders the element's
 * static fallback. Language packages are split again, so a JSON editor never loads the SQL grammar.
 */
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { linter, lintGutter, lintKeymap, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { marmotEditor } from './theme.js';

export { marmotEditor, marmotEditorTheme, marmotHighlightStyle } from './theme.js';

export interface EditorDiagnostic {
  /** Start offset in the document. */
  from: number;
  /** End offset in the document. */
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface CreateEditorOptions {
  parent: HTMLElement;
  root: ShadowRoot | Document;
  value: string;
  language: Extension;
  extra: Extension;
  readonly: boolean;
  disabled: boolean;
  attributes: Record<string, string>;
  placeholder: string;
  diagnostics: EditorDiagnostic[];
  onChange(value: string): void;
  onFocusChange(focused: boolean): void;
}

export interface EditorHandle {
  readonly view: EditorView;
  setValue(value: string): void;
  setLanguage(language: Extension): void;
  setExtra(extra: Extension): void;
  setEditable(readonly: boolean, disabled: boolean): void;
  setAttributes(attributes: Record<string, string>): void;
  setPlaceholder(text: string): void;
  setDiagnostics(diagnostics: EditorDiagnostic[]): void;
  /** The main selection, or the empty string and the cursor position when nothing is selected. */
  selection(): { text: string; from: number; to: number };
  focus(): void;
  destroy(): void;
}

/** Loads the CodeMirror language for `mm-code-editor`'s `language` attribute. */
export async function languageFor(language: string): Promise<Extension> {
  switch (language) {
    case 'sql': {
      const { sql, PostgreSQL } = await import('@codemirror/lang-sql');
      return sql({ dialect: PostgreSQL, upperCaseKeywords: false });
    }
    case 'json': {
      const { json } = await import('@codemirror/lang-json');
      return json();
    }
    case 'yaml': {
      const { yaml } = await import('@codemirror/lang-yaml');
      return yaml();
    }
    default:
      return [];
  }
}

const toCm = (doc: number, list: EditorDiagnostic[]): Diagnostic[] =>
  list.map((d) => {
    const from = Math.max(0, Math.min(doc, d.from));
    const to = Math.max(from, Math.min(doc, d.to));
    return { from, to, severity: d.severity, message: d.message };
  });

export function createEditor(o: CreateEditorOptions): EditorHandle {
  const language = new Compartment();
  const extra = new Compartment();
  const editable = new Compartment();
  const attrs = new Compartment();
  const placeholder = new Compartment();
  const editableExt = (readonly: boolean, disabled: boolean) => [
    EditorState.readOnly.of(readonly || disabled),
    EditorView.editable.of(!disabled),
    // Marks the whole editor, gutters included, as disabled for assistive technology and checkers.
    disabled ? EditorView.editorAttributes.of({ 'aria-disabled': 'true' }) : [],
  ];
  const state = EditorState.create({
    doc: o.value,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      dropCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ icons: true }),
      EditorState.tabSize.of(2),
      indentUnit.of('  '),
      linter(null),
      lintGutter(),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...lintKeymap, indentWithTab]),
      marmotEditor,
      language.of(o.language),
      extra.of(o.extra),
      editable.of(editableExt(o.readonly, o.disabled)),
      attrs.of(EditorView.contentAttributes.of(o.attributes)),
      placeholder.of(o.placeholder ? placeholderExt(o.placeholder) : []),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) o.onChange(u.state.doc.toString());
        if (u.focusChanged) o.onFocusChange(u.view.hasFocus);
      }),
    ],
  });
  const view = new EditorView({ state, parent: o.parent, root: o.root });
  if (o.diagnostics.length) view.dispatch(setDiagnostics(view.state, toCm(view.state.doc.length, o.diagnostics)));

  return {
    view,
    setValue(value) {
      if (value === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    },
    setLanguage: (ext) => view.dispatch({ effects: language.reconfigure(ext) }),
    setExtra: (ext) => view.dispatch({ effects: extra.reconfigure(ext) }),
    setEditable: (readonly, disabled) => view.dispatch({ effects: editable.reconfigure(editableExt(readonly, disabled)) }),
    setAttributes: (a) => view.dispatch({ effects: attrs.reconfigure(EditorView.contentAttributes.of(a)) }),
    setPlaceholder: (text) => view.dispatch({ effects: placeholder.reconfigure(text ? placeholderExt(text) : []) }),
    setDiagnostics: (list) => view.dispatch(setDiagnostics(view.state, toCm(view.state.doc.length, list))),
    selection() {
      const r = view.state.selection.main;
      return { text: view.state.sliceDoc(r.from, r.to), from: r.from, to: r.to };
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
