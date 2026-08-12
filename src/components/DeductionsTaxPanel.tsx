import { parseAmount, parsePercent, percentInputFor } from '../app/inputs'
import { advancedCategoryRows } from '../app/breakdown'
import { activeAdvancedDeductions, deductionSettingsFor } from '../app/settings'
import type {
  AdvancedDeductionChoice,
  DeductionChoice,
  SuperMode,
} from '../app/settings'
import {
  advancedBreakdown,
  computeDeductions,
  packagingFlags,
} from '../engine/packaging'
import type { AdvancedBreakdown, DeductionSettings } from '../engine/packaging'
import {
  AssumptionNote,
  FigureTable,
  SegmentedControl,
  TextField,
  Toggle,
  formatMoney,
} from '../ui/index'
import type { FigureRow } from '../ui/index'

/**
 * Advanced mode's fields, held as the strings the user typed (`app/inputs.ts`),
 * plus the two switches that decide which of them are live.
 *
 * One object rather than seven props and seven callbacks: the panel does not
 * make a decision about any of them individually, and a patch-shaped callback
 * keeps the switch between the two super fields from needing its own wiring.
 */
export interface AdvancedDeductionInputs {
  enabled: boolean
  superMode: SuperMode
  /** Whole percents, so `'5'` means 5%. */
  superPercentInput: string
  /** Whole dollars per fortnight. */
  superAmountInput: string
  livingExpensesInput: string
  mealsEntertainmentInput: string
  unionFeesInput: string
}

export const EMPTY_ADVANCED_INPUTS: AdvancedDeductionInputs = {
  enabled: false,
  superMode: 'percent',
  superPercentInput: '',
  superAmountInput: '',
  livingExpensesInput: '',
  mealsEntertainmentInput: '',
  unionFeesInput: '',
}

export interface DeductionsTaxPanelProps {
  /** Raw field contents. Whole dollars per fortnight; `''` is none. */
  fixedInput: string
  /** Raw field contents. Whole percents, so `'5'` means 5%. */
  percentInput: string
  onFixedInputChange: (value: string) => void
  onPercentInputChange: (value: string) => void
  /** The advanced split. Ignored for every figure while `enabled` is false. */
  advanced: AdvancedDeductionInputs
  onAdvancedChange: (patch: Partial<AdvancedDeductionInputs>) => void
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
 *
 * **Advanced mode splits the same money four ways and changes no tax figure.**
 * One field over several unrelated things is enough to withhold tax on and not
 * enough to answer "what have I actually got to spend" (trap 6), so the split
 * names the categories: super, living expenses, meals and entertainment, union
 * fees. Only super gets a percentage option, because only super is normally
 * stated as one — and it bites on the whole fortnight before anything else comes
 * out, exactly as the single percentage field always has. What the split buys is
 * the Spendable figure in the result panel; the withholding calculation still
 * sees one fixed amount and one percentage.
 */
export function DeductionsTaxPanel({
  fixedInput,
  percentInput,
  onFixedInputChange,
  onPercentInputChange,
  advanced,
  onAdvancedChange,
  claimsTaxFreeThreshold,
  hasStudyDebt,
  onClaimsTaxFreeThresholdChange,
  onHasStudyDebtChange,
  gross,
}: DeductionsTaxPanelProps) {
  const settings = deductionSettingsFrom(fixedInput, percentInput, advanced)
  const deductions = computeDeductions(gross, settings)
  const flags = packagingFlags(deductions, hasStudyDebt)
  const breakdown = advancedBreakdownFor(gross, advanced)

  const helpFlag = flags.find((flag) => flag.kind === 'packaging-help-interaction')

  return (
    <div className="sl-stack">
      <div>
        <h3 className="sl-heading">Pre-tax deductions</h3>
        <p className="sl-caption">
          Salary packaging, or super you salary sacrifice. It comes out before
          tax is calculated.
        </p>
      </div>

      <Toggle
        label="Advanced"
        checked={advanced.enabled}
        onChange={(enabled) => onAdvancedChange({ enabled })}
        description="Split it by where the money goes, and see what that leaves you to spend."
      />

      {advanced.enabled ? (
        <AdvancedFields advanced={advanced} onChange={onAdvancedChange} />
      ) : (
        <>
          <TextField
            label="Set amount per fortnight"
            value={fixedInput}
            onChange={onFixedInputChange}
            prefix="$"
            numeric
          />
          <TextField
            label="Percentage of pay before tax"
            value={percentInput}
            onChange={onPercentInputChange}
            suffix="%"
            numeric
            hint="Worked out on your whole fortnight before tax, overtime included."
          />
        </>
      )}

      <FigureTable
        caption="Pre-tax deductions"
        rows={
          advanced.enabled
            ? advancedArithmeticRows(gross, breakdown, superNoteFor(advanced), deductions.total)
            : simpleArithmeticRows(gross, deductions, percentInput)
        }
      />

      {advanced.enabled && breakdown.capped ? (
        <AssumptionNote>
          <p>
            Those add up to {formatMoney(breakdown.requested)}, which is more
            than the {formatMoney(gross)} this fortnight pays. Each one above is
            scaled back to fit, because nothing can come out of pay that isn't
            there.
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
        description="On for the job you're paid the most by. Off means more tax comes out each pay."
      />
      <Toggle
        label="Study or training loan"
        checked={hasStudyDebt}
        onChange={onHasStudyDebtChange}
        description="HELP, VET, SFSS and the rest — comes out on top of PAYG tax."
      />

      {helpFlag ? (
        <AssumptionNote>
          <p>
            Packaging lowers the study loan repayment taken each pay, but not
            what you owe at tax time. The annual assessment adds the packaged
            amount back in.
          </p>
        </AssumptionNote>
      ) : null}
    </div>
  )
}

/**
 * The four categories' fields.
 *
 * Super carries the percentage/set-amount choice; the other three are dollars
 * only, because none of them is a figure anybody states as a share of their
 * salary — a union fee and a rent payment are amounts, and offering a percentage
 * box for them would invite a number that means nothing.
 *
 * Switching the super control swaps which field is shown and leaves the other
 * one's contents alone, so changing your mind about how to say it costs you
 * nothing. `activeAdvancedDeductions` is what makes that safe: the field that is
 * not shown is not applied either.
 */
function AdvancedFields({
  advanced,
  onChange,
}: {
  advanced: AdvancedDeductionInputs
  onChange: (patch: Partial<AdvancedDeductionInputs>) => void
}) {
  return (
    <>
      <SegmentedControl<SuperMode>
        label="Pre-tax super contribution"
        value={advanced.superMode}
        onChange={(superMode) => onChange({ superMode })}
        options={[
          { value: 'percent', label: 'Percentage' },
          { value: 'amount', label: 'Set amount' },
        ]}
      />
      {advanced.superMode === 'percent' ? (
        <TextField
          label="Super, percentage of pay before tax"
          value={advanced.superPercentInput}
          onChange={(superPercentInput) => onChange({ superPercentInput })}
          suffix="%"
          numeric
          hint="Worked out on your whole fortnight before tax, overtime included, and before anything else comes out."
        />
      ) : (
        <TextField
          label="Super, set amount per fortnight"
          value={advanced.superAmountInput}
          onChange={(superAmountInput) => onChange({ superAmountInput })}
          prefix="$"
          numeric
        />
      )}
      <TextField
        label="Living expenses per fortnight"
        value={advanced.livingExpensesInput}
        onChange={(livingExpensesInput) => onChange({ livingExpensesInput })}
        prefix="$"
        numeric
        hint="Mortgage, rent, and anything else on the living-expenses card."
      />
      <TextField
        label="Meals and entertainment per fortnight"
        value={advanced.mealsEntertainmentInput}
        onChange={(mealsEntertainmentInput) => onChange({ mealsEntertainmentInput })}
        prefix="$"
        numeric
      />
      <TextField
        label="Union fees per fortnight"
        value={advanced.unionFeesInput}
        onChange={(unionFeesInput) => onChange({ unionFeesInput })}
        prefix="$"
        numeric
      />
    </>
  )
}

// "Before tax", never "gross" — the copy deck rules the word out as jargon, and
// this table is the one place a user checks the app's arithmetic against their
// own head.
const BEFORE_TAX_LABEL = 'Before tax, incl. OT'

/** The two-field arithmetic: what came out, and what is left to tax. */
function simpleArithmeticRows(
  gross: number,
  deductions: { fixed: number; percent: number; total: number },
  percentInput: string,
): FigureRow[] {
  const percentLabel = percentInput.replace(/[\s%]/g, '')
  const rows: FigureRow[] = [{ label: BEFORE_TAX_LABEL, values: [gross] }]

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
      label: `${percentLabel}% of pay before tax`,
      values: [deductions.percent],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  rows.push({ label: 'Taxed on', values: [gross - deductions.total], total: true })
  return rows
}

/**
 * The same arithmetic, four lines instead of two.
 *
 * Every category is listed whether or not it was filled in, which the two-field
 * version deliberately does not do. The difference is that this is a form the
 * user has just filled in category by category: a line that disappears when you
 * clear it reads as the app having lost it, where an unused row in a list you
 * chose to open reads as a zero.
 */
function advancedArithmeticRows(
  gross: number,
  breakdown: AdvancedBreakdown,
  superNote: string | undefined,
  total: number,
): FigureRow[] {
  return [
    { label: BEFORE_TAX_LABEL, values: [gross] },
    ...advancedCategoryRows(breakdown, superNote).map((row) => ({
      ...row,
      tone: 'out' as const,
      sign: 'always-negative' as const,
    })),
    { label: 'Taxed on', values: [gross - total], total: true },
  ]
}

/** `5% of pay before tax`, or nothing when super was entered as an amount. */
export function superNoteFor(
  advanced: AdvancedDeductionInputs,
): string | undefined {
  if (advanced.superMode !== 'percent') return undefined
  const percent = parsePercent(advanced.superPercentInput)
  if (percent === null || percent === 0) return undefined
  return `${percentInputFor(percent)}% of pay before tax`
}

function advancedBreakdownFor(
  gross: number,
  advanced: AdvancedDeductionInputs,
): AdvancedBreakdown {
  return advancedBreakdown(gross, activeAdvancedDeductions(advancedChoiceFrom(advanced)))
}

/**
 * The advanced fields as figures. Every string parsed the one way
 * (`app/inputs.ts`), so the panel's arithmetic and the take-home figure cannot
 * come from two different readings of the same box.
 */
export function advancedChoiceFrom(
  advanced: AdvancedDeductionInputs,
): AdvancedDeductionChoice {
  return {
    enabled: advanced.enabled,
    superMode: advanced.superMode,
    superPercentOfGross: parsePercent(advanced.superPercentInput) ?? 0,
    superPerFortnight: parseAmount(advanced.superAmountInput) ?? 0,
    livingExpenses: parseAmount(advanced.livingExpensesInput) ?? 0,
    mealsAndEntertainment: parseAmount(advanced.mealsEntertainmentInput) ?? 0,
    unionFees: parseAmount(advanced.unionFeesInput) ?? 0,
  }
}

/**
 * The fields as the engine wants them: dollars, and a fraction of gross.
 *
 * Exported because the calculator feeds the same strings to the engine for the
 * real calculation, and both sides parsing them the same way is what keeps the
 * panel's arithmetic and the take-home figure in agreement.
 *
 * In advanced mode the four categories collapse to the same two knobs — the
 * three value-only categories and a dollar super contribution become the fixed
 * amount, a percentage super contribution becomes the percentage. That is the
 * reason nothing in `src/engine/` had to learn about the split.
 */
export function deductionSettingsFrom(
  fixedInput: string,
  percentInput: string,
  advanced: AdvancedDeductionInputs = EMPTY_ADVANCED_INPUTS,
): DeductionSettings {
  return deductionSettingsFor(deductionChoiceFrom(fixedInput, percentInput, advanced))
}

/**
 * The persisted deduction record: the two simple figures, plus the advanced
 * split when there is one to keep.
 *
 * The simple fields survive a trip through advanced mode and back, the same way
 * the two super fields survive the switch between them — turning a mode on is
 * not an instruction to forget what was there.
 *
 * `advanced` is omitted entirely when it holds nothing, so a user who never
 * opens the toggle keeps writing exactly the record they wrote before this
 * feature existed. See `Preferences.deductions` for why that matters.
 */
export function deductionChoiceFrom(
  fixedInput: string,
  percentInput: string,
  advanced: AdvancedDeductionInputs,
): DeductionChoice {
  const choice = advancedChoiceFrom(advanced)
  const worthKeeping =
    choice.enabled ||
    choice.superPercentOfGross > 0 ||
    choice.superPerFortnight > 0 ||
    choice.livingExpenses > 0 ||
    choice.mealsAndEntertainment > 0 ||
    choice.unionFees > 0

  return {
    fixedPerFortnight: parseAmount(fixedInput) ?? 0,
    percentOfGross: parsePercent(percentInput) ?? 0,
    ...(worthKeeping ? { advanced: choice } : {}),
  }
}
