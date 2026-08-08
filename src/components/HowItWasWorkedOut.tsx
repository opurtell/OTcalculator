import type { FortnightResult, FortnightSettings } from '../engine/fortnight'
import { Disclosure, FigureTable } from '../ui/index'
import { ordinaryPayRows, overtimeRateRows, paygRows } from '../app/breakdown'

export interface HowItWasWorkedOutProps {
  settings: FortnightSettings
  result: FortnightResult
}

/**
 * The §5.7 trust-building derivation, collapsed by default.
 *
 * Three small tables: how base becomes the fortnightly figure, how the
 * overtime rate is built (base only — the §3.2 trap, pinned to N34.1), and how
 * PAYG was withheld. Concept first, clause reference second — never a bare
 * allowance code. The figures are read-only; this explains the numbers the rest
 * of the panel states, it does not recompute them.
 *
 * Rendered in both the no-OT and with-OT states, because the ordinary-pay and
 * rate derivations hold whether or not there is overtime this fortnight.
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
      </div>
    </Disclosure>
  )
}
