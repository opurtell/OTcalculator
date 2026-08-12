import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import type { AdvancedDeductions } from '../engine/packaging'
import { FigureTable, Money, Panel, ResultPanel } from '../ui/index'
import { breakdownRows, comparisonRows } from '../app/breakdown'
import { HowItWasWorkedOut } from './HowItWasWorkedOut'
import { ShareSummary } from './ShareSummary'
import { WhereYourMoneyGoes } from './WhereYourMoneyGoes'

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
  /**
   * The advanced deduction split, when the user has switched it on. `null` or
   * absent leaves the "Where your money goes" disclosure out entirely — in
   * simple mode the app cannot tell packaged living expenses from sacrificed
   * super, so it has nothing honest to say about what is spendable.
   */
  advancedDeductions?: AdvancedDeductions | null
  /** `5% of pay before tax`, when that is how the super figure was entered. */
  superNote?: string
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
  advancedDeductions = null,
  superNote,
}: FortnightResultPanelProps) {
  const hasOvertime = result.overtimeGross > 0
  const workings =
    settings === undefined ? null : (
      <HowItWasWorkedOut settings={settings} result={result} />
    )
  // Above the §5.7 derivation: this answers "what have I got", which is the
  // question that brought the user here, where that one answers "how do you
  // know". Both are collapsed, so the order is what decides which is found.
  const spendable =
    advancedDeductions === null ? null : (
      <WhereYourMoneyGoes
        result={result}
        advanced={advancedDeductions}
        superNote={superNote}
      />
    )
  const share = (
    <ShareSummary
      result={result}
      bandSummary={bandSummary}
      captions={captions}
      advancedDeductions={advancedDeductions}
    />
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
            <Money value={result.netTotal} tone="net" />
            <span className="sl-summary__unit">take-home</span>
          </p>
          <FigureTable
            caption="Your fortnight before overtime"
            rows={breakdownRows(result)}
          />
          <Captions lines={captions} />
          {spendable}
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
      // The totals, so the tax-free N36 allowance is in the headline rather
      // than only in the table. It is money the overtime added, and the app's
      // one loud figure is "what did that shift add to my take-home".
      //
      // The allowance is in `beforeTax` as well, and that is arithmetic rather
      // than sloppiness: an untaxed dollar is the same dollar on both sides, so
      // leaving it out of the support line would make "63% kept" a percentage
      // of the wrong number. The comparison table below is where the split
      // between taxed pay and untaxed allowance is shown.
      amount={result.otNetTotal}
      beforeTax={result.otEarnedTotal}
    >
      <FigureTable
        caption="Your fortnight with and without overtime"
        columns={comparison.columns}
        rows={comparison.rows}
      />
      <Captions lines={captions} />
      {spendable}
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
