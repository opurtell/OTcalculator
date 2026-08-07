import { Money } from './Money'
import { TextField } from './TextField'

export interface DerivedPayPanelProps {
  /** Derived from the pay tables, e.g. 95698. */
  baseAnnual: number
  /** Derived fortnightly figure, e.g. 4908.32. */
  fortnightly: number
  /** Rate currency, e.g. "04/12/2025". Never omitted — see the copy deck. */
  ratesEffective: string
  /** Switches both figures from derived to hand-entered. */
  overridden?: boolean
  /** Called when the user taps "Enter your own figures". */
  onOverride?: () => void
  /** Raw input strings, used only while `overridden`. */
  baseAnnualInput?: string
  fortnightlyInput?: string
  onBaseAnnualChange?: (value: string) => void
  onFortnightlyChange?: (value: string) => void
}

/**
 * The figures derived from the classification and step (§5.1).
 *
 * Read-only until the user says otherwise, at which point both become inputs
 * carrying the ✎ marker so it is obvious the app is no longer deriving them.
 * The escape hatch is offered in plain language — "Doesn't match your
 * payslip?" — because a paramedic holding a payslip that disagrees with the
 * app should not have to hunt for the override.
 */
export function DerivedPayPanel({
  baseAnnual,
  fortnightly,
  ratesEffective,
  overridden = false,
  onOverride,
  baseAnnualInput = '',
  fortnightlyInput = '',
  onBaseAnnualChange,
  onFortnightlyChange,
}: DerivedPayPanelProps) {
  if (overridden) {
    return (
      <div className="sl-derived sl-derived--editing">
        <TextField
          label="Base annual"
          value={baseAnnualInput}
          onChange={(value) => onBaseAnnualChange?.(value)}
          prefix="$"
          numeric
          overridden
        />
        <TextField
          label="Fortnightly"
          value={fortnightlyInput}
          onChange={(value) => onFortnightlyChange?.(value)}
          prefix="$"
          numeric
          overridden
        />
        <p className="sl-derived__note">
          Your figures, not ours. Overtime is still worked out on the base
          salary only.
        </p>
      </div>
    )
  }

  return (
    <div className="sl-derived">
      <div className="sl-derived__row">
        <span>Base annual</span>
        <Money value={baseAnnual} />
      </div>
      <div className="sl-derived__row">
        <span>Fortnightly</span>
        <Money value={fortnightly} />
      </div>
      <p className="sl-derived__note">Rates effective {ratesEffective}</p>
      <button type="button" className="sl-derived__override" onClick={onOverride}>
        Doesn't match your payslip? Enter your own figures →
      </button>
    </div>
  )
}
