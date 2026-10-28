import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import '../topography/define.js';

/**
 * Empty states earn the one decoration Marmot allows: a topographic background field, never an icon
 * or an illustration. The field is an `mm-topography` sheet behind the text, cropped by the empty
 * state's box and dissolving towards its edges, in hairlines mixed from `--mm-rule` so the title and
 * sentence keep full contrast. There is no drawing above the heading: one title, one sentence and
 * one action. The title is the text-face `heading` style (the display face is kept for page titles);
 * the one sentence says what is missing and what to do ("Connect a plugin to catalogue this source.").
 * No mascot, sparkles or stock art, and at most one field per view.
 *
 * Use `compact` inside panels: a `heading-sm` title and no field, so a page of panels never stacks
 * several.
 *
 * @tagname mm-empty-state
 * @summary Title, one sentence, one action, over a topographic background field.
 * @slot - The sentence, if you need markup. Otherwise use `description`.
 * @slot action - One `mm-button`, primary or secondary.
 * @csspart field - The `mm-topography` background (absent when compact).
 * @csspart heading - The title.
 * @csspart description - The sentence.
 * @csspart action - The action wrapper.
 */
export class MmEmptyState extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        position: relative;
        isolation: isolate;
        display: grid;
        justify-items: center;
        align-content: center;
        text-align: center;
        gap: var(--space-3);
        padding-block: var(--space-12);
        padding-inline: var(--space-6);
      }
      .heading {
        margin: 0;
        font: var(--text-heading);
        letter-spacing: var(--tracking-heading);
        color: var(--mm-text);
        max-inline-size: 100%;
        overflow-wrap: anywhere;
      }
      .description {
        margin: 0;
        max-inline-size: 46ch;
        font: var(--text-body);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .action {
        margin-block-start: var(--space-1);
      }
      .action:not(.has) {
        display: none;
      }
      :host([compact]) {
        gap: var(--space-2);
        padding-block: var(--space-8);
        padding-inline: var(--space-4);
      }
      :host([compact]) .heading {
        font: var(--text-heading-sm);
        letter-spacing: var(--tracking-heading-sm);
      }
      :host([compact]) .description {
        font: var(--text-dense);
      }
    `,
  ];

  /** The title, a few words in sentence case, e.g. "No assets yet". */
  @property() accessor heading = '';
  /** One sentence: what is missing and what to do. */
  @property() accessor description = '';
  /** Heading level for the title. Defaults to 2. */
  @property({ type: Number }) accessor level = 2;
  /** Smaller title and no background field, for inside panels. */
  @property({ type: Boolean, reflect: true }) accessor compact = false;
  /** Field seed, so different empty states lie over different ground. */
  @property({ type: Number }) accessor seed = 3;

  #hasAction = false;
  #hasBody = false;

  protected override willUpdate(): void {
    this.#hasAction = !!this.querySelector(':scope > [slot="action"]');
    // Whitespace between slotted elements would suppress slot fallback, so decide explicitly.
    this.#hasBody = [...this.childNodes].some(
      (n) => (n.nodeType === 3 && !!n.textContent?.trim()) || (n.nodeType === 1 && !(n as Element).hasAttribute('slot')),
    );
  }

  override render() {
    return html`${this.compact ? nothing : html`<mm-topography part="field" seed=${this.seed} fade="edges"></mm-topography>`}
      ${this.heading
        ? html`<div part="heading" class="heading" role="heading" aria-level=${Math.min(6, Math.max(1, this.level))}>${this.heading}</div>`
        : nothing}
      <p part="description" class="description" ?hidden=${!this.#hasBody && !this.description}>
        <slot @slotchange=${() => this.requestUpdate()}></slot>${this.#hasBody ? nothing : this.description}
      </p>
      <div part="action" class="action ${this.#hasAction ? 'has' : ''}">
        <slot name="action" @slotchange=${() => this.requestUpdate()}></slot>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-empty-state': MmEmptyState;
  }
}
