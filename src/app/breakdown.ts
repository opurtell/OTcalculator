/**
 * The result panel's figure rows (§5.4, §5.7) as pure data.
 *
 * Kept out of the component so the row-shaping is unit-testable without
 * rendering, the same way `warnings.ts` and `shifts.ts` keep their logic. Every
 * figure passes through unchanged from the engine — full precision held until
 * `FigureTable`/`formatMoney` round it for display (§3.12).
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
 *   `paygRows`) — the §5.7 trust-building derivation: concept first, clause
 *   reference second.
 */

import type { Attendance } from '../engine/attendance'
import { ordinaryFortnightlyGross, ROSTER_ADJUSTMENT_RATE } from '../engine/tax'
import { otHourlyRate } from '../engine/overtime'
import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import { describeAttendance } from './shifts'
import { formatShortDate } from './dates'
import { formatMoney } from '../ui/format'
import type { FigureRow } from '../ui/FigureTable'

/**
 * "Not applicable" in the without-OT column. A bare `0.00` would read as a
 * figure claiming to be disclosure; the dash says plainly that the line did not
 * exist on that side. Em dash, not the money minus, so it is not mistaken for a
 * deduction.
 */
const NOT_APPLICABLE = '—'

export interface FigureTableData {
  columns: string[]
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

  rows.push({
    label: 'Take-home',
    values: [withoutOt.net, withOt.net],
    tone: 'net',
    total: true,
  })

  return { columns: [...COMPARISON_COLUMNS], rows }
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

  rows.push({
    label: 'Take-home',
    values: [withOt.net],
    tone: 'net',
    total: true,
  })

  return rows
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
      note: `${band.classification} Step ${band.step} · per year`,
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
    label: 'PAYG withheld',
    note: scaleName,
    values: [withOt.payg],
    total: true,
  })

  return rows
}
