import { setProjectAnnotations } from '@storybook/web-components-vite';
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';
import * as projectAnnotations from './preview-core';

setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

// "ResizeObserver loop completed with undelivered notifications" is a benign browser warning that
// virtualisers trigger while measuring; it is not an application error, so it must not fail a test.
window.addEventListener('error', (e) => {
  if (/ResizeObserver loop/.test(e.message)) e.stopImmediatePropagation();
});

// Real keyboard state (held modifiers) persists across tests in one browser session; reset it so a
// test that leaves Shift down cannot change what the next test types.
import { beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
beforeEach(async () => {
  await (userEvent as unknown as { cleanup?: () => Promise<void> }).cleanup?.();
});
