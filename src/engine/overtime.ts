/**
 * Rate categorisation and overtime dollars.
 *
 * This file owns the midnight ratchet (§3.4), which is ACTAS payroll
 * operational practice rather than literal EBA text — the agreement is silent
 * and C9.10 reads as though each day stands alone. It materially changes what a
 * night pickup pays, so it is not an implementation detail to be tidied away by
 * someone reading only the EBA.
 */

import { absoluteMinutes, addDays, dayKind } from './calendar'
import type { DayKind } from './calendar'
import type {
  HolidayCalendar,
  Interval,
  IsoDate,
  Minutes,
  OtCategory,
  Segment,
} from './types'
import {
  FORTNIGHTS_PER_YEAR_DENOMINATOR,
  FORTNIGHTS_PER_YEAR_NUMERATOR,
  MF_FIRST_TIER_MINUTES,
  MINUTES_PER_DAY,
  MULTIPLIER,
  ORDINARY_FORTNIGHTLY_HOURS,
} from './types'

/**
 * The hourly rate for one overtime minute, per EBA N34.1:
 *
 * ```
 * annualBase × 12/313 × multiplier ÷ 76
 * ```
 *
 * `annualBase` is the **base salary only**. Passing the Annex A composite total
 * here overstates every result by about 34%. `otHourlyRate` takes a bare number
 * rather than a `PayBand` specifically so that no call site can reach for the
 * wrong field of the band by habit — the caller has to name the figure.
 */
export function otHourlyRate(annualBase: number, multiplier: number): number {
  const fortnightlyBase =
    (annualBase * FORTNIGHTS_PER_YEAR_NUMERATOR) / FORTNIGHTS_PER_YEAR_DENOMINATOR
  return (fortnightlyBase / ORDINARY_FORTNIGHTLY_HOURS) * multiplier
}

/** The rate for a category. Full precision — rounding happens at display. */
export function categoryHourlyRate(
  annualBase: number,
  category: OtCategory,
): number {
  return otHourlyRate(annualBase, MULTIPLIER[category])
}

export function segmentPay(segment: Segment, annualBase: number): number {
  return (segment.minutes / 60) * categoryHourlyRate(annualBase, segment.category)
}

export function segmentsPay(segments: readonly Segment[], annualBase: number): number {
  return segments.reduce((total, segment) => total + segmentPay(segment, annualBase), 0)
}

/**
 * Ratchet state, carried across every interval of one attendance.
 *
 * Both fields are per *attendance*, not per calendar day. That is the whole
 * point of §3.4 and the single easiest thing to get wrong here.
 */
interface RatchetState {
  /** Highest category applied so far. The rate never falls below this. */
  highWater: OtCategory | null
  /**
   * Minutes actually **paid at a Mon–Fri rate** so far. Does not reset at
   * midnight, and — the subtle part — does not advance while a higher rate is
   * being carried. See `categoriseAttendance` for why that distinction decides
   * how §4.2 of the crossover doc comes out.
   */
  weekdayMinutes: number
}

/** What the calendar alone would say, before the ratchet is applied. */
function calendarCategory(kind: DayKind, weekdayMinutesSoFar: number): OtCategory {
  switch (kind) {
    case 'public-holiday':
      return 'ph_2_5x'
    case 'saturday':
      return 'sat_2x'
    case 'sunday':
      return 'sun_2x'
    case 'weekday':
      return weekdayMinutesSoFar < MF_FIRST_TIER_MINUTES ? 'mf_1_5x' : 'mf_2x'
  }
}

/**
 * Categorise one attendance, minute by minute.
 *
 * The rule: take the calendar-implied category for the minute; if its
 * multiplier is at least the highest seen so far, use it and raise the
 * high-water mark; otherwise carry the highest category forward. So the rate
 * only ever goes up.
 *
 * Intervals are the *worked* stretches. A meal break inside an attendance is
 * not an interval — it is unpaid, so it emits no segments, but the ratchet
 * state and the Mon–Fri counter carry straight across it, and the calendar
 * advances underneath it.
 *
 * Two consequences worth stating, both from §3.4:
 *
 * - Sunday 22:00 → Monday 06:00 pays all 8 hours at 2×, not 2h at 2× then 2h
 *   at 1.5×.
 * - Monday 19:00 → Tuesday 03:00 pays 2h at 1.5× then 6h at 2×, because the
 *   "first 2 hours" counter does not reset at midnight.
 *
 * Two details decide how the *labels* come out, and both are load-bearing for
 * reconciling against a payslip in Phase 10:
 *
 * - **Ties go to the calendar.** A Saturday running into Sunday is 2× either
 *   side, and the Sunday hours are tagged `sun_2x` rather than carrying the
 *   Saturday label (crossover doc §4.1).
 * - **The weekday counter advances only while a weekday rate is actually being
 *   paid.** In the Sunday → Monday case the Monday minutes are carried at 2×,
 *   so the counter never starts, the calendar never reaches `mf_2x`, and all
 *   eight hours stay tagged `sun_2x` (§4.2). Ticking the counter on calendar
 *   weekdays instead would relabel half the Monday as `mf_2x` — same money,
 *   but line items that no longer match payroll's.
 *
 * Segments never span midnight: a carried category still breaks at the date
 * boundary, so every segment describes exactly one calendar day.
 */
export function categoriseAttendance(
  intervals: readonly Interval[],
  holidays: HolidayCalendar,
): Segment[] {
  const state: RatchetState = { highWater: null, weekdayMinutes: 0 }
  const segments: Segment[] = []
  let offsetMinutes = 0
  /**
   * Wall-clock position of the minute after the previous segment's last. A
   * segment may only extend when the next minute continues it on the *clock*
   * as well as in the category — otherwise a meal break would be swallowed
   * into the segment either side of it and the breakdown would claim hours
   * that were not worked.
   */
  let clockAfterLast: number | null = null

  for (const interval of intervals) {
    const intervalStart = absoluteMinutes(interval.date, interval.startMin)

    for (let i = 0; i < interval.durationMinutes; i += 1) {
      const clock = intervalStart + i
      const absolute = interval.startMin + i
      const date = addDays(interval.date, Math.floor(absolute / MINUTES_PER_DAY))
      const minuteOfDay = absolute % MINUTES_PER_DAY

      const kind = dayKind(date, holidays)
      const calendar = calendarCategory(kind, state.weekdayMinutes)

      const carried = state.highWater
      const applied =
        carried === null || MULTIPLIER[calendar] >= MULTIPLIER[carried]
          ? calendar
          : carried
      state.highWater = applied

      // Only minutes genuinely paid at a weekday rate count toward the first
      // two hours. A minute carried at a higher rate is not Mon–Fri overtime
      // for this purpose, so the counter stays put and the carry persists for
      // the rest of the attendance.
      if (applied === 'mf_1_5x' || applied === 'mf_2x') state.weekdayMinutes += 1

      const last = segments[segments.length - 1]
      const contiguous =
        last !== undefined &&
        last.category === applied &&
        last.date === date &&
        clockAfterLast === clock

      if (contiguous) {
        last.minutes += 1
      } else {
        segments.push({
          category: applied,
          minutes: 1,
          date,
          startMin: minuteOfDay,
          offsetMinutes,
        })
      }

      clockAfterLast = clock + 1
      offsetMinutes += 1
    }
  }

  return segments
}

/**
 * Every distinct category in an attendance, in the order first worked. Drives
 * the breakdown line — "10h · all at 2×" versus "2h at 1.5×, then 6h at 2×".
 */
export function categoriesWorked(segments: readonly Segment[]): OtCategory[] {
  const seen: OtCategory[] = []
  for (const segment of segments) {
    if (!seen.includes(segment.category)) seen.push(segment.category)
  }
  return seen
}

/** Total minutes in a set of segments. */
export function totalMinutes(segments: readonly Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.minutes, 0)
}

/**
 * Where an attendance sits on the calendar.
 *
 * This cannot be read off the segments: a segment carries only the date it
 * *starts* on, and a carried category runs straight through midnight — Sunday
 * 22:00 → Monday 01:00 is a single `sun_2x` segment dated Sunday. `dates` is
 * therefore computed from the span, and is what the flag checks iterate.
 *
 * The end is exclusive, so an attendance finishing at exactly 00:00 belongs to
 * the day it was worked rather than the one it touched.
 */
export interface AttendanceSpan {
  startDate: IsoDate
  startMin: Minutes
  endDate: IsoDate
  endMin: Minutes
  /** Every calendar date the attendance touches, in order. */
  dates: IsoDate[]
  crossesMidnight: boolean
}

export function attendanceSpan(intervals: readonly Interval[]): AttendanceSpan {
  if (intervals.length === 0) {
    throw new RangeError('An attendance needs at least one worked interval')
  }

  const first = intervals[0]
  const last = intervals[intervals.length - 1]
  const startAbsolute = absoluteMinutes(first.date, first.startMin)
  const endAbsolute =
    absoluteMinutes(last.date, last.startMin) + last.durationMinutes

  const startDay = Math.floor(startAbsolute / MINUTES_PER_DAY)
  const lastDay = Math.floor((endAbsolute - 1) / MINUTES_PER_DAY)

  const dates: IsoDate[] = []
  for (let day = startDay; day <= lastDay; day += 1) {
    dates.push(addDays(first.date, day - startDay))
  }

  return {
    startDate: first.date,
    startMin: first.startMin,
    endDate: addDays(first.date, Math.floor(endAbsolute / MINUTES_PER_DAY) - startDay),
    endMin: endAbsolute % MINUTES_PER_DAY,
    dates,
    crossesMidnight: lastDay > startDay,
  }
}
