/**
 * The shareable summary, against the §4.5 golden fixture.
 *
 * What matters here is not the layout but the contract: a figure that leaves
 * the device takes its working and its disclaimer with it. A summary that said
 * "$698.33" and nothing else would be the screenshot problem with extra steps.
 */

import { describe, expect, it } from 'vitest'
import { resolveSettings } from '../settings'
import type { CalculatorChoices } from '../settings'
import { calculateFortnight } from '../../engine/fortnight'
import type { OtShift } from '../../engine/types'
import { DISCLAIMER, summaryText } from '../summary'

const CHOICES: CalculatorChoices = {
  band: { classification: 'AP1', step: 2, annualBase: null, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'fortnight',
}

const resolved = resolveSettings(CHOICES, '2026-02-11')
if (resolved === null) throw new Error('AP1 Step 2 should resolve')
const { settings } = resolved

/** Saturday 15 August 2026, 09:00–19:00, picked up. */
const SATURDAY: OtShift = {
  id: 'sat',
  date: '2026-08-15',
  startMin: 9 * 60,
  endMin: 19 * 60,
  endsNextDay: false,
  kind: 'separate',
}

/** Wednesday 19 August 2026, 18:00–20:00, ran on from the rostered shift. */
const WEDNESDAY: OtShift = {
  id: 'wed',
  date: '2026-08-19',
  startMin: 18 * 60,
  endMin: 20 * 60,
  endsNextDay: false,
  kind: 'overrun',
}

const summary = summaryText({
  result: calculateFortnight([SATURDAY, WEDNESDAY], settings),
  bandSummary: 'AP1 Step 2',
})

describe('summaryText', () => {
  it('leads with what the overtime is worth', () => {
    // $698.33 of taxed overtime plus 3 × $35.38 of tax-free meal allowance.
    expect(summary).toContain('Your OT adds $804.47 take-home')
    expect(summary).toContain('from $1,216.47 before tax · 66% kept')
  })

  it('carries the shifts that produced the figure', () => {
    expect(summary).toContain('Sat 15 Aug 09:00–19:00')
    expect(summary).toContain('all at 2× (Saturday)')
    expect(summary).toContain('Wed 19 Aug 18:00–20:00')
  })

  it('shows both sides of the comparison, tax included', () => {
    // $4,908.32 either way, PAYG $1,208 → $1,620, take-home $3,700.32 → $4,398.66.
    expect(summary).toContain('4,908.32')
    expect(summary).toContain('1,208.00')
    expect(summary).toContain('1,620.00')
    expect(summary).toContain('3,700.32')
    expect(summary).toContain('4,398.66')
  })

  it('carries the meal allowance with its clause and its windows', () => {
    // What leaves the device is read beside a payslip. "$106.14" on its own
    // would be the screenshot problem again, so each occasion names the window
    // it was earned in and the section names the clause.
    expect(summary).toContain('Meal allowance (tax free, EBA N36)')
    expect(summary).toContain('Sat 15 Aug 12:00–14:00 worked through')
    expect(summary).toContain('Sat 15 Aug 18:00–19:00 worked through')
    expect(summary).toContain('Wed 19 Aug 18:00–19:00 worked through')
    expect(summary).toContain('$35.38')
  })

  it('shows the allowance below the tax lines in the comparison', () => {
    // Above PAYG it would read as an amount tax was taken from.
    expect(summary.indexOf('Meal allowance     ')).toBeGreaterThan(
      summary.indexOf('PAYG tax'),
    )
    expect(summary).toContain('106.14')
    expect(summary).toContain('4,504.80')
  })

  it('leaves the allowance out when no shift earned one', () => {
    const noMeal = summaryText({
      result: calculateFortnight(
        [{ ...WEDNESDAY, startMin: 9 * 60, endMin: 11 * 60 }],
        settings,
      ),
      bandSummary: 'AP1 Step 2',
    })
    expect(noMeal).not.toContain('Meal allowance')
  })

  it('never leaves without the disclaimer', () => {
    expect(summary.endsWith(DISCLAIMER)).toBe(true)
  })

  it('names the band the figures came from', () => {
    expect(summary).toContain('AP1 Step 2')
  })

  it('omits the rows that would be zeroes', () => {
    expect(summary).not.toContain('Study loan')
    expect(summary).not.toContain('Pre-tax deductions')
  })

  it('summarises a fortnight with no overtime as the baseline it is', () => {
    const quiet = summaryText({
      result: calculateFortnight([], settings),
      bandSummary: 'AP1 Step 2',
    })

    expect(quiet).toContain('Take-home this fortnight: $3,700.32')
    expect(quiet).not.toContain('Your OT adds')
    expect(quiet.endsWith(DISCLAIMER)).toBe(true)
  })

  it('passes the tax-year caption through — it changes what the figures mean', () => {
    const captioned = summaryText({
      result: calculateFortnight([SATURDAY], settings),
      bandSummary: 'AP1 Step 2',
      captions: ['Using 2025–26 tax rates'],
    })
    expect(captioned).toContain('Using 2025–26 tax rates')
  })
})
