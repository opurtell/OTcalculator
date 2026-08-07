import { SegmentedControl, StationLedger } from 'actas-ot-ui'

const noop = () => {}

const STEPS = [
  { value: '1', label: 'Step 1' },
  { value: '2', label: 'Step 2' },
  { value: '3', label: 'Step 3' },
  { value: '4', label: 'Step 4' },
]

const CONTINUITY = [
  { value: 'overrun', label: 'Ran on from', note: 'my shift' },
  { value: 'separate', label: 'Separate', note: 'shift' },
]

/** Pay step — four options, a single tap each. Never a dropdown. */
export const PayStep = () => (
  <StationLedger>
    <SegmentedControl
      label="Pay step"
      options={STEPS}
      value="2"
      onChange={noop}
      size="compact"
    />
  </StationLedger>
)

/**
 * The continuous/separate choice. Pre-selected by the duration heuristic but
 * always visibly a choice, and the hint states the consequence.
 */
export const Continuity = () => (
  <StationLedger>
    <SegmentedControl
      label="Was this continuous with your rostered shift?"
      options={CONTINUITY}
      value="separate"
      onChange={noop}
      hint="Separate shifts have a 4-hour minimum payment."
    />
  </StationLedger>
)

/** The other selection — running on from a rostered shift pays no minimum. */
export const RanOnFromShift = () => (
  <StationLedger>
    <SegmentedControl
      label="Was this continuous with your rostered shift?"
      options={CONTINUITY}
      value="overrun"
      onChange={noop}
      hint="No minimum applies — you are paid for the hours you actually worked."
    />
  </StationLedger>
)

/** Fill sizing stretches options across the row; compact sizes to content. */
export const FillSizing = () => (
  <StationLedger>
    <SegmentedControl label="Pay step" options={STEPS} value="2" onChange={noop} />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <SegmentedControl
      label="Was this continuous with your rostered shift?"
      options={CONTINUITY}
      value="separate"
      onChange={noop}
      hint="Separate shifts have a 4-hour minimum payment."
    />
  </StationLedger>
)
