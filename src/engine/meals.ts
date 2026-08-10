/**
 * The overtime meal allowance — EBA N36, paid at the Annex C rate.
 *
 * This is the one figure in the app that is **not** taxed, and it is the reason
 * the fortnight now has two bottom lines: the take-home the tax schedules
 * produce, and what actually lands once the allowance is added on top. See
 * `fortnight.ts`.
 *
 * ## The rule
 *
 * N36.1 sends the rate to Annex C "with the following exception", and N36.2 is
 * the exception — a self-contained entitlement written for a cohort that cannot
 * reliably stop for a meal:
 *
 * > An employee who works overtime is entitled to payment of overtime meal
 * > allowance where the overtime is worked after the end of ordinary duty for
 * > the day, to the completion of or beyond a meal period, and any subsequent
 * > meal period, without a break for a meal.
 *
 * N36.3 then defines a meal period as one of the four windows in
 * `MEAL_PERIODS`. So the test this module applies, per attendance, per window:
 *
 * 1. Some of the overtime was worked inside the window, and
 * 2. the overtime ran **to the end of the window or past it** — you did not
 *    knock off part-way through and go and eat, and
 * 3. no unpaid break inside the attendance fell in the window — "without a
 *    break for a meal".
 *
 * One allowance per window that passes. "and any subsequent meal period" is
 * what makes it per occasion rather than per attendance: a fourteen-hour pickup
 * across breakfast, lunch and dinner earns three.
 *
 * ## Two things about that reading, because it is a reading
 *
 * **The Annex C durations are deliberately not applied.** Annex C's own three
 * circumstances each require 1.5 hours of overtime (5 on a Saturday, Sunday or
 * public holiday) *before an unpaid meal break is taken*, then half an hour
 * after it. Those thresholds hang off a break actually being taken, which is
 * exactly the thing N36.2 replaces — reading them back in would leave the
 * exception with nothing to except. The consequence is that a short overrun
 * through a window qualifies here and would not under a literal Annex C read.
 * Phase 10 settles it: a payslip with a `MEAL ALLOWANCE` line beside a known
 * fortnight answers the question in one look.
 *
 * **Both shift kinds qualify.** N36.2's "after the end of ordinary duty for the
 * day" is a shift overrun exactly; a picked-up shift arrives at the same
 * entitlement through N37.2, which lets a full overtime shift claim under N36.
 * So `kind` is not consulted here, unlike the C9.5 minimum.
 *
 * The rate is a parameter, like every other figure the engine uses. It lives in
 * `src/data/allowances.ts` with the Annex C progression behind it.
 */

import { absoluteMinutes, addDays } from './calendar'
import type { Attendance } from './attendance'
import type { IsoDate, Minutes } from './types'

/** One of N36.3's four windows, as minutes since midnight on a single day. */
export interface MealPeriod {
  startMin: Minutes
  /** Exclusive. `01:00` for the midnight window, not `00:59`. */
  endMin: Minutes
}

/**
 * The four meal periods of EBA N36.3 — midnight to 1:00 am, 7:00 to 9:00 am,
 * 12 noon to 2:00 pm, and 6:00 to 7:00 pm.
 *
 * Structural, not reference data: these are the clause's own text rather than a
 * table that gets reissued with a percentage on it, which is why they sit in
 * the engine beside the rule that walks them while the dollar figure does not.
 *
 * In clock order, which is the order occasions come out in.
 */
export const MEAL_PERIODS: readonly MealPeriod[] = [
  { startMin: 0, endMin: 60 },
  { startMin: 7 * 60, endMin: 9 * 60 },
  { startMin: 12 * 60, endMin: 14 * 60 },
  { startMin: 18 * 60, endMin: 19 * 60 },
]

/** One earned allowance: which attendance, and which window it worked through. */
export interface MealOccasion {
  /** The attendance that earned it — the same ids the shift row acts on. */
  shiftIds: string[]
  /** The calendar day the meal period fell on. */
  date: IsoDate
  startMin: Minutes
  endMin: Minutes
  amount: number
}

export interface MealAllowanceResult {
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

/**
 * The minutes actually worked in an attendance, as merged absolute spans.
 *
 * Read off the segments rather than the shifts, because the segments are what
 * the categoriser produced and they exclude the unpaid gaps by construction. A
 * segment never crosses midnight, so consecutive ones are re-joined here — the
 * date boundary is a labelling break, not a break for a meal.
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
 * The unpaid gaps between the worked spans — the breaks C9.7 says do not break
 * continuity of duty, which is precisely why they are inside the attendance and
 * available to be checked here.
 */
function breakSpans(worked: readonly Span[]): Span[] {
  const gaps: Span[] = []
  for (let i = 1; i < worked.length; i += 1) {
    gaps.push({ start: worked[i - 1].end, end: worked[i].start })
  }
  return gaps
}

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end
}

/** Every calendar date the attendance touches, in order. */
function datesTouched(attendance: Attendance): IsoDate[] {
  const dates: IsoDate[] = []
  let date = attendance.startDate
  while (date <= attendance.endDate) {
    dates.push(date)
    date = addDays(date, 1)
  }
  return dates
}

/**
 * The meal allowance occasions one attendance earned.
 *
 * Exported so the shift sheet can price a single shift's allowance in its live
 * preview through the same code that prices the fortnight — the same reason the
 * preview calls `calculateOvertime` rather than approximating it.
 */
export function mealOccasionsFor(
  attendance: Attendance,
  ratePerOccasion: number,
): MealOccasion[] {
  const worked = workedSpans(attendance)
  if (worked.length === 0) return []

  const breaks = breakSpans(worked)
  const workedEnd = worked[worked.length - 1].end
  const occasions: MealOccasion[] = []

  for (const date of datesTouched(attendance)) {
    for (const period of MEAL_PERIODS) {
      // Named `mealWindow`, not `window`: `boundary.test.ts` greps the engine
      // sources for `window.` to prove nothing here reached for the browser,
      // and a local of that name is indistinguishable from the global to a
      // regex. Renaming the variable is cheaper than weakening the guard.
      const mealWindow: Span = {
        start: absoluteMinutes(date, period.startMin),
        end: absoluteMinutes(date, period.endMin),
      }

      // Worked inside the window at all. A window the attendance never reached,
      // or had already finished before, is not a meal that was missed.
      if (!worked.some((span) => overlaps(span, mealWindow))) continue

      // "to the completion of or beyond a meal period" — the overtime has to
      // still be running when the window closes. Knocking off at 13:00 leaves
      // an hour of the lunch window to eat in.
      if (workedEnd < mealWindow.end) continue

      // "without a break for a meal" — an unpaid gap in the window is the
      // break the clause is looking for, so the window pays nothing.
      if (breaks.some((gap) => overlaps(gap, mealWindow))) continue

      occasions.push({
        shiftIds: [...attendance.shiftIds],
        date,
        startMin: period.startMin,
        endMin: period.endMin,
        amount: ratePerOccasion,
      })
    }
  }

  return occasions
}

/**
 * The fortnight's meal allowance — every occasion across every attendance.
 *
 * `ratePerOccasion` is Annex C's figure for the pay date. Zero is a legitimate
 * argument and produces zero-dollar occasions rather than none, so a caller
 * that has not wired the rate yet shows an obviously wrong figure instead of a
 * silently absent one.
 */
export function mealAllowanceFor(
  attendances: readonly Attendance[],
  ratePerOccasion: number,
): MealAllowanceResult {
  const occasions = attendances.flatMap((attendance) =>
    mealOccasionsFor(attendance, ratePerOccasion),
  )

  return {
    occasions,
    total: occasions.reduce((sum, occasion) => sum + occasion.amount, 0),
    ratePerOccasion,
  }
}
