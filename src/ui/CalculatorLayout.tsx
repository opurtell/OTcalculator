import type { ReactNode } from 'react'

export interface CalculatorLayoutProps {
  /** The result panel. This layout owns where it sits and whether it pins. */
  result: ReactNode
  /** Inputs: the shift list, the add button, the settings disclosures. */
  children: ReactNode
}

/**
 * One layout, two shapes (§5.9).
 *
 * Below 900px it is one column: the result at the top, scrolling away with the
 * page. At 900px and above it becomes two columns — inputs left, sticky result
 * right. Same content, no new features: this is not a dashboard, and the
 * column is deliberately capped rather than filling a 1440px screen.
 *
 * The result only pins in the two-column shape, where it has a column to
 * itself. Pinned over a single column it overlapped the inputs it was floating
 * above, which reads as a fault rather than as a feature.
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
