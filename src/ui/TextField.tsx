import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'prefix'
>

export interface TextFieldProps extends NativeProps {
  /** Persistent and visible. Placeholder-only fields are not allowed (§8). */
  label: string
  value: string
  onChange: (value: string) => void
  /** Leading affix, e.g. `$`. */
  prefix?: string
  /** Trailing affix, e.g. `h` or `%`. */
  suffix?: string
  /** Caption beneath the field explaining what the figure feeds. */
  hint?: string
  /**
   * Numeric entry: sets `inputmode="decimal"` so phones show the number pad,
   * and switches the field to the tabular mono face.
   */
  numeric?: boolean
  /** Shows the ✎ marker used when a derived figure has been overridden. */
  overridden?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  numeric = false,
  overridden = false,
  id,
  ...rest
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = hint ? `${fieldId}-hint` : undefined

  return (
    <div className="sl-field">
      <label className="sl-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="sl-field__shell">
        {prefix ? <span className="sl-field__affix">{prefix}</span> : null}
        <input
          id={fieldId}
          className={`sl-field__input${numeric ? ' sl-field__input--figure' : ''}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={numeric ? 'decimal' : undefined}
          aria-describedby={hintId}
          {...rest}
        />
        {overridden ? (
          /* Drawn, not typed — a literal ✎ renders as colour emoji on most
             platforms, which the brief bans in the interface. */
          <svg
            className="sl-field__overridden"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            role="img"
            aria-label="Overridden"
          >
            <title>Overridden</title>
            <path
              d="M11.2 2.4 13.6 4.8 5.6 12.8 2.4 13.6 3.2 10.4 11.2 2.4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        {suffix ? <span className="sl-field__affix">{suffix}</span> : null}
      </div>
      {hint ? (
        <p className="sl-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
