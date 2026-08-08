import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button, Disclaimer, Panel } from '../ui/index'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Clears the saved settings. Offered as the second thing to try, not the first. */
  onClearSettings?: () => void
}

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * The last line before a white page.
 *
 * A render that throws takes the whole tree with it, and what the user sees is
 * a blank screen — indistinguishable from the base-path failure, from a failed
 * deploy, and from a dead phone. This says which it is, in one sentence, and
 * offers the two things that actually recover it: reload, and if that keeps
 * happening, clear the saved settings that might be producing it.
 *
 * A class component because React has no hook equivalent — `componentDidCatch`
 * and `getDerivedStateFromError` are class-only, and always have been.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry — there is no backend and there never will be (§4.7). The
    // console is where a bug report comes from.
    console.error('The calculator stopped', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="sl-stack sl-app">
        <h1 className="sl-heading">ACTAS OT Calculator</h1>
        <Panel>
          <div className="sl-stack">
            <div>
              <h2 className="sl-heading">Something went wrong working that out</h2>
              <p className="sl-caption">
                The figures on screen can't be trusted, so the app has stopped
                showing them rather than showing you a wrong one.
              </p>
            </div>
            <p>
              Reloading usually fixes it, and your saved pay band and deductions
              are untouched. If it happens again straight away, clearing the
              saved settings is the next thing to try — you'll be asked for your
              pay band again, and nothing else is lost.
            </p>
            <Button block onClick={() => window.location.reload()}>
              Reload the calculator
            </Button>
            {this.props.onClearSettings ? (
              <Button
                block
                variant="secondary"
                onClick={() => {
                  this.props.onClearSettings?.()
                  window.location.reload()
                }}
              >
                Clear saved settings and reload
              </Button>
            ) : null}
          </div>
        </Panel>
        <Disclaimer />
      </main>
    )
  }
}
