import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { formatDuration, formatTimestamp } from '../../core/format.js';
import type { AvatarKind } from '../avatar/class.js';
import { parseTime } from '../activity-feed/time.js';
import '../owner-chip/define.js';

export type TimelineState = 'done' | 'running' | 'pending' | 'failed';

const stateWord = (s: TimelineState): string =>
  ({
    done: tr('timelineDone', 'Done'),
    running: tr('timelineRunning', 'In progress'),
    pending: tr('timelinePending', 'Pending'),
    failed: tr('timelineFailed', 'Failed'),
  })[s];

/**
 * A timeline lists what happened to one thing, in order: the steps of an access approval, the runs
 * of a pipeline, the phases of a single run. A 1px `mm-rule` spine joins small node markers whose
 * shape encodes the state, so colour is never the only signal: a filled circle is done, a ring is
 * pending, a ring with a centre dot is in progress and a cross is failed, and each step also carries
 * its state as a word.
 *
 * `orientation="horizontal"` is the compact form for a run's phases (Queued, Started, Extracting,
 * Writing, Finished): one straight line through the markers, each step's name and time under its
 * marker, and the time between steps as a quiet caption on the line between them. The line is
 * darker up to the last finished step.
 *
 * It is a list, not a widget: there is no keyboard model beyond any links or buttons inside steps.
 * In a narrow container the horizontal form wraps onto further rows rather than scrolling.
 *
 * @tagname mm-timeline
 * @summary Ordered steps with state markers, vertical or horizontal.
 * @slot - `mm-timeline-item` elements, oldest first.
 */
export class MmTimeline extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .list {
        display: flex;
        flex-direction: column;
      }
      :host([orientation='horizontal']) .list {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        row-gap: var(--space-4);
      }
    `,
  ];

  /** `vertical` (default) for approvals and run history, `horizontal` for a run's phases. */
  @property({ reflect: true }) accessor orientation: 'vertical' | 'horizontal' = 'vertical';
  /** Names the list, for example "Run 8121 phases". */
  @property() accessor label = '';

  #sync = () => {
    const items = Array.from(this.querySelectorAll<MmTimelineItem>(':scope > mm-timeline-item'));
    items.forEach((item, i) => {
      const next = items[i + 1];
      item.orientation = this.orientation;
      item.last = !next;
      const a = parseTime(item.time || item.getAttribute('time') || '');
      const b = next ? parseTime(next.time || next.getAttribute('time') || '') : null;
      item.duration = a && b ? b.getTime() - a.getTime() : undefined;
      item.nextTitle = next ? next.heading || next.getAttribute('heading') || '' : '';
    });
  };

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('orientation')) this.#sync();
  }

  /** Recomputes durations and the last step. Items call this when their time or title changes. */
  refresh(): void {
    this.#sync();
  }

  override render() {
    return html`<div class="list" role="list" aria-label=${this.label || nothing}><slot @slotchange=${this.#sync}></slot></div>`;
  }
}

/**
 * One step on an `mm-timeline`: a state marker, a title, the time in mono, the actor and an
 * optional body. Set `state-label` to say the state in the step's own words ("Approved",
 * "Requested", "Denied"); the marker shape still follows `state`.
 *
 * @tagname mm-timeline-item
 * @summary One step on a timeline.
 * @slot - The body: a sentence, a reason, a short readout.
 * @slot actor - An actor, if `actor` is not enough.
 * @csspart node - The state marker.
 * @csspart title - The title.
 * @csspart time - The timestamp.
 * @csspart body - The body.
 * @csspart dimension - The line to the next step, with its duration (horizontal).
 */
export class MmTimelineItem extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        position: relative;
      }
      /* Vertical */
      .v {
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        column-gap: var(--space-3);
        padding-block-end: var(--space-4);
        position: relative;
      }
      :host([last]) .v {
        padding-block-end: 0;
      }
      .v .rail {
        position: relative;
        display: flex;
        justify-content: center;
        padding-block-start: 4px;
      }
      .v .rail::after {
        content: '';
        position: absolute;
        inset-block-start: 20px;
        inset-block-end: calc(-1 * var(--space-4));
        inset-inline-start: calc(50% - 0.5px);
        inline-size: 1px;
        background: var(--mm-rule);
      }
      :host([last]) .v .rail::after {
        display: none;
      }
      .node {
        inline-size: 12px;
        block-size: 12px;
        flex: none;
        display: block;
        overflow: visible;
      }
      .node .fill {
        fill: currentColor;
      }
      .node .ring {
        fill: var(--mm-surface);
        stroke: currentColor;
        stroke-width: 1.5;
      }
      .node .x {
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
      }
      :host([state='done']) .node {
        color: var(--mm-success);
      }
      :host([state='pending']) .node {
        color: var(--mm-control-border);
      }
      :host([state='running']) .node {
        color: var(--mm-info);
      }
      :host([state='failed']) .node {
        color: var(--mm-danger);
      }
      .head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        column-gap: var(--space-2);
        row-gap: 2px;
        min-width: 0;
      }
      .title {
        margin: 0;
        font: var(--text-dense);
        font-weight: 600;
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      .word {
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      :host([state='failed']) .word {
        color: var(--mm-danger);
        font-weight: 600;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px var(--space-3);
        margin-block-start: 2px;
        min-width: 0;
      }
      .time {
        font: var(--text-caption);
        color: var(--mm-text-3);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .body {
        margin-block-start: var(--space-1);
        font: var(--text-dense);
        color: var(--mm-text-2);
        max-inline-size: 75ch;
        overflow-wrap: anywhere;
      }
      /* Horizontal: one straight line through the dots, each step's name and time under its dot. */
      :host([orientation='horizontal']) {
        flex: 1 1 0;
        min-inline-size: 7rem;
      }
      :host([orientation='horizontal'][last]) {
        flex: 0 0 auto;
        min-inline-size: auto;
      }
      .h {
        display: grid;
        gap: var(--space-1);
      }
      .track {
        display: flex;
        align-items: center;
        block-size: 16px;
      }
      .track .node {
        flex: none;
      }
      .seg {
        position: relative;
        flex: 1;
        block-size: 1px;
        margin-inline: var(--space-2);
        background: var(--mm-rule);
      }
      :host([state='done']) .seg {
        background: var(--mm-text-3);
      }
      .dur {
        position: absolute;
        inset-block-end: 4px;
        inset-inline: 0;
        text-align: center;
        font: var(--text-caption);
        color: var(--mm-text-3);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .h .title {
        white-space: nowrap;
        padding-inline-end: var(--space-3);
      }
      .h .time {
        font: var(--text-caption);
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .live {
        transform-origin: 6px 6px;
        animation: pulse 1.6s var(--mm-ease) infinite;
      }
      @keyframes pulse {
        50% {
          opacity: 0.35;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .live {
          animation: none;
        }
      }
    `,
  ];

  /** `done`, `running`, `pending` (default) or `failed`. Sets the marker shape. */
  @property({ reflect: true }) accessor state: TimelineState = 'pending';
  /** The state in the step's own words ("Approved", "Requested"). Defaults to the state word. */
  @property({ attribute: 'state-label' }) accessor stateLabel = '';
  /** The title ("Access requested", "Extracting"). */
  @property({ reflect: true }) accessor heading = '';
  /** When it happened, as an ISO timestamp. Shown in UTC mono. */
  @property({ reflect: true }) accessor time = '';
  /** Who did it. */
  @property() accessor actor = '';
  /** `person` (default), `agent` or `team`. */
  @property({ attribute: 'actor-kind' }) accessor actorKind: AvatarKind = 'person';
  /** For agents: the service account. */
  @property({ attribute: 'service-account' }) accessor serviceAccount = '';
  /** Set by `mm-timeline`. */
  @property({ reflect: true }) accessor orientation: 'vertical' | 'horizontal' = 'vertical';
  /** Set by `mm-timeline` on the final step. */
  @property({ type: Boolean, reflect: true }) accessor last = false;
  /** Milliseconds to the next step. Set by `mm-timeline` from consecutive times. */
  @property({ type: Number }) accessor duration: number | undefined;
  /** Title of the next step, for the duration's accessible text. Set by `mm-timeline`. */
  @property({ attribute: false }) accessor nextTitle = '';

  @state() accessor #hasBody = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  #onBody = (e: Event) => {
    this.#hasBody = (e.target as HTMLSlotElement).assignedNodes().some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
  };

  protected override updated(changed: PropertyValues<this>): void {
    // Tell the timeline when its inputs to durations change.
    if ((changed.has('time') || changed.has('heading')) && changed.get('time') !== undefined && this.parentElement instanceof MmTimeline) {
      this.parentElement.refresh();
    }
  }

  #node() {
    const s = this.state;
    return html`<svg part="node" class="node" viewBox="0 0 12 12" aria-hidden="true">
      ${s === 'done'
        ? svg`<circle class="fill" cx="6" cy="6" r="5"></circle>`
        : s === 'failed'
          ? svg`<path class="x" d="M2 2 L10 10 M10 2 L2 10"></path>`
          : s === 'running'
            ? svg`<circle class="ring" cx="6" cy="6" r="4.75"></circle><circle class="fill live" cx="6" cy="6" r="2"></circle>`
            : svg`<circle class="ring" cx="6" cy="6" r="4.75"></circle>`}
    </svg>`;
  }

  override render() {
    const d = parseTime(this.time);
    const word = this.stateLabel || stateWord(this.state);
    if (this.orientation === 'horizontal') {
      const stamp = d ? formatTimestamp(d) : '';
      const dur = this.duration !== undefined && !this.last ? formatDuration(Math.max(0, this.duration)) : '';
      return html`<div class="h">
        <div class="track">
          ${this.#node()}
          ${this.last
            ? nothing
            : html`<span class="seg" part="dimension">${dur
                ? html`<span class="dur"
                    ><span aria-hidden="true">${dur}</span
                    ><span class="visually-hidden">${tr('timelineDuration', '{duration} until {next}', { duration: dur, next: this.nextTitle })}</span></span
                  >`
                : nothing}</span>`}
        </div>
        <p class="title" part="title">${this.heading}<span class="visually-hidden">, ${word}</span></p>
        ${d ? html`<time part="time" class="time" datetime=${d.toISOString()} title=${stamp}>${stamp.slice(11)}</time>` : nothing}
      </div>`;
    }
    return html`<div class="v">
      <span class="rail">${this.#node()}</span>
      <div>
        <div class="head">
          <p class="title" part="title">${this.heading}</p>
          <span class="word">${word}</span>
        </div>
        <div class="meta">
          ${d ? html`<time part="time" class="time" datetime=${d.toISOString()}>${formatTimestamp(d)}</time>` : nothing}
          <slot name="actor"
            >${this.actor
              ? html`<mm-owner-chip name=${this.actor} kind=${this.actorKind} service-account=${this.serviceAccount || nothing}></mm-owner-chip>`
              : nothing}</slot
          >
        </div>
        <div class="body" part="body" ?hidden=${!this.#hasBody}><slot @slotchange=${this.#onBody}></slot></div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-timeline': MmTimeline;
    'mm-timeline-item': MmTimelineItem;
  }
}
