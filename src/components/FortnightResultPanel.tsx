import type { FortnightResult } from '../engine/fortnight'
import { FigureTable, Money, Panel, ResultPanel } from '../ui/index'
import type { FigureRow } from '../ui/index'

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
}

/**
 * The figure the app exists to show, and the working behind it.
 *
 * Two shapes, chosen by whether there is any overtime yet:
 *
 * - **No overtime.** A quiet panel — this is the §5.3 empty state, where the
 *   loud treatment would be shouting a figure the user already knows.
 * - **With overtime.** The headline: what the overtime added to take-home,
 *   what it was before tax, and how much of it was kept.
 *
 * Both shapes carry the full breakdown underneath. Never show an unexplained
 * figure: if the app says $698.33, the PAYG line that produced it is on screen.
 */
export function FortnightResultPanel({
  result,
  bandSummary,
  captions = [],
}: FortnightResultPanelProps) {
  const hasOvertime = result.overtimeGross > 0
  const breakdown = breakdownRows(result)

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
              the label says what they are and the decimals line up. */}
          <p className="sl-summary__figure">
            <Money value={result.withOt.net} tone="net" />
            <span className="sl-summary__unit">take-home</span>
          </p>
          <FigureTable caption="Your fortnight before overtime" rows={breakdown} />
          <Captions lines={captions} />
        </div>
      </Panel>
    )
  }

  return (
    <ResultPanel
      label="Your OT adds"
      amount={result.otNetDelta}
      beforeTax={result.otGrossDelta}
      sticky
    >
      <FigureTable caption="Your fortnight with overtime" rows={breakdown} />
      <Captions lines={captions} />
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

/**
 * Gross down to take-home, with every line that moved the figure and none that
 * did not — a zero deduction row is noise, not disclosure.
 */
function breakdownRows(result: FortnightResult): FigureRow[] {
  const { withOt } = result
  const rows: FigureRow[] = [
    { label: 'Base pay', values: [result.ordinaryGross] },
  ]

  if (result.overtimeGross > 0) {
    rows.push({ label: 'Overtime', values: [result.overtimeGross] })
  }
  if (withOt.preTaxDeductions > 0) {
    rows.push({
      label: 'Pre-tax deductions',
      values: [withOt.preTaxDeductions],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  rows.push({
    label: 'PAYG tax',
    values: [withOt.payg],
    tone: 'out',
    sign: 'always-negative',
  })

  if (withOt.help > 0) {
    rows.push({
      label: 'Study loan',
      values: [withOt.help],
      tone: 'out',
      sign: 'always-negative',
    })
  }

  rows.push({
    label: 'Take-home',
    values: [withOt.net],
    tone: 'net',
    total: true,
  })

  return rows
}
