/**
 * The four shift patterns of the ACTAS 44-hour roster.
 *
 * They are the roster's own vocabulary — the codes a paramedic already uses to
 * say which shift they picked up — kept here because they are a table of figures
 * and this is where tables of figures live.
 *
 * **The money now depends on them.** They started as a quick-fill for the shift
 * sheet and nothing else, but the N36 meal allowance turns on a 10-hour shift
 * running an hour over, and on an overrun the only thing that can place that
 * shift is the pattern the overtime ran on from. `src/app/settings.ts` passes
 * this table to the engine as `meals.rosterShifts`; the engine still holds none
 * of it. Three consequences:
 *
 * - a mistyped time here silently removes someone's meal allowance (`dutyFor`
 *   returns `null` rather than guessing);
 * - the four **end** times have to stay distinct from each other, or an overrun
 *   cannot be attributed;
 * - the **durations** decide eligibility, not just the times. AM and N are the
 *   two 10-hour patterns and the only ones inside the rule; changing D or PM to
 *   ten hours would start paying allowances that payroll does not.
 *
 * The four durations sum to 44 hours, which is where the roster gets its name
 * and is the one checkable property of the transcription. `roster-shifts.test.ts`
 * asserts it, so a mistyped time fails a test rather than quietly pre-filling
 * the wrong hours.
 *
 * Source: Oscar, 8 August 2026. Not from the EBA — the agreement sets rates and
 * ordinary hours, not the station's shift patterns.
 */

import type { Minutes } from '../engine/types'

/** `AM`, `D`, `PM`, `N` — as they appear on the roster. */
export type RosterShiftCode = 'AM' | 'D' | 'PM' | 'N'

export interface RosterShift {
  code: RosterShiftCode
  startMin: Minutes
  /**
   * Minutes since midnight on the *start* date's clock, so the night shift's
   * 07:00 is less than its 21:00 start. Crossing midnight is derived from that
   * rather than stored — see `draftEndsNextDay`.
   */
  endMin: Minutes
}

function at(hours: number, minutes = 0): Minutes {
  return hours * 60 + minutes
}

/** In roster order — earliest start first, which is also how they are shown. */
export const ROSTER_SHIFTS: readonly RosterShift[] = [
  { code: 'AM', startMin: at(6, 30), endMin: at(16, 30) },
  { code: 'D', startMin: at(9), endMin: at(21) },
  { code: 'PM', startMin: at(11), endMin: at(23) },
  { code: 'N', startMin: at(21), endMin: at(7) },
]

export function rosterShift(code: RosterShiftCode): RosterShift {
  const found = ROSTER_SHIFTS.find((shift) => shift.code === code)
  // Unreachable while `RosterShiftCode` and the table agree, and the table is
  // the thing that would drift. Throwing beats returning a shift nobody works.
  if (found === undefined) throw new Error(`No roster shift named ${code}`)
  return found
}
