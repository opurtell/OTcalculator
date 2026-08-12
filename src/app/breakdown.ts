/**
 * The result panel's figure rows (§5.4, §5.7) as pure data.
 *
 * Kept out of the component so the row-shaping is unit-testable without
 * rendering, the same way `warnings.ts` and `shifts.ts` keep their logic. Every
 * figure passes through unchanged from the engine — full precision held until
 * `FigureTable`/`formatMoney` round it for display (§3.13).
 *
 * Three surfaces are built here:
 *
 * - **The comparison** (`comparisonRows`) — a fortnight run twice, side by side,
 *   so the overtime's effect on every line is visible. Only meaningful when
 *   there *is* overtime; the no-OT state uses the single-column `breakdownRows`.
 * - **The overtime derivation** (`overtimeDerivationRows`) — one row per
 *   attendance, hung off the comparison's Overtime line. "Never show an
 *   unexplained figure" (§7): if the Overtime line says $1,110.33, the two
 *   shifts that made it are one tap away.
 * - **"How this was worked out"** (`ordinaryPayRows`, `overtimeRateRows`,
 *   `paygRows`, `mealAllowanceRows`) — the §5.7 trust-building derivation:
 *   concept first, clause reference second.
 */

import type { Attendance } from '../engine/attendance'
import { ordinaryFortnightlyGross, ROSTER_ADJUSTMENT_RATE } from '../engine/tax'
import { otHourlyRate } from '../engine/overtime'
import {
  MEAL_ALLOWANCE_OVERRUN_MINUTES,
  MEAL_ALLOWANCE_SHIFT_MINUTES,
} from '../engine/meals'
import type { MealOccasion } from '../engine/meals'
import { advancedBreakdown, spendableTotal } from '../engine/packaging'
import type { AdvancedBreakdown, AdvancedDeductions } from '../engine/packaging'
import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import { RATES_EFFECTIVE_FROM } from '../data'
import { describeAttendance } from './shifts'
import { formatIsoDateAu } from './inputs'
import { formatShortDate } from './dates'
import { formatHours, formatMoney } from '../ui/format'
import type { FigureRow } from '../ui/FigureTable'

/**
 * How a meal allowance line names its clause. N36 rather than Annex C, because
 * N36 is the clause that decides *whether* it is owed — Annex C only sets the
 * figure — and the copy deck's rule is concept first, clause second.
 */
const MEAL_CLAUSE = 'EBA N36'

/**
 * "Not applicable" in the without-OT column. A bare `0.00` would read as a
 * figure claiming to be disclosure; the dash says plainly that the line did not
 * exist on that side. Em dash, not the money minus, so it is not mistaken for a
 * deduction.
 */
const NOT_APPLICABLE = '—'

export interface FigureTableData {
  /**
   * Omitted for a single-column table. `FigureTable` renders no header row
   * then, which is the shape every no-overtime breakdown takes: two identical
   * columns are not a comparison, they are the same number printed twice.
   */
  columns?: string[]
  rows: FigureRow[]
}

/** The two comparison columns, in display order. */
export const COMPARISON_COLUMNS: readonly string[] = ['Without OT', 'With OT']

/**
 * The with/without-overtime comparison (§5.4).
 *
 * A waterfall read across two columns: base pay (the anchor — identical either
 * side, because overtime never changes it), the overtime sitting on top, then
 * every line that moves the figure down to take-home. Each column sums to its
 * own net because the values are the engine's full-precision figures, not the
 * rounded strings on screen.
 *
 * The Overtime row carries the per-attendance `derivation`, which is the
 * "per-shift breakdown" deliverable: tap it and each shift's date, rate
 * breakdown and pay expand beneath.
 */
export function comparisonRows(result: FortnightResult): FigureTableData {
  const { withoutOt, withOt } = result
  const rows: FigureRow[] = [
    // Identical by design — overtime is calculated *on* base, it does not
    // alter it. Showing both makes that explicit rather than implicit.
    { label: 'Base pay', values: [withoutOt.gross, withoutOt.gross] },
  ]

  if (result.overtimeGross > 0) {
    rows.push({
      label: 'Overtime',
      values: [NOT_APPLICABLE, result.overtimeGross],
      derivation: overtimeDerivationRows(result.attendances),
    })
  }

  if (withOt.preTaxDeductions > 0) {
    rows.push({
      label: 'Pre-tax deductions',
      values: [withoutOt.preTaxDeductions, withOt.preTaxDeductions],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  rows.push({
    label: 'PAYG tax',
    values: [withoutOt.payg, withOt.payg],
    tone: 'out',
    sign: 'always-negative',
  })

  if (withOt.help > 0) {
    rows.push({
      label: 'Study loan',
      values: [withoutOt.help, withOt.help],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  const meals = result.mealAllowance

  rows.push({
    label: 'Take-home',
    values: [withoutOt.net, withOt.net],
    tone: 'net',
    // The rule and the heavier weight belong to whichever line is the last
    // one. With a meal allowance below it, take-home is a sub-total.
    total: meals.total === 0,
  })

  if (meals.total > 0) {
    rows.push(mealAllowanceRow([NOT_APPLICABLE, meals.total], meals.occasions))
    rows.push({
      label: 'Total in the hand',
      values: [withoutOt.net, result.netTotal],
      tone: 'net',
      total: true,
    })
  }

  return { columns: [...COMPARISON_COLUMNS], rows }
}

/**
 * The meal allowance line, wherever it appears.
 *
 * It sits **below** the tax lines in every table, and that placement is the
 * disclosure: an untaxed amount printed above PAYG reads as though PAYG was
 * withheld on it. The note says so out loud as well, because the position is an
 * argument only if you already know it is one.
 */
function mealAllowanceRow(
  values: (number | string)[],
  occasions: readonly MealOccasion[],
): FigureRow {
  return {
    label: 'Meal allowance',
    note: `Tax free · ${MEAL_CLAUSE}`,
    values,
    derivation: mealDerivationRows(occasions),
  }
}

/**
 * The single-column breakdown, for the no-overtime state (§5.3).
 *
 * A two-column comparison is meaningless when both sides are identical, so the
 * quiet empty-state panel keeps one column. Same waterfall, same conditional
 * rows — a line that did not move the figure is noise, not disclosure.
 */
export function breakdownRows(result: FortnightResult): FigureRow[] {
  const { withOt } = result
  const rows: FigureRow[] = [{ label: 'Base pay', values: [result.ordinaryGross] }]

  if (result.overtimeGross > 0) {
    rows.push({ label: 'Overtime', values: [result.overtimeGross] })
  }
  if (withOt.preTaxDeductions > 0) {
    rows.push({
      label: 'Pre-tax deductions',
      values: [withOt.preTaxDeductions],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  rows.push({
    label: 'PAYG tax',
    values: [withOt.payg],
    tone: 'out',
    sign: 'always-negative',
  })

  if (withOt.help > 0) {
    rows.push({
      label: 'Study loan',
      values: [withOt.help],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  const meals = result.mealAllowance

  rows.push({
    label: 'Take-home',
    values: [withOt.net],
    tone: 'net',
    total: meals.total === 0,
  })

  // No overtime means no N36 occasion, so this branch is unreachable today. It
  // is here because the alternative is a table that would silently drop a
  // figure if that ever stopped being true.
  if (meals.total > 0) {
    rows.push(mealAllowanceRow([meals.total], meals.occasions))
    rows.push({
      label: 'Total in the hand',
      values: [result.netTotal],
      tone: 'net',
      total: true,
    })
  }

  return rows
}

/**
 * The label each advanced category goes by, in the order they are shown.
 *
 * Super first because it is the biggest and the one nobody spends; union fees
 * last because they are the smallest and the one nobody thinks about. The two
 * in the middle are the two the Spendable line adds back, and keeping them
 * adjacent is what makes that addition readable rather than a lookup.
 */
export const ADVANCED_CATEGORY_LABELS = {
  superannuation: 'Super',
  livingExpenses: 'Living expenses',
  mealsAndEntertainment: 'Meals and entertainment',
  unionFees: 'Union fees',
} as const

/**
 * The four advanced categories as rows, in dollars at this fortnight's gross.
 *
 * Returned plain — no tone, no forced minus. The deductions panel shows the same
 * four figures as money leaving and adds that treatment itself; the result
 * panel's breakdown shows them as an account of where the total went, where a
 * column of minus signs would be arguing the same point twice.
 *
 * `superNote` is passed in rather than derived because only the caller knows how
 * the user said it — "5% of pay before tax" and "a set amount" are the same
 * figure reached two ways, and the row has to say which.
 */
export function advancedCategoryRows(
  breakdown: AdvancedBreakdown,
  superNote?: string,
): FigureRow[] {
  return [
    {
      label: ADVANCED_CATEGORY_LABELS.superannuation,
      note: superNote,
      values: [breakdown.superannuation],
    },
    { label: ADVANCED_CATEGORY_LABELS.livingExpenses, values: [breakdown.livingExpenses] },
    {
      label: ADVANCED_CATEGORY_LABELS.mealsAndEntertainment,
      values: [breakdown.mealsAndEntertainment],
    },
    { label: ADVANCED_CATEGORY_LABELS.unionFees, values: [breakdown.unionFees] },
  ]
}

/**
 * Where the pre-tax money went — the four categories and their total, run twice.
 *
 * **Two columns once there is overtime, for super's sake.** A percentage super
 * contribution is a share of the whole fortnight's gross, so overtime lifts it:
 * the money the overtime earned is not all take-home, and some of it went
 * straight past the user into their super. That is the one figure in this panel
 * that moves with the overtime, and a single column would state it without ever
 * saying which of the two numbers it was. The other three categories are set
 * amounts and sit unchanged either side, which is itself the answer to "did my
 * overtime cost me more packaging?".
 *
 * One column when there is no overtime. Two identical columns are not a
 * comparison — the same rule `breakdownRows` follows for the §5.4 table.
 *
 * Every category is shown whether or not it was used, unlike the comparison
 * table's conditional rows. The point of opening this panel is to check a split
 * you entered, and a category that silently vanishes when you clear it reads as
 * the app having lost it rather than as a zero.
 */
export function advancedDeductionRows(
  result: FortnightResult,
  advanced: AdvancedDeductions,
  superNote?: string,
): FigureTableData {
  const withOt = advancedBreakdownFor(result, advanced, true)
  const rows = advancedCategoryRows(withOt, superNote)
  const totalRow: FigureRow = {
    label: 'Taken before tax',
    values: [withOt.total],
    total: true,
  }

  if (result.overtimeGross === 0) return { rows: [...rows, totalRow] }

  const withoutOt = advancedBreakdownFor(result, advanced, false)
  const withoutRows = advancedCategoryRows(withoutOt)

  return {
    columns: [...COMPARISON_COLUMNS],
    rows: [
      ...rows.map((row, at) => ({
        ...row,
        values: [withoutRows[at].values[0], row.values[0]],
      })),
      { ...totalRow, values: [withoutOt.total, withOt.total] },
    ],
  }
}

/**
 * The split priced against one side of the comparison.
 *
 * Both sides matter because a percentage deduction genuinely would have been
 * smaller without the overtime — the same reason `comparePay` recomputes it on
 * each gross rather than holding it constant.
 */
export function advancedBreakdownFor(
  result: FortnightResult,
  advanced: AdvancedDeductions,
  withOvertime: boolean,
): AdvancedBreakdown {
  return advancedBreakdown(
    withOvertime ? result.withOt.gross : result.withoutOt.gross,
    advanced,
  )
}

/**
 * What the overtime did to the super contribution, in a sentence — or nothing
 * when there was no overtime to say it about.
 *
 * Never show an unexplained figure: a super line that reads $245.42 in one
 * column and $300.93 in the next has to say why it moved, and a set amount that
 * did *not* move has to say why it did not. Both answers are the same fact about
 * how the contribution was entered, which is why one function gives both.
 */
export function overtimeSuperSentence(
  result: FortnightResult,
  advanced: AdvancedDeductions,
): string | undefined {
  if (result.overtimeGross === 0) return undefined

  // Read from the split rather than inferred from the gap between the two
  // columns: a percentage small enough to move nothing at cent resolution is
  // still a percentage, and this sentence should not tell the user they entered
  // something they did not.
  if (advanced.superPercentOfGross === 0) {
    return 'Super is a set amount here, so your overtime does not change it.'
  }

  // **Rounded on each side before subtracting**, which is the one place this app
  // does not hold full precision to the display step (§3.13). The whole job of
  // this sentence is to explain the gap between two figures already rounded in
  // the columns beside it, so it has to be the gap a user gets doing the
  // subtraction themselves — a cent adrift from the numbers it is explaining
  // would be the app contradicting itself on one screen.
  const added =
    toCents(advancedBreakdownFor(result, advanced, true).superannuation) -
    toCents(advancedBreakdownFor(result, advanced, false).superannuation)

  return `Your overtime put ${formatMoney(
    added,
  )} more into super, because super is a percentage of the whole fortnight — overtime included.`
}

/** What `formatMoney` will make of a figure, as a number. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Take-home, the packaged money added back, and what that leaves to spend.
 *
 * Living expenses and meals and entertainment are the only two added: they never
 * reach the bank account, but they are paid to a mortgage, a rent payment or a
 * packaging card and are spent all the same. Super is locked away and union fees
 * are already spent, so counting either would overstate the answer by the
 * amount most plainly not available — which is why both are named in the note
 * rather than just left out.
 */
export function spendableRows(
  result: FortnightResult,
  breakdown: AdvancedBreakdown,
): FigureRow[] {
  // The same word the comparison table uses for the same figure. With a meal
  // allowance in it the line is "Total in the hand" there, and two names for one
  // number in one panel is how a user stops trusting either.
  const inTheHandLabel =
    result.mealAllowance.total > 0 ? 'Total in the hand' : 'Take-home'

  return [
    { label: inTheHandLabel, values: [result.netTotal], tone: 'net' },
    {
      label: ADVANCED_CATEGORY_LABELS.livingExpenses,
      note: 'Paid to your mortgage, rent or card',
      values: [breakdown.livingExpenses],
    },
    {
      label: ADVANCED_CATEGORY_LABELS.mealsAndEntertainment,
      note: 'Paid onto your card',
      values: [breakdown.mealsAndEntertainment],
    },
    {
      label: 'Spendable',
      note: 'Super and union fees are not in this — one is locked away, the other is already spent',
      values: [spendableTotal(result.netTotal, breakdown)],
      tone: 'net',
      total: true,
    },
  ]
}

/**
 * One row per attendance, beneath the Overtime line. The note is the same rate
 * breakdown the shift row shows (`describeAttendance`), so the two never
 * disagree about how a shift was worked.
 */
export function overtimeDerivationRows(
  attendances: readonly Attendance[],
): FigureRow[] {
  return attendances.map((attendance) => ({
    label: formatShortDate(attendance.startDate),
    note: describeAttendance(attendance).breakdown,
    values: [attendance.pay],
  }))
}

/**
 * One row per earned allowance, beneath the Meal allowance line.
 *
 * The label carries the meal period as well as the date, because a long pickup
 * earns one for each window it worked through and two rows dated the same day
 * would otherwise be indistinguishable — and `FigureTable` keys its rows on the
 * label, so they would also collide.
 */
export function mealDerivationRows(
  occasions: readonly MealOccasion[],
): FigureRow[] {
  return occasions.map((occasion) => {
    const rostered = formatHours(occasion.rosteredMinutes / 60)
    const over = formatHours(occasion.overrunMinutes / 60)
    // Which shift placed the boundary is part of the working, not decoration: on
    // an overrun the shift was never entered, so a user checking this figure
    // needs to see which pattern the app assumed before they can agree with it.
    const shift = occasion.shiftInferred
      ? `${occasion.rosterCode} shift it ran on from`
      : `${occasion.rosterCode} shift`

    return {
      label: `${formatShortDate(occasion.date)} ${occasion.rosterCode} shift`,
      note: `${over} past the ${rostered} ${shift} — a second meal break is owed`,
      values: [occasion.amount],
    }
  })
}

/**
 * §5.7 "Meal allowance" — the N36 rule, the Annex C rate, and this fortnight's
 * count.
 *
 * Shown whether or not any were earned, unlike the comparison's row. A
 * paramedic checking a payslip against this app needs to be able to see the
 * four windows and decide for themselves whether payroll got it right, and a
 * section that only appears once the app already agrees with them is no use for
 * that. Zero occasions is a finding, not an empty state.
 */
export function mealAllowanceRows(result: FortnightResult): FigureRow[] {
  const meals = result.mealAllowance
  const count = meals.occasions.length

  return [
    {
      label: 'Per occasion',
      note: `${MEAL_CLAUSE} · Annex C · not taxed`,
      values: [meals.ratePerOccasion],
    },
    {
      label: 'Occasions',
      note:
        count === 0
          ? 'No 10-hour shift ran an hour or more over'
          : 'One per 10-hour shift that ran an hour or more over',
      values: [String(count)],
    },
    {
      label: 'Meal allowance',
      note: 'Added after tax — the PAYG figure above does not include it',
      values: [meals.total],
      total: true,
    },
  ]
}

/**
 * The rule under the meal allowance table, with its own figures in it.
 *
 * Built here rather than written into the component so the thresholds cannot
 * drift apart from the engine's constants: if the ten hours or the hour ever
 * change, this sentence changes with them.
 */
export function mealRuleSentence(): string {
  const shift = formatHours(MEAL_ALLOWANCE_SHIFT_MINUTES / 60)
  const over = formatHours(MEAL_ALLOWANCE_OVERRUN_MINUTES / 60)
  return `A ${shift} shift that runs ${over} or more over earns one allowance (EBA N36). Worked to time it earns nothing, whether or not you got a break.`
}

/**
 * §5.7 "Ordinary fortnightly pay" — how base becomes the fortnightly figure.
 *
 * Concept first, clause second: the composite penalties and the roster
 * adjustment are named by what they are and pinned to the EBA clause, never the
 * bare allowance code. The fortnightly total is the table-derived figure; a
 * user who overrode it typed their own and knows.
 */
export function ordinaryPayRows(settings: FortnightSettings): FigureRow[] {
  const { band } = settings
  const rosterAdjustment = band.annualBase * ROSTER_ADJUSTMENT_RATE
  const composite = band.annexATotal - band.annualBase
  const compositePct = (band.annexATotal / band.annualBase - 1) * 100
  const annualTotal = band.annexATotal + rosterAdjustment

  return [
    {
      label: 'Base salary',
      // The copy deck's rate-currency rule: never show a table-derived figure
      // with nothing said about which rates produced it. This is the working,
      // so it is the one place the date belongs beside the salary itself.
      note: `${band.classification} Step ${band.step} · per year · rates effective ${formatIsoDateAu(
        RATES_EFFECTIVE_FROM,
      )}`,
      values: [band.annualBase],
    },
    {
      label: 'Composite penalties',
      note: `${compositePct.toFixed(2)}% (EBA N25.1)`,
      values: [composite],
    },
    {
      label: 'Roster adjustment',
      note: `${(ROSTER_ADJUSTMENT_RATE * 100).toFixed(2)}% of base (EBA N44)`,
      values: [rosterAdjustment],
    },
    {
      label: 'Fortnightly ordinary pay',
      note: `${formatMoney(annualTotal)} × 12 ÷ 313`,
      values: [ordinaryFortnightlyGross(band)],
      total: true,
    },
  ]
}

/**
 * §5.7 "Overtime rate" — base only, never the composite (EBA N34.1, the §3.2
 * trap). The base hourly rate is derived, then each multiplier the cohort can
 * attract. These are reference rates, shown whether or not this fortnight used
 * them, because the section exists to teach the structure.
 */
export function overtimeRateRows(settings: FortnightSettings): FigureRow[] {
  const { annualBase } = settings.band
  const perHour = (multiplier: number) =>
    `${formatMoney(otHourlyRate(annualBase, multiplier))}/h`

  return [
    {
      label: 'Base hourly rate',
      note: `${formatMoney(annualBase)} × 12 ÷ 313 ÷ 76 · base only (EBA N34.1)`,
      values: [perHour(1)],
    },
    {
      label: 'Time and a half',
      note: 'Mon–Fri, first 2 hours',
      values: [perHour(1.5)],
    },
    {
      label: 'Double time',
      note: 'Saturday, Sunday, Mon–Fri after 2 hours',
      values: [perHour(2)],
    },
    {
      label: 'Public holiday',
      note: '2.5×',
      values: [perHour(2.5)],
    },
  ]
}

/**
 * §5.7 "PAYG withholding" — the NAT 1004 line. The scale and financial year
 * come from the resolved tax scale, so a stale schedule names itself here (§3.8)
 * rather than being hidden behind a number the user cannot place.
 */
export function paygRows(
  settings: FortnightSettings,
  result: FortnightResult,
): FigureRow[] {
  const { withOt } = result
  const scale = settings.taxScale
  const scaleName = `ATO NAT 1004, Scale ${scale.scale}, FY${scale.financialYear.replace('-', '–')}`
  const rows: FigureRow[] = [
    {
      label: 'Taxed on',
      note:
        withOt.preTaxDeductions > 0
          ? `after ${formatMoney(withOt.preTaxDeductions)} pre-tax`
          : undefined,
      values: [withOt.taxableGross],
    },
  ]

  rows.push({
    // "PAYG tax" everywhere, including inside the working — the copy deck
    // rejects "withholding" as jargon, and this is the same figure the
    // comparison table names, so it must read the same way.
    label: 'PAYG tax',
    note: scaleName,
    values: [withOt.payg],
    total: true,
  })

  return rows
}
