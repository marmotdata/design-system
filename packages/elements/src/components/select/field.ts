import { html, nothing, type TemplateResult } from 'lit';
import { t, tr, type StringKey } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

/** The shared label, help, error and box styles from form-field, so every Marmot field is identical. */
export { fieldStyles } from '../form-field/class.js';

/** Help and error lines under a control. Ids are `help` and `error` inside the shadow root. */
export function helpAndError(help: string, error: string): TemplateResult {
  return html`${help ? html`<p class="help" id="help" part="help">${help}</p>` : nothing}
    ${error
      ? html`<p class="error" id="error" part="error"><mm-icon name="error" size="14"></mm-icon><span>${error}</span></p>`
      : nothing}`;
}

/** aria-describedby value for the help and error lines. */
export const describedBy = (help: string, error: string): string | undefined =>
  [help ? 'help' : '', error ? 'error' : ''].filter(Boolean).join(' ') || undefined;

/**
 * British English fallbacks for built-in strings that are not in core `defaultStrings`; `tr()` uses
 * the app's translation when one is set.
 */
const fallbacks = {
  selectPlaceholder: 'Select an option',
  chooseOption: 'Choose an option.',
  fillField: 'Fill in this field.',
  searching: 'Searching',
  loadFailed: 'Results could not be loaded.',
  retry: 'Try again',
  removeValue: 'Remove {label}',
  moreSelected: '{n} more selected',
  sliderMinimum: 'Minimum {label}',
  sliderMaximum: 'Maximum {label}',
  useCustom: 'Press Enter to use “{text}”.',
} as const;
export type LocalStringKey = keyof typeof fallbacks;

export function str(key: LocalStringKey | StringKey, vars?: Record<string, string | number>): string {
  const fallback = (fallbacks as Record<string, string>)[key] ?? (t(key as StringKey) as string | undefined) ?? key;
  return tr(key, fallback, vars);
}
