import type { Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components-vite';
import '@marmotdata/tokens/index.css';
import '@marmotdata/css';
import '@marmotdata/elements';
import '@marmotdata/icons/define.js';
import manifest from '@marmotdata/elements/custom-elements.json';
import '../src/support/preview.css';

setCustomElementsManifest(manifest);

const apply = (theme: string, density: string, motion: string, dir: string) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.density = density;
  root.dataset.motion = motion;
  root.dir = dir;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Peat' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Row and control density',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: [
          { value: 'default', title: 'Default density' },
          { value: 'compact', title: 'Compact density' },
        ],
        dynamicTitle: true,
      },
    },
    motion: {
      description: 'Reduced motion',
      toolbar: {
        title: 'Motion',
        icon: 'play',
        items: [
          { value: 'full', title: 'Full motion' },
          { value: 'reduce', title: 'Reduced motion' },
        ],
        dynamicTitle: true,
      },
    },
    dir: {
      description: 'Text direction',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right' },
          { value: 'rtl', title: 'Right to left' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    density: 'default',
    motion: 'full',
    dir: 'ltr',
    // In the browser UI, axe runs only when asked (Accessibility panel, "Run"): scanning every story
    // on every render and hot update is the costliest thing the UI does. Story tests always run it.
    ...((globalThis as { __vitest_browser__?: boolean }).__vitest_browser__ ? {} : { a11y: { manual: true } }),
  },
  decorators: [
    (story, ctx) => {
      const g = ctx.globals as Record<string, string>;
      const p = ctx.parameters as { theme?: string; dir?: string };
      // Under Vitest, motion is reduced: tests check behaviour and accessibility, and axe must never sample a mid-fade frame.
      const motion = (globalThis as { __vitest_browser__?: boolean }).__vitest_browser__ ? 'reduce' : (g.motion ?? 'full');
      apply(p.theme ?? g.theme ?? 'light', g.density ?? 'default', motion, p.dir ?? g.dir ?? 'ltr');
      return story();
    },
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: ['Introduction', 'Foundations', ['Design philosophy', 'Colour', 'Type', 'Space and radius', 'Elevation', 'Motion', 'Iconography', 'Data visualisation', 'Voice and copy', 'Accessibility'], 'Components'],
      },
    },
    docs: { codePanel: true },
  },
  tags: ['autodocs'],
};
export default preview;
