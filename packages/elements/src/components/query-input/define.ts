import { define } from '../../core/define.js';
import { MmQueryInput, tokenize } from './class.js';
define('mm-query-input', MmQueryInput);
export { MmQueryInput, tokenize };
export { createQuerySuggest } from './suggest.js';
export type { QueryToken, QueryTokenType, QuerySuggestion, QuerySuggestFn } from './class.js';
export type { QuerySuggestField, QuerySuggestOptions } from './suggest.js';
