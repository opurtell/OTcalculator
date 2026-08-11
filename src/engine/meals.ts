/**
 * The overtime meal allowance — EBA N36, paid at the Annex C rate.
 *
 * This is the one figure in the app that is **not** taxed, and it is the reason
 * the fortnight has two bottom lines: the take-home the tax schedules produce,
 * and what actually lands once the allowance is added on top. See `fortnight.ts`.
 *
 * ## The rule, as ACTAS applies it
 *
 * **A 10-hour shift that runs an hour or more over earns one allowance. Nothing
 * else earns anything.**
 *
 * That is it. Not the meal periods, not whether a break was taken, not how many
 * windows the duty crossed. The reasoning behind it — Oscar's, from practice — is
 * that the system takes the break you were entitled to during the shift as
 * having been given: N35.3 entitles you to 30 minutes within five hours of
 * continuous duty, and N35.7 gives a 10-hour shift exactly one Window of
 * Opportunity to take it in. Once the shift passes eleven hours you are owed a
 * *second* break, and that is the one you will not be given — so the allowance
 * stands in for the meal you have to buy instead.
 *
 * So:
 *
 * - **A 10-hour shift worked to time earns nothing**, break or no break.
 * - **An hour or more past it earns exactly one allowance**, however far past.
 * - A picked-up shift is treated exactly the same way: an AM picked up and
 *   entered as `06:30–17:30` earns one, and `06:30–16:30` earns nothing. The two
 *   10-hour patterns are the ones that start at 06:30 and 21:00.
 *
 * `dutyFor` places the boundary — the end of the rostered shift — from the
 * roster patterns, and there is no calculation at all without one:
 *
 * - **`overrun`** → the pattern whose **end** time is the overtime's start. The
 *   shift itself is never entered, so its length comes from the pattern.
 * - **`separate`** → the pattern whose **start** time is the attendance's start:
 *   a picked-up shift entered as one period, treated as a normal shift.
 * - **Neither → nothing, silently.** Oscar's call. Guessing a boundary from times
 *   that match no pattern would invent the one fact the rule turns on.
 *
 * ## This is practice, not literal clause text
 *
 * Read literally, N36.2 says something else — "the overtime is worked after the
 * end of ordinary duty for the day, to the completion of or beyond a meal period,
 * and any subsequent meal period, without a break for a meal" — and N36.3 defines
 * four meal periods, kept below as `MEAL_PERIODS`. Two readings of that text were
 * implemented and both were wrong about the money; the history is in
 * `IMPLEMENTATION_PLAN.md` §3.11. What is here is what payroll actually does, on
 * the same footing as the midnight ratchet in `overtime.ts`: operational
 * convention, confirmed by Oscar, that the agreement's own words do not spell
 * out. Do not "correct" it back towards the clause text without a payslip.
 *
 * The rate and the roster patterns are both parameters, like every other figure
 * the engine uses. They live in `src/data/allowances.ts` and
 * `src/data/roster-shifts.ts`.
 */

import { absoluteMinutes } from './calendar'
import type { Attendance } from './attendance'
import type { IsoDate, Minutes } from './types'
import { MINUTES_PER_DAY } from './types'

/**
 * The rostered shift length the allowance attaches to — ten hours.
 *
 * Operational, not from the agreement. It is the shift that N35.7 gives a single
 * Window of Opportunity: AM 0930–1130 and N 0000–0200. The two 12-hour patterns
 * get two windows each, so a second break is not owed at the same point and they
 * are outside this rule — see the §3.11 note on what Phase 10 still owes here.
 */
export const MEAL_ALLOWANCE_SHIFT_MINUTES = 600

/** How far past the rostered end the duty has to run. An hour or more. */
export const MEAL_ALLOWANCE_OVERRUN_MINUTES = 60

/**
 * One of N36.3's four meal periods, as minutes since midnight.
 *
 * **Nothing reads these.** They are the clause's own definition and are kept for
 * the same reason `PACKAGING_CAPS` is kept in `src/data/`: transcribed source
 * worth having on hand, with the money deliberately not depending on it. Two
 * earlier implementations *did* turn on these windows and both disagreed with
 * payroll — see the module header — so a future change that starts reading them
 * again is re-treading known ground and needs a payslip behind it.
 *
 * They are also **not** N35.7's Windows of Opportunity (AM 0930–1130; D
 * 1200–1400 & 1700–1900; PM 1400–1600 & 1900–2200; N 0000–0200), which are when
 * a break is *scheduled* — and which are what the rule above actually rests on.
 */
export interface MealPeriod {
  startMin: Minutes
  /** Exclusive. `01:00` for the midnight window, not `00:59`. */
  endMin: Minutes
}

export const MEAL_PERIODS: readonly MealPeriod[] = [
  { startMin: 0, endMin: 60 },
  { startMin: 7 * 60, endMin: 9 * 60 },
  { startMin: 12 * 60, endMin: 14 * 60 },
  { startMin: 18 * 60, endMin: 19 * 60 },
]

/**
 * A rostered shift pattern, as the boundary is placed from.
 *
 * Structurally what `RosterShift` in `src/data/roster-shifts.ts` already is, but
 * declared here with `code: string` so the engine never learns the four literal
 * codes — the arrow stays `data/` → `engine/` types only.
 */
export interface RosterPattern {
  code: string
  startMin: Minutes
  /** On the *start* date's clock, so a night shift's `endMin` is the smaller. */
  endMin: Minutes
}

export interface MealAllowanceSettings {
  /** The Annex C figure for the pay date. */
  ratePerOccasion: number
  /**
   * The roster patterns to place the shift's end from. An empty list means no
   * allowance can be worked out for anything — which is the honest answer for
   * someone whose roster this app does not know.
   */
  rosterShifts: readonly RosterPattern[]
}

/** The one allowance an attendance earned, and why. */
export interface MealOccasion {
  /** The attendance that earned it — the same ids the shift row acts on. */
  shiftIds: string[]
  /** Where the overtime was worked. */
  date: IsoDate
  /** The roster pattern the shift's end was placed from — `'AM'`, `'N'`. */
  rosterCode: string
  /** True when the shift was inferred rather than entered. See `dutyFor`. */
  shiftInferred: boolean
  /** The rostered shift's own length. Always 600 while the rule is 10 hours. */
  rosteredMinutes: number
  /** Overtime worked past the rostered end. At least 60, or nothing is owed. */
  overrunMinutes: number
  amount: number
}

export interface MealAllowanceResult {
  /** At most one per attendance — the allowance is not paid twice for a shift. */
  occasions: MealOccasion[]
  /** Tax free. Never part of `taxableGross` — see `fortnight.ts`. */
  total: number
  /** The Annex C figure this fortnight was priced at, for the working. */
  ratePerOccasion: number
}

/** A half-open span of absolute minutes. */
interface Span {
  start: number
  end: number
}

/** How long a roster pattern runs, in minutes. Handles the overnight case. */
export function rosterDuration(pattern: RosterPattern): number {
  return pattern.endMin <= pattern.startMin
    ? pattern.endMin + MINUTES_PER_DAY - pattern.startMin
    : pattern.endMin - pattern.startMin
}

/**
 * The minutes actually worked in an attendance, as merged absolute spans.
 *
 * Read off the segments rather than the shifts, because the segments are what the
 * categoriser produced and they exclude the unpaid gaps by construction. A
 * segment never crosses midnight, so consecutive ones are re-joined here.
 */
function workedSpans(attendance: Attendance): Span[] {
  const spans = attendance.segments
    .map((segment) => {
      const start = absoluteMinutes(segment.date, segment.startMin)
      return { start, end: start + segment.minutes }
    })
    .sort((a, b) => a.start - b.start)

  const merged: Span[] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last !== undefined && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
    } else {
      merged.push({ ...span })
    }
  }
  return merged
}

/**
 * Minutes **worked** past a boundary.
 *
 * Worked, not elapsed: an unpaid gap inside the attendance is not time on the
 * road, so it does not count towards the hour. Same principle as the C9.5 top-up
 * below — the rule is about how long you were actually kept there.
 */
function workedAfter(spans: readonly Span[], boundary: number): number {
  return spans.reduce(
    (total, span) => total + Math.max(0, span.end - Math.max(span.start, boundary)),
    0,
  )
}

/**
 * The rostered shift an attendance attaches to, or `null` when it cannot be
 * placed — in which case no allowance is worked out at all, deliberately in
 * silence.
 */
export interface Duty {
  rosterCode: string
  shiftInferred: boolean
  /** The rostered shift's own length, from the pattern. */
  rosteredMinutes: number
  /** Overtime worked past the rostered end. */
  overrunMinutes: number
}

export function dutyFor(
  attendance: Attendance,
  rosterShifts: readonly RosterPattern[],
): Duty | null {
  const worked = workedSpans(attendance)
  if (worked.length === 0) return null

  if (attendance.kind === 'overrun') {
    // The overtime ran on from a rostered shift, so it begins where that shift
    // ended. The shift itself was never entered — only the overtime — so its
    // length comes from the pattern and every worked minute here is past it.
    const pattern = rosterShifts.find((p) => p.endMin === attendance.startMin)
    if (pattern === undefined) return null

    return {
      rosterCode: pattern.code,
      shiftInferred: true,
      rosteredMinutes: rosterDuration(pattern),
      overrunMinutes: workedAfter(worked, worked[0].start),
    }
  }

  // A standalone attendance that *is* a rostered shift, entered as one period —
  // a picked-up shift, treated exactly as a normal one. `06:30–17:30` is an AM
  // an hour over; `06:30–16:30` is an AM worked to time and earns nothing.
  const pattern = rosterShifts.find((p) => p.startMin === attendance.startMin)
  if (pattern === undefined) return null

  const rosteredMinutes = rosterDuration(pattern)
  return {
    rosterCode: pattern.code,
    shiftInferred: false,
    rosteredMinutes,
    overrunMinutes: workedAfter(worked, worked[0].start + rosteredMinutes),
  }
}

/**
 * The allowance one attendance earned — at most one.
 *
 * Returns an array rather than a nullable occasion so the aggregate and the
 * display rows do not have to care that the count is currently capped at one.
 * Whether payroll ever pays a second is a Phase 10 question, and keeping the
 * shape means answering it does not ripple outwards.
 *
 * Exported so the shift sheet can price a single shift in its live preview
 * through the same code that prices the fortnight — the same reason the preview
 * calls `calculateOvertime` rather than approximating it.
 */
export function mealOccasionsFor(
  attendance: Attendance,
  settings: MealAllowanceSettings,
): MealOccasion[] {
  const duty = dutyFor(attendance, settings.rosterShifts)
  if (duty === null) return []

  // Ten-hour shifts only. A 12-hour pattern gets two Windows of Opportunity
  // under N35.7, so a second break is not owed at the same point.
  if (duty.rosteredMinutes !== MEAL_ALLOWANCE_SHIFT_MINUTES) return []

  // An hour or more over. Note this is measured on minutes *worked*, so the
  // C9.5 four-hour minimum cannot buy the hour: a 30-minute call-in pays four
  // hours and still only kept you there for thirty minutes.
  if (duty.overrunMinutes < MEAL_ALLOWANCE_OVERRUN_MINUTES) return []

  return [
    {
      shiftIds: [...attendance.shiftIds],
      date: attendance.startDate,
      rosterCode: duty.rosterCode,
      shiftInferred: duty.shiftInferred,
      rosteredMinutes: duty.rosteredMinutes,
      overrunMinutes: duty.overrunMinutes,
      amount: settings.ratePerOccasion,
    },
  ]
}

/**
 * The fortnight's meal allowance.
 *
 * A rate of zero is a legitimate argument and produces a zero-dollar occasion
 * rather than none, so a caller that has not wired the rate yet shows an
 * obviously wrong figure instead of a silently absent one.
 */
export function mealAllowanceFor(
  attendances: readonly Attendance[],
  settings: MealAllowanceSettings,
): MealAllowanceResult {
  const occasions = attendances.flatMap((attendance) =>
    mealOccasionsFor(attendance, settings),
  )

  return {
    occasions,
    total: occasions.reduce((sum, occasion) => sum + occasion.amount, 0),
    ratePerOccasion: settings.ratePerOccasion,
  }
}
