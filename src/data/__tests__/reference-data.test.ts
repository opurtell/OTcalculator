import { describe, expect, it } from 'vitest'
import { financialYearFor } from '../../engine/calendar'
import {
  ACT_HOLIDAY_CALENDAR,
  ACT_PUBLIC_HOLIDAYS,
  CLASSIFICATION_LABEL,
  COVERS_THROUGH,
  OT_MEAL_ALLOWANCE_RATES,
  PACKAGING_CAPS,
  PAY_BANDS,
  RATES_EFFECTIVE_FROM,
  holidayNameFor,
  otMealAllowanceFor,
  payBandFor,
  stepsFor,
} from '..'
import { fallbackCaption, taxScaleFor } from '../tax-scales'
import { helpScheduleFor } from '../help-thresholds'

describe('pay bands', () => {
  it('carries the golden fixture band verbatim from Annex A', () => {
    expect(payBandFor('AP1', 2)).toEqual({
      classification: 'AP1',
      step: 2,
      annualBase: 95_698,
      annexATotal: 125_920,
    })
  })

  it('covers the four paramedic classifications and their steps', () => {
    expect(stepsFor('AP1')).toEqual([1, 2, 3, 4])
    expect(stepsFor('AP2')).toEqual([1, 2, 3])
    expect(stepsFor('ICP1')).toEqual([1, 2, 3, 4])
    expect(stepsFor('ICP2')).toEqual([1, 2, 3])
    expect(PAY_BANDS).toHaveLength(14)
  })

  it('excludes Ambulance Manager, which has no published Annex A total', () => {
    expect(PAY_BANDS.some((b) => b.classification.startsWith('AM'))).toBe(false)
    expect(Object.keys(CLASSIFICATION_LABEL)).toEqual(['AP1', 'AP2', 'ICP1', 'ICP2'])
  })

  it('keeps every composite total near base × 1.3158 without recomputing it', () => {
    // §3.1: use the published totals verbatim; the EBA rounds to whole dollars
    // so recomputation drifts. This checks the transcription is sane, not that
    // the totals are derived.
    for (const band of PAY_BANDS) {
      const ratio = band.annexATotal / band.annualBase
      expect(ratio).toBeGreaterThan(1.31)
      expect(ratio).toBeLessThan(1.32)
    }
  })

  it('never lets a total masquerade as a base', () => {
    // The §3.2 trap, guarded at the data layer as well as the engine.
    for (const band of PAY_BANDS) {
      expect(band.annualBase).toBeLessThan(band.annexATotal)
    }
  })

  it('returns undefined for a band that does not exist', () => {
    // Stale localStorage can name a step that has since gone.
    expect(payBandFor('AP2', 4)).toBeUndefined()
    expect(payBandFor('AM1', 1)).toBeUndefined()
  })
})

describe('public holidays', () => {
  it('observes Boxing Day 2026 on the Monday, not the Saturday', () => {
    // 26 December 2026 is a Saturday. Treating it as a public holiday would
    // pay 2.5× for a day that is actually 2×.
    expect(ACT_HOLIDAY_CALENDAR.dates.has('2026-12-26')).toBe(false)
    expect(ACT_HOLIDAY_CALENDAR.dates.has('2026-12-28')).toBe(true)
    expect(holidayNameFor('2026-12-28')).toBe('Boxing Day (observed)')
  })

  it('knows Canberra Day 2026', () => {
    expect(holidayNameFor('2026-03-09')).toBe('Canberra Day')
  })

  it('stops at the last published holiday rather than the end of the year', () => {
    expect(COVERS_THROUGH).toBe('2027-06-14')
    expect(ACT_HOLIDAY_CALENDAR.coversThrough).toBe(COVERS_THROUGH)
    // Nothing may be listed past the horizon, or the horizon is wrong.
    for (const holiday of ACT_PUBLIC_HOLIDAYS) {
      expect(holiday.date <= COVERS_THROUGH).toBe(true)
    }
  })

  it('holds no duplicate dates', () => {
    expect(ACT_HOLIDAY_CALENDAR.dates.size).toBe(ACT_PUBLIC_HOLIDAYS.length)
  })

  it('is sorted, so the last entry really is the horizon', () => {
    const dates = ACT_PUBLIC_HOLIDAYS.map((h) => h.date)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('tax scales', () => {
  it('serves FY2026-27 directly', () => {
    const selection = taxScaleFor('2026-27', 2)
    expect(selection.isFallback).toBe(false)
    expect(selection.scale.brackets).toHaveLength(9)
    expect(fallbackCaption(selection)).toBeNull()
  })

  /**
   * The coefficients arrived from the sibling repo labelled FY2025-26 and are
   * FY2026-27's. These four cells are what tells the two years apart: the
   * second bracket is 15% from $538 in FY2026-27 and 16% from $500 in the
   * FY2024-25 edition that preceded it. If a future transcription ever puts a
   * 16% row under a 2026-27 key, this is the test that catches it.
   */
  it('holds Scale 2 at the FY2026-27 second bracket, not its predecessor', () => {
    const second = taxScaleFor('2026-27', 2).scale.brackets[1]
    expect(second.threshold).toBe(538)
    expect(second.rate).toBe(0.15)
    expect(taxScaleFor('2026-27', 2).scale.brackets[2].threshold).toBe(673)
  })

  it('falls back to FY2026-27 for an unpublished year, and says so', () => {
    const selection = taxScaleFor('2027-28', 2)
    expect(selection.isFallback).toBe(true)
    expect(selection.scale.financialYear).toBe('2026-27')
    expect(fallbackCaption(selection)).toBe(
      'Using 2026–27 tax rates — 2027–28 schedule not yet published.',
    )
  })

  it('words the fallback differently for a year older than the data', () => {
    // FY2025-26 was never sourced. "Not yet published" would describe the
    // app's own gap as the ATO's delay, about a schedule that has been and
    // gone.
    const selection = taxScaleFor('2025-26', 2)
    expect(selection.isFallback).toBe(true)
    expect(fallbackCaption(selection)).toBe(
      'Using 2026–27 tax rates — no 2025–26 schedule is held.',
    )
  })

  it('has ascending thresholds and an open top row on both scales', () => {
    for (const scale of [1, 2] as const) {
      const { brackets } = taxScaleFor('2026-27', scale).scale
      const thresholds = brackets.map((b) => b.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
      expect(thresholds[thresholds.length - 1]).toBe(Infinity)
    }
  })

  it('starts Scale 2 at zero withholding and Scale 1 above it', () => {
    // Scale 2 claims the tax-free threshold, so the first row withholds
    // nothing. Scale 1 does not, so it withholds from the first dollar.
    expect(taxScaleFor('2026-27', 2).scale.brackets[0].rate).toBe(0)
    expect(taxScaleFor('2026-27', 1).scale.brackets[0].rate).toBeGreaterThan(0)
  })

  /**
   * Reproduces the §4.5 golden PAYG figures from the ported coefficients,
   * applying NAT 1004 by hand. The engine's own implementation is Phase 3 —
   * this checks the *data*, so a transcription slip cannot hide behind a
   * matching bug in `tax.ts` later.
   */
  it('reproduces the golden fixture PAYG under the NAT 1004 method', () => {
    const withhold = (fortnightlyGross: number) => {
      const weekly = Math.floor(fortnightlyGross / 2)
      const x = weekly + 0.99
      const { brackets } = taxScaleFor('2026-27', 2).scale
      const row = brackets.find((b) => weekly < b.threshold)!
      return Math.max(0, Math.round(row.rate * x - row.base)) * 2
    }

    expect(withhold(4908.32)).toBe(1208)
    expect(withhold(6018.66)).toBe(1620)
    expect(withhold(0)).toBe(0)
  })

  /**
   * The ATO's own sample data, Sheet 5 of the workbook the coefficients came
   * from. Checking the figures against the source's worked examples is the one
   * test the transcription cannot pass by being self-consistent.
   */
  it('matches the ATO sample data for both scales', () => {
    const weekly = (earnings: number, scale: 1 | 2) => {
      const { brackets } = taxScaleFor('2026-27', scale).scale
      const row = brackets.find((b) => earnings < b.threshold)!
      return Math.round(row.rate * (earnings + 0.99) - row.base)
    }

    // [weekly earnings, Scale 1, Scale 2] — NAT_1004.xlsx, "Sample Data".
    const samples: readonly (readonly [number, number, number])[] = [
      [361, 64, 0],
      [362, 65, 0],
      [537, 99, 26],
      [538, 100, 27],
      [673, 143, 60],
      [865, 205, 94],
      [1282, 339, 229],
      [2596, 784, 649],
      [3653, 1224, 1062],
    ]

    for (const [earnings, scale1, scale2] of samples) {
      expect([earnings, weekly(earnings, 1)]).toEqual([earnings, scale1])
      expect([earnings, weekly(earnings, 2)]).toEqual([earnings, scale2])
    }
  })
})

describe('HELP thresholds', () => {
  it('serves both published years directly and falls back beyond them', () => {
    expect(helpScheduleFor('2026-27').isFallback).toBe(false)
    expect(helpScheduleFor('2025-26').isFallback).toBe(false)
    const fallback = helpScheduleFor('2027-28')
    expect(fallback.isFallback).toBe(true)
    expect(fallback.schedule.financialYear).toBe('2026-27')
  })

  it('withholds nothing below the first threshold', () => {
    expect(helpScheduleFor('2026-27').schedule.brackets[0]).toMatchObject({
      rate: 0,
      incomeTo: 69_528,
    })
    expect(helpScheduleFor('2025-26').schedule.brackets[0]).toMatchObject({
      rate: 0,
      incomeTo: 67_000,
    })
  })

  /**
   * The indexation moved every boundary and the middle band's fixed component.
   * Charging FY2026-27 income against FY2025-26's boundaries takes a repayment
   * off someone earning between the two minimums, which is the case the
   * indexation exists to create.
   */
  it('indexes FY2026-27 above FY2025-26 at every boundary, structure unchanged', () => {
    const older = helpScheduleFor('2025-26').schedule.brackets
    const newer = helpScheduleFor('2026-27').schedule.brackets

    expect(newer.map((b) => [b.rate, b.basis])).toEqual(
      older.map((b) => [b.rate, b.basis]),
    )
    expect(newer.map((b) => b.incomeFrom)).toEqual([0, 69_528, 129_717, 186_050])
    expect(newer[2].base).toBe(9_028)
    for (let i = 1; i < newer.length; i += 1) {
      expect(newer[i].incomeFrom).toBeGreaterThan(older[i].incomeFrom)
    }
  })

  it('is contiguous, with an open top band', () => {
    for (const year of ['2025-26', '2026-27'] as const) {
      const { brackets } = helpScheduleFor(year).schedule
      for (let i = 1; i < brackets.length; i += 1) {
        expect(brackets[i].incomeFrom).toBe(brackets[i - 1].incomeTo)
      }
      expect(brackets[brackets.length - 1].incomeTo).toBeNull()
    }
  })

  /**
   * The ATO's own worked examples from the thresholds page the figures came
   * from — the equivalent of the sample-data check on the tax scales.
   */
  it("reproduces the ATO's FY2026-27 worked examples", () => {
    const { brackets } = helpScheduleFor('2026-27').schedule
    const repayment = (income: number) => {
      const row = brackets.find((b) => b.incomeTo === null || income < b.incomeTo)!
      return row.basis === 'total_income'
        ? income * row.rate
        : (row.base ?? 0) + (income - row.incomeFrom) * row.rate
    }

    // Christina: $86,380 of repayment income, 15c over $69,528.
    expect(repayment(86_380)).toBeCloseTo(2_527.8, 2)
    // Barry: $137,064, $9,028 plus 17c over $129,717.
    expect(repayment(137_064)).toBeCloseTo(10_276.99, 2)
  })
})

describe('overtime meal allowance', () => {
  it('carries the current Annex C figure — $35.38 per occasion', () => {
    // Annex C "Overtime Meal", Rate/Frequency "Per occasion", the 1.93% column
    // effective 04/12/2025. The same increase that produced the current Annex A
    // rates (C20.2.7), which is why this date matches `RATES_EFFECTIVE_FROM`.
    expect(otMealAllowanceFor('2026-08-15').amount).toBe(35.38)
    expect(otMealAllowanceFor('2026-08-15').effectiveFrom).toBe(RATES_EFFECTIVE_FROM)
  })

  it('prices a date by the rate that was in force then, not the latest', () => {
    // C20.2's increases apply from the first full pay period on or after each
    // date, so a fortnight worked before an increase keeps the older figure.
    expect(otMealAllowanceFor('2025-12-03').amount).toBe(34.71)
    expect(otMealAllowanceFor('2025-12-04').amount).toBe(35.38)
    expect(otMealAllowanceFor('2024-12-05').amount).toBe(34.37)
  })

  it('falls back to the earliest row rather than paying nothing', () => {
    expect(otMealAllowanceFor('2020-01-01').amount).toBe(31.6)
  })

  it('rises monotonically, in the order C20.2 lists the increases', () => {
    for (let i = 1; i < OT_MEAL_ALLOWANCE_RATES.length; i += 1) {
      const previous = OT_MEAL_ALLOWANCE_RATES[i - 1]
      const current = OT_MEAL_ALLOWANCE_RATES[i]
      expect(current.effectiveFrom > previous.effectiveFrom).toBe(true)
      expect(current.amount).toBeGreaterThan(previous.amount)
    }
    // Eight columns in Annex C: the rate at 9/6/22 plus C20.2's seven steps.
    expect(OT_MEAL_ALLOWANCE_RATES).toHaveLength(8)
  })

  it('matches the percentage increases C20.2 prescribes, compounded unrounded', () => {
    // The one checkable property of the transcription: Annex C prints rounded
    // dollars and C20.2 prints the percentages behind them, so a mistyped cent
    // shows up as a step that does not follow its own rule.
    //
    // **Each increase compounds on the previous *unrounded* figure, not on the
    // printed one.** Rounding at every step gives $33.06 where Annex C prints
    // $33.05, and the error carries forward. This matters to whoever adds the
    // next row: apply the percentage to the running figure below, then round
    // once, and check the result against Annex C rather than trusting it.
    const increases = [0.0179, 0.01, 0.0174, 0.015, 0.0244, 0.01, 0.0193]
    let exact = OT_MEAL_ALLOWANCE_RATES[0].amount

    increases.forEach((rate, i) => {
      exact *= 1 + rate
      expect(OT_MEAL_ALLOWANCE_RATES[i + 1].amount).toBe(
        Math.round(exact * 100) / 100,
      )
    })
  })
})

describe('packaging caps', () => {
  it('carries the public-health FBT-exempt caps', () => {
    expect(PACKAGING_CAPS.livingExpensesCap).toBe(9_010)
    expect(PACKAGING_CAPS.mealEntertainmentCap).toBe(2_650)
    expect(PACKAGING_CAPS.grossUpFactor).toBeCloseTo(1.8868, 4)
  })
})

describe('financialYearFor', () => {
  it.each([
    ['2026-06-30', '2025-26'],
    ['2026-07-01', '2026-27'],
    ['2026-08-08', '2026-27'],
    ['2027-01-01', '2026-27'],
  ])('%s is FY%s', (date, expected) => {
    expect(financialYearFor(date)).toBe(expected)
  })
})
