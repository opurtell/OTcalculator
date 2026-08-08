import type { PayComparison } from '../engine/fortnight'
import type { QuickOvertime } from '../engine/overtime'
import { CATEGORY_LABEL } from '../engine/types'
import {
  AssumptionNote,
  Button,
  FigureTable,
  Panel,
  ResultPanel,
  TextField,
  formatHours,
  formatMoney,
} from '../ui/index'
import type { FigureRow } from '../ui/index'

export interface QuickHoursFieldProps {
  hoursInput: string
  onHoursInputChange: (value: string) => void
  /** Switches to the fortnight pathway from the assumption note. */
  onUseFortnight: () => void
}

/**
 * The quick pathway's whole input: one number (§5.2).
 *
 * The assumption note is always expanded and never dismissible. It is not
 * decoration — this pathway knows no date and no shift kind, so it cannot see
 * a Saturday, a Sunday, a public holiday or the four-hour minimum, and every
 * one of those pays *more* than what it shows.
 *
 * **The brief's copy says "Mon–Sat" here and that is wrong.** N34 overrides
 * C9.12 for this cohort and puts Saturday at double time from the first
 * minute, so the 1.5× opening tier is a Mon–Fri assumption only. Describing it
 * as Mon–Sat would understate a Saturday by the difference between 1.5× and 2×
 * on the first two hours — about $48 on the golden fixture's pickup.
 */
export function QuickHoursField({
  hoursInput,
  onHoursInputChange,
  onUseFortnight,
}: QuickHoursFieldProps) {
  return (
    <Panel>
      <div className="sl-stack">
        <TextField
          label="How many hours?"
          value={hoursInput}
          onChange={onHoursInputChange}
          suffix="h"
          numeric
        />
        <AssumptionNote>
          <p>
            Rough estimate. Assumes one Mon–Fri shift: 2h at time and a half,
            then double time. No Saturday, Sunday, public holiday or 4-hour
            minimum applied — every one of those pays more.
          </p>
          <p>
            <Button variant="ghost" onClick={onUseFortnight}>
              Use the fortnight calculator for an accurate figure →
            </Button>
          </p>
        </AssumptionNote>
      </div>
    </Panel>
  )
}

export interface QuickResultProps {
  comparison: PayComparison
  overtime: QuickOvertime
}

/**
 * What those hours are worth in the hand.
 *
 * "Adds about" is doing real work in that label and the copy deck keeps it:
 * the overtime figure is a simplification, and the net figure on top of it is
 * a withholding estimate. The word is the difference between an estimate and a
 * promise.
 *
 * The net figure comes from running the whole fortnight twice — the same path
 * the fortnight calculator takes — so the two pathways cannot disagree about
 * what the same overtime is worth.
 */
export function QuickResult({ comparison, overtime }: QuickResultProps) {
  const rows: FigureRow[] = overtime.tiers.map((tier) => ({
    label: `${formatHours(tier.hours)} at ${CATEGORY_LABEL[tier.category]}`,
    note: `${formatMoney(tier.hourlyRate)} an hour`,
    values: [tier.pay],
  }))

  rows.push({
    label: 'Before tax',
    values: [comparison.overtimeGross],
    total: true,
  })

  return (
    <ResultPanel
      label="Adds about"
      amount={comparison.otNetDelta}
      beforeTax={comparison.otGrossDelta}
      sticky
    >
      <FigureTable caption="How the overtime was worked out" rows={rows} />
    </ResultPanel>
  )
}
