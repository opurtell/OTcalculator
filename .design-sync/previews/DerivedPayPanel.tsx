import { DerivedPayPanel, StationLedger } from 'actas-ot-ui'

/** Derived from the classification and step, read-only until challenged. */
export const Derived = () => (
  <StationLedger>
    <DerivedPayPanel
      baseAnnual={95698}
      fortnightly={4908.32}
      ratesEffective="04/12/2025"
    />
  </StationLedger>
)

/** After "Enter your own figures" — both fields carry the ✎ marker. */
export const Overridden = () => (
  <StationLedger>
    <DerivedPayPanel
      baseAnnual={95698}
      fortnightly={4908.32}
      ratesEffective="04/12/2025"
      overridden
      baseAnnualInput="97,250.00"
      fortnightlyInput="4,988.60"
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <DerivedPayPanel
      baseAnnual={95698}
      fortnightly={4908.32}
      ratesEffective="04/12/2025"
    />
  </StationLedger>
)
