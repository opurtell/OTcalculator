import type { ReactNode } from 'react'

export interface SheetProps {
  title: string
  onClose?: () => void
  /** The committing action, e.g. the "Add shift" button. */
  footer?: ReactNode
  children: ReactNode
}

/**
 * Add / edit shift. A bottom sheet on mobile, an inline panel above 900px —
 * same component, the radius and placement change by breakpoint.
 *
 * The live preview of what the shift pays belongs in `children`, above the
 * footer: the user sees the shift's value before committing it.
 */
export function Sheet({ title, onClose, footer, children }: SheetProps) {
  return (
    <section className="sl-sheet" role="dialog" aria-label={title}>
      <header className="sl-sheet__header">
        <h2 className="sl-heading">{title}</h2>
        {onClose ? (
          <button
            type="button"
            className="sl-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        ) : null}
      </header>
      {children}
      {footer ? <div className="sl-sheet__footer">{footer}</div> : null}
    </section>
  )
}
