/**
 * ACT public holidays. A shift on one of these dates is `ph_2_5x` for all
 * hours (C9.14), and the rate carries past midnight under the ratchet.
 *
 * Source: the ACTAS Pay Tracker's `public-holidays.json`.
 *
 * **The list ends, and that is load-bearing.** `coversThrough` is the last date
 * it is known complete to. Past it the engine raises `beyond-holiday-data`
 * rather than quietly charging a weekday rate to what may be a 2.5× day (§3.7).
 * Extending the list means adding dates *and* moving the horizon.
 *
 * Note 2026: Boxing Day falls on a Saturday and is observed on Monday 28
 * December. The observed date is the public holiday; the 26th is not.
 */

import type { HolidayCalendar, IsoDate } from '../engine/types'

export interface HolidayEntry {
  date: IsoDate
  name: string
}

export const ACT_PUBLIC_HOLIDAYS: readonly HolidayEntry[] = [
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-26', name: 'Boxing Day' },
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-01-27', name: 'Australia Day' },
  { date: '2025-03-10', name: 'Canberra Day' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-19', name: 'Easter Saturday' },
  { date: '2025-04-21', name: 'Easter Monday' },
  { date: '2025-04-25', name: 'ANZAC Day' },
  { date: '2025-05-26', name: 'Reconciliation Day' },
  { date: '2025-06-09', name: "King's Birthday" },
  { date: '2025-10-06', name: 'Labour Day' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Boxing Day' },
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: 'Australia Day' },
  { date: '2026-03-09', name: 'Canberra Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-04', name: 'Easter Saturday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-04-25', name: 'ANZAC Day' },
  { date: '2026-05-25', name: 'Reconciliation Day' },
  { date: '2026-06-08', name: "King's Birthday" },
  { date: '2026-10-05', name: 'Labour Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (observed)' },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-01-26', name: 'Australia Day' },
  { date: '2027-03-08', name: 'Canberra Day' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-03-27', name: 'Easter Saturday' },
  { date: '2027-03-29', name: 'Easter Monday' },
  { date: '2027-04-25', name: 'ANZAC Day' },
  { date: '2027-05-24', name: 'Reconciliation Day' },
  { date: '2027-06-14', name: "King's Birthday" },
]

/**
 * The horizon is the last *known holiday*, not the end of that year. Beyond
 * King's Birthday 2027 the ACT has not published dates, so the app does not
 * pretend to know there are none.
 */
export const COVERS_THROUGH: IsoDate = '2027-06-14'

export const ACT_HOLIDAY_CALENDAR: HolidayCalendar = {
  dates: new Set(ACT_PUBLIC_HOLIDAYS.map((h) => h.date)),
  coversThrough: COVERS_THROUGH,
}

/** The holiday's name, for the breakdown line — `2.5× (Canberra Day)`. */
export function holidayNameFor(date: IsoDate): string | undefined {
  return ACT_PUBLIC_HOLIDAYS.find((h) => h.date === date)?.name
}
