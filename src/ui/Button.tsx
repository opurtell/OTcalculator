import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` is the one committing action on a screen — Continue, Add shift.
   * `secondary` is an equal-weight alternative; `ghost` is for inline links
   * like "Enter your own figures".
   */
  variant?: 'primary' | 'secondary' | 'ghost'
  /** Full-width. The standard treatment for the bottom action on mobile. */
  block?: boolean
  children: ReactNode
}

/**
 * Quiet chrome, loud result: buttons never compete with the figure they
 * produce. There is deliberately no "Calculate" button anywhere in this app —
 * every input recalculates live (§7).
 */
export function Button({
  variant = 'primary',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'sl-btn',
    `sl-btn--${variant}`,
    block ? 'sl-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
