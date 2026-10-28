/**
 * Every custom event the library emits is prefixed `mm-`, bubbles and is composed so it crosses
 * shadow roots. Event detail types are declared per element in the global `MmEventMap` below, which
 * the React wrappers and Svelte types read from the Custom Elements Manifest.
 */
export function emit<T>(target: EventTarget, type: `mm-${string}`, detail: T, init: { cancelable?: boolean } = {}): boolean {
  return target.dispatchEvent(
    new CustomEvent<T>(type, { detail, bubbles: true, composed: true, cancelable: init.cancelable ?? false }),
  );
}

export type MmEvent<T> = CustomEvent<T>;
