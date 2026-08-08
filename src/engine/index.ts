/**
 * The pay engine. Pure functions — no DOM, no React, no imports from
 * `components/` or `storage/`. That boundary is what makes the money testable.
 *
 * `calculateFortnight` in `fortnight.ts` is the entry point: shifts and
 * settings in, take-home and the overtime delta out.
 */

export * from './types'
export * from './calendar'
export * from './overtime'
export * from './attendance'
export * from './tax'
export * from './packaging'
export * from './fortnight'
