import { StationLedger, Tabs } from 'actas-ot-ui'

const noop = () => {}

const MODES = [
  { value: 'quick', label: 'Quick' },
  { value: 'fortnight', label: 'Fortnight' },
]

/** Quick answers one question: what is this one shift worth? */
export const QuickSelected = () => (
  <StationLedger>
    <Tabs label="Calculation mode" items={MODES} value="quick" onChange={noop} />
  </StationLedger>
)

/** Fortnight is the full picture — every OT shift in the pay period. */
export const FortnightSelected = () => (
  <StationLedger>
    <Tabs label="Calculation mode" items={MODES} value="fortnight" onChange={noop} />
  </StationLedger>
)

/** The app's own strip: the pay fortnight rides beside the tabs. */
export const WithPayFortnight = () => (
  <StationLedger>
    <Tabs
      label="Calculation mode"
      items={MODES}
      value="fortnight"
      onChange={noop}
      trailing="Pay fortnight Thu 3 Sep – Wed 16 Sep"
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <Tabs label="Calculation mode" items={MODES} value="fortnight" onChange={noop} />
  </StationLedger>
)
