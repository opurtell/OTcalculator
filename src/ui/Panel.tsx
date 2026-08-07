import type { HTMLAttributes, ReactNode } from 'react'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` is for panels that sit above the page rather than in it. */
  variant?: 'default' | 'raised'
  /** Drop the padding — for panels whose children own their own edges. */
  flush?: boolean
  children: ReactNode
}

/**
 * The general-purpose surface: 1px hairline, 8px radius, no shadow. The only
 * panel in the system that carries elevation is ResultPanel.
 */
export function Panel({
  variant = 'default',
  flush = false,
  className,
  children,
  ...rest
}: PanelProps) {
  const classes = [
    'sl-panel',
    variant === 'raised' ? 'sl-panel--raised' : '',
    flush ? 'sl-panel--flush' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
