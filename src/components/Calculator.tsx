import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CHOICES,
  isKnownBand,
  resolveSettings,
  todayIso,
} from '../app/settings'
import type { CalculatorChoices, Pathway } from '../app/settings'
import { amountInputFor, parseAmount, percentInputFor } from '../app/inputs'
import { CLASSIFICATION_LABEL, payBandFor } from '../data'
import type { Classification } from '../data'
import { calculateFortnight } from '../engine/fortnight'
import type { IsoDate } from '../engine/types'
import { EmptyState, Panel, formatMoney } from '../ui/index'
import { CalculatorShell } from './CalculatorShell'
import {
  DeductionsTaxPanel,
  deductionSettingsFrom,
} from './DeductionsTaxPanel'
import { FortnightResultPanel } from './FortnightResultPanel'
import { PayBandFields, clampStep } from './PayBandFields'
import { SetupScreen } from './SetupScreen'

export interface CalculatorProps {
  /** Where to start. The persisted record, or the defaults on a fresh device. */
  initialChoices?: CalculatorChoices
  /** True when nothing usable was stored — the user has yet to set a band. */
  startAtSetup?: boolean
  /** False when this browser refuses `localStorage`. Changes the setup copy. */
  canRemember?: boolean
  /**
   * Fired whenever a choice changes, and once when setup completes. Not fired
   * while the setup screen is up: a half-finished band is not worth persisting,
   * and a stored record is what tells the next visit that setup is done.
   */
  onChoicesChange?: (choices: CalculatorChoices) => void
  onClearSettings?: () => void
  /** The pay date, which selects the financial year (§3.8). Injected in tests. */
  payDate?: IsoDate
}

/**
 * The app's spine: it owns what the user has chosen and nothing else.
 *
 * Persistence is not its business — it reports changes upward and takes its
 * starting point as a prop, so `src/storage/` and this file can be read,
 * tested and changed independently.
 *
 * Every editable number is held here as the *string the user typed*, parsed on
 * its way to the engine. See `app/inputs.ts` for why.
 */
export function Calculator({
  initialChoices = DEFAULT_CHOICES,
  startAtSetup = true,
  canRemember = true,
  onChoicesChange,
  onClearSettings,
  payDate,
}: CalculatorProps) {
  const [fields, setFields] = useState(() => fieldsFrom(initialChoices))
  const [inSetup, setInSetup] = useState(startAtSetup)

  const choices = choicesFrom(fields)
  const date = payDate ?? todayIso()

  // The sanitising in `fieldsFrom` guarantees a classification and step that
  // name a real Annex A row, so this cannot be null in practice. Keeping the
  // branch rather than asserting means a gutted pay table shows the setup
  // screen instead of a blank page.
  const resolved = resolveSettings(choices, date)

  const notify = useRef(onChoicesChange)
  notify.current = onChoicesChange
  useEffect(() => {
    if (inSetup) return
    notify.current?.(choicesFrom(fields))
  }, [fields, inSetup])

  function update(patch: Partial<Fields>) {
    setFields((current) => ({ ...current, ...patch }))
  }

  if (resolved === null) {
    return (
      <SetupScreen
        {...bandFieldProps()}
        canRemember={canRemember}
        onContinue={() => setInSetup(false)}
      />
    )
  }

  const { settings, captions } = resolved

  // No shifts yet — the fortnight pathway arrives in Phase 7. The figures are
  // real regardless: this is the fortnight as it stands before any overtime.
  const result = calculateFortnight([], settings)

  function bandFieldProps() {
    const band = payBandFor(fields.classification, fields.step)
    return {
      classification: fields.classification,
      step: fields.step,
      onClassificationChange: (classification: Classification) =>
        update({
          classification,
          step: clampStep(classification, fields.step),
        }),
      onStepChange: (step: number) => update({ step }),
      baseAnnual: band?.annualBase ?? 0,
      fortnightly: resolved?.derivedFortnightlyGross ?? 0,
      overridden: fields.overridden,
      onOverride: () =>
        update({
          overridden: true,
          // Seed both fields with what the app was deriving, so the override
          // starts from the figure on screen rather than from an empty box.
          baseAnnualInput: amountInputFor(band?.annualBase ?? null),
          fortnightlyInput: amountInputFor(
            resolved?.derivedFortnightlyGross ?? null,
          ),
        }),
      baseAnnualInput: fields.baseAnnualInput,
      fortnightlyInput: fields.fortnightlyInput,
      onBaseAnnualInputChange: (value: string) =>
        update({ baseAnnualInput: value }),
      onFortnightlyInputChange: (value: string) =>
        update({ fortnightlyInput: value }),
    }
  }

  if (inSetup) {
    return (
      <SetupScreen
        {...bandFieldProps()}
        canRemember={canRemember}
        onContinue={() => setInSetup(false)}
      />
    )
  }

  const bandLabel = `${fields.classification} Step ${fields.step}`

  return (
    <CalculatorShell
      pathway={fields.pathway}
      onPathwayChange={(pathway: Pathway) => update({ pathway })}
      result={
        <FortnightResultPanel
          result={result}
          bandSummary={bandLabel}
          captions={captions}
        />
      }
      bandSummary={`${bandLabel} · ${wholeDollars(settings.band.annualBase)}`}
      payBand={<PayBandFields {...bandFieldProps()} />}
      deductionsSummary={deductionsSummary(fields)}
      deductionsTax={
        <DeductionsTaxPanel
          fixedInput={fields.fixedInput}
          percentInput={fields.percentInput}
          onFixedInputChange={(value) => update({ fixedInput: value })}
          onPercentInputChange={(value) => update({ percentInput: value })}
          claimsTaxFreeThreshold={fields.claimsTaxFreeThreshold}
          hasStudyDebt={fields.hasStudyDebt}
          onClaimsTaxFreeThresholdChange={(claimsTaxFreeThreshold) =>
            update({ claimsTaxFreeThreshold })
          }
          onHasStudyDebtChange={(hasStudyDebt) => update({ hasStudyDebt })}
          gross={result.withOt.gross}
        />
      }
      onClearSettings={() => {
        setFields(fieldsFrom(DEFAULT_CHOICES))
        setInSetup(true)
        onClearSettings?.()
      }}
    >
      {fields.pathway === 'quick' ? (
        <Panel>
          <EmptyState
            title="Quick calculation"
            body="Hours in, an estimate out — arriving next. The Fortnight tab already shows your pay before overtime."
          />
        </Panel>
      ) : (
        <Panel>
          <div className="sl-stack">
            <h2 className="sl-heading">Overtime shifts</h2>
            <EmptyState
              title="No shifts added yet."
              body={`Adding shifts arrives next. Everything above is live: ${CLASSIFICATION_LABEL[fields.classification]} Step ${fields.step}, worked out from the pay tables.`}
            />
          </div>
        </Panel>
      )}
    </CalculatorShell>
  )
}

// ---------------------------------------------------------------------------
// Field state — the typed strings, and the round trip to persisted choices
// ---------------------------------------------------------------------------

export interface Fields {
  classification: Classification
  step: number
  overridden: boolean
  baseAnnualInput: string
  fortnightlyInput: string
  fixedInput: string
  percentInput: string
  claimsTaxFreeThreshold: boolean
  hasStudyDebt: boolean
  pathway: Pathway
}

/**
 * Choices in, field strings out — sanitising the band on the way.
 *
 * A stored record outlives the table it was written against, so a
 * classification or step that no longer exists falls back to the default
 * rather than propagating into every figure on screen.
 */
export function fieldsFrom(choices: CalculatorChoices): Fields {
  const band = isKnownBand(choices.band) ? choices.band : DEFAULT_CHOICES.band
  const overridden =
    band.annualBase !== null || band.fortnightlyGross !== null

  return {
    classification: band.classification as Classification,
    step: band.step,
    overridden,
    baseAnnualInput: amountInputFor(band.annualBase),
    fortnightlyInput: amountInputFor(band.fortnightlyGross),
    fixedInput: amountInputFor(choices.deductions.fixedPerFortnight),
    percentInput: percentInputFor(choices.deductions.percentOfGross),
    claimsTaxFreeThreshold: choices.tax.claimsTaxFreeThreshold,
    hasStudyDebt: choices.tax.hasStudyDebt,
    pathway: choices.pathway,
  }
}

/** The inverse: what gets persisted, with every string parsed to a figure. */
export function choicesFrom(fields: Fields): CalculatorChoices {
  const deductions = deductionSettingsFrom(fields.fixedInput, fields.percentInput)

  return {
    band: {
      classification: fields.classification,
      step: fields.step,
      annualBase: fields.overridden ? overrideFrom(fields.baseAnnualInput) : null,
      fortnightlyGross: fields.overridden
        ? overrideFrom(fields.fortnightlyInput)
        : null,
    },
    tax: {
      claimsTaxFreeThreshold: fields.claimsTaxFreeThreshold,
      hasStudyDebt: fields.hasStudyDebt,
    },
    deductions,
    pathway: fields.pathway,
  }
}

/**
 * An override field's value, or `null` for "no override".
 *
 * Zero is not an override. Someone who clears the box mid-edit means "I have
 * not said yet", not "I earn nothing", and deriving from the table is the only
 * sensible reading of an empty field.
 */
function overrideFrom(value: string): number | null {
  const parsed = parseAmount(value)
  return parsed === null || parsed <= 0 ? null : parsed
}

/** `$95,698` — cents on an annual salary are noise in a one-line summary. */
function wholeDollars(amount: number): string {
  return formatMoney(Math.round(amount)).replace('.00', '')
}

/** `Deductions: $611.00 + 5% · Study debt on` (§7). */
function deductionsSummary(fields: Fields): string {
  const parts: string[] = []
  const deductions = deductionSettingsFrom(fields.fixedInput, fields.percentInput)

  if (deductions.fixedPerFortnight > 0) {
    parts.push(formatMoney(deductions.fixedPerFortnight))
  }
  if (deductions.percentOfGross > 0) {
    parts.push(`${percentInputFor(deductions.percentOfGross)}%`)
  }

  const deductionLine =
    parts.length === 0 ? 'No deductions' : `Deductions: ${parts.join(' + ')}`
  const debtLine = fields.hasStudyDebt ? 'Study debt on' : 'Study debt off'
  const thresholdLine = fields.claimsTaxFreeThreshold
    ? null
    : 'No tax-free threshold'

  return [deductionLine, debtLine, thresholdLine].filter(Boolean).join(' · ')
}
