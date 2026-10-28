let n = 0;
/** Unique id for ARIA relationships inside a shadow root. */
export const uid = (prefix = 'mm') => `${prefix}-${++n}`;
