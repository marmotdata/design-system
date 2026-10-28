import { define } from '../../core/define.js';
import { MmMenu, MmMenuGroup, MmMenuItem, MmMenuSeparator } from './class.js';
define('mm-menu', MmMenu);
define('mm-menu-item', MmMenuItem);
define('mm-menu-separator', MmMenuSeparator);
define('mm-menu-group', MmMenuGroup);
export { MmMenu, MmMenuGroup, MmMenuItem, MmMenuSeparator };
export type { MenuSelectDetail, MenuShowOptions, MenuVirtualAnchor } from './class.js';
