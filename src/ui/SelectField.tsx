import { useId } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  label: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  hint?: string
}

/** Classification and date pickers. Native select — it is the right control. */
export function SelectField({
  label,
  options,
  value,
  onChange,
  hint,
}: SelectFieldProps) {
  const fieldId = useId()
  const hintId = hint ? `${fieldId}-hint` : undefined

  return (
    <div className="sl-field">
      <label className="sl-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="sl-field__shell">
        <select
          id={fieldId}
          className="sl-field__select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hintId}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="sl-field__chevron" aria-hidden="true">
          ▾
        </span>
      </div>
      {hint ? (
        <p className="sl-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
