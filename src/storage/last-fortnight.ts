/**
 * The fortnight that just ended, kept once so it can be read one last time.
 *
 * `shifts.ts` lets go of a fortnight's shifts the moment the next one starts,
 * and that expiry is what makes saving them safe at all (§4.4). But the user
 * who opens the app on the Thursday morning did not ask for the fortnight to
 * end — they get an empty list and a base-pay figure, and the take-home they
 * were watching all fortnight is simply gone. This key is the handover: the
 * expired record is moved here on the way past, shown as a banner, and dropped
 * as soon as the new fortnight has a shift in it.
 *
 * **It stores inputs, not figures.** The shifts and the settings that were live
 * are what is written; the take-home is recomputed from them by the same engine
 * that produced it in the first place. Storing the answer would put a figure on
 * the device that nothing could check, and the app's rule everywhere else is
 * that a number is derived from something the user can see.
 *
 * That is also why the settings ride along rather than being taken from the
 * live preferences: a pay band edited on the Thursday would otherwise silently
 * restate last fortnight's take-home as something the user was never shown.
 *
 * The read is stricter than every other read in `src/storage/`, and
 * deliberately so. Elsewhere a damaged field is repaired and the user is told;
 * here there is nothing to tell them against — a carry-over figure sits beside
 * no inputs they can edit and no list they can check, so a repaired one would
 * be a wrong number with no way to notice it. Anything less than a clean record
 * is dropped whole and no banner is shown.
 */

import type { IsoDate, OtShift } from '../engine/types'
import { browserStore, normalisePreferences, preferencesSurvived } from './preferences'
import type { PreferenceStore, Preferences } from './preferences'
import { parseStoredShift } from './shifts'
import { isIsoDate } from '../app/dates'

/** Namespaced like the other two keys — Pages serves other apps from this origin. */
export const LAST_FORTNIGHT_KEY = 'actas-ot-calculator/last-fortnight'

/** Bump when the carried record changes meaning. Anything else is discarded. */
export const LAST_FORTNIGHT_SCHEMA_VERSION = 1

export interface LastFortnight {
  /** The Wednesday the carried fortnight closed on — its identity, as in `shifts.ts`. */
  payPeriodEnd: IsoDate
  /** Every shift that was entered against it. Never a partial list — see the header. */
  shifts: OtShift[]
  /** The settings it was worked out under, so the figure cannot move afterwards. */
  preferences: Preferences
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Put the fortnight that just ended aside.
 *
 * Called from the boot read with what `readShifts` let go of. An empty list
 * writes nothing and clears anything already there: a fortnight with no shifts
 * in it has no take-home worth carrying, only the base pay the app will show
 * for this fortnight anyway.
 *
 * `false` means it did not land — a blocked or full store. The consequence is
 * one missing banner, so it is worth reporting and never worth throwing over.
 */
export function saveLastFortnight(
  payPeriodEnd: IsoDate,
  shifts: readonly OtShift[],
  preferences: Preferences,
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  if (shifts.length === 0) return clearLastFortnight(store)

  try {
    store.setItem(
      LAST_FORTNIGHT_KEY,
      JSON.stringify({
        schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION,
        payPeriodEnd,
        preferences,
        // `endsNextDay` is derived on read here too, for the same reason
        // `shifts.ts` gives: a field the reader ignores is one a later reader
        // will trust.
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

/**
 * The carried fortnight, or `null` when there is nothing honest to show.
 *
 * `currentPayPeriodEnd` is this fortnight, and a record stamped with it is not
 * a carry-over at all — it is a record that has caught up with the present,
 * which a corrected anchor or a wrong device clock can produce. It is dropped
 * rather than shown as history.
 *
 * Everything else that is not a clean record is dropped the same way: corrupt
 * JSON, an unknown schema version, an unusable shift, or settings that did not
 * survive normalisation. There is no `'repaired'` here by design.
 */
export function readLastFortnight(
  currentPayPeriodEnd: IsoDate,
  store: PreferenceStore | null = browserStore(),
): LastFortnight | null {
  if (store === null) return null

  let raw: string | null
  try {
    raw = store.getItem(LAST_FORTNIGHT_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return discard(store)
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== LAST_FORTNIGHT_SCHEMA_VERSION) {
    return discard(store)
  }

  const payPeriodEnd = parsed.payPeriodEnd
  if (typeof payPeriodEnd !== 'string' || !isIsoDate(payPeriodEnd)) {
    return discard(store)
  }
  if (payPeriodEnd === currentPayPeriodEnd) return discard(store)

  const stored = Array.isArray(parsed.shifts) ? parsed.shifts : []
  const shifts = stored
    .map(parseStoredShift)
    .filter((shift): shift is OtShift => shift !== null)
  // All or nothing. A list one shift short would understate the take-home by a
  // figure nobody could spot, since the shifts behind it are no longer editable.
  if (shifts.length === 0 || shifts.length !== stored.length) return discard(store)

  const preferences = normalisePreferences(parsed.preferences)
  if (!preferencesSurvived(parsed.preferences, preferences)) return discard(store)

  return { payPeriodEnd: payPeriodEnd as IsoDate, shifts, preferences }
}

/** Drop the record and report nothing to show. */
function discard(store: PreferenceStore): null {
  clearLastFortnight(store)
  return null
}

/**
 * Let go of the carried fortnight.
 *
 * Called when the new fortnight gets its first shift — the banner has done its
 * job the moment the user has moved on — when they dismiss it by hand, and from
 * "Clear saved settings", which nothing survives.
 */
export function clearLastFortnight(
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  try {
    store.removeItem(LAST_FORTNIGHT_KEY)
    return true
  } catch {
    return false
  }
}
