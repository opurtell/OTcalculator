import { InspectableFigure, Panel, StationLedger } from 'actas-ot-ui'

/** The dotted underline is the affordance — every money figure carries it. */
export const Collapsed = () => (
  <StationLedger>
    <Panel>
      <InspectableFigure
        value={1620.0}
        label="PAYG tax"
        tone="out"
        sign="always-negative"
        derivation={[
          { label: 'Taxed on', values: [6018.66] },
          { label: 'Scale 2, fortnightly', values: ['NAT 1004'] },
          { label: 'Withheld', values: [1620.0], total: true },
        ]}
      />
    </Panel>
  </StationLedger>
)

/** The overtime rate, worked out on base salary only. */
export const OvertimeRate = () => (
  <StationLedger>
    <Panel>
      <InspectableFigure
        value={965.51}
        label="Saturday pickup"
        derivation={[
          { label: 'Base hourly', note: 'base only (EBA N34.1)', values: ['$48.28'] },
          { label: 'at 2×', values: ['$96.55'] },
          { label: '10h', values: [965.51], total: true },
        ]}
      />
    </Panel>
  </StationLedger>
)
