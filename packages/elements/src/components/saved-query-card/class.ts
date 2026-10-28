import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { formatRelative } from '../../core/format.js';
import { onStringsChange, tr } from '../../core/strings.js';
import { MmProviderLogo } from '@marmotdata/icons';
import { tokenizeLines, renderTokens } from '../code-sample/highlight.js';
import '../button/define.js';
import '../menu-button/define.js';
import '../status-pill/define.js';
import { STATUS_STATES, isHappyPath, type StatusState } from '../status-pill/class.js';
import '@marmotdata/icons/define.js';

export type SavedQueryRunStatus = 'succeeded' | 'failed' | 'denied' | 'running' | 'cancelled' | '';

/**
 * A saved query card shows one saved query as an item in a list of saved queries, never as one of a
 * grid of identical cards: its name, a one-sentence description, then one quiet line of plain text
 * (no chips): the owner (a person or an agent, told apart by icon), the source with its provider
 * logo, and when it last ran, with a status pill only when the run needs attention (a succeeded run
 * gets none). The first three lines of SQL follow on the code ground, in mono. Open, Run and a More menu sit at the top.
 *
 * The card's border darkens on hover; it never lifts. Put several in a list with `space-3` between.
 *
 * @tagname mm-saved-query-card
 * @summary One saved query in a list: name, owner, source, last run and SQL preview.
 * @slot menu - An `mm-menu` of secondary actions (Duplicate, Share, Delete saved query).
 * @slot description - The description, if you need markup. Otherwise use `description`.
 * @csspart card - The card.
 * @csspart name - The name heading.
 * @csspart owner - The owner chip.
 * @csspart preview - The SQL preview.
 * @csspart actions - The action buttons.
 * @fires mm-open-query - {{ sql: string }} Open was activated (unless `href` is set, which navigates instead). Named so it never mixes with the More menu's own `mm-open`.
 * @fires mm-run - {{ sql: string }} Run was activated.
 */
export class MmSavedQueryCard extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      article {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: var(--space-2) var(--space-4);
        padding: var(--space-4);
        background: var(--mm-surface);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        transition: border-color var(--mm-dur-press) var(--mm-ease);
      }
      article:hover {
        border-color: var(--mm-control-border);
      }
      .name {
        margin: 0;
        font: var(--text-heading-sm);
        letter-spacing: var(--tracking-heading-sm, 0);
        overflow-wrap: anywhere;
        align-self: center;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        grid-row: 1;
        grid-column: 2;
      }
      .desc {
        grid-column: 1 / -1;
        margin: 0;
        font: var(--text-dense);
        color: var(--mm-text-2);
        max-width: 75ch;
      }
      .meta {
        grid-column: 1 / -1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
        font: var(--text-dense);
        color: var(--mm-text-2);
      }
      .meta > * {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
      }
      .owner {
        color: var(--mm-text);
      }
      .owner mm-icon {
        color: var(--mm-text-2);
      }
      .source-name {
        color: var(--mm-text-2);
      }
      time {
        font-variant-numeric: tabular-nums;
      }
      .preview {
        grid-column: 1 / -1;
        margin: var(--space-1) 0 0;
        padding: var(--space-2) var(--space-3);
        background: var(--mm-code-bg);
        color: var(--mm-code-text);
        border-radius: var(--radius-sm);
        font: var(--text-mono-dense);
        letter-spacing: var(--tracking-mono-dense, 0);
        overflow: hidden;
      }
      .preview .ln {
        display: block;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .k {
        color: var(--mm-syn-keyword);
      }
      .f {
        color: var(--mm-syn-function);
      }
      .s {
        color: var(--mm-syn-string);
      }
      .n {
        color: var(--mm-syn-number);
      }
      .c {
        color: var(--mm-syn-comment);
        font-style: italic;
      }
      @container (max-width: 480px) {
        .actions {
          grid-row: auto;
          grid-column: 1 / -1;
          order: 10;
        }
      }
    `,
  ];

  /** The saved query's name. */
  @property() accessor name = '';
  /** One sentence on what it answers. */
  @property() accessor description = '';
  /** The SQL. The first three lines are previewed. */
  @property() accessor sql = '';
  /** Owner's name: a person ("Jane Doe") or an agent ("support-triage-agent"). */
  @property() accessor owner = '';
  /** `person` (default) or `agent`. */
  @property({ attribute: 'owner-kind', reflect: true }) accessor ownerKind: 'person' | 'agent' = 'person';
  /** Source name, such as `shop-postgres`. */
  @property() accessor source = '';
  /** Provider key for the source's logo, such as `postgresql`. */
  @property() accessor provider = '';
  /** Status of the last run. Empty when it has never run. */
  @property({ attribute: 'last-run-status', reflect: true }) accessor lastRunStatus: SavedQueryRunStatus = '';
  /** When it last ran: ISO string or epoch milliseconds. */
  @property({ attribute: 'last-run-at' }) accessor lastRunAt = '';
  /** Link for Open. Without it, Open fires `mm-open-query`. */
  @property() accessor href = '';
  /** Heading level of the name, 2 to 6. Defaults to 3. */
  @property({ type: Number }) accessor level = 3;
  /** Reference time for the relative last-run time, in epoch milliseconds. Defaults to now. */
  @property({ type: Number }) accessor now: number | undefined;

  #id = uid('mm-sqc');
  #unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unsubscribe = onStringsChange(() => this.requestUpdate());
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
  }

  #heading() {
    const level = Math.min(6, Math.max(2, Math.round(this.level)));
    return html`<div class="name" part="name" role="heading" aria-level=${level} id="${this.#id}-name">${this.name}</div>`;
  }

  #preview() {
    const lines = tokenizeLines(this.sql, 'sql')
      .filter((l, i, all) => l.some((t) => t.v.trim()) || i < all.length - 1)
      .slice(0, 3);
    return html`<pre class="preview" part="preview" dir="ltr" translate="no">${lines.map((line) => html`<span class="ln">${renderTokens(line)}</span>`)}</pre>`;
  }

  override render() {
    const runAt = this.lastRunAt ? new Date(/^\d+$/.test(this.lastRunAt) ? Number(this.lastRunAt) : this.lastRunAt) : null;
    const now = this.now ?? Date.now();
    const named = (key: string, fallback: string) => (this.name ? `${tr(key, fallback)}: ${this.name}` : tr(key, fallback));
    const ownerWord = this.ownerKind === 'agent' ? tr('ownerAgent', 'Agent') : tr('ownerPerson', 'Person');
    return html`<article part="card" aria-labelledby="${this.#id}-name">
      ${this.#heading()}
      <div class="actions" part="actions">
        <mm-button size="sm" href=${this.href} @click=${this.#onOpen}>${tr('open', 'Open')}</mm-button>
        <mm-button size="sm" icon="play-arrow" @click=${() => emit(this, 'mm-run', { sql: this.sql })}>${tr('runShort', 'Run')}</mm-button>
        <mm-menu-button variant="ghost" size="sm" icon="more-horiz" icon-only label=${named('moreActions', 'More actions')}>
          <slot name="menu"></slot>
        </mm-menu-button>
      </div>
      ${this.description || this.querySelector?.('[slot="description"]')
        ? html`<p class="desc"><slot name="description">${this.description}</slot></p>`
        : nothing}
      <div class="meta">
        ${this.owner
          ? html`<span class="owner ${this.ownerKind}" part="owner"
              ><mm-icon name=${this.ownerKind === 'agent' ? 'smart-toy' : 'person'} aria-hidden="true"></mm-icon
              ><span class="visually-hidden">${tr('owner', 'Owner')} (${ownerWord}):</span>${this.owner}</span
            >`
          : nothing}
        ${this.source
          ? html`<span
              >${this.provider
                ? html`<mm-provider-logo provider=${this.provider} size="16" aria-hidden="true" decorative></mm-provider-logo
                    ><span class="visually-hidden">${MmProviderLogo.displayName(this.provider)}</span>`
                : nothing}<span class="source-name">${this.source}</span></span
            >`
          : nothing}
        <span>
          ${this.lastRunStatus
            ? html`<span class="visually-hidden">${tr('lastRun', 'Last run')}:</span>${isHappyPath(this.lastRunStatus)
                  ? html`<span class="visually-hidden">${STATUS_STATES[this.lastRunStatus as StatusState]?.word() ?? this.lastRunStatus},</span>`
                  : html`<mm-status-pill state=${this.lastRunStatus}></mm-status-pill>`}
                ${runAt ? html`<time datetime=${runAt.toISOString()}>${formatRelative(runAt, now)}</time>` : nothing}`
            : html`${tr('notRunYet', 'Not run yet')}`}
        </span>
      </div>
      ${this.sql ? this.#preview() : nothing}
    </article>`;
  }

  #onOpen = (e: Event) => {
    if (this.href) return;
    e.preventDefault();
    emit(this, 'mm-open-query', { sql: this.sql });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-saved-query-card': MmSavedQueryCard;
  }
}
