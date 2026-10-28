import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Loading rule (guidelines): show a spinner or skeleton only after 200ms, then keep it for at least 400ms,
 * so fast loads never flash. `visible` follows `active` with that delay and minimum.
 */
export class DelayedVisibility implements ReactiveController {
  visible = false;
  #shownAt = 0;
  #timer?: ReturnType<typeof setTimeout>;
  constructor(
    private host: ReactiveControllerHost,
    private delay = 200,
    private minimum = 400,
  ) {
    host.addController(this);
  }
  set(active: boolean) {
    clearTimeout(this.#timer);
    if (active && !this.visible) {
      this.#timer = setTimeout(() => {
        this.visible = true;
        this.#shownAt = performance.now();
        this.host.requestUpdate();
      }, this.delay);
    } else if (!active && this.visible) {
      const left = Math.max(0, this.minimum - (performance.now() - this.#shownAt));
      this.#timer = setTimeout(() => {
        this.visible = false;
        this.host.requestUpdate();
      }, left);
    }
  }
  hostDisconnected() {
    clearTimeout(this.#timer);
  }
}
