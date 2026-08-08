/**
 * PAYG withholding (ATO NAT 1004) and HELP/HECS repayments (NAT 3539).
 *
 * This file predicts the *payslip*, not the tax return. A big overtime
 * fortnight over-withholds and comes back at tax time; that is what payroll
 * actually does and it is what the user asked to see (§3.13).
 *
 * Both schedules arrive as parameters. Neither is stored here, so a fortnight
 * worked in an earlier financial year keeps computing against that year's
 * figures.
 */

import type { HelpSchedule, TaxScale } from './types'
import {
  FORTNIGHTS_PER_YEAR_DENOMINATOR,
  FORTNIGHTS_PER_YEAR_NUMERATOR,
} from './types'

/**
 * Fortnightly PAYG withholding.
 *
 * NAT 1004 is a *weekly* schedule; every other pay cycle converts to a weekly
 * equivalent first. For a fortnight: halve the earnings, drop the cents, add 99
 * cents, run the formula, round, then double.
 *
 * ```
 * weekly      = floor(taxableGross / 2)
 * withholding = round(a × (weekly + 0.99) − b)
 * fortnightly = withholding × 2
 * ```
 *
 * The `round` is the one place the engine rounds mid-calculation. That is not a
 * presentation choice — it is mandated by the schedule, and computing in full
 * precision here would disagree with payroll by a dollar or so (§3.12).
 */
export function paygWithholding(
  fortnightlyTaxableGross: number,
  scale: TaxScale,
): number {
  if (fortnightlyTaxableGross <= 0) return 0

  const weekly = Math.floor(fortnightlyTaxableGross / 2)
  const x = weekly + 0.99

  const row = scale.brackets.find((bracket) => weekly < bracket.threshold)
  if (row === undefined) {
    // Only reachable if a scale ships without an open top row.
    throw new RangeError(
      `No NAT 1004 bracket covers weekly earnings of ${weekly} in FY${scale.financialYear} scale ${scale.scale}`,
    )
  }

  return Math.max(0, Math.round(row.rate * x - row.base)) * 2
}

/** Annualising factor — the EBA's 313/12, i.e. 26.0833 fortnights a year. */
const FORTNIGHTS_PER_YEAR =
  FORTNIGHTS_PER_YEAR_DENOMINATOR / FORTNIGHTS_PER_YEAR_NUMERATOR

/**
 * Fortnightly compulsory HELP repayment.
 *
 * Annualise the taxable gross, apply the schedule, then bring the result back
 * to a fortnight. HELP is withheld under its own schedule, separately from
 * income tax, so this is added to PAYG rather than folded into it.
 *
 * Rows differ in what they charge on: the middle bands take a rate on the
 * amount *above* the threshold, the top band a flat rate on total income.
 * Applying one basis to the other overstates the repayment sharply near the
 * boundaries, which is why `basis` is carried per row.
 *
 * ⚠️ This models the fortnightly *withholding*. The annual assessment adds the
 * grossed-up value of any packaged benefit back into repayment income, so
 * someone packaging the full cap with a study debt can still face a bill at tax
 * time. `fortnight.ts` raises a flag when both are active (§3.9).
 */
export function helpRepayment(
  fortnightlyTaxableGross: number,
  schedule: HelpSchedule,
): number {
  if (fortnightlyTaxableGross <= 0) return 0

  const annual = fortnightlyTaxableGross * FORTNIGHTS_PER_YEAR

  const row = schedule.brackets.find(
    (bracket) => bracket.incomeTo === null || annual < bracket.incomeTo,
  )
  if (row === undefined) {
    throw new RangeError(
      `No HELP bracket covers annual income of ${annual} in FY${schedule.financialYear}`,
    )
  }

  const annualRepayment =
    row.basis === 'total_income'
      ? annual * row.rate
      : (row.base ?? 0) + (annual - row.incomeFrom) * row.rate

  return Math.max(0, annualRepayment) / FORTNIGHTS_PER_YEAR
}

/**
 * Ordinary fortnightly gross for a pay band (§3.1, EBA C3.3).
 *
 * ```
 * (Annex A total + roster adjustment) × 12/313
 * ```
 *
 * The Annex A total is the published composite — base plus penalties plus
 * rostered overtime — and is used verbatim rather than recomputed from base.
 * The divisor is the EBA's own `12/313`, not `/26`.
 *
 * Note this is the one calculation that legitimately uses `annexATotal`.
 * Overtime never does.
 */
export function ordinaryFortnightlyGross(band: {
  annualBase: number
  annexATotal: number
}): number {
  const rosterAdjustment = band.annualBase * ROSTER_ADJUSTMENT_RATE
  return (
    ((band.annexATotal + rosterAdjustment) * FORTNIGHTS_PER_YEAR_NUMERATOR) /
    FORTNIGHTS_PER_YEAR_DENOMINATOR
  )
}

/** Roster adjustment allowance, 2.20% of base salary — EBA N44. */
export const ROSTER_ADJUSTMENT_RATE = 0.022
