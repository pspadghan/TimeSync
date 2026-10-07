import rows from './records/sources.json';
import type { Source } from './types';

// Citations are at work level. Page and folio references still need to be added by
// historical editorial before any claim is treated as release-ready.
export const sources = rows as Source[];
export const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
