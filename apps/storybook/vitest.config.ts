import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { prebundle } from './.storybook/prebundle.ts';

const browsers = (process.env.MM_BROWSERS ?? 'chromium').split(',').map((b) => ({ browser: b.trim() as 'chromium' | 'firefox' | 'webkit' }));

export default defineConfig({
  optimizeDeps: { include: prebundle },
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL('./.storybook', import.meta.url)) })],
        test: {
          name: 'storybook',
          browser: { enabled: true, headless: true, provider: playwright(), instances: browsers },
          setupFiles: ['./.storybook/vitest.setup.ts'],
          // Shared CI machines are slower and noisier than a laptop: retry a failed story there before failing the run.
          retry: process.env.CI ? 2 : 0,
        },
      },
    ],
  },
});
