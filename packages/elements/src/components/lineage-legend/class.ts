import { LitElement, css, html, nothing, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { uid } from '../../core/id.js';
import { tr } from '../../core/strings.js';
import '@marmotdata/icons/define.js';

/** Detail for `mm-toggle`. */
export interface MmLineageLegendToggleDetail {
  open: boolean;
}

/**
 * The lineage legend explains every encoding on the lineage canvas, drawn exactly as the canvas
 * draws it: current, selected, stub, failed and cycle-return nodes, the agent cluster, declared,
 * observed, mixed and cycle edges with their dash patterns, and the edge chip. Edges never rely on
 * colour alone, so each sample shows its dash pattern as well.
 *
 * Set `compact` for the canvas corner: a small "Legend" disclosure button that opens the same list
 * in a hairline panel. `open` reflects whether it is shown.
 *
 * Keyboard (compact): Enter or Space on the button toggles; Escape closes and returns focus to it.
 *
 * @tagname mm-lineage-legend
 * @summary Explains the lineage canvas encodings.
 * @csspart toggle - The compact disclosure button.
 * @csspart panel - The list panel.
 * @fires mm-toggle - {MmLineageLegendToggleDetail} The compact legend was opened or closed.
 */
export class MmLineageLegend extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        color: var(--mm-text);
        font: var(--text-caption);
      }
      :host([compact]) {
        display: inline-block;
      }
      .panel {
        display: grid;
        gap: var(--space-3);
      }
      :host([compact]) .panel {
        margin-top: var(--space-1);
        padding: var(--space-3);
        width: 248px;
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        border-radius: var(--radius-md);
      }
      h3 {
        margin: 0 0 var(--space-1);
        font: var(--text-label);
        color: var(--mm-text-2);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      li {
        display: grid;
        grid-template-columns: 40px 1fr;
        align-items: center;
        gap: var(--space-2);
        color: var(--mm-text);
      }
      .hint {
        color: var(--mm-text-2);
      }
      .sw {
        display: block;
        width: 36px;
        height: 18px;
        box-sizing: border-box;
        border: 1px solid var(--mm-control-border);
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        position: relative;
      }
      .sw.current {
        border: 2px solid var(--mm-primary);
        background: var(--mm-primary-tint);
      }
      .sw.selected {
        border: 2px solid var(--mm-text);
      }
      .sw.selected mm-icon {
        position: absolute;
        inset-inline-end: 0;
        top: 0;
        color: var(--mm-text);
      }
      .sw.focused {
        outline: 2px solid var(--mm-text);
        outline-offset: 2px;
        width: 30px;
        height: 12px;
        margin: 3px;
      }
      .sw.stub {
        border-style: dashed;
        background: transparent;
      }
      .sw.cycle {
        border: 1.5px dotted var(--mm-warning);
      }
      .icon {
        display: inline-flex;
        justify-content: center;
        width: 36px;
      }
      .danger {
        color: var(--mm-danger);
      }
      .muted {
        color: var(--mm-text-2);
      }
      svg {
        display: block;
        width: 36px;
        height: 12px;
        overflow: visible;
      }
      .edge {
        fill: none;
        stroke-width: 1.5;
      }
      .declared {
        stroke: var(--mm-text-3);
      }
      .observed {
        stroke: var(--mm-success);
        stroke-dasharray: 5 4;
      }
      .cycle-e {
        stroke: var(--mm-warning);
        stroke-dasharray: 2 3;
      }
      .head-declared {
        fill: var(--mm-text-3);
      }
      .head-observed {
        fill: var(--mm-success);
      }
      .head-cycle {
        fill: var(--mm-warning);
      }
      :host(:dir(rtl)) svg {
        transform: scaleX(-1);
      }
      .chip {
        justify-self: start;
        font: var(--text-caption);
        font-size: 13px;
        line-height: 1;
        padding: 3px 5px;
        border-radius: var(--radius-sm);
        background: var(--mm-surface);
        border: 1px solid var(--mm-rule);
        color: var(--mm-text-2);
        white-space: nowrap;
      }
      li.chip-row {
        grid-template-columns: 1fr;
        gap: 2px;
      }
      .toggle {
        all: unset;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: var(--control-h-sm);
        padding: 0 10px;
        border-radius: var(--radius-md);
        border: 1px solid var(--mm-rule);
        background: var(--mm-surface);
        color: var(--mm-text-2);
        font: var(--text-button);
        font-size: 14px;
        cursor: pointer;
        transition: color var(--mm-dur-press) var(--mm-ease), border-color var(--mm-dur-press) var(--mm-ease);
      }
      .toggle:hover {
        color: var(--mm-text);
        border-color: var(--mm-control-border);
      }
      .toggle:focus-visible {
        outline: 2px solid var(--mm-text);
        outline-offset: 2px;
      }
    `,
  ];

  /** Renders as a "Legend" disclosure for a canvas corner. */
  @property({ type: Boolean, reflect: true }) accessor compact = false;
  /** Compact only: whether the list is shown. */
  @property({ type: Boolean, reflect: true }) accessor open = false;

  #id = uid('mm-legend');

  #toggle(open = !this.open) {
    this.open = open;
    emit<MmLineageLegendToggleDetail>(this, 'mm-toggle', { open });
  }

  #onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.compact && this.open) {
      e.stopPropagation();
      this.#toggle(false);
      this.renderRoot.querySelector<HTMLElement>('.toggle')?.focus();
    }
  };

  #edge(cls: 'declared' | 'observed' | 'mixed' | 'cycle'): TemplateResult {
    const line = 'M1,6 L28,6';
    const head = cls === 'observed' ? 'head-observed' : cls === 'cycle' ? 'head-cycle' : 'head-declared';
    return html`<svg viewBox="0 0 36 12" aria-hidden="true">
      ${cls === 'mixed'
        ? svg`<path class="edge declared" d=${line}></path><path class="edge observed" d=${line}></path>`
        : svg`<path class="edge ${cls === 'cycle' ? 'cycle-e' : cls}" d=${line}></path>`}
      <path class=${head} d="M28,2 L35,6 L28,10 Z"></path>
    </svg>`;
  }

  #item(swatch: TemplateResult, label: string, hint = ''): TemplateResult {
    return html`<li><span aria-hidden="true">${swatch}</span><span>${label}${hint ? html` <span class="hint">${hint}</span>` : nothing}</span></li>`;
  }

  #panel(): TemplateResult {
    return html`<div part="panel" class="panel" id=${this.#id}>
      <div role="group" aria-labelledby="${this.#id}-n">
        <h3 id="${this.#id}-n">${tr('lineageLegendNodes', 'Assets')}</h3>
        <ul>
          ${this.#item(html`<span class="sw current"></span>`, tr('lineageLegendCurrent', 'Current asset'))}
          ${this.#item(html`<span class="sw selected"><mm-icon name="check" size="14"></mm-icon></span>`, tr('lineageLegendSelected', 'Selected'))}
          ${this.#item(html`<span class="sw focused"></span>`, tr('lineageLegendFocused', 'Keyboard focus'))}
          ${this.#item(html`<span class="sw stub"></span>`, tr('lineageLegendStub', 'Stub'), tr('lineageLegendStubHint', 'not catalogued yet'))}
          ${this.#item(html`<span class="icon danger"><mm-icon name="error"></mm-icon></span>`, tr('lineageLastRunFailed', 'Last run failed'))}
          ${this.#item(html`<span class="sw cycle"></span>`, tr('lineageLegendCycleNode', 'Returns to'), tr('lineageLegendCycleNodeHint', 'closes a cycle'))}
          ${this.#item(html`<span class="icon muted"><mm-icon name="smart-toy"></mm-icon></span>`, tr('lineageLegendAgents', 'Agent cluster'), tr('lineageLegendAgentsHint', 'agents that looked an asset up'))}
        </ul>
      </div>
      <div role="group" aria-labelledby="${this.#id}-e">
        <h3 id="${this.#id}-e">${tr('lineageLegendEdges', 'Edges')}</h3>
        <ul>
          ${this.#item(this.#edge('declared'), tr('lineageLegendDeclared', 'Declared'), tr('lineageLegendDeclaredHint', 'solid'))}
          ${this.#item(this.#edge('observed'), tr('lineageLegendObserved', 'Observed'), tr('lineageLegendObservedHint', 'dashed'))}
          ${this.#item(this.#edge('mixed'), tr('lineageLegendMixed', 'Mixed'), tr('lineageLegendMixedHint', 'declared and observed, solid with dashes'))}
          ${this.#item(this.#edge('cycle'), tr('lineageLegendCycle', 'Cycle'), tr('lineageLegendCycleHint', 'dotted'))}
          <li class="chip-row">
            <span class="chip">observed · 128 runs</span>
            <span class="hint">${tr('lineageLegendChip', 'Hover or focus an edge to see its chip.')}</span>
          </li>
        </ul>
      </div>
    </div>`;
  }

  override render() {
    if (!this.compact) return this.#panel();
    return html`<div @keydown=${this.#onKeydown}>
      <button
        part="toggle"
        class="toggle"
        type="button"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls=${this.#id}
        @click=${() => this.#toggle()}
      >
        <mm-icon name=${this.open ? 'expand-less' : 'expand-more'} size="14"></mm-icon>${tr('lineageLegend', 'Legend')}
      </button>
      ${this.open ? this.#panel() : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-lineage-legend': MmLineageLegend;
  }
}
