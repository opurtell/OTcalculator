import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import { Disclosure, FigureTable } from '../ui/index'
import {
  mealAllowanceRows,
  mealPeriodsSentence,
  ordinaryPayRows,
  overtimeRateRows,
  paygRows,
} from '../app/breakdown'

export interface HowItWasWorkedOutProps {
  settings: FortnightSettings
  result: FortnightResult
}

/**
 * The §5.7 trust-building derivation, collapsed by default.
 *
 * Four small tables: how base becomes the fortnightly figure, how the overtime
 * rate is built (base only — the §3.2 trap, pinned to N34.1), how PAYG was
 * withheld, and the N36 meal allowance. Concept first, clause reference second
 * — never a bare allowance code. The figures are read-only; this explains the
 * numbers the rest of the panel states, it does not recompute them.
 *
 * Rendered in both the no-OT and with-OT states, because the ordinary-pay, rate
 * and meal-period derivations hold whether or not there is overtime this
 * fortnight — the meal-allowance section in particular is how someone checks
 * whether payroll owed them one, which is a question a zero answers too.
 */
export function HowItWasWorkedOut({ settings, result }: HowItWasWorkedOutProps) {
  return (
    <Disclosure title="How this was worked out">
      <div className="sl-workings">
        <section>
          <h4 className="sl-workings__heading">Ordinary fortnightly pay</h4>
          <FigureTable
            caption="How ordinary fortnightly pay was worked out"
            rows={ordinaryPayRows(settings)}
          />
        </section>
        <section>
          <h4 className="sl-workings__heading">Overtime rate</h4>
          <FigureTable
            caption="How the overtime rate was worked out"
            rows={overtimeRateRows(settings)}
          />
        </section>
        <section>
          <h4 className="sl-workings__heading">PAYG tax</h4>
          <FigureTable
            caption="How the PAYG tax was worked out"
            rows={paygRows(settings, result)}
          />
        </section>
        <section>
          <h4 className="sl-workings__heading">Meal allowance</h4>
          <FigureTable
            caption="How the meal allowance was worked out"
            rows={mealAllowanceRows(result)}
          />
          {/* The four windows, spelled out. The table above can say how many
              occasions were earned; only this line lets someone work out why a
              shift of their own did or did not earn one. */}
          <p className="sl-caption">
            Meal periods (N36.3): {mealPeriodsSentence()}. Overtime that runs to
            the end of one of these, or past it, without a break for a meal earns
            one allowance — and one more for each further meal period.
          </p>
        </section>
      </div>
    </Disclosure>
  )
}
