import { FigureTable, ResultPanel, StationLedger } from 'actas-ot-ui'

/** The most important frame in the app (§5.4). The number is the interface. */
export const FortnightResult = () => (
  <StationLedger>
    <ResultPanel label="Your OT adds" amount={698.34} beforeTax={1110.34}>
      <FigureTable
        caption="Fortnight with and without overtime"
        columns={['no OT', 'with']}
        rows={[
          { label: 'Pre-tax', values: [4908.32, 6018.66] },
          {
            label: 'PAYG tax',
            values: [1208.0, 1620.0],
            tone: 'out',
            sign: 'always-negative',
          },
          { label: 'Net', values: [3700.32, 4398.66], total: true },
        ]}
      />
    </ResultPanel>
  </StationLedger>
)

/** The quick-calculation variant. "about" is doing real work — keep it. */
export const QuickEstimate = () => (
  <StationLedger>
    <ResultPanel label="Adds about" amount={612.4} beforeTax={965.51} />
  </StationLedger>
)

/** Before any shift is added, the delta is honestly zero. */
export const NoOvertimeYet = () => (
  <StationLedger>
    <ResultPanel label="Your OT adds" amount={0} beforeTax={0} />
  </StationLedger>
)

/** Dark is a first-class state: a 3am shift offer is a real use case. */
export const Dark = () => (
  <StationLedger theme="dark">
    <ResultPanel label="Your OT adds" amount={698.34} beforeTax={1110.34} />
  </StationLedger>
)
