import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import { relativeTime, timeStyles, timeText } from '../activity-feed/time.js';
import '../button/define.js';
import '../segmented-control/define.js';
import '../empty-state/define.js';
import '../skeleton/define.js';
import '@marmotdata/icons/define.js';

export type NotificationType =
  | 'system'
  | 'schema_change'
  | 'asset_change'
  | 'team_invite'
  | 'mention'
  | 'job_complete'
  | 'upstream_schema_change'
  | 'downstream_schema_change'
  | 'lineage_change'
  | 'asset_deleted'
  | 'access_expiry';

export type NotificationFilter = 'all' | 'unread' | 'read';

export interface NotificationReadDetail {
  id: string;
  read: boolean;
}

/** Icon and spoken type word for each notification type. */
export const NOTIFICATION_TYPES: Record<NotificationType, { icon: string; word: () => string }> = {
  system: { icon: 'info', word: () => tr('notifSystem', 'System') },
  schema_change: { icon: 'schema', word: () => tr('notifSchemaChange', 'Schema change') },
  asset_change: { icon: 'edit-note', word: () => tr('notifAssetChange', 'Asset change') },
  team_invite: { icon: 'group-add', word: () => tr('notifTeamInvite', 'Team invitation') },
  mention: { icon: 'alternate-email', word: () => tr('notifMention', 'Mention') },
  job_complete: { icon: 'task-alt', word: () => tr('notifJobComplete', 'Job complete') },
  upstream_schema_change: { icon: 'input', word: () => tr('notifUpstreamSchema', 'Upstream schema change') },
  downstream_schema_change: { icon: 'output', word: () => tr('notifDownstreamSchema', 'Downstream schema change') },
  lineage_change: { icon: 'account-tree', word: () => tr('notifLineageChange', 'Lineage change') },
  asset_deleted: { icon: 'delete', word: () => tr('notifAssetDeleted', 'Asset deleted') },
  access_expiry: { icon: 'hourglass-empty', word: () => tr('notifAccessExpiry', 'Access expiry') },
};

const isItem = (n: Element): n is MmNotificationItem => n.localName === 'mm-notification-item';

/**
 * Notifications tell people what changed in the parts of the catalog they own or subscribe to: a
 * schema change on `shop.orders.v2`, a mention in a glossary comment, a finished plugin run, read
 * access about to expire. The same list fills the bell popover and the notifications page.
 *
 * Unread notifications are marked three ways, never by colour alone: a small ink dot, a visually
 * hidden word "Unread" and a 600-weight title. With `filters`, an All, Unread and Read segmented
 * control filters the list in place. "Mark all as read" appears while anything is unread and fires
 * `mm-read-all`; unless that is cancelled, every item is marked read.
 *
 * Keyboard: the notifications are one tab stop. Up and Down move between them, Home and End jump to
 * the first and last, and Enter opens one (`mm-activate`). The tab stop is the item's title link
 * (or button); from it, Tab reaches the target link and the "Mark as read" and "Delete" buttons. When an item is deleted, or marked read while the Unread filter
 * is on, focus moves to the next notification so keyboard users never lose their place.
 *
 * @tagname mm-notification-list
 * @summary Notifications for the bell popover and the notifications page.
 * @slot - `mm-notification-item` elements, newest first.
 * @csspart toolbar - The filter and "Mark all as read" row.
 * @fires mm-read-all - {{}} "Mark all as read" was activated. Cancelable.
 * @fires mm-filter - {{ value: NotificationFilter }} The filter changed.
 * @fires mm-retry - {{}} The retry button on the error was activated.
 */
export class MmNotificationList extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, slotAssignment: 'manual' };

  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
        --_inset: var(--mm-notification-inset, var(--space-4));
      }
      .toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-2) var(--_inset);
        border-block-end: 1px solid var(--mm-rule);
      }
      .toolbar:empty {
        display: none;
      }
      .body:focus {
        outline: none;
      }
      .spacer {
        flex: 1;
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
      }
      .error mm-icon {
        color: var(--mm-danger);
      }
    `,
  ];

  /** Shows the All, Unread and Read filter. */
  @property({ type: Boolean, reflect: true }) accessor filters = false;
  /** The current filter: `all` (default), `unread` or `read`. */
  @property({ reflect: true }) accessor filter: NotificationFilter = 'all';
  /** Placeholders while loading. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message, shown with a retry button. */
  @property() accessor error = '';
  /** Names the list. Defaults to "Notifications". */
  @property() accessor label = '';
  /** The time relative times are measured from, as a timestamp. Defaults to now. */
  @property({ type: Number }) accessor now: number | undefined;

  @state() accessor #visible: MmNotificationItem[] = [];
  @state() accessor #unread = 0;
  @query('slot') accessor #slot!: HTMLSlotElement | null;
  #observer?: MutationObserver;
  #id = uid('mm-notifications');

  get #items(): MmNotificationItem[] {
    return Array.from(this.children).filter(isItem);
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', (e) => {
      const to = e.relatedTarget as Node | null;
      if (to && !this.contains(to) && !this.renderRoot.contains(to)) this.#focusIndex = -1;
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#refresh();
    this.#observer = new MutationObserver(() => this.#refresh());
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['read'] });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  /** Where focus was, as an index into the visible items, so it can be put back after a change. */
  #focusIndex = -1;

  #onFocusIn = (e: FocusEvent) => {
    const item = e.target as MmNotificationItem;
    const i = this.#visible.indexOf(item);
    if (i >= 0) {
      this.#focusIndex = i;
      this.#syncTabStops(item);
    }
  };

  #isRead = (i: MmNotificationItem) => i.read || i.hasAttribute('read');

  #refresh() {
    const items = this.#items;
    const prev = this.#visible;
    this.#unread = items.filter((i) => !this.#isRead(i)).length;
    if (this.now !== undefined) for (const i of items) i.now = this.now;
    const visible = items.filter((i) => this.#matches(i));
    this.#visible = visible;
    const activeItem = items.find((i) => i.matches(':focus-within'));
    const lost = !activeItem && (!document.activeElement || document.activeElement === document.body);
    const gone = prev.some((i) => !visible.includes(i));
    const rescue = this.#focusIndex >= 0 && gone && (lost || (!!activeItem && !visible.includes(activeItem)));
    this.#syncTabStops(activeItem && visible.includes(activeItem) ? activeItem : undefined);
    // The item the person was on was deleted or filtered out: move to the one now in its place.
    if (rescue) {
      const idx = Math.min(this.#focusIndex, visible.length - 1);
      void this.updateComplete.then(() => {
        const target = visible[idx];
        if (target) {
          this.#syncTabStops(target);
          target.focus();
        } else {
          this.#focusIndex = -1;
          this.renderRoot.querySelector<HTMLElement>('[data-fallback-focus]')?.focus();
        }
      });
    }
  }

  #matches(i: MmNotificationItem): boolean {
    if (this.filter === 'unread') return !this.#isRead(i);
    if (this.filter === 'read') return this.#isRead(i);
    return true;
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('filter') && changed.get('filter') !== undefined) this.#refresh();
    if (changed.has('now')) for (const i of this.#items) i.now = this.now;
  }

  protected override updated(): void {
    this.#slot?.assign(...this.#visible);
  }

  #syncTabStops(current?: MmNotificationItem) {
    const stop = current ?? this.#visible[0];
    for (const i of this.#items) i.tabStop = i === stop;
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const origin = e.composedPath()[0] as Element | undefined;
    if (!origin?.hasAttribute?.('data-notification-main')) return;
    const nav = this.#visible;
    const i = nav.indexOf(e.target as MmNotificationItem);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(nav.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = nav.length - 1;
    e.preventDefault();
    const target = nav[next]!;
    this.#syncTabStops(target);
    target.focus();
  };

  #markAll = () => {
    if (!emit(this, 'mm-read-all', {}, { cancelable: true })) return;
    for (const i of this.#items) i.read = true;
  };

  #onFilter = (e: CustomEvent<{ value: string }>) => {
    e.stopPropagation();
    this.filter = e.detail.value as NotificationFilter;
    this.#focusIndex = -1;
    emit(this, 'mm-filter', { value: this.filter });
  };

  #body() {
    if (this.error)
      return html`<div class="state">
        <p class="error" role="alert">
          <mm-icon name="error"></mm-icon><span>${this.error}</span>
          <mm-button size="sm" variant="secondary" icon="refresh" @click=${() => emit(this, 'mm-retry', {})}>${tr('tryAgain', 'Try again')}</mm-button>
        </p>
      </div>`;
    if (this.loading && !this.#visible.length)
      return html`<div class="state"><mm-skeleton loading shape="text" count="4"></mm-skeleton></div>`;
    if (!this.#visible.length) {
      const read = this.filter === 'read';
      return html`<mm-empty-state
        compact
        level="3"
        heading=${read ? tr('notifEmptyReadHeading', 'No read notifications') : tr('notifEmptyHeading', 'You’re up to date')}
        description=${read
          ? tr('notifEmptyReadDescription', 'Notifications you have read will appear here.')
          : tr('notifEmptyDescription', 'Changes to assets you own or subscribe to will appear here.')}
      ></mm-empty-state>`;
    }
    return nothing;
  }

  override render() {
    const label = this.label || tr('notifications', 'Notifications');
    return html`<div class="toolbar" part="toolbar">${this.filters
        ? html`<mm-segmented-control label=${tr('notifFilter', 'Show')} hide-label value=${this.filter} @mm-change=${this.#onFilter}>
            <mm-segment value="all">${tr('notifAll', 'All')}</mm-segment>
            <mm-segment value="unread">${tr('notifUnread', 'Unread')}</mm-segment>
            <mm-segment value="read">${tr('notifRead', 'Read')}</mm-segment>
          </mm-segmented-control>`
        : nothing}${this.filters || this.#unread
        ? html`<span class="spacer"></span>`
        : nothing}${this.#unread
        ? html`<mm-button size="sm" variant="ghost" icon="done-all" @click=${this.#markAll}>${tr('notifMarkAllRead', 'Mark all as read')}</mm-button>`
        : nothing}</div
      ><span class="visually-hidden" aria-live="polite">${this.#unread
        ? tr('notifUnreadCount', '{count} unread', { count: this.#unread })
        : ''}</span
      ><div role="list" aria-label=${label} id=${this.#id} ?hidden=${!this.#visible.length}><slot></slot></div
      ><div class="body" tabindex="-1" data-fallback-focus>${this.#body()}</div>`;
  }
}

/**
 * One notification: an icon for its type, a title sentence, and one quiet secondary line holding
 * the short message and the target link ("Two columns were added · shop.orders.v2"), truncated to a
 * single line with the full text on hover. The time it arrived is relative, in the text face with
 * tabular figures, with the absolute UTC time in a tooltip. The target link is ink, underlined on
 * hover and focus. Unread items have an ink dot, the hidden word "Unread" and a 600-weight title.
 *
 * The title opens the notification (`mm-activate`, or a link with `href`) and covers the whole row;
 * the target link and the "Mark as read" and "Delete notification" buttons sit above it. Marking
 * read or unread fires a cancelable `mm-read` and then updates `read`; deleting fires `mm-delete`
 * and leaves removal to you.
 *
 * @tagname mm-notification-item
 * @summary One notification with read and delete actions.
 * @slot - The message, if it needs markup. Otherwise use `message`.
 * @csspart row - The row.
 * @csspart icon - The type icon.
 * @csspart title - The title, a button or link.
 * @csspart target - The target link.
 * @csspart actions - The action buttons.
 * @fires mm-activate - {{ id: string }} The notification was opened by click, Enter or Space.
 * @fires mm-read - {NotificationReadDetail} Marked read or unread. Cancelable.
 * @fires mm-delete - {{ id: string }} "Delete notification" was activated. The item never removes itself.
 */
export class MmNotificationItem extends LitElement {
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
        grid-template-columns: 6px 16px minmax(0, 1fr) auto;
        column-gap: var(--space-3);
        align-items: start;
        padding-block: var(--space-3);
        padding-inline: var(--mm-notification-inset, var(--space-4));
        padding-inline-start: calc(var(--mm-notification-inset, var(--space-4)) - var(--space-2));
        font: var(--text-dense);
        color: var(--mm-text);
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .row:hover {
        background: var(--mm-sunken);
      }
      .row:has(.main:focus-visible) {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: calc(-1 * var(--mm-focus-ring-width, 2px));
        z-index: 1;
      }
      .dot {
        inline-size: 6px;
        block-size: 6px;
        margin-block-start: 7px;
        border-radius: var(--radius-full);
        background: var(--mm-text);
      }
      :host([read]) .dot {
        visibility: hidden;
      }
      .icon {
        color: var(--mm-text-2);
        padding-block-start: 2px;
      }
      :host([type='access_expiry']) .icon {
        color: var(--mm-warning);
      }
      .text {
        min-width: 0;
        display: grid;
        gap: 2px;
      }
      .main {
        all: unset;
        font-weight: 600;
        color: var(--mm-text);
        overflow-wrap: normal;
        cursor: pointer;
      }
      :host([read]) .main {
        font-weight: 400;
      }
      .main::after {
        content: '';
        position: absolute;
        inset: 0;
      }
      .main:focus-visible {
        outline: none;
      }
      /* One quiet secondary line: the message and the target, truncated. */
      .message {
        min-width: 0;
        margin: 0;
        font: var(--text-caption);
        color: var(--mm-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sep {
        padding-inline: 0.4em;
      }
      /* Links in rows are ink, underlined on hover and focus. Burnt sienna is for links in prose. */
      .target {
        position: relative;
        z-index: 1;
        color: var(--mm-text-2);
        text-decoration: none;
      }
      a.target:hover,
      a.target:focus-visible {
        color: var(--mm-text);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }

      /* Narrow items: the time and actions drop under the text instead of squeezing it. */
      @container (max-width: 480px) {
        .row {
          grid-template-columns: 6px 16px minmax(0, 1fr);
          row-gap: var(--space-1);
        }
        .end {
          grid-column: 3;
          grid-row: 2;
          justify-self: start;
          margin-inline-start: calc(-1 * var(--space-2));
        }
      }
      .end {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      /* The list usually sits in the bell popover, a raised layer, where captions use ink-2 (Peat contrast). */
      .end .time {
        margin-inline-end: var(--space-1);
        color: var(--mm-text-2);
      }
    `,
  ];

  /** The notification type, which sets the icon. */
  @property({ reflect: true }) accessor type: NotificationType = 'system';
  /** The title sentence: "The schema of shop.orders.v2 changed". */
  @property() accessor heading = '';
  /** A short message, shown with the target on one quiet line under the title. */
  @property() accessor message = '';
  /** The target's name, shown as an ink link after the message. */
  @property() accessor target = '';
  /** Where the target link goes. */
  @property({ attribute: 'target-href' }) accessor targetHref = '';
  /** Makes the title a link. Without it the title is a button that fires `mm-activate`. */
  @property() accessor href = '';
  /** When it arrived, as an ISO timestamp. */
  @property() accessor time = '';
  /** Whether it has been read. */
  @property({ type: Boolean, reflect: true }) accessor read = false;
  /** The notification's ID, passed in event details. */
  @property({ attribute: 'notification-id' }) accessor notificationId = '';
  /** The time relative times are measured from. Set by the list. */
  @property({ type: Number }) accessor now: number | undefined;
  /** Whether this item is the list's tab stop. Managed by `mm-notification-list`. */
  @property({ type: Boolean, attribute: false }) accessor tabStop = true;

  @query('.main') accessor #main!: HTMLElement | null;
  #id = uid('mm-notification');

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
  }

  override focus(options?: FocusOptions): void {
    this.#main?.focus(options);
  }

  #toggleRead = () => {
    const read = !this.read;
    if (!emit<NotificationReadDetail>(this, 'mm-read', { id: this.notificationId, read }, { cancelable: true })) return;
    this.read = read;
  };

  override render() {
    const meta = NOTIFICATION_TYPES[this.type] ?? NOTIFICATION_TYPES.system;
    const describedby = `${this.#id}-m ${this.#id}-w`;
    const titleInner = html`${this.read ? nothing : html`<span class="visually-hidden">${tr('notifUnread', 'Unread')}, </span>`}<span
        class="visually-hidden"
        >${meta.word()}: </span
      >${this.heading}`;
    const main = this.href
      ? html`<a
          class="main"
          part="title"
          href=${this.href}
          data-notification-main
          tabindex=${this.tabStop ? 0 : -1}
          aria-describedby=${describedby}
          @click=${() => emit(this, 'mm-activate', { id: this.notificationId })}
          >${titleInner}</a
        >`
      : html`<button
          class="main"
          part="title"
          type="button"
          data-notification-main
          tabindex=${this.tabStop ? 0 : -1}
          aria-describedby=${describedby}
          @click=${() => emit(this, 'mm-activate', { id: this.notificationId })}
        >
          ${titleInner}
        </button>`;
    return html`<div class="row" part="row">
      <span class="dot" aria-hidden="true"></span>
      <mm-icon part="icon" class="icon" name=${meta.icon}></mm-icon>
      <div class="text">
        ${main}
        <p class="message" id=${`${this.#id}-m`} title=${[this.message, this.target].filter(Boolean).join(' · ') || nothing}>
          <slot>${this.message}</slot>${this.target
            ? html`${this.message || this.textContent?.trim() ? html`<span class="sep" aria-hidden="true">·</span>` : nothing}${this.targetHref
                ? html`<a part="target" class="target" href=${this.targetHref}>${this.target}</a>`
                : html`<span part="target" class="target">${this.target}</span>`}`
            : nothing}
        </p>
      </div>
      <div class="end" part="actions">
        ${relativeTime(this.time, this.now)}
        <span hidden id=${`${this.#id}-w`}>${timeText(this.time, this.now)}</span>
        <mm-button
          size="sm"
          variant="ghost"
          icon=${this.read ? 'mail' : 'check'}
          label=${this.read ? tr('notifMarkUnread', 'Mark as unread') : tr('notifMarkRead', 'Mark as read')}
          @click=${this.#toggleRead}
        ></mm-button>
        <mm-button
          size="sm"
          variant="ghost"
          icon="delete"
          label=${tr('notifDelete', 'Delete notification')}
          @click=${() => emit(this, 'mm-delete', { id: this.notificationId })}
        ></mm-button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-notification-list': MmNotificationList;
    'mm-notification-item': MmNotificationItem;
  }
}
