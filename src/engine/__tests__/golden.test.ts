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
  OT_MEAL_ALLOWANCE,
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
    mealAllowancePerOccasion: OT_MEAL_ALLOWANCE,
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

  it('earns two meal allowances on the Saturday and none on the Wednesday', () => {
    // §4.5 predates the N36 work and names no allowance, so this is added
    // rather than reconciled. The Saturday pickup runs 09:00–19:00, through
    // both the 12:00–14:00 and the 18:00–19:00 windows; the Wednesday overrun
    // is 09:00–11:00, which reaches neither.
    const { occasions, total, ratePerOccasion } = result.mealAllowance
    expect(occasions.map((o) => [o.date, o.startMin, o.endMin])).toEqual([
      ['2026-08-15', 720, 840],
      ['2026-08-15', 1080, 1140],
    ])
    expect(ratePerOccasion).toBe(35.38)
    expect(cents(total)).toBe(70.76)
  })

  it('adds the allowance after tax, not before it', () => {
    // The whole point of the N36 line: PAYG is withheld on $6,018.66 either
    // way, so the allowance reaches take-home undiminished.
    expect(cents(result.withOt.taxableGross)).toBe(6018.66)
    expect(result.withOt.payg).toBe(1620)
    expect(cents(result.netTotal)).toBe(4469.42)
    expect(cents(result.netTotal - result.withOt.net)).toBe(70.76)
  })

  it('reports the overtime as worth $769.09 once the allowance is counted', () => {
    // $698.33 of taxed overtime plus $70.76 untaxed. Retention rises because a
    // tax-free dollar is kept whole — 62.9% on the pay alone, 65.1% with it.
    expect(cents(result.otEarnedTotal)).toBe(1181.09)
    expect(cents(result.otNetTotal)).toBe(769.09)
    expect(Math.round((result.otNetTotal / result.otEarnedTotal) * 1000) / 10).toBe(65.1)
  })

  it('withholds no HELP when there is no study debt', () => {
    expect(result.withOt.help).toBe(0)
    expect(result.withOt.preTaxDeductions).toBe(0)
  })

  it('raises no flags', () => {
    expect(result.flags).toEqual([])
  })
})
