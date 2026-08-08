/**
 * HELP/HECS compulsory repayment thresholds (NAT 3539), keyed by financial
 * year.
 *
 * FY2025-26 introduced the marginal structure: below $67,000 nothing is
 * withheld, and the two middle bands charge a rate on the amount *above* the
 * threshold rather than on total income. The top band reverts to a flat rate on
 * total income. Mixing those two bases up overstates the repayment sharply
 * around the boundaries, which is why `basis` is carried per row.
 *
 * Same fallback rule as the tax scales (§3.9): FY2026-27 thresholds are indexed
 * annually and are not in hand, so the FY2025-26 set is used and captioned. A
 * stale set understates the repayment slightly.
 *
 * Source: the ACTAS Pay Tracker's `help-thresholds.json`.
 */

import type { FinancialYear, HelpSchedule } from '../engine/types'

const SCHEDULES: readonly HelpSchedule[] = [
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

export const LATEST_VERIFIED_FINANCIAL_YEAR: FinancialYear = '2025-26'

export interface HelpScheduleSelection {
  schedule: HelpSchedule
  requested: FinancialYear
  isFallback: boolean
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
