import {
  Button,
  Money,
  Panel,
  SegmentedControl,
  SelectField,
  Sheet,
  StationLedger,
  TextField,
} from 'actas-ot-ui'

const noop = () => {}

const CONTINUITY = [
  { value: 'overrun', label: 'Ran on from', note: 'my shift' },
  { value: 'separate', label: 'Separate', note: 'shift' },
]

const DATES = [
  { value: '2026-08-15', label: 'Sat 15 August 2026' },
  { value: '2026-08-19', label: 'Wed 19 August 2026' },
  { value: '2026-08-22', label: 'Sat 22 August 2026' },
]

/** Two fields on one row — start and end read as a pair, not a stack. */
const TimePair = ({ start, end }: { start: string; end: string }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
    <TextField label="Start" value={start} onChange={noop} numeric />
    <TextField label="End" value={end} onChange={noop} numeric />
  </div>
)

/**
 * The live preview of what the shift pays. It sits above the footer so the
 * user sees the shift's value before committing it (§5.5).
 */
const LivePreview = ({
  breakdown,
  amount,
  assumption,
}: {
  breakdown: string
  amount: number
  assumption?: boolean
}) => (
  <Panel
    style={
      assumption
        ? { background: 'var(--amber-wash)', borderColor: 'var(--amber)' }
        : undefined
    }
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
      }}
    >
      <span className="sl-caption">{breakdown}</span>
      <Money value={amount} />
    </div>
  </Panel>
)

/** The canonical composition — a Saturday 10h pickup, all at 2×. */
export const AddOtShift = () => (
  <StationLedger>
    <Sheet
      title="Add OT shift"
      onClose={noop}
      footer={
        <Button variant="primary" block>
          Add shift
        </Button>
      }
    >
      <div className="sl-stack">
        <SelectField label="Date" options={DATES} value="2026-08-15" onChange={noop} />
        <TimePair start="09:00" end="19:00" />
        <SegmentedControl
          label="Was this continuous with your rostered shift?"
          options={CONTINUITY}
          value="separate"
          onChange={noop}
          hint="Separate shifts have a 4-hour minimum payment."
        />
        <LivePreview breakdown="10h · all at 2× (Saturday)" amount={965.51} />
      </div>
    </Sheet>
  </StationLedger>
)

/**
 * Overnight. The end time confirms the day it lands on, and the breakdown
 * says the Sunday rate carried past midnight — the ratchet made visible.
 */
export const Overnight = () => (
  <StationLedger>
    <Sheet
      title="Add OT shift"
      onClose={noop}
      footer={
        <Button variant="primary" block>
          Add shift
        </Button>
      }
    >
      <div className="sl-stack">
        <SelectField label="Date" options={DATES} value="2026-08-22" onChange={noop} />
        <TimePair start="22:00" end="06:00" />
        <p className="sl-hint">Ends next day · Sun 23 Aug</p>
        <SegmentedControl
          label="Was this continuous with your rostered shift?"
          options={CONTINUITY}
          value="separate"
          onChange={noop}
          hint="Separate shifts have a 4-hour minimum payment."
        />
        <LivePreview
          breakdown="8h · all at 2× — Sunday rate carried past midnight"
          amount={772.41}
          assumption
        />
      </div>
    </Sheet>
  </StationLedger>
)

/** Two hours worked, four hours paid — the sheet says why before committing. */
export const MinimumApplied = () => (
  <StationLedger>
    <Sheet
      title="Add OT shift"
      onClose={noop}
      footer={
        <Button variant="primary" block>
          Add shift
        </Button>
      }
    >
      <div className="sl-stack">
        <SelectField label="Date" options={DATES} value="2026-08-19" onChange={noop} />
        <TimePair start="19:00" end="21:00" />
        <SegmentedControl
          label="Was this continuous with your rostered shift?"
          options={CONTINUITY}
          value="separate"
          onChange={noop}
          hint="Separate shifts have a 4-hour minimum payment."
        />
        <LivePreview
          breakdown="2h worked → 4h paid · 4-hour minimum (C9.5)"
          amount={386.2}
          assumption
        />
      </div>
    </Sheet>
  </StationLedger>
)

/** A 3am shift offer is a real use case, so the sheet has to hold up dark. */
export const Dark = () => (
  <StationLedger theme="dark">
    <Sheet
      title="Add OT shift"
      onClose={noop}
      footer={
        <Button variant="primary" block>
          Add shift
        </Button>
      }
    >
      <div className="sl-stack">
        <SelectField label="Date" options={DATES} value="2026-08-15" onChange={noop} />
        <TimePair start="09:00" end="19:00" />
        <SegmentedControl
          label="Was this continuous with your rostered shift?"
          options={CONTINUITY}
          value="separate"
          onChange={noop}
          hint="Separate shifts have a 4-hour minimum payment."
        />
        <LivePreview breakdown="10h · all at 2× (Saturday)" amount={965.51} />
      </div>
    </Sheet>
  </StationLedger>
)
