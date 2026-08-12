import { advancedBreakdown, spendableTotal } from '../engine/packaging'
import type { AdvancedDeductions } from '../engine/packaging'
import type { FortnightResult } from '../engine/fortnight'
import {
  advancedDeductionRows,
  overtimeSuperSentence,
  spendableRows,
} from '../app/breakdown'
import { Disclosure, FigureTable, formatMoney } from '../ui/index'

export interface WhereYourMoneyGoesProps {
  result: FortnightResult
  /** The split, already resolved to the live super field. */
  advanced: AdvancedDeductions
  /** `5% of pay before tax`, when that is how super was entered. */
  superNote?: string
}

/**
 * What advanced mode is for: where the pre-tax money went, and what that leaves
 * to spend.
 *
 * Take-home is the wrong figure for someone who packages. It is smaller than the
 * money they actually have, because living expenses and meals and entertainment
 * come out of the payslip and then come back — to a mortgage, a rent payment, a
 * packaging card — and get spent like any other dollar. Super does not come
 * back, and union fees have already been spent, so the two are shown and then
 * left out of the total. **Spendable is take-home plus the two categories that
 * return, and nothing else.**
 *
 * Collapsed by default and summarised with the Spendable figure, so it does not
 * have to be opened to be useful — the same rule the settings disclosures follow
 * (§7): never a bare "Advanced ▸".
 *
 * Only rendered when advanced mode is on. In simple mode the app cannot tell
 * packaged living expenses from salary-sacrificed super (trap 6), and a
 * Spendable figure guessed from one undifferentiated field would be confidently
 * wrong on the commonest entry.
 */
export function WhereYourMoneyGoes({
  result,
  advanced,
  superNote,
}: WhereYourMoneyGoesProps) {
  // Against the fortnight's own gross, overtime included — the same figure the
  // deductions panel does its arithmetic on, so the two never disagree about
  // what a percentage came to. It is also the side the Spendable figure is
  // asked from: what there is to spend is a question about this fortnight, not
  // about the one without the shifts in it.
  const breakdown = advancedBreakdown(result.withOt.gross, advanced)
  const deductions = advancedDeductionRows(result, advanced, superNote)
  const superSentence = overtimeSuperSentence(result, advanced)

  return (
    <Disclosure
      title="Where your money goes"
      summary={`${formatMoney(spendableTotal(result.netTotal, breakdown))} spendable`}
    >
      <div className="sl-workings">
        <section>
          <h4 className="sl-workings__heading">Taken before tax</h4>
          <FigureTable
            // The accessible name follows the shape. A caption promising a
            // comparison over a single column would send a screen-reader user
            // looking for a column that is not there.
            caption={
              deductions.columns
                ? 'Where the pre-tax deductions went, with and without overtime'
                : 'Where the pre-tax deductions went'
            }
            columns={deductions.columns}
            rows={deductions.rows}
          />
          {/* The one line in this panel that moves with the overtime is super,
              and only when it is a percentage. A column that changed with
              nothing said about it would be exactly the unexplained figure the
              app refuses everywhere else. */}
          {superSentence ? <p className="sl-caption">{superSentence}</p> : null}
          {/* "Overtime included" lives in the sentence above when there is any,
              so this line says the part that holds either way rather than
              repeating it a second time. */}
          <p className="sl-caption">
            Super comes out of your whole fortnight before tax, before anything
            else does. The other three are set amounts.
          </p>
        </section>
        <section>
          <h4 className="sl-workings__heading">What you have to spend</h4>
          <FigureTable
            caption="How much there is to spend"
            rows={spendableRows(result, breakdown)}
          />
          <p className="sl-caption">
            Living expenses and meals and entertainment never reach your bank
            account, but you still spend them — so they are added back here.
            Super is locked away until you retire, and union fees have already
            gone to the union.
          </p>
          {breakdown.capped ? (
            <p className="sl-caption">
              Your deductions came to more than the fortnight pays, so each one
              has been scaled back to what there was — see the Deductions &amp;
              tax panel.
            </p>
          ) : null}
        </section>
      </div>
    </Disclosure>
  )
}
