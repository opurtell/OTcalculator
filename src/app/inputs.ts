/**
 * Turning what the user typed into figures, and figures back into the strings
 * a field shows.
 *
 * Every editable number in this app is held in state as the *string the user
 * typed*, not as a number. Round-tripping through `Number` mid-edit is what
 * makes a field fight its user: `"5."` becomes `5` and the decimal point
 * vanishes as it is typed, `""` becomes `0` and the field refuses to be
 * emptied. The parse happens on the way to the engine and nowhere else.
 *
 * `null` means "nothing usable here" and every caller reads it the same way:
 * an empty deduction is zero, an empty override is no override.
 */

import type { IsoDate } from '../engine/types'

/** Everything a person might type around a number and not mean. */
const NOISE = /[\s$,%]/g

function parseNumber(value: string): number | null {
  const cleaned = value.replace(NOISE, '')
  if (cleaned === '') return null
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  // A negative deduction or a negative salary is not a figure this app has any
  // use for, and the engine would clamp it silently. Rejecting it here keeps
  // the field's own arithmetic panel honest instead.
  if (parsed < 0) return null
  return parsed
}

/** `"$4,908.32"` → `4908.32`. */
export function parseAmount(value: string): number | null {
  return parseNumber(value)
}

/**
 * `"5"` → `0.05`.
 *
 * The user types whole percents; the engine takes a fraction
 * (`DeductionSettings.percentOfGross`). The conversion lives here so exactly
 * one module knows which side of the decimal point each figure is on.
 */
export function parsePercent(value: string): number | null {
  const parsed = parseNumber(value)
  return parsed === null ? null : parsed / 100
}

/** `0.05` → `"5"`. The inverse of `parsePercent`, for seeding a field. */
export function percentInputFor(fraction: number): string {
  if (fraction === 0) return ''
  // Two decimals is enough for any packaging percentage anyone states, and
  // trailing zeros read as noise in an input.
  return String(Number((fraction * 100).toFixed(2)))
}

/** `4908.32` → `"4908.32"`. Bare digits: the field carries the `$` affix. */
export function amountInputFor(amount: number | null): string {
  if (amount === null || amount === 0) return ''
  return String(Number(amount.toFixed(2)))
}

/**
 * `'2025-12-04'` → `'04/12/2025'`.
 *
 * Australian order, and never omitted where it appears — the copy deck makes
 * "Rates effective 04/12/2025" mandatory beside a derived figure.
 */
export function formatIsoDateAu(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
