import { define } from '../../core/define.js';
import { MmDiffViewer } from './class.js';
define('mm-diff-viewer', MmDiffViewer);
export { MmDiffViewer, diffLines, diffColumns } from './class.js';
export type { DiffColumn, DiffLine, SchemaChange, SchemaChangeKind } from './class.js';
