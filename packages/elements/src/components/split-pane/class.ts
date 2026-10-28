import { LitElement, css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { isRtl } from '../../core/roving.js';
import { tr } from '../../core/strings.js';
import { clamp, readStored, resizeForKey, writeStored } from './resize.js';

/**
 * A split pane puts two related panes side by side (or one above the other) with a hairline
 * separator people can drag: the source tree beside the editor and results in Query, or the term
 * list beside the article in Glossary. The separator is a 1px `mm-rule` line with a wider grab
 * area; it darkens on hover, while dragging and on focus. Panes are never boxed: the hairline is
 * the only structure.
 *
 * The size of the start pane is kept in pixels between `min-start` and the container size less
 * `min-end`. With `storage-key` it is remembered in `localStorage`. Double-clicking the separator
 * returns it to `default-position` and forgets the stored size.
 *
 * Keyboard (https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/): the separator is a
 * focusable `role="separator"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`. Left and
 * Right (or Up and Down when stacked) move it by 16px, flipped in right-to-left layouts so the
 * arrow always points the way the separator moves. Home and End move it to the minimum and maximum.
 *
 * @tagname mm-split-pane
 * @summary Two panes with a draggable, keyboard-resizable separator.
 * @slot start - The first pane (inline start, or top when stacked).
 * @slot end - The second pane.
 * @csspart start - The start pane wrapper.
 * @csspart end - The end pane wrapper.
 * @csspart separator - The separator.
 * @fires mm-resize - {{ position: number }} The start pane was resized by pointer or keyboard, in pixels.
 */
export class MmSplitPane extends LitElement {
  static override styles = [
    base,
    css`
      :host {
        display: block;
        min-width: 0;
        min-height: 0;
        block-size: 100%;
      }
      .wrap {
        display: grid;
        block-size: 100%;
        min-block-size: 0;
      }
      :host(:not([orientation='vertical'])) .wrap {
        grid-template-columns: var(--_pos) 1px minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr);
      }
      :host([orientation='vertical']) .wrap {
        grid-template-rows: var(--_pos) 1px minmax(0, 1fr);
        grid-template-columns: minmax(0, 1fr);
      }
      .pane {
        min-width: 0;
        min-height: 0;
        overflow: auto;
      }
      .sep {
        position: relative;
        background: var(--mm-rule);
        touch-action: none;
        cursor: col-resize;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      :host([orientation='vertical']) .sep {
        cursor: row-resize;
      }
      /* A wider grab area centred on the hairline. */
      .sep::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline: -6px;
      }
      :host([orientation='vertical']) .sep::before {
        inset-block: -6px;
        inset-inline: 0;
      }
      .sep:hover {
        background: var(--mm-control-border);
      }
      :host([data-dragging]) .sep,
      .sep:focus-visible {
        background: var(--mm-text);
      }
      :host([data-dragging]) {
        user-select: none;
        cursor: col-resize;
      }
      :host([data-dragging][orientation='vertical']) {
        cursor: row-resize;
      }
    `,
  ];

  /** `horizontal` (default) puts the panes side by side; `vertical` stacks them. */
  @property({ reflect: true }) accessor orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** Size of the start pane in pixels. Set it to control the split; it updates as people resize. */
  @property({ type: Number }) accessor position: number | undefined;
  /** Start pane size in pixels before anything is stored, and after a double-click reset. */
  @property({ type: Number, attribute: 'default-position' }) accessor defaultPosition = 280;
  /** Smallest start pane, in pixels. */
  @property({ type: Number, attribute: 'min-start' }) accessor minStart = 200;
  /** Smallest end pane, in pixels. */
  @property({ type: Number, attribute: 'min-end' }) accessor minEnd = 240;
  /** `localStorage` key that remembers the position. Leave empty to not persist. */
  @property({ attribute: 'storage-key' }) accessor storageKey = '';
  /** Accessible name of the separator, naming what it resizes ("Resize source tree"). */
  @property() accessor label = '';

  @state() accessor #size = 0;
  @query('.sep') accessor #sep!: HTMLElement;
  #ro?: ResizeObserver;
  #drag?: { start: number; from: number };

  get #max(): number {
    return this.#size ? Math.max(this.minStart, this.#size - this.minEnd - 1) : Math.max(this.minStart, this.#pos);
  }

  get #pos(): number {
    const p = this.position ?? this.defaultPosition;
    return this.#size ? clamp(p, this.minStart, Math.max(this.minStart, this.#size - this.minEnd - 1)) : p;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.position === undefined) {
      const stored = readStored(this.storageKey);
      if (stored !== undefined) this.position = stored;
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.#ro = new ResizeObserver(([entry]) => {
        if (!entry) return;
        const box = entry.contentRect;
        this.#size = Math.round(this.orientation === 'vertical' ? box.height : box.width);
      });
      this.#ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
  }

  override focus(options?: FocusOptions): void {
    this.#sep?.focus(options);
  }

  #set(value: number, persist: boolean) {
    this.position = Math.round(clamp(value, this.minStart, this.#max));
    if (persist) {
      writeStored(this.storageKey, this.position);
      emit(this, 'mm-resize', { position: this.position });
    }
  }

  #onKeydown = (e: KeyboardEvent) => {
    const next = resizeForKey(e, {
      value: this.#pos,
      min: this.minStart,
      max: this.#max,
      orientation: this.orientation === 'vertical' ? 'horizontal' : 'vertical',
      rtl: isRtl(this),
      growsTowardEnd: true,
    });
    if (next === null) return;
    e.preventDefault();
    this.#set(next, true);
  };

  #coord(e: PointerEvent) {
    if (this.orientation === 'vertical') return e.clientY;
    return isRtl(this) ? -e.clientX : e.clientX;
  }

  #onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    this.#sep.setPointerCapture(e.pointerId);
    this.#drag = { start: this.#coord(e), from: this.#pos };
    this.setAttribute('data-dragging', '');
  };

  #onPointerMove = (e: PointerEvent) => {
    if (!this.#drag) return;
    this.#set(this.#drag.from + this.#coord(e) - this.#drag.start, false);
  };

  #onPointerUp = (e: PointerEvent) => {
    if (!this.#drag) return;
    this.#drag = undefined;
    this.removeAttribute('data-dragging');
    if (this.#sep.hasPointerCapture(e.pointerId)) this.#sep.releasePointerCapture(e.pointerId);
    this.#set(this.#pos, true);
  };

  #onDblClick = () => {
    this.position = clamp(this.defaultPosition, this.minStart, this.#max);
    writeStored(this.storageKey, undefined);
    emit(this, 'mm-resize', { position: this.position });
  };

  override render() {
    const pos = Math.round(this.#pos);
    return html`<div class="wrap" style="--_pos:${pos}px">
      <div class="pane" part="start" id="start"><slot name="start"></slot></div>
      <div
        class="sep"
        part="separator"
        role="separator"
        tabindex="0"
        aria-orientation=${this.orientation === 'vertical' ? 'horizontal' : 'vertical'}
        aria-controls="start"
        aria-label=${this.label || tr('resizePanes', 'Resize panes')}
        aria-valuenow=${pos}
        aria-valuemin=${this.minStart}
        aria-valuemax=${Math.round(this.#max)}
        @keydown=${this.#onKeydown}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @dblclick=${this.#onDblClick}
      ></div>
      <div class="pane" part="end"><slot name="end"></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-split-pane': MmSplitPane;
  }
}
