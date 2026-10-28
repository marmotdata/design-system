import { autoUpdate, computePosition, flip, offset, shift, size, type Placement, type ReferenceElement } from '@floating-ui/dom';

export interface FloatOptions {
  placement?: Placement;
  offset?: number;
  /** Match the reference width (selects, comboboxes). */
  matchWidth?: boolean;
}

/**
 * Positions a floating element (shown with the native `popover` attribute, so it sits in the top
 * layer) against a reference. Returns a cleanup function.
 */
/** `reference` may be an element or a virtual element (e.g. the pointer position for a context menu). */
export function float(reference: ReferenceElement, floating: HTMLElement, opts: FloatOptions = {}): () => void {
  const update = () =>
    computePosition(reference, floating, {
      strategy: 'fixed',
      placement: opts.placement ?? 'bottom-start',
      middleware: [
        offset(opts.offset ?? 4),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply({ availableHeight, rects }) {
            floating.style.maxHeight = `${Math.max(120, availableHeight)}px`;
            if (opts.matchWidth) floating.style.minWidth = `${rects.reference.width}px`;
          },
        }),
      ],
    }).then(({ x, y, placement }) => {
      Object.assign(floating.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, margin: '0' });
      floating.dataset.placement = placement;
    });
  return autoUpdate(reference, floating, update);
}

/**
 * Guidelines: anything opened from the keyboard appears instantly. Track the last input modality so
 * overlays can skip their open transition when the user is on the keyboard.
 */
let lastInput: 'keyboard' | 'pointer' = 'pointer';
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (lastInput = 'keyboard'), true);
  window.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
}
export const openedFromKeyboard = () => lastInput === 'keyboard';

export const supportsPopover = () =>
  typeof HTMLElement !== 'undefined' && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover');

/** The deepest focused element, through shadow roots. */
export function deepActive(root: Document | ShadowRoot = document): Element | null {
  let el: Element | null = root.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}
