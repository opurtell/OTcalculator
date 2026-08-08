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

import type { AttendanceFlag } from './types'

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
  /** Packaging and a study debt together — see the note in `tax.ts`. */
  { kind: 'packaging-help-interaction' }

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
 * What the app has to say about the packaging it was given.
 *
 * **There is deliberately no FBT-cap warning here, and adding one back is a
 * mistake.** "Pre-tax deductions" is one field covering several unrelated
 * things: novated leases and living-expenses packaging count towards the
 * FBT-exempt caps, but salary-sacrificed super does not, and super is both the
 * commonest entry and the one large enough to trip a $9,010 cap on its own.
 * The app cannot tell which is which from a dollar figure, so a cap warning
 * would fire confidently on the case where it is simply wrong. Whether someone
 * is over their cap is a question for their packaging provider, who knows what
 * the money is for; this app works out tax on what it was told.
 */
export function packagingFlags(
  deductions: DeductionBreakdown,
  hasStudyDebt: boolean,
): PackagingFlag[] {
  const flags: PackagingFlag[] = []

  if (deductions.total > 0 && hasStudyDebt) {
    flags.push({ kind: 'packaging-help-interaction' })
  }

  return flags
}
