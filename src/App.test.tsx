import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

// Phase 0's test is a smoke test and nothing more: it proves the app entry,
// the library barrel and the JSX transform all hold together, so a broken
// build fails CI before it reaches Pages. The tests that matter arrive with
// src/engine/ in Phase 2 — see IMPLEMENTATION_PLAN.md §4.5.
describe('App', () => {
  const html = renderToStaticMarkup(<App />)

  it('renders inside a StationLedger root', () => {
    // Components outside sl-root inherit the host page's styles and look
    // wrong, so the wrapper is worth asserting rather than assuming.
    expect(html).toContain('class="sl-root sl-measure"')
  })

  it('carries the permanent disclaimer', () => {
    expect(html).toContain('Estimate only')
    expect(html).toContain('Check your payslip.')
  })

  it('shows no dollar figures while there is no engine behind them', () => {
    expect(html).not.toContain('$')
  })
})
