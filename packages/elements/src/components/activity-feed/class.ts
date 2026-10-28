import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import type { AvatarKind } from '../avatar/class.js';
import { STATUS_STATES, isHappyPath, type StatusState } from '../status-pill/class.js';
import { dayHeading, dayKey, parseTime, relativeTime, timeStyles, timeText } from './time.js';
import '../avatar/define.js';
import '../status-pill/define.js';
import '../button/define.js';
import '../empty-state/define.js';
import '../skeleton/define.js';
import '@marmotdata/icons/define.js';

interface DayGroup {
  key: string;
  label: string;
  items: MmActivityItem[];
}

/**
 * The activity feed is Home's record of what happened in the catalog: who queried what, which
 * schemas changed, what was certified and which plugin runs updated assets. Items are grouped by
 * day under sentence-case label headings ("Today", "Yesterday", "Monday 26 October"), never
 * uppercase text, and separated by hairlines, never boxed as cards. Put it in an `mm-panel`.
 *
 * When `pending` is above zero a "3 new events" button appears at the top inside a polite live
 * region, so screen readers hear about new activity without losing their place; it fires
 * `mm-show-new`. `has-more` adds a "Load more" button that fires `mm-load-more`; set `loading`
 * while more are on their way. With no items it shows `loading` placeholders, an `error` with a
 * retry, or the empty state.
 *
 * Keyboard: interactive items form one tab stop. Up and Down move between them, Home and End jump to
 * the first and last, and Enter or Space opens the item (`mm-activate` on the item, usually to open
 * a blade). Links inside an item stay in the tab order. This follows the list navigation of
 * `mm-list` (https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).
 *
 * @tagname mm-activity-feed
 * @summary Home's activity, grouped by day.
 * @slot - `mm-activity-item` elements, newest first.
 * @csspart day - Each day heading.
 * @csspart new - The "new events" button.
 * @csspart more - The "Load more" button.
 * @fires mm-show-new - {{ count: number }} The "new events" button was activated.
 * @fires mm-load-more - {{}} The "Load more" button was activated.
 * @fires mm-retry - {{}} The retry button on the error was activated.
 */
export class MmActivityFeed extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
        --_inset: var(--mm-feed-inset, var(--space-4));
      }
      .new {
        display: flex;
        justify-content: center;
        padding-block: var(--space-2);
        padding-inline: var(--_inset);
      }
      .new:empty {
        display: none;
      }
      .group + .group {
        border-block-start: 1px solid var(--mm-rule);
      }
      .day {
        margin: 0;
        padding-block: var(--space-3) var(--space-1);
        padding-inline: var(--_inset);
        font: var(--text-label);
        color: var(--mm-text-2);
      }
      .list {
        display: block;
      }
      .foot {
        display: flex;
        justify-content: center;
        padding: var(--space-3) var(--_inset);
        border-block-start: 1px solid var(--mm-rule);
      }
      .state {
        padding: var(--space-4) var(--_inset);
      }
      .error {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        margin: 0;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      .error mm-icon {
        color: var(--mm-danger);
      }
    `,
  ];

  /** Count of new events not yet shown. Above zero, a "new events" button appears at the top. */
  @property({ type: Number }) accessor pending = 0;
  /** Shows a "Load more" button at the end. */
  @property({ type: Boolean, attribute: 'has-more', reflect: true }) accessor hasMore = false;
  /** Placeholders when empty; a busy "Load more" button otherwise. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message, shown with a retry button when there are no items. */
  @property() accessor error = '';
  /** The time relative times are measured from, as a timestamp. Defaults to now. */
  @property({ type: Number }) accessor now: number | undefined;
  /** Heading level of the day headings. Defaults to 3, under a panel title. */
  @property({ type: Number, attribute: 'heading-level' }) accessor headingLevel = 3;
  /** Empty-state title. */
  @property({ attribute: 'empty-heading' }) accessor emptyHeading = '';
  /** Empty-state sentence. */
  @property({ attribute: 'empty-description' }) accessor emptyDescription = '';

  @state() accessor #groups: DayGroup[] = [];
  #observer?: MutationObserver;
  #id = uid('mm-feed');

  get #items(): MmActivityItem[] {
    return Array.from(this.querySelectorAll<MmActivityItem>(':scope > mm-activity-item'));
  }

  get #navigable(): MmActivityItem[] {
    return this.#items.filter((i) => i.hasAttribute('interactive') || i.interactive);
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('focusin', this.#onFocusIn);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#regroup();
    this.#observer = new MutationObserver(() => this.#regroup());
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['time', 'interactive'] });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  #regroup() {
    const groups: DayGroup[] = [];
    for (const item of this.#items) {
      if (this.now !== undefined) item.now = this.now;
      const d = parseTime(item.time || item.getAttribute('time') || '');
      const key = d ? dayKey(d) : 'undated';
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(item);
      else groups.push({ key, label: d ? dayHeading(d, this.now ?? Date.now()) : tr('activityEarlier', 'Earlier'), items: [item] });
    }
    this.#groups = groups;
    this.#syncTabStops();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('now')) {
      for (const item of this.#items) item.now = this.now;
      if (changed.get('now') !== undefined) this.#regroup();
    }
  }

  protected override updated(): void {
    const slots = this.renderRoot.querySelectorAll<HTMLSlotElement>('slot[data-group]');
    slots.forEach((slot) => {
      const g = this.#groups[Number(slot.dataset.group)];
      slot.assign(...(g?.items ?? []));
    });
  }

  #syncTabStops = (current?: MmActivityItem) => {
    const nav = this.#navigable;
    const stop = current && nav.includes(current) ? current : nav[0];
    for (const item of this.#items) item.tabStop = item === stop;
  };

  #onFocusIn = (e: FocusEvent) => {
    const item = e.target as MmActivityItem;
    if (item.parentElement === this && this.#navigable.includes(item)) this.#syncTabStops(item);
  };

  #onKeydown = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const origin = e.composedPath()[0] as Element | undefined;
    if (!origin?.hasAttribute?.('data-feed-main')) return;
    const nav = this.#navigable;
    const current = nav.indexOf(e.target as MmActivityItem);
    if (current < 0) return;
    let next = current;
    if (e.key === 'ArrowDown') next = Math.min(nav.length - 1, current + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, current - 1);
    else if (e.key === 'Home') next = 0;
    else next = nav.length - 1;
    e.preventDefault();
    const target = nav[next]!;
    this.#syncTabStops(target);
    target.focus();
  };

  #heading(label: string, id: string) {
    const level = Math.min(6, Math.max(2, this.headingLevel));
    return html`<div part="day" class="day" role="heading" aria-level=${level} id=${id}>${label}</div>`;
  }

  #body() {
    if (this.#groups.length) {
      return this.#groups.map(
        (g, i) => html`<div class="group" role="group" aria-labelledby=${`${this.#id}-d${i}`}>
          ${this.#heading(g.label, `${this.#id}-d${i}`)}
          <div class="list" role="list"><slot data-group=${i}></slot></div>
        </div>`,
      );
    }
    if (this.error) {
      return html`<div class="state">
        <p class="error" role="alert">
          <mm-icon name="error"></mm-icon><span>${this.error}</span>
          <mm-button size="sm" variant="secondary" icon="refresh" @click=${() => emit(this, 'mm-retry', {})}>${tr('tryAgain', 'Try again')}</mm-button>
        </p>
      </div>`;
    }
    if (this.loading) {
      return html`<div class="state"><mm-skeleton loading shape="text" count="5" aria-label=${tr('loading', 'Loading')}></mm-skeleton></div>`;
    }
    return html`<mm-empty-state
      compact
      level=${Math.min(6, Math.max(2, this.headingLevel))}
      heading=${this.emptyHeading || tr('activityEmptyHeading', 'No activity yet')}
      description=${this.emptyDescription ||
      tr('activityEmptyDescription', 'Queries, schema changes and certifications will appear here.')}
    ></mm-empty-state>`;
  }

  override render() {
    const n = this.pending;
    const newLabel = n === 1 ? tr('activityNewOne', '1 new event') : tr('activityNew', '{count} new events', { count: n.toLocaleString('en-GB') });
    return html`<div class="new" aria-live="polite">${n > 0
        ? html`<mm-button part="new" size="sm" variant="secondary" icon="arrow-upward" @click=${() => emit(this, 'mm-show-new', { count: n })}
            >${newLabel}</mm-button
          >`
        : nothing}</div
      >${this.#body()}${this.hasMore && this.#groups.length
        ? html`<div class="foot">
            <mm-button part="more" size="sm" variant="ghost" ?loading=${this.loading} @click=${() => emit(this, 'mm-load-more', {})}
              >${tr('loadMore', 'Load more')}</mm-button
            >
          </div>`
        : nothing}`;
  }
}

/**
 * One event in an activity feed, written as a full sentence: the actor, a verb phrase and the
 * target ("Jane Doe certified customers_dim", "support-triage-agent queried orders_daily").
 * People, agents and teams are told apart by the avatar's icon (the robot for agents), with the
 * kind word given to screen readers only; there is no "AGENT" text tag. The target is a link in
 * ink with an underline on hover and focus, set in mono only when it is an MRN (`target-mono`). The
 * time is relative, in the text face with tabular figures, with the absolute UTC time in a tooltip.
 *
 * A row has one primary line (the sentence, truncated, with the time as a quiet caption at the end)
 * and at most one quiet secondary line. The status pill appears only
 * when something needs attention (`denied`, `failed`); `allowed` and `succeeded` are the default and
 * render no pill (the word stays in the accessible name). The detail line, usually the first line
 * of the SQL, is a single truncated mono line (it is code) in `mm-text-2`; the full statement
 * belongs in the blade.
 *
 * With `interactive`, the whole row is a button that fires `mm-activate`, usually to open a blade,
 * and the actor and target links stay separately clickable above it.
 *
 * @tagname mm-activity-item
 * @summary One event in the activity feed.
 * @slot - Extra inline content after the target, such as a tag.
 * @slot detail - A detail line, if it needs markup. Otherwise use `detail`.
 * @csspart row - The row.
 * @csspart avatar - The actor's avatar.
 * @csspart actor - The actor's name.
 * @csspart target - The target link.
 * @csspart detail - The detail line.
 * @fires mm-activate - {{}} An interactive item was activated by click, Enter or Space.
 */
export class MmActivityItem extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    timeStyles,
    css`
      :host {
        display: block;
        min-width: 0;
        container-type: inline-size;
      }
      :host(:not(:first-child)) .row {
        border-block-start: 1px solid var(--mm-rule);
      }
      .row {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        column-gap: var(--space-3);
        row-gap: 2px;
        align-items: start;
        padding-block: var(--space-2);
        padding-inline: var(--mm-feed-inset, var(--space-4));
        min-block-size: var(--mm-row, var(--row-default));
        font: var(--text-dense);
        color: var(--mm-text);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host([interactive]) .row:hover {
        background: var(--mm-sunken);
      }
      .row:has(.main:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        z-index: 1;
      }
      .avatar {
        padding-block-start: 1px;
      }
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-sm);
        box-shadow: inset 0 0 0 1px var(--mm-rule);
      }
      /* One line: the sentence truncates (full text in the title and accessible name), the time stays at the end. */
      .sentence {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .actor {
        font-weight: 600;
        color: var(--mm-text);
      }
      a.actor {
        position: relative;
        z-index: 1;
        text-decoration: none;
      }
      a.actor:hover,
      a.actor:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .target {
        color: var(--mm-text);
        font-weight: 600;
      }
      /* Links in rows are ink, underlined on hover and focus. Burnt sienna is for links in prose. */
      a.target {
        position: relative;
        z-index: 1;
        color: var(--mm-text);
        text-decoration: none;
      }
      a.target:hover,
      a.target:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .mono {
        font: var(--text-mono-dense);
        font-weight: 400;
      }
      .end {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding-block-start: 1px;
      }
      /* One quiet, truncated line. SQL keeps the mono face (it is code), at caption size. */
      .detail {
        grid-column: 2 / -1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
      }

      .main {
        all: unset;
        position: absolute;
        inset: 0;
        cursor: pointer;
      }
      .main:focus-visible {
        outline: none;
      }
      :host([selected]) .row,
      :host([selected]) .row:hover {
        background: var(--mm-selected);
        --mm-text-3: var(--mm-text-2);
      }
    `,
  ];

  /** Who did it: a person's name, an agent's identifier or a plugin. */
  @property() accessor actor = '';
  /** `person` (default), `agent`, `team` or `plugin`. Plugins show their provider logo and a "Plugin" word. */
  @property({ attribute: 'actor-kind', reflect: true }) accessor actorKind: AvatarKind | 'plugin' = 'person';
  /** For plugins: the provider key of the logo, such as `dbt` or `postgresql`. */
  @property({ attribute: 'actor-provider' }) accessor actorProvider = '';
  /** Links the actor's name. */
  @property({ attribute: 'actor-href' }) accessor actorHref = '';
  /** Actor photo URL, for people. */
  @property({ attribute: 'actor-src' }) accessor actorSrc = '';
  /** The verb phrase, written to read on from the actor: "queried", "changed the schema of", "updated 1,284 assets". */
  @property() accessor verb = '';
  /** The target's name, such as `orders_daily`. */
  @property() accessor target = '';
  /** Links the target. */
  @property({ attribute: 'target-href' }) accessor targetHref = '';
  /** Sets the target in mono, for MRNs and other machine identifiers. Names stay in the text face. */
  @property({ type: Boolean, attribute: 'target-mono' }) accessor targetMono = false;
  /** When it happened, as an ISO timestamp. */
  @property({ reflect: true }) accessor time = '';
  /** Optional status, such as `denied`. A pill shows only when it needs attention: `allowed` and `succeeded` render no pill. */
  @property() accessor status: StatusState | '' = '';
  /** The detail line: the first line of the SQL, in mono (it is code), as one quiet truncated line. */
  @property() accessor detail = '';
  /** Makes the row a button that fires `mm-activate`. */
  @property({ type: Boolean, reflect: true }) accessor interactive = false;
  /** Marks the item whose blade is open: `mm-selected` and `aria-current`. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;
  /** The time relative times are measured from. Set by the feed. */
  @property({ type: Number }) accessor now: number | undefined;
  /** Whether this item is the feed's tab stop. Managed by `mm-activity-feed`. */
  @property({ type: Boolean, attribute: false }) accessor tabStop = true;

  @state() accessor #hasDetail = false;
  @query('.main') accessor #main!: HTMLElement | null;
  #id = uid('mm-activity');

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  override focus(options?: FocusOptions): void {
    this.#main?.focus(options);
  }

  #onDetailSlot = (e: Event) => {
    this.#hasDetail = (e.target as HTMLSlotElement).assignedNodes().some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
  };

  override render() {
    const kind = this.actorKind;
    const kindWord =
      kind === 'agent' ? tr('agent', 'Agent') : kind === 'team' ? tr('team', 'Team') : kind === 'plugin' ? tr('plugin', 'Plugin') : '';
    const actor = this.actorHref
      ? html`<a class="actor" part="actor" href=${this.actorHref}>${this.actor}</a>`
      : html`<span class="actor" part="actor">${this.actor}</span>`;
    const targetCls = `target${this.targetMono ? ' mono' : ''}`;
    const target = this.target
      ? this.targetHref
        ? html`<a class=${targetCls} part="target" href=${this.targetHref}>${this.target}</a>`
        : html`<span class=${targetCls} part="target">${this.target}</span>`
      : nothing;
    const statusWord = this.status
      ? html`${isHappyPath(this.status) ? nothing : html`<mm-status-pill state=${this.status}></mm-status-pill>`}<span
            hidden
            id=${`${this.#id}-s`}
            >${STATUS_STATES[this.status]?.word() ?? this.status}</span
          >`
      : nothing;
    const hasDetail = !!this.detail || this.#hasDetail;
    return html`<div class="row" part="row">
      ${this.interactive
        ? html`<button
            class="main"
            type="button"
            data-feed-main
            tabindex=${this.tabStop ? 0 : -1}
            aria-current=${ifDefined(this.selected ? 'true' : undefined)}
            aria-labelledby=${`${this.#id}-t ${this.status ? `${this.#id}-s ` : ''}${this.#id}-w`}
            aria-describedby=${ifDefined(hasDetail ? `${this.#id}-d` : undefined)}
            @click=${() => emit(this, 'mm-activate', {})}
          ></button>`
        : nothing}
      <span class="avatar"
        >${kind === 'plugin'
          ? html`<span class="logo"><mm-provider-logo provider=${this.actorProvider} size="16" decorative></mm-provider-logo></span>`
          : html`<mm-avatar part="avatar" decorative name=${this.actor} kind=${kind} src=${this.actorSrc} size="24"></mm-avatar>`}</span
      >
      <p class="sentence" id=${`${this.#id}-t`} title=${[this.actor, this.verb, this.target].filter(Boolean).join(' ')}>
        ${actor}${kindWord ? html`<span class="visually-hidden">, ${kindWord}</span>` : nothing}
        ${this.verb} ${target}<slot></slot>
      </p>
      <span class="end">
        ${statusWord}
        ${relativeTime(this.time, this.now)}
        <span hidden id=${`${this.#id}-w`}>${timeText(this.time, this.now)}</span>
      </span>
      <div class="detail" part="detail" id=${`${this.#id}-d`} ?hidden=${!hasDetail} title=${this.detail || nothing}>
        <slot name="detail" @slotchange=${this.#onDetailSlot}>${this.detail}</slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-activity-feed': MmActivityFeed;
    'mm-activity-item': MmActivityItem;
  }
}
