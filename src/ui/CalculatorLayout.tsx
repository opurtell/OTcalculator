import type { ReactNode } from 'react'

export interface CalculatorLayoutProps {
  /** The result panel. Sticky in both layouts — watching it move is the point. */
  result: ReactNode
  /** Inputs: the shift list, the add button, the settings disclosures. */
  children: ReactNode
}

/**
 * One layout, two shapes (§5.9).
 *
 * Below 900px the result pins to the top and the inputs scroll beneath it.
 * At 900px and above it becomes two columns — inputs left, sticky result
 * right. Same content, no new features: this is not a dashboard, and the
 * column is deliberately capped rather than filling a 1440px screen.
 *
 * The result comes first in the DOM in both shapes, so it is also first for
 * a screen reader and for keyboard order — which matches what the app is for.
 */
export function CalculatorLayout({ result, children }: CalculatorLayoutProps) {
  return (
    <div className="sl-layout">
      <div className="sl-layout__result">{result}</div>
      <div className="sl-layout__inputs">{children}</div>
    </div>
  )
}
