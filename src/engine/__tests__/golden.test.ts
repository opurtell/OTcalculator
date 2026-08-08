/**
 * The golden fixture — `IMPLEMENTATION_PLAN.md` §4.5.
 *
 * AP1 Step 2, one Saturday 10-hour pickup and one Wednesday 2-hour shift
 * overrun. This file covers the overtime half; the PAYG, net and delta figures
 * join it in Phase 3.
 *
 * Every figure here is computed from the EBA tables and has **not** been
 * verified against a real payslip. That is Phase 10, and it gates sharing the
 * app with anyone else.
 */

import { describe, expect, it } from 'vitest'
import { calculateOvertime } from '../attendance'
import { AP1_STEP_2, HOLIDAYS_2026, cents, shift } from './fixtures'

// 15 August 2026 is a Saturday and 19 August 2026 a Wednesday. §4.5 names the
// days rather than the dates; these are the first pair in the fortnight the
// design previews already use.
const SATURDAY_PICKUP = shift('2026-08-15', '09:00', '19:00', 'separate')
const WEDNESDAY_OVERRUN = shift('2026-08-19', '09:00', '11:00', 'overrun')

describe('golden fixture — overtime', () => {
  const result = calculateOvertime(
    [SATURDAY_PICKUP, WEDNESDAY_OVERRUN],
    AP1_STEP_2,
    HOLIDAYS_2026,
  )
  const [saturday, wednesday] = result.attendances

  it('treats the two shifts as separate attendances', () => {
    expect(result.attendances).toHaveLength(2)
  })

  it('pays the Saturday pickup 10 hours at 2× — $965.51', () => {
    expect(saturday.categories).toEqual(['sat_2x'])
    expect(saturday.workedMinutes).toBe(600)
    expect(saturday.minimumApplied).toBe(false)
    expect(cents(saturday.pay)).toBe(965.51)
  })

  it('pays the Wednesday overrun 2 hours at 1.5× — $144.83', () => {
    expect(wednesday.categories).toEqual(['mf_1_5x'])
    expect(wednesday.workedMinutes).toBe(120)
    expect(cents(wednesday.pay)).toBe(144.83)
  })

  it('applies no four-hour minimum to the two-hour overrun', () => {
    // The overrun is the case Oscar flagged: the rostered shift was already
    // worked, so two hours pays two hours. Were this marked `separate` it
    // would pay four, and the fixture total would be $1,255.16.
    expect(wednesday.paidMinutes).toBe(120)
    expect(wednesday.topUpMinutes).toBe(0)
  })

  it('grosses $1,110.33 — one cent under the figure printed in §4.5', () => {
    // ⚠️ Known divergence, and it is the plan that is out rather than the code.
    //
    // §3.12 says to carry full precision and round only at display. Doing that
    // gives 1110.3349…, which displays as $1,110.33. The §4.5 headline of
    // $1,110.34 is the sum of the two *already-rounded* line items
    // (965.51 + 144.83), which is a different rule applied one step earlier.
    //
    // Both line items are exact, so the disagreement is purely about where
    // rounding happens. Which one payroll actually does is a Phase 10 question
    // — if a real payslip sums rounded lines, §3.12 needs an exception for
    // per-line overtime and this expectation changes to 1110.34.
    expect(cents(result.gross)).toBe(1110.33)
    expect(cents(saturday.pay) + cents(wednesday.pay)).toBe(1110.34)
  })

  it('never reaches for the Annex A composite', () => {
    // Guards the §3.2 trap directly: were `annexATotal` used, the gross would
    // be about 34% higher.
    const inflated = calculateOvertime(
      [SATURDAY_PICKUP, WEDNESDAY_OVERRUN],
      { ...AP1_STEP_2, annualBase: AP1_STEP_2.annexATotal },
      HOLIDAYS_2026,
    )
    expect(cents(inflated.gross)).toBeCloseTo(1460.99, 2)
    expect(result.gross).toBeLessThan(inflated.gross)
  })

  it('raises no flags for an ordinary fortnight', () => {
    expect(result.flags).toEqual([])
  })
})
