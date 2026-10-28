import type { Preview } from '@storybook/web-components-vite';
import core from './preview-core';
import { DocsPage } from './DocsPage';

const preview: Preview = {
  ...core,
  parameters: { ...core.parameters, docs: { ...core.parameters?.docs, page: DocsPage } },
};
export default preview;
