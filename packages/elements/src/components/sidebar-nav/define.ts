import { define } from '../../core/define.js';
import { MmNavGroup, MmNavItem, MmSidebarNav } from './class.js';
define('mm-sidebar-nav', MmSidebarNav);
define('mm-nav-group', MmNavGroup);
define('mm-nav-item', MmNavItem);
export { MmNavGroup, MmNavItem, MmSidebarNav };
export type { NavGroupToggleDetail, NavToggleDetail } from './class.js';
