/**
 * Shifts as the user edits them, and attendances as the user reads them.
 *
 * The engine's `OtShift` is a finished thing: a real date, two real times, a
 * settled C9.5 kind. A shift being typed is none of those yet, so the sheet
 * works on a `ShiftDraft` of raw field strings and this module is the border
 * between the two.
 */

import {
  MINIMUM_PAYMENT_MINUTES,
  MINUTES_PER_DAY,
  CATEGORY_LABEL,
} from '../engine/types'
import type { IsoDate, OtCategory, OtShift, ShiftKind } from '../engine/types'
import type { Attendance } from '../engine/attendance'
import { formatHours } from '../ui/format'
import { clockTime, isIsoDate, parseClockTime } from './dates'

export interface ShiftDraft {
  /** `null` while the shift is new. An id means the sheet is editing. */
  id: string | null
  /** `'YYYY-MM-DD'` — straight off an `<input type="date">`. */
  date: string
  /** `'HH:MM'` — straight off an `<input type="time">`. */
  start: string
  end: string
  kind: ShiftKind
  /**
   * Whether the user has picked the kind themselves.
   *
   * Until they have, the duration heuristic keeps re-deciding it as the times
   * change (§3.6). After they have, it stops — the app has been told, and
   * overruling a person about their own shift is how a calculator loses trust.
   */
  kindTouched: boolean
}

/** Ids are per-session: shifts are never persisted, so they never outlive it. */
let nextId = 0
export function newShiftId(): string {
  nextId += 1
  return `shift-${nextId}`
}

export function emptyDraft(): ShiftDraft {
  return { id: null, date: '', start: '', end: '', kind: 'overrun', kindTouched: false }
}

export function draftFrom(shift: OtShift): ShiftDraft {
  return {
    id: shift.id,
    date: shift.date,
    start: clockTime(shift.startMin),
    end: clockTime(shift.endMin),
    kind: shift.kind,
    // An existing shift's kind is settled, whether it was chosen or inferred.
    // Re-running the heuristic on an edit would silently undo a correction.
    kindTouched: true,
  }
}

/** A copy of a shift, ready to be given a new date. See `Duplicate` in the row menu. */
export function duplicateDraft(shift: OtShift): ShiftDraft {
  return { ...draftFrom(shift), id: null }
}

/**
 * How long the draft runs, in minutes, or `null` if it is not yet a shift.
 *
 * An end at or before the start means the shift ran past midnight — the app
 * derives that rather than asking, and shows "ends next day" as confirmation
 * (§5.2).
 */
export function draftDuration(draft: ShiftDraft): number | null {
  const start = parseClockTime(draft.start)
  const end = parseClockTime(draft.end)
  if (start === null || end === null) return null
  return end <= start ? end + MINUTES_PER_DAY - start : end - start
}

export function draftEndsNextDay(draft: ShiftDraft): boolean {
  const start = parseClockTime(draft.start)
  const end = parseClockTime(draft.end)
  if (start === null || end === null) return false
  return end <= start
}

/**
 * The §3.6 default: under four hours is probably an overrun, four or more is
 * probably a shift someone picked up.
 *
 * You do not accidentally overrun by eight hours, and most short overtime is
 * the tail of a rostered shift. It is a default and never more than that —
 * the control shows it, and one tap overrules it.
 */
export function inferKind(durationMinutes: number): ShiftKind {
  return durationMinutes < MINIMUM_PAYMENT_MINUTES ? 'overrun' : 'separate'
}

/** Re-applies the heuristic after a time changes, unless the user has spoken. */
export function withInferredKind(draft: ShiftDraft): ShiftDraft {
  if (draft.kindTouched) return draft
  const duration = draftDuration(draft)
  if (duration === null) return draft
  return { ...draft, kind: inferKind(duration) }
}

/** The finished shift, or `null` while the draft is still missing something. */
export function toShift(draft: ShiftDraft): OtShift | null {
  const startMin = parseClockTime(draft.start)
  const endMin = parseClockTime(draft.end)
  if (!isIsoDate(draft.date) || startMin === null || endMin === null) return null
  // A shift that starts and ends at the same minute is a typo, not a 24-hour
  // attendance. Refusing to build it keeps the preview blank rather than
  // showing someone a day's pay they did not work.
  if (startMin === endMin) return null

  return {
    id: draft.id ?? newShiftId(),
    date: draft.date as IsoDate,
    startMin,
    endMin,
    endsNextDay: endMin <= startMin,
    kind: draft.kind,
  }
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/**
 * Save a shift: replace it if it is already in the list, append it if not.
 *
 * Entry order is preserved rather than sorted. The engine sorts by start time
 * before grouping, so the rows come back chronological either way (§5.2), and
 * leaving the list alone means an edit does not make a row jump out from under
 * the finger that was about to tap it.
 */
export function upsertShift(
  shifts: readonly OtShift[],
  shift: OtShift,
): OtShift[] {
  return shifts.some((existing) => existing.id === shift.id)
    ? shifts.map((existing) => (existing.id === shift.id ? shift : existing))
    : [...shifts, shift]
}

/**
 * Remove shifts, handing back what was removed so it can be put straight back.
 *
 * The removed entries are kept whole rather than reconstructed on undo. The
 * C9.5 kind in particular is a decision the user made, and rebuilding it from
 * the duration heuristic would quietly overturn it.
 */
export function removeShifts(
  shifts: readonly OtShift[],
  ids: readonly string[],
): { kept: OtShift[]; removed: OtShift[] } {
  return {
    kept: shifts.filter((shift) => !ids.includes(shift.id)),
    removed: shifts.filter((shift) => ids.includes(shift.id)),
  }
}

// ---------------------------------------------------------------------------
// Reading an attendance back out
// ---------------------------------------------------------------------------

/** How a category names itself inside "the Sunday rate carried past midnight". */
const CARRIED_RATE_NAME: Partial<Record<OtCategory, string>> = {
  sat_2x: 'Saturday',
  sun_2x: 'Sunday',
  ph_2_5x: 'Public holiday',
}

export interface AttendanceDescription {
  /** The row's breakdown line. Required — it is how the app teaches the rules. */
  breakdown: string
  /** True when a rule the hours alone don't explain moved the money. */
  assumption: boolean
}

/**
 * The line under a shift row — "10h · all at 2× (Saturday)", "2h worked → 4h
 * paid · 4-hour minimum (C9.5)".
 *
 * This is where the app teaches the EBA without a tutorial, and it is the
 * reason the ratchet's labelling rules are load-bearing: the money would be
 * right either way, but a line saying `2×` where payroll says `2× (Sunday)` is
 * the difference between a user trusting the app and reconciling it by hand.
 */
export function describeAttendance(attendance: Attendance): AttendanceDescription {
  const worked = formatHours(attendance.workedMinutes / 60)

  if (attendance.minimumApplied) {
    // Never an unexplained number larger than the hours worked (§3.6).
    return {
      breakdown: `${worked} worked → ${formatHours(
        attendance.paidMinutes / 60,
      )} paid · 4-hour minimum (C9.5)`,
      assumption: true,
    }
  }

  const rates = rateSummary(attendance)
  const carried = carriedPastMidnight(attendance)

  return {
    breakdown: carried === null
      ? `${worked} · ${rates}`
      : `${worked} · ${rates} — ${carried} rate carried past midnight`,
    assumption: carried !== null,
  }
}

/** `'all at 2× (Saturday)'`, or `'2h at 1.5×, 6h at 2×'`. */
function rateSummary(attendance: Attendance): string {
  const byCategory = new Map<OtCategory, number>()
  for (const segment of attendance.segments) {
    byCategory.set(
      segment.category,
      (byCategory.get(segment.category) ?? 0) + segment.minutes,
    )
  }

  const entries = [...byCategory.entries()]
  if (entries.length === 1) return `all at ${CATEGORY_LABEL[entries[0][0]]}`

  return entries
    .map(
      ([category, minutes]) =>
        `${formatHours(minutes / 60)} at ${CATEGORY_LABEL[category]}`,
    )
    .join(', ')
}

/**
 * The name of the rate the ratchet carried over midnight, or `null`.
 *
 * Only a weekend or holiday rate is worth saying: a Mon–Fri attendance running
 * into the next weekday carries too, but "the weekday rate carried past
 * midnight" tells nobody anything they did not assume.
 */
function carriedPastMidnight(attendance: Attendance): string | null {
  if (!attendance.crossesMidnight) return null
  if (attendance.categories.length !== 1) return null
  return CARRIED_RATE_NAME[attendance.categories[0]] ?? null
}
