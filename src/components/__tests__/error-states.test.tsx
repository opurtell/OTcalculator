/**
 * What the app says when something has gone wrong.
 *
 * Both cases here are ones the user meets on a bad day and never sees
 * otherwise, which is exactly why they are worth a test: a broken empty state
 * is invisible until it is the only thing on screen.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'
import { readNotice } from '../Calculator'

/**
 * The boundary in its caught state.
 *
 * `renderToStaticMarkup` does not run error boundaries — a throw during server
 * rendering propagates — so the fallback is rendered directly rather than
 * provoked. What is being checked is the copy and the two ways out, not
 * React's own catching, which is React's to test.
 */
class Caught extends ErrorBoundary {
  state = { failed: true }
}

describe('ErrorBoundary', () => {
  it('gets out of the way when nothing is wrong', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>the calculator</p>
      </ErrorBoundary>,
    )
    expect(html).toBe('<p>the calculator</p>')
  })

  it('catches a render failure into a state', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true })
  })

  it('says what happened and offers the two things that fix it', () => {
    const html = renderToStaticMarkup(<Caught onClearSettings={() => {}}>x</Caught>)

    expect(html).toContain('Something went wrong working that out')
    // No figure is shown, because no figure can be trusted at this point.
    expect(html).not.toContain('take-home')
    expect(html).toContain('Reload the calculator')
    expect(html).toContain('Clear saved settings and reload')
    // The disclaimer survives every screen, this one included.
    expect(html).toContain('Not payroll advice')
  })

  it('leaves out clear-settings where there are none to clear', () => {
    // A browser that refuses localStorage has nothing stored, so offering to
    // clear it would be advice that cannot help.
    const html = renderToStaticMarkup(<Caught>x</Caught>)
    expect(html).toContain('Reload the calculator')
    expect(html).not.toContain('Clear saved settings')
  })
})

describe('readNotice', () => {
  it('says nothing about a clean read or a first visit', () => {
    expect(readNotice('ok')).toBeUndefined()
    expect(readNotice('empty')).toBeUndefined()
    expect(readNotice(undefined)).toBeUndefined()
  })

  it('warns when a stored figure did not survive the read', () => {
    // §4.4 repairs fields individually, so what is on screen is a mix of what
    // was saved and what was defaulted. Silence would be the app quietly
    // changing someone's pay band.
    expect(readNotice('repaired')).toContain('set back to the defaults')
  })

  it('explains an unreadable record rather than just restarting setup', () => {
    expect(readNotice('unreadable')).toContain("couldn't be read")
  })
})
