import { useEffect, useRef, useState } from 'react'
import { formatMoney } from './format'
import type { MoneySign } from './format'

/** ~200ms: long enough to notice the change, short enough not to wait on. */
const TRANSITION_MS = 200

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Counts from the previous value to the new one when `animate` is set.
 *
 * Seeing the number move is the core experience — it is how you feel a shift
 * being worth something. But it must never delay a reading, so the tween is
 * short and eased out, and `prefers-reduced-motion` removes it entirely
 * rather than merely shortening it (§8).
 */
function useCountTo(target: number, animate: boolean) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      fromRef.current = target
      setDisplay(target)
      return
    }
    const from = fromRef.current
    if (from === target) return

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TRANSITION_MS)
      const eased = 1 - (1 - t) ** 3
      setDisplay(from + (target - from) * eased)
      if (t < 1) {
        frame = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      fromRef.current = target
    }
  }, [target, animate])

  return animate ? display : target
}

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
  /** Count to the new value when it changes. On for the headline result. */
  animate?: boolean
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
  animate = false,
}: MoneyProps) {
  const shown = useCountTo(value, animate)

  const classes = [
    'sl-money',
    tone !== 'default' ? `sl-money--${tone}` : '',
    size === 'display' ? 'sl-money--display' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes}>{formatMoney(shown, { currency, sign })}</span>
}
