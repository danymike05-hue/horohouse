/**
 * User text used inside a MongoDB regex must be escaped: otherwise "(" crashes the
 * query with a 500, and a pattern like "(a+)+$" can keep the database busy.
 * Also capped, so a huge search string can't be sent either.
 */
export const escapeRegex = (v: unknown, max = 100): string =>
  String(v ?? '').slice(0, max).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
