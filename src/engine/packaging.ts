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
 * The same pre-tax money, named by where it goes.
 *
 * `DeductionSettings` is one field over several unrelated things (trap 6), which
 * is enough to work out tax and not enough to answer "how much have I actually
 * got to spend". These four categories answer that: super leaves and stays gone,
 * union fees leave and are already spent, and living expenses and meals and
 * entertainment leave the payslip but come back as money someone still spends —
 * on a mortgage, a rent payment, a packaging card.
 *
 * It changes no tax figure. `advancedDeductionSettings` collapses it back to the
 * two knobs the withholding calculation has always taken, so the split is a
 * *description* of a deduction total, never a second way of computing one.
 *
 * Super is the only category with a percentage option, and it bites on the
 * fortnight's whole gross — overtime included, before anything else comes out —
 * which is exactly what the single percentage field has always done.
 */
export interface AdvancedDeductions {
  /** Super as a fraction of gross, e.g. `0.05`. */
  superPercentOfGross: number
  /** Super as a set amount per fortnight. */
  superPerFortnight: number
  /** Mortgage, rent, and the rest of the living-expenses packaging benefit. */
  livingExpenses: number
  mealsAndEntertainment: number
  unionFees: number
}

export const NO_ADVANCED_DEDUCTIONS: AdvancedDeductions = {
  superPercentOfGross: 0,
  superPerFortnight: 0,
  livingExpenses: 0,
  mealsAndEntertainment: 0,
  unionFees: 0,
}

/** Each category in dollars at a given gross, capped the same way tax is. */
export interface AdvancedCategoryAmounts {
  superannuation: number
  livingExpenses: number
  mealsAndEntertainment: number
  unionFees: number
}

export interface AdvancedBreakdown extends AdvancedCategoryAmounts {
  /** The four categories, summed. Equal to `computeDeductions(…).total`. */
  total: number
  /** What was asked for before the gross ran out. Equal to `total` normally. */
  requested: number
  /** True when the categories asked for more than the fortnight's gross. */
  capped: boolean
}

/** Negatives are not deductions; they are typos the engine refuses to pay out. */
function atLeastZero(value: number): number {
  return Math.max(0, value)
}

/**
 * The advanced split as the withholding calculation takes it.
 *
 * The three value-only categories and a dollar super contribution are the fixed
 * amount; a percentage super contribution is the percentage. That mapping is
 * the whole reason nothing downstream of here had to change: advanced mode is a
 * different set of questions, not a different sum.
 */
export function advancedDeductionSettings(
  advanced: AdvancedDeductions,
): DeductionSettings {
  return {
    fixedPerFortnight:
      atLeastZero(advanced.superPerFortnight) +
      atLeastZero(advanced.livingExpenses) +
      atLeastZero(advanced.mealsAndEntertainment) +
      atLeastZero(advanced.unionFees),
    percentOfGross: atLeastZero(advanced.superPercentOfGross),
  }
}

/**
 * What each category actually came to, at this fortnight's gross.
 *
 * When the categories together ask for more than the gross, every one of them
 * is scaled by the same factor rather than any one being paid in full first.
 * `computeDeductions` caps the total at gross for the tax calculation, and a
 * breakdown whose lines summed past its own total would be the app contradicting
 * itself on screen — the failure the deductions panel exists to prevent. Scaling
 * proportionally is the one allocation that privileges no category over another.
 */
export function advancedBreakdown(
  gross: number,
  advanced: AdvancedDeductions,
): AdvancedBreakdown {
  const room = atLeastZero(gross)
  const amounts: AdvancedCategoryAmounts = {
    superannuation:
      atLeastZero(advanced.superPerFortnight) +
      atLeastZero(advanced.superPercentOfGross) * room,
    livingExpenses: atLeastZero(advanced.livingExpenses),
    mealsAndEntertainment: atLeastZero(advanced.mealsAndEntertainment),
    unionFees: atLeastZero(advanced.unionFees),
  }

  const requested =
    amounts.superannuation +
    amounts.livingExpenses +
    amounts.mealsAndEntertainment +
    amounts.unionFees

  const scale = requested > room ? room / requested : 1

  return {
    superannuation: amounts.superannuation * scale,
    livingExpenses: amounts.livingExpenses * scale,
    mealsAndEntertainment: amounts.mealsAndEntertainment * scale,
    unionFees: amounts.unionFees * scale,
    total: Math.min(requested, room),
    requested,
    capped: scale < 1,
  }
}

/**
 * Take-home plus the packaged money that never reaches the bank account but is
 * still spent — the figure advanced mode exists to produce.
 *
 * Living expenses and meals and entertainment only: super is locked away until
 * retirement and union fees have already been spent on the union, so counting
 * either as spendable would overstate the answer by the amount that is most
 * plainly not available.
 *
 * `inTheHand` is take-home *including* the tax-free meal allowance, because that
 * is money in the account by the same test — see `FortnightResult.netTotal`.
 */
export function spendableTotal(
  inTheHand: number,
  breakdown: AdvancedBreakdown,
): number {
  return inTheHand + breakdown.livingExpenses + breakdown.mealsAndEntertainment
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
