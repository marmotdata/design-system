import { define } from '../../core/define.js';
import { MmSelect, MmOption, MmOptionGroup } from './class.js';
define('mm-option', MmOption);
define('mm-option-group', MmOptionGroup);
define('mm-select', MmSelect);
export { MmSelect, MmOption, MmOptionGroup };
export type { MmOptionData, MmOptionLoader } from './class.js';
