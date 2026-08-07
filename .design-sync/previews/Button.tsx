import { Button, StationLedger } from 'actas-ot-ui'

export const Primary = () => (
  <StationLedger>
    <Button variant="primary">Add shift</Button>
  </StationLedger>
)

export const Secondary = () => (
  <StationLedger>
    <Button variant="secondary">Enter my own figures</Button>
  </StationLedger>
)

export const Ghost = () => (
  <StationLedger>
    <Button variant="ghost">Change</Button>
  </StationLedger>
)

/** The standard bottom action on mobile. */
export const FullWidth = () => (
  <StationLedger>
    <Button variant="primary" block>
      + Add OT shift
    </Button>
  </StationLedger>
)

export const Disabled = () => (
  <StationLedger>
    <Button variant="primary" disabled>
      Continue
    </Button>
  </StationLedger>
)
