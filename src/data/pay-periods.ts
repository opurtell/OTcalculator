/**
 * The ACTAS pay calendar.
 *
 * Two figures, and neither is a rate: a pay fortnight runs Thursday to
 * Wednesday, and one real period is named so the rest can be counted off it.
 * Everything else about a pay period — which one a date falls in, when the
 * current one ends — is arithmetic, and lives in `src/app/pay-period.ts` so
 * this file stays a table of figures like the others.
 *
 * Nothing in `src/engine/` reads this. The pay period does not change what
 * overtime is worth; it decides how long the app should hold on to the shifts
 * someone typed (§4.4), which is a storage question, not a money one.
 *
 * Source: Oscar, 10 August 2026 — the pay period ending Wednesday 29 July 2026.
 */

import type { IsoDate } from '../engine/types'

/**
 * The last day of a known pay period: Wednesday 29 July 2026.
 *
 * Any anchor would do — every other period is this one plus or minus a
 * multiple of a fortnight — so this is simply the one that was reported. It is
 * a Wednesday, which is the property that matters and the one
 * `pay-period.test.ts` asserts.
 */
export const PAY_PERIOD_ANCHOR_END: IsoDate = '2026-07-29'

/** Thursday to Wednesday inclusive. */
export const PAY_PERIOD_DAYS = 14
