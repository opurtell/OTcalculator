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
  it('serves FY2025-26 directly', () => {
    const selection = taxScaleFor('2025-26', 2)
    expect(selection.isFallback).toBe(false)
    expect(selection.scale.brackets).toHaveLength(9)
    expect(fallbackCaption(selection)).toBeNull()
  })

  it('falls back to FY2025-26 for an unpublished year, and says so', () => {
    const selection = taxScaleFor('2026-27', 2)
    expect(selection.isFallback).toBe(true)
    expect(selection.scale.financialYear).toBe('2025-26')
    expect(fallbackCaption(selection)).toBe(
      'Using 2025–26 tax rates — 2026–27 schedule not yet published.',
    )
  })

  it('has ascending thresholds and an open top row on both scales', () => {
    for (const scale of [1, 2] as const) {
      const { brackets } = taxScaleFor('2025-26', scale).scale
      const thresholds = brackets.map((b) => b.threshold)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
      expect(thresholds[thresholds.length - 1]).toBe(Infinity)
    }
  })

  it('starts Scale 2 at zero withholding and Scale 1 above it', () => {
    // Scale 2 claims the tax-free threshold, so the first row withholds
    // nothing. Scale 1 does not, so it withholds from the first dollar.
    expect(taxScaleFor('2025-26', 2).scale.brackets[0].rate).toBe(0)
    expect(taxScaleFor('2025-26', 1).scale.brackets[0].rate).toBeGreaterThan(0)
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
      const { brackets } = taxScaleFor('2025-26', 2).scale
      const row = brackets.find((b) => weekly < b.threshold)!
      return Math.max(0, Math.round(row.rate * x - row.base)) * 2
    }

    expect(withhold(4908.32)).toBe(1208)
    expect(withhold(6018.66)).toBe(1620)
    expect(withhold(0)).toBe(0)
  })
})

describe('HELP thresholds', () => {
  it('serves FY2025-26 and falls back beyond it', () => {
    expect(helpScheduleFor('2025-26').isFallback).toBe(false)
    const fallback = helpScheduleFor('2026-27')
    expect(fallback.isFallback).toBe(true)
    expect(fallback.schedule.financialYear).toBe('2025-26')
  })

  it('withholds nothing below the first threshold', () => {
    const first = helpScheduleFor('2025-26').schedule.brackets[0]
    expect(first.rate).toBe(0)
    expect(first.incomeTo).toBe(67_000)
  })

  it('is contiguous, with an open top band', () => {
    const { brackets } = helpScheduleFor('2025-26').schedule
    for (let i = 1; i < brackets.length; i += 1) {
      expect(brackets[i].incomeFrom).toBe(brackets[i - 1].incomeTo)
    }
    expect(brackets[brackets.length - 1].incomeTo).toBeNull()
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
