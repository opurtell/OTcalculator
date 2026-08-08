/**
 * Settings that survive a reload (§4.4).
 *
 * Three rules shape this module:
 *
 * 1. **Reading never throws.** Corrupt JSON, an unknown schema version, a
 *    missing key, a `localStorage` that throws on access in private browsing —
 *    every one of them yields defaults. A calculator that white-screens on a
 *    stale key is worse than one that forgets your settings.
 * 2. **Shifts are not stored.** They are transient by nature and persisting
 *    them creates a stale-data trap: last fortnight's overtime silently
 *    inflating this fortnight's answer. A "keep this fortnight" opt-in is a
 *    reasonable v1.1 addition; the default is not.
 * 3. **Storage validates shape, not meaning.** A pay band that no longer
 *    exists in Annex A is a question for `payBandFor`, which already returns
 *    `undefined` for exactly this case. Importing `data/` here would put the
 *    rate tables behind a browser API for no gain.
 */

/** The one key. Namespaced because Pages serves other apps from the same origin. */
export const PREFERENCES_KEY = 'actas-ot-calculator/preferences'

/**
 * Bump when a stored field changes meaning. A version this code does not
 * recognise is discarded wholesale rather than migrated — there is no v1 in
 * the wild, and the plan (§4.4) names 2 as the starting point.
 */
export const SCHEMA_VERSION = 2

/** Which calculator the user was last in (§5). */
export type Pathway = 'quick' | 'fortnight'

export interface Preferences {
  payBand: { classification: string; step: number }
  /** Set when the user's own payslip disagrees with the table. `null` = derive. */
  overrides: { annualBase: number | null; fortnightlyGross: number | null }
  tax: { claimsTaxFreeThreshold: boolean; hasStudyDebt: boolean }
  /** Mirrors `DeductionSettings` in `engine/packaging.ts`. */
  deductions: { fixedPerFortnight: number; percentOfGross: number }
  lastPathway: Pathway
}

/**
 * AP1 Step 1 and the tax-free threshold claimed: the commonest starting point
 * for the cohort, and both harmless to be wrong about since the setup screen
 * asks before any figure is shown.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  payBand: { classification: 'AP1', step: 1 },
  overrides: { annualBase: null, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  lastPathway: 'fortnight',
}

/**
 * The slice of the Web Storage API this module uses.
 *
 * Narrowed to three methods so tests can pass a plain object, and so a future
 * `sessionStorage` or in-memory store needs no change here.
 */
export interface PreferenceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * `localStorage`, or `null` where there isn't one.
 *
 * Safari in private browsing and Chrome with third-party storage blocked both
 * throw on *access* to the property, not just on use, so the guard has to be a
 * try/catch rather than a `typeof` check.
 */
export function browserStore(): PreferenceStore | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Field validation
//
// Each field is checked and defaulted on its own. A stored object that has
// gained a good pay band but lost its deductions keeps the pay band — the
// alternative, discarding everything on any flaw, throws away settings the
// user did enter.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rejects `NaN`, both infinities and negatives — none can mean money. */
function money(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

/** A fraction of gross, e.g. `0.05`. Anything outside 0–1 is a unit confusion. */
function fraction(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** `null` is a meaningful value here — "no override" — so it round-trips. */
function optionalMoney(value: unknown, fallback: number | null): number | null {
  if (value === null) return null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  return fallback
}

function payBand(value: unknown): Preferences['payBand'] {
  const fallback = DEFAULT_PREFERENCES.payBand
  if (!isRecord(value)) return fallback

  const classification = value.classification
  const step = value.step
  if (typeof classification !== 'string' || classification === '') return fallback
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 1) return fallback

  return { classification, step }
}

function pathway(value: unknown): Pathway {
  return value === 'quick' || value === 'fortnight'
    ? value
    : DEFAULT_PREFERENCES.lastPathway
}

/**
 * Coerce anything at all into a usable `Preferences`.
 *
 * Exported because it is the whole defensive contract in one function, and
 * asserting it directly is easier than asserting it through a store.
 */
export function normalisePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES

  const overrides = isRecord(value.overrides) ? value.overrides : {}
  const tax = isRecord(value.tax) ? value.tax : {}
  const deductions = isRecord(value.deductions) ? value.deductions : {}
  const defaults = DEFAULT_PREFERENCES

  return {
    payBand: payBand(value.payBand),
    overrides: {
      annualBase: optionalMoney(overrides.annualBase, defaults.overrides.annualBase),
      fortnightlyGross: optionalMoney(
        overrides.fortnightlyGross,
        defaults.overrides.fortnightlyGross,
      ),
    },
    tax: {
      claimsTaxFreeThreshold: bool(
        tax.claimsTaxFreeThreshold,
        defaults.tax.claimsTaxFreeThreshold,
      ),
      hasStudyDebt: bool(tax.hasStudyDebt, defaults.tax.hasStudyDebt),
    },
    deductions: {
      fixedPerFortnight: money(
        deductions.fixedPerFortnight,
        defaults.deductions.fixedPerFortnight,
      ),
      percentOfGross: fraction(
        deductions.percentOfGross,
        defaults.deductions.percentOfGross,
      ),
    },
    lastPathway: pathway(value.lastPathway),
  }
}

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

/**
 * How the read went. The UI does not have to care, but `'repaired'` is worth a
 * quiet line on the settings screen — a pay band that resets itself with no
 * explanation is the kind of thing that makes someone distrust the figures.
 */
export type ReadStatus =
  /** Nothing stored, or no storage at all. First run. */
  | 'empty'
  /** Read back exactly as written. */
  | 'ok'
  /** Stored, but one or more fields were unusable and took their default. */
  | 'repaired'
  /** Unparseable or from an unrecognised schema version. All defaults. */
  | 'unreadable'

export interface PreferenceRead {
  preferences: Preferences
  status: ReadStatus
}

/**
 * Read with the outcome attached. Never throws — see the module header.
 */
export function readPreferences(
  store: PreferenceStore | null = browserStore(),
): PreferenceRead {
  if (store === null) return { preferences: DEFAULT_PREFERENCES, status: 'empty' }

  let raw: string | null
  try {
    raw = store.getItem(PREFERENCES_KEY)
  } catch {
    // A store that throws on read is a store that will throw on write too, but
    // the user still gets a working calculator for this session.
    return { preferences: DEFAULT_PREFERENCES, status: 'empty' }
  }

  if (raw === null) return { preferences: DEFAULT_PREFERENCES, status: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { preferences: DEFAULT_PREFERENCES, status: 'unreadable' }
  }

  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return { preferences: DEFAULT_PREFERENCES, status: 'unreadable' }
  }

  const preferences = normalisePreferences(parsed)
  return {
    preferences,
    status: fieldsSurvived(parsed, preferences) ? 'ok' : 'repaired',
  }
}

/**
 * Did every stored field make it through validation unchanged?
 *
 * Compares the stored payload against the normalised one field by field. A
 * difference means something was defaulted, which is what `'repaired'` reports.
 */
function fieldsSurvived(stored: Record<string, unknown>, result: Preferences): boolean {
  const { schemaVersion: _ignored, ...rest } = stored
  return JSON.stringify(sortKeys(rest)) === JSON.stringify(sortKeys(result))
}

/** Key order is not meaningful in the stored JSON, so it is normalised away. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  )
}

/** The common case: settings in, no questions asked. */
export function loadPreferences(
  store: PreferenceStore | null = browserStore(),
): Preferences {
  return readPreferences(store).preferences
}

/**
 * Write, reporting whether it landed.
 *
 * `false` means the settings will not survive this session — a full quota or a
 * blocked store. Worth surfacing once; never worth throwing over, because the
 * calculation itself is unaffected.
 */
export function savePreferences(
  preferences: Preferences,
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  try {
    store.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...preferences }),
    )
    return true
  } catch {
    return false
  }
}

/** The "Clear saved settings" control in Settings (§4.4). */
export function clearPreferences(
  store: PreferenceStore | null = browserStore(),
): boolean {
  if (store === null) return false
  try {
    store.removeItem(PREFERENCES_KEY)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Debounced writing
// ---------------------------------------------------------------------------

export interface PreferenceWriter {
  /** Queue a write. Later calls replace earlier ones rather than queueing. */
  save(preferences: Preferences): void
  /** Write any pending value now. Call this on `pagehide`. */
  flush(): boolean
  /** Drop any pending value unwritten — after a clear, for instance. */
  cancel(): void
}

/**
 * §4.4 asks for writes to be debounced, because the settings panel is a set of
 * live-updating fields: typing a salary would otherwise write on every
 * keystroke.
 *
 * `flush()` exists because a debounced write can lose the last edit when the
 * tab closes inside the delay window. Phase 5 wires it to `pagehide`, which
 * fires on mobile Safari where `beforeunload` does not.
 */
export function createPreferenceWriter(
  options: { delayMs?: number; store?: PreferenceStore | null } = {},
): PreferenceWriter {
  const delayMs = options.delayMs ?? 400
  const store = options.store === undefined ? browserStore() : options.store

  let pending: Preferences | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    save(preferences) {
      pending = preferences
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        const value = pending
        pending = null
        if (value !== null) savePreferences(value, store)
      }, delayMs)
    },
    flush() {
      clearTimer()
      const value = pending
      pending = null
      return value === null ? false : savePreferences(value, store)
    },
    cancel() {
      clearTimer()
      pending = null
    },
  }
}
