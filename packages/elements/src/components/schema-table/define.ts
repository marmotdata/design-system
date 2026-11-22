import { define } from '../../core/define.js';
import { MmSchemaTable } from './class.js';
define('mm-schema-table', MmSchemaTable);
export { MmSchemaTable };
export { plainType, toYaml } from './class.js';
export type { SchemaColumn, SchemaColumnStats, SchemaTerm, SchemaFieldChange, MmFieldChangeDetail, MmTermDetail, MmUnlinkTermDetail, MmSelectFieldDetail } from './class.js';
