import { LitElement, css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';

export type TextVariant = 'body' | 'body-strong' | 'dense' | 'caption' | 'label' | 'mono' | 'mono-dense';
export type TextTone = 'default' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning';
export type HeadingVariant = 'display-hero' | 'display-title' | 'display-section' | 'heading' | 'heading-sm' | 'panel-title';

const TEXT_VARIANTS: TextVariant[] = ['body', 'body-strong', 'dense', 'caption', 'label', 'mono', 'mono-dense'];
const HEADING_VARIANTS: HeadingVariant[] = ['display-hero', 'display-title', 'display-section', 'heading', 'heading-sm', 'panel-title'];
/** Guidelines: the display face is never set below 24px. */
const DISPLAY_MIN_PX = 24;

/**
 * Interface text set in one of the token type styles. `body` (15px) is for prose, `dense` (13px) for
 * tables, sidebars, metadata and toolbars, `caption` (12px) for supporting text, `label` (12px, 600,
 * ink-2, sentence case) for field labels and column headers, and `mono` or `mono-dense` for machine
 * strings only: identifiers, MRNs, SQL, types, timestamps and keys. Never use mono as decoration.
 *
 * `tone` changes the colour. Status tones (`danger`, `success`, `warning`) must sit beside a word or
 * icon that says the same thing, never colour alone. On raised layers (menus, popovers, dialogs) and
 * inside selected rows, use `secondary` rather than `tertiary` for captions, so they stay readable in Peat.
 *
 * The element is inline by default; set `block` for a paragraph, which also caps prose at a 75-character measure.
 *
 * @tagname mm-text
 * @summary Interface text in a token type style.
 * @slot - The text.
 */
export class MmText extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline;
        font: var(--text-body);
        color: var(--mm-text);
      }
      :host([block]) {
        display: block;
        margin: 0;
      }
      :host([block][variant='body']),
      :host([block][variant='body-strong']) {
        max-inline-size: 75ch;
      }
      :host([variant='body-strong']) {
        font: var(--text-body-strong);
        letter-spacing: var(--tracking-body-strong);
      }
      :host([variant='dense']) {
        font: var(--text-dense);
        letter-spacing: var(--tracking-dense);
      }
      :host([variant='caption']) {
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        color: var(--mm-text-3);
      }
      :host([variant='label']) {
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
      }
      :host([variant='mono']),
      :host([variant='mono-dense']) {
        font: var(--text-mono);
        letter-spacing: var(--tracking-mono);
        overflow-wrap: anywhere;
      }
      :host([variant='mono-dense']) {
        font: var(--text-mono-dense);
        letter-spacing: var(--tracking-mono-dense);
      }
      /* After the font shorthands, which reset font-variant-numeric. */
      :host([variant='mono']),
      :host([variant='mono-dense']),
      :host([numeric]) {
        font-variant-numeric: tabular-nums;
      }
      :host([tone='secondary']) {
        color: var(--mm-text-2);
      }
      :host([tone='tertiary']) {
        color: var(--mm-text-3);
      }
      :host([tone='danger']) {
        color: var(--mm-danger);
      }
      :host([tone='success']) {
        color: var(--mm-success);
      }
      :host([tone='warning']) {
        color: var(--mm-warning-text);
      }
    `,
  ];

  /** `body` (default), `body-strong`, `dense`, `caption`, `label`, `mono` or `mono-dense`. */
  @property({ reflect: true }) accessor variant: TextVariant = 'body';
  /** `default`, `secondary` (ink-2), `tertiary` (ink-3), `danger`, `success` or `warning`. Status tones need a word or icon too. */
  @property({ reflect: true }) accessor tone: TextTone = 'default';
  /** Displays as a block, like a paragraph. */
  @property({ type: Boolean, reflect: true }) accessor block = false;
  /** Tabular figures, for numbers that are compared. */
  @property({ type: Boolean, reflect: true }) accessor numeric = false;

  protected override willUpdate(): void {
    if (!TEXT_VARIANTS.includes(this.variant)) this.variant = 'body';
  }

  override render() {
    return html`<slot></slot>`;
  }
}

const defaultVariant = (level: number): HeadingVariant =>
  level <= 1 ? 'display-title' : level === 2 ? 'heading' : level === 3 ? 'heading-sm' : 'panel-title';

/**
 * A heading with the right level for the document outline and the right type style for its role.
 * `level` (1 to 6) sets the semantics; `variant` sets the look, so a panel title can be an `h3` without
 * looking like one. Without a variant, level 1 is `display-title`, 2 is `heading`, 3 is `heading-sm` and
 * 4 to 6 are `panel-title`.
 *
 * The display styles (Geist at 600) are only for the page title (`display-title`, 34px, or
 * `display-section`, 26px, in a compact page header) and marketing heroes (`display-hero`, 56px), never
 * below 24px. Section, panel and empty-state headings use `heading`, `heading-sm` or `panel-title`. If a display
 * heading is styled smaller than 24px, it falls back to `heading` and warns in the console. One display
 * title per view region. Display numbers use tabular figures. Headings are sentence case.
 *
 * @tagname mm-heading
 * @summary A heading with a semantic level and a token type style.
 * @slot - The heading text.
 * @csspart heading - The native `h1` to `h6`.
 */
export class MmHeading extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        color: var(--mm-text);
      }
      .h {
        margin: 0;
        font: var(--text-heading);
        letter-spacing: var(--tracking-heading);
        text-wrap: balance;
        overflow-wrap: anywhere;
      }
      .display-hero {
        font: var(--text-display-hero);
        letter-spacing: var(--tracking-display-hero);
      }
      .display-title {
        font: var(--text-display-title);
        letter-spacing: var(--tracking-display-title);
      }
      .display-section {
        font: var(--text-display-section);
        letter-spacing: var(--tracking-display-section);
      }
      .heading-sm {
        font: var(--text-heading-sm);
        letter-spacing: var(--tracking-heading-sm);
      }
      .panel-title {
        font: var(--text-panel-title);
      }
      /* After the font shorthands, which reset font-variant-numeric. */
      .display-hero,
      .display-title,
      .display-section {
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  /** Outline level, 1 to 6. */
  @property({ type: Number, reflect: true }) accessor level = 2;
  /** Type style. Defaults from `level` when not set. */
  @property({ reflect: true }) accessor variant: HeadingVariant | undefined;

  /** Set when a display style was demoted because it rendered under 24px. */
  #demoted = false;

  get #level(): number {
    const n = Math.round(Number(this.level));
    return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 2;
  }

  get #variant(): HeadingVariant {
    const v = this.variant && HEADING_VARIANTS.includes(this.variant) ? this.variant : defaultVariant(this.#level);
    return this.#demoted && v.startsWith('display-') ? 'heading' : v;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant')) this.#demoted = false;
  }

  protected override updated(): void {
    // Enforce the 24px floor for the display face, measured after layout so overrides through ::part count.
    if (this.#demoted || typeof window === 'undefined') return;
    const v = this.#variant;
    if (!v.startsWith('display-')) return;
    const el = this.renderRoot.querySelector<HTMLElement>('.h');
    if (!el || !el.isConnected) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px && px < DISPLAY_MIN_PX) {
      console.warn(`mm-heading: ${v} is never set below ${DISPLAY_MIN_PX}px (got ${px}px). Using "heading" instead.`);
      this.#demoted = true;
      this.requestUpdate();
    }
  }

  override render() {
    const cls = `h ${this.#variant}`;
    switch (this.#level) {
      case 1:
        return html`<h1 part="heading" class=${cls}><slot></slot></h1>`;
      case 2:
        return html`<h2 part="heading" class=${cls}><slot></slot></h2>`;
      case 3:
        return html`<h3 part="heading" class=${cls}><slot></slot></h3>`;
      case 4:
        return html`<h4 part="heading" class=${cls}><slot></slot></h4>`;
      case 5:
        return html`<h5 part="heading" class=${cls}><slot></slot></h5>`;
      default:
        return html`<h6 part="heading" class=${cls}><slot></slot></h6>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-text': MmText;
    'mm-heading': MmHeading;
  }
}
