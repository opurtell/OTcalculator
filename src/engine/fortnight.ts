/**
 * The orchestrator: a fortnight's shifts and settings in, take-home out —
 * twice, so the app can say what the overtime was actually worth (§3.12).
 *
 * Running the whole calculation with and without the overtime is the only
 * honest way to answer "what did that shift add?". The marginal rate on the
 * last dollar is not the answer, because PAYG is withheld on the fortnight's
 * total and rounds at the weekly step.
 */

import { calculateOvertime } from './attendance'
import { mealAllowanceFor } from './meals'
import type { MealAllowanceResult } from './meals'
import { computeDeductions, packagingFlags } from './packaging'
import type { DeductionSettings, FortnightFlag } from './packaging'
import { helpRepayment, ordinaryFortnightlyGross, paygWithholding } from './tax'
import type {
  HelpSchedule,
  HolidayCalendar,
  OtShift,
  PayBand,
  TaxScale,
} from './types'

export interface FortnightSettings {
  band: PayBand
  /** Already selected for the pay date's financial year and the user's scale. */
  taxScale: TaxScale
  /** `null` when the user has no study debt. */
  helpSchedule: HelpSchedule | null
  deductions: DeductionSettings
  holidays: HolidayCalendar
  /**
   * The Annex C overtime meal allowance, per occasion (EBA N36). Required
   * rather than optional: it is money, and a defaulted zero would be a figure
   * quietly missing from someone's fortnight rather than a wiring bug anyone
   * would notice.
   */
  mealAllowancePerOccasion: number
  /**
   * Overrides the derived ordinary gross. For someone part-way through a step,
   * acting up, or simply reading a different number off their payslip — §6
   * Phase 5 calls for the band to be editable.
   */
  ordinaryGrossOverride?: number
}

/** One pass of the money calculation, at a given gross. */
export interface PayRun {
  gross: number
  preTaxDeductions: number
  taxableGross: number
  payg: number
  help: number
  net: number
}

/**
 * The fortnight run twice and the two answers subtracted — everything except
 * where the overtime figure came from.
 */
export interface PayComparison {
  ordinaryGross: number
  overtimeGross: number
  withOt: PayRun
  withoutOt: PayRun
  /** What the overtime added before tax. */
  otGrossDelta: number
  /** What it added to take-home — the figure the app exists to show. */
  otNetDelta: number
  /** `otNetDelta / otGrossDelta`, or 0 when there was no overtime. */
  retention: number
}

export interface FortnightResult extends PayComparison {
  attendances: ReturnType<typeof calculateOvertime>['attendances']
  flags: FortnightFlag[]
  /**
   * The EBA N36 overtime meal allowance this fortnight earned.
   *
   * It sits outside `PayComparison` on purpose. Everything in there is the tax
   * schedules' business, and this is money the schedules never see: it is not
   * in `gross`, not in `taxableGross`, and not in `net`. Folding it into gross
   * would have PAYG withheld on it, which is the one thing that must not
   * happen — see `netTotal` for where it does land.
   */
  mealAllowance: MealAllowanceResult
  /**
   * Take-home plus the tax-free allowance — what actually reaches the account.
   *
   * `withOt.net` remains the figure the tax lines add up to, so the comparison
   * table still balances column by column; this is the line under it.
   */
  netTotal: number
  /** What the overtime earned in total, allowance included. */
  otEarnedTotal: number
  /**
   * What the overtime added in the hand, allowance included. The headline
   * figure — the whole reason for the app — once N36 is in it.
   */
  otNetTotal: number
}

function runPay(gross: number, settings: FortnightSettings): PayRun {
  const deductions = computeDeductions(gross, settings.deductions)
  const taxableGross = gross - deductions.total

  const payg = paygWithholding(taxableGross, settings.taxScale)
  const help =
    settings.helpSchedule === null
      ? 0
      : helpRepayment(taxableGross, settings.helpSchedule)

  return {
    gross,
    preTaxDeductions: deductions.total,
    taxableGross,
    payg,
    help,
    net: gross - deductions.total - payg - help,
  }
}

/**
 * What a given amount of overtime is worth, once tax has had its say.
 *
 * Separated from `calculateFortnight` because the quick pathway (§5.1) arrives
 * at its overtime figure from an hours field rather than from a shift list,
 * and must not arrive at its *net* figure any differently. Applying a marginal
 * rate there instead would give a number that quietly disagreed with the
 * fortnight calculator on the same overtime.
 */
export function comparePay(
  overtimeGross: number,
  settings: FortnightSettings,
): PayComparison {
  const ordinaryGross =
    settings.ordinaryGrossOverride ?? ordinaryFortnightlyGross(settings.band)

  // The "without" run keeps the fixed deduction constant but recomputes the
  // percentage one on the smaller gross, so the two sides stay internally
  // consistent — a percentage deduction genuinely would have been smaller.
  const withoutOt = runPay(ordinaryGross, settings)
  const withOt = runPay(ordinaryGross + overtimeGross, settings)

  const otGrossDelta = withOt.gross - withoutOt.gross
  const otNetDelta = withOt.net - withoutOt.net

  return {
    ordinaryGross,
    overtimeGross,
    withOt,
    withoutOt,
    otGrossDelta,
    otNetDelta,
    retention: otGrossDelta === 0 ? 0 : otNetDelta / otGrossDelta,
  }
}

export function calculateFortnight(
  shifts: readonly OtShift[],
  settings: FortnightSettings,
): FortnightResult {
  const overtime = calculateOvertime(shifts, settings.band, settings.holidays)
  const comparison = comparePay(overtime.gross, settings)

  const deductions = computeDeductions(comparison.withOt.gross, settings.deductions)

  // Priced from the attendances rather than the shifts, because the N36 window
  // test asks whether an unpaid break fell inside a meal period — and a break
  // only exists once shifts have been grouped into one continuous attendance.
  const mealAllowance = mealAllowanceFor(
    overtime.attendances,
    settings.mealAllowancePerOccasion,
  )

  return {
    ...comparison,
    attendances: overtime.attendances,
    flags: [
      ...overtime.flags,
      ...packagingFlags(deductions, settings.helpSchedule !== null),
    ],
    mealAllowance,
    netTotal: comparison.withOt.net + mealAllowance.total,
    otEarnedTotal: comparison.otGrossDelta + mealAllowance.total,
    otNetTotal: comparison.otNetDelta + mealAllowance.total,
  }
}
