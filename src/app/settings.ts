/**
 * The seam between what the user has chosen and what the engine needs.
 *
 * `src/engine/` takes every rate and table as a parameter and holds no figures
 * of its own; `src/data/` holds the figures and none of the logic. This module
 * is the one place that knows both, and it is where a user's four or five
 * choices become the dozen fields of a `FortnightSettings`.
 *
 * It is a pure function of its arguments — including the pay date, which is
 * passed in rather than read from the clock, because the financial year it
 * selects is what keeps an older fortnight computing against the figures that
 * were current when it was worked (§3.8).
 *
 * `CalculatorChoices` is deliberately the same shape as the persisted
 * preferences record in `src/storage/`: the wiring between them is a
 * field-for-field copy with no interpretation in the middle.
 */

import {
  ACT_HOLIDAY_CALENDAR,
  ROSTER_SHIFTS,
  fallbackCaption,
  helpFallbackCaption,
  helpScheduleFor,
  otMealAllowanceFor,
  payBandFor,
  taxScaleFor,
} from '../data'
import type { AllowanceRate } from '../data'
import { financialYearFor, toIsoDate } from '../engine/calendar'
import type { FortnightSettings } from '../engine/fortnight'
import { advancedDeductionSettings } from '../engine/packaging'
import type { AdvancedDeductions, DeductionSettings } from '../engine/packaging'
import { ordinaryFortnightlyGross } from '../engine/tax'
import type { IsoDate, PayBand } from '../engine/types'

/** Which of the two pathways the user was last on (§5). */
export type Pathway = 'quick' | 'fortnight'

export interface PayBandChoice {
  classification: string
  step: number
  /**
   * Hand-entered base salary, or `null` to use the Annex A table.
   *
   * **This is the figure overtime is calculated on** (EBA N34.1), so a user who
   * overrides it moves every overtime rate in the app.
   */
  annualBase: number | null
  /**
   * Hand-entered ordinary fortnightly gross, or `null` to derive it.
   *
   * Separate from `annualBase` because they answer different questions on a
   * payslip — one is the salary line, the other is what actually landed — and
   * someone correcting one has not necessarily checked the other.
   */
  fortnightlyGross: number | null
}

export interface TaxChoice {
  /** Scale 2 when claimed, Scale 1 when not (§3.8). */
  claimsTaxFreeThreshold: boolean
  hasStudyDebt: boolean
}

/** Which super field advanced mode is calculating on. */
export type SuperMode = 'percent' | 'amount'

/**
 * Advanced mode's four categories as the user left them, plus the two switches
 * that say which of the figures are live.
 *
 * Both super figures are kept rather than one, for the same reason the pay band
 * keeps `annualBase` and `fortnightlyGross` side by side: switching between a
 * percentage and a set amount is a change of mind about how to say it, and
 * discarding the other answer would make that switch destructive. `superMode`
 * settles which one is applied, so the pair cannot disagree — only one of them
 * is ever a figure, and the other is a remembered keystroke.
 */
export interface AdvancedDeductionChoice {
  /** Whether the split is what the app calculates on. */
  enabled: boolean
  superMode: SuperMode
  /** A fraction of gross, e.g. `0.05`. Live when `superMode` is `'percent'`. */
  superPercentOfGross: number
  /** Dollars per fortnight. Live when `superMode` is `'amount'`. */
  superPerFortnight: number
  livingExpenses: number
  mealsAndEntertainment: number
  unionFees: number
}

export const DEFAULT_ADVANCED_DEDUCTIONS: AdvancedDeductionChoice = {
  enabled: false,
  superMode: 'percent',
  superPercentOfGross: 0,
  superPerFortnight: 0,
  livingExpenses: 0,
  mealsAndEntertainment: 0,
  unionFees: 0,
}

/**
 * The deduction settings, plus the advanced split when the user has one.
 *
 * `advanced` is optional and absent means absent: a record written before
 * advanced mode existed, or by someone who has never opened it, carries no key
 * at all rather than a block of zeroes. That keeps the stored shape unchanged
 * for every user who does not use the feature.
 */
export interface DeductionChoice extends DeductionSettings {
  advanced?: AdvancedDeductionChoice
}

export interface CalculatorChoices {
  band: PayBandChoice
  tax: TaxChoice
  deductions: DeductionChoice
  pathway: Pathway
}

/**
 * The split as the engine takes it, with the super field that is not selected
 * zeroed out. Nothing downstream should ever see the remembered one.
 */
export function activeAdvancedDeductions(
  choice: AdvancedDeductionChoice,
): AdvancedDeductions {
  return {
    superPercentOfGross:
      choice.superMode === 'percent' ? choice.superPercentOfGross : 0,
    superPerFortnight: choice.superMode === 'amount' ? choice.superPerFortnight : 0,
    livingExpenses: choice.livingExpenses,
    mealsAndEntertainment: choice.mealsAndEntertainment,
    unionFees: choice.unionFees,
  }
}

/** The advanced split when it is switched on, `null` when it is not. */
export function advancedDeductionsFor(
  deductions: DeductionChoice,
): AdvancedDeductions | null {
  const advanced = deductions.advanced
  if (advanced === undefined || !advanced.enabled) return null
  return activeAdvancedDeductions(advanced)
}

/**
 * Which two knobs the withholding calculation gets.
 *
 * Rebuilt field by field rather than passed straight through: `DeductionChoice`
 * is a `DeductionSettings` with a UI-only field bolted on, and handing that
 * object to the engine would put `advanced` inside `FortnightSettings` where
 * nothing may read it (see the `src/engine/` boundary rule).
 */
export function deductionSettingsFor(
  deductions: DeductionChoice,
): DeductionSettings {
  const advanced = advancedDeductionsFor(deductions)
  if (advanced !== null) return advancedDeductionSettings(advanced)

  return {
    fixedPerFortnight: deductions.fixedPerFortnight,
    percentOfGross: deductions.percentOfGross,
  }
}

/**
 * AP1 Step 1, threshold claimed, nothing packaged, no study debt.
 *
 * The step is 1 rather than the golden fixture's 2: a default should be the
 * bottom of the band, so that a user who never touches it is under-stated
 * rather than over-stated.
 */
export const DEFAULT_CHOICES: CalculatorChoices = {
  band: {
    classification: 'AP1',
    step: 1,
    annualBase: null,
    fortnightlyGross: null,
  },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'fortnight',
}

export interface ResolvedSettings {
  /** Everything the engine needs, overrides already applied. */
  settings: FortnightSettings
  /** The Annex A row, before any override — what the setup screen displays. */
  tableBand: PayBand
  /** The derived ordinary fortnightly gross, before any override. */
  derivedFortnightlyGross: number
  /**
   * The Annex C meal-allowance row this fortnight was priced at, kept whole so
   * the §5.7 working can name the rate *and* the date it took effect. Same rule
   * as the pay band: never a table-derived figure with nothing said about which
   * version of the table produced it.
   */
  mealAllowanceRate: AllowanceRate
  /**
   * The advanced deduction split when the user has switched it on, `null`
   * otherwise. It changes no figure in `settings` — `deductionSettingsFor` has
   * already collapsed it — and is carried here only so the result panel can say
   * where the deducted money went, and what is left to spend.
   */
  advancedDeductions: AdvancedDeductions | null
  /**
   * Quiet captions the UI is obliged to show — currently the §3.8 tax fallback
   * and its §3.9 study-loan counterpart. Empty when nothing is stale.
   */
  captions: string[]
}

/**
 * Whether a stored band still names a row in the current pay tables.
 *
 * The read side of the same question `resolveSettings` answers by returning
 * `null`, separated out so the wiring can decide to show the setup screen
 * before it has tried to calculate anything.
 */
export function isKnownBand(choice: PayBandChoice): boolean {
  return payBandFor(choice.classification, choice.step) !== undefined
}

/**
 * `null` when the classification and step name no row in the pay tables.
 *
 * That is not a defensive nicety: a stored preference outlives the table it
 * was written against, and an app that guesses a band silently would be
 * showing a paramedic someone else's pay. The caller sends the user back to
 * the setup screen instead.
 */
export function resolveSettings(
  choices: CalculatorChoices,
  payDate: IsoDate,
): ResolvedSettings | null {
  const tableBand = payBandFor(choices.band.classification, choices.band.step)
  if (!tableBand) return null

  const band: PayBand =
    choices.band.annualBase === null
      ? tableBand
      : { ...tableBand, annualBase: choices.band.annualBase }

  const financialYear = financialYearFor(payDate)
  const taxSelection = taxScaleFor(
    financialYear,
    choices.tax.claimsTaxFreeThreshold ? 2 : 1,
  )
  const helpSelection = choices.tax.hasStudyDebt
    ? helpScheduleFor(financialYear)
    : null

  const captions = [
    fallbackCaption(taxSelection),
    helpSelection === null ? null : helpFallbackCaption(helpSelection),
  ].filter((caption): caption is string => caption !== null)

  // Looked up by the pay date rather than pinned to "current", so a fortnight
  // worked before an Annex C increase still prices at the rate that was in
  // force when it was worked (EBA C20.2).
  const mealAllowanceRate = otMealAllowanceFor(payDate)

  return {
    tableBand,
    derivedFortnightlyGross: ordinaryFortnightlyGross(band),
    mealAllowanceRate,
    advancedDeductions: advancedDeductionsFor(choices.deductions),
    captions,
    settings: {
      band,
      taxScale: taxSelection.scale,
      helpSchedule: helpSelection?.schedule ?? null,
      // Advanced mode's four categories, collapsed back to the two knobs the
      // withholding calculation has always taken. The split describes a
      // deduction total; it never computes a different one.
      deductions: deductionSettingsFor(choices.deductions),
      holidays: ACT_HOLIDAY_CALENDAR,
      meals: {
        ratePerOccasion: mealAllowanceRate.amount,
        // The roster patterns are what let the engine place N36.2's "end of
        // ordinary duty for the day" from an overtime entry alone. Passed in
        // rather than reached for, like every other table.
        rosterShifts: ROSTER_SHIFTS,
      },
      // `undefined` rather than `null`: the engine's field is optional, and
      // `??` on an explicit null would silently mean "no override" anyway.
      ordinaryGrossOverride: choices.band.fortnightlyGross ?? undefined,
    },
  }
}

/**
 * Today in ACT wall-clock, as an `IsoDate`.
 *
 * The one impure function in the app layer, kept here so that everything which
 * depends on the date takes it as an argument and stays testable. Built from
 * local components rather than `toISOString()`, which would roll back a day
 * for anyone east of UTC before 10am.
 */
export function todayIso(): IsoDate {
  const now = new Date()
  return toIsoDate({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  })
}
