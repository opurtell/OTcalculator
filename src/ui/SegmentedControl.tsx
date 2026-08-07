export interface SegmentedOption<T extends string = string> {
  value: T
  label: string
  /** Second line inside the option — e.g. "my shift" under "Ran on from". */
  note?: string
}

export interface SegmentedControlProps<T extends string = string> {
  /** Visible group label. Required — no unlabelled controls (§8). */
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /**
   * `compact` sizes options to their content rather than filling the row —
   * the treatment for pay steps 1–4.
   */
  size?: 'fill' | 'compact'
  /** Explanatory line beneath, e.g. the 4-hour minimum consequence. */
  hint?: string
}

/**
 * Used for pay step (3–4 options, a single tap each — never a dropdown) and
 * for the continuous/separate choice. That second one is pre-selected by the
 * duration heuristic but is always visibly a choice, never silent (§5.5).
 */
export function SegmentedControl<T extends string = string>({
  label,
  options,
  value,
  onChange,
  size = 'fill',
  hint,
}: SegmentedControlProps<T>) {
  return (
    <div className="sl-field">
      <span className="sl-label">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className={`sl-seg${size === 'compact' ? ' sl-seg--compact' : ''}`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className="sl-seg__option"
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.note ? (
              <span className="sl-seg__option-note">{option.note}</span>
            ) : null}
          </button>
        ))}
      </div>
      {hint ? <p className="sl-hint">{hint}</p> : null}
    </div>
  )
}
