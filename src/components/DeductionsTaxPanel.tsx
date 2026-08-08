import { PACKAGING_CAPS } from '../data'
import { parseAmount, parsePercent } from '../app/inputs'
import { computeDeductions, packagingFlags } from '../engine/packaging'
import type { DeductionSettings } from '../engine/packaging'
import {
  AssumptionNote,
  FigureTable,
  TextField,
  Toggle,
  formatMoney,
} from '../ui/index'
import type { FigureRow } from '../ui/index'

export interface DeductionsTaxPanelProps {
  /** Raw field contents. Whole dollars per fortnight; `''` is none. */
  fixedInput: string
  /** Raw field contents. Whole percents, so `'5'` means 5%. */
  percentInput: string
  onFixedInputChange: (value: string) => void
  onPercentInputChange: (value: string) => void
  claimsTaxFreeThreshold: boolean
  hasStudyDebt: boolean
  onClaimsTaxFreeThresholdChange: (claimed: boolean) => void
  onHasStudyDebtChange: (has: boolean) => void
  /** The fortnight's gross including overtime — what the percentage bites on. */
  gross: number
}

/**
 * Deductions and tax (§5.6).
 *
 * The live arithmetic panel is the whole reason this screen works. Two
 * deduction boxes interacting is the part people get wrong, and showing the
 * subtraction as it happens is cheaper than any amount of explanation: the
 * percentage is taken on the *full* gross including overtime, which is why a
 * big overtime fortnight packages more than a quiet one.
 *
 * The arithmetic is computed by the engine's own `computeDeductions`, not
 * re-derived here. A display that agrees with the tax calculation only by
 * coincidence is how a calculator ends up contradicting itself on screen.
 */
export function DeductionsTaxPanel({
  fixedInput,
  percentInput,
  onFixedInputChange,
  onPercentInputChange,
  claimsTaxFreeThreshold,
  hasStudyDebt,
  onClaimsTaxFreeThresholdChange,
  onHasStudyDebtChange,
  gross,
}: DeductionsTaxPanelProps) {
  const settings = deductionSettingsFrom(fixedInput, percentInput)
  const deductions = computeDeductions(gross, settings)
  const flags = packagingFlags(deductions, PACKAGING_CAPS, hasStudyDebt)

  const percentLabel = percentInput.replace(/[\s%]/g, '')

  const rows: FigureRow[] = [{ label: 'Gross incl. OT', values: [gross] }]
  if (deductions.fixed > 0) {
    rows.push({
      label: 'Set amount',
      values: [deductions.fixed],
      tone: 'out',
      sign: 'always-negative',
    })
  }
  if (deductions.percent > 0) {
    rows.push({
      label: `${percentLabel}% of gross`,
      values: [deductions.percent],
      tone: 'out',
      sign: 'always-negative',
    })
  }
  rows.push({
    label: 'Taxed on',
    values: [gross - deductions.total],
    total: true,
  })

  const capFlag = flags.find((flag) => flag.kind === 'packaging-cap-exceeded')
  const helpFlag = flags.find((flag) => flag.kind === 'packaging-help-interaction')

  return (
    <div className="sl-stack">
      <div>
        <h3 className="sl-heading">Pre-tax deductions</h3>
        <p className="sl-caption">
          Salary packaging comes out before tax is calculated.
        </p>
      </div>

      <TextField
        label="Set amount per fortnight"
        value={fixedInput}
        onChange={onFixedInputChange}
        prefix="$"
        numeric
      />
      <TextField
        label="Percentage of gross"
        value={percentInput}
        onChange={onPercentInputChange}
        suffix="%"
        numeric
        hint="Calculated on your full fortnight gross including overtime."
      />

      <FigureTable caption="Pre-tax deductions" rows={rows} />

      {capFlag ? (
        <AssumptionNote>
          <p>
            That annualises to {formatMoney(capFlag.annualised)}, above the{' '}
            {formatMoney(capFlag.cap)} FBT-exempt cap for living expenses. Worth
            checking with your packaging provider — the app still works it out
            as entered.
          </p>
        </AssumptionNote>
      ) : null}

      <div>
        <h3 className="sl-heading">Tax</h3>
      </div>

      <Toggle
        label="Tax-free threshold claimed"
        checked={claimsTaxFreeThreshold}
        onChange={onClaimsTaxFreeThresholdChange}
        description="On for the job you're paid the most by. Off means more tax withheld each pay."
      />
      <Toggle
        label="Study or training loan"
        checked={hasStudyDebt}
        onChange={onHasStudyDebtChange}
        description="HELP, VET, SFSS and the rest — withheld on top of PAYG tax."
      />

      {helpFlag ? (
        <AssumptionNote>
          <p>
            Packaging lowers the study loan repayment withheld each pay, but not
            what you owe at tax time. The annual assessment adds the packaged
            amount back in.
          </p>
        </AssumptionNote>
      ) : null}
    </div>
  )
}

/**
 * The two fields as the engine wants them: dollars, and a fraction of gross.
 *
 * Exported because the calculator feeds the same two strings to the engine
 * for the real calculation, and both sides parsing them the same way is what
 * keeps the panel's arithmetic and the take-home figure in agreement.
 */
export function deductionSettingsFrom(
  fixedInput: string,
  percentInput: string,
): DeductionSettings {
  return {
    fixedPerFortnight: parseAmount(fixedInput) ?? 0,
    percentOfGross: parsePercent(percentInput) ?? 0,
  }
}
