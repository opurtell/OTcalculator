import { useRef, useState } from 'react'
import { Money } from './Money'

/**
 * The C9.5 toggle rendered as a status. It must stay visible in the collapsed
 * row because it changes the money — a separate shift carries the 4-hour
 * minimum, a shift overrun does not.
 */
export type ShiftKind = 'separate' | 'overrun'

export interface ShiftRowProps {
  /** Already formatted for display, e.g. "Sat 15 Aug". */
  date: string
  /** e.g. "09:00–19:00". */
  timeRange: string
  /**
   * The rate breakdown — "10h · all at 2×", "2h worked → 4h paid · 4-hour
   * minimum (C9.5)". This line is where the app teaches the EBA rules without
   * a tutorial, so it is required, not optional.
   */
  breakdown: string
  kind: ShiftKind
  amount: number
  /**
   * Set when the row's pay reflects a rule the hours alone don't explain — the
   * 4-hour minimum, or a rate carried past midnight. Tints the status amber.
   */
  assumption?: boolean
  /** Opens the shift for editing. */
  onClick?: () => void
  /** Enables the row menu and swipe-to-delete. */
  onDelete?: () => void
  /** Enables Duplicate in the row menu. */
  onDuplicate?: () => void
}

const KIND_LABEL: Record<ShiftKind, string> = {
  separate: 'Separate shift',
  overrun: 'Shift overrun',
}

/** Past this many pixels of leftward drag, the delete action stays open. */
const SWIPE_THRESHOLD = 64

/**
 * One row per overtime attendance. Tap to edit.
 *
 * Swipe-to-delete is a touch affordance layered on top, never the only route:
 * the same Delete and Duplicate live in the row menu, which is reachable by
 * keyboard. A gesture nobody can discover — or tab to — cannot be the sole way
 * to remove a shift.
 */
export function ShiftRow({
  date,
  timeRange,
  breakdown,
  kind,
  amount,
  assumption = false,
  onClick,
  onDelete,
  onDuplicate,
}: ShiftRowProps) {
  const [offset, setOffset] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const dragStart = useRef<number | null>(null)
  const hasActions = Boolean(onDelete || onDuplicate)

  const endDrag = () => {
    if (dragStart.current === null) return
    dragStart.current = null
    setOffset((current) => (current <= -SWIPE_THRESHOLD ? -SWIPE_THRESHOLD : 0))
  }

  return (
    <div className="sl-shift-wrap">
      {onDelete ? (
        <button
          type="button"
          className="sl-shift-wrap__delete"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => {
            setOffset(0)
            onDelete()
          }}
        >
          Delete
        </button>
      ) : null}

      <div
        className="sl-shift"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if (!onDelete || event.pointerType === 'mouse') return
          dragStart.current = event.clientX + offset
        }}
        onPointerMove={(event) => {
          if (dragStart.current === null) return
          const next = event.clientX - dragStart.current
          setOffset(Math.min(0, Math.max(-SWIPE_THRESHOLD, next)))
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button type="button" className="sl-shift__main" onClick={onClick}>
          <span className="sl-shift__when">
            <span>{date}</span>
            <span className="sl-shift__time">{timeRange}</span>
          </span>
          <span className="sl-shift__amount">
            <Money value={amount} />
          </span>
          <span className="sl-shift__breakdown">{breakdown}</span>
          <span
            className={`sl-shift__status${assumption ? ' sl-shift__status--minimum' : ''}`}
          >
            {KIND_LABEL[kind]}
          </span>
        </button>

        {hasActions ? (
          <div className="sl-shift__menu">
            <button
              type="button"
              className="sl-shift__menu-trigger"
              aria-expanded={menuOpen}
              aria-label={`Actions for ${date} ${timeRange}`}
              onClick={() => setMenuOpen((current) => !current)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="sl-shift__menu-list" role="menu">
                {onDuplicate ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onDuplicate()
                    }}
                  >
                    Duplicate
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete()
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
