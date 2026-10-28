import { define } from '../../core/define.js';
import { MmToast, MmToaster, toast } from './class.js';
define('mm-toast', MmToast);
define('mm-toaster', MmToaster);
export { MmToast, MmToaster, toast };
export type { ToastOptions, ToastTone, ToastDismissReason } from './class.js';
