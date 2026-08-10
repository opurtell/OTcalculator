/**
 * Test fixtures.
 *
 * The engine holds no reference data, so every test supplies its own. These are
 * the §4.5 golden figures plus a deliberately small holiday calendar — enough
 * to exercise the rules without waiting on Phase 1.
 */

import { otMealAllowanceFor } from '../../data/allowances'
import { ACT_HOLIDAY_CALENDAR } from '../../data/public-holidays'
import type { HolidayCalendar, OtShift, PayBand, ShiftKind } from '../types'

/**
 * AP1 Step 2 from `IMPLEMENTATION_PLAN.md` §4.5.
 *
 * `annexATotal` is here so tests can prove the engine never touches it: OT runs
 * on `annualBase` under EBA N34.1, and the gap between the two is 34%.
 */
export const AP1_STEP_2: PayBand = {
  classification: 'AP1',
  step: 2,
  annualBase: 95_698,
  annexATotal: 125_920,
}

/**
 * The real ACT calendar from `src/data/`.
 *
 * Engine tests run against the shipped data rather than a hand-written stand-in
 * — a fixture that invents a holiday proves the engine agrees with the fixture
 * and nothing more. An earlier version of this file listed 26 December 2026 as
 * Boxing Day; it is a Saturday, and the holiday is observed on the 28th.
 *
 * `coversThrough` matters as much as the dates: past it the engine must warn
 * rather than quietly pay a weekday rate.
 */
export const HOLIDAYS_2026: HolidayCalendar = ACT_HOLIDAY_CALENDAR

/**
 * The Annex C overtime meal allowance in force on the fixture dates — $35.38
 * per occasion from 4 December 2025 (EBA N36.1).
 *
 * Taken from `src/data/allowances.ts` rather than written out, on the same
 * principle as the holiday calendar above: a fixture that invents a rate proves
 * only that the engine agrees with the fixture.
 */
export const OT_MEAL_ALLOWANCE = otMealAllowanceFor('2026-08-15').amount

/** No public holidays at all — isolates the weekday and weekend rules. */
export const NO_HOLIDAYS: HolidayCalendar = {
  dates: new Set<string>(),
  coversThrough: '2026-12-31',
}

let nextId = 0

/**
 * Build a shift from `'HH:MM'` strings. `end` before `start` means it runs past
 * midnight, which is inferred here so the tests read like a roster rather than
 * like a struct literal.
 */
export function shift(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind = 'separate',
): OtShift {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }
  const startMin = toMinutes(start)
  const endMin = toMinutes(end)

  nextId += 1
  return {
    id: `shift-${nextId}`,
    date,
    startMin,
    endMin,
    endsNextDay: endMin <= startMin,
    kind,
  }
}

/** Round to cents the way the display layer will, for readable assertions. */
export function cents(value: number): number {
  return Math.round(value * 100) / 100
}
