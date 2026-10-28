import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

export type AvatarKind = 'person' | 'agent' | 'team';
export type AvatarSize = 20 | 24 | 32 | 40;

/** One or two initials from a name ("Jane Doe" → "JD", "support-triage-agent" → "ST"); one at 20px. */
export function avatarInitials(name: string, max = 2): string {
  const words = name
    .trim()
    .split(/[\s_\-.@]+/)
    .filter(Boolean);
  return words
    .slice(0, max)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('');
}

/** The accessible name of an avatar: the name, with the kind word for agents and teams. */
export function avatarLabel(name: string, kind: AvatarKind): string {
  if (kind === 'agent') return tr('avatarAgent', '{name}, agent', { name });
  if (kind === 'team') return tr('avatarTeam', '{name}, team', { name });
  return name;
}

const ICON_SIZE: Record<number, number> = { 20: 14, 24: 16, 32: 20, 40: 24 };

/**
 * Avatars say who did something: a person, an agent or a team. People show their photo, or their
 * initials in ink on `mm-info-soft` when there is no photo or it fails to load. Agents always show
 * the `smart-toy` robot on `mm-primary-tint` instead of a photo, so an agent can't pass for a
 * person. Teams show the `groups` icon on `mm-sunken`. The tint is secondary: the icon or the
 * initials carry the difference, and the accessible name says "agent" or "team" too.
 *
 * Avatars are the one round thing besides status and filter pills. Sizes are 20, 24 (default), 32
 * and 40px. The accessible name is `name` (with the kind word for agents and teams); set
 * `decorative` when the name is printed next to the avatar, as in `mm-owner-chip`.
 *
 * @tagname mm-avatar
 * @summary A person's photo or initials, an agent's robot or a team's icon.
 * @csspart avatar - The circle.
 * @csspart image - The photo.
 * @csspart initials - The initials.
 * @csspart icon - The agent or team icon.
 * @cssprop --mm-avatar-ring - A 2px ring colour drawn around the circle, for stacks. Defaults to none.
 */
export class MmAvatar extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: inline-flex;
        flex: none;
        vertical-align: middle;
        --_s: 24px;
      }
      :host([size='20']) {
        --_s: 20px;
      }
      :host([size='32']) {
        --_s: 32px;
      }
      :host([size='40']) {
        --_s: 40px;
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--_s);
        block-size: var(--_s);
        border-radius: var(--radius-full);
        overflow: hidden;
        background: var(--mm-info-soft);
        color: var(--mm-text);
        font: var(--text-label);
        line-height: 1;
        letter-spacing: 0;
        user-select: none;
        outline: 2px solid var(--mm-avatar-ring, transparent);
      }
      :host([size='40']) .avatar {
        font: var(--text-body-strong);
        line-height: 1;
      }
      :host([kind='agent']) .avatar {
        background: var(--mm-primary-tint);
        color: var(--mm-text);
      }
      :host([kind='team']) .avatar {
        background: var(--mm-sunken);
        color: var(--mm-text-2);
        box-shadow: inset 0 0 0 1px var(--mm-rule);
      }
      img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
        display: block;
      }
    `,
    visuallyHidden,
  ];

  /** The person's, agent's or team's name. Used for the initials and the accessible name. */
  @property() accessor name = '';
  /** `person` (default), `agent` or `team`. Agents always show the robot icon. */
  @property({ reflect: true }) accessor kind: AvatarKind = 'person';
  /** Photo URL, for people only. Falls back to initials if it fails to load. */
  @property() accessor src = '';
  /** 20, 24 (default), 32 or 40 pixels. */
  @property({ type: Number, reflect: true }) accessor size: AvatarSize = 24;
  /** Hide from assistive technology because the name is printed beside the avatar. */
  @property({ type: Boolean, reflect: true }) accessor decorative = false;

  @state() accessor #failed = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('src')) this.#failed = false;
  }

  override render() {
    const size = ICON_SIZE[this.size] ?? 16;
    let content;
    if (this.kind === 'agent') content = html`<mm-icon part="icon" name="smart-toy" size=${size}></mm-icon>`;
    else if (this.kind === 'team') content = html`<mm-icon part="icon" name="groups" size=${size}></mm-icon>`;
    else if (this.src && !this.#failed)
      content = html`<img part="image" src=${this.src} alt="" @error=${() => (this.#failed = true)} />`;
    else content = html`<span part="initials">${avatarInitials(this.name, this.size === 20 ? 1 : 2)}</span>`;
    const label = this.name ? avatarLabel(this.name, this.kind) : '';
    return html`<span
      part="avatar"
      class="avatar"
      role=${this.decorative || !label ? nothing : 'img'}
      aria-label=${this.decorative || !label ? nothing : label}
      aria-hidden=${this.decorative || !label ? 'true' : nothing}
      >${content}</span
    >`;
  }
}

/**
 * Avatar stacks show who is involved in a small space: the owners of an asset, the reviewers of an
 * approval. Up to `max` avatars (3 by default) overlap, each with a 2px ring in the ground colour,
 * and the rest are counted as "+4". The count is read out as "and 4 more" with the hidden names.
 *
 * @tagname mm-avatar-stack
 * @summary Overlapping avatars with a "+N" count.
 * @slot - `mm-avatar` elements.
 * @csspart count - The "+N" count.
 * @cssprop --mm-avatar-stack-ring - The ring colour, matching the ground. Defaults to `--mm-paper`; use `--mm-surface` inside a panel.
 */
export class MmAvatarStack extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
        --_overlap: -6px;
        --_s: 24px;
      }
      :host([size='20']) {
        --_overlap: -5px;
        --_s: 20px;
      }
      :host([size='32']) {
        --_overlap: -8px;
        --_s: 32px;
      }
      :host([size='40']) {
        --_overlap: -10px;
        --_s: 40px;
      }
      .stack {
        display: inline-flex;
        align-items: center;
        padding-inline-start: 2px;
      }
      ::slotted(mm-avatar) {
        --mm-avatar-ring: var(--mm-avatar-stack-ring, var(--mm-paper));
      }
      ::slotted(mm-avatar:not(:first-child)) {
        margin-inline-start: var(--_overlap);
      }
      ::slotted([data-mm-overflow]) {
        display: none !important;
      }
      .count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: var(--_s);
        block-size: var(--_s);
        padding-inline: 4px;
        margin-inline-start: var(--_overlap);
        border-radius: var(--radius-full);
        background: var(--mm-sunken);
        color: var(--mm-text-2);
        outline: 2px solid var(--mm-avatar-stack-ring, var(--mm-paper));
        font: var(--text-label);
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  /** How many avatars to show before counting the rest. */
  @property({ type: Number }) accessor max = 3;
  /** Size applied to every avatar in the stack. */
  @property({ type: Number, reflect: true }) accessor size: AvatarSize = 24;
  /** Names the group, for example "Owners". */
  @property() accessor label = '';

  @state() accessor #hidden: MmAvatar[] = [];

  #sync = () => {
    const avatars = Array.from(this.querySelectorAll<MmAvatar>(':scope > mm-avatar'));
    avatars.forEach((a, i) => {
      a.size = this.size;
      a.toggleAttribute('data-mm-overflow', i >= this.max);
    });
    this.#hidden = avatars.slice(this.max);
  };

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('max') || changed.has('size')) this.#sync();
  }

  override render() {
    const extra = this.#hidden.length;
    const names = this.#hidden.map((a) => a.name).join(', ');
    return html`<span class="stack" role="group" aria-label=${this.label || nothing}
      ><slot @slotchange=${this.#sync}></slot
      >${extra
        ? html`<span part="count" class="count"
            ><span aria-hidden="true">+${extra}</span
            ><span class="visually-hidden">${tr('avatarMore', 'and {count} more: {names}', { count: extra, names })}</span></span
          >`
        : nothing}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-avatar': MmAvatar;
    'mm-avatar-stack': MmAvatarStack;
  }
}
