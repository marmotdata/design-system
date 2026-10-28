import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import { cardStyles } from '../asset-card/class.js';
import '@marmotdata/icons/define.js';
import '../skeleton/define.js';

/** Two initials from a person's name or an agent's identifier ("Jane Doe" → "JD", "support-triage-agent" → "ST"). */
export function initials(name: string): string {
  const words = name.trim().split(/[\s_\-.@]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Person cards say who someone is: an owner, a member, or an agent acting on someone's behalf.
 * People and agents are told apart by icon and word first (`person` and "Person", `smart-toy` and
 * "Agent"), and by tint second: the initials avatar sits on `mm-info-soft` for people and
 * `mm-primary-tint` for agents. Agents also show the service account they run as, in mono (an
 * identifier people copy). The name and email links are ink, underlined on hover and focus.
 *
 * Built for `mm-hover-card` and usable on its own; set `framed` for a bordered surface outside a
 * panel or popover. `loading` and `error` behave as on `mm-asset-card`.
 *
 * @tagname mm-person-card
 * @summary Who a person or agent is.
 * @csspart card - The content grid.
 * @csspart avatar - The initials avatar.
 * @csspart name - The name, a link when `href` is set.
 * @csspart kind - The person or agent label.
 * @cssprop --mm-card-width - Card width. Defaults to 320px.
 */
export class MmPersonCard extends LitElement {
  static override styles = [
    base,
    cardStyles,
    css`
      .avatar {
        flex: none;
        display: inline-grid;
        place-items: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--radius-full);
        background: var(--mm-info-soft);
        color: var(--mm-text);
        font: var(--text-button);
        font-variant-numeric: tabular-nums;
      }
      :host([kind='agent']) .avatar {
        background: var(--mm-primary-tint);
      }
      .kind {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
        margin: 0;
      }
      /* Links in cards are ink, underlined on hover and focus. */
      a.email {
        color: var(--mm-text);
        text-decoration: none;
      }
      a.email:hover,
      a.email:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      /* The service account is an identifier people copy, so it stays mono. */
      .mono {
        font: var(--text-mono-dense);
        color: var(--mm-text-2);
      }
    `,
  ];

  /** Full name, or the agent's identifier (`support-triage-agent`). */
  @property() accessor name = '';
  /** `person` (default) or `agent`. */
  @property({ reflect: true }) accessor kind: 'person' | 'agent' = 'person';
  /** Job title, e.g. "Analytics engineer", or what an agent does. (Not `role`, which is the ARIA role.) */
  @property({ attribute: 'job-title' }) accessor jobTitle = '';
  /** Team, e.g. "Analytics Engineering". For agents, the team that owns it. */
  @property() accessor team = '';
  /** Email address, shown as a mail link. */
  @property() accessor email = '';
  /** For agents: the service account it runs as, e.g. `svc-support-triage@marmot`. */
  @property({ attribute: 'service-account' }) accessor serviceAccount = '';
  /** Link to the profile page. Makes the name a link. */
  @property() accessor href = '';
  /** Shows a skeleton while loading. */
  @property({ type: Boolean, reflect: true }) accessor loading = false;
  /** An error message in place of the content. */
  @property() accessor error = '';
  /** A bordered surface for use outside a panel or popover. */
  @property({ type: Boolean, reflect: true }) accessor framed = false;

  override render() {
    if (this.error) {
      return html`<div part="card" class="card">
        <p class="error" role="alert"><mm-icon name="error"></mm-icon><span>${this.error}</span></p>
      </div>`;
    }
    if (this.loading) {
      return html`<div part="card" class="card"><mm-skeleton loading shape="text" count="3"></mm-skeleton></div>`;
    }
    const agent = this.kind === 'agent';
    return html`<div part="card" class="card">
      <div class="head">
        <span part="avatar" class="avatar" aria-hidden="true">${initials(this.name)}</span>
        <div class="titles">
          ${this.href
            ? html`<a part="name" class="name" href=${this.href}>${this.name}</a>`
            : html`<p part="name" class="name">${this.name}</p>`}
          ${this.jobTitle ? html`<p class="muted">${this.jobTitle}</p>` : nothing}
          <p part="kind" class="kind">
            <mm-icon name=${agent ? 'smart-toy' : 'person'}></mm-icon>${agent ? tr('agent', 'Agent') : tr('person', 'Person')}
          </p>
        </div>
      </div>
      ${this.team || this.email || (agent && this.serviceAccount)
        ? html`<dl>
            ${this.team ? html`<dt>${agent ? tr('ownedBy', 'Owned by') : tr('team', 'Team')}</dt><dd>${this.team}</dd>` : nothing}
            ${agent && this.serviceAccount ? html`<dt>${tr('runsAs', 'Runs as')}</dt><dd class="mono">${this.serviceAccount}</dd>` : nothing}
            ${this.email ? html`<dt>${tr('email', 'Email')}</dt><dd><a class="email" href=${`mailto:${this.email}`}>${this.email}</a></dd>` : nothing}
          </dl>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-person-card': MmPersonCard;
  }
}
