import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { base } from '../../core/styles.js';
import { emit } from '../../core/events.js';
import { formatCount } from '../../core/format.js';
import { MmFormControl } from '../../core/form-control.js';
import { isRtl } from '../../core/roving.js';
import { describedBy, fieldStyles, helpAndError, str } from '../select/field.js';

const NBSP = '\u00a0';

/**
 * Sliders set a number within a known range where the exact value matters less than its position:
 * lineage depth, a row limit, a sampling rate. The value is always printed beside the label in a mono,
 * tabular readout with its unit, so nobody has to guess from the thumb. The track is `mm-rule`, the
 * filled part `mm-text-2` (never burnt sienna) and the thumb is ink with the standard focus ring. With
 * `range`, two thumbs set a lower and upper bound. Use a number input when people know the exact value.
 *
 * Keyboard follows the WAI-ARIA slider and multi-thumb slider patterns
 * (https://www.w3.org/WAI/ARIA/apg/patterns/slider/ and
 * https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/): arrows step (left and right flip in
 * right-to-left), Page Up and Page Down move a tenth of the range, Home and End go to the limits.
 *
 * @tagname mm-slider
 * @summary Set a number, or a range, by position.
 * @csspart readout - The value readout.
 * @csspart track - The track.
 * @csspart fill - The filled part of the track.
 * @csspart thumb - Each thumb.
 * @fires mm-input - {{ value: number; valueEnd?: number }} The value is changing (dragging or a key press).
 * @fires mm-change - {{ value: number; valueEnd?: number }} The value was committed (pointer released or a key press).
 * @fires change - Native-style change event.
 */
export class MmSlider extends MmFormControl {
  static override styles = [
    base,
    fieldStyles,
    css`
      :host {
        display: block;
        width: 320px;
        max-width: 100%;
      }
      .head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .readout {
        font: var(--text-caption);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text);
        white-space: nowrap;
      }
      .slider {
        position: relative;
        height: 24px;
        touch-action: none;
        cursor: pointer;
      }
      .track {
        position: absolute;
        inset-inline: 0;
        top: 10px;
        height: 4px;
        border-radius: var(--radius-sm);
        background: var(--mm-rule);
      }
      .fill {
        position: absolute;
        top: 0;
        bottom: 0;
        border-radius: var(--radius-sm);
        background: var(--mm-text-2);
      }
      .thumb {
        position: absolute;
        top: 2px;
        width: 12px;
        height: 20px;
        margin-inline-start: -6px;
        border-radius: var(--radius-sm);
        background: var(--mm-text);
        box-shadow: 0 0 0 2px var(--mm-surface);
        cursor: grab;
        transition: background-color var(--mm-dur-press) var(--mm-ease);
      }
      .thumb::before {
        content: '';
        position: absolute;
        inset: -4px -6px;
      }
      .thumb:active {
        cursor: grabbing;
      }
      .ends {
        display: flex;
        justify-content: space-between;
        font: var(--text-caption);
        font-variant-numeric: tabular-nums;
        color: var(--mm-text-2);
        margin-top: -2px;
      }
      .disabled .slider,
      .disabled .thumb {
        cursor: not-allowed;
      }
      .disabled .thumb {
        background: var(--mm-text-3);
      }
      .disabled .fill {
        background: var(--mm-text-3);
      }
      .invalid .track {
        background: var(--mm-danger);
      }
      @media (pointer: coarse) {
        .slider {
          height: var(--target-touch);
        }
        .track {
          top: 20px;
        }
        .thumb {
          top: 12px;
        }
        .thumb::before {
          inset: -12px -16px;
        }
      }
    `,
  ];

  /** Visible label above the track. */
  @property() accessor label = '';
  @property() accessor help = '';
  @property() accessor error = '';
  @property({ type: Number }) accessor min = 0;
  @property({ type: Number }) accessor max = 100;
  @property({ type: Number }) accessor step = 1;
  /** The value, or the lower bound with `range`. */
  @property({ type: Number }) accessor value = 0;
  /** The upper bound with `range`. */
  @property({ type: Number, attribute: 'value-end' }) accessor valueEnd = 100;
  /** Two thumbs for a lower and upper bound. Submits two entries under `name`. */
  @property({ type: Boolean, reflect: true }) accessor range = false;
  /** Unit printed after the value in the readout, such as `rows`. */
  @property() accessor unit = '';
  /** Custom readout and aria-valuetext formatter. */
  @property({ attribute: false }) accessor format: ((value: number) => string) | undefined;
  /** Hide the min and max labels under the track. */
  @property({ type: Boolean, attribute: 'hide-ends' }) accessor hideEnds = false;

  @state() private accessor dragging: 'start' | 'end' | null = null;
  #initial: [number, number] | null = null;
  #changed = false;

  override focus(options?: FocusOptions) {
    this.renderRoot?.querySelector<HTMLElement>('.thumb')?.focus(options);
  }

  #snap(v: number): number {
    const step = this.step > 0 ? this.step : 1;
    const snapped = this.min + Math.round((v - this.min) / step) * step;
    const decimals = (String(step).split('.')[1] ?? '').length;
    return Math.min(this.max, Math.max(this.min, Number(snapped.toFixed(decimals))));
  }
  formatValue(v: number): string {
    if (this.format) return this.format(v);
    return `${formatCount(v)}${this.unit ? NBSP + this.unit : ''}`;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (this.#initial === null) this.#initial = [this.value, this.valueEnd];
    // Keep values valid for the range.
    const v = this.#snap(Number.isFinite(this.value) ? this.value : this.min);
    if (v !== this.value) this.value = v;
    if (this.range) {
      const e = Math.max(this.value, this.#snap(Number.isFinite(this.valueEnd) ? this.valueEnd : this.max));
      if (e !== this.valueEnd) this.valueEnd = e;
    }
    if (changed.has('value') || changed.has('valueEnd') || changed.has('range') || changed.has('name')) {
      if (this.range) {
        const fd = new FormData();
        fd.append(this.name || 'value', String(this.value));
        fd.append(this.name || 'value', String(this.valueEnd));
        this.setFormValue(fd);
      } else this.setFormValue(String(this.value));
    }
  }

  formResetCallback(): void {
    if (!this.#initial) return;
    [this.value, this.valueEnd] = this.#initial;
  }

  #detail() {
    return this.range ? { value: this.value, valueEnd: this.valueEnd } : { value: this.value };
  }
  #set(which: 'start' | 'end', raw: number): boolean {
    let v = this.#snap(raw);
    if (which === 'start') {
      if (this.range) v = Math.min(v, this.valueEnd);
      if (v === this.value) return false;
      this.value = v;
    } else {
      v = Math.max(v, this.value);
      if (v === this.valueEnd) return false;
      this.valueEnd = v;
    }
    emit(this, 'mm-input', this.#detail());
    return true;
  }
  #commit() {
    emit(this, 'mm-change', this.#detail());
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onKeydown(e: KeyboardEvent, which: 'start' | 'end') {
    if (this.isDisabled) return;
    const cur = which === 'start' ? this.value : this.valueEnd;
    const rtl = isRtl(this);
    const step = this.step > 0 ? this.step : 1;
    const big = Math.max(step, Math.round((this.max - this.min) / 10 / step) * step);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowUp':
        next = cur + step;
        break;
      case 'ArrowDown':
        next = cur - step;
        break;
      case 'ArrowRight':
        next = rtl ? cur - step : cur + step;
        break;
      case 'ArrowLeft':
        next = rtl ? cur + step : cur - step;
        break;
      case 'PageUp':
        next = cur + big;
        break;
      case 'PageDown':
        next = cur - big;
        break;
      case 'Home':
        next = which === 'end' ? this.value : this.min;
        break;
      case 'End':
        next = which === 'start' && this.range ? this.valueEnd : this.max;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    if (this.#set(which, next)) this.#commit();
  }

  #valueAt(clientX: number): number {
    const track = this.renderRoot.querySelector<HTMLElement>('.track')!;
    const r = track.getBoundingClientRect();
    let f = r.width ? (clientX - r.left) / r.width : 0;
    if (isRtl(this)) f = 1 - f;
    f = Math.min(1, Math.max(0, f));
    return this.min + f * (this.max - this.min);
  }

  #onPointerDown = (e: PointerEvent) => {
    if (this.isDisabled || e.button !== 0) return;
    const v = this.#valueAt(e.clientX);
    let which: 'start' | 'end' = 'start';
    if (this.range) {
      const ds = Math.abs(v - this.value);
      const de = Math.abs(v - this.valueEnd);
      which = de < ds || (de === ds && v > this.valueEnd) ? 'end' : 'start';
    }
    e.preventDefault();
    this.dragging = which;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already released pointer */
    }
    this.#changed = this.#set(which, v);
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>(`.thumb[data-thumb="${which}"]`)?.focus({ preventScroll: true }),
    );
  };
  #onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    if (this.#set(this.dragging, this.#valueAt(e.clientX))) this.#changed = true;
  };
  #onPointerUp = () => {
    if (!this.dragging) return;
    this.dragging = null;
    if (this.#changed) this.#commit();
    this.#changed = false;
  };

  #pct(v: number): number {
    return this.max === this.min ? 0 : ((v - this.min) / (this.max - this.min)) * 100;
  }

  #thumb(which: 'start' | 'end') {
    const v = which === 'start' ? this.value : this.valueEnd;
    const lo = which === 'end' ? this.value : this.min;
    const hi = which === 'start' && this.range ? this.valueEnd : this.max;
    const disabled = this.isDisabled;
    const lower = /^\p{Lu}\p{Ll}/u.test(this.label) ? this.label[0]!.toLowerCase() + this.label.slice(1) : this.label;
    const name = this.range ? str(which === 'start' ? 'sliderMinimum' : 'sliderMaximum', { label: lower }) : undefined;
    return html`<div
      class="thumb"
      part="thumb"
      data-thumb=${which}
      role="slider"
      tabindex=${disabled ? '-1' : '0'}
      ?data-anchor=${which === 'start'}
      style="inset-inline-start:${this.#pct(v)}%"
      aria-labelledby=${ifDefined(name ? undefined : 'label')}
      aria-label=${ifDefined(name)}
      aria-valuemin=${lo}
      aria-valuemax=${hi}
      aria-valuenow=${v}
      aria-valuetext=${this.formatValue(v)}
      aria-orientation="horizontal"
      aria-disabled=${disabled ? 'true' : nothing}
      aria-invalid=${this.error ? 'true' : nothing}
      aria-describedby=${ifDefined(describedBy(this.help, this.error))}
      @keydown=${(e: KeyboardEvent) => this.#onKeydown(e, which)}
    ></div>`;
  }

  override render() {
    const start = this.range ? this.#pct(this.value) : 0;
    const end = this.range ? this.#pct(this.valueEnd) : this.#pct(this.value);
    const readout = this.range
      ? `${this.format ? this.format(this.value) : formatCount(this.value)}–${this.formatValue(this.valueEnd)}`
      : this.formatValue(this.value);
    return html`<div class="field ${this.isDisabled ? 'disabled' : ''} ${this.error ? 'invalid' : ''}">
      <div class="head">
        <span class="label" id="label" part="label">${this.label}</span>
        <span class="readout" part="readout" aria-hidden="true">${readout}</span>
      </div>
      <div
        class="slider"
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
      >
        <div class="track" part="track">
          <div class="fill" part="fill" style="inset-inline-start:${start}%;inline-size:${Math.max(0, end - start)}%"></div>
        </div>
        ${this.#thumb('start')} ${this.range ? this.#thumb('end') : nothing}
      </div>
      ${this.hideEnds
        ? nothing
        : html`<div class="ends" aria-hidden="true">
            <span>${this.format ? this.format(this.min) : formatCount(this.min)}</span
            ><span>${this.format ? this.format(this.max) : formatCount(this.max)}</span>
          </div>`}
      ${helpAndError(this.help, this.error)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-slider': MmSlider;
  }
}
