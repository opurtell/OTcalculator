/**
 * The fortnight that just ended, kept once and then let go of.
 *
 * This record is the odd one out in `src/storage/`: everything else repairs
 * what it can and tells the user, because everything else sits beside inputs
 * the user can check it against. A carried fortnight does not — the shifts are
 * gone from the list and the settings that priced them are no longer the ones
 * on screen — so the contract here is all or nothing, and these tests are
 * mostly about the "nothing" half.
 */

import { describe, expect, it } from 'vitest'
import type { IsoDate, OtShift } from '../../engine/types'
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, SCHEMA_VERSION } from '../preferences'
import type { PreferenceStore, Preferences } from '../preferences'
import {
  LAST_FORTNIGHT_KEY,
  LAST_FORTNIGHT_SCHEMA_VERSION,
  clearLastFortnight,
  readLastFortnight,
  saveLastFortnight,
} from '../last-fortnight'
import { SHIFTS_KEY, SHIFTS_SCHEMA_VERSION, readShifts, saveShifts } from '../shifts'

/** This pay fortnight, and the one before it. */
const THIS_PERIOD: IsoDate = '2026-08-12'
const LAST_PERIOD: IsoDate = '2026-07-29'

/** Saturday 25 July 2026, 09:00–19:00, picked up — inside `LAST_PERIOD`. */
const SATURDAY: OtShift = {
  id: 'shift-1',
  date: '2026-07-25',
  startMin: 9 * 60,
  endMin: 19 * 60,
  endsNextDay: false,
  kind: 'separate',
}

const WEDNESDAY: OtShift = {
  id: 'shift-2',
  date: '2026-07-22',
  startMin: 16 * 60 + 30,
  endMin: 18 * 60 + 30,
  endsNextDay: false,
  kind: 'overrun',
}

/** AP1 Step 2 with a study debt — settings the defaults would not produce. */
const SETTINGS: Preferences = {
  ...DEFAULT_PREFERENCES,
  payBand: { classification: 'AP1', step: 2 },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: true },
}

function fakeStore(): PreferenceStore & { entries: Map<string, string> } {
  return {
    entries: new Map<string, string>(),
    getItem(key: string) {
      return this.entries.get(key) ?? null
    },
    setItem(key: string, value: string) {
      this.entries.set(key, value)
    },
    removeItem(key: string) {
      this.entries.delete(key)
    },
  }
}

/** Safari in private browsing, and a full quota, both look like this. */
function hostileStore(): PreferenceStore {
  return {
    getItem() {
      throw new Error('SecurityError')
    },
    setItem() {
      throw new Error('QuotaExceededError')
    },
    removeItem() {
      throw new Error('SecurityError')
    },
  }
}

/** Put an arbitrary payload under the carry-over key. */
function storeHolding(payload: unknown): ReturnType<typeof fakeStore> {
  const store = fakeStore()
  store.setItem(LAST_FORTNIGHT_KEY, JSON.stringify(payload))
  return store
}

describe('round trip', () => {
  it('reads back the fortnight it was given', () => {
    const store = fakeStore()
    expect(
      saveLastFortnight(LAST_PERIOD, [SATURDAY, WEDNESDAY], SETTINGS, store),
    ).toBe(true)

    expect(readLastFortnight(THIS_PERIOD, store)).toEqual({
      payPeriodEnd: LAST_PERIOD,
      shifts: [SATURDAY, WEDNESDAY],
      preferences: SETTINGS,
    })
  })

  it('carries the settings the fortnight was worked out on, not today’s', () => {
    // The whole reason the settings are stored rather than looked up: a pay
    // band edited on the Thursday must not restate a figure already shown.
    const store = fakeStore()
    saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, store)
    store.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ...DEFAULT_PREFERENCES,
        payBand: { classification: 'AP4', step: 1 },
      }),
    )

    expect(readLastFortnight(THIS_PERIOD, store)?.preferences.payBand).toEqual({
      classification: 'AP1',
      step: 2,
    })
  })

  it('stores what was typed and nothing derived from it', () => {
    const store = fakeStore()
    saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, store)

    const written = JSON.parse(store.getItem(LAST_FORTNIGHT_KEY) ?? '{}')
    expect(written.schemaVersion).toBe(LAST_FORTNIGHT_SCHEMA_VERSION)
    expect(written.payPeriodEnd).toBe(LAST_PERIOD)
    // No take-home, no PAYG, no overtime total: the figure the banner shows is
    // recomputed from these inputs by the same engine that first produced it.
    expect(Object.keys(written).sort()).toEqual([
      'payPeriodEnd',
      'preferences',
      'schemaVersion',
      'shifts',
    ])
    expect(Object.keys(written.shifts[0]).sort()).toEqual([
      'date',
      'endMin',
      'id',
      'kind',
      'startMin',
    ])
  })

  it('keeps `endsNextDay` derived rather than trusted', () => {
    const store = fakeStore()
    saveLastFortnight(
      LAST_PERIOD,
      [{ ...SATURDAY, startMin: 21 * 60, endMin: 7 * 60, endsNextDay: true }],
      SETTINGS,
      store,
    )
    expect(readLastFortnight(THIS_PERIOD, store)?.shifts[0].endsNextDay).toBe(true)
  })

  it('leaves no record at all for a fortnight with no shifts in it', () => {
    // Nothing to carry: an empty fortnight's take-home is the base pay the app
    // is about to show for this one anyway.
    const store = fakeStore()
    saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, store)
    expect(saveLastFortnight(LAST_PERIOD, [], SETTINGS, store)).toBe(true)

    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
  })

  it('is let go of on request', () => {
    const store = fakeStore()
    saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, store)
    expect(clearLastFortnight(store)).toBe(true)
    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
  })
})

describe('the handover from shifts.ts', () => {
  it('hands back what the expired record held', () => {
    const store = fakeStore()
    saveShifts(LAST_PERIOD, [SATURDAY, WEDNESDAY], store)

    const read = readShifts(THIS_PERIOD, store)
    expect(read.status).toBe('expired')
    expect(read.expired).toEqual({
      payPeriodEnd: LAST_PERIOD,
      shifts: [SATURDAY, WEDNESDAY],
    })
    // And still leaves the shifts key, which is the invariant that keeps last
    // fortnight's pickups out of this fortnight's total.
    expect(store.getItem(SHIFTS_KEY)).toBeNull()
  })

  it('hands back nothing when a shift in the expired record was unusable', () => {
    // A carry-over one shift short would understate a take-home that sits
    // beside no list to check it against.
    const store = fakeStore()
    saveShifts(LAST_PERIOD, [SATURDAY, WEDNESDAY], store)
    const record = JSON.parse(store.getItem(SHIFTS_KEY) ?? '{}')
    record.shifts[1].startMin = 'quarter past'
    store.setItem(SHIFTS_KEY, JSON.stringify(record))

    const read = readShifts(THIS_PERIOD, store)
    expect(read.status).toBe('expired')
    expect(read.expired).toBeUndefined()
  })

  it('hands back nothing when the record is this fortnight’s', () => {
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [SATURDAY], store)
    expect(readShifts(THIS_PERIOD, store).expired).toBeUndefined()
  })

  it('treats an unparseable period stamp as unreadable, not as history', () => {
    // "Cleared because the fortnight rolled over" is a claim about what
    // happened, and a banner naming its dates cannot be built from a stamp
    // that is not a date.
    const store = fakeStore()
    store.setItem(
      SHIFTS_KEY,
      JSON.stringify({
        schemaVersion: SHIFTS_SCHEMA_VERSION,
        payPeriodEnd: 'last one',
        shifts: [SATURDAY],
      }),
    )

    const read = readShifts(THIS_PERIOD, store)
    expect(read.status).toBe('unreadable')
    expect(read.expired).toBeUndefined()
  })
})

describe('all or nothing', () => {
  it('drops a record whose period stamp has caught up with the present', () => {
    // A corrected anchor, or a device whose clock was wrong. It is no longer
    // history, and showing it as history would be the app inventing a past.
    const store = fakeStore()
    saveLastFortnight(THIS_PERIOD, [SATURDAY], SETTINGS, store)

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
  })

  it('drops a record with an unusable shift in it rather than shortening it', () => {
    const store = storeHolding({
      schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION,
      payPeriodEnd: LAST_PERIOD,
      preferences: SETTINGS,
      shifts: [SATURDAY, { ...WEDNESDAY, kind: 'sideways' }],
    })

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
  })

  it('drops a record whose settings did not survive normalisation', () => {
    // Elsewhere this is `'repaired'` and a quiet line. Here there is nothing to
    // say it against: a take-home worked out on a defaulted pay band would be
    // a wrong figure with no way for the user to notice.
    const store = storeHolding({
      schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION,
      payPeriodEnd: LAST_PERIOD,
      preferences: { ...SETTINGS, payBand: { classification: '', step: 2 } },
      shifts: [SATURDAY],
    })

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
  })

  it('drops a record with no shifts left in it', () => {
    const store = storeHolding({
      schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION,
      payPeriodEnd: LAST_PERIOD,
      preferences: SETTINGS,
      shifts: [],
    })

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
  })

  it('drops a record with no readable period stamp', () => {
    const store = storeHolding({
      schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION,
      payPeriodEnd: '2026-02-30',
      preferences: SETTINGS,
      shifts: [SATURDAY],
    })

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
  })

  it('discards an unrecognised schema version', () => {
    const store = storeHolding({
      schemaVersion: LAST_FORTNIGHT_SCHEMA_VERSION + 1,
      payPeriodEnd: LAST_PERIOD,
      preferences: SETTINGS,
      shifts: [SATURDAY],
    })

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
  })

  it('reports corrupt JSON as nothing to show, and clears it', () => {
    const store = fakeStore()
    store.setItem(LAST_FORTNIGHT_KEY, '{not json')

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(store.getItem(LAST_FORTNIGHT_KEY)).toBeNull()
  })
})

describe('the lifecycle, one boot at a time', () => {
  it('carries a fortnight across the rollover and lets go on the first new shift', () => {
    const store = fakeStore()

    // Fortnight A, mid-fortnight: two shifts entered.
    saveShifts(LAST_PERIOD, [SATURDAY, WEDNESDAY], store)

    // Boot on the Thursday. The list expires, and what it held is put aside
    // with the settings that priced it — the two calls `App` makes in that
    // order, and the order matters: the archive is written before anything
    // else can touch the device.
    const rolled = readShifts(THIS_PERIOD, store)
    expect(rolled.shifts).toEqual([])
    saveLastFortnight(
      rolled.expired!.payPeriodEnd,
      rolled.expired!.shifts,
      SETTINGS,
      store,
    )

    const banner = readLastFortnight(THIS_PERIOD, store)
    expect(banner?.payPeriodEnd).toBe(LAST_PERIOD)
    expect(banner?.shifts).toHaveLength(2)

    // A reload before the user has done anything still shows it: the record is
    // on the device, not in the session.
    expect(readLastFortnight(THIS_PERIOD, store)).toEqual(banner)

    // The first shift of fortnight B. The banner has done its job.
    saveShifts(THIS_PERIOD, [{ ...SATURDAY, date: '2026-08-01' }], store)
    clearLastFortnight(store)

    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(readShifts(THIS_PERIOD, store).shifts).toHaveLength(1)
  })

  it('carries nothing forward from a fortnight nobody worked overtime in', () => {
    // Two rollovers with no shifts in between. Nothing is written, and the
    // record from the fortnight that did have shifts is not resurrected.
    const store = fakeStore()
    const rolled = readShifts(THIS_PERIOD, store)

    expect(rolled.expired).toBeUndefined()
    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
  })
})

describe('hostile input', () => {
  it('survives a store that is not there', () => {
    expect(readLastFortnight(THIS_PERIOD, null)).toBeNull()
    expect(saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, null)).toBe(false)
    expect(clearLastFortnight(null)).toBe(false)
  })

  it('survives a store that throws on every call', () => {
    const store = hostileStore()
    expect(readLastFortnight(THIS_PERIOD, store)).toBeNull()
    expect(saveLastFortnight(LAST_PERIOD, [SATURDAY], SETTINGS, store)).toBe(false)
    expect(clearLastFortnight(store)).toBe(false)
  })

  it('does not confuse the three keys with one another', () => {
    // All three records live in the same origin. A carry-over read that
    // happened to pick up the preferences blob would show a fortnight nobody
    // worked.
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [SATURDAY], store)
    saveLastFortnight(LAST_PERIOD, [WEDNESDAY], SETTINGS, store)

    expect(readShifts(THIS_PERIOD, store).shifts).toEqual([SATURDAY])
    expect(readLastFortnight(THIS_PERIOD, store)?.shifts).toEqual([WEDNESDAY])

    clearLastFortnight(store)
    expect(readShifts(THIS_PERIOD, store).shifts).toEqual([SATURDAY])
  })
})
