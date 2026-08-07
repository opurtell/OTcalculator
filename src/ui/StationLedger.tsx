import type { ReactNode } from 'react'

export interface StationLedgerProps {
  /**
   * Leave unset to follow the operating system. A 3am shift offer is a real
   * use case, so dark is a first-class state rather than an afterthought.
   */
  theme?: 'light' | 'dark'
  /** Constrain to the 720px calculator column. This is not a dashboard. */
  measure?: boolean
  children: ReactNode
}

/**
 * The root wrapper. **Every Station Ledger screen must be inside one.**
 *
 * It carries the `sl-root` class that supplies the page background, ink
 * colour, base type, box-sizing and the focus-ring rule. Components rendered
 * outside it inherit the host page's styles instead and will look wrong —
 * unstyled text on a transparent background, with no focus ring.
 *
 * Setting `theme` stamps `data-theme` locally, which overrides the system
 * preference in both directions.
 */
export function StationLedger({
  theme,
  measure = false,
  children,
}: StationLedgerProps) {
  return (
    <div
      className={`sl-root${measure ? ' sl-measure' : ''}`}
      data-theme={theme}
    >
      {children}
    </div>
  )
}
