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
  onClick?: () => void
}

const KIND_LABEL: Record<ShiftKind, string> = {
  separate: 'Separate shift',
  overrun: 'Shift overrun',
}

/** Tappable to edit. One row per overtime attendance. */
export function ShiftRow({
  date,
  timeRange,
  breakdown,
  kind,
  amount,
  assumption = false,
  onClick,
}: ShiftRowProps) {
  return (
    <button type="button" className="sl-shift" onClick={onClick}>
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
  )
}
