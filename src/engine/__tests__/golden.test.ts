/**
 * The golden fixture — `IMPLEMENTATION_PLAN.md` §4.5.
 *
 * AP1 Step 2, Scale 2, no study debt, no deductions. One Saturday 10-hour
 * pickup and one Wednesday 2-hour shift overrun.
 *
 * This is the acceptance test for the whole engine. Every figure in it is
 * computed from the EBA tables and the FY2025-26 coefficients, and has **not**
 * been verified against a real payslip. That is Phase 10, and it gates sharing
 * the app with anyone else.
 */

import { describe, expect, it } from 'vitest'
import { calculateOvertime } from '../attendance'
import { calculateFortnight } from '../fortnight'
import { NO_DEDUCTIONS } from '../packaging'
import { ordinaryFortnightlyGross } from '../tax'
import { taxScaleFor } from '../../data/tax-scales'
import {
  AP1_STEP_2,
  HOLIDAYS_2026,
  MEAL_SETTINGS,
  cents,
  shift,
} from './fixtures'

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
    // §3.13 says to carry full precision and round only at display. Doing that
    // gives 1110.3349…, which displays as $1,110.33. The §4.5 headline of
    // $1,110.34 is the sum of the two *already-rounded* line items
    // (965.51 + 144.83), which is a different rule applied one step earlier.
    //
    // Both line items are exact, so the disagreement is purely about where
    // rounding happens. Which one payroll actually does is a Phase 10 question
    // — if a real payslip sums rounded lines, §3.13 needs an exception for
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

describe('golden fixture — the whole fortnight', () => {
  const result = calculateFortnight([SATURDAY_PICKUP, WEDNESDAY_OVERRUN], {
    band: AP1_STEP_2,
    taxScale: taxScaleFor('2025-26', 2).scale,
    helpSchedule: null,
    deductions: NO_DEDUCTIONS,
    holidays: HOLIDAYS_2026,
    meals: MEAL_SETTINGS,
  })

  it('derives ordinary fortnightly gross of $4,908.32', () => {
    // (Annex A total + 2.20% roster adjustment) × 12/313.
    expect(cents(result.ordinaryGross)).toBe(4908.32)
    expect(cents(ordinaryFortnightlyGross(AP1_STEP_2))).toBe(4908.32)
  })

  it('grosses $4,908.32 without overtime and $6,018.66 with', () => {
    expect(cents(result.withoutOt.gross)).toBe(4908.32)
    expect(cents(result.withOt.gross)).toBe(6018.66)
  })

  it('withholds $1,208 without overtime and $1,620 with', () => {
    // NAT 1004 rounds at the weekly step, so both land on whole dollars.
    expect(result.withoutOt.payg).toBe(1208)
    expect(result.withOt.payg).toBe(1620)
  })

  it('nets $3,700.32 without overtime and $4,398.66 with', () => {
    expect(cents(result.withoutOt.net)).toBe(3700.32)
    expect(cents(result.withOt.net)).toBe(4398.66)
  })

  it('turns $1,110.33 of overtime into $698.33 of take-home, 62.9% kept', () => {
    // §4.5 prints $1,110.34 → $698.34. Both are a cent higher because the plan
    // sums already-rounded line items; §3.13 says full precision until display.
    // Oscar has accepted the divergence — see the note in the overtime block.
    expect(cents(result.otGrossDelta)).toBe(1110.33)
    expect(cents(result.otNetDelta)).toBe(698.33)
    expect(Math.round(result.retention * 1000) / 10).toBe(62.9)
  })

  it('earns no meal allowance — neither shift is past a rostered end', () => {
    // §4.5's figures are untouched by N36, and that is the answer rather than an
    // omission. The Saturday is a 09:00–19:00 pickup: it matches the D shift's
    // start but knocks off two hours before its 21:00 end, so there is no
    // overtime "after the end of ordinary duty for the day" (N36.2). The
    // Wednesday overrun starts at 09:00, which is no roster shift's end, so the
    // boundary cannot be placed at all and the calculation is skipped.
    expect(result.mealAllowance.occasions).toEqual([])
    expect(result.mealAllowance.total).toBe(0)
    expect(result.mealAllowance.ratePerOccasion).toBe(35.38)
  })

  it('leaves the tax-free totals equal to the taxed ones when none is earned', () => {
    expect(cents(result.netTotal)).toBe(4398.66)
    expect(cents(result.otEarnedTotal)).toBe(1110.33)
    expect(cents(result.otNetTotal)).toBe(698.33)
  })

  it('withholds no HELP when there is no study debt', () => {
    expect(result.withOt.help).toBe(0)
    expect(result.withOt.preTaxDeductions).toBe(0)
  })

  it('raises no flags', () => {
    expect(result.flags).toEqual([])
  })
})

/**
 * The allowance case, since the §4.5 pair does not reach it.
 *
 * An AM shift picked up and entered as one period that ran an hour and a half
 * over — Oscar's example. Same band and settings as above, so the only thing
 * that differs is the shift, and the untaxed line can be read against the taxed
 * ones without a second variable.
 */
describe('a fortnight that does earn the meal allowance', () => {
  const AM_RUN_ON = shift('2026-08-19', '06:30', '18:00', 'separate')

  const result = calculateFortnight([AM_RUN_ON], {
    band: AP1_STEP_2,
    taxScale: taxScaleFor('2025-26', 2).scale,
    helpSchedule: null,
    deductions: NO_DEDUCTIONS,
    holidays: HOLIDAYS_2026,
    meals: MEAL_SETTINGS,
  })

  it('earns one occasion at $35.38', () => {
    // A 10-hour AM shift taken to 11.5 hours: an hour and a half over, so a
    // second meal break is owed. One allowance, however far over it ran.
    const { occasions, total } = result.mealAllowance
    expect(occasions).toHaveLength(1)
    expect(occasions[0].rosterCode).toBe('AM')
    expect(occasions[0].rosteredMinutes).toBe(600)
    expect(occasions[0].overrunMinutes).toBe(90)
    // Entered whole, so nothing about the shift was inferred.
    expect(occasions[0].shiftInferred).toBe(false)
    expect(cents(total)).toBe(35.38)
  })

  it('withholds nothing on it — the tax figures ignore the allowance', () => {
    // The one property that must hold whatever the occasion count turns out to
    // be: PAYG is computed on gross alone, so the allowance arrives whole.
    expect(cents(result.withOt.taxableGross)).toBe(cents(result.withOt.gross))
    expect(cents(result.netTotal - result.withOt.net)).toBe(35.38)
    expect(cents(result.otNetTotal - result.otNetDelta)).toBe(35.38)
    expect(cents(result.otEarnedTotal - result.otGrossDelta)).toBe(35.38)
  })

  it('keeps more of the overtime than the taxed pay alone would', () => {
    // A tax-free dollar is kept whole, so retention has to rise once it is in.
    expect(result.otNetTotal / result.otEarnedTotal).toBeGreaterThan(
      result.otNetDelta / result.otGrossDelta,
    )
  })

  it('earns nothing from the same shift worked to its rostered end', () => {
    // The control: 06:30–16:30 is the same pickup without the run-on, and it is
    // the case Oscar said should pay no allowance — break or no break.
    const onTime = calculateFortnight([shift('2026-08-19', '06:30', '16:30', 'separate')], {
      band: AP1_STEP_2,
      taxScale: taxScaleFor('2025-26', 2).scale,
      helpSchedule: null,
      deductions: NO_DEDUCTIONS,
      holidays: HOLIDAYS_2026,
      meals: MEAL_SETTINGS,
    })
    expect(onTime.mealAllowance.total).toBe(0)
  })
})
