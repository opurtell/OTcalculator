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

/** An AM shift picked up and entered as one period that ran to 18:00 — a 10-hour
 * shift taken to 11.5, which earns the one N36 occasion the §4.5 pair does not. */
const AM_RUN_ON: OtShift = {
  id: 'am-run-on',
  date: '2026-08-19',
  startMin: 6 * 60 + 30,
  endMin: 18 * 60,
  endsNextDay: false,
  kind: 'separate',
}

const summary = summaryText({
  result: calculateFortnight([SATURDAY, WEDNESDAY], settings),
  bandSummary: 'AP1 Step 2',
})

describe('summaryText', () => {
  it('leads with what the overtime is worth', () => {
    expect(summary).toContain('Your OT adds $698.33 take-home')
    expect(summary).toContain('from $1,110.33 before tax · 63% kept')
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

  it('leaves the allowance out when no shift earned one', () => {
    // Neither §4.5 shift is past a rostered end, so there is no N36 occasion and
    // no line for one — a zero would be a figure claiming to be disclosure.
    expect(summary).not.toContain('Meal allowance')
    expect(summary).not.toContain('Total in the hand')
  })

  it('carries the meal allowance with its clause and its shift when there is one', () => {
    // What leaves the device is read beside a payslip. "$35.38" on its own would
    // be the screenshot problem again, so the line names the shift, how far over
    // it ran, and the clause.
    const withMeal = summaryText({
      result: calculateFortnight([AM_RUN_ON], settings),
      bandSummary: 'AP1 Step 2',
    })

    expect(withMeal).toContain('Meal allowance (tax free, EBA N36)')
    expect(withMeal).toContain('Wed 19 Aug AM shift · 1h 30m over')
    expect(withMeal).toContain('$35.38')

    // Below the tax lines, for the same reason it sits there on screen.
    expect(withMeal.indexOf('Meal allowance     ')).toBeGreaterThan(
      withMeal.indexOf('PAYG tax'),
    )
    expect(withMeal).toContain('Total in the hand')
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

/**
 * The advanced split, in the text that leaves the device.
 *
 * Same rule as the shifts and the tax line: what is on screen and what gets
 * pasted into a message thread are the same figures. Someone in advanced mode
 * is quoting Spendable, and a take-home-only summary would understate what they
 * have by the packaged amount they still spend.
 */
describe('summaryText with the advanced deduction split', () => {
  const ADVANCED = {
    superPercentOfGross: 0.05,
    superPerFortnight: 0,
    livingExpenses: 800,
    mealsAndEntertainment: 100,
    unionFees: 30,
  }

  const result = calculateFortnight([SATURDAY, WEDNESDAY], {
    ...settings,
    deductions: { fixedPerFortnight: 930, percentOfGross: 0.05 },
  })
  const text = summaryText({
    result,
    bandSummary: 'AP1 Step 2',
    advancedDeductions: ADVANCED,
  })

  it('names every category, including the two it does not add back', () => {
    // A Spendable figure with no account of what was left out is exactly the
    // unexplained figure this text exists to avoid — and it is read away from
    // the app, where nothing can be tapped to find out.
    expect(text).toContain('Super')
    expect(text).toContain('Living expenses')
    expect(text).toContain('Meals and entertainment')
    expect(text).toContain('Union fees')
    expect(text).toContain('one is locked away, the other is already spent')
  })

  it('adds the two that come back, and nothing else', () => {
    expect(text).toContain('Spendable')
    const spendable = /Spendable\s+\$([\d,]+\.\d\d)/.exec(text)
    expect(spendable, 'no Spendable line in the summary').not.toBeNull()
    expect(spendable![1]).toBe(
      formatSummaryMoney(result.netTotal + 900),
    )
  })

  it('still carries its disclaimer', () => {
    expect(text.trimEnd().endsWith(DISCLAIMER)).toBe(true)
  })

  it('says nothing about spendable money in simple mode', () => {
    expect(summary).not.toContain('Spendable')
  })
})

/** `4,600.32` — the summary's own money format, without the `$`. */
function formatSummaryMoney(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
