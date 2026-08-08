import { Disclaimer, EmptyState, Panel, StationLedger } from './ui/index'

/**
 * Phase 0 placeholder.
 *
 * The only job of this screen is to prove the deploy: that the bundle loads
 * from the /OTcalculator/ subpath, that the Station Ledger stylesheet and its
 * tokens arrive with it, and that the vendored IBM Plex Mono renders. It shows
 * no figures, because there is no engine yet and a placeholder number on a pay
 * calculator is worse than an empty screen.
 *
 * Phase 5 replaces this with the real shell (CalculatorLayout, the pathway
 * switcher, the pay band picker). See IMPLEMENTATION_PLAN.md §6.
 */
export function App() {
  return (
    <StationLedger measure>
      <main className="sl-stack sl-app">
        <h1 className="sl-heading">ACTAS OT Calculator</h1>
        <Panel>
          <EmptyState
            title="Not built yet"
            body="This is the deployment scaffold. The pay engine, the fortnight calculator and the quick calculation are still to come."
          />
        </Panel>
        <Disclaimer />
      </main>
    </StationLedger>
  )
}
