/**
 * The wiring between persistence (§4.4) and the calculator seam (§5).
 *
 * What is tested here is the one thing this file owns that nothing else covers:
 * the bridge between the stored `Preferences` shape and `CalculatorChoices`, and
 * that the right initial choices reach the calculator from a stored record. The
 * setup-vs-calculator decision underneath is the `Calculator`'s own, and its
 * behaviour is covered in `components/__tests__/calculator.test.tsx`.
 *
 * `renderToStaticMarkup` runs initialisers but no effects, so the `pagehide`
 * flush and the debounced writer never fire in these renders. The writer itself
 * is exercised in `storage/__tests__/preferences.test.ts`.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App, choicesFromPreferences, preferencesFromChoices } from './App'
import { DEFAULT_CHOICES } from './app/settings'
import type { CalculatorChoices } from './app/settings'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  savePreferences,
} from './storage/preferences'
import type { PreferenceStore, Preferences } from './storage/preferences'

/** AP1 Step 2 — the §4.5 golden fixture's band. */
const AP1_STEP_2: Preferences = {
  payBand: { classification: 'AP1', step: 2 },
  overrides: { annualBase: null, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  lastPathway: 'fortnight',
}

/** A `localStorage` stand-in. The test env is node, so there is no real one. */
function fakeStore(): PreferenceStore & { value: string | null } {
  return {
    value: null,
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

/** A store pre-loaded with a record this code would have written. */
function storeWith(preferences: Preferences) {
  const store = fakeStore()
  savePreferences(preferences, store)
  return store
}

describe('preferences <-> choices adapters', () => {
  it('maps the default stored record to the default choices', () => {
    // First run: nothing the user set, so the boot record is all defaults.
    expect(choicesFromPreferences(DEFAULT_PREFERENCES)).toEqual(DEFAULT_CHOICES)
  })

  it('round-trips choices with overrides without loss', () => {
    const choices: CalculatorChoices = {
      band: {
        classification: 'AP1',
        step: 2,
        annualBase: 100000,
        fortnightlyGross: 5500,
      },
      tax: { claimsTaxFreeThreshold: false, hasStudyDebt: true },
      deductions: { fixedPerFortnight: 611, percentOfGross: 0.05 },
      pathway: 'quick',
    }

    // Choices -> record: the band splits into identity and overrides, and the
    // pathway is renamed. Nothing else moves.
    const record = preferencesFromChoices(choices)
    expect(record.payBand).toEqual({ classification: 'AP1', step: 2 })
    expect(record.overrides).toEqual({ annualBase: 100000, fortnightlyGross: 5500 })
    expect(record.lastPathway).toBe('quick')
    expect(record.tax).toEqual(choices.tax)
    expect(record.deductions).toEqual(choices.deductions)

    // Record -> choices: and back, whole.
    expect(choicesFromPreferences(record)).toEqual(choices)
  })

  it('round-trips a record with no overrides (null survives both ways)', () => {
    const record = preferencesFromChoices(DEFAULT_CHOICES)
    expect(record.overrides).toEqual({ annualBase: null, fortnightlyGross: null })
    expect(choicesFromPreferences(record)).toEqual(DEFAULT_CHOICES)
  })
})

describe('App', () => {
  it('wraps the calculator in the Station Ledger root', () => {
    // Components outside sl-root inherit the host page's styles and look
    // wrong, so the wrapper is worth asserting rather than assuming.
    const html = renderToStaticMarkup(<App store={null} />)
    expect(html).toContain('class="sl-root sl-measure"')
  })

  it('carries the permanent disclaimer on the setup screen', () => {
    const html = renderToStaticMarkup(<App store={null} />)
    expect(html).toContain('Estimate only')
    expect(html).toContain('Check your payslip.')
  })

  it('starts at setup and says it cannot save when there is no store', () => {
    // A browser that refuses localStorage: private browsing, blocked storage.
    // Also the default in the node test env, where browserStore() is null.
    // (The apostrophe in "won't" is HTML-encoded on the way out, so the
    // assertion sticks to a substring with no apostrophe.)
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Set your pay band')
    expect(html).toContain('set it each visit')
    expect(html).not.toContain('Your fortnight')
  })

  it('skips setup and shows the stored band when a usable record exists', () => {
    const store = storeWith(AP1_STEP_2)
    const html = renderToStaticMarkup(<App store={store} />)

    expect(html).not.toContain('Set your pay band')
    // The §4.5 ordinary gross is independent of the financial year, so it
    // holds for today's date (which selects the FY, §3.8) without coupling
    // this test to a particular day.
    expect(html).toContain('AP1 Step 2')
    expect(html).toContain('4,908.32')
  })

  it('boots into the calculator on the default band when the stored band is stale', () => {
    // A record outlives the table it was written against. It round-trips
    // (well-formed JSON, so the read is 'ok' and setup is skipped), but the
    // band no longer names a row — so `Calculator.fieldsFrom` falls back to
    // the default band rather than trapping the user on setup or crashing.
    const store = storeWith({
      ...AP1_STEP_2,
      payBand: { classification: 'AP9', step: 99 },
    })
    const html = renderToStaticMarkup(<App store={store} />)

    expect(html).not.toContain('Set your pay band')
    expect(html).toContain('AP1 Step 1')
  })

  it('says so when part of the stored record had to be defaulted', () => {
    // §4.4 repairs fields individually rather than discarding the record, so
    // the user can be looking at a band they never set. Silently swapping a
    // pay band is the one outcome the read must never produce quietly.
    const store = storeWith(AP1_STEP_2)
    const record = JSON.parse(store.value ?? '{}')
    delete record.deductions
    store.value = JSON.stringify(record)

    const html = renderToStaticMarkup(<App store={store} />)
    expect(html).toContain('set back to the defaults')
    // Still a working calculator on the band that did survive.
    expect(html).toContain('AP1 Step 2')
  })

  it('explains itself when the record cannot be read at all', () => {
    const store = fakeStore()
    store.setItem(PREFERENCES_KEY, '{not json')

    const html = renderToStaticMarkup(<App store={store} />)
    expect(html).toContain('Set your pay band')
    // Apostrophes come out HTML-encoded, so the assertion straddles one.
    expect(html).toContain('be read, so we')
    expect(html).toContain('started fresh')
  })

  it('reads defensively when the stored record turns corrupt after boot', () => {
    // Boot reads once; a later change to the store must not crash a fresh
    // mount. A second mount over the now-corrupt record falls back to setup
    // rather than throwing — the §4.4 contract.
    const store = storeWith(AP1_STEP_2)
    const htmlBefore = renderToStaticMarkup(<App store={store} />)
    expect(htmlBefore).toContain('4,908.32')

    store.value = JSON.stringify({ schemaVersion: 2 })
    store.setItem(PREFERENCES_KEY, '{not json')
    const htmlAfter = renderToStaticMarkup(<App store={store} />)
    expect(htmlAfter).toContain('Set your pay band')
  })
})
