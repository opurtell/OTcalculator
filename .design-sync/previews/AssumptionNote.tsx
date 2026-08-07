import { AssumptionNote, StationLedger } from 'actas-ot-ui'

/** The quick-calculation caveat — always expanded, never dismissible. */
export const QuickEstimateCaveat = () => (
  <StationLedger>
    <AssumptionNote>
      <p>
        Rough estimate. Assumes one Mon–Sat shift: 2h at time and a half, then
        double time. No Sunday, public holiday or 4-hour minimum applied.
      </p>
    </AssumptionNote>
  </StationLedger>
)

/** Pays more than the hours worked, so it says why on the same line. */
export const MinimumApplied = () => (
  <StationLedger>
    <AssumptionNote>
      2h worked → 4h paid · 4-hour minimum (C9.5)
    </AssumptionNote>
  </StationLedger>
)

/** Shown only when packaging and a study loan are both active. */
export const PackagingWarning = () => (
  <StationLedger>
    <AssumptionNote>
      Packaging lowers the study loan repayment withheld each pay, but not what
      you owe at tax time.
    </AssumptionNote>
  </StationLedger>
)

/** Amber marks an assumption worth confirming — never a problem. */
export const RateCarriedPastMidnight = () => (
  <StationLedger>
    <AssumptionNote>
      Sunday rate carried past midnight — this shift started Saturday night.
    </AssumptionNote>
  </StationLedger>
)
