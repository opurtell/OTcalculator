import { describe, expect, it } from 'vitest'
import { calculateFortnight } from '../fortnight'
import {
  NO_ADVANCED_DEDUCTIONS,
  NO_DEDUCTIONS,
  advancedBreakdown,
  advancedDeductionSettings,
  computeDeductions,
  packagingFlags,
  spendableTotal,
} from '../packaging'
import type { AdvancedDeductions } from '../packaging'
import { helpRepayment, ordinaryFortnightlyGross, paygWithholding } from '../tax'
import { helpScheduleFor } from '../../data/help-thresholds'
import { taxScaleFor } from '../../data/tax-scales'
import {
  AP1_STEP_2,
  HOLIDAYS_2026,
  MEAL_SETTINGS,
  cents,
  shift,
} from './fixtures'

const SCALE_2 = taxScaleFor('2025-26', 2).scale
const SCALE_1 = taxScaleFor('2025-26', 1).scale
const HELP = helpScheduleFor('2025-26').schedule

const baseSettings = {
  band: AP1_STEP_2,
  taxScale: SCALE_2,
  helpSchedule: null,
  deductions: NO_DEDUCTIONS,
  holidays: HOLIDAYS_2026,
  meals: MEAL_SETTINGS,
}

describe('paygWithholding', () => {
  it('withholds nothing at or below zero', () => {
    expect(paygWithholding(0, SCALE_2)).toBe(0)
    expect(paygWithholding(-100, SCALE_2)).toBe(0)
  })

  it('withholds nothing under the tax-free threshold on Scale 2', () => {
    // First row runs to $362/week, so a fortnight under $724 withholds nothing.
    expect(paygWithholding(700, SCALE_2)).toBe(0)
  })

  it('withholds from the first dollar on Scale 1', () => {
    // No tax-free threshold claimed, so the same fortnight is taxed.
    expect(paygWithholding(700, SCALE_1)).toBeGreaterThan(0)
  })

  it('always returns an even number of dollars', () => {
    // The weekly figure is rounded then doubled, so a fortnight can never
    // withhold an odd amount or a fraction of a dollar.
    for (const gross of [1000, 2500, 4908.32, 6018.66, 9000, 20_000]) {
      const withheld = paygWithholding(gross, SCALE_2)
      expect(Number.isInteger(withheld)).toBe(true)
      expect(withheld % 2).toBe(0)
    }
  })

  it('is monotonic across bracket boundaries', () => {
    // Guards against a mis-transcribed coefficient: withholding must never
    // fall as earnings rise, even where the schedule changes row.
    let previous = -1
    for (let weekly = 0; weekly <= 4000; weekly += 1) {
      const withheld = paygWithholding(weekly * 2, SCALE_2)
      expect(withheld).toBeGreaterThanOrEqual(previous)
      previous = withheld
    }
  })

  it('selects the row by weekly earnings, exclusive of the threshold', () => {
    // At exactly $538/week the second row no longer applies; the third does.
    const atBoundary = paygWithholding(538 * 2, SCALE_2)
    const justUnder = paygWithholding(537 * 2, SCALE_2)
    expect(atBoundary).toBeGreaterThan(justUnder)
  })

  it('throws rather than guessing if a scale has no open top row', () => {
    const truncated = {
      ...SCALE_2,
      brackets: [{ threshold: 100, rate: 0.1, base: 0 }],
    }
    expect(() => paygWithholding(10_000, truncated)).toThrow(/No NAT 1004 bracket/)
  })
})

describe('helpRepayment', () => {
  it('repays nothing below the first threshold', () => {
    // $67,000 a year is about $2,568 a fortnight.
    expect(helpRepayment(2000, HELP)).toBe(0)
    expect(helpRepayment(0, HELP)).toBe(0)
  })

  it('charges only the amount over the threshold in the second band', () => {
    // $100,000 a year → 15% of $33,000 = $4,950, over 26.0833 fortnights.
    const fortnightly = 100_000 / (313 / 12)
    expect(cents(helpRepayment(fortnightly, HELP) * (313 / 12))).toBeCloseTo(4950, 1)
  })

  it('is continuous across the band boundaries', () => {
    // The bands are defined on different bases, so a discontinuity here would
    // mean a dollar of extra income costing hundreds in repayment.
    for (const annual of [67_000, 125_000, 179_285]) {
      const below = helpRepayment((annual - 1) / (313 / 12), HELP)
      const above = helpRepayment((annual + 1) / (313 / 12), HELP)
      expect(Math.abs(above - below)).toBeLessThan(1)
    }
  })

  it('rises with income', () => {
    let previous = -1
    for (let annual = 0; annual <= 250_000; annual += 5_000) {
      const repayment = helpRepayment(annual / (313 / 12), HELP)
      expect(repayment).toBeGreaterThanOrEqual(previous)
      previous = repayment
    }
  })
})

describe('ordinaryFortnightlyGross', () => {
  it('uses the published composite plus the roster adjustment', () => {
    expect(cents(ordinaryFortnightlyGross(AP1_STEP_2))).toBe(4908.32)
  })

  it('divides by 313/12, not by 26', () => {
    const naive = (AP1_STEP_2.annexATotal + AP1_STEP_2.annualBase * 0.022) / 26
    expect(cents(ordinaryFortnightlyGross(AP1_STEP_2))).not.toBe(cents(naive))
  })
})

describe('computeDeductions', () => {
  it('handles fixed only, percent only, and both', () => {
    expect(computeDeductions(5000, { fixedPerFortnight: 400, percentOfGross: 0 })).toEqual(
      { fixed: 400, percent: 0, total: 400 },
    )
    expect(computeDeductions(5000, { fixedPerFortnight: 0, percentOfGross: 0.1 })).toEqual(
      { fixed: 0, percent: 500, total: 500 },
    )
    expect(
      computeDeductions(5000, { fixedPerFortnight: 400, percentOfGross: 0.1 }),
    ).toEqual({ fixed: 400, percent: 500, total: 900 })
  })

  it('never lets deductions push taxable gross below zero', () => {
    const result = computeDeductions(1000, {
      fixedPerFortnight: 5000,
      percentOfGross: 0,
    })
    expect(result.total).toBe(1000)
  })

  it('ignores negative settings rather than paying the user', () => {
    const result = computeDeductions(5000, {
      fixedPerFortnight: -400,
      percentOfGross: -0.1,
    })
    expect(result.total).toBe(0)
  })
})

describe('advanced deductions', () => {
  /** Super as a percentage, plus all three value-only categories. */
  const SPLIT: AdvancedDeductions = {
    ...NO_ADVANCED_DEDUCTIONS,
    superPercentOfGross: 0.05,
    livingExpenses: 800,
    mealsAndEntertainment: 100,
    unionFees: 30,
  }

  it('collapses to the two knobs the tax calculation already took', () => {
    // The whole design: advanced mode is a different set of questions, not a
    // different sum. Nothing in the withholding path had to learn about it.
    expect(advancedDeductionSettings(SPLIT)).toEqual({
      fixedPerFortnight: 930,
      percentOfGross: 0.05,
    })
  })

  it('puts a dollar super contribution in the fixed amount instead', () => {
    expect(
      advancedDeductionSettings({
        ...NO_ADVANCED_DEDUCTIONS,
        superPerFortnight: 400,
        unionFees: 30,
      }),
    ).toEqual({ fixedPerFortnight: 430, percentOfGross: 0 })
  })

  it('takes the super percentage on the whole gross, before anything else', () => {
    // The rule Oscar asked for, and the one the single percentage field has
    // always followed: overtime included, and not on gross-less-deductions.
    const breakdown = advancedBreakdown(5000, SPLIT)
    expect(breakdown.superannuation).toBe(250)
    expect(breakdown.livingExpenses).toBe(800)
    expect(breakdown.mealsAndEntertainment).toBe(100)
    expect(breakdown.unionFees).toBe(30)
    expect(breakdown.total).toBe(1180)
    expect(breakdown.capped).toBe(false)
  })

  it('agrees with the tax calculation about the total, always', () => {
    // The failure this rules out is the app contradicting itself on screen:
    // a breakdown whose lines sum to something other than the amount actually
    // taken off before tax.
    for (const gross of [0, 500, 1180, 4908.32, 6018.66]) {
      expect(advancedBreakdown(gross, SPLIT).total).toBeCloseTo(
        computeDeductions(gross, advancedDeductionSettings(SPLIT)).total,
        10,
      )
    }
  })

  it('scales every category by the same factor when gross runs out', () => {
    // $1,000 asked for against $500 of pay. No category is paid in full first
    // — privileging one over another would be an invented rule.
    const breakdown = advancedBreakdown(500, {
      ...NO_ADVANCED_DEDUCTIONS,
      superPerFortnight: 600,
      livingExpenses: 400,
    })

    expect(breakdown.requested).toBe(1000)
    expect(breakdown.total).toBe(500)
    expect(breakdown.capped).toBe(true)
    expect(breakdown.superannuation).toBe(300)
    expect(breakdown.livingExpenses).toBe(200)
  })

  it('ignores negative categories rather than letting one cancel another', () => {
    const breakdown = advancedBreakdown(5000, {
      ...NO_ADVANCED_DEDUCTIONS,
      superPerFortnight: 400,
      livingExpenses: -1000,
    })

    expect(breakdown.total).toBe(400)
    expect(breakdown.livingExpenses).toBe(0)
  })

  it('counts only the two categories that come back as spendable', () => {
    // Super is locked away and union fees are already spent. Counting either
    // would overstate the answer by the amount most plainly not available.
    const breakdown = advancedBreakdown(5000, SPLIT)
    expect(spendableTotal(3700.32, breakdown)).toBeCloseTo(4600.32, 2)
  })

  it('leaves take-home alone when nothing is packaged back', () => {
    const breakdown = advancedBreakdown(5000, {
      ...NO_ADVANCED_DEDUCTIONS,
      superPercentOfGross: 0.1,
      unionFees: 30,
    })
    expect(spendableTotal(3700.32, breakdown)).toBe(3700.32)
  })
})

describe('packagingFlags', () => {
  it('warns about the packaging and study-debt interaction', () => {
    const deductions = computeDeductions(5000, {
      fixedPerFortnight: 100,
      percentOfGross: 0,
    })
    expect(packagingFlags(deductions, true)).toContainEqual({
      kind: 'packaging-help-interaction',
    })
    expect(packagingFlags(deductions, false)).toEqual([])
  })

  it('does not raise the interaction warning when nothing is packaged', () => {
    const nothing = computeDeductions(5000, NO_DEDUCTIONS)
    expect(packagingFlags(nothing, true)).toEqual([])
  })

  /*
   * No FBT-cap warning, deliberately. The one "pre-tax deductions" field takes
   * packaging and salary-sacrificed super alike; only the first counts towards
   * the $9,010 cap, and super is both the commonest entry and easily large
   * enough to trip it on its own. A cap warning would fire hardest on the case
   * where it is simply wrong, so the app does not guess what the money is for.
   */
  it('says nothing about a packaged amount well past the FBT cap', () => {
    // $9,010 a year is about $345 a fortnight; $900 is nearly triple it.
    const large = computeDeductions(5000, {
      fixedPerFortnight: 900,
      percentOfGross: 0,
    })
    expect(packagingFlags(large, false)).toEqual([])
  })
})

describe('calculateFortnight', () => {
  it('reports a zero delta when there is no overtime', () => {
    const result = calculateFortnight([], baseSettings)

    expect(result.overtimeGross).toBe(0)
    expect(result.otGrossDelta).toBe(0)
    expect(result.otNetDelta).toBe(0)
    expect(result.retention).toBe(0)
    expect(result.withOt).toEqual(result.withoutOt)
  })

  it('keeps the fixed deduction constant but recomputes the percentage one', () => {
    // §3.12: the two sides have to be internally consistent, and a percentage
    // deduction genuinely would have been smaller without the overtime.
    const result = calculateFortnight([shift('2026-08-15', '09:00', '19:00')], {
      ...baseSettings,
      deductions: { fixedPerFortnight: 200, percentOfGross: 0.05 },
    })

    expect(result.withoutOt.preTaxDeductions).toBe(200 + result.withoutOt.gross * 0.05)
    expect(result.withOt.preTaxDeductions).toBe(200 + result.withOt.gross * 0.05)
    expect(result.withOt.preTaxDeductions).toBeGreaterThan(
      result.withoutOt.preTaxDeductions,
    )
  })

  it('retains less than the full gross but more than none', () => {
    const result = calculateFortnight([shift('2026-08-15', '09:00', '19:00')], baseSettings)
    expect(result.retention).toBeGreaterThan(0.4)
    expect(result.retention).toBeLessThan(1)
  })

  it('reduces take-home when a study debt is present', () => {
    const withoutDebt = calculateFortnight([], baseSettings)
    const withDebt = calculateFortnight([], { ...baseSettings, helpSchedule: HELP })

    expect(withDebt.withOt.help).toBeGreaterThan(0)
    expect(withDebt.withOt.net).toBeLessThan(withoutDebt.withOt.net)
  })

  it('raises more take-home for more overtime', () => {
    // Property: net pay is monotonic in gross. If PAYG were applied wrongly at
    // a bracket edge this is where it would show.
    //
    // Overruns, not separate shifts: the C9.5 minimum pays 1h, 2h, 3h and 4h
    // identically, so a separate shift is deliberately *not* strictly
    // increasing over that range. See the test below.
    let previous = -Infinity
    for (let hours = 0; hours <= 10; hours += 1) {
      const shifts =
        hours === 0
          ? []
          : [
              shift(
                '2026-08-15',
                '09:00',
                `${String(9 + hours).padStart(2, '0')}:00`,
                'overrun',
              ),
            ]
      const result = calculateFortnight(shifts, baseSettings)
      expect(result.withOt.net).toBeGreaterThan(previous)
      previous = result.withOt.net
    }
  })

  it('pays a 1h, 2h, 3h and 4h separate shift exactly the same', () => {
    // The C9.5 minimum in its most visible form. Worth stating outright: a
    // paramedic called in for an hour is paid four, so the app must never
    // present that figure without the reason beside it.
    const nets = [1, 2, 3, 4].map((hours) =>
      cents(
        calculateFortnight(
          [
            shift(
              '2026-08-15',
              '09:00',
              `${String(9 + hours).padStart(2, '0')}:00`,
              'separate',
            ),
          ],
          baseSettings,
        ).withOt.net,
      ),
    )

    expect(new Set(nets).size).toBe(1)
  })

  it('honours an ordinary gross override', () => {
    const result = calculateFortnight([], {
      ...baseSettings,
      ordinaryGrossOverride: 5200,
    })
    expect(result.ordinaryGross).toBe(5200)
    expect(result.withoutOt.gross).toBe(5200)
  })

  it('carries overtime flags through alongside packaging ones', () => {
    const result = calculateFortnight([shift('2026-10-04', '00:00', '08:00')], {
      ...baseSettings,
      helpSchedule: HELP,
      deductions: { fixedPerFortnight: 500, percentOfGross: 0 },
    })

    expect(result.flags).toContainEqual(
      expect.objectContaining({ kind: 'dst-transition' }),
    )
    expect(result.flags).toContainEqual({ kind: 'packaging-help-interaction' })
  })
})
