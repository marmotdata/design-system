import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { onStringsChange, tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

export type MmStepState = 'complete' | 'current' | 'upcoming';

export interface MmStepChangeDetail {
  value: string;
  index: number;
}

const stateWord = (state: MmStepState, error: boolean): string =>
  error
    ? tr('stepError', 'Has errors')
    : state === 'complete'
      ? tr('stepComplete', 'Completed')
      : state === 'current'
        ? tr('stepCurrent', 'Current step')
        : tr('stepUpcoming', 'Not started');

/**
 * One step in an `mm-stepper`. Its state (complete, current or upcoming) comes from the stepper's
 * `value`; set `error` to mark a step that needs fixing. The state is always carried by a glyph or
 * number and a word, never by colour alone.
 *
 * @tagname mm-step
 * @summary One step in a stepper.
 * @slot - The label, if not given with `label`.
 * @csspart step - The step row (a button or link when navigable).
 * @csspart marker - The square marker with the number or glyph.
 * @csspart label - The label.
 * @csspart description - The description.
 */
export class MmStep extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 0;
        color: var(--mm-text-2);
      }
      :host(:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: var(--mm-focus-ring-offset, 2px);
        border-radius: var(--radius-sm);
      }
      :host(:not([last])) {
        flex: 1 1 0;
      }
      .step {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        min-width: 0;
        padding: 2px;
        margin: -2px;
        border: 0;
        border-radius: var(--radius-sm);
        background: none;
        color: inherit;
        font: inherit;
        text-align: start;
        text-decoration: none;
      }
      button.step,
      a.step {
        cursor: pointer;
      }
      button.step:hover .label,
      a.step:hover .label {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .marker {
        display: grid;
        place-items: center;
        flex: none;
        width: 24px;
        height: 24px;
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        font: var(--text-caption);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text-2);
      }
      /* Done steps are quiet (a tick on the surface); only the current step carries weight. */
      :host([state='complete']) .marker {
        background: var(--mm-surface);
        border-color: var(--mm-rule);
        color: var(--mm-text-2);
      }
      :host([state='current']) .marker {
        border: 2px solid var(--mm-primary);
        color: var(--mm-primary);
        font-weight: 700;
      }
      :host([error]) .marker {
        border: 1px solid var(--mm-danger);
        background: var(--mm-danger-soft);
        color: var(--mm-danger);
      }
      :host([error][state='current']) .marker {
        border-width: 2px;
      }
      .text {
        display: grid;
        min-width: 0;
        padding-top: 2px;
      }
      .label {
        font: var(--text-dense);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      :host([state='current']) .label {
        color: var(--mm-text);
      }
      :host([state='current']) .label {
        font-weight: 600;
      }
      .description {
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .error {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font: var(--text-caption);
        font-weight: 600;
        color: var(--mm-danger);
      }
      .connector {
        flex: 1 1 var(--space-4);
        min-width: var(--space-4);
        height: 1px;
        margin-inline: var(--space-3);
        background: var(--mm-rule);
      }
      :host([state='complete']) .connector {
        background: var(--mm-text-3);
      }
      /* Vertical */
      :host([orientation='vertical']) {
        align-items: stretch;
        flex-direction: column;
        flex: none;
        padding-bottom: var(--space-5);
      }
      :host([orientation='vertical'][last]) {
        padding-bottom: 0;
      }
      :host([orientation='vertical']) .connector {
        position: absolute;
        top: 28px;
        bottom: 4px;
        inset-inline-start: 11.5px;
        width: 1px;
        height: auto;
        min-width: 0;
        margin: 0;
      }
      @media (pointer: coarse) {
        button.step,
        a.step {
          min-height: var(--target-touch);
          align-items: center;
        }
      }
    `,
  ];

  /** Identifies the step; the stepper's `value` names the current step. Defaults to its position. */
  @property({ reflect: true }) accessor value = '';
  /** The step name, such as "Choose plugin". The default slot can be used instead. */
  @property() accessor label = '';
  /** A second line, such as "PostgreSQL, 3 schemas". */
  @property() accessor description = '';
  /** Marks the step as needing attention, with a crimson glyph and the words "Has errors". */
  @property({ type: Boolean, reflect: true }) accessor error = false;
  /** Makes a completed step a link when the stepper is navigable. */
  @property() accessor href = '';
  /** Set by `mm-stepper`. */
  @property({ reflect: true }) accessor state: MmStepState = 'upcoming';
  /** Set by `mm-stepper`. */
  @property({ type: Number }) accessor index = 0;
  /** Set by `mm-stepper`: whether completed steps can be revisited. */
  @property({ type: Boolean }) accessor navigable = false;
  /** Set by `mm-stepper` on the final step, which has no connector. */
  @property({ type: Boolean, reflect: true }) accessor last = false;
  /** Set by `mm-stepper`. */
  @property({ reflect: true }) accessor orientation: 'horizontal' | 'vertical' = 'horizontal';

  #offStrings?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'listitem');
    this.#offStrings = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#offStrings?.();
  }

  protected override updated(): void {
    if (this.state === 'current') this.setAttribute('aria-current', 'step');
    else this.removeAttribute('aria-current');
  }

  override focus(options?: FocusOptions): void {
    const target = this.renderRoot.querySelector<HTMLElement>('button, a');
    if (target) target.focus(options);
    else super.focus(options);
  }

  #activate = (e: Event) => {
    if (this.href) {
      // Let the link navigate unless the stepper's event is cancelled.
      const ok = emit<MmStepChangeDetail>(this, 'mm-step-change', { value: this.value, index: this.index }, { cancelable: true });
      if (!ok) e.preventDefault();
      return;
    }
    emit<MmStepChangeDetail>(this, 'mm-step-change', { value: this.value, index: this.index }, { cancelable: true });
  };

  override render() {
    const word = stateWord(this.state, this.error);
    const marker = html`<span part="marker" class="marker" aria-hidden="true"
      >${this.error
        ? html`<mm-icon name="error" size="16"></mm-icon>`
        : this.state === 'complete'
          ? html`<mm-icon name="check" size="16"></mm-icon>`
          : this.index + 1}</span
    >`;
    const text = html`<span class="text">
      <span part="label" class="label"
        ><span class="visually-hidden">${tr('stepNumber', 'Step {n}:', { n: this.index + 1 })} </span><slot>${this.label}</slot
        >${this.error ? nothing : html`<span class="visually-hidden">, ${word.toLowerCase()}</span>`}</span
      >
      ${this.error ? html`<span class="error">${word}</span>` : nothing}
      ${this.description ? html`<span part="description" class="description">${this.description}</span>` : nothing}
    </span>`;
    const interactive = this.navigable && this.state === 'complete';
    const step = !interactive
      ? html`<span part="step" class="step">${marker}${text}</span>`
      : this.href
        ? html`<a part="step" class="step" href=${this.href} @click=${this.#activate}>${marker}${text}</a>`
        : html`<button part="step" class="step" type="button" @click=${this.#activate}>${marker}${text}</button>`;
    return html`${step}${this.last ? nothing : html`<span class="connector" aria-hidden="true"></span>`}`;
  }
}

/**
 * Steppers show where someone is in a multi-step flow, such as creating a pipeline (Choose plugin,
 * Basic info, Configure, Schedule and filters) or an asset. It is an ordered list: each step has its
 * number (tabular figures), a label and an optional description. Completed steps show an ink check, the
 * current step has `aria-current="step"`, ink text and the burnt-sienna marker (the one place a
 * stepper spends the accent, as the current selection), upcoming steps are muted, and a step with
 * `error` shows a crimson glyph with the words "Has errors". Every state is also given as a word to
 * assistive technology.
 *
 * With `navigable`, completed steps become buttons (or links, with `href`) so people can go back;
 * the current and upcoming steps never are, because the flow validates each step before the next.
 * Tab moves between them and Enter or Space activates. Activating one fires `mm-step-change` and
 * makes it current unless the event is cancelled.
 *
 * `orientation="vertical"` stacks the steps with the connector running down the markers, for side
 * panels and narrow dialogs.
 *
 * @tagname mm-stepper
 * @summary Shows progress through a multi-step flow.
 * @slot - `mm-step` elements.
 * @csspart list - The list.
 * @fires mm-step-change - {MmStepChangeDetail} A completed step was chosen. Cancel it to stay on the current step.
 */
export class MmStepper extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
      }
      .list {
        display: flex;
        align-items: flex-start;
        gap: 0;
      }
      :host([orientation='vertical']) .list {
        flex-direction: column;
      }
    `,
  ];

  /** The current step's `value`. Steps before it are complete; steps after it are upcoming. */
  @property({ reflect: true }) accessor value = '';
  @property({ reflect: true }) accessor orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** Completed steps become buttons (or links) that go back to them. */
  @property({ type: Boolean, reflect: true }) accessor navigable = false;
  /** Accessible name of the list, such as "New pipeline steps". */
  @property() accessor label = '';

  constructor() {
    super();
    this.addEventListener('mm-step-change', (e) => {
      const step = e.target as MmStep;
      if (step.parentElement !== this) return;
      // Let listeners on the stepper cancel first; then move on if nobody did.
      queueMicrotask(async () => {
        if (e.defaultPrevented) return;
        this.value = step.value;
        await this.updateComplete;
        await step.updateComplete;
        // The step is no longer a button; keep focus on it rather than losing it to the page.
        if (!step.href) {
          step.tabIndex = -1;
          step.focus();
        }
      });
    });
  }

  /** The steps, in order. */
  get steps(): MmStep[] {
    return [...this.children].filter((el): el is MmStep => el.localName === 'mm-step');
  }

  #sync() {
    const steps = this.steps;
    steps.forEach((s, i) => {
      if (!s.value) s.value = `step-${i + 1}`;
    });
    let current = steps.findIndex((s) => s.value === this.value);
    if (current < 0) current = 0;
    steps.forEach((s, i) => {
      s.index = i;
      s.state = i < current ? 'complete' : i === current ? 'current' : 'upcoming';
      s.navigable = this.navigable;
      s.orientation = this.orientation;
      s.last = i === steps.length - 1;
    });
  }

  protected override updated(): void {
    this.#sync();
  }

  override render() {
    return html`<div part="list" class="list" role="list" aria-label=${this.label || tr('steps', 'Steps')}>
      <slot @slotchange=${() => this.#sync()}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-stepper': MmStepper;
    'mm-step': MmStep;
  }
}
