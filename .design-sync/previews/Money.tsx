import { Money, StationLedger } from 'actas-ot-ui'

/** The default figure: mono, tabular, two decimals, thousands separator. */
export const Default = () => (
  <StationLedger>
    <Money value={6018.66} />
  </StationLedger>
)

/** Money leaving — PAYG tax. Never used for errors; this app has no alarms. */
export const MoneyOut = () => (
  <StationLedger>
    <Money value={1620.0} tone="out" />
  </StationLedger>
)

/** Reserved for the take-home result, so the colour keeps meaning something. */
export const NetResult = () => (
  <StationLedger>
    <Money value={4398.66} tone="net" />
  </StationLedger>
)

/** The headline figure — what the fortnight's OT actually added. */
export const Display = () => (
  <StationLedger>
    <Money value={698.34} tone="net" size="display" />
  </StationLedger>
)

/** Deduction rows hold positives; the sign is forced so the row reads right. */
export const AlwaysNegative = () => (
  <StationLedger>
    <Money value={611.0} tone="out" sign="always-negative" />
  </StationLedger>
)

/** Secondary figures that shouldn't compete with the result. */
export const Muted = () => (
  <StationLedger>
    <Money value={4908.32} tone="muted" />
  </StationLedger>
)
