import { EmptyState, ShiftList, ShiftRow, StationLedger } from 'actas-ot-ui'

/** A genuinely mixed fortnight — a pickup and an overrun. */
export const Populated = () => (
  <StationLedger>
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
  </StationLedger>
)

export const Empty = () => (
  <StationLedger>
    <ShiftList title="Overtime shifts">
      <EmptyState
        title="No shifts added yet."
        body="Add one to see what it pays."
      />
    </ShiftList>
  </StationLedger>
)
