import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { uid } from '../../core/id.js';
import { t } from '../../core/strings.js';
import { base } from '../../core/styles.js';
import { fieldStyles } from '../form-field/class.js';
import '@marmotdata/icons/define.js';

const choiceTags = new Set(['mm-checkbox', 'mm-switch', 'mm-radio']);

const isControl = (el: Element): boolean =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLSelectElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLButtonElement ||
  el instanceof HTMLFieldSetElement ||
  !!(el.constructor as { formAssociated?: boolean }).formAssociated ||
  (el.localName.startsWith('mm-') && 'disabled' in el);

/**
 * Fieldsets group related controls under one legend: "Schedule", "Notifications", "Connection".
 * The legend uses the label style, an optional description sits under it, and controls stack
 * `space-4` apart (`space-2` for a list of checkboxes or switches). There is no box by default,
 * because structure should be felt and not seen; `bordered` adds a single hairline when a group
 * must stand apart inside a long form.
 *
 * `disabled` disables every control inside, native and Marmot alike, and restores exactly the
 * controls it disabled when cleared. The legend and description name and describe the group for
 * assistive technology through a native fieldset in the shadow root.
 *
 * @tagname mm-fieldset
 * @summary Groups related controls under a legend.
 * @slot - The controls.
 * @slot label - A rich legend, in place of the `label` attribute.
 * @csspart fieldset - The native fieldset.
 * @csspart legend - The legend.
 * @csspart description - The description line.
 * @csspart controls - The wrapper that spaces the controls.
 * @csspart error - The error line.
 */
export class MmFieldset extends LitElement {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      fieldset {
        display: block;
        min-width: 0;
        margin: 0;
        padding: 0;
        border: 0;
      }
      :host([bordered]) fieldset {
        padding: var(--space-4) var(--space-5) var(--space-5);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      legend {
        float: inline-start;
        width: 100%;
        padding: 0;
        margin: 0 0 6px;
      }
      .description {
        clear: both;
        margin: 0 0 var(--space-3);
        font: var(--text-caption);
        color: var(--mm-text-3);
        max-width: 75ch;
      }
      .controls {
        clear: both;
        display: grid;
        gap: var(--space-4);
        min-width: 0;
      }
      :host([data-choices]) legend {
        margin-block-end: var(--space-2);
      }
      :host([data-choices]) .controls {
        gap: var(--space-2);
      }
      .error {
        margin-top: var(--space-3);
      }
    `,
  ];

  /** The legend. */
  @property() accessor label = '';
  /** A sentence under the legend explaining the group. */
  @property() accessor description = '';
  /** Error text for the group as a whole, such as "Choose at least one channel." */
  @property() accessor error = '';
  /** Disables every control inside. */
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Adds a hairline border. Off by default. */
  @property({ type: Boolean, reflect: true }) accessor bordered = false;
  /** Shows "Required" or "Optional" beside the legend. */
  @property({ type: Boolean, reflect: true }) accessor required = false;
  @property({ type: Boolean, reflect: true }) accessor optional = false;

  #ids = { desc: uid('mm-fs-desc'), error: uid('mm-fs-err') };
  #disabledByUs = new Set<Element>();
  #observer?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof MutationObserver !== 'undefined') {
      this.#observer = new MutationObserver(() => this.disabled && this.#propagate());
      this.#observer.observe(this, { childList: true, subtree: true });
    }
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('disabled')) this.#propagate();
  }

  #propagate() {
    if (this.disabled) {
      for (const el of this.querySelectorAll('*')) {
        const c = el as Element & { disabled?: boolean };
        if (!isControl(el) || !('disabled' in c) || c.disabled) continue;
        c.disabled = true;
        this.#disabledByUs.add(el);
      }
    } else {
      for (const el of this.#disabledByUs) (el as Element & { disabled: boolean }).disabled = false;
      this.#disabledByUs.clear();
    }
  }

  /** A list of checkboxes, radios or switches sits tighter than a stack of fields. */
  #onSlotChange(e: Event) {
    const els = (e.target as HTMLSlotElement).assignedElements();
    this.toggleAttribute('data-choices', els.length > 0 && els.every((el) => choiceTags.has(el.localName)));
  }

  override render() {
    const marker = this.required
      ? html`<span class="marker" aria-hidden="true">${t('required')}</span>`
      : this.optional
        ? html`<span class="marker">${t('optional')}</span>`
        : nothing;
    const describedBy = [this.description && this.#ids.desc, this.error && this.#ids.error].filter(Boolean).join(' ');
    return html`<fieldset part="fieldset" ?disabled=${this.disabled} aria-describedby=${ifDefined(describedBy || undefined)}>
      <legend part="legend" class="label"><span><slot name="label">${this.label}</slot></span>${marker}</legend>
      ${this.description ? html`<p part="description" class="description" id=${this.#ids.desc}>${this.description}</p>` : nothing}
      <div part="controls" class=${classMap({ controls: true })}><slot @slotchange=${this.#onSlotChange}></slot></div>
      ${this.error ? html`<p part="error" class="error" id=${this.#ids.error}><mm-icon name="error" aria-hidden="true"></mm-icon><span>${this.error}</span></p>` : nothing}
    </fieldset>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-fieldset': MmFieldset;
  }
}
