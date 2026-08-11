/**
 * The wiring, tested against the §4.5 golden fixture.
 *
 * The engine already has its own tests; what could break here is the join —
 * a band resolved to the wrong row, an override applied to the wrong figure,
 * Scale 1 handed out where Scale 2 was asked for. Each of those produces a
 * plausible-looking number, which is exactly why they are checked.
 */

import { describe, expect, it } from 'vitest'
import { calculateFortnight } from '../../engine/fortnight'
import {
  DEFAULT_CHOICES,
  isKnownBand,
  resolveSettings,
  todayIso,
} from '../settings'
import type { CalculatorChoices } from '../settings'

/** The golden fixture's band and settings: AP1 Step 2, Scale 2, nothing else. */
const GOLDEN: CalculatorChoices = {
  band: {
    classification: 'AP1',
    step: 2,
    annualBase: null,
    fortnightlyGross: null,
  },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'fortnight',
}

/** Inside FY2025-26, so no fallback caption is expected. */
const IN_FY_2025_26 = '2026-02-11'

function resolveGolden(overrides: Partial<CalculatorChoices> = {}) {
  const resolved = resolveSettings({ ...GOLDEN, ...overrides }, IN_FY_2025_26)
  if (resolved === null) throw new Error('AP1 Step 2 should resolve')
  return resolved
}

describe('resolveSettings', () => {
  it('prices the meal allowance from the pay date, not from today', () => {
    // The seam's job: `data/` knows the Annex C progression, the engine takes a
    // number. Pinning "current" here is what would stop an older fortnight
    // computing against the rate that was in force when it was worked.
    const { settings, mealAllowanceRate } = resolveGolden()
    expect(settings.meals.ratePerOccasion).toBe(35.38)
    expect(mealAllowanceRate.effectiveFrom).toBe('2025-12-04')

    const earlier = resolveSettings(GOLDEN, '2025-11-01')
    expect(earlier?.settings.meals.ratePerOccasion).toBe(34.71)
  })

  it('hands the engine the roster patterns N36.2 needs', () => {
    // Without them the engine cannot place "the end of ordinary duty for the
    // day" and works out no allowance at all, silently — so an empty list here
    // would remove a real figure with nothing on screen to say why.
    const { settings } = resolveGolden()
    expect(settings.meals.rosterShifts.map((s) => s.code)).toEqual([
      'AM',
      'D',
      'PM',
      'N',
    ])
  })

  it('resolves the golden band to its Annex A row', () => {
    const { tableBand, settings } = resolveGolden()

    // Base, not the composite. Getting these two the wrong way round
    // overstates every overtime figure by about 34% (EBA N34.1).
    expect(settings.band.annualBase).toBe(95_698)
    expect(tableBand.annexATotal).toBe(125_920)
  })

  it('reproduces the golden fortnight end to end', () => {
    const { settings } = resolveGolden()
    const result = calculateFortnight([], settings)

    expect(result.ordinaryGross).toBeCloseTo(4908.32, 2)
    expect(result.withOt.payg).toBe(1208)
    expect(result.withOt.net).toBeCloseTo(3700.32, 2)
  })

  it('selects Scale 1 when the tax-free threshold is not claimed', () => {
    const claimed = resolveGolden().settings.taxScale
    const notClaimed = resolveGolden({
      tax: { claimsTaxFreeThreshold: false, hasStudyDebt: false },
    }).settings.taxScale

    expect(claimed.scale).toBe(2)
    expect(notClaimed.scale).toBe(1)

    // Scale 1 withholds more on the same gross — the check that the selection
    // actually reached the calculation rather than merely being recorded.
    const withScale1 = calculateFortnight(
      [],
      resolveGolden({
        tax: { claimsTaxFreeThreshold: false, hasStudyDebt: false },
      }).settings,
    )
    expect(withScale1.withOt.payg).toBeGreaterThan(1208)
  })

  it('supplies a HELP schedule only when there is a study debt', () => {
    expect(resolveGolden().settings.helpSchedule).toBeNull()
    expect(
      resolveGolden({
        tax: { claimsTaxFreeThreshold: true, hasStudyDebt: true },
      }).settings.helpSchedule,
    ).not.toBeNull()
  })

  it('applies a base-salary override to the overtime rate, not to ordinary pay', () => {
    const { settings, derivedFortnightlyGross } = resolveGolden({
      band: { ...GOLDEN.band, annualBase: 100_000 },
    })

    expect(settings.band.annualBase).toBe(100_000)
    // The Annex A composite is untouched, so ordinary pay moves only by the
    // 2.2% roster adjustment that is calculated on base.
    expect(settings.band.annexATotal).toBe(125_920)
    expect(derivedFortnightlyGross).toBeGreaterThan(4908.32)
    expect(settings.ordinaryGrossOverride).toBeUndefined()
  })

  it('applies a fortnightly override to ordinary pay only', () => {
    const { settings } = resolveGolden({
      band: { ...GOLDEN.band, fortnightlyGross: 5000 },
    })

    expect(settings.ordinaryGrossOverride).toBe(5000)
    expect(settings.band.annualBase).toBe(95_698)
    expect(calculateFortnight([], settings).ordinaryGross).toBe(5000)
  })

  it('returns null rather than guessing when the band is unknown', () => {
    // ICP2 stops at Step 3. A stored Step 9 is a preference that outlived its
    // pay table, and showing someone else's pay would be worse than asking.
    expect(
      resolveSettings(
        { ...GOLDEN, band: { ...GOLDEN.band, classification: 'ICP2', step: 9 } },
        IN_FY_2025_26,
      ),
    ).toBeNull()
    expect(
      resolveSettings(
        { ...GOLDEN, band: { ...GOLDEN.band, classification: 'AM1', step: 1 } },
        IN_FY_2025_26,
      ),
    ).toBeNull()
  })

  it('captions nothing in the year the coefficients are verified for', () => {
    expect(resolveGolden().captions).toEqual([])
  })

  it('captions the fallback once the financial year runs past the data', () => {
    const { captions } = resolveSettings(
      { ...GOLDEN, tax: { claimsTaxFreeThreshold: true, hasStudyDebt: true } },
      '2026-08-08',
    )!

    // §3.8 and §3.9 both require the caption, and both schedules are stale, so
    // both lines appear rather than one standing in for the other.
    expect(captions).toHaveLength(2)
    expect(captions[0]).toContain('2025–26 tax rates')
    expect(captions[0]).toContain('2026–27')
    expect(captions[1]).toContain('study loan thresholds')
  })

  it('resolves its own defaults', () => {
    expect(resolveSettings(DEFAULT_CHOICES, IN_FY_2025_26)).not.toBeNull()
    expect(isKnownBand(DEFAULT_CHOICES.band)).toBe(true)
  })
})

describe('todayIso', () => {
  it('reads as a date the engine can parse', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
