/**
 * Dates as people read them.
 *
 * `src/engine/calendar.ts` does the arithmetic; this does the words. Kept
 * apart because the engine has no business knowing what a month is called, and
 * because `Intl.DateTimeFormat` would drag in a timezone the app deliberately
 * does not have — every time here is ACT wall-clock and none of it converts.
 */

import { dayOfWeek, parseIsoDate } from '../engine/calendar'
import type { IsoDate, Minutes } from '../engine/types'

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** `'Sat 15 Aug'` — the shift row's date, where space is tight. */
export function formatShortDate(date: IsoDate): string {
  const { month, day } = parseIsoDate(date)
  return `${WEEKDAY_SHORT[dayOfWeek(date)]} ${day} ${MONTH_SHORT[month - 1]}`
}

/** `'Saturday 15 August 2026'` — confirmation under the date field. */
export function formatLongDate(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date)
  return `${WEEKDAY_LONG[dayOfWeek(date)]} ${day} ${MONTH_LONG[month - 1]} ${year}`
}

/** `'15 June 2027'` — for a horizon or a boundary named in prose. */
export function formatDayAndMonth(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date)
  return `${day} ${MONTH_LONG[month - 1]} ${year}`
}

/** `'09:00–19:00'`. An en dash, not a hyphen — it is a range, not a minus. */
export function formatTimeRange(startMin: Minutes, endMin: Minutes): string {
  return `${clockTime(startMin)}–${clockTime(endMin)}`
}

/** `'09:00'` from minutes since midnight. Matches an `<input type="time">`. */
export function clockTime(minutes: Minutes): string {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * `'09:00'` → `540`, or `null` for anything an `<input type="time">` would not
 * have produced. A half-typed time is not an error, it is just not a time yet.
 */
export function parseClockTime(value: string): Minutes | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

/**
 * Whether a string is a date the engine can work with.
 *
 * Deliberately does **not** go through `parseIsoDate`, which throws on an
 * impossible date. This is the guard that runs *before* the engine sees a
 * field's contents, so it has to be able to say no about "2026-02-31" rather
 * than raise on it — the whole app is downstream of this answer.
 */
export function isIsoDate(value: string): value is IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false

  // Round-tripping catches 31 February, which a keyboard-entered date field
  // will happily hold and which would otherwise be priced as 3 March.
  const asDate = new Date(year, month - 1, day)
  return (
    asDate.getFullYear() === year &&
    asDate.getMonth() === month - 1 &&
    asDate.getDate() === day
  )
}
