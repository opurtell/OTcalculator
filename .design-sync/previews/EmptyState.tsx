import { EmptyState, StationLedger } from 'actas-ot-ui'

/** The fortnight with nothing in it yet. Plain instruction, no illustration. */
export const NoShifts = () => (
  <StationLedger>
    <EmptyState
      title="No overtime shifts yet"
      body="Add a shift to see what it adds to this fortnight's take-home."
    />
  </StationLedger>
)

/** Everything entered has been removed — same treatment, different wording. */
export const AllRemoved = () => (
  <StationLedger>
    <EmptyState
      title="This fortnight is back to ordinary pay"
      body="Your take-home is $3,700.32. Add a shift to compare against overtime."
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <EmptyState
      title="No overtime shifts yet"
      body="Add a shift to see what it adds to this fortnight's take-home."
    />
  </StationLedger>
)
