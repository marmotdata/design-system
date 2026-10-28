import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { prefersReducedMotion } from '../../core/platform.js';
import { t } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';
export type StatusState =
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'running'
  | 'queued'
  | 'stale'
  | 'denied'
  | 'allowed'
  | 'cancelled'
  | 'skipped';

/** Local fallback until the keys land in `defaultStrings` (see the component report). */
const s = (key: string, fallback: string): string => (t(key as never) as string | undefined) ?? fallback;

/** What each semantic state means: tone, default glyph and default word. */
export const STATUS_STATES: Record<StatusState, { tone: StatusTone; icon?: string; dot?: boolean; word: () => string }> = {
  succeeded: { tone: 'success', icon: 'check-circle', word: () => s('statusSucceeded', 'Succeeded') },
  partial: { tone: 'warning', icon: 'data-usage', word: () => s('statusPartial', 'Partial') },
  failed: { tone: 'danger', icon: 'cancel', word: () => s('statusFailed', 'Failed') },
  running: { tone: 'info', dot: true, word: () => s('statusRunning', 'Running') },
  queued: { tone: 'neutral', icon: 'hourglass-empty', word: () => s('statusQueued', 'Queued') },
  stale: { tone: 'warning', icon: 'schedule', word: () => s('statusStale', 'Stale') },
  denied: { tone: 'danger', dot: true, word: () => s('statusDenied', 'Denied') },
  allowed: { tone: 'success', dot: true, word: () => s('statusAllowed', 'Allowed') },
  cancelled: { tone: 'neutral', icon: 'block', word: () => s('statusCancelled', 'Cancelled') },
  skipped: { tone: 'neutral', icon: 'trending-flat', word: () => s('statusSkipped', 'Skipped') },
};

/**
 * The default, happy-path states. Rows (activity, audit, notifications) render no pill for these:
 * a run that succeeded or a request that was allowed is what people expect, so it is not badged.
 */
export const HAPPY_PATH_STATES: ReadonlySet<StatusState> = new Set<StatusState>(['succeeded', 'allowed']);

/** True for a state that needs no pill in a row, such as `succeeded` or `allowed`. */
export const isHappyPath = (state: string | undefined | null): boolean => HAPPY_PATH_STATES.has(state as StatusState);

/**
 * Status pills state the condition of a run, asset or request in a word: a soft status fill,
 * status-coloured text and the word, with an optional leading icon or 6px dot. Colour is never
 * the only signal, and burnt sienna is never a status colour.
 *
 * Set `state` for the common Marmot states (`succeeded`, `partial`, `failed`, `running`, `queued`, `stale`,
 * `denied`, `allowed`, `cancelled`, `skipped`), which picks the tone, glyph and default word for
 * you. `partial` is a run that finished with some failures: ochre (warning) with a part-filled ring,
 * kept apart from burnt sienna and the failed crimson. Set `status` directly for anything else and slot your own word.
 *
 * Don't badge the happy path. Show a pill only when something needs attention (Denied, Failed,
 * Partial, Stale, Expiring, Running). "Allowed", "Succeeded", "Active" and similar are the default
 * and get no pill in rows, lists and tables: leave the cell empty, or give screen readers the word
 * as visually hidden text. `isHappyPath(state)` and `HAPPY_PATH_STATES` from this module tell you
 * which states to skip. A pill for a happy state is fine where the state is the subject, such as a
 * run's own page header.
 *
 * @tagname mm-status-pill
 * @summary A run, asset or request condition in one word.
 * @slot - The word. Defaults to the word for `state`.
 * @csspart pill - The pill.
 * @csspart icon - The leading icon.
 * @csspart dot - The leading dot.
 * @csspart label - The word.
 */
export class MmStatusPill extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        vertical-align: middle;
        max-inline-size: 100%;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        block-size: 22px;
        max-inline-size: 100%;
        padding-inline: 9px;
        border-radius: var(--radius-full);
        font: var(--text-label);
        line-height: 1;
        white-space: nowrap;
        background: var(--mm-sunken);
        color: var(--mm-text-2);
      }
      .success {
        background: var(--mm-success-soft);
        color: var(--mm-success);
      }
      .warning {
        background: var(--mm-warning-soft);
        color: var(--mm-warning-text);
      }
      .info {
        background: var(--mm-info-soft);
        color: var(--mm-info);
      }
      .danger {
        background: var(--mm-danger-soft);
        color: var(--mm-danger);
      }
      .warning mm-icon {
        color: var(--mm-warning);
      }
      mm-icon {
        flex: none;
      }
      .dot {
        flex: none;
        inline-size: 6px;
        block-size: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      .label {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 22px;
      }
      :host([data-pulse]) .dot {
        animation: pulse 1600ms var(--mm-ease) infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.35;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([data-pulse]) .dot {
          animation: none;
        }
      }
    `,
  ];

  /** Tone: `success` (moss), `warning` (ochre text), `info` (slate), `danger` (crimson) or `neutral`. Ignored when `state` is set. */
  @property({ reflect: true }) accessor status: StatusTone = 'neutral';
  /** Semantic state. Picks the tone, glyph and default word; overrides `status`. */
  @property({ reflect: true }) accessor state: StatusState | '' = '';
  /** Leading Material Symbols icon. Overrides the state's default glyph. */
  @property() accessor icon = '';
  /** Show a 6px dot instead of an icon. */
  @property({ type: Boolean, reflect: true }) accessor dot = false;
  /**
   * Pulse the dot because the thing is running right now. Only honoured when `state="running"`;
   * on any other state `live` is ignored, because a pulse that carries no meaning is noise. The
   * pulse stops under reduced motion.
   */
  @property({ type: Boolean, reflect: true }) accessor live = false;

  #hasText = false;

  protected override willUpdate(): void {
    this.#hasText = !!this.textContent?.trim();
    const pulse = this.live && this.state === 'running' && (typeof window === 'undefined' || !prefersReducedMotion());
    this.toggleAttribute('data-pulse', pulse);
  }

  override render() {
    const def = this.state ? STATUS_STATES[this.state] : undefined;
    const tone = def?.tone ?? this.status;
    const icon = this.icon || (this.dot ? '' : (def?.icon ?? ''));
    const showDot = !this.icon && (this.dot || !!def?.dot || (this.live && this.state === 'running'));
    return html`<span part="pill" class="pill ${tone}">
      ${showDot ? html`<span part="dot" class="dot" aria-hidden="true"></span>` : icon ? html`<mm-icon part="icon" name=${icon} size="14"></mm-icon>` : nothing}
      <span part="label" class="label"><slot @slotchange=${() => this.requestUpdate()}></slot>${this.#hasText ? nothing : (def?.word() ?? '')}</span>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-status-pill': MmStatusPill;
  }
}
