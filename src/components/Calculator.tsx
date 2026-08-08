import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CHOICES,
  isKnownBand,
  resolveSettings,
  todayIso,
} from '../app/settings'
import type { CalculatorChoices, Pathway } from '../app/settings'
import { amountInputFor, parseAmount, percentInputFor } from '../app/inputs'
import {
  draftFrom,
  duplicateDraft,
  emptyDraft,
  removeShifts,
  toShift,
  upsertShift,
} from '../app/shifts'
import type { ShiftDraft } from '../app/shifts'
import { formatShortDate } from '../app/dates'
import { fortnightWarnings } from '../app/warnings'
import { payBandFor } from '../data'
import type { Classification } from '../data'
import { calculateFortnight, comparePay } from '../engine/fortnight'
import { quickOvertime } from '../engine/overtime'
import type { IsoDate, OtShift } from '../engine/types'
import type { ReadStatus } from '../storage/preferences'
import { formatMoney } from '../ui/index'
import { CalculatorShell } from './CalculatorShell'
import {
  DeductionsTaxPanel,
  deductionSettingsFrom,
} from './DeductionsTaxPanel'
import { FortnightPathway } from './FortnightPathway'
import { FortnightResultPanel } from './FortnightResultPanel'
import { PayBandFields, clampStep } from './PayBandFields'
import { QuickHoursField, QuickResult } from './QuickPathway'
import { SetupScreen } from './SetupScreen'
import { ShiftSheet } from './ShiftSheet'

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
  /**
   * How the stored settings read on boot. `'repaired'` and `'unreadable'` are
   * the two the user is owed a word about — see `readNotice`.
   */
  readStatus?: ReadStatus
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
  readStatus,
}: CalculatorProps) {
  const [fields, setFields] = useState(() => fieldsFrom(initialChoices))
  const [inSetup, setInSetup] = useState(startAtSetup)
  // Not part of the persisted choices, and deliberately not per-pathway state
  // either: a number typed on the quick tab survives a look at the fortnight
  // tab and back, which is the round trip someone weighing a shift actually
  // makes. It does not survive a reload, and should not — §4.4.
  const [quickHoursInput, setQuickHoursInput] = useState('')

  // Shifts are transient by design (§4.4): persisting them creates a stale-data
  // trap where last fortnight's pickups quietly inflate this fortnight.
  const [shifts, setShifts] = useState<OtShift[]>([])
  // The sheet is open exactly when there is a draft.
  const [draft, setDraft] = useState<ShiftDraft | null>(null)
  // A deletion happens immediately and is taken back from the undo row, rather
  // than being interrupted by a dialog asking whether it was meant (§7).
  const [pendingDelete, setPendingDelete] = useState<OtShift[] | null>(null)
  // What to give focus back to when the sheet closes. `Sheet` takes focus on
  // open and cannot know where it came from — the add button, a row, a row's
  // menu — so the side that opened it remembers (§8).
  const sheetOpenedFrom = useRef<HTMLElement | null>(null)

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

  /** Opens the sheet, remembering what to hand focus back to. */
  function openDraft(next: ShiftDraft) {
    sheetOpenedFrom.current =
      typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)
        ? null
        : document.activeElement
    setDraft(next)
  }

  /** Closes the sheet and returns focus. A stale node makes this a no-op. */
  function closeDraft() {
    setDraft(null)
    sheetOpenedFrom.current?.focus()
    sheetOpenedFrom.current = null
  }

  function commitDraft() {
    if (draft === null) return
    const shift = toShift(draft)
    if (shift === null) return

    setShifts((current) => upsertShift(current, shift))
    closeDraft()
  }

  function openDraftFor(shiftId: string, copy: boolean) {
    const shift = shifts.find((existing) => existing.id === shiftId)
    if (shift === undefined) return
    openDraft(copy ? duplicateDraft(shift) : draftFrom(shift))
  }

  /** Delete now, restore from the undo row (§7). */
  function deleteShifts(shiftIds: readonly string[]) {
    const { kept, removed } = removeShifts(shifts, shiftIds)
    if (removed.length === 0) return

    setShifts(kept)
    setPendingDelete(removed)
    // Editing a shift that is no longer there would commit it back on save.
    if (draft !== null && draft.id !== null && shiftIds.includes(draft.id)) {
      setDraft(null)
    }
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

  const result = calculateFortnight(shifts, settings)
  const warnings = fortnightWarnings(shifts, result.flags, settings.holidays)

  // The quick pathway, when it has a number to work with. Both pathways reach
  // their net figure through the same `comparePay`, so the same overtime can
  // never be worth two different amounts depending on which tab you are on.
  const quickHours = parseAmount(quickHoursInput) ?? 0
  const quick =
    quickHours > 0 ? quickOvertime(quickHours, settings.band.annualBase) : null
  const quickComparison = quick === null ? null : comparePay(quick.gross, settings)

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
      notice: readNotice(readStatus),
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
        // On the quick tab with hours entered, the result is what those hours
        // add. Everywhere else it is the fortnight itself — an empty hours
        // field has nothing to say, and a zero in the loud position would be
        // an answer to a question nobody asked.
        quick !== null && quickComparison !== null && fields.pathway === 'quick' ? (
          <QuickResult comparison={quickComparison} overtime={quick} />
        ) : (
          <FortnightResultPanel
            result={result}
            bandSummary={bandLabel}
            captions={captions}
            settings={settings}
          />
        )
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
        <QuickHoursField
          hoursInput={quickHoursInput}
          onHoursInputChange={setQuickHoursInput}
          onUseFortnight={() => update({ pathway: 'fortnight' })}
        />
      ) : (
        <>
          {draft !== null ? (
            <ShiftSheet
              draft={draft}
              onDraftChange={setDraft}
              onCommit={commitDraft}
              onClose={closeDraft}
              band={settings.band}
              holidays={settings.holidays}
            />
          ) : null}
          <FortnightPathway
            attendances={result.attendances}
            shifts={shifts}
            warnings={warnings}
            onAdd={() => openDraft(emptyDraft())}
            onEdit={(shiftId) => openDraftFor(shiftId, false)}
            onDuplicate={(shiftId) => openDraftFor(shiftId, true)}
            onDelete={deleteShifts}
            pendingDelete={
              pendingDelete === null
                ? null
                : {
                    id: pendingDelete.map((shift) => shift.id).join('+'),
                    message: deletedMessage(pendingDelete),
                  }
            }
            onUndoDelete={() => {
              setShifts((current) =>
                pendingDelete === null ? current : [...current, ...pendingDelete],
              )
              setPendingDelete(null)
            }}
            onExpireDelete={() => setPendingDelete(null)}
          />
        </>
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

/**
 * What to say about a settings read that didn't go cleanly, or nothing.
 *
 * `readPreferences` repairs fields one at a time (§4.4), so a `'repaired'` read
 * means the user is looking at a mix of what they saved and what the app had
 * to default — worth a quiet line, because the figure on screen may not be the
 * one they entered. Silence here would be the app quietly changing someone's
 * pay band. `'unreadable'` already sends them to the setup screen; the note
 * says why they are seeing it again.
 *
 * `'empty'` and `'ok'` say nothing: a first visit is not an incident.
 */
export function readNotice(status: ReadStatus | undefined): string | undefined {
  if (status === 'repaired') {
    return "Some saved settings couldn't be read and were set back to the defaults. Check the figures below are still yours."
  }
  if (status === 'unreadable') {
    return "Your saved settings couldn't be read, so we've started fresh. Setting your pay band again is all it takes."
  }
  return undefined
}

/** `Shift deleted` / `2 shifts deleted`, past tense — it already happened. */
function deletedMessage(removed: readonly OtShift[]): string {
  if (removed.length === 1) {
    return `${formatShortDate(removed[0].date)} shift deleted`
  }
  return `${removed.length} shifts deleted`
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
