/**
 * This pay fortnight's shifts, kept on the device until the fortnight ends.
 *
 * §4.4 refused to persist shifts at all, and the reason was sound: last
 * fortnight's pickups quietly inflating this fortnight's total is a wrong
 * answer that looks like a right one. What that argument actually rules out is
 * *stale* shifts, not saved ones — so the record carries the pay period it
 * belongs to and is discarded the moment the period no longer matches. A
 * fortnight's entry survives a reload, a closed tab and a phone going to sleep
 * mid-shift-entry; it does not survive into the next pay period.
 *
 * Kept apart from `preferences.ts`, in its own key, for three reasons:
 *
 * 1. **Different lifetimes.** Settings are indefinite, shifts expire. One
 *    record with two clocks in it would need every read to think about both.
 * 2. **Different clear controls.** "Clear shifts" is one tap and is not a
 *    question about the pay band.
 * 3. **A shared key would need a schema bump**, and a bump discards the stored
 *    record wholesale — every existing user would lose the pay band they set
 *    in exchange for a feature they have not used yet.
 *
 * The defensive contract is `preferences.ts`'s, unchanged: reading never
 * throws, an unrecognised version is discarded, and a single unusable shift
 * costs that shift rather than the whole fortnight.
 */

import { isIsoDate } from '../app/dates'
import { MINUTES_PER_DAY } from '../engine/types'
import type { IsoDate, OtShift, ShiftKind } from '../engine/types'
import { browserStore } from './preferences'
import type { PreferenceStore } from './preferences'

/** Namespaced like the preferences key — Pages serves other apps from this origin. */
export const SHIFTS_KEY = 'actas-ot-calculator/shifts'

/** Bump when a stored shift changes meaning. Unrecognised versions are dropped. */
export const SHIFTS_SCHEMA_VERSION = 1

/**
 * How the read went.
 *
 * `'expired'` is the one worth saying out loud: the user is looking at an
 * empty list they did not empty, and "last fortnight's shifts were cleared" is
 * the difference between a fresh start and a bug.
 */
export type ShiftsReadStatus =
  /** Nothing stored, or no storage at all. */
  | 'empty'
  /** Read back exactly as written. */
  | 'ok'
  /** Stored, but one or more shifts were unusable and were dropped. */
  | 'repaired'
  /** Stored against an earlier pay fortnight, and let go of. */
  | 'expired'
  /** Unparseable or from an unrecognised schema version. */
  | 'unreadable'

export interface ShiftsRead {
  shifts: OtShift[]
  status: ShiftsReadStatus
}

const NOTHING: ShiftsRead = { shifts: [], status: 'empty' }

// ---------------------------------------------------------------------------
// Shape validation
//
// A stored shift is checked field by field against what the engine will do
// with it. `isIsoDate` is borrowed from `app/dates` rather than reimplemented:
// it is the same question the shift sheet asks before the engine sees a date,
// and two copies of it are two chances to disagree about 31 February.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A minute of the day: an integer in 0–1439, as an `<input type="time">` gives. */
function isMinuteOfDay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < MINUTES_PER_DAY
  )
}

function isShiftKind(value: unknown): value is ShiftKind {
  return value === 'overrun' || value === 'separate'
}

/**
 * One stored shift, or `null` if it is not one.
 *
 * `endsNextDay` is **derived, not read**. It is a function of the two times —
 * an end at or before the start means the shift ran past midnight — so a
 * stored `false` against times that say otherwise is not a second opinion, it
 * is a corrupt record. Deriving it means a hand-edited `localStorage` cannot
 * make the engine price a negative-length attendance.
 */
export function parseStoredShift(value: unknown): OtShift | null {
  if (!isRecord(value)) return null

  const { id, date, startMin, endMin, kind } = value
  if (typeof id !== 'string' || id === '') return null
  if (typeof date !== 'string' || !isIsoDate(date)) return null
  if (!isMinuteOfDay(startMin) || !isMinuteOfDay(endMin)) return null
  // The same rule `toShift` applies: same start and end is a typo, not a
  // 24-hour attendance.
  if (startMin === endMin) return null
  if (!isShiftKind(kind)) return null

  return {
    id,
    date: date as IsoDate,
    startMin,
    endMin,
    endsNextDay: endMin <= startMin,
    kind,
  }
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

/**
 * The fortnight's shifts, or nothing.
 *
 * `payPeriodEnd` is the period the caller is asking about — today's, in the
 * app. A record from any other period is `'expired'`: it is dropped from the
 * store on the way past, so a fortnight of shifts does not sit on the device
 * indefinitely waiting for a read that will never accept it.
 */
export function readShifts(
  payPeriodEnd: IsoDate,
  store: PreferenceStore | null = browserStore(),
): ShiftsRead {
  if (store === null) return NOTHING

  let raw: string | null
  try {
    raw = store.getItem(SHIFTS_KEY)
  } catch {
    return NOTHING
  }
  if (raw === null) return NOTHING

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { shifts: [], status: 'unreadable' }
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== SHIFTS_SCHEMA_VERSION) {
    return { shifts: [], status: 'unreadable' }
  }

  if (parsed.payPeriodEnd !== payPeriodEnd) {
    clearShifts(store)
    // An unreadable period stamp is not an expiry — it is a record that cannot
    // say which fortnight it is from, which is the same as not having one.
    return {
      shifts: [],
      status: typeof parsed.payPeriodEnd === 'string' ? 'expired' : 'unreadable',
    }
  }

  const stored = Array.isArray(parsed.shifts) ? parsed.shifts : []
  const shifts = stored
    .map(parseStoredShift)
    .filter((shift): shift is OtShift => shift !== null)

  return {
    shifts,
    status: shifts.length === stored.length ? 'ok' : 'repaired',
  }
}

/**
 * Write the fortnight's shifts, stamped with the period they belong to.
 *
 * An empty list clears the key rather than storing an empty record: there is
 * no difference between "no shifts this fortnight" and "nothing saved", and
 * leaving no record is the version that also disappears from the device when
 * the user clears the list.
 *
 * `false` means it did not land — a blocked or full store. Worth knowing,
 * never worth throwing over: the fortnight on screen is unaffected.
 */
export function saveShifts(
  payPeriodEnd: IsoDate,
  shifts: readonly OtShift[],
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  if (shifts.length === 0) return clearShifts(store)

  try {
    store.setItem(
      SHIFTS_KEY,
      JSON.stringify({
        schemaVersion: SHIFTS_SCHEMA_VERSION,
        payPeriodEnd,
        // `endsNextDay` is derived on read, so it is not written. Storing a
        // field the reader ignores is an invitation to trust it later.
        shifts: shifts.map(({ id, date, startMin, endMin, kind }) => ({
          id,
          date,
          startMin,
          endMin,
          kind,
        })),
      }),
    )
    return true
  } catch {
    return false
  }
}

/** The "Clear shifts" control, and what an expired record gets on the way past. */
export function clearShifts(
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  try {
    store.removeItem(SHIFTS_KEY)
    return true
  } catch {
    return false
  }
}
