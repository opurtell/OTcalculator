import { Money, Panel, ShiftRow, StationLedger } from 'actas-ot-ui'

/** The general-purpose surface: 1px hairline, 8px radius, no shadow. */
export const Default = () => (
  <StationLedger>
    <Panel>
      <p className="sl-label">Taxed on</p>
      <Money value={5106.73} size="display" />
      <p className="sl-caption">
        Gross including overtime, less salary packaging.
      </p>
    </Panel>
  </StationLedger>
)

/**
 * For panels that sit above the page rather than in it. Shown dark on purpose:
 * `--surface` and `--surface-raised` are both #ffffff in light mode, so the
 * variant is a deliberate no-op there and only separates in dark. Default is
 * on top, raised below.
 */
export const Raised = () => (
  <StationLedger theme="dark">
    <div className="sl-stack">
      <Panel>
        <p className="sl-label">In the page</p>
        <Money value={6018.66} />
        <p className="sl-caption">Default surface.</p>
      </Panel>
      <Panel variant="raised">
        <p className="sl-label">Above the page</p>
        <Money value={6018.66} />
        <p className="sl-caption">Raised surface — one step lighter.</p>
      </Panel>
    </div>
  </StationLedger>
)

/** Flush drops the padding so children own their own edges — the shift list. */
export const FlushWithRows = () => (
  <StationLedger>
    <Panel flush>
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
    </Panel>
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <Panel>
      <p className="sl-label">Taxed on</p>
      <Money value={5106.73} size="display" />
      <p className="sl-caption">
        Gross including overtime, less salary packaging.
      </p>
    </Panel>
  </StationLedger>
)
