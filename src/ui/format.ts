/**
 * Display formatting. The engine works in full precision and decimal hours;
 * everything here is the last step before a figure reaches a screen.
 */

/** Typographic minus (U+2212), not a hyphen — it aligns with tabular digits. */
export const MINUS = '−'

const AUD = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export type MoneySign = 'auto' | 'always-negative' | 'none'

export interface FormatMoneyOptions {
  /** Show the `$`. Off for figures in a column that already says so. */
  currency?: boolean
  /**
   * `auto` prints the value's own sign; `always-negative` forces the minus for
   * money-out rows written as positive numbers; `none` prints the magnitude.
   */
  sign?: MoneySign
}

/**
 * `$4,908.32` — always two decimals, always a thousands separator.
 * Money out carries an explicit minus so the red/green distinction is never
 * doing the work alone (§8).
 */
export function formatMoney(
  value: number,
  { currency = true, sign = 'auto' }: FormatMoneyOptions = {},
): string {
  const magnitude = AUD.format(Math.abs(value))
  const body = currency ? `$${magnitude}` : magnitude
  if (sign === 'none') return body
  if (sign === 'always-negative') return `${MINUS}${body}`
  return value < 0 ? `${MINUS}${body}` : body
}

/**
 * `10h`, `2h 15m`, `45m`. Never decimal hours — `2.25h` is harder to read at a
 * glance than `2h 15m`, even though the engine works in decimals (§4.2).
 */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** `09:00` from minutes since midnight (0–1439). */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * `63% kept` — the retention figure, rounded to a whole percent. Framed as
 * kept rather than lost, per the copy deck.
 */
export function formatKept(net: number, gross: number): string {
  if (gross === 0) return '0% kept'
  return `${Math.round((net / gross) * 100)}% kept`
}
