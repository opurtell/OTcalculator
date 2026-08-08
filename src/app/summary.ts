import type { Attendance } from '../engine/attendance'
import type { FortnightResult } from '../engine/fortnight'
import { formatKept, formatMoney } from '../ui/index'
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
export function summaryText({ result, bandSummary, captions = [] }: SummaryInput): string {
  const lines: string[] = ['ACTAS OT Calculator — estimate', '']

  if (result.overtimeGross > 0) {
    lines.push(
      `Your OT adds ${formatMoney(result.otNetDelta)} take-home`,
      `from ${formatMoney(result.otGrossDelta)} before tax · ${formatKept(
        result.otNetDelta,
        result.otGrossDelta,
      )}`,
      '',
      'Overtime shifts',
      ...result.attendances.map(shiftLine),
      '',
      'Fortnight            Without OT      With OT',
      ...comparisonLines(result),
    )
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

  lines.push('', bandSummary, ...captions, '', DISCLAIMER)

  // Collapse the runs of blank lines a missing section can leave behind.
  return lines
    .filter((line, at) => line !== '' || lines[at - 1] !== '')
    .join('\n')
    .trim()
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

  return rows.map(([label, without, with_]) =>
    [
      label.padEnd(20),
      formatMoney(without, { sign: 'auto' }).padStart(12),
      formatMoney(with_, { sign: 'auto' }).padStart(13),
    ].join(''),
  )
}
