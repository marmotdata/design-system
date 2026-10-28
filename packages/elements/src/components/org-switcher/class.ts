import { LitElement, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { float, openedFromKeyboard } from '../../core/floating.js';
import { tr } from '../../core/strings.js';
import { uid } from '../../core/id.js';
import '@marmotdata/icons/define.js';

export interface Workspace {
  id: string;
  name: string;
  /** Plan name shown as a caption, e.g. "Team". */
  plan?: string;
}

export interface Organisation {
  id: string;
  name: string;
  workspaces: Workspace[];
}

export interface SwitchDetail {
  org: string;
  workspace: string;
}

export interface CreateWorkspaceDetail {
  /** The current organisation's id. */
  org: string;
}

interface Row {
  org: Organisation;
  ws: Workspace;
  id: string;
}

/**
 * The organisation and workspace switcher for Marmot Cloud, at the foot of the sidebar (OSS hides
 * it). The button shows the organisation over the workspace, after a square initial. It opens a
 * popover with a search field over a listbox of workspaces grouped by organisation, each with its
 * plan as a quiet caption ("Team") and the current one checked, and a "Create workspace" action.
 *
 * In the collapsed rail only the square initial shows; the full names stay in the accessible name.
 *
 * Keyboard: the search field is a combobox
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/). Typing
 * filters the workspaces by workspace or organisation name; ArrowDown and ArrowUp move the active
 * workspace (wrapping), Home and End jump to the ends, Enter switches, Escape closes and returns
 * focus to the button. Tab reaches "Create workspace". ArrowDown on the button also opens it.
 *
 * @tagname mm-org-switcher
 * @summary Switches organisation and workspace (Cloud).
 * @csspart trigger - The button.
 * @csspart initial - The square initial.
 * @csspart popover - The popover.
 * @csspart search - The search field.
 * @csspart listbox - The listbox.
 * @csspart option - Each workspace.
 * @csspart create - The "Create workspace" button.
 * @fires mm-switch - {SwitchDetail} A workspace was chosen. Cancel it to keep the current one.
 * @fires mm-create-workspace - {CreateWorkspaceDetail} "Create workspace" was activated.
 */
export class MmOrgSwitcher extends LitElement {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      .trigger {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        width: 100%;
        min-height: 40px;
        padding: var(--space-1) var(--space-2);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--mm-text);
        text-align: start;
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .trigger:hover,
      .trigger[aria-expanded='true'] {
        background: var(--mm-surface);
      }
      .trigger:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: transparent;
      }
      .initial {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: none;
        width: 24px;
        height: 24px;
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        color: var(--mm-text);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
      }
      .names {
        display: grid;
        flex: 1;
        min-width: 0;
      }
      .org,
      .ws {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .org {
        font: var(--text-caption);
        letter-spacing: var(--tracking-caption);
        color: var(--mm-text-2);
      }
      .ws {
        font: var(--text-dense);
        font-weight: 600;
      }
      .unfold {
        flex: none;
        color: var(--mm-text-2);
      }
      :host([collapsed]) .trigger {
        width: 40px;
        justify-content: center;
        padding: 0;
      }
      .pop {
        position: fixed;
        inset: auto;
        margin: 0;
        width: 300px;
        max-width: calc(100vw - var(--space-4));
        padding: 0;
        display: none;
        flex-direction: column;
        background: var(--mm-raised);
        color: var(--mm-text);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-float);
        font: var(--text-dense);
        overflow: hidden;
        z-index: var(--mm-z-popover);
      }
      .pop:popover-open {
        display: flex;
        opacity: 1;
        transform: scale(1);
        transition:
          opacity var(--mm-dur-menu) var(--mm-ease),
          transform var(--mm-dur-menu) var(--mm-ease);
      }
      @starting-style {
        .pop:popover-open {
          opacity: 0;
          transform: scale(0.97);
        }
      }
      .pop[data-instant]:popover-open {
        transition: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .pop:popover-open {
          transform: none;
        }
      }
      .search {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0 var(--space-3);
        height: var(--mm-control, var(--control-h));
        border-bottom: 1px solid var(--mm-rule);
        color: var(--mm-text-2);
      }
      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--mm-text);
        font: inherit;
        outline: none;
      }
      .search input::placeholder {
        color: var(--mm-text-2);
      }
      .search:focus-within {
        box-shadow: inset 0 -2px 0 var(--mm-text);
      }
      .list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: var(--space-1);
      }
      .group-label {
        padding: var(--space-2) var(--space-2) var(--space-1);
        font: var(--text-label);
        letter-spacing: var(--tracking-label);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .option {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: var(--mm-menu-row, 32px);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      .option[data-active] {
        background: var(--mm-sunken);
        outline: 2px solid var(--mm-text);
        outline-offset: -2px;
      }
      .option[aria-selected='true'] {
        background: var(--mm-selected);
      }
      .option .check {
        flex: none;
        visibility: hidden;
      }
      .option[aria-selected='true'] .check {
        visibility: visible;
      }
      .option .name {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .plan {
        flex: none;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .empty {
        padding: var(--space-3) var(--space-2);
        color: var(--mm-text-2);
        overflow-wrap: anywhere;
      }
      .create {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: 0 var(--space-3);
        min-height: var(--mm-control, var(--control-h));
        border: 0;
        border-top: 1px solid var(--mm-rule);
        background: transparent;
        color: var(--mm-text);
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .create:hover {
        background: var(--mm-sunken);
      }
      .create:focus-visible {
        outline-offset: -2px;
      }
      .create mm-icon {
        color: var(--mm-text-2);
      }
      @media (pointer: coarse) {
        .option,
        .create {
          min-height: var(--target-touch, 44px);
        }
        .search input {
          font-size: 16px;
        }
      }
    `,
  ];

  /** Organisations and their workspaces. */
  @property({ attribute: false }) accessor orgs: Organisation[] = [];
  /** The current organisation's id. */
  @property({ reflect: true }) accessor org = '';
  /** The current workspace's id. */
  @property({ reflect: true }) accessor workspace = '';
  /** Shows only the square initial, for the collapsed rail. Set by `mm-sidebar-nav`. */
  @property({ type: Boolean, reflect: true }) accessor collapsed = false;
  @property({ type: Boolean, reflect: true }) accessor disabled = false;
  /** Hides "Create workspace", for people who may not create one. */
  @property({ type: Boolean, reflect: true, attribute: 'no-create' }) accessor noCreate = false;
  /** Whether the popover is open. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  @state() accessor #query = '';
  @state() accessor #active = -1;

  @query('.trigger') accessor #trigger!: HTMLButtonElement | null;
  @query('.pop') accessor #pop!: HTMLElement | null;
  @query('input') accessor #input!: HTMLInputElement | null;

  #id = uid('mm-org');
  #cleanup?: () => void;
  #wasOpen = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#cleanup?.();
  }

  override focus(options?: FocusOptions): void {
    this.#trigger?.focus(options);
  }

  get #current(): { org?: Organisation; ws?: Workspace } {
    const org = this.orgs.find((o) => o.id === this.org) ?? this.orgs.find((o) => o.workspaces.some((w) => w.id === this.workspace));
    const ws = org?.workspaces.find((w) => w.id === this.workspace);
    return { org, ws };
  }

  /** The workspaces matching the search, in display order. */
  get #rows(): Row[] {
    const q = this.#query.trim().toLowerCase();
    const rows: Row[] = [];
    this.orgs.forEach((org, oi) =>
      org.workspaces.forEach((ws, wi) => {
        if (!q || ws.name.toLowerCase().includes(q) || org.name.toLowerCase().includes(q)) rows.push({ org, ws, id: `${this.#id}-o${oi}-w${wi}` });
      }),
    );
    return rows;
  }

  show(): void {
    if (this.disabled) return;
    this.open = true;
  }

  hide(returnFocus = false): void {
    if (!this.open) return;
    this.open = false;
    if (returnFocus) this.#trigger?.focus({ preventScroll: true });
  }

  protected override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('open')) {
      if (this.open) this.#reveal();
      else if (changed.get('open')) this.#conceal();
    }
    if (this.open) this.#scrollActive();
  }

  #reveal() {
    const pop = this.#pop;
    const trigger = this.#trigger;
    if (!pop || !trigger) return;
    pop.toggleAttribute('data-instant', openedFromKeyboard());
    this.#query = '';
    const rows = this.#rows;
    this.#active = Math.max(
      0,
      rows.findIndex((r) => r.ws.id === this.workspace),
    );
    try {
      if (!pop.matches(':popover-open')) pop.showPopover();
    } catch {
      this.open = false;
      return;
    }
    this.#cleanup?.();
    this.#cleanup = float(trigger, pop, { placement: this.collapsed ? 'right-end' : 'top-start', offset: 4 });
    this.#input?.focus({ preventScroll: true });
  }

  #conceal() {
    this.#cleanup?.();
    this.#cleanup = undefined;
    try {
      if (this.#pop?.matches(':popover-open')) this.#pop.hidePopover();
    } catch {
      /* already closed */
    }
  }

  #scrollActive() {
    const el = this.renderRoot.querySelector<HTMLElement>('.option[data-active]');
    el?.scrollIntoView?.({ block: 'nearest' });
  }

  #onToggle(e: ToggleEvent) {
    if (e.newState === 'closed' && this.open) this.open = false;
  }

  #choose(row: Row) {
    const changed = row.ws.id !== this.workspace;
    if (changed && !emit<SwitchDetail>(this, 'mm-switch', { org: row.org.id, workspace: row.ws.id }, { cancelable: true })) return;
    this.org = row.org.id;
    this.workspace = row.ws.id;
    this.hide(true);
  }

  #onInputKeydown(e: KeyboardEvent) {
    const rows = this.#rows;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        if (!rows.length) return;
        const d = e.key === 'ArrowDown' ? 1 : -1;
        this.#active = this.#active < 0 ? (d > 0 ? 0 : rows.length - 1) : (this.#active + d + rows.length) % rows.length;
        return;
      }
      case 'Home':
      case 'End':
        if (!rows.length || e.shiftKey) return;
        e.preventDefault();
        this.#active = e.key === 'Home' ? 0 : rows.length - 1;
        return;
      case 'Enter': {
        e.preventDefault();
        const row = rows[this.#active];
        if (row) this.#choose(row);
        return;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (this.#query) {
          this.#query = '';
          this.#input!.value = '';
          this.#active = 0;
        } else this.hide(true);
        return;
    }
  }

  #onPopKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      this.hide(true);
    }
  }

  #onInput(e: InputEvent) {
    this.#query = (e.target as HTMLInputElement).value;
    this.#active = this.#rows.length ? 0 : -1;
  }

  #onTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show();
    }
  }

  #onCreate() {
    emit<CreateWorkspaceDetail>(this, 'mm-create-workspace', { org: this.#current.org?.id ?? this.org });
    this.hide(true);
  }

  #renderList(rows: Row[]) {
    if (!rows.length) {
      return html`<div class="empty" role="status">${tr('noWorkspacesMatch', 'No workspaces match “{query}”.', { query: this.#query.trim() })}</div>`;
    }
    const groups: { org: Organisation; rows: { row: Row; index: number }[] }[] = [];
    rows.forEach((row, index) => {
      const last = groups[groups.length - 1];
      if (last && last.org === row.org) last.rows.push({ row, index });
      else groups.push({ org: row.org, rows: [{ row, index }] });
    });
    return html`<div part="listbox" class="list" role="listbox" id="listbox" aria-label=${tr('workspaces', 'Workspaces')}>
      ${groups.map((g, gi) => {
        const gid = `${this.#id}-g${gi}`;
        return html`<div role="group" aria-labelledby=${gid}>
          <div class="group-label" id=${gid} role="presentation">${g.org.name}</div>
          ${g.rows.map(
            ({ row, index }) => html`<div
              part="option"
              class="option"
              role="option"
              id=${row.id}
              aria-selected=${row.ws.id === this.workspace ? 'true' : 'false'}
              ?data-active=${index === this.#active}
              @pointermove=${() => (this.#active = index)}
              @click=${() => this.#choose(row)}
            >
              <mm-icon class="check" name="check"></mm-icon>
              <span class="name">${row.ws.name}</span>
              ${row.ws.plan ? html`<span class="plan">${row.ws.plan}</span>` : nothing}
            </div>`,
          )}
        </div>`;
      })}
    </div>`;
  }

  override render() {
    const { org, ws } = this.#current;
    const orgName = org?.name ?? '';
    const wsName = ws?.name ?? '';
    const initial = (orgName.trim()[0] ?? '').toUpperCase();
    const rows = this.open ? this.#rows : [];
    const active = rows[this.#active];
    const switchLabel = tr('switchWorkspace', 'Switch workspace');
    return html`<button
        part="trigger"
        class="trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded=${this.open ? 'true' : 'false'}
        ?disabled=${this.disabled}
        @pointerdown=${() => (this.#wasOpen = this.open)}
        @click=${() => {
          const was = this.#wasOpen || this.open;
          this.#wasOpen = false;
          if (was) this.hide(true);
          else this.show();
        }}
        @keydown=${this.#onTriggerKeydown}
      >
        <span part="initial" class="initial" aria-hidden="true">${initial}</span>
        <span class="visually-hidden">${`${switchLabel}: ${[orgName, wsName].filter(Boolean).join(', ')}`}</span>
        ${this.collapsed
          ? nothing
          : html`<span class="names" aria-hidden="true"><span class="org">${orgName}</span><span class="ws">${wsName}</span></span>
              <mm-icon class="unfold" name="unfold-more"></mm-icon>`}
      </button>
      <div
        part="popover"
        class="pop"
        popover="auto"
        role="dialog"
        aria-label=${switchLabel}
        @toggle=${this.#onToggle}
        @keydown=${this.#onPopKeydown}
      >
        ${this.open
          ? html`<div class="search">
                <mm-icon name="search"></mm-icon>
                <input
                  part="search"
                  type="text"
                  role="combobox"
                  autocomplete="off"
                  spellcheck="false"
                  aria-label=${tr('searchWorkspaces', 'Search workspaces')}
                  placeholder=${tr('searchWorkspaces', 'Search workspaces')}
                  aria-expanded=${rows.length ? 'true' : 'false'}
                  aria-controls=${ifDefined(rows.length ? 'listbox' : undefined)}
                  aria-autocomplete="list"
                  aria-activedescendant=${ifDefined(active?.id)}
                  .value=${this.#query}
                  @input=${this.#onInput}
                  @keydown=${this.#onInputKeydown}
                />
              </div>
              ${this.#renderList(rows)}
              ${this.noCreate
                ? nothing
                : html`<button part="create" class="create" type="button" @click=${() => this.#onCreate()}>
                    <mm-icon name="add"></mm-icon>${tr('createWorkspace', 'Create workspace')}
                  </button>`}`
          : nothing}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-org-switcher': MmOrgSwitcher;
  }
}
