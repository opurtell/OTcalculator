import { useEffect, useRef, useState } from 'react'

export interface UndoRowProps {
  /** What happened, past tense: "Shift deleted". */
  message: string
  onUndo: () => void
  /** Fired when the window closes without an undo — commit the deletion here. */
  onExpire?: () => void
  /** How long the offer stands. */
  durationMs?: number
}

/**
 * Destructive actions confirm inline (§7): deleting a shift shows this row for
 * about five seconds instead of a confirmation dialog. The user's action
 * happens immediately and is reversible, rather than being interrupted by a
 * modal asking whether they meant it.
 *
 * The countdown bar is the only place in the system with a running animation.
 * It is suppressed under `prefers-reduced-motion`, where the row simply sits
 * for the same duration without the moving bar.
 */
export function UndoRow({
  message,
  onUndo,
  onExpire,
  durationMs = 5000,
}: UndoRowProps) {
  const [expired, setExpired] = useState(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const timer = setTimeout(() => {
      setExpired(true)
      onExpireRef.current?.()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs])

  if (expired) return null

  return (
    <div className="sl-undo" role="status">
      <span className="sl-undo__message">{message}</span>
      <button type="button" className="sl-undo__action" onClick={onUndo}>
        Undo
      </button>
      <span
        className="sl-undo__bar"
        style={{ animationDuration: `${durationMs}ms` }}
        aria-hidden="true"
      />
    </div>
  )
}
