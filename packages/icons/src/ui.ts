/** Registers the bundled Material Symbols subset. Import once from your app entry. */
import { uiIcons } from './generated/ui-icons.js';
import { registerIcons } from './registry.js';
registerIcons(uiIcons);
export { uiIcons };
export type { UiIconName } from './generated/ui-icons.js';
