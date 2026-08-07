import { ShiftRow, StationLedger, Panel } from 'actas-ot-ui'

/** A Saturday pickup — all at 2×, with the 4-hour minimum available. */
export const SeparateShift = () => (
  <StationLedger>
    <Panel flush>
      <ShiftRow
        date="Sat 15 Aug"
        timeRange="09:00–19:00"
        breakdown="10h · all at 2×"
        kind="separate"
        amount={965.51}
      />
    </Panel>
  </StationLedger>
)

/** Ran on from a rostered shift — no minimum, first 2h at 1.5×. */
export const ShiftOverrun = () => (
  <StationLedger>
    <Panel flush>
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

/** Pays 4h for 2h worked, so the row says why on the same line. */
export const MinimumApplied = () => (
  <StationLedger>
    <Panel flush>
      <ShiftRow
        date="Tue 18 Aug"
        timeRange="19:00–21:00"
        breakdown="2h worked → 4h paid · 4-hour minimum (C9.5)"
        kind="separate"
        amount={386.2}
        assumption
      />
    </Panel>
  </StationLedger>
)

/** The midnight ratchet made visible — the rate only ever goes up. */
export const AcrossMidnight = () => (
  <StationLedger>
    <Panel flush>
      <ShiftRow
        date="Sat 22 Aug"
        timeRange="22:00–06:00"
        breakdown="8h · all at 2× — Sunday rate carried past midnight"
        kind="separate"
        amount={772.41}
        assumption
      />
    </Panel>
  </StationLedger>
)
