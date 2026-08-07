export interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Consequence of the setting, not a restatement of the label. */
  description?: string
}

/** Tax-free threshold, study or training loan. */
export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="sl-toggle"
      onClick={() => onChange(!checked)}
    >
      <span>
        {label}
        {description ? (
          <span className="sl-toggle__description">{description}</span>
        ) : null}
      </span>
      <span className="sl-toggle__track" aria-hidden="true">
        <span className="sl-toggle__thumb" />
      </span>
    </button>
  )
}
