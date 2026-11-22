import { providerNames } from './generated/provider-loaders.js';
import { getProvider } from './registry.js';

// Asset types are open-ended, since plugins and people send any type they like, so a few common ones carry their own icon and the rest share one. Keys are the type in lower case with spaces and hyphens as underscores.
const typeIcons: Record<string, string> = {
  table: 'table',
  view: 'table-view',
  materialized_view: 'table-view',
  topic: 'stream',
  kafka_topic: 'stream',
  queue: 'stream',
  dashboard: 'dashboard',
  chart: 'dashboard',
  api: 'api',
  model: 'model-training',
  database: 'database',
  schema: 'schema',
  dataset: 'dataset',
  bucket: 'folder',
  dag: 'account-tree',
  pipeline: 'account-tree',
  job: 'account-tree',
  repository: 'code',
  service: 'dns',
  application: 'widgets',
  cluster: 'hub',
  agent: 'smart-toy',
};

/** The `mm-icon` shown for an asset type with no icon of its own. */
export const TYPE_ICON_FALLBACK = 'category';

/** The `mm-icon` shown in place of a provider that has no mark. */
export const PROVIDER_ICON_FALLBACK = 'extension';

/** An `mm-icon` name for an asset type such as "Table" or "KAFKA_TOPIC", falling back to `TYPE_ICON_FALLBACK`. */
export function typeIcon(type: string): string {
  return typeIcons[type.toLowerCase().replace(/[\s-]+/g, '_')] ?? TYPE_ICON_FALLBACK;
}

/** Whether `mm-provider-logo` can draw a mark for this provider, bundled or registered by the app. Show `PROVIDER_ICON_FALLBACK` with `mm-icon` when it can't. */
export function hasProviderMark(provider: string): boolean {
  const key = provider.toLowerCase();
  return key in providerNames || !!getProvider(key);
}
