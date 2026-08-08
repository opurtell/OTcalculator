import type { Attendance } from '../engine/attendance'
import type { OtShift } from '../engine/types'
import { describeAttendance } from '../app/shifts'
import { formatShortDate, formatTimeRange } from '../app/dates'
import type { Warning } from '../app/warnings'
import {
  AssumptionNote,
  Button,
  EmptyState,
  ShiftList,
  ShiftRow,
  UndoRow,
} from '../ui/index'

export interface FortnightPathwayProps {
  /** Priced attendances, in the order the engine grouped them. */
  attendances: readonly Attendance[]
  /** The entered shifts, for resolving an attendance back to what to edit. */
  shifts: readonly OtShift[]
  warnings: readonly Warning[]
  onAdd: () => void
  onEdit: (shiftId: string) => void
  onDuplicate: (shiftId: string) => void
  /** Removes every shift in the attendance — a row is one attendance. */
  onDelete: (shiftIds: readonly string[]) => void
  /**
   * Set while a deletion can still be taken back.
   *
   * `id` must change with each deletion. `UndoRow` starts its countdown on
   * mount and renders nothing once expired, so without a changing key a second
   * deletion would inherit the first row's spent timer and silently offer no
   * undo at all.
   */
  pendingDelete: { id: string; message: string } | null
  onUndoDelete: () => void
  onExpireDelete: () => void
}

/**
 * The fortnight pathway (§5.3, §5.4). Add shift → watch the number move.
 *
 * There is no Calculate button and there never will be. Every edit
 * recalculates, and the result panel above this list is what the user is
 * actually watching.
 *
 * **A row is an attendance, not an entry.** Two shifts an hour apart are one
 * continuous attendance under C9.7, priced as one — and the four-hour minimum
 * applies to the attendance, so there is no honest way to split its pay back
 * across the entries that made it. When a row covers more than one entry it
 * says so, and its actions act on all of them.
 */
export function FortnightPathway({
  attendances,
  shifts,
  warnings,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  pendingDelete,
  onUndoDelete,
  onExpireDelete,
}: FortnightPathwayProps) {
  const hasShifts = shifts.length > 0

  return (
    <div className="sl-stack">
      <ShiftList title="Overtime shifts" count={attendances.length}>
        {hasShifts ? (
          attendances.map((attendance) => (
            <AttendanceRow
              key={attendance.shiftIds.join('+')}
              attendance={attendance}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))
        ) : (
          <EmptyState
            title="No shifts added yet."
            body="Add one to see what it pays, and what it adds once tax has had its say."
          />
        )}
      </ShiftList>

      {pendingDelete !== null ? (
        <UndoRow
          key={pendingDelete.id}
          message={pendingDelete.message}
          onUndo={onUndoDelete}
          onExpire={onExpireDelete}
        />
      ) : null}

      <Button block variant="secondary" onClick={onAdd}>
        + Add OT shift
      </Button>

      {warnings.map((warning) => (
        <AssumptionNote key={warning.id}>
          <p>{warning.text}</p>
        </AssumptionNote>
      ))}
    </div>
  )
}

function AttendanceRow({
  attendance,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  attendance: Attendance
  onEdit: (shiftId: string) => void
  onDuplicate: (shiftId: string) => void
  onDelete: (shiftIds: readonly string[]) => void
}) {
  const { breakdown, assumption } = describeAttendance(attendance)
  const joined = attendance.shiftIds.length > 1
  const first = attendance.shiftIds[0]

  return (
    <ShiftRow
      date={formatShortDate(attendance.startDate)}
      timeRange={formatTimeRange(attendance.startMin, attendance.endMin)}
      breakdown={
        joined
          ? `${breakdown} · ${attendance.shiftIds.length} entries joined`
          : breakdown
      }
      kind={attendance.kind}
      amount={attendance.pay}
      assumption={assumption || joined}
      // Editing a joined row opens the first entry: it is the one whose start
      // time the row shows, so it is the one the user is looking at.
      onClick={() => onEdit(first)}
      onDuplicate={() => onDuplicate(first)}
      onDelete={() => onDelete(attendance.shiftIds)}
    />
  )
}
