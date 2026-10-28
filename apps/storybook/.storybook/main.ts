import type { StorybookConfig } from '@storybook/web-components-vite';
import { fileURLToPath } from 'node:url';
import { sourceAliases, workspaceSource } from './workspace-source.ts';
import { prebundle } from './prebundle.ts';

// MM_PUBLIC=1 is the deployed Storybook: it leaves out the React smoke test.
const PUBLIC = process.env.MM_PUBLIC === '1';

const config: StorybookConfig = {
  framework: { name: '@storybook/web-components-vite', options: {} },
  stories: [
    '../src/foundations/**/*.mdx',
    '../src/foundations/**/*.stories.ts',
    ...(PUBLIC ? [] : ['../src/frameworks/**/*.stories.ts']),
    // MM_COMPONENTS=button,menu limits component stories (checkpoint builds while other work is in flight).
    ...(process.env.MM_COMPONENTS
      ? process.env.MM_COMPONENTS.split(',').map((c) => `../../../packages/elements/src/components/${c.trim()}/*.stories.ts`)
      : ['../../../packages/elements/src/components/**/*.stories.ts']),
    '../../../packages/icons/src/**/*.stories.ts',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest', 'storybook-addon-pseudo-states'],
  staticDirs: [{ from: '../../../packages/tokens/dist/fonts', to: '/fonts' }, { from: '../../../packages/tokens/dist/logos', to: '/logos' }],
  core: { disableTelemetry: true },
  docs: { defaultName: 'Docs' },
  viteFinal: async (config) => {
    config.resolve ??= {};
    const existing = Array.isArray(config.resolve.alias)
      ? config.resolve.alias
      : Object.entries(config.resolve.alias ?? {}).map(([find, replacement]) => ({ find, replacement: replacement as string }));
    config.resolve.alias = [
      ...existing,
      ...sourceAliases,
      ...(process.env.VITEST ? [] : [{ find: /^vitest\/browser$/, replacement: fileURLToPath(new URL('../src/support/vitest-browser-stub.ts', import.meta.url)) }]),
    ];
    config.plugins = [workspaceSource(), ...(config.plugins ?? [])];
    // Declare every runtime dependency up front: if Vite discovers one mid-run it re-optimises and
    // reloads, which kills in-flight Vitest browser runs (and parallel runs share the cache).
    config.optimizeDeps ??= {};
    config.optimizeDeps.include = [...(config.optimizeDeps.include ?? []), ...prebundle];
    // Editing a component reloads the whole preview (custom elements cannot be redefined in place).
    // Don't let files that are not source trigger that: build output, generated reports, screenshots.
    config.server ??= {};
    const ignored = ['**/dist/**', '**/storybook-static/**', '**/docs/**', '**/tools/**/REPORT.md', '**/*.png', '**/strings.json', '**/.turbo/**'];
    // MM_LIVE=0 pnpm storybook: no live reload at all, for browsing while files are being changed;
    // refresh the tab yourself to see edits.
    const live = process.env.MM_LIVE !== '0';
    config.server.hmr = live ? config.server.hmr : false;
    config.server.watch = { ...(config.server.watch ?? {}), ignored: live ? ignored : ['**/*'] };
    return config;
  },
};
export default config;
