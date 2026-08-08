import { calculateOvertime } from '../engine/attendance'
import type { HolidayCalendar, PayBand } from '../engine/types'
import {
  describeAttendance,
  draftDuration,
  draftEndsNextDay,
  toShift,
  withInferredKind,
} from '../app/shifts'
import type { ShiftDraft } from '../app/shifts'
import { addDays } from '../engine/calendar'
import { formatLongDate, formatShortDate, isIsoDate } from '../app/dates'
import {
  AssumptionNote,
  Button,
  Money,
  SegmentedControl,
  Sheet,
  TextField,
} from '../ui/index'
import type { ShiftKind } from '../ui/index'

export interface ShiftSheetProps {
  draft: ShiftDraft
  onDraftChange: (draft: ShiftDraft) => void
  onCommit: () => void
  onClose: () => void
  band: PayBand
  holidays: HolidayCalendar
}

/**
 * Add or edit one overtime shift (§5.5).
 *
 * Four fields and a live preview. The preview is the point: the user sees what
 * the shift pays *before* committing it, which is the difference between a
 * form and a calculator. It is priced by the same `calculateOvertime` that
 * prices the fortnight, on this shift alone, so nothing in it can be a
 * separate approximation of the real answer.
 *
 * `endsNextDay` is derived from the times rather than asked (§5.2) — an end at
 * or before the start can only mean the next morning — and shown back as
 * confirmation so the derivation is visible rather than merely correct.
 */
export function ShiftSheet({
  draft,
  onDraftChange,
  onCommit,
  onClose,
  band,
  holidays,
}: ShiftSheetProps) {
  const editing = draft.id !== null
  const shift = toShift(draft)
  const duration = draftDuration(draft)

  const preview =
    shift === null ? null : calculateOvertime([shift], band, holidays).attendances[0]
  const description = preview === null ? null : describeAttendance(preview)

  /** Times drive the C9.5 default until the user overrules it (§3.6). */
  function updateTime(patch: Partial<ShiftDraft>) {
    onDraftChange(withInferredKind({ ...draft, ...patch }))
  }

  return (
    <Sheet
      title={editing ? 'Edit OT shift' : 'Add OT shift'}
      onClose={onClose}
      footer={
        <Button block disabled={shift === null} onClick={onCommit}>
          {editing ? 'Save shift' : 'Add shift'}
        </Button>
      }
    >
      <div className="sl-stack">
        <TextField
          label="Date"
          type="date"
          value={draft.date}
          onChange={(date) => updateTime({ date })}
          hint={isIsoDate(draft.date) ? formatLongDate(draft.date) : undefined}
        />

        <div className="sl-sheet__times">
          <TextField
            label="Start"
            type="time"
            value={draft.start}
            onChange={(start) => updateTime({ start })}
            numeric
          />
          <TextField
            label="End"
            type="time"
            value={draft.end}
            onChange={(end) => updateTime({ end })}
            numeric
          />
        </div>

        {draftEndsNextDay(draft) && isIsoDate(draft.date) ? (
          <p className="sl-hint">
            Ends next day · {formatShortDate(addDays(draft.date, 1))}
          </p>
        ) : null}

        <SegmentedControl<ShiftKind>
          label="Was this continuous with your rostered shift?"
          value={draft.kind}
          onChange={(kind) =>
            onDraftChange({ ...draft, kind, kindTouched: true })
          }
          options={[
            { value: 'overrun', label: 'Ran on from', note: 'my shift' },
            { value: 'separate', label: 'Separate', note: 'shift' },
          ]}
          hint={
            draft.kind === 'separate'
              ? 'Separate shifts have a 4-hour minimum payment.'
              : 'A shift overrun is paid its actual hours, however short.'
          }
        />

        {preview !== null && description !== null ? (
          <div className="sl-preview">
            <span className="sl-preview__breakdown">{description.breakdown}</span>
            <Money value={preview.pay} />
          </div>
        ) : (
          <p className="sl-hint">
            {duration === null
              ? 'Fill in the date and both times to see what this shift pays.'
              : 'Those times do not make a shift yet.'}
          </p>
        )}

        {preview?.minimumApplied ? (
          <AssumptionNote>
            <p>
              Paid four hours because this was a separate attendance, not a
              run-on from a rostered shift (EBA C9.5). Switch to "Ran on from my
              shift" if it followed your roster — that is paid at actual hours.
            </p>
          </AssumptionNote>
        ) : null}
      </div>
    </Sheet>
  )
}
