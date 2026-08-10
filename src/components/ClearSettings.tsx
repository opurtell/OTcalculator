import { useState } from 'react'
import { Button } from '../ui/index'

export interface ClearSettingsProps {
  onClear: () => void
}

/**
 * The §4.4 "Clear saved settings" control.
 *
 * Destructive actions confirm inline (§7) — no dialog. The difference from a
 * deleted shift is that this one cannot be undone afterwards: the record is
 * gone from `localStorage` and there is nothing left to restore. So it asks
 * first, in place, and the question names what is actually lost rather than
 * asking whether the user is sure.
 *
 * The shifts go with it. This is the control for "forget me on this device",
 * and leaving a fortnight of entered shifts behind would make that a lie — so
 * the question names them, which is also the difference from "Clear shifts",
 * which takes one tap because the undo row can put the list back.
 */
export function ClearSettings({ onClear }: ClearSettingsProps) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <Button variant="ghost" onClick={() => setAsking(true)}>
        Clear saved settings
      </Button>
    )
  }

  return (
    <div className="sl-clear" role="group" aria-label="Clear saved settings">
      <p className="sl-clear__question">
        Forget your pay band, deductions, tax settings and this fortnight's
        shifts on this device?
      </p>
      <div className="sl-clear__actions">
        <Button variant="secondary" onClick={onClear}>
          Clear
        </Button>
        <Button variant="ghost" onClick={() => setAsking(false)}>
          Keep
        </Button>
      </div>
    </div>
  )
}
