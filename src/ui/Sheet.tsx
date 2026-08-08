import { useEffect, useId, useRef } from 'react'
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
 *
 * It is a non-modal dialog: the page behind stays operable and there is no
 * focus trap, because nothing here is a decision the user must finish. What it
 * does owe them is a way in and a way out without a mouse — focus moves to the
 * sheet when it opens, and `Escape` closes it (§8). Returning focus to
 * whatever opened it is the caller's job; it is the only party that knows.
 */
export function Sheet({ title, onClose, footer, children }: SheetProps) {
  const headingId = useId()
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    sheetRef.current?.focus()
  }, [])

  return (
    <section
      ref={sheetRef}
      className="sl-sheet"
      role="dialog"
      aria-labelledby={headingId}
      // Focusable as a target, never as a tab stop: `Tab` from the sheet
      // should reach the first field, not come back here.
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || onClose === undefined) return
        event.stopPropagation()
        onClose()
      }}
    >
      <header className="sl-sheet__header">
        <h2 className="sl-heading" id={headingId}>
          {title}
        </h2>
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
