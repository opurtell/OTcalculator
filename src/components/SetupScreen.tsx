import { AssumptionNote, Button, Disclaimer, Panel } from '../ui/index'
import { PayBandFields } from './PayBandFields'
import type { PayBandFieldsProps } from './PayBandFields'

export interface SetupScreenProps extends PayBandFieldsProps {
  onContinue: () => void
  /**
   * False when this browser refuses `localStorage` — private windows, storage
   * disabled, a locked-down managed device. The screen's promise to remember
   * the band would otherwise be a lie, and a paramedic re-entering their band
   * every shift deserves to know why.
   */
  canRemember?: boolean
}

/**
 * First run (§5.1). The only screen a new user must complete.
 *
 * Everything else in the app is optional — deductions, study debt, the
 * pathway — but a take-home figure without a pay band is not an estimate, it
 * is a guess, so this one screen stands between the user and the calculator.
 *
 * The privacy line is not fine print. It is the reason this app is a static
 * page with no account, and it sits in normal body text at the bottom of the
 * screen where it reads as a feature.
 */
export function SetupScreen({
  onContinue,
  canRemember = true,
  ...bandFields
}: SetupScreenProps) {
  return (
    <main className="sl-stack sl-app">
      <h1 className="sl-heading">ACTAS OT Calculator</h1>
      <Panel>
        <div className="sl-stack">
          <div>
            <h2 className="sl-heading">Set your pay band</h2>
            <p className="sl-caption">
              {canRemember
                ? "We'll remember it on this device."
                : "This browser won't let us save it, so you'll set it each visit."}
            </p>
          </div>
          <PayBandFields {...bandFields} />
        </div>
      </Panel>
      {canRemember ? null : (
        <AssumptionNote>
          <p>
            Settings can't be saved in this browser. Everything still works —
            you'll just start from here next time.
          </p>
        </AssumptionNote>
      )}
      <Button block onClick={onContinue}>
        Continue
      </Button>
      <p className="sl-setup__privacy">
        Nothing you enter leaves this device. There's no account.
      </p>
      <Disclaimer />
    </main>
  )
}
