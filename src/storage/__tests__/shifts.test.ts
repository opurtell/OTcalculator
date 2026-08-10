/**
 * Saved shifts are the one stored thing that is allowed to expire, so the
 * tests come in two halves: that a fortnight survives everything a browser can
 * do to it, and that it does not survive the fortnight ending.
 *
 * The hostile-input half mirrors `preferences.test.ts` — the defensive
 * contract is the same one, and a shift list that white-screens the app on a
 * bad record would be a worse trade than never saving it at all.
 */

import { describe, expect, it } from 'vitest'
import type { IsoDate, OtShift } from '../../engine/types'
import {
  SHIFTS_KEY,
  SHIFTS_SCHEMA_VERSION,
  clearShifts,
  parseStoredShift,
  readShifts,
  saveShifts,
} from '../shifts'
import type { PreferenceStore } from '../preferences'

/** This pay fortnight, and the one before it. */
const THIS_PERIOD: IsoDate = '2026-08-12'
const LAST_PERIOD: IsoDate = '2026-07-29'

/** Saturday 8 August 2026, 09:00–19:00, picked up. */
const SATURDAY: OtShift = {
  id: 'shift-1',
  date: '2026-08-08',
  startMin: 9 * 60,
  endMin: 19 * 60,
  endsNextDay: false,
  kind: 'separate',
}

/** Sunday night into Monday — the case where `endsNextDay` matters. */
const NIGHT: OtShift = {
  id: 'shift-2',
  date: '2026-08-09',
  startMin: 21 * 60,
  endMin: 7 * 60,
  endsNextDay: true,
  kind: 'separate',
}

/**
 * A keyed `localStorage` stand-in. Keyed, unlike the preferences one: the app
 * now writes two records to the same store and a fake that ignored the key
 * would hand each read the other's JSON.
 */
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

/** Put an arbitrary payload under the shifts key. */
function storeHolding(payload: unknown): ReturnType<typeof fakeStore> {
  const store = fakeStore()
  store.setItem(SHIFTS_KEY, JSON.stringify(payload))
  return store
}

describe('round trip', () => {
  it('reads back the fortnight it was given', () => {
    const store = fakeStore()
    expect(saveShifts(THIS_PERIOD, [SATURDAY, NIGHT], store)).toBe(true)

    const read = readShifts(THIS_PERIOD, store)
    expect(read.status).toBe('ok')
    expect(read.shifts).toEqual([SATURDAY, NIGHT])
  })

  it('keeps `endsNextDay` true for a shift that runs past midnight', () => {
    // Derived on read rather than stored, so this is the assertion that the
    // derivation agrees with what the sheet decided when the shift was entered.
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [NIGHT], store)
    expect(readShifts(THIS_PERIOD, store).shifts[0].endsNextDay).toBe(true)
  })

  it('writes the pay period it belongs to, and nothing about the money', () => {
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [SATURDAY], store)

    const written = JSON.parse(store.getItem(SHIFTS_KEY) ?? '{}')
    expect(written.schemaVersion).toBe(SHIFTS_SCHEMA_VERSION)
    expect(written.payPeriodEnd).toBe(THIS_PERIOD)
    // No pay band, no rates, no figures: the record is what the user typed.
    expect(Object.keys(written.shifts[0]).sort()).toEqual([
      'date',
      'endMin',
      'id',
      'kind',
      'startMin',
    ])
  })

  it('leaves no record at all for an empty list', () => {
    // "No shifts this fortnight" and "nothing saved" are the same state, and
    // the version with no record is the one that also leaves the device.
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [SATURDAY], store)
    saveShifts(THIS_PERIOD, [], store)

    expect(store.getItem(SHIFTS_KEY)).toBeNull()
    expect(readShifts(THIS_PERIOD, store).status).toBe('empty')
  })
})

describe('expiry', () => {
  it('lets go of a record from an earlier pay fortnight', () => {
    // The stale-data trap §4.4 refused to open: last fortnight's pickups
    // silently inflating this fortnight's total.
    const store = fakeStore()
    saveShifts(LAST_PERIOD, [SATURDAY, NIGHT], store)

    const read = readShifts(THIS_PERIOD, store)
    expect(read.shifts).toEqual([])
    expect(read.status).toBe('expired')
  })

  it('drops the expired record rather than leaving it on the device', () => {
    const store = fakeStore()
    saveShifts(LAST_PERIOD, [SATURDAY], store)
    readShifts(THIS_PERIOD, store)

    expect(store.getItem(SHIFTS_KEY)).toBeNull()
  })

  it('expires a record from a *later* period too', () => {
    // A device whose clock was wrong, or a user who travelled backwards. Any
    // period that is not the one being asked about is not this fortnight's.
    const store = fakeStore()
    saveShifts(THIS_PERIOD, [SATURDAY], store)
    expect(readShifts(LAST_PERIOD, store).status).toBe('expired')
  })

  it('treats a record with no readable period as unreadable, not expired', () => {
    // "Cleared because the fortnight rolled over" is a claim about what
    // happened. A record that cannot say which fortnight it is from does not
    // support it, and the app says so differently.
    const store = storeHolding({
      schemaVersion: SHIFTS_SCHEMA_VERSION,
      payPeriodEnd: 42,
      shifts: [SATURDAY],
    })
    expect(readShifts(THIS_PERIOD, store).status).toBe('unreadable')
  })
})

describe('hostile input', () => {
  it('survives a store that is not there', () => {
    expect(readShifts(THIS_PERIOD, null)).toEqual({ shifts: [], status: 'empty' })
    expect(saveShifts(THIS_PERIOD, [SATURDAY], null)).toBe(false)
    expect(clearShifts(null)).toBe(false)
  })

  it('survives a store that throws on every call', () => {
    const store = hostileStore()
    expect(readShifts(THIS_PERIOD, store)).toEqual({ shifts: [], status: 'empty' })
    expect(saveShifts(THIS_PERIOD, [SATURDAY], store)).toBe(false)
    expect(clearShifts(store)).toBe(false)
  })

  it('reports corrupt JSON rather than throwing', () => {
    const store = fakeStore()
    store.setItem(SHIFTS_KEY, '{not json')
    expect(readShifts(THIS_PERIOD, store)).toEqual({
      shifts: [],
      status: 'unreadable',
    })
  })

  it('discards an unrecognised schema version', () => {
    const store = storeHolding({
      schemaVersion: SHIFTS_SCHEMA_VERSION + 1,
      payPeriodEnd: THIS_PERIOD,
      shifts: [SATURDAY],
    })
    expect(readShifts(THIS_PERIOD, store).status).toBe('unreadable')
  })

  it('keeps the shifts that survive and reports the ones that did not', () => {
    // One bad entry costs that entry, not the fortnight — the same
    // field-by-field repair the preferences record gets.
    const store = storeHolding({
      schemaVersion: SHIFTS_SCHEMA_VERSION,
      payPeriodEnd: THIS_PERIOD,
      shifts: [SATURDAY, { id: 'broken' }, NIGHT],
    })

    const read = readShifts(THIS_PERIOD, store)
    expect(read.shifts.map((shift) => shift.id)).toEqual(['shift-1', 'shift-2'])
    expect(read.status).toBe('repaired')
  })

  it('reads a record whose shifts are not a list as an empty fortnight', () => {
    const store = storeHolding({
      schemaVersion: SHIFTS_SCHEMA_VERSION,
      payPeriodEnd: THIS_PERIOD,
      shifts: 'all of them',
    })
    expect(readShifts(THIS_PERIOD, store).shifts).toEqual([])
  })
})

describe('parseStoredShift', () => {
  const stored = {
    id: 'shift-1',
    date: '2026-08-08',
    startMin: 540,
    endMin: 1140,
    kind: 'separate',
  }

  it('accepts what the app writes', () => {
    expect(parseStoredShift(stored)).toEqual(SATURDAY)
  })

  it.each([
    ['not a record', 'shift-1'],
    ['no id', { ...stored, id: undefined }],
    ['an empty id', { ...stored, id: '' }],
    ['a date that is not a date', { ...stored, date: 'yesterday' }],
    ['a date that does not exist', { ...stored, date: '2026-02-31' }],
    ['a fractional minute', { ...stored, startMin: 540.5 }],
    ['a minute past midnight', { ...stored, endMin: 1440 }],
    ['a negative minute', { ...stored, startMin: -1 }],
    ['equal start and end', { ...stored, endMin: stored.startMin }],
    ['a kind the engine has never heard of', { ...stored, kind: 'callback' }],
  ])('refuses %s', (_label: string, value: unknown) => {
    expect(parseStoredShift(value)).toBeNull()
  })

  it('derives `endsNextDay` rather than believing the record', () => {
    // A hand-edited store cannot talk the engine into pricing a shift that
    // ends before it starts on the same day.
    const lying = { ...stored, startMin: 21 * 60, endMin: 7 * 60, endsNextDay: false }
    expect(parseStoredShift(lying)?.endsNextDay).toBe(true)
  })
})
