/**
 * The persistence layer's job is to never be the reason the app breaks, so
 * most of what follows is hostile input rather than round trips. §4.5 names
 * corrupt JSON, an unknown schema version and missing keys as required
 * coverage; the rest are the ways a real browser fails.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  SCHEMA_VERSION,
  clearPreferences,
  createPreferenceWriter,
  loadPreferences,
  normalisePreferences,
  readPreferences,
  savePreferences,
} from '../preferences'
import type { PreferenceStore, Preferences } from '../preferences'

/** A `localStorage` stand-in. The test env is node, so there is no real one. */
function fakeStore(initial?: string): PreferenceStore & { value: string | null } {
  return {
    value: initial ?? null,
    getItem() {
      return this.value
    },
    setItem(_key: string, value: string) {
      this.value = value
    },
    removeItem() {
      this.value = null
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

function stored(value: unknown): PreferenceStore & { value: string | null } {
  return fakeStore(JSON.stringify(value))
}

const COMPLETE: Preferences = {
  payBand: { classification: 'ICP1', step: 3 },
  overrides: { annualBase: 101_000, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: false, hasStudyDebt: true },
  deductions: { fixedPerFortnight: 250, percentOfGross: 0.05 },
  lastPathway: 'quick',
}

describe('round trip', () => {
  it('reads back exactly what was written', () => {
    const store = fakeStore()
    expect(savePreferences(COMPLETE, store)).toBe(true)

    expect(readPreferences(store)).toEqual({ preferences: COMPLETE, status: 'ok' })
  })

  it('stamps the schema version into the payload', () => {
    const store = fakeStore()
    savePreferences(COMPLETE, store)

    expect(JSON.parse(store.value as string).schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('keeps a null override null rather than turning it into a zero', () => {
    // Zero is a legitimate salary override in a way that would silently
    // produce a $0 fortnight; null has to survive as its own value.
    const store = fakeStore()
    savePreferences(DEFAULT_PREFERENCES, store)

    expect(loadPreferences(store).overrides.annualBase).toBeNull()
  })
})

describe('defensive reads', () => {
  it('returns defaults when nothing is stored', () => {
    expect(readPreferences(fakeStore())).toEqual({
      preferences: DEFAULT_PREFERENCES,
      status: 'empty',
    })
  })

  it('returns defaults when there is no storage at all', () => {
    expect(readPreferences(null)).toEqual({
      preferences: DEFAULT_PREFERENCES,
      status: 'empty',
    })
  })

  it('returns defaults on corrupt JSON', () => {
    const store = fakeStore('{"schemaVersion":2,"payBand":')

    expect(readPreferences(store)).toEqual({
      preferences: DEFAULT_PREFERENCES,
      status: 'unreadable',
    })
  })

  it('returns defaults on an unknown schema version', () => {
    const store = stored({ ...COMPLETE, schemaVersion: SCHEMA_VERSION + 1 })

    expect(readPreferences(store).preferences).toEqual(DEFAULT_PREFERENCES)
    expect(readPreferences(store).status).toBe('unreadable')
  })

  it('returns defaults when the version is missing entirely', () => {
    expect(readPreferences(stored(COMPLETE)).status).toBe('unreadable')
  })

  it.each([
    ['a JSON null', 'null'],
    ['an array', '[1,2,3]'],
    ['a bare string', '"settings"'],
    ['a number', '42'],
  ])('returns defaults on %s', (_label: string, raw: string) => {
    expect(loadPreferences(fakeStore(raw))).toEqual(DEFAULT_PREFERENCES)
  })

  it('survives a store that throws on access', () => {
    expect(() => readPreferences(hostileStore())).not.toThrow()
    expect(loadPreferences(hostileStore())).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('field-level repair', () => {
  it('keeps the good fields when one is missing', () => {
    // Discarding a pay band the user did enter because the deductions key went
    // missing would be the worse failure.
    const store = stored({
      schemaVersion: SCHEMA_VERSION,
      payBand: { classification: 'AP2', step: 4 },
    })

    const { preferences, status } = readPreferences(store)
    expect(preferences.payBand).toEqual({ classification: 'AP2', step: 4 })
    expect(preferences.deductions).toEqual(DEFAULT_PREFERENCES.deductions)
    expect(status).toBe('repaired')
  })

  it.each([
    ['a missing classification', { step: 2 }],
    ['a non-string classification', { classification: 7, step: 2 }],
    ['an empty classification', { classification: '', step: 2 }],
    ['a fractional step', { classification: 'AP1', step: 2.5 }],
    ['a zero step', { classification: 'AP1', step: 0 }],
    ['a string step', { classification: 'AP1', step: '2' }],
    ['not an object at all', 'AP1 Step 2'],
  ])('defaults the pay band on %s', (_label: string, payBand: unknown) => {
    expect(normalisePreferences({ payBand }).payBand).toEqual(
      DEFAULT_PREFERENCES.payBand,
    )
  })

  it('does not validate the pay band against Annex A', () => {
    // A step that no longer exists is payBandFor's problem — it already
    // returns undefined for stale settings. Duplicating the table here would
    // put the rates behind a browser API.
    expect(
      normalisePreferences({ payBand: { classification: 'AP9', step: 99 } }).payBand,
    ).toEqual({ classification: 'AP9', step: 99 })
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative', -50],
    ['a string', '250'],
    ['null', null],
  ])('defaults a fixed deduction of %s to zero', (_label: string, value: unknown) => {
    expect(
      normalisePreferences({ deductions: { fixedPerFortnight: value } }).deductions
        .fixedPerFortnight,
    ).toBe(0)
  })

  it('rejects a percentage stored as a whole number', () => {
    // 5 would mean 500% of gross and drive taxable income negative. The unit
    // is a fraction, and anything above 1 is a confusion rather than a choice.
    expect(
      normalisePreferences({ deductions: { percentOfGross: 5 } }).deductions
        .percentOfGross,
    ).toBe(0)
  })

  it('accepts the full range of a real percentage', () => {
    for (const value of [0, 0.05, 0.5, 1]) {
      expect(
        normalisePreferences({ deductions: { percentOfGross: value } }).deductions
          .percentOfGross,
      ).toBe(value)
    }
  })

  it.each([
    ['zero', 0],
    ['a negative', -1],
    ['a string', '95698'],
  ])('defaults an annual base override of %s to null', (_label: string, value: unknown) => {
    expect(
      normalisePreferences({ overrides: { annualBase: value } }).overrides.annualBase,
    ).toBeNull()
  })

  it.each([
    ['a string', 'yes'],
    ['a number', 1],
    ['undefined', undefined],
  ])('defaults a tax flag of %s', (_label: string, value: unknown) => {
    expect(normalisePreferences({ tax: { hasStudyDebt: value } }).tax.hasStudyDebt).toBe(
      DEFAULT_PREFERENCES.tax.hasStudyDebt,
    )
  })

  it('defaults an unrecognised pathway', () => {
    expect(normalisePreferences({ lastPathway: 'wizard' }).lastPathway).toBe(
      DEFAULT_PREFERENCES.lastPathway,
    )
  })

  it('accepts both real pathways', () => {
    expect(normalisePreferences({ lastPathway: 'quick' }).lastPathway).toBe('quick')
    expect(normalisePreferences({ lastPathway: 'fortnight' }).lastPathway).toBe(
      'fortnight',
    )
  })

  it('is idempotent — normalising its own output changes nothing', () => {
    const once = normalisePreferences({ payBand: { classification: 'AP2', step: 1 } })
    expect(normalisePreferences(once)).toEqual(once)
  })

  it('reports a fully valid payload as ok rather than repaired', () => {
    const store = stored({ schemaVersion: SCHEMA_VERSION, ...COMPLETE })
    expect(readPreferences(store).status).toBe('ok')
  })
})

describe('writing', () => {
  it('reports failure rather than throwing when the store rejects the write', () => {
    expect(savePreferences(COMPLETE, hostileStore())).toBe(false)
  })

  it('reports failure when there is no store', () => {
    expect(savePreferences(COMPLETE, null)).toBe(false)
  })
})

describe('clearing', () => {
  it('removes the key so the next read is a first run', () => {
    const store = fakeStore()
    savePreferences(COMPLETE, store)

    expect(clearPreferences(store)).toBe(true)
    expect(readPreferences(store)).toEqual({
      preferences: DEFAULT_PREFERENCES,
      status: 'empty',
    })
  })

  it('touches only this app\'s key', () => {
    // Pages serves every one of these repos from the same origin, so a clear
    // that reached for localStorage.clear() would take a neighbour's settings.
    const store = fakeStore()
    const removed: string[] = []
    clearPreferences({ ...store, removeItem: (key: string) => void removed.push(key) })

    expect(removed).toEqual([PREFERENCES_KEY])
  })

  it('does not throw when the store refuses', () => {
    expect(clearPreferences(hostileStore())).toBe(false)
    expect(clearPreferences(null)).toBe(false)
  })
})

describe('debounced writer', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes once for a burst of edits, keeping the last', () => {
    vi.useFakeTimers()
    const store = fakeStore()
    const writes: string[] = []
    const writer = createPreferenceWriter({
      delayMs: 400,
      store: { ...store, setItem: (_k: string, v: string) => void writes.push(v) },
    })

    writer.save({ ...COMPLETE, deductions: { fixedPerFortnight: 1, percentOfGross: 0 } })
    writer.save({ ...COMPLETE, deductions: { fixedPerFortnight: 12, percentOfGross: 0 } })
    writer.save({ ...COMPLETE, deductions: { fixedPerFortnight: 123, percentOfGross: 0 } })
    expect(writes).toHaveLength(0)

    vi.advanceTimersByTime(400)
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0]).deductions.fixedPerFortnight).toBe(123)
  })

  it('flushes a pending write immediately', () => {
    vi.useFakeTimers()
    const store = fakeStore()
    const writer = createPreferenceWriter({ delayMs: 400, store })

    writer.save(COMPLETE)
    expect(store.value).toBeNull()

    expect(writer.flush()).toBe(true)
    expect(loadPreferences(store)).toEqual(COMPLETE)
  })

  it('does not write twice when a flush is followed by the timer', () => {
    vi.useFakeTimers()
    const writes: string[] = []
    const writer = createPreferenceWriter({
      delayMs: 400,
      store: { ...fakeStore(), setItem: (_k: string, v: string) => void writes.push(v) },
    })

    writer.save(COMPLETE)
    writer.flush()
    vi.advanceTimersByTime(1000)

    expect(writes).toHaveLength(1)
  })

  it('flushes to nothing when there is no pending write', () => {
    const writer = createPreferenceWriter({ store: fakeStore() })
    expect(writer.flush()).toBe(false)
  })

  it('drops a pending write on cancel', () => {
    vi.useFakeTimers()
    const store = fakeStore()
    const writer = createPreferenceWriter({ delayMs: 400, store })

    writer.save(COMPLETE)
    writer.cancel()
    vi.advanceTimersByTime(1000)

    expect(store.value).toBeNull()
  })

  it('survives a hostile store without throwing', () => {
    vi.useFakeTimers()
    const writer = createPreferenceWriter({ delayMs: 400, store: hostileStore() })

    writer.save(COMPLETE)
    expect(() => vi.advanceTimersByTime(400)).not.toThrow()
  })
})
