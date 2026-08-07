import { FigureTable, StationLedger, Panel } from 'actas-ot-ui'

/** The comparison that answers "what did the overtime actually do?" */
export const FortnightComparison = () => (
  <StationLedger>
    <Panel>
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
    </Panel>
  </StationLedger>
)

/** The two deduction boxes interacting — the part people get wrong. */
export const DeductionsArithmetic = () => (
  <StationLedger>
    <Panel>
      <FigureTable
        caption="How deductions reduce the taxed amount"
        rows={[
          { label: 'Gross incl. OT', values: [6018.66] },
          { label: 'Set amount', values: [611.0], tone: 'out', sign: 'always-negative' },
          { label: '5% of gross', values: [300.93], tone: 'out', sign: 'always-negative' },
          { label: 'Taxed on', values: [5106.73], total: true },
        ]}
      />
    </Panel>
  </StationLedger>
)

/** Concept first, clause reference second — never a bare clause number. */
export const Derivation = () => (
  <StationLedger>
    <Panel>
      <FigureTable
        caption="How the overtime rate was derived"
        rows={[
          { label: 'AP1 Step 2 base', note: 'per year', values: ['$95,698'] },
          {
            label: 'Hourly, base only',
            note: 'the composite is not included in overtime (EBA N34.1)',
            values: ['$48.28 /h'],
          },
          { label: 'at 1.5×', values: ['$72.41 /h'] },
          { label: 'at 2×', values: ['$96.55 /h'] },
        ]}
      />
    </Panel>
  </StationLedger>
)
