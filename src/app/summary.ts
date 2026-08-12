import type { Attendance } from '../engine/attendance'
import type { FortnightResult } from '../engine/fortnight'
import { advancedBreakdown, spendableTotal } from '../engine/packaging'
import type { AdvancedDeductions } from '../engine/packaging'
import { formatHours, formatKept, formatMoney } from '../ui/index'
import { formatShortDate, formatTimeRange } from './dates'
import { describeAttendance } from './shifts'

/** The copy deck's disclaimer, as one line. See `ui/Disclaimer.tsx`. */
export const DISCLAIMER =
  'Estimate only, based on the ACTAS Enterprise Agreement 2023–2026 and ATO withholding schedules. Not payroll advice. Check your payslip.'

export interface SummaryInput {
  result: FortnightResult
  /** `AP1 Step 2` — which band produced these figures. */
  bandSummary: string
  /** The §3.8 fallback captions, if any. They change what the figures mean. */
  captions?: readonly string[]
  /**
   * The advanced deduction split, when the user has one. Its Spendable figure
   * travels with the text for the same reason the shifts and the tax line do: it
   * is the figure someone in advanced mode is actually quoting, and a
   * take-home-only summary would understate what they have by the packaged
   * amount they still spend.
   */
  advancedDeductions?: AdvancedDeductions | null
}

/**
 * The fortnight as plain text, for sharing or pasting.
 *
 * Someone deciding whether to take a shift asks their partner, or shows the
 * roster officer. That conversation happens outside this app, and a screenshot
 * of a number with no working is exactly the thing §5.7 exists to prevent — so
 * what leaves the device carries its shifts, its tax line and its disclaimer
 * with it.
 *
 * Pure, and deliberately not a URL. Encoding a fortnight into a link would put
 * someone's pay band and roster into a string that gets pasted into a group
 * chat; "nothing you enter leaves this device" is a promise the app keeps by
 * having no such feature.
 */
export function summaryText({
  result,
  bandSummary,
  captions = [],
  advancedDeductions = null,
}: SummaryInput): string {
  const lines: string[] = ['ACTAS OT Calculator — estimate', '']

  if (result.overtimeGross > 0) {
    lines.push(
      `Your OT adds ${formatMoney(result.otNetTotal)} take-home`,
      `from ${formatMoney(result.otEarnedTotal)} before tax · ${formatKept(
        result.otNetTotal,
        result.otEarnedTotal,
      )}`,
      '',
      'Overtime shifts',
      ...result.attendances.map(shiftLine),
      '',
      'Fortnight            Without OT      With OT',
      ...comparisonLines(result),
    )
    // The shift and the overrun are named rather than just the total, because
    // this text is read away from the app — often beside a payslip — and "$35.38"
    // with no clause and no shift behind it is exactly the unexplained figure
    // §5.7 exists to prevent.
    if (result.mealAllowance.total > 0) {
      lines.push('', 'Meal allowance (tax free, EBA N36)', ...mealLines(result))
    }
  } else {
    // No overtime is still a fortnight worth sharing — it is the baseline the
    // question "was that shift worth it" is asked against.
    lines.push(
      `Take-home this fortnight: ${formatMoney(result.withOt.net)}`,
      '',
      `Base pay          ${formatMoney(result.withOt.gross)}`,
      `PAYG tax          ${formatMoney(result.withOt.payg)}`,
      ...(result.withOt.help > 0
        ? [`Study loan        ${formatMoney(result.withOt.help)}`]
        : []),
      `Take-home         ${formatMoney(result.withOt.net)}`,
    )
  }

  if (advancedDeductions !== null) {
    lines.push('', ...spendableLines(result, advancedDeductions))
  }

  lines.push('', bandSummary, ...captions, '', DISCLAIMER)

  // Collapse the runs of blank lines a missing section can leave behind.
  return lines
    .filter((line, at) => line !== '' || lines[at - 1] !== '')
    .join('\n')
    .trim()
}

/**
 * The advanced split's Spendable block.
 *
 * Every category is named, including the two that are not added in — a Spendable
 * figure with no account of what was left out is exactly the unexplained figure
 * this text exists to avoid, and it is read away from the app where nothing can
 * be tapped to find out.
 */
function spendableLines(
  result: FortnightResult,
  advanced: AdvancedDeductions,
): string[] {
  const breakdown = advancedBreakdown(result.withOt.gross, advanced)
  // 26 clears the longest label here — `+ Meals and entertainment` — so the
  // figures stay in one column. A label that outgrew the pad would push its own
  // amount right and break the alignment for that line alone.
  const line = (label: string, amount: number) =>
    `${label.padEnd(26)}${formatMoney(amount).padStart(11)}`

  return [
    'Pre-tax deductions',
    line('Super', breakdown.superannuation),
    line('Living expenses', breakdown.livingExpenses),
    line('Meals and entertainment', breakdown.mealsAndEntertainment),
    line('Union fees', breakdown.unionFees),
    '',
    line(
      result.mealAllowance.total > 0 ? 'Total in the hand' : 'Take-home',
      result.netTotal,
    ),
    line('+ Living expenses', breakdown.livingExpenses),
    line('+ Meals and entertainment', breakdown.mealsAndEntertainment),
    line('Spendable', spendableTotal(result.netTotal, breakdown)),
    'Super and union fees are not in this — one is locked away, the other is already spent.',
  ]
}

/** `Wed 19 Aug AM shift · 1.5h over        $35.38`, one per occasion. */
function mealLines(result: FortnightResult): string[] {
  return result.mealAllowance.occasions.map((occasion) =>
    [
      `${formatShortDate(occasion.date)} ${occasion.rosterCode} shift · ${formatHours(
        occasion.overrunMinutes / 60,
      )} over`.padEnd(38),
      formatMoney(occasion.amount).padStart(9),
    ].join(''),
  )
}

/** `Sat 15 Aug 09:00–19:00 · 10h · all at 2× (Saturday) · $982.98`. */
function shiftLine(attendance: Attendance): string {
  const { breakdown } = describeAttendance(attendance)
  return [
    `${formatShortDate(attendance.startDate)} ${formatTimeRange(
      attendance.startMin,
      attendance.endMin,
    )}`,
    breakdown,
    formatMoney(attendance.pay),
  ].join(' · ')
}

/**
 * The with/without table, as fixed-width columns.
 *
 * Padded rather than tabbed: a tab lands wherever the receiving app's tab stops
 * happen to be, and this is read in a message thread more often than anywhere
 * else.
 */
function comparisonLines(result: FortnightResult): string[] {
  const rows: [string, number, number][] = [
    ['Base pay', result.ordinaryGross, result.ordinaryGross],
    ['Overtime', 0, result.overtimeGross],
  ]

  if (result.withOt.preTaxDeductions > 0 || result.withoutOt.preTaxDeductions > 0) {
    rows.push([
      'Pre-tax deductions',
      -result.withoutOt.preTaxDeductions,
      -result.withOt.preTaxDeductions,
    ])
  }

  rows.push(['PAYG tax', -result.withoutOt.payg, -result.withOt.payg])

  if (result.withOt.help > 0 || result.withoutOt.help > 0) {
    rows.push(['Study loan', -result.withoutOt.help, -result.withOt.help])
  }

  rows.push(['Take-home', result.withoutOt.net, result.withOt.net])

  // Below the tax lines, for the same reason it sits there on screen: an
  // untaxed amount printed above PAYG reads as though PAYG took a cut of it.
  if (result.mealAllowance.total > 0) {
    rows.push(['Meal allowance', 0, result.mealAllowance.total])
    rows.push(['Total in the hand', result.withoutOt.net, result.netTotal])
  }

  return rows.map(([label, without, with_]) =>
    [
      label.padEnd(20),
      formatMoney(without, { sign: 'auto' }).padStart(12),
      formatMoney(with_, { sign: 'auto' }).padStart(13),
    ].join(''),
  )
}
