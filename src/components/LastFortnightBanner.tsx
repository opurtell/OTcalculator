import { breakdownRows, comparisonRows } from '../app/breakdown'
import { formatPayFortnight } from '../app/pay-period'
import type { PayFortnight } from '../app/pay-period'
import type { FortnightResult } from '../engine/fortnight'
import { Button, Disclosure, FigureTable, Money, Panel, formatMoney } from '../ui/index'

export interface LastFortnightBannerProps {
  /** The fortnight this is about — the one that just ended, named by its dates. */
  fortnight: PayFortnight
  /** Recomputed from the shifts and settings that were live at the time. */
  result: FortnightResult
  /** `AP1 Step 2` — the band it was worked out on, which may not be today's. */
  bandSummary: string
  /** The §3.8 fallback captions, as they were for that fortnight's pay date. */
  captions?: string[]
  /** How many shifts were entered. Named, because the list itself has gone. */
  shiftCount: number
  onDismiss: () => void
}

/**
 * The fortnight that just ended, shown once more before it goes.
 *
 * The shifts expire with their pay period (§4.4), which is what keeps last
 * fortnight's pickups out of this fortnight's total. But the user who opens the
 * app on the Thursday did not ask for that: they get an empty list and a base
 * pay figure where a take-home used to be. This is the handover — the same
 * take-home, the same working, plainly labelled as history.
 *
 * Three things keep it from being mistaken for the current fortnight:
 *
 * - **It is a panel, not the result.** No `ResultPanel`, no display-size figure
 *   and no `aria-live` region. The app has exactly one live region and it is the
 *   headline (§8); a second one here would announce a historical figure every
 *   time the current one moved, which is the opposite of helpful.
 * - **It says whose fortnight it is in its first two lines** — the dates and the
 *   pay band — because the band may since have been edited, and a figure worked
 *   out on settings that are no longer on screen has to name them.
 * - **It says how it leaves.** A banner with no account of when it goes reads as
 *   something stuck. It goes on the first shift of the new fortnight, or on a
 *   tap.
 *
 * The details are the ordinary comparison table, which carries the per-shift
 * derivation on its Overtime row — so "never show an unexplained figure" holds
 * for a fortnight that has ended exactly as it does for one still running.
 */
export function LastFortnightBanner({
  fortnight,
  result,
  bandSummary,
  captions = [],
  shiftCount,
  onDismiss,
}: LastFortnightBannerProps) {
  const hasOvertime = result.overtimeGross > 0
  // The same rule the result panel follows: two identical columns are not a
  // comparison. A fortnight is only carried when it had shifts in it, so this
  // is the case where every shift was priced at nothing.
  const comparison = hasOvertime ? comparisonRows(result) : null

  return (
    <Panel className="sl-carryover">
      <div className="sl-stack">
        <div>
          <h2 className="sl-heading">Last pay fortnight</h2>
          <p className="sl-caption">
            {formatPayFortnight(fortnight)} · {bandSummary} ·{' '}
            {shiftCount === 1 ? '1 shift' : `${shiftCount} shifts`}
          </p>
        </div>

        <p className="sl-summary__figure">
          <Money value={result.netTotal} tone="net" />
          <span className="sl-summary__unit">take-home</span>
        </p>

        {hasOvertime ? (
          <p className="sl-caption">
            Your overtime added {formatMoney(result.otNetTotal)} of that, from{' '}
            {formatMoney(result.otEarnedTotal)} before tax.
          </p>
        ) : null}

        <Disclosure title="What made up that fortnight">
          <div className="sl-stack">
            <FigureTable
              caption={`Your fortnight ${formatPayFortnight(fortnight)}`}
              columns={comparison?.columns}
              rows={comparison?.rows ?? breakdownRows(result)}
            />
            {captions.map((caption) => (
              <p className="sl-caption" key={caption}>
                {caption}
              </p>
            ))}
          </div>
        </Disclosure>

        <div className="sl-carryover__footer">
          {/* Only what the banner alone can say. That the shifts were cleared,
              and on which day, is the shift list's line — saying it twice on one
              screen makes the second one read as a different event. */}
          <p className="sl-caption">
            This goes when you add a shift for the new fortnight.
          </p>
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Panel>
  )
}
