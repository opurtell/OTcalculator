/**
 * Dates without a date library (§4.3).
 *
 * Every time in this app is ACT wall-clock, so no timezone conversion happens
 * anywhere. `Date` is used only as a civil-calendar calculator — constructed
 * from explicit components and read back through the `getUTC*` accessors, which
 * makes it a pure day-counter with no local-timezone or DST behaviour to leak.
 *
 * The trap this avoids is `new Date('2026-08-07')`, which parses as UTC
 * midnight and lands on the previous day west of Greenwich. Nothing here ever
 * parses a date string through `Date`.
 */

import type { FinancialYear, HolidayCalendar, IsoDate, Minutes } from './types'
import { MINUTES_PER_DAY } from './types'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export interface CivilDate {
  year: number
  month: number // 1–12
  day: number // 1–31
}

/**
 * Parse and validate an `IsoDate`.
 *
 * Rejects round-trip failures, so `'2026-02-30'` throws rather than silently
 * becoming 2 March. A pay calculator that accepts a nonexistent date and
 * quietly computes a different day's rate is worse than one that refuses.
 */
export function parseIsoDate(date: IsoDate): CivilDate {
  const match = ISO_DATE.exec(date)
  if (!match) throw new RangeError(`Not an ISO date: ${JSON.stringify(date)}`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new RangeError(`No such date: ${date}`)
  }

  return { year, month, day }
}

export function toIsoDate({ year, month, day }: CivilDate): IsoDate {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Whole days since the Unix epoch. Used for ordering and gap arithmetic. */
export function daysSinceEpoch(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const utc = new Date((daysSinceEpoch(date) + days) * MS_PER_DAY)
  return toIsoDate({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  })
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/**
 * A single point on the wall clock, as minutes from the Unix epoch. Lets two
 * shifts on different dates be ordered and subtracted without a date type.
 */
export function absoluteMinutes(date: IsoDate, minute: Minutes): number {
  return daysSinceEpoch(date) * MINUTES_PER_DAY + minute
}

/** What the calendar says about a date, before the ratchet has its say. */
export type DayKind = 'public-holiday' | 'saturday' | 'sunday' | 'weekday'

export function dayKind(date: IsoDate, holidays: HolidayCalendar): DayKind {
  if (holidays.dates.has(date)) return 'public-holiday'
  const dow = dayOfWeek(date)
  if (dow === 6) return 'saturday'
  if (dow === 0) return 'sunday'
  return 'weekday'
}

/** True when the date is past the holiday list's horizon (§3.7). */
export function isBeyondHolidayData(
  date: IsoDate,
  holidays: HolidayCalendar,
): boolean {
  return date > holidays.coversThrough
}

/**
 * The Australian financial year a date falls in — `'2026-27'` for anything
 * from 1 July 2026. Tax scales and HELP thresholds are keyed by this and
 * selected on the pay date, so an older fortnight keeps computing against the
 * figures that were current when it was worked (§3.8).
 */
export function financialYearFor(date: IsoDate): FinancialYear {
  const { year, month } = parseIsoDate(date)
  const startYear = month >= 7 ? year : year - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

function firstSundayIn(year: number, month: number): IsoDate {
  for (let day = 1; day <= 7; day += 1) {
    const date = toIsoDate({ year, month, day })
    if (dayOfWeek(date) === 0) return date
  }
  /* istanbul ignore next — any 7-day window contains a Sunday */
  throw new Error(`No Sunday in the first week of ${year}-${month}`)
}

/**
 * Daylight saving transitions in the ACT: starts the first Sunday in October,
 * ends the first Sunday in April.
 *
 * The engine does no timezone arithmetic, so a shift spanning 02:00 on one of
 * these two days is off by an hour (§3.14). It is flagged for the user to
 * confirm rather than silently adjusted — C12 pays overtime by hours actually
 * worked, and only the person who worked them knows what that was.
 */
export function isDstTransition(date: IsoDate): boolean {
  const { year } = parseIsoDate(date)
  return date === firstSundayIn(year, 4) || date === firstSundayIn(year, 10)
}
