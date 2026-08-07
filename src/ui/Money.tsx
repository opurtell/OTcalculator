import { formatMoney } from './format'
import type { MoneySign } from './format'

export interface MoneyProps {
  value: number
  /**
   * `out` is money leaving — tax, deductions. It is never used for errors or
   * alarm; this app has no alarming states. `net` is reserved for the take-home
   * result so the colour keeps meaning something (§4.1).
   */
  tone?: 'default' | 'out' | 'net' | 'muted'
  /** `display` is the headline figure only. */
  size?: 'inline' | 'display'
  sign?: MoneySign
  currency?: boolean
}

/**
 * Every money figure in the app renders through this component: mono, tabular,
 * two decimals, thousands separator. Tabular figures are mandatory — digits
 * must not shift as the result updates live.
 */
export function Money({
  value,
  tone = 'default',
  size = 'inline',
  sign = 'auto',
  currency = true,
}: MoneyProps) {
  const classes = [
    'sl-money',
    tone !== 'default' ? `sl-money--${tone}` : '',
    size === 'display' ? 'sl-money--display' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes}>{formatMoney(value, { currency, sign })}</span>
}
