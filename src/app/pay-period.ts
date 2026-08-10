/**
 * Which pay fortnight a date falls in.
 *
 * The app keeps a fortnight's shifts on the device (§4.4) and lets go of them
 * when that fortnight ends, so it needs to be able to name the period a date
 * belongs to and to tell one period from another. That is this module: the
 * anchor and the length come from `src/data/pay-periods.ts`, the counting
 * happens here, and nothing in `src/engine/` is involved — a pay period does
 * not change what overtime is worth.
 *
 * The period's `end` doubles as its identity in storage. It is a date rather
 * than an index, so a stored record says which fortnight it is from in a form
 * that is still readable if the anchor is ever corrected.
 */

import { PAY_PERIOD_ANCHOR_END, PAY_PERIOD_DAYS } from '../data/pay-periods'
import { addDays, daysSinceEpoch } from '../engine/calendar'
import type { IsoDate } from '../engine/types'
import { formatShortDate } from './dates'

export interface PayFortnight {
  /** The Thursday it opens on. */
  start: IsoDate
  /** The Wednesday it closes on, inclusive. Also its identity in storage. */
  end: IsoDate
}

/**
 * The pay fortnight containing `date`.
 *
 * Counted off the anchor in both directions, so a date before it works as well
 * as one after — the app is normally asking about today, but a test or an
 * older fortnight is not a special case.
 *
 * The boundary is inclusive at both ends: the anchor's own Wednesday belongs to
 * the period it closes, and the Thursday after it opens the next one.
 */
export function payFortnightFor(date: IsoDate): PayFortnight {
  const offset = daysSinceEpoch(date) - daysSinceEpoch(PAY_PERIOD_ANCHOR_END)
  // The smallest number of whole fortnights that puts the anchor's end on or
  // after `date`. `ceil` rather than `floor` because the end is inclusive:
  // a date one day past the anchor is in the *next* period, not this one.
  const periods = Math.ceil(offset / PAY_PERIOD_DAYS)
  const end = addDays(PAY_PERIOD_ANCHOR_END, periods * PAY_PERIOD_DAYS)

  return { start: addDays(end, -(PAY_PERIOD_DAYS - 1)), end }
}

/**
 * `'Thu 30 Jul – Wed 12 Aug'`. An en dash: it is a range, not a minus.
 *
 * Spaced, unlike `formatTimeRange` — two dates that each end in a month
 * abbreviation run together without the air.
 */
export function formatPayFortnight(fortnight: PayFortnight): string {
  return `${formatShortDate(fortnight.start)} – ${formatShortDate(fortnight.end)}`
}
