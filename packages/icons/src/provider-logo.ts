import { LitElement, css, html, nothing, svg } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { providerLoaders, providerNames } from './generated/provider-loaders.js';
import { getProvider, onRegistryChange, registerProviders, type ProviderMark } from './registry.js';
import { SchemeController } from './theme.js';

/** One load per provider, however many logos ask for it. */
const loading = new Map<string, Promise<void>>();
function loadProvider(key: string): Promise<void> | undefined {
  const load = providerLoaders[key];
  if (!load) return undefined;
  let p = loading.get(key);
  if (!p) {
    p = load().then((m) => registerProviders({ [key]: m.default }));
    loading.set(key, p);
  }
  return p;
}

/**
 * A data provider's mark (PostgreSQL, Kafka, Snowflake). Provider logos are the only full-colour
 * artwork in working views and are never recoloured. Black marks are drawn in ink, so they read on Peat.
 * Marks load lazily from the package itself; nothing is fetched from a third party.
 *
 * The package bundles a mark for every source Marmot catalogs through a plugin. An app that shows
 * other providers (an agent's vendor, say) registers their marks itself with `registerProviders()`
 * from `@marmotdata/icons`, so the design system carries no product names it doesn't use.
 *
 * @summary Provider logo, bundled offline.
 * @csspart svg - The SVG element.
 */
export class MmProviderLogo extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      flex: none;
      width: var(--_size);
      height: var(--_size);
      vertical-align: -0.2em;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    :host([data-tone='ink']) svg {
      color: var(--mm-text);
    }
    :host([data-tone='generic']) svg {
      color: var(--mm-text-2);
    }
  `;

  /** Provider key as used in MRNs, e.g. `postgresql`, `kafka`, `bigquery`. */
  @property({ reflect: true }) accessor provider = '';
  /** Pixel size. */
  @property({ type: Number }) accessor size = 16;
  /** Hide from assistive technology when the provider name is already printed beside the logo. */
  @property({ type: Boolean }) accessor decorative = false;

  @state() accessor #mark: ProviderMark | undefined;
  #scheme = new SchemeController(this);
  #unsubscribe?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    // Only marks registered by the app itself arrive this way; lazy loads resolve below.
    this.#unsubscribe = onRegistryChange(() => {
      if (!this.#mark) this.#resolve();
    });
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
  }
  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('provider')) this.#resolve();
  }

  #resolve() {
    const key = this.provider.toLowerCase();
    const known = getProvider(key);
    if (known) {
      this.#mark = known;
      return;
    }
    this.#mark = undefined;
    void loadProvider(key)?.then(() => {
      if (this.provider.toLowerCase() === key) this.#mark = getProvider(key);
    });
  }

  /** Display name for a provider key, falling back to the key itself. */
  static displayName(provider: string): string {
    return providerNames[provider.toLowerCase()] ?? provider;
  }

  override render() {
    this.style.setProperty('--_size', `${this.size}px`);
    const mark = this.#mark;
    const label = MmProviderLogo.displayName(this.provider);
    if (!mark) return html`<svg part="svg" aria-hidden="true"></svg>`;
    const icon = this.#scheme.scheme === 'dark' && mark.dark ? mark.dark : mark.light;
    this.dataset.tone = mark.generic ? 'generic' : mark.tone;
    // Brand marks carry their published colour, which is artwork data rather than UI colour.
    const style = mark.tone === 'brand' && mark.brand ? `color:${mark.brand}` : nothing;
    return html`<svg
      part="svg"
      viewBox="0 0 ${icon.width} ${icon.height}"
      role=${this.decorative ? 'presentation' : 'img'}
      aria-hidden=${this.decorative ? 'true' : 'false'}
      aria-label=${this.decorative ? nothing : label}
      style=${style}
      fill="currentColor"
    >${svg`${unsafeSVG(icon.body)}`}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mm-provider-logo': MmProviderLogo;
  }
}
