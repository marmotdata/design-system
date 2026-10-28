import { define } from '../../core/define.js';
import { MmMultiselect, MmOption, MmOptionGroup } from './class.js';
define('mm-option', MmOption);
define('mm-option-group', MmOptionGroup);
define('mm-multiselect', MmMultiselect);
export { MmMultiselect, MmOption, MmOptionGroup };
export type { MmOptionData, MmOptionLoader } from './class.js';
