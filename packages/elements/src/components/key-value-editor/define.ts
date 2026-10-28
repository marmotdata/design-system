import { define } from '../../core/define.js';
import { MmKeyValueEditor } from './class.js';
define('mm-key-value-editor', MmKeyValueEditor);
export { MmKeyValueEditor };
export { parsePairs, pairsToObject, objectToPairs } from './class.js';
export type { KeyValuePair } from './class.js';
