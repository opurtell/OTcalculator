/**
 * HELP/HECS compulsory repayment thresholds (NAT 3539), keyed by financial
 * year.
 *
 * FY2025-26 introduced the marginal structure: below the minimum threshold
 * nothing is withheld, and the two middle bands charge a rate on the amount
 * *above* the threshold rather than on total income. The top band reverts to a
 * flat rate on total income. Mixing those two bases up overstates the
 * repayment sharply around the boundaries, which is why `basis` is carried per
 * row.
 *
 * Source: ato.gov.au, "Study and training loan repayment thresholds and
 * rates", last updated 30 June 2026 — Table 1 is FY2026-27 and Table 2
 * FY2025-26, both read from the page rather than a summary of it. The
 * structure is unchanged between them; the four boundaries are indexed to
 * average weekly earnings, which is the whole of the year-on-year difference:
 * $67,000 → $69,528, $125,000 → $129,717, $179,285 → $186,050, and the middle
 * band's fixed component $8,700 → $9,028.
 *
 * The bands are stored as the ATO's ranges minus a dollar — the page writes
 * "$69,529 – $129,717" where a repayment is charged on income *over* $69,528 —
 * so `incomeFrom` is the figure the arithmetic subtracts, not the first dollar
 * of the band. Reading the printed range straight into `incomeFrom` would
 * shift every repayment by a dollar's worth of rate.
 *
 * Same fallback rule as the tax scales (§3.9): a year with no row falls back
 * to the latest verified one and is captioned.
 */

import type { FinancialYear, HelpSchedule } from '../engine/types'
import { fallbackNotice } from './fallback'

const SCHEDULES: readonly HelpSchedule[] = [
  {
    financialYear: '2026-27',
    brackets: [
      { incomeFrom: 0, incomeTo: 69_528, rate: 0, basis: 'total_income' },
      {
        incomeFrom: 69_528,
        incomeTo: 129_717,
        rate: 0.15,
        basis: 'amount_over_threshold',
      },
      {
        incomeFrom: 129_717,
        incomeTo: 186_050,
        base: 9_028,
        rate: 0.17,
        basis: 'amount_over_threshold',
      },
      { incomeFrom: 186_050, incomeTo: null, rate: 0.1, basis: 'total_income' },
    ],
  },
  {
    financialYear: '2025-26',
    brackets: [
      { incomeFrom: 0, incomeTo: 67_000, rate: 0, basis: 'total_income' },
      {
        incomeFrom: 67_000,
        incomeTo: 125_000,
        rate: 0.15,
        basis: 'amount_over_threshold',
      },
      {
        incomeFrom: 125_000,
        incomeTo: 179_285,
        base: 8_700,
        rate: 0.17,
        basis: 'amount_over_threshold',
      },
      { incomeFrom: 179_285, incomeTo: null, rate: 0.1, basis: 'total_income' },
    ],
  },
]

export const LATEST_VERIFIED_FINANCIAL_YEAR: FinancialYear = '2026-27'

export interface HelpScheduleSelection {
  schedule: HelpSchedule
  requested: FinancialYear
  isFallback: boolean
}

/**
 * The §3.9 caption. Worded through the same builder as the tax one so the two
 * lines stay parallel when they appear together, without pretending the two
 * schedules are the same document. Remove the caption by adding the real
 * thresholds, never by removing the fallback.
 */
export function helpFallbackCaption(selection: HelpScheduleSelection): string | null {
  if (!selection.isFallback) return null
  return fallbackNotice(
    'study loan thresholds',
    selection.schedule.financialYear,
    selection.requested,
  )
}

export function helpScheduleFor(financialYear: FinancialYear): HelpScheduleSelection {
  const exact = SCHEDULES.find((s) => s.financialYear === financialYear)
  if (exact) return { schedule: exact, requested: financialYear, isFallback: false }

  const fallback = SCHEDULES.find(
    (s) => s.financialYear === LATEST_VERIFIED_FINANCIAL_YEAR,
  )
  if (!fallback) throw new Error('No HELP thresholds at all')

  return { schedule: fallback, requested: financialYear, isFallback: true }
}
