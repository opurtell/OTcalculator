import { SelectField, StationLedger } from 'actas-ot-ui'

const noop = () => {}

const CLASSIFICATIONS = [
  { value: 'AP1', label: 'AP1 — Ambulance Paramedic' },
  { value: 'AP2', label: 'AP2 — Ambulance Paramedic, additional responsibilities' },
  { value: 'ICP1', label: 'ICP1 — Intensive Care Paramedic' },
  { value: 'ICP2', label: 'ICP2 — Intensive Care Paramedic, additional responsibilities' },
]

const DATES = [
  { value: '2026-08-15', label: 'Sat 15 August 2026' },
  { value: '2026-08-19', label: 'Wed 19 August 2026' },
  { value: '2026-08-22', label: 'Sat 22 August 2026' },
]

/** The classification picker on first run. */
export const Classification = () => (
  <StationLedger>
    <SelectField
      label="Classification"
      options={CLASSIFICATIONS}
      value="AP1"
      onChange={noop}
    />
  </StationLedger>
)

/** The date picker in the add-shift sheet. Native select — the right control. */
export const ShiftDate = () => (
  <StationLedger>
    <SelectField label="Date" options={DATES} value="2026-08-15" onChange={noop} />
  </StationLedger>
)

/** With the hint that explains what the choice drives. */
export const WithHint = () => (
  <StationLedger>
    <SelectField
      label="Classification"
      options={CLASSIFICATIONS}
      value="AP1"
      onChange={noop}
      hint="Sets your base salary. Overtime is calculated on base only."
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <SelectField
      label="Classification"
      options={CLASSIFICATIONS}
      value="AP1"
      onChange={noop}
      hint="Sets your base salary. Overtime is calculated on base only."
    />
  </StationLedger>
)
