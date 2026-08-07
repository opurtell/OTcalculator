import { StationLedger, TextField } from 'actas-ot-ui'

const noop = () => {}

/** Hours worked — numeric switches to the tabular mono face and the number pad. */
export const Hours = () => (
  <StationLedger>
    <TextField label="Hours worked" value="10" onChange={noop} suffix="h" numeric />
  </StationLedger>
)

/** A set pre-tax deduction per fortnight. */
export const Money = () => (
  <StationLedger>
    <TextField
      label="Set amount per fortnight"
      value="611.00"
      onChange={noop}
      prefix="$"
      numeric
    />
  </StationLedger>
)

/** Percentage packaging, with the hint that says what it is calculated on. */
export const Percent = () => (
  <StationLedger>
    <TextField
      label="Percentage of gross"
      value="5"
      onChange={noop}
      suffix="%"
      numeric
      hint="Calculated on your full fortnight gross including overtime."
    />
  </StationLedger>
)

/** The hint carries the "what does this feed" explanation. */
export const WithHint = () => (
  <StationLedger>
    <TextField
      label="Base annual salary"
      value="95,698.00"
      onChange={noop}
      prefix="$"
      numeric
      hint="Overtime is calculated on base salary only, not the Annex A total."
    />
  </StationLedger>
)

/** A derived figure the user has replaced — the marker is drawn, never typed. */
export const Overridden = () => (
  <StationLedger>
    <TextField
      label="Fortnightly gross"
      value="4,988.60"
      onChange={noop}
      prefix="$"
      numeric
      overridden
      hint="You entered this. Clear it to go back to the EBA figure."
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <TextField
      label="Percentage of gross"
      value="5"
      onChange={noop}
      suffix="%"
      numeric
      hint="Calculated on your full fortnight gross including overtime."
    />
  </StationLedger>
)
