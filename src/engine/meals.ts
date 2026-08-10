/**
 * The overtime meal allowance — EBA N36, paid at the Annex C rate.
 *
 * This is the one figure in the app that is **not** taxed, and it is the reason
 * the fortnight has two bottom lines: the take-home the tax schedules produce,
 * and what actually lands once the allowance is added on top. See `fortnight.ts`.
 *
 * ## The rule
 *
 * N36.1 sends the rate to Annex C "with the following exception", and N36.2 is
 * the exception — written for a cohort that cannot reliably stop for a meal:
 *
 * > An employee who works overtime is entitled to payment of overtime meal
 * > allowance where the overtime is worked **after the end of ordinary duty for
 * > the day**, to the completion of or beyond a meal period, and any subsequent
 * > meal period, without a break for a meal.
 *
 * Two phrases carry the whole clause, and both are easy to read past:
 *
 * 1. **"after the end of ordinary duty for the day"** is a gate, not scenery.
 *    The overtime has to sit past the end of a shift. A bare pickup — a shift
 *    worked and knocked off on time — is not overtime *after* ordinary duty, so
 *    N36.2 cannot reach it, and Annex C cannot either (see the note below on
 *    "unpaid meal break"). It earns nothing.
 * 2. **"to the completion of or beyond a meal period"** describes the *duty*,
 *    not the overtime alone. You worked through a meal period without getting a
 *    break, and then you did not get to go home on time either — so you had to
 *    buy food. Attaching it to the overtime alone makes the clause fire only on
 *    two-to-four-hour overruns, which is not the case it was written for.
 *
 * So the test, per attendance:
 *
 * - Place the **rostered end** — the N36.2 boundary. `dutyFor` infers it from
 *   the roster patterns; without one there is no calculation at all.
 * - Require worked time **past** that boundary.
 * - Then, for each N36.3 window in `MEAL_PERIODS` that the whole duty touched:
 *   the duty must have been worked inside it, must have still been running when
 *   the window closed, and must have had no unpaid break fall in it.
 *
 * One allowance per window that passes — "and any subsequent meal period" is
 * what makes it per occasion rather than per attendance.
 *
 * ## Why Annex C's durations never enter into it
 *
 * Annex C's own three circumstances each require 1.5 hours of overtime (5 on a
 * Saturday, Sunday or public holiday) **prior to an unpaid meal break being
 * taken**, then half an hour after it. The phrase "unpaid meal break" occurs
 * exactly three times in the whole agreement and all three are inside that one
 * Annex C table. Section N never characterises the N35 break as unpaid, and O12
 * is titled "Paid Meal Breaks" for the Patient Transport cohort — so for
 * 44-hour roster road staff, whose break sits inside a paid shift, Annex C's
 * conditions cannot be satisfied at all. That is the most likely reason N36
 * exists as an exception: it substitutes "you worked through the meal period
 * without a break" for "you took an unpaid break". Reading the durations back in
 * would leave the exception with nothing to except.
 *
 * ## What this module assumes, and cannot know
 *
 * **It assumes no meal break was taken during the rostered shift.** On an
 * overrun the shift itself is never entered — only the overtime is — so there is
 * no break information for it, and the case N36 exists for is precisely the one
 * where the break was missed. A crew who did get their break inside a meal
 * period is over-counted here. Breaks the app *can* see (an unpaid gap between
 * two entered shifts in one attendance, C9.7) do suppress the window they fall
 * in. The §5.7 working says both of these on screen.
 *
 * Two readings were tried before this one; the history is in
 * `IMPLEMENTATION_PLAN.md` §3.11, and Phase 10 confirms this one against the
 * date-prefixed `MEAL ALLOWANCE` sub-rows on a real payslip.
 *
 * The rate and the roster patterns are both parameters, like every other figure
 * the engine uses. They live in `src/data/allowances.ts` and
 * `src/data/roster-shifts.ts`.
 */

import { absoluteMinutes, addDays } from './calendar'
import type { Attendance } from './attendance'
import type { IsoDate, Minutes } from './types'
import { MINUTES_PER_DAY } from './types'

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
 * table that gets reissued with a percentage on it, which is why they sit in the
 * engine beside the rule that walks them while the dollar figure does not.
 *
 * **Not the same as N35.7's Windows of Opportunity**, which are when a break is
 * *scheduled* (AM 0930–1130; D 1200–1400 & 1700–1900; PM 1400–1600 & 1900–2200;
 * N 0000–0200). Two different time sets doing two different jobs, and conflating
 * them is the easiest mistake available here.
 *
 * In clock order, which is the order occasions come out in.
 */
export const MEAL_PERIODS: readonly MealPeriod[] = [
  { startMin: 0, endMin: 60 },
  { startMin: 7 * 60, endMin: 9 * 60 },
  { startMin: 12 * 60, endMin: 14 * 60 },
  { startMin: 18 * 60, endMin: 19 * 60 },
]

/**
 * A rostered shift pattern, as the N36.2 boundary is inferred from.
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
   * The roster patterns to place the N36.2 boundary from. An empty list means no
   * allowance can be worked out for anything — which is the honest answer for
   * someone whose roster this app does not know.
   */
  rosterShifts: readonly RosterPattern[]
}

/** One earned allowance: which attendance, and which window it worked through. */
export interface MealOccasion {
  /** The attendance that earned it — the same ids the shift row acts on. */
  shiftIds: string[]
  /** The calendar day the meal period fell on. */
  date: IsoDate
  startMin: Minutes
  endMin: Minutes
  /** The roster pattern the N36.2 boundary was placed from — `'AM'`, `'N'`. */
  rosterCode: string
  /** True when the shift was inferred rather than entered. See `dutyFor`. */
  shiftInferred: boolean
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

/** How long a roster pattern runs, in minutes. Handles the overnight case. */
export function rosterDuration(pattern: RosterPattern): number {
  return pattern.endMin <= pattern.startMin
    ? pattern.endMin + MINUTES_PER_DAY - pattern.startMin
    : pattern.endMin - pattern.startMin
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

  return mergeSpans(spans)
}

function mergeSpans(spans: readonly Span[]): Span[] {
  const merged: Span[] = []
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
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

/**
 * The whole duty an attendance belongs to, with the N36.2 boundary placed.
 *
 * `null` means the boundary cannot be placed, and therefore no allowance is
 * worked out for this attendance at all — deliberately in silence, on Oscar's
 * call. Guessing a boundary from times that match no roster pattern would be
 * inventing the one fact the clause turns on.
 */
export interface Duty {
  /** Worked spans across the shift *and* the overtime, merged. */
  worked: Span[]
  /** Absolute minute the rostered shift ended — the N36.2 boundary. */
  rosteredEnd: number
  rosterCode: string
  /** True when the rostered shift was inferred rather than entered. */
  shiftInferred: boolean
}

export function dutyFor(
  attendance: Attendance,
  rosterShifts: readonly RosterPattern[],
): Duty | null {
  const worked = workedSpans(attendance)
  if (worked.length === 0) return null

  const entered = { start: worked[0].start, end: worked[worked.length - 1].end }

  if (attendance.kind === 'overrun') {
    // The overtime ran on from a rostered shift, so it *begins* where that shift
    // ended. Only the overtime was entered, so the shift is reconstructed
    // backwards from the boundary — which is what puts the shift's own meal
    // periods inside the duty, and is the whole reason a one-hour overrun
    // qualifies at all.
    const pattern = rosterShifts.find((p) => p.endMin === attendance.startMin)
    if (pattern === undefined) return null

    const shift: Span = {
      start: entered.start - rosterDuration(pattern),
      end: entered.start,
    }
    return {
      worked: mergeSpans([shift, ...worked]),
      rosteredEnd: entered.start,
      rosterCode: pattern.code,
      shiftInferred: true,
    }
  }

  // A standalone attendance that *is* a rostered shift, entered as one period
  // and running past its end — a picked-up shift that went long. Everything in
  // it is overtime, but N36.2 still needs an "end of ordinary duty for the day"
  // to sit after, and the shift's own end is the only candidate. An AM pickup
  // entered as 06:30–18:00 qualifies; the same pickup ending on time at 16:30
  // does not, which is the plain pickup case that earns nothing.
  const pattern = rosterShifts.find((p) => p.startMin === attendance.startMin)
  if (pattern === undefined) return null

  const rosteredEnd = entered.start + rosterDuration(pattern)
  if (entered.end <= rosteredEnd) return null

  return { worked, rosteredEnd, rosterCode: pattern.code, shiftInferred: false }
}

/**
 * The meal allowance occasions one attendance earned.
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

  const { worked } = duty
  const breaks = breakSpans(worked)
  const dutyStart = worked[0].start
  const dutyEnd = worked[worked.length - 1].end

  // Days are counted off the attendance's own start date, because the duty can
  // begin on an earlier one: a night-shift overrun starts at 07:00 on the day
  // after the shift it ran on from.
  const reference = absoluteMinutes(attendance.startDate, 0)
  const firstDay = Math.floor((dutyStart - reference) / MINUTES_PER_DAY)
  const lastDay = Math.floor((dutyEnd - 1 - reference) / MINUTES_PER_DAY)

  const occasions: MealOccasion[] = []

  for (let day = firstDay; day <= lastDay; day += 1) {
    const dayStart = reference + day * MINUTES_PER_DAY

    for (const period of MEAL_PERIODS) {
      const mealWindow: Span = {
        start: dayStart + period.startMin,
        end: dayStart + period.endMin,
      }

      // Worked inside the window at all. A window the duty never reached, or had
      // already finished before, is not a meal that was missed.
      if (!worked.some((span) => overlaps(span, mealWindow))) continue

      // "to the completion of or beyond a meal period" — still on duty when the
      // window closed. Knocking off at 13:00 leaves an hour of lunch to eat in.
      if (dutyEnd < mealWindow.end) continue

      // "without a break for a meal" — an unpaid gap in the window is the break
      // the clause is looking for, so the window pays nothing. Only gaps the app
      // can see; see the module header on what it cannot.
      if (breaks.some((gap) => overlaps(gap, mealWindow))) continue

      occasions.push({
        shiftIds: [...attendance.shiftIds],
        date: addDays(attendance.startDate, day),
        startMin: period.startMin,
        endMin: period.endMin,
        rosterCode: duty.rosterCode,
        shiftInferred: duty.shiftInferred,
        amount: settings.ratePerOccasion,
      })
    }
  }

  return occasions
}

/**
 * The fortnight's meal allowance — every occasion across every attendance.
 *
 * A rate of zero is a legitimate argument and produces zero-dollar occasions
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
