/**
 * Casual pay — EBA B14, priced shift by shift.
 *
 * A casual has no fortnightly salary, no composite and no roster adjustment, so
 * the full-time model ("salary, plus whatever overtime is entered") does not
 * apply. Every attendance entered is a casual engagement and is split in two:
 *
 * 1. **Ordinary** — the first 7h36 worked (B14.6). Base hourly rate, plus the
 *    25% casual loading (B14.2), plus any C8 shift penalty (B14.3) — the
 *    penalty on the base rate, never on the loading (B14.4). An engagement
 *    shorter than three hours is paid three (B14.1).
 * 2. **Overtime** — everything past 7h36, at the C9 rates on base pay, with no
 *    loading (B14.5, B14.7). C9.12 rather than N34: N34 belongs to the 44-hour
 *    roster (N23.1), which a casual is not on — see `OvertimeRules`. Being
 *    continuous with the ordinary hours, it never attracts the C9.5 minimum.
 *
 * The result is the same `Attendance` shape the full-time path produces, with
 * the overtime in the usual fields and the ordinary hours under `casual`, so the
 * rest of the app — the meal allowance, the with/without comparison, the shift
 * rows — reads both without forking.
 *
 * **Built to the EBA text and not yet checked against a casual payslip.** The
 * C8 reading in particular is a choice; see `ordinaryPenalties`.
 */

import {
  flagsFor,
  groupIntoAttendances,
  intervalsFor,
} from './attendance'
import type { Attendance, OvertimeResult } from './attendance'
import type { QuickOvertime } from './overtime'
import { addDays, dayKind } from './calendar'
import {
  attendanceSpan,
  C9_12_RULES,
  categoriesWorked,
  categoriseAttendance,
  otHourlyRate,
  quickOvertime,
  segmentsPay,
  totalMinutes,
} from './overtime'
import type {
  HolidayCalendar,
  Interval,
  OtShift,
  PayBand,
  ShiftPenaltyCategory,
} from './types'
import {
  CASUAL_LOADING,
  CASUAL_MINIMUM_MINUTES,
  CASUAL_ORDINARY_MINUTES,
  MINUTES_PER_DAY,
  NIGHT_PENALTY_FROM_MIN,
  NIGHT_PENALTY_UNTIL_MIN,
  SHIFT_PENALTY_RATE,
} from './types'

export interface CasualPenalty {
  category: ShiftPenaltyCategory
  /** Paid minutes the penalty applies to, the B14.1 top-up included. */
  minutes: number
  pay: number
}

/** The ordinary part of one casual engagement, priced. */
export interface CasualOrdinary {
  /** Ordinary minutes actually worked — at most 7h36. */
  workedMinutes: number
  /** What they pay — `workedMinutes` plus any B14.1 top-up. */
  paidMinutes: number
  topUpMinutes: number
  minimumApplied: boolean
  /** Base hourly rate: annual base × 12/313 ÷ 76. */
  hourlyRate: number
  /** `paidMinutes` at the base hourly rate. */
  basePay: number
  /** The 25% loading on `basePay`. */
  loading: number
  /** Empty when the shift attracts none. At most one category besides night. */
  penalties: CasualPenalty[]
  /** `basePay + loading + Σ penalties`. */
  pay: number
}

export interface CasualResult extends OvertimeResult {
  /** The fortnight's ordinary casual pay — the "without overtime" gross. */
  ordinaryGross: number
}

/** Split worked intervals at a worked-minute boundary. */
export function splitIntervals(
  intervals: readonly Interval[],
  atWorkedMinute: number,
): { before: Interval[]; after: Interval[] } {
  const before: Interval[] = []
  const after: Interval[] = []
  let worked = 0

  for (const interval of intervals) {
    const room = Math.max(0, atWorkedMinute - worked)
    if (room >= interval.durationMinutes) {
      before.push({ ...interval })
    } else if (room === 0) {
      after.push({ ...interval })
    } else {
      before.push({ ...interval, durationMinutes: room })
      after.push({
        date: interval.date,
        startMin: interval.startMin + room,
        durationMinutes: interval.durationMinutes - room,
      })
    }
    worked += interval.durationMinutes
  }

  return { before, after }
}

/** Each worked minute's calendar day kind, and whether it falls in C8.1's span. */
function eachMinute(
  intervals: readonly Interval[],
  visit: (date: string, minuteOfDay: number) => void,
): void {
  for (const interval of intervals) {
    for (let i = 0; i < interval.durationMinutes; i += 1) {
      const absolute = interval.startMin + i
      visit(
        addDays(interval.date, Math.floor(absolute / MINUTES_PER_DAY)),
        absolute % MINUTES_PER_DAY,
      )
    }
  }
}

function isNightMinute(minuteOfDay: number): boolean {
  return minuteOfDay >= NIGHT_PENALTY_FROM_MIN || minuteOfDay < NIGHT_PENALTY_UNTIL_MIN
}

/**
 * The C8 penalties on a casual's ordinary minutes, as minutes per category.
 *
 * The reading, clause by clause:
 *
 * - **Saturday, Sunday, public holiday are by the minute.** C8.5–C8.7 pay for
 *   "all rostered time of ordinary duty performed between midnight and
 *   midnight", so a Friday-night shift running into Saturday attracts the
 *   Saturday penalty on its Saturday minutes only.
 * - **Night is by the shift.** C8.1 pays 15% "for that shift" when any part of
 *   it falls between 6 pm and 6:30 am — so it covers every ordinary minute,
 *   and "any part" is tested on the whole engagement, overtime included.
 * - **Night gives way to anything else.** C8.3: the night penalty "will not be
 *   paid for any shift for which any other form of penalty payment is made". A
 *   shift with a single Saturday minute in it gets no night penalty at all —
 *   the literal reading, and the one that errs low.
 * - **The B14.1 top-up takes the penalty of the first minute worked**, the same
 *   rule the C9.5 top-up follows for overtime: the hours were never worked, so
 *   the day they were paid on is the day the engagement began.
 *
 * C8.2's 30% for more than four continuous weeks of nights needs a roster
 * history this app does not ask for, and is not modelled.
 */
function ordinaryPenaltyMinutes(
  ordinary: readonly Interval[],
  wholeShift: readonly Interval[],
  topUpMinutes: number,
  holidays: HolidayCalendar,
): Map<ShiftPenaltyCategory, number> {
  const minutes = new Map<ShiftPenaltyCategory, number>()
  const add = (category: ShiftPenaltyCategory, count: number) => {
    if (count > 0) minutes.set(category, (minutes.get(category) ?? 0) + count)
  }

  let firstDayCategory: ShiftPenaltyCategory | null | undefined
  eachMinute(ordinary, (date) => {
    const kind = dayKind(date, holidays)
    const category = kind === 'weekday' ? null : kind
    if (firstDayCategory === undefined) firstDayCategory = category
    if (category !== null) add(category, 1)
  })
  if (firstDayCategory) add(firstDayCategory, topUpMinutes)

  if (minutes.size > 0) return minutes // C8.3 — nothing else, so no night

  let touchesNight = false
  eachMinute(wholeShift, (_date, minuteOfDay) => {
    if (isNightMinute(minuteOfDay)) touchesNight = true
  })
  if (touchesNight) {
    add('night', totalIntervalMinutes(ordinary) + topUpMinutes)
  }
  return minutes
}

function totalIntervalMinutes(intervals: readonly Interval[]): number {
  return intervals.reduce((sum, interval) => sum + interval.durationMinutes, 0)
}

/** Penalty display order — the order C8 lists them in. */
const PENALTY_ORDER: readonly ShiftPenaltyCategory[] = [
  'night',
  'saturday',
  'sunday',
  'public-holiday',
]

/** Price one already-grouped attendance as a casual engagement. */
export function priceCasualAttendance(
  shifts: readonly OtShift[],
  band: PayBand,
  holidays: HolidayCalendar,
): Attendance {
  if (shifts.length === 0) {
    throw new RangeError('An attendance needs at least one shift')
  }

  const intervals = intervalsFor(shifts)
  const span = attendanceSpan(intervals)
  const { before: ordinaryIntervals, after: overtimeIntervals } = splitIntervals(
    intervals,
    CASUAL_ORDINARY_MINUTES,
  )

  // --- Ordinary: base + loading + C8 ---------------------------------------
  const hourlyRate = otHourlyRate(band.annualBase, 1)
  const ordinaryWorked = totalIntervalMinutes(ordinaryIntervals)
  // Measured on the whole engagement, so a shift with overtime in it never
  // qualifies — it is already past 7h36, let alone three hours.
  const totalWorked = totalIntervalMinutes(intervals)
  const minimumApplied = totalWorked < CASUAL_MINIMUM_MINUTES
  const topUpMinutes = minimumApplied ? CASUAL_MINIMUM_MINUTES - totalWorked : 0
  const ordinaryPaid = ordinaryWorked + topUpMinutes

  const basePay = (ordinaryPaid / 60) * hourlyRate
  const loading = basePay * CASUAL_LOADING
  const penaltyMinutes = ordinaryPenaltyMinutes(
    ordinaryIntervals,
    intervals,
    topUpMinutes,
    holidays,
  )
  const penalties: CasualPenalty[] = PENALTY_ORDER.filter((category) =>
    penaltyMinutes.has(category),
  ).map((category) => {
    const minutes = penaltyMinutes.get(category) ?? 0
    return {
      category,
      minutes,
      // B14.4 — on the ordinary hourly rate, the loading not counted.
      pay: (minutes / 60) * hourlyRate * SHIFT_PENALTY_RATE[category],
    }
  })

  const casual: CasualOrdinary = {
    workedMinutes: ordinaryWorked,
    paidMinutes: ordinaryPaid,
    topUpMinutes,
    minimumApplied,
    hourlyRate,
    basePay,
    loading,
    penalties,
    pay: basePay + loading + penalties.reduce((sum, p) => sum + p.pay, 0),
  }

  // --- Overtime past 7h36: C9.12, base only, no loading --------------------
  const segments = categoriseAttendance(overtimeIntervals, holidays, C9_12_RULES)
  const overtimeMinutes = totalMinutes(segments)

  return {
    shiftIds: shifts.map((shift) => shift.id),
    startDate: span.startDate,
    startMin: span.startMin,
    endDate: span.endDate,
    endMin: span.endMin,
    // The whole engagement was entered, so it is standalone in the N36 sense:
    // the boundary is where it started. C9.5 never applies — see `minimumApplied`.
    kind: 'separate',
    segments,
    categories: categoriesWorked(segments),
    workedMinutes: overtimeMinutes,
    paidMinutes: overtimeMinutes,
    topUpMinutes: 0,
    topUpCategory: null,
    minimumApplied: false,
    crossesMidnight: span.crossesMidnight,
    flags: flagsFor(shifts, span.dates, holidays),
    pay: segmentsPay(segments, band.annualBase),
    intervals,
    casual,
  }
}

/**
 * The casual counterpart to `calculateOvertime`: a fortnight's shifts in, the
 * ordinary casual pay and the overtime past 7h36 out.
 *
 * Grouped by the same rule as overtime (a gap of an hour or less is one
 * attendance), because that is also the best available reading of B14.1's
 * "each occasion" and B14.6's "day or shift".
 */
export function calculateCasual(
  shifts: readonly OtShift[],
  band: PayBand,
  holidays: HolidayCalendar,
): CasualResult {
  const attendances = groupIntoAttendances(shifts).map((group) =>
    priceCasualAttendance(group, band, holidays),
  )

  return {
    attendances,
    ordinaryGross: attendances.reduce((total, a) => total + (a.casual?.pay ?? 0), 0),
    gross: attendances.reduce((total, a) => total + a.pay, 0),
    workedMinutes: attendances.reduce((total, a) => total + a.workedMinutes, 0),
    paidMinutes: attendances.reduce((total, a) => total + a.paidMinutes, 0),
    flags: attendances.flatMap((a) => a.flags),
  }
}

/** Total minutes a casual attendance was on the clock, ordinary and overtime. */
export function engagementMinutes(attendance: Attendance): number {
  return totalIntervalMinutes(attendance.intervals)
}

/**
 * The quick pathway for a casual: one weekday daytime shift of `hours`.
 *
 * Ordinary up to 7h36 at base plus the 25% loading, three hours at least, then
 * the same two-tier overtime split the full-time quick pathway uses. No date,
 * so no shift penalty and no weekend or holiday rate — every one of which pays
 * more, so like its full-time counterpart it errs low.
 */
export function quickCasual(hours: number, annualBase: number): QuickOvertime {
  const worked = Math.max(0, hours)
  if (worked === 0) return { gross: 0, tiers: [] }

  const ordinaryLimit = CASUAL_ORDINARY_MINUTES / 60
  const ordinaryHours = Math.max(
    Math.min(worked, ordinaryLimit),
    CASUAL_MINIMUM_MINUTES / 60,
  )
  const hourlyRate = otHourlyRate(annualBase, 1) * (1 + CASUAL_LOADING)
  const overtime = quickOvertime(Math.max(0, worked - ordinaryLimit), annualBase)

  const tiers = [
    {
      category: null,
      label: 'casual rate',
      hours: ordinaryHours,
      hourlyRate,
      pay: ordinaryHours * hourlyRate,
    },
    ...overtime.tiers,
  ]
  return { gross: tiers.reduce((total, tier) => total + tier.pay, 0), tiers }
}
