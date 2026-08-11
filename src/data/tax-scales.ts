/**
 * ATO NAT 1004 weekly withholding coefficients, keyed by financial year.
 *
 * Scale 1 is "tax-free threshold not claimed", Scale 2 is "claimed". Both are
 * resident scales with standard Medicare; the app does not model exemptions or
 * the surcharge (§3.14).
 *
 * Source: NAT 1004, Sheet 2 of the ATO software developers' workbook, via the
 * ACTAS Pay Tracker's `tax-scales.json`, where every coefficient is recorded as
 * verified against the spreadsheet.
 *
 * ## Only FY2025-26 is real
 *
 * The ATO reissued Schedule 1 for FY2026-27 (the second bracket dropping 16% →
 * 15%), but those coefficients are not in hand here and cannot be fetched from
 * this environment. Per §3.8 the fallback is the **FY2025-26 coefficients**,
 * not an annual-bracket approximation: the coefficient method is what payroll
 * actually runs, so a year-stale set stays structurally correct and is wrong
 * only by the rate change. The error over-states tax slightly, which is the
 * conservative direction for someone deciding whether a shift is worth it.
 *
 * `taxScaleFor` reports when it has fallen back so the UI can caption it.
 * Adding the real FY2026-27 rows to `SCALES` below is the entire fix — no
 * engine change, and older fortnights keep computing against their own year.
 */

import type { FinancialYear, TaxScale } from '../engine/types'

const SCALES: readonly TaxScale[] = [
  {
    financialYear: '2025-26',
    scale: 1,
    brackets: [
      { threshold: 188, rate: 0.15, base: 0.15 },
      { threshold: 371, rate: 0.2084, base: 11.0185 },
      { threshold: 515, rate: 0.179, base: 0.1066 },
      { threshold: 932, rate: 0.3227, base: 74.1674 },
      { threshold: 2246, rate: 0.32, base: 71.6508 },
      { threshold: 3303, rate: 0.39, base: 228.8816 },
      { threshold: Infinity, rate: 0.47, base: 493.1893 },
    ],
  },
  {
    financialYear: '2025-26',
    scale: 2,
    brackets: [
      { threshold: 362, rate: 0, base: 0 },
      { threshold: 538, rate: 0.15, base: 54.3462 },
      { threshold: 673, rate: 0.25, base: 108.2135 },
      { threshold: 721, rate: 0.17, base: 54.3473 },
      { threshold: 865, rate: 0.179, base: 60.8377 },
      { threshold: 1282, rate: 0.3227, base: 185.1935 },
      { threshold: 2596, rate: 0.32, base: 181.7319 },
      { threshold: 3653, rate: 0.39, base: 363.4627 },
      { threshold: Infinity, rate: 0.47, base: 655.7704 },
    ],
  },
]

/** The most recent year with real coefficients — the fallback target. */
export const LATEST_VERIFIED_FINANCIAL_YEAR: FinancialYear = '2025-26'

export interface TaxScaleSelection {
  scale: TaxScale
  /** The year asked for, which may not be the year supplied. */
  requested: FinancialYear
  /** True when `scale.financialYear` is not `requested` (§3.8). */
  isFallback: boolean
}

/**
 * The caption §3.8 requires whenever the fallback is active. Remove the
 * caption by adding the real coefficients, never by removing the fallback.
 */
export function fallbackCaption(selection: TaxScaleSelection): string | null {
  if (!selection.isFallback) return null
  const from = selection.scale.financialYear.replace('-', '–')
  const to = selection.requested.replace('-', '–')
  return `Using ${from} tax rates — ${to} schedule not yet published.`
}

export function taxScaleFor(
  financialYear: FinancialYear,
  scale: 1 | 2,
): TaxScaleSelection {
  const exact = SCALES.find(
    (s) => s.financialYear === financialYear && s.scale === scale,
  )
  if (exact) return { scale: exact, requested: financialYear, isFallback: false }

  const fallback = SCALES.find(
    (s) => s.financialYear === LATEST_VERIFIED_FINANCIAL_YEAR && s.scale === scale,
  )
  if (!fallback) throw new Error(`No coefficients at all for scale ${scale}`)

  return { scale: fallback, requested: financialYear, isFallback: true }
}
