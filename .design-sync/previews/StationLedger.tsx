import {
  Disclaimer,
  FigureTable,
  ResultPanel,
  ShiftList,
  ShiftRow,
  StationLedger,
} from 'actas-ot-ui'

const Fortnight = () => (
  <>
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
    <div style={{ height: 24 }} />
    <ShiftList title="Overtime shifts" count={2}>
      <ShiftRow
        date="Sat 15 Aug"
        timeRange="09:00–19:00"
        breakdown="10h · all at 2×"
        kind="separate"
        amount={965.51}
      />
      <ShiftRow
        date="Wed 19 Aug"
        timeRange="18:00–20:00"
        breakdown="2h · 2h at 1.5×"
        kind="overrun"
        amount={144.83}
      />
    </ShiftList>
    <div style={{ height: 24 }} />
    <Disclaimer />
  </>
)

/**
 * Every screen sits inside this wrapper. Without it components inherit the
 * host page's styles and render unstyled.
 */
export const LightTheme = () => (
  <StationLedger theme="light" measure>
    <Fortnight />
  </StationLedger>
)

/** Required, not a stretch goal — a 3am shift offer is a real use case. */
export const DarkTheme = () => (
  <StationLedger theme="dark" measure>
    <Fortnight />
  </StationLedger>
)
