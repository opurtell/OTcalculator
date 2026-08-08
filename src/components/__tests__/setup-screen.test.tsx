import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SetupScreen } from '../SetupScreen'
import { clampStep } from '../PayBandFields'

const props = {
  classification: 'AP1' as const,
  step: 2,
  onClassificationChange: () => {},
  onStepChange: () => {},
  baseAnnual: 95_698,
  fortnightly: 4908.32,
  overridden: false,
  onOverride: () => {},
  baseAnnualInput: '',
  fortnightlyInput: '',
  onBaseAnnualInputChange: () => {},
  onFortnightlyInputChange: () => {},
  onContinue: () => {},
}

describe('SetupScreen', () => {
  const html = renderToStaticMarkup(<SetupScreen {...props} />)

  it('shows the band it derived and where the rates came from', () => {
    expect(html).toContain('$95,698.00')
    expect(html).toContain('$4,908.32')
    // The copy deck makes rate currency mandatory beside a derived figure.
    expect(html).toContain('Rates effective 04/12/2025')
  })

  it('offers every classification and only the steps that exist', () => {
    expect(html).toContain('Ambulance Paramedic 1')
    expect(html).toContain('Intensive Care Paramedic 2')
    // AP1 runs to Step 4; a fifth option would mean a band nobody is paid on.
    expect(html).not.toContain('>5<')
  })

  it('offers the override in plain language', () => {
    expect(html).toContain("Doesn&#x27;t match your payslip?")
  })

  it('carries the privacy line as body text, not fine print', () => {
    expect(html).toContain('Nothing you enter leaves this device.')
    expect(html).toContain('sl-setup__privacy')
  })

  it('carries the permanent disclaimer', () => {
    expect(html).toContain('Estimate only')
    expect(html).toContain('Check your payslip.')
  })

  it('does not promise to remember a band it cannot store', () => {
    const remembering = renderToStaticMarkup(<SetupScreen {...props} />)
    expect(remembering).toContain("We&#x27;ll remember it on this device.")

    const forgetful = renderToStaticMarkup(
      <SetupScreen {...props} canRemember={false} />,
    )
    expect(forgetful).not.toContain('remember it on this device')
    expect(forgetful).toContain("Settings can&#x27;t be saved in this browser.")
  })
})

describe('clampStep', () => {
  it('keeps a step inside its classification', () => {
    // AP1 Step 4 → ICP2, which stops at 3. Clamping down keeps the seniority
    // the user has already told us about instead of resetting to Step 1.
    expect(clampStep('ICP2', 4)).toBe(3)
    expect(clampStep('AP1', 4)).toBe(4)
    expect(clampStep('AP2', 1)).toBe(1)
    expect(clampStep('AP1', 0)).toBe(1)
  })
})
