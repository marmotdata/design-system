import { define } from '../../core/define.js';
import { MmQueryBuilder } from './class.js';
define('mm-query-builder', MmQueryBuilder);
export { MmQueryBuilder };
export { readQuery, writeQuery } from './class.js';
export type { GroupMatch, QueryNode, QueryGroupNode, QueryConditionNode, QueryTextNode } from './class.js';
