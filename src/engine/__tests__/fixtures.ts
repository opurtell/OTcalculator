/**
 * Test fixtures.
 *
 * The engine holds no reference data, so every test supplies its own. These are
 * the §4.5 golden figures plus a deliberately small holiday calendar — enough
 * to exercise the rules without waiting on Phase 1.
 */

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
 * A minimal ACT calendar. Canberra Day 2026 is the second Monday in March,
 * which lands on the 9th — a Monday, so it doubles as the public-holiday →
 * weekday carry case.
 *
 * The real list arrives in Phase 1. `coversThrough` matters as much as the
 * dates: past it the engine must warn rather than quietly pay a weekday rate.
 */
export const HOLIDAYS_2026: HolidayCalendar = {
  dates: new Set(['2026-01-26', '2026-03-09', '2026-04-25', '2026-12-25', '2026-12-26']),
  coversThrough: '2026-12-31',
}

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
