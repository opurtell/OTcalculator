import { Disclosure, FigureTable, StationLedger, Toggle } from 'actas-ot-ui'

const noop = () => {}

/**
 * Collapsed. The summary states what is currently active — never a bare
 * "Advanced", or the user has to open it to find out (§7).
 */
export const Collapsed = () => (
  <StationLedger>
    <Disclosure
      title="Deductions & tax"
      summary="Deductions: $611 + 5% · Study debt on"
    >
      <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
    </Disclosure>
  </StationLedger>
)

/** Opened, showing the settings the summary was describing. */
export const Expanded = () => (
  <StationLedger>
    <Disclosure
      title="Deductions & tax"
      summary="Deductions: $611 + 5% · Study debt on"
      defaultOpen
    >
      <div className="sl-stack">
        <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
        <Toggle
          label="Study or training loan"
          checked
          onChange={noop}
          description="Adds a compulsory repayment to the tax withheld each fortnight."
        />
      </div>
    </Disclosure>
  </StationLedger>
)

/** "How this was worked out" — the working, folded away until asked for. */
export const WithFigureTable = () => (
  <StationLedger>
    <Disclosure title="How this was worked out" defaultOpen>
      <FigureTable
        caption="How deductions reduce the taxed amount"
        rows={[
          { label: 'Gross incl. OT', values: [6018.66] },
          { label: 'Set amount', values: [611.0], tone: 'out', sign: 'always-negative' },
          { label: '5% of gross', values: [300.93], tone: 'out', sign: 'always-negative' },
          { label: 'Taxed on', values: [5106.73], total: true },
        ]}
      />
    </Disclosure>
  </StationLedger>
)

/** No summary needed when the section has no active state to report. */
export const WithoutSummary = () => (
  <StationLedger>
    <Disclosure title="How this was worked out">
      <p className="sl-caption">
        Rates effective 04/12/2025 under the ACTAS Enterprise Agreement 2023–2026.
      </p>
    </Disclosure>
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <Disclosure
      title="Deductions & tax"
      summary="Deductions: $611 + 5% · Study debt on"
      defaultOpen
    >
      <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
    </Disclosure>
  </StationLedger>
)
