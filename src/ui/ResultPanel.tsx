import type { ReactNode } from 'react'
import { Money } from './Money'
import { formatKept, formatMoney } from './format'

export interface ResultPanelProps {
  /**
   * The framing line above the figure — "Your OT adds", "Adds about".
   * "about" is doing real work in the quick-calculation variant; keep it.
   */
  label: string
  /** The take-home figure. This is the interface; everything else supports it. */
  amount: number
  /** Reads under the figure. Defaults to the copy deck's "take-home". */
  unit?: string
  /** Pre-tax figure, shown as "from $1,110.34 before tax". */
  beforeTax?: number
  /** Sticky on mobile so the number stays visible as the shift list scrolls. */
  sticky?: boolean
  /** The comparison table or anything else below the rule. */
  children?: ReactNode
}

/**
 * The headline. The one visually loud element on any screen.
 *
 * The figure is announced via `aria-live="polite"` so a change is heard without
 * interrupting, and the transition is ~200ms — long enough to notice, short
 * enough not to wait on. `prefers-reduced-motion` drops it to 0ms through the
 * `--duration-figure` token rather than a second code path.
 *
 * **The live region is the headline only, not the panel.** Every keystroke in
 * the app moves these figures, and a region wrapped around `children` would
 * re-read the whole comparison table, the captions and the working each time —
 * which is how a helpful announcement becomes something you turn off. What
 * changed loudly is the four lines above the rule; the rest is there to be
 * read at leisure.
 *
 * Retention is framed as "63% kept", never "37% lost" (§6).
 */
export function ResultPanel({
  label,
  amount,
  unit = 'take-home',
  beforeTax,
  sticky = false,
  children,
}: ResultPanelProps) {
  return (
    <section className={`sl-result${sticky ? ' sl-result--sticky' : ''}`}>
      <div className="sl-result__headline" aria-live="polite">
        <p className="sl-result__label">{label}</p>
        <p className="sl-result__amount">
          <Money value={amount} tone="net" size="display" animate />
        </p>
        <p className="sl-result__unit">{unit}</p>
        {beforeTax !== undefined ? (
          <p className="sl-result__support">
            <span className="sl-result__support-line">
              from {formatMoney(beforeTax)} before tax
            </span>
            <span className="sl-result__support-line">
              {formatKept(amount, beforeTax)}
            </span>
          </p>
        ) : null}
      </div>
      {children ? (
        <>
          <hr className="sl-result__divider" />
          {children}
        </>
      ) : null}
    </section>
  )
}
