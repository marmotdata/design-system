import { LitElement, css, html, nothing, svg } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { tr } from '../../core/strings.js';
import { formatDuration } from '../../core/format.js';
import { isRtl } from '../../core/roving.js';
import { prefersReducedMotion } from '../../core/platform.js';
import type { MmTooltip } from '../tooltip/class.js';
import '../tooltip/define.js';

export type RunStatus = 'succeeded' | 'failed' | 'partial' | 'skipped' | 'queued' | 'running';

export interface Run {
  /** Run id, shown in mono, e.g. "run_8f2c1a". */
  id: string;
  status: RunStatus;
  /** Start time: a Date, ISO string or epoch ms. */
  startedAt: Date | string | number;
  /** Duration in ms; for a running run, the time so far. */
  durationMs?: number;
}

const STATUS_TEXT: Record<RunStatus, [string, string]> = {
  succeeded: ['runSucceeded', 'Succeeded'],
  failed: ['runFailed', 'Failed'],
  partial: ['runPartial', 'Partial'],
  skipped: ['runSkipped', 'Skipped'],
  queued: ['runQueued', 'Queued'],
  running: ['runRunning', 'Running'],
};
const statusText = (s: RunStatus) => tr(...STATUS_TEXT[s]);

const ORDER: RunStatus[] = ['succeeded', 'failed', 'partial', 'running', 'queued', 'skipped'];

/**
 * Run strips show the pass and fail history of a pipeline as small square cells, oldest first and
 * the newest at the end, as on Plugins and an asset's run history. Every status has a shape as well
 * as a colour: succeeded is a solid moss square, failed is crimson with an ×, partial is half
 * filled in ochre, skipped is an outline with a dash, queued is a dotted outline, and running is
 * slate with a centre dot that pulses only with `live` (never under reduced motion).
 *
 * It is a one-row grid: Tab to it, then Left and Right move between runs (flipped in right to
 * left), Home and End jump to the oldest and newest, and each run's id, status, start time and
 * duration show in the ink data tooltip and are announced. Enter or Space (or a click) fires
 * `mm-select`. Escape hides the tooltip. Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
 *
 * @tagname mm-run-strip
 * @summary Pass and fail history of pipeline runs as square cells.
 * @fires mm-select - {run: Run, index: number} A run was chosen with Enter, Space or a click.
 * @csspart strip - The focusable grid.
 * @csspart cell - Each run cell.
 */
export class MmRunStrip extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-block;
        max-inline-size: 100%;
      }
      .strip {
        display: block;
        border-radius: var(--radius-sm);
        padding-block: 2px;
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
      }
      .cell {
        display: grid;
        place-items: center;
        inline-size: 16px;
        block-size: 24px;
        cursor: default;
      }
      :host([selectable]) .cell {
        cursor: pointer;
      }
      svg {
        display: block;
        overflow: visible;
      }
      .cell.active svg {
        outline: 2px solid var(--mm-text);
        outline-offset: 1px;
      }
      .succeeded .box {
        fill: var(--mm-success);
      }
      .failed .box {
        fill: var(--mm-danger);
      }
      .glyph {
        stroke: var(--mm-surface);
        stroke-width: 1.5;
        stroke-linecap: square;
      }
      .partial .box {
        fill: none;
        stroke: var(--mm-warning);
        stroke-width: 1;
      }
      .partial .half {
        fill: var(--mm-warning);
      }
      .skipped .box,
      .queued .box {
        fill: none;
        stroke: var(--mm-control-border);
        stroke-width: 1;
      }
      .queued .box {
        stroke-dasharray: 2 2;
      }
      .skipped .glyph {
        stroke: var(--mm-text-3);
      }
      .running .box {
        fill: var(--mm-info);
      }
      .running .dot {
        fill: var(--mm-surface);
      }
      :host([data-pulse]) .running .dot {
        animation: pulse 1600ms var(--mm-ease) infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.2;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([data-pulse]) .running .dot {
          animation: none;
        }
      }
      mm-tooltip {
        position: absolute;
      }
      .empty {
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
    `,
  ];

  /** The runs, oldest first, so the newest is at the end. */
  @property({ type: Array }) accessor runs: Run[] = [];
  /** What the strip is, e.g. "Last 30 runs of postgres-shop". Starts the accessible summary. */
  @property() accessor label = '';
  /** Lets a running cell pulse. Only for genuinely live data. */
  @property({ type: Boolean, reflect: true }) accessor live = false;
  /** Shows a pointer cursor; Enter, Space and clicks fire `mm-select` either way. */
  @property({ type: Boolean, reflect: true }) accessor selectable = false;
  /** IANA time zone for start times. UTC by default. */
  @property({ attribute: 'time-zone' }) accessor timeZone = 'UTC';

  @state() private accessor active = -1;
  @state() private accessor tipHidden = false;
  #id = uid('mm-run');

  #fmtTime(d: Run['startedAt']): string {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    const s = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: this.timeZone }).format(date).replace(', ', ' ');
    return this.timeZone === 'UTC' ? `${s} UTC` : s;
  }

  #describeRun(r: Run): string {
    const parts = [`${tr('runLabel', 'Run')} ${r.id}`, statusText(r.status), this.#fmtTime(r.startedAt)];
    if (r.durationMs !== undefined) parts.push(formatDuration(r.durationMs));
    return parts.filter(Boolean).join(', ');
  }

  #summary(): string {
    const runs = this.runs ?? [];
    const lead = this.label || tr('runStripLabel', 'Run history');
    if (!runs.length) return `${lead}: ${tr('runStripEmpty', 'no runs yet')}`;
    const counts = ORDER.map((s) => [s, runs.filter((r) => r.status === s).length] as const)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${n} ${statusText(s).toLowerCase()}`);
    const last = runs[runs.length - 1]!;
    return `${lead}: ${tr('runStripSummary', '{n} runs, {counts}. Latest run {status}', {
      n: runs.length,
      counts: counts.join(', '),
      status: statusText(last.status).toLowerCase(),
    })}.`;
  }

  protected override willUpdate(): void {
    if (typeof window !== 'undefined') this.toggleAttribute('data-pulse', this.live && !prefersReducedMotion());
  }

  #onKeydown = (e: KeyboardEvent) => {
    const n = this.runs.length;
    if (!n) return;
    const rtl = isRtl(this);
    const fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: number | null = null;
    const cur = this.active < 0 ? n - 1 : this.active;
    if (e.key === fwd) next = Math.min(n - 1, cur + 1);
    else if (e.key === back) next = Math.max(0, cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') {
      this.tipHidden = true;
      return;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#select(cur);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    this.tipHidden = false;
    this.active = next;
  };

  #select(i: number) {
    const run = this.runs[i];
    if (!run) return;
    this.active = i;
    emit(this, 'mm-select', { run, index: i });
  }

  #onFocus = () => {
    if (this.active < 0 && this.runs.length) this.active = this.runs.length - 1;
    this.tipHidden = false;
  };
  #onBlur = () => {
    this.active = -1;
  };
  #onLeave = () => {
    if (!this.matches(':focus-within')) this.active = -1;
  };

  protected override updated(): void {
    const tip = this.renderRoot.querySelector<MmTooltip>('mm-tooltip');
    if (!tip) return;
    const cell = this.active >= 0 ? this.renderRoot.querySelector<HTMLElement>(`#${this.#id}-${this.active}`) : null;
    if (!cell || this.tipHidden) {
      if (tip.open) tip.hide();
      return;
    }
    const r = cell.getBoundingClientRect();
    tip.showAt(r.left + r.width / 2, r.top + 4);
  }

  #glyph(s: RunStatus) {
    switch (s) {
      case 'failed':
        return svg`<rect class="box" width="12" height="12"></rect><path class="glyph" d="M3.5,3.5 L8.5,8.5 M8.5,3.5 L3.5,8.5"></path>`;
      case 'partial':
        return svg`<rect class="box" x="0.5" y="0.5" width="11" height="11"></rect><path class="half" d="M0,12 L12,0 L12,12 Z"></path>`;
      case 'skipped':
        return svg`<rect class="box" x="0.5" y="0.5" width="11" height="11"></rect><path class="glyph" d="M3.5,6 L8.5,6"></path>`;
      case 'queued':
        return svg`<rect class="box" x="0.5" y="0.5" width="11" height="11"></rect>`;
      case 'running':
        return svg`<rect class="box" width="12" height="12"></rect><circle class="dot" cx="6" cy="6" r="2"></circle>`;
      default:
        return svg`<rect class="box" width="12" height="12"></rect>`;
    }
  }

  override render() {
    const runs = this.runs ?? [];
    if (!runs.length) return html`<p class="empty">${tr('runStripNone', 'No runs yet.')}</p>`;
    const r = runs[this.active];
    const items = r
      ? [
          { label: tr('runLabel', 'Run').toLowerCase(), value: r.id },
          { label: tr('runStatus', 'status'), value: statusText(r.status) },
          { label: tr('runStarted', 'started'), value: this.#fmtTime(r.startedAt) },
          ...(r.durationMs !== undefined ? [{ label: tr('runDuration', 'duration'), value: formatDuration(r.durationMs) }] : []),
        ]
      : [];
    return html`<div
        class="strip"
        part="strip"
        role="grid"
        tabindex="0"
        aria-label=${this.#summary()}
        aria-activedescendant=${this.active >= 0 ? `${this.#id}-${this.active}` : nothing}
        @keydown=${this.#onKeydown}
        @focus=${this.#onFocus}
        @blur=${this.#onBlur}
        @pointerleave=${this.#onLeave}
      >
        <div class="row" role="row">
          ${runs.map(
            (run, i) => html`<div
              part="cell"
              role="gridcell"
              id="${this.#id}-${i}"
              class="cell ${run.status} ${i === this.active ? 'active' : ''}"
              @pointerenter=${() => {
                this.tipHidden = false;
                this.active = i;
              }}
              @click=${() => this.#select(i)}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${this.#glyph(run.status)}</svg>
              <span class="visually-hidden">${this.#describeRun(run)}</span>
            </div>`,
          )}
        </div>
      </div>
      <mm-tooltip variant="data" placement="top" .items=${items}></mm-tooltip>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-run-strip': MmRunStrip;
  }
}
