import { StationLedger, UndoRow } from 'actas-ot-ui'

/*
 * durationMs is deliberately huge in these previews. At the real 5000ms the
 * row removes itself before the screenshot is taken and the card captures
 * blank. Production callers should leave the default.
 */
const HELD_OPEN = 10 * 60 * 1000

/** Replaces the confirmation dialog: the delete already happened, reversibly. */
export const ShiftDeleted = () => (
  <StationLedger>
    <UndoRow
      message="Shift deleted"
      durationMs={HELD_OPEN}
      onUndo={() => {}}
    />
  </StationLedger>
)

export const FortnightCleared = () => (
  <StationLedger>
    <UndoRow
      message="All shifts cleared"
      durationMs={HELD_OPEN}
      onUndo={() => {}}
    />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <UndoRow
      message="Shift deleted"
      durationMs={HELD_OPEN}
      onUndo={() => {}}
    />
  </StationLedger>
)
