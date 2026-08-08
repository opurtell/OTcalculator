import { useEffect, useRef, useState } from 'react'
import { Calculator } from './components/Calculator'
import type { CalculatorChoices } from './app/settings'
import {
  browserStore,
  clearPreferences,
  createPreferenceWriter,
  readPreferences,
} from './storage/preferences'
import type { PreferenceStore, Preferences, PreferenceWriter } from './storage/preferences'
import { StationLedger } from './ui/index'

export interface AppProps {
  /**
   * Where settings are kept. Defaults to the browser's `localStorage`, and is
   * injectable for the same reason every storage function takes a store: the
   * test environment has no `localStorage`, and a hostile one refuses it.
   */
  store?: PreferenceStore | null
}

/**
 * The four lines that connect persistence (§4.4) to the calculator.
 *
 * `Calculator` owns every choice and reports changes upward; this file is the
 * one place that turns those reports into a `localStorage` write, and a stored
 * record back into the starting point on the next visit. The two shapes differ
 * only in how the band identity and its overrides are grouped, so the mapping
 * is structural — no rate or figure is interpreted here.
 */
export function App({ store = browserStore() }: AppProps = {}) {
  // Read once on boot. The read is defensive (§4.4): corrupt JSON, an unknown
  // schema version and a `localStorage` that throws on access all yield the
  // defaults rather than a white screen, so this never throws.
  const [boot] = useState(() => ({
    read: readPreferences(store),
    canRemember: store !== null,
  }))

  // One writer for the life of the page, writing to the same store. A ref
  // rather than state because the writer is a handle to a debounced timer, not
  // something that drives a render.
  const writerRef = useRef<PreferenceWriter | null>(null)
  if (writerRef.current === null) {
    writerRef.current = createPreferenceWriter({ store })
  }
  const writer = writerRef.current

  // §4.4: writes are debounced, so a tab closing inside the delay window would
  // lose the last edit. `pagehide` is the event that fires on mobile Safari
  // where `beforeunload` does not, so it is the one to flush on.
  useEffect(() => {
    const flush = () => writer.flush()
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [writer])

  return (
    <StationLedger measure>
      <Calculator
        initialChoices={choicesFromPreferences(boot.read.preferences)}
        startAtSetup={
          boot.read.status === 'empty' || boot.read.status === 'unreadable'
        }
        canRemember={boot.canRemember}
        onChoicesChange={(choices) => writer.save(preferencesFromChoices(choices))}
        onClearSettings={() => {
          // Drop the pending write before clearing, or the debounced save
          // would land after the clear and resurrect the settings.
          writer.cancel()
          clearPreferences(store)
        }}
      />
    </StationLedger>
  )
}

/**
 * Stored record in, calculator choices out.
 *
 * `Preferences` splits the band into its identity (`payBand`) and the user's
 * overrides; `CalculatorChoices` carries them as one `band`. That is the only
 * difference — `tax`, `deductions` and the pathway (renamed `lastPathway`) move
 * across unchanged.
 */
export function choicesFromPreferences(preferences: Preferences): CalculatorChoices {
  return {
    band: { ...preferences.payBand, ...preferences.overrides },
    tax: preferences.tax,
    deductions: preferences.deductions,
    pathway: preferences.lastPathway,
  }
}

/** The inverse: choices in, the persisted record out. */
export function preferencesFromChoices(choices: CalculatorChoices): Preferences {
  const { classification, step, annualBase, fortnightlyGross } = choices.band
  return {
    payBand: { classification, step },
    overrides: { annualBase, fortnightlyGross },
    tax: choices.tax,
    deductions: choices.deductions,
    lastPathway: choices.pathway,
  }
}
