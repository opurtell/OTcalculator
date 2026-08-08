/**
 * Attendance grouping (§3.5) and the C9.5 four-hour minimum (§3.6).
 *
 * The minimum is the piece of engine logic with no counterpart in the sibling
 * Pay Tracker, and the piece most likely to surprise: a two-hour call-in pays
 * four hours. Whenever it bites, the attendance carries `minimumApplied` and
 * the top-up minutes so the UI can show `2h worked → 4h paid (C9.5 minimum)`.
 * A figure larger than the hours worked is never presented bare.
 */

import { absoluteMinutes, isBeyondHolidayData, isDstTransition } from './calendar'
import {
  attendanceSpan,
  categoriesWorked,
  categoriseAttendance,
  categoryHourlyRate,
  segmentsPay,
  totalMinutes,
} from './overtime'
import type {
  AttendanceFlag,
  HolidayCalendar,
  Interval,
  IsoDate,
  Minutes,
  OtCategory,
  OtShift,
  PayBand,
  Segment,
  ShiftKind,
} from './types'
import {
  ATTENDANCE_GAP_MINUTES,
  GROUPING_UNCERTAIN_MAX_MINUTES,
  GROUPING_UNCERTAIN_MIN_MINUTES,
  MINIMUM_PAYMENT_MINUTES,
  MINUTES_PER_DAY,
} from './types'

/**
 * Worked minutes in a shift.
 *
 * A shift that ends at or before it starts without `endsNextDay` is rejected
 * rather than coerced: silently treating 19:00–09:00 as fourteen hours when the
 * user meant to tick "ends next day" would invent pay out of a typo.
 */
export function shiftDuration(shift: OtShift): number {
  const raw = shift.endsNextDay
    ? shift.endMin + MINUTES_PER_DAY - shift.startMin
    : shift.endMin - shift.startMin

  if (raw <= 0) {
    throw new RangeError(
      `Shift ${shift.id} ends at or before it starts — set endsNextDay if it runs past midnight`,
    )
  }
  if (raw > MINUTES_PER_DAY) {
    throw new RangeError(`Shift ${shift.id} is longer than 24 hours`)
  }
  return raw
}

export function shiftInterval(shift: OtShift): Interval {
  return {
    date: shift.date,
    startMin: shift.startMin,
    durationMinutes: shiftDuration(shift),
  }
}

function intervalStart(shift: OtShift): number {
  return absoluteMinutes(shift.date, shift.startMin)
}

function intervalEnd(shift: OtShift): number {
  return intervalStart(shift) + shiftDuration(shift)
}

/**
 * One continuous attendance, priced.
 *
 * `workedMinutes` is what was actually worked; `paidMinutes` is what it pays.
 * They differ only when the C9.5 minimum applies, and the difference is always
 * explained by `topUpMinutes` and `topUpCategory`.
 */
export interface Attendance {
  shiftIds: string[]
  startDate: IsoDate
  startMin: Minutes
  endDate: IsoDate
  endMin: Minutes
  kind: ShiftKind
  segments: Segment[]
  categories: OtCategory[]
  workedMinutes: number
  paidMinutes: number
  /** Minutes added by the C9.5 minimum. Zero unless `minimumApplied`. */
  topUpMinutes: number
  /** Rate the top-up is paid at: the first hour of the attendance (§3.6). */
  topUpCategory: OtCategory | null
  minimumApplied: boolean
  crossesMidnight: boolean
  flags: AttendanceFlag[]
  pay: number
}

/**
 * Group shifts into attendances.
 *
 * Gap ≤ 60 min joins (meal breaks do not break continuity, C9.7); anything
 * longer starts a new attendance and resets both the ratchet and the Mon–Fri
 * counter. Gaps in the 30–120 min band are still grouped by that rule but
 * flagged, because the 60-minute line is an engine convention rather than an
 * EBA one and the user should get to disagree.
 *
 * Overlapping shifts are merged into the enclosing span rather than
 * double-counted.
 */
export function groupIntoAttendances(shifts: readonly OtShift[]): OtShift[][] {
  const ordered = [...shifts].sort((a, b) => intervalStart(a) - intervalStart(b))
  const groups: OtShift[][] = []

  for (const shift of ordered) {
    const current = groups[groups.length - 1]
    if (current === undefined) {
      groups.push([shift])
      continue
    }

    const previousEnd = Math.max(...current.map(intervalEnd))
    const gap = intervalStart(shift) - previousEnd

    if (gap <= ATTENDANCE_GAP_MINUTES) {
      current.push(shift)
    } else {
      groups.push([shift])
    }
  }

  return groups
}

/**
 * Does the C9.5 minimum apply to this attendance?
 *
 * Only to a standalone attendance. Overtime that ran on from rostered duty
 * never attracts it — the ordinary shift has already been worked, so the
 * overtime is paid at its actual duration however short it is. An attendance
 * containing any `overrun` shift is continuous with ordinary duty as a whole,
 * so the minimum does not apply to any of it.
 */
function attendanceKind(shifts: readonly OtShift[]): ShiftKind {
  return shifts.some((shift) => shift.kind === 'overrun') ? 'overrun' : 'separate'
}

/**
 * The unpaid gaps inside an attendance are not paid, but the ratchet carries
 * across them — so the intervals are handed to the categoriser in order and it
 * keeps its state between them.
 */
function intervalsFor(shifts: readonly OtShift[]): Interval[] {
  const intervals: Interval[] = []
  let coveredTo = -Infinity

  for (const shift of shifts) {
    const start = Math.max(intervalStart(shift), coveredTo)
    const end = intervalEnd(shift)
    if (end <= start) continue // fully overlapped by an earlier shift

    const offsetIntoShift = start - intervalStart(shift)
    intervals.push({
      date: shift.date,
      startMin: shift.startMin + offsetIntoShift,
      durationMinutes: end - start,
    })
    coveredTo = end
  }

  return intervals
}

function flagsFor(
  shifts: readonly OtShift[],
  dates: readonly IsoDate[],
  holidays: HolidayCalendar,
): AttendanceFlag[] {
  const flags: AttendanceFlag[] = []

  for (let i = 1; i < shifts.length; i += 1) {
    const previousEnd = Math.max(...shifts.slice(0, i).map(intervalEnd))
    const gap = intervalStart(shifts[i]) - previousEnd
    if (
      gap >= GROUPING_UNCERTAIN_MIN_MINUTES &&
      gap <= GROUPING_UNCERTAIN_MAX_MINUTES
    ) {
      flags.push({ kind: 'grouping-uncertain', gapMinutes: gap })
    }
  }

  for (const date of dates) {
    if (isBeyondHolidayData(date, holidays)) {
      flags.push({ kind: 'beyond-holiday-data', date })
    }
    if (isDstTransition(date)) {
      flags.push({ kind: 'dst-transition', date })
    }
  }

  return flags
}

/** Price one already-grouped attendance. */
export function priceAttendance(
  shifts: readonly OtShift[],
  band: PayBand,
  holidays: HolidayCalendar,
): Attendance {
  if (shifts.length === 0) {
    throw new RangeError('An attendance needs at least one shift')
  }

  const intervals = intervalsFor(shifts)
  const span = attendanceSpan(intervals)
  const segments = categoriseAttendance(intervals, holidays)
  const workedMinutes = totalMinutes(segments)

  const kind = attendanceKind(shifts)
  const minimumApplied =
    kind === 'separate' && workedMinutes < MINIMUM_PAYMENT_MINUTES
  const topUpMinutes = minimumApplied ? MINIMUM_PAYMENT_MINUTES - workedMinutes : 0
  const topUpCategory = topUpMinutes > 0 ? segments[0].category : null

  const workedPay = segmentsPay(segments, band.annualBase)
  const topUpPay =
    topUpCategory === null
      ? 0
      : (topUpMinutes / 60) * categoryHourlyRate(band.annualBase, topUpCategory)

  return {
    shiftIds: shifts.map((shift) => shift.id),
    startDate: span.startDate,
    startMin: span.startMin,
    endDate: span.endDate,
    endMin: span.endMin,
    kind,
    segments,
    categories: categoriesWorked(segments),
    workedMinutes,
    paidMinutes: workedMinutes + topUpMinutes,
    topUpMinutes,
    topUpCategory,
    minimumApplied,
    crossesMidnight: span.crossesMidnight,
    flags: flagsFor(shifts, span.dates, holidays),
    pay: workedPay + topUpPay,
  }
}

export interface OvertimeResult {
  attendances: Attendance[]
  /** Gross overtime dollars for the fortnight, full precision. */
  gross: number
  workedMinutes: number
  paidMinutes: number
  flags: AttendanceFlag[]
}

/**
 * The Phase 2 entry point: a fortnight's shifts in, overtime dollars out.
 *
 * Takes the pay band and holiday calendar as parameters — the engine holds no
 * reference data of its own, so a fortnight from an earlier financial year
 * keeps computing against that year's figures.
 */
export function calculateOvertime(
  shifts: readonly OtShift[],
  band: PayBand,
  holidays: HolidayCalendar,
): OvertimeResult {
  const attendances = groupIntoAttendances(shifts).map((group) =>
    priceAttendance(group, band, holidays),
  )

  return {
    attendances,
    gross: attendances.reduce((total, a) => total + a.pay, 0),
    workedMinutes: attendances.reduce((total, a) => total + a.workedMinutes, 0),
    paidMinutes: attendances.reduce((total, a) => total + a.paidMinutes, 0),
    flags: attendances.flatMap((a) => a.flags),
  }
}
