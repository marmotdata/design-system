import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { MmProviderLogo } from '@marmotdata/icons';
import { base, visuallyHidden } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

/** Detail for `mm-node-activate` from a standalone interactive node. */
export interface MmLineageNodeActivateDetail {
  name: string;
  mrn: string;
}
/** Detail for `mm-toggle` from an agent cluster. */
export interface MmLineageNodeToggleDetail {
  expanded: boolean;
}

export type LineageNodeVariant = 'asset' | 'cycle-return' | 'agent-cluster';

/** Width in px for each variant; the canvas lays nodes out with these. */
export const NODE_WIDTH: Record<LineageNodeVariant, number> = { asset: 220, 'cycle-return': 180, 'agent-cluster': 220 };

/**
 * Estimated rendered height of a node, used by the canvas for layout without measuring thousands of
 * elements. Names wrap anywhere; 27 characters per 200px line is a safe estimate for 13px Geist.
 */
export function estimateNodeHeight(n: { name: string; variant?: LineageNodeVariant; failed?: boolean; members?: number }): number {
  const variant = n.variant ?? 'asset';
  const perLine = variant === 'cycle-return' ? 22 : 27;
  const lines = Math.max(1, Math.ceil(n.name.length / perLine));
  if (variant === 'agent-cluster') return 92 + (n.members ?? 0) * 22;
  if (variant === 'cycle-return') return 40 + lines * 19 + 18;
  return 8 + 16 + 4 + lines * 19 + 2 + 18 + 10 + (n.failed ? 20 : 0);
}

/** Sentence case for a type word written in normal case: "table" → "Table". */
const sentence = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/**
 * Lineage nodes are compact cards on the lineage canvas: a sentence-case caption naming the asset
 * type ("Table", "Topic · stub"), the asset name (13px, 600, wrapping anywhere so long MRN-like names never overflow), and the provider
 * with its logo. Provider logos are the only colour; they are never recoloured.
 *
 * States, each carried by shape or words as well as colour:
 * - `current`: the asset whose page you are on. 2px burnt sienna border on the burnt sienna tint. One per graph.
 * - `selected`: a 2px ink border and a tick at the end of the type strip. It is deliberately not the
 *   focus ring (a detached 2px ink outline with a 2px gap) and not burnt sienna, so current, selected and
 *   focused can all be told apart, alone or combined.
 * - `stub`: created by OpenLineage but not yet surveyed by a plugin. Dashed border on a transparent
 *   ground, "stub" in the type strip, and "Not catalogued yet" for assistive technology.
 * - `failed`: the last run failed. A crimson error icon and the words "Last run failed".
 *
 * Variants: `cycle-return` closes a cycle without drawing an edge backwards ("Returns to orders_daily",
 * dotted ochre border, matching cycle edges). `agent-cluster` groups agents that looked up one asset
 * ("4 agents looked this up") and expands to list them.
 *
 * Standalone, set `interactive` to render the node as a button that fires `mm-node-activate`. Inside
 * `mm-lineage-canvas` the canvas owns focus and keyboard, so nodes are not tab stops there.
 *
 * @tagname mm-lineage-node
 * @summary An asset on the lineage canvas.
 * @csspart node - The card (a button when `interactive`).
 * @csspart type - The type caption.
 * @csspart name - The asset name.
 * @csspart provider - The provider row.
 * @csspart status - The "Last run failed" row.
 * @csspart toggle - The agent cluster's show or hide button.
 * @fires mm-node-activate - {MmLineageNodeActivateDetail} An interactive node was clicked or activated with Enter or Space.
 * @fires mm-toggle - {MmLineageNodeToggleDetail} An agent cluster was expanded or collapsed.
 */
export class MmLineageNode extends LitElement {
  static override styles = [
    base,
    visuallyHidden,
    css`
      :host {
        display: block;
        width: var(--_w, 220px);
        color: var(--mm-text);
      }
      .node {
        all: unset;
        box-sizing: border-box;
        display: block;
        position: relative;
        width: 100%;
        background: var(--mm-surface);
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-md);
        padding: 8px 10px 10px;
        text-align: start;
        transition: border-color var(--mm-dur-press) var(--mm-ease);
      }
      button.node {
        cursor: pointer;
      }
      button.node:hover {
        border-color: var(--mm-text);
      }
      button.node:focus-visible,
      :host([focused]) .node {
        outline: 2px solid var(--mm-text);
        outline-offset: 2px;
      }
      :host([current]) .node {
        border: 2px solid var(--mm-primary);
        background: var(--mm-primary-tint);
        padding: 7px 9px 9px;
      }
      :host([selected]:not([current])) .node {
        border: 2px solid var(--mm-text);
        padding: 7px 9px 9px;
      }
      :host([stub]) .node {
        border-style: dashed;
        background: transparent;
      }
      :host([variant='cycle-return']) .node {
        border: 1.5px dotted var(--mm-warning);
        background: var(--mm-surface);
      }
      .strip {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-height: 16px;
        font: var(--text-caption);
        line-height: 16px;
        color: var(--mm-text-2);
        font-variant-numeric: tabular-nums;
      }
      .strip .t {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tick {
        color: var(--mm-text);
      }
      .name {
        display: block;
        font: var(--text-dense);
        font-weight: 600;
        line-height: 1.4;
        margin: 4px 0 2px;
        overflow-wrap: anywhere;
        color: var(--mm-text);
        unicode-bidi: plaintext;
      }
      .count,
      .src .p,
      .status,
      .row,
      li {
        unicode-bidi: plaintext;
      }
      .src,
      .status,
      .row {
        display: flex;
        align-items: center;
        gap: 6px;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      :host([current]) .src {
        color: var(--mm-text-2);
      }
      .src .p {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .status {
        margin-top: 4px;
        color: var(--mm-danger);
        font-weight: 600;
      }
      .row {
        color: var(--mm-text-2);
      }
      .returns {
        display: block;
        margin-top: 4px;
        font: var(--text-caption);
        color: var(--mm-text-2);
      }
      .returns mm-icon {
        color: var(--mm-warning);
      }
      :host(:dir(rtl)) .returns mm-icon {
        transform: scaleX(-1);
      }
      .returns .name {
        margin-top: 0;
      }
      .count {
        font-variant-numeric: tabular-nums;
      }
      .cluster-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 4px 0 6px;
        font: var(--text-dense);
        font-weight: 600;
      }
      .toggle {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        min-height: 24px;
        padding: 0 6px;
        margin-inline-start: -6px;
        border-radius: var(--radius-sm);
        font: var(--text-caption);
        font-weight: 600;
        color: var(--mm-text-2);
        cursor: pointer;
        transition: background-color var(--mm-dur-press) var(--mm-ease), color var(--mm-dur-press) var(--mm-ease);
      }
      .toggle:hover {
        background: var(--mm-sunken);
        color: var(--mm-text);
      }
      .toggle:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: 2px;
      }
      ul {
        list-style: none;
        margin: 6px 0 0;
        padding: 6px 0 0;
        border-top: 1px solid var(--mm-rule);
        display: grid;
        gap: 2px;
      }
      li {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 20px;
        font: var(--text-dense);
        color: var(--mm-text);
        overflow-wrap: anywhere;
      }
      li mm-icon,
      .cluster-row mm-icon {
        color: var(--mm-text-2);
      }
    `,
  ];

  /** Asset name, or for `cycle-return` the name of the asset the cycle returns to. */
  @property() accessor name = '';
  /** Asset type, written in normal case (`table`, `topic`, `dashboard`, `model`). Shown in sentence case ("Table"). */
  @property() accessor type = '';
  /** Provider key as used in MRNs (`postgresql`, `kafka`, `dbt`). */
  @property() accessor provider = '';
  /** The asset's MRN, e.g. `mrn://postgresql/table/shop.public.orders`. Used in events and the accessible description. */
  @property() accessor mrn = '';
  /** `asset` (default), `cycle-return` or `agent-cluster`. */
  @property({ reflect: true }) accessor variant: LineageNodeVariant = 'asset';
  /** The asset whose page you are on. */
  @property({ type: Boolean, reflect: true }) accessor current = false;
  /** Selected on the canvas. */
  @property({ type: Boolean, reflect: true }) accessor selected = false;
  /** Created by OpenLineage, not yet surveyed by a plugin. */
  @property({ type: Boolean, reflect: true }) accessor stub = false;
  /** The asset's last run failed. */
  @property({ type: Boolean, reflect: true }) accessor failed = false;
  /** Draws the focus ring. Set by `mm-lineage-canvas`, which keeps DOM focus on itself and points at the node with `aria-activedescendant`. */
  @property({ type: Boolean, reflect: true }) accessor focused = false;
  /** Renders the card as a button that fires `mm-node-activate`. For standalone use. */
  @property({ type: Boolean, reflect: true }) accessor interactive = false;
  /** Agent cluster: number of agents. Defaults to the length of `members`. */
  @property({ type: Number }) accessor count = 0;
  /** Agent cluster: agent names, listed when expanded. */
  @property({ attribute: false }) accessor members: string[] = [];
  /** Agent cluster: whether the agent list is shown. */
  @property({ type: Boolean, reflect: true }) accessor expanded = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant')) this.style.setProperty('--_w', `${NODE_WIDTH[this.variant] ?? 220}px`);
  }

  get #count(): number {
    return this.count || this.members.length;
  }

  /** A sentence describing the node for assistive technology, used by the canvas as the node's label. */
  describe(): string {
    const parts: string[] = [];
    if (this.variant === 'cycle-return') {
      parts.push(tr('lineageReturnsTo', 'Returns to {name}', { name: this.name }), tr('lineageCycle', 'cycle'));
    } else if (this.variant === 'agent-cluster') {
      parts.push(this.#clusterText());
      parts.push(this.expanded ? tr('lineageExpanded', 'expanded') : tr('lineageCollapsed', 'collapsed'));
    } else {
      parts.push(this.name);
      if (this.type) parts.push(this.type);
      if (this.provider) parts.push(MmProviderLogo.displayName(this.provider));
    }
    if (this.current) parts.push(tr('lineageCurrent', 'current asset'));
    if (this.selected) parts.push(tr('lineageSelected', 'selected'));
    if (this.stub) parts.push(tr('lineageNotSurveyed', 'Not catalogued yet'));
    if (this.failed) parts.push(tr('lineageLastRunFailed', 'Last run failed'));
    return parts.join(', ');
  }

  #clusterText(): string {
    const n = this.#count;
    return n === 1 ? tr('lineageAgentsOne', '1 agent looked this up') : tr('lineageAgentsMany', '{n} agents looked this up', { n });
  }

  /** Expands or collapses an agent cluster and fires `mm-toggle`. */
  toggle(force?: boolean): void {
    if (this.variant !== 'agent-cluster') return;
    this.expanded = force ?? !this.expanded;
    emit<MmLineageNodeToggleDetail>(this, 'mm-toggle', { expanded: this.expanded });
  }

  #activate = () => {
    if (!this.interactive) return;
    emit<MmLineageNodeActivateDetail>(this, 'mm-node-activate', { name: this.name, mrn: this.mrn });
  };

  #onToggleClick = (e: Event) => {
    e.stopPropagation();
    this.toggle();
  };

  #body(): TemplateResult {
    const tick = this.selected
      ? html`<mm-icon class="tick" name="check" size="14"></mm-icon><span class="visually-hidden">${tr('lineageSelected', 'selected')}</span>`
      : nothing;
    if (this.variant === 'cycle-return') {
      return html`<span part="type" class="strip"><span class="t">${sentence(this.type || tr('lineageCycle', 'cycle'))}</span>${tick}</span>
        <span class="returns"
          ><span class="row"><mm-icon name="keyboard-return" size="14"></mm-icon>${tr('lineageReturnsToLabel', 'Returns to')}</span
          ><span part="name" class="name">${this.name}</span></span
        >`;
    }
    if (this.variant === 'agent-cluster') {
      const members = this.expanded && this.members.length
        ? html`<ul aria-label=${tr('lineageAgents', 'Agents')}>${this.members.map((m) => html`<li><mm-icon name="smart-toy" size="14"></mm-icon>${m}</li>`)}</ul>`
        : nothing;
      return html`<span part="type" class="strip"><span class="t">${tr('lineageAgentsType', 'Agents')}</span>${tick}</span>
        <span part="name" class="cluster-row"><mm-icon name="smart-toy"></mm-icon><span class="count">${this.#clusterText()}</span></span>
        <button
          part="toggle"
          class="toggle"
          type="button"
          tabindex=${this.interactive ? 0 : -1}
          aria-expanded=${this.expanded ? 'true' : 'false'}
          @click=${this.#onToggleClick}
        >
          <mm-icon name=${this.expanded ? 'expand-less' : 'expand-more'} size="14"></mm-icon>${this.expanded
            ? tr('lineageHideAgents', 'Hide agents')
            : tr('lineageShowAgents', 'Show agents')}
        </button>
        ${members}`;
    }
    const providerName = this.provider ? MmProviderLogo.displayName(this.provider) : '';
    return html`<span part="type" class="strip"
        ><span class="t">${sentence(this.type)}${this.stub ? html` · ${tr('lineageStub', 'stub')}` : nothing}</span>${tick}</span
      >
      <span part="name" class="name">${this.name}</span>
      ${this.stub ? html`<span class="visually-hidden">${tr('lineageNotSurveyed', 'Not catalogued yet')}</span>` : nothing}
      ${providerName
        ? html`<span part="provider" class="src"
            ><mm-provider-logo provider=${this.provider} size="14" decorative></mm-provider-logo><span class="p">${providerName}</span></span
          >`
        : nothing}
      ${this.failed
        ? html`<span part="status" class="status"><mm-icon name="error" size="14"></mm-icon>${tr('lineageLastRunFailed', 'Last run failed')}</span>`
        : nothing}`;
  }

  override render() {
    // A cluster's own toggle is the interactive part, so the card itself is never a button around another button.
    if (this.interactive && this.variant !== 'agent-cluster') {
      return html`<button
        part="node"
        class="node"
        type="button"
        aria-pressed=${this.selected ? 'true' : nothing}
        aria-current=${this.current ? 'page' : nothing}
        @click=${this.#activate}
      >
        ${this.#body()}
      </button>`;
    }
    return html`<div part="node" class="node">${this.#body()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-lineage-node': MmLineageNode;
  }
}
