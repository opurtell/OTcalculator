/**
 * ATO NAT 1004 weekly withholding coefficients, keyed by financial year.
 *
 * Scale 1 is "tax-free threshold not claimed", Scale 2 is "claimed". Both are
 * resident scales with standard Medicare; the app does not model exemptions or
 * the surcharge (§3.14).
 *
 * Source: NAT 1004 Sheet 2 ("Statement of Formula - CSV") of the ATO software
 * developers' workbook, `softwaredevelopers.ato.gov.au/sites/default/files/
 * 2026-05/NAT_1004.xlsx`, read directly rather than through the sibling repo.
 * The workbook's "Other schedules to be updated" sheet says the reissue
 * "apply[s] from 1 July 2026", and the schedule page at ato.gov.au (published
 * 17 June 2026) says the same: "This schedule applies to payments made from
 * 1 July 2026". Both scales below are the full column, transcribed cell for
 * cell.
 *
 * ## These coefficients spent a while labelled FY2025-26, and they are not
 *
 * They are FY2026-27's — the year the second bracket drops 16% → 15% and the
 * Medicare shade-in moves to $28,011/$35,013 ($538/$673 weekly). The FY2024-25
 * edition of the same workbook, which is what FY2025-26 would have looked
 * like, opens Scale 2's second row at 16% from $500. The two are not the same
 * table and no rounding hides the difference.
 *
 * The mislabel travelled from the sibling repo, which ingested this workbook
 * in May 2026 and updated the coefficients and the source URL without moving
 * the year key off `2025-26`. So the app was already withholding at the right
 * rates while captioning them as last year's — the numbers were right and the
 * sentence under them was wrong, which is the failure mode this file's
 * provenance comments exist to prevent.
 *
 * **There is no FY2025-26 row here**, and that is a gap rather than an
 * oversight: the ATO publishes only the current schedule, its software
 * developers' site holds the 2024-05 and 2026-05 editions and nothing between,
 * and inventing the missing year from a third-party table would be exactly the
 * unsourced figure §3.8 refuses. `taxScaleFor` therefore falls back for it and
 * says so. Nothing in the app can reach that year today — `Calculator` resolves
 * settings against the current date, never an entered shift date — so the
 * fallback is a boundary condition, not a live path.
 *
 * `taxScaleFor` reports when it has fallen back so the UI can caption it.
 * Adding a real row below is the entire fix for any year — no engine change,
 * and older fortnights keep computing against their own year.
 */

import type { FinancialYear, TaxScale } from '../engine/types'
import { fallbackNotice } from './fallback'

const SCALES: readonly TaxScale[] = [
  {
    financialYear: '2026-27',
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
    financialYear: '2026-27',
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
export const LATEST_VERIFIED_FINANCIAL_YEAR: FinancialYear = '2026-27'

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
  return fallbackNotice(
    'tax rates',
    selection.scale.financialYear,
    selection.requested,
  )
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
