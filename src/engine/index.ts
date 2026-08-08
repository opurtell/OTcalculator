/**
 * The pay engine. Pure functions — no DOM, no React, no imports from
 * `components/` or `storage/`. That boundary is what makes the money testable.
 *
 * Phase 2 covers overtime: categorisation, the midnight ratchet, attendance
 * grouping and the C9.5 minimum. PAYG, HELP, packaging and the with/without-OT
 * delta are Phase 3.
 */

export * from './types'
export * from './calendar'
export * from './overtime'
export * from './attendance'
