import {
  CLASSIFICATION_LABEL,
  PAY_BANDS,
  RATES_EFFECTIVE_FROM,
  stepsFor,
} from '../data'
import type { Classification } from '../data'
import { formatIsoDateAu } from '../app/inputs'
import {
  AssumptionNote,
  DerivedPayPanel,
  SegmentedControl,
  SelectField,
} from '../ui/index'

export interface PayBandFieldsProps {
  classification: Classification
  step: number
  onClassificationChange: (classification: Classification) => void
  onStepChange: (step: number) => void
  /** Derived from the table, or the user's own figure once overridden. */
  baseAnnual: number
  fortnightly: number
  /** True once "Enter your own figures" has been taken up. */
  overridden: boolean
  onOverride: () => void
  baseAnnualInput: string
  fortnightlyInput: string
  onBaseAnnualInputChange: (value: string) => void
  onFortnightlyInputChange: (value: string) => void
  /**
   * Set when the stored settings couldn't be read back whole. Shown here
   * rather than anywhere else because this is the screen where the user can
   * see whether the surviving figures are the ones they meant.
   */
  notice?: string
}

/**
 * Classification, step, and the two figures they derive (§5.1).
 *
 * The same three controls appear on the first-run screen and inside the
 * settings disclosure, so they live here rather than in either one. Step is a
 * segmented control and not a dropdown on purpose: there are only three or
 * four and each is a single tap.
 *
 * Changing classification can leave the step out of range — ICP2 stops at 3
 * where AP1 goes to 4 — so the caller is handed a step it is expected to clamp;
 * `clampStep` below is the shared way to do it.
 */
export function PayBandFields({
  classification,
  step,
  onClassificationChange,
  onStepChange,
  baseAnnual,
  fortnightly,
  overridden,
  onOverride,
  baseAnnualInput,
  fortnightlyInput,
  onBaseAnnualInputChange,
  onFortnightlyInputChange,
  notice,
}: PayBandFieldsProps) {
  const steps = stepsFor(classification)

  return (
    <>
      {notice ? (
        <AssumptionNote>
          <p>{notice}</p>
        </AssumptionNote>
      ) : null}
      <SelectField
        label="Classification"
        value={classification}
        onChange={(value) => onClassificationChange(value as Classification)}
        options={CLASSIFICATIONS.map((value) => ({
          value,
          label: CLASSIFICATION_LABEL[value],
        }))}
      />
      <SegmentedControl
        label="Step"
        size="compact"
        value={String(step)}
        onChange={(value) => onStepChange(Number(value))}
        options={steps.map((value) => ({
          value: String(value),
          label: String(value),
        }))}
      />
      <DerivedPayPanel
        baseAnnual={baseAnnual}
        fortnightly={fortnightly}
        ratesEffective={formatIsoDateAu(RATES_EFFECTIVE_FROM)}
        overridden={overridden}
        onOverride={onOverride}
        baseAnnualInput={baseAnnualInput}
        fortnightlyInput={fortnightlyInput}
        onBaseAnnualChange={onBaseAnnualInputChange}
        onFortnightlyChange={onFortnightlyInputChange}
      />
    </>
  )
}

/** The classifications in table order, deduplicated from the pay bands. */
const CLASSIFICATIONS = [
  ...new Set(PAY_BANDS.map((band) => band.classification)),
] as Classification[]

/**
 * The nearest valid step in a classification.
 *
 * Someone on AP1 Step 4 who switches to ICP2 — which stops at 3 — must land on
 * a real row rather than on a band that does not exist. Clamping down rather
 * than resetting to 1 keeps the seniority they have already told us about.
 */
export function clampStep(classification: Classification, step: number): number {
  const steps = stepsFor(classification)
  const last = steps[steps.length - 1]
  if (step < steps[0]) return steps[0]
  if (step > last) return last
  return steps.includes(step) ? step : steps[0]
}
