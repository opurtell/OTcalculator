import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import { FigureTable, Money, Panel, ResultPanel } from '../ui/index'
import { breakdownRows, comparisonRows } from '../app/breakdown'
import { HowItWasWorkedOut } from './HowItWasWorkedOut'
import { ShareSummary } from './ShareSummary'

export interface FortnightResultPanelProps {
  result: FortnightResult
  /** How the pay band reads — `AP1 Step 2`. Shown beside the base pay figure. */
  bandSummary: string
  /**
   * The §3.8 fallback captions. Rendered quietly beneath the figures, because
   * a stale tax schedule changes the number and the user is entitled to know
   * which year's rates produced it.
   */
  captions?: string[]
  /**
   * The resolved settings. When present the "How this was worked out" (§5.7)
   * derivation is offered beneath the figures. Optional so a caller with only a
   * result can still render the headline and breakdown — the comparison and the
   * per-shift derivation do not need it, only the rate-and-clause working does.
   */
  settings?: FortnightSettings
}

/**
 * The figure the app exists to show, and the working behind it (§5.4).
 *
 * Two shapes, chosen by whether there is any overtime yet:
 *
 * - **No overtime.** A quiet panel — this is the §5.3 empty state, where the
 *   loud treatment would be shouting a figure the user already knows.
 * - **With overtime.** The headline: what the overtime added to take-home, what
 *   it was before tax, and how much of it was kept — above a two-column
 *   with/without comparison so every line's movement is visible.
 *
 * Both shapes carry the full breakdown, and both offer the §5.7 derivation when
 * settings are supplied. Never show an unexplained figure: if the app says
 * $698.33, the PAYG line that produced it is on screen, the shifts behind the
 * overtime are one tap away, and the clause that sets the rate is one more.
 */
export function FortnightResultPanel({
  result,
  bandSummary,
  captions = [],
  settings,
}: FortnightResultPanelProps) {
  const hasOvertime = result.overtimeGross > 0
  const workings =
    settings === undefined ? null : (
      <HowItWasWorkedOut settings={settings} result={result} />
    )
  const share = (
    <ShareSummary result={result} bandSummary={bandSummary} captions={captions} />
  )

  if (!hasOvertime) {
    return (
      <Panel>
        <div className="sl-stack">
          <div>
            <h2 className="sl-heading">Your fortnight</h2>
            <p className="sl-caption">{bandSummary} · before any overtime</p>
          </div>
          {/* The one figure here that carries a `$`. Inside the table below,
              and everywhere else in the app, a column of figures is bare —
              the label says what they are and the decimals line up.

              Live for the same reason the headline is: it moves as deductions
              and the pay band are edited, and the whole point of having no
              Calculate button is that the figure is always the current one. */}
          <p className="sl-summary__figure" aria-live="polite">
            <Money value={result.withOt.net} tone="net" />
            <span className="sl-summary__unit">take-home</span>
          </p>
          <FigureTable
            caption="Your fortnight before overtime"
            rows={breakdownRows(result)}
          />
          <Captions lines={captions} />
          {workings}
          {share}
        </div>
      </Panel>
    )
  }

  // A two-column comparison is the whole point once there is overtime: the same
  // fortnight run with and without it, so the overtime's effect on gross, tax
  // and take-home is read across each row rather than inferred. The Overtime
  // row carries the per-shift derivation (`comparisonRows`).
  const comparison = comparisonRows(result)

  return (
    <ResultPanel
      label="Your OT adds"
      amount={result.otNetDelta}
      beforeTax={result.otGrossDelta}
      sticky
    >
      <FigureTable
        caption="Your fortnight with and without overtime"
        columns={comparison.columns}
        rows={comparison.rows}
      />
      <Captions lines={captions} />
      {workings}
      {share}
    </ResultPanel>
  )
}

function Captions({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <>
      {lines.map((line) => (
        <p className="sl-caption" key={line}>
          {line}
        </p>
      ))}
    </>
  )
}
