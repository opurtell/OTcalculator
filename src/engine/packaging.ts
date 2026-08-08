/**
 * Pre-tax deductions and salary packaging (§3.10).
 *
 * Two inputs, usable together: a fixed dollar amount per fortnight and a
 * percentage of gross. Both come off before PAYG and HELP are computed, which
 * is the whole point of packaging — and also why the percentage one has to be
 * recomputed on each side of the with/without-overtime comparison rather than
 * held constant.
 *
 * Post-tax deductions are out of scope for v1.
 */

import type { AttendanceFlag, PackagingCaps } from './types'
import {
  FORTNIGHTS_PER_YEAR_DENOMINATOR,
  FORTNIGHTS_PER_YEAR_NUMERATOR,
} from './types'

export interface DeductionSettings {
  /** Dollars per fortnight, held constant regardless of overtime. */
  fixedPerFortnight: number
  /** Fraction of gross, e.g. `0.05` for 5%. Recomputed on each gross. */
  percentOfGross: number
}

export const NO_DEDUCTIONS: DeductionSettings = {
  fixedPerFortnight: 0,
  percentOfGross: 0,
}

export interface DeductionBreakdown {
  fixed: number
  percent: number
  total: number
}

/**
 * Something about the packaging the user needs to see. Warnings, never blocks:
 * the user may be packaging elsewhere too, and a calculator that refuses to
 * compute is worse than one that cautions.
 */
export type PackagingFlag =
  /** Annualised packaging exceeds the FBT-exempt living expenses cap. */
  | { kind: 'packaging-cap-exceeded'; annualised: number; cap: number }
  /** Packaging and a study debt together — see the note in `tax.ts`. */
  | { kind: 'packaging-help-interaction' }

/** Every flag a fortnight can raise, from either half of the engine. */
export type FortnightFlag = AttendanceFlag | PackagingFlag

export function computeDeductions(
  gross: number,
  settings: DeductionSettings,
): DeductionBreakdown {
  const fixed = Math.max(0, settings.fixedPerFortnight)
  const percent = Math.max(0, settings.percentOfGross) * Math.max(0, gross)

  // Deductions cannot exceed gross — a taxable gross below zero would send
  // PAYG somewhere meaningless. Capping here keeps the arithmetic honest;
  // whether the user has over-committed is a question for the UI, not the
  // withholding calculation.
  const total = Math.min(fixed + percent, Math.max(0, gross))

  return { fixed, percent, total }
}

/**
 * Warn when the annualised packaged amount passes the FBT-exempt cap.
 *
 * The caps are per FBT year and this app sees one fortnight, so the check
 * annualises at the EBA's 26.0833 fortnights. Someone who started packaging
 * midway through the year will trip it early — which is why it is worded as a
 * caution rather than an error.
 */
export function packagingFlags(
  deductions: DeductionBreakdown,
  caps: PackagingCaps,
  hasStudyDebt: boolean,
): PackagingFlag[] {
  const flags: PackagingFlag[] = []

  const annualised =
    (deductions.total * FORTNIGHTS_PER_YEAR_DENOMINATOR) /
    FORTNIGHTS_PER_YEAR_NUMERATOR

  if (annualised > caps.livingExpensesCap) {
    flags.push({
      kind: 'packaging-cap-exceeded',
      annualised,
      cap: caps.livingExpensesCap,
    })
  }

  if (deductions.total > 0 && hasStudyDebt) {
    flags.push({ kind: 'packaging-help-interaction' })
  }

  return flags
}
