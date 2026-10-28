import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import type { AvatarKind } from '../avatar/class.js';
import '../avatar/define.js';
import '../hover-card/define.js';
import '../person-card/define.js';
import '@marmotdata/icons/define.js';

export interface OwnerRemoveDetail {
  name: string;
  kind: AvatarKind;
}

/**
 * An owner chip names who owns or did something: a person, an agent or a team, as an avatar and a
 * name. Agents are shown by the robot avatar and teams by the group avatar, with the kind word
 * ("Agent", "Team") given to screen readers only: there is no "AGENT" text tag. Agents may show the
 * service account they run as, after the name in a quiet caption. The difference is always an icon
 * (and, for assistive technology, a word), never the avatar tint alone.
 *
 * By default it is plain inline content with no box: an owner appears in table cells, feed rows
 * and page headers, and a filled chip in every row would be chrome competing with the data
 * (structure felt, not seen). `radius-full` is reserved for avatars and pills, so when the owner
 * is being edited (`removable`), it becomes a `radius-sm` chip on `mm-sunken` like a tag, so the
 * remove button visibly belongs to it.
 *
 * With `href`, the name is a link in ink with an underline on hover and focus, never burnt sienna:
 * links in rows, tables and cards are ink. With `hover-card` as well, people and agents get an
 * `mm-person-card` preview after 300ms. The remove button is named "Remove Jane Doe", fires
 * `mm-remove` on click, Enter, Space, Delete or Backspace, and never removes the chip itself: move
 * focus to a sensible neighbour when you remove it.
 *
 * @tagname mm-owner-chip
 * @summary Avatar and name for a person, agent or team.
 * @csspart chip - The wrapper (the box when `removable`).
 * @csspart avatar - The `mm-avatar`.
 * @csspart name - The name, a link with `href`.
 * @csspart kind - The "Agent" or "Team" word, visually hidden.
 * @csspart service-account - The service account caption.
 * @csspart remove - The remove button.
 * @fires mm-remove - {OwnerRemoveDetail} The remove button was activated. Cancelable.
 */
export class MmOwnerChip extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        min-width: 0;
        max-width: 100%;
        vertical-align: middle;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
        max-width: 100%;
        font: var(--text-dense);
        color: var(--mm-text);
      }
      :host([removable]) .chip {
        block-size: 28px;
        padding-inline: 2px;
        gap: 6px;
        border-radius: var(--radius-sm);
        background: var(--mm-sunken);
      }
      .name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: inherit;
        font-weight: 600;
      }
      a.name {
        text-decoration: none;
        border-radius: 2px;
      }
      a.name:hover,
      a.name:focus-visible {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .sa {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      mm-hover-card {
        min-width: 0;
        display: inline-flex;
      }
      .remove {
        all: unset;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 24px;
        block-size: 24px;
        border-radius: var(--radius-sm);
        color: var(--mm-text-2);
        cursor: pointer;
        transition:
          background-color var(--mm-dur-press) var(--mm-ease),
          color var(--mm-dur-press) var(--mm-ease);
      }
      .remove:hover {
        color: var(--mm-text);
        background: var(--mm-rule);
      }
      .remove:focus-visible {
        outline: var(--mm-focus-ring-width, 2px) solid var(--mm-text);
        outline-offset: 0;
      }
      @media (pointer: coarse) {
        .remove {
          inline-size: var(--target-touch, 44px);
          block-size: var(--target-touch, 44px);
          margin-block: -8px;
        }
      }
    `,
  ];

  /** The person's name, the agent's identifier or the team's name. */
  @property() accessor name = '';
  /** `person` (default), `agent` or `team`. */
  @property({ reflect: true }) accessor kind: AvatarKind = 'person';
  /** Photo URL for people. */
  @property() accessor src = '';
  /** Links the name to the profile, agent or team page. */
  @property() accessor href = '';
  /** For agents: the service account it runs as, such as `svc-support`, shown as a quiet caption. */
  @property({ attribute: 'service-account' }) accessor serviceAccount = '';
  /** Avatar size: 20 (default) or 24. */
  @property({ type: Number, attribute: 'avatar-size' }) accessor avatarSize: 20 | 24 = 20;
  /** Shows a remove button and draws the chip as a box, for editing owners. */
  @property({ type: Boolean, reflect: true }) accessor removable = false;
  /** With `href`, previews people and agents in an `mm-person-card` on hover and focus. */
  @property({ type: Boolean, attribute: 'hover-card' }) accessor hoverCard = false;
  /** Job title for the hover card. */
  @property({ attribute: 'job-title' }) accessor jobTitle = '';
  /** Team (or, for agents, the owning team) for the hover card. */
  @property() accessor team = '';
  /** Email for the hover card. */
  @property() accessor email = '';

  #remove = () => {
    emit<OwnerRemoveDetail>(this, 'mm-remove', { name: this.name, kind: this.kind }, { cancelable: true });
  };

  #onRemoveKey = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.#remove();
    }
  };

  override render() {
    const kindWord = this.kind === 'agent' ? tr('agent', 'Agent') : this.kind === 'team' ? tr('team', 'Team') : '';
    let name = this.href
      ? html`<a part="name" class="name" href=${this.href}>${this.name}</a>`
      : html`<span part="name" class="name">${this.name}</span>`;
    if (this.href && this.hoverCard && this.kind !== 'team') {
      name = html`<mm-hover-card
        ><a slot="trigger" part="name" class="name" href=${this.href}>${this.name}</a
        ><mm-person-card
          name=${this.name}
          kind=${this.kind}
          job-title=${this.jobTitle || nothing}
          team=${this.team || nothing}
          email=${this.email || nothing}
          service-account=${this.serviceAccount || nothing}
          href=${this.href}
        ></mm-person-card
      ></mm-hover-card>`;
    }
    return html`<span part="chip" class="chip">
      <mm-avatar part="avatar" decorative name=${this.name} kind=${this.kind} src=${this.src} size=${this.avatarSize}></mm-avatar>
      ${name}
      ${kindWord ? html`<span part="kind" class="visually-hidden">, ${kindWord}</span>` : nothing}
      ${this.kind === 'agent' && this.serviceAccount
        ? html`<span part="service-account" class="sa"
            ><span class="visually-hidden">${tr('runsAs', 'Runs as')} </span>${this.serviceAccount}</span
          >`
        : nothing}
      ${this.removable
        ? html`<button
            part="remove"
            class="remove"
            type="button"
            aria-label=${tr('removeOwner', 'Remove {name}', { name: this.name })}
            @click=${this.#remove}
            @keydown=${this.#onRemoveKey}
          >
            <mm-icon name="close" size="14"></mm-icon>
          </button>`
        : nothing}
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-owner-chip': MmOwnerChip;
  }
}
