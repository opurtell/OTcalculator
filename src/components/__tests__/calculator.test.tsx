/**
 * The shell, rendered.
 *
 * `renderToStaticMarkup` runs no effects and dispatches no events, so what is
 * tested here is what a user first sees: the right screen, with the right
 * figures on it. The state transitions behind the buttons are covered by the
 * pure round trip at the bottom, which is where the persisted shape is decided.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHOICES } from '../../app/settings'
import type { CalculatorChoices } from '../../app/settings'
import { Calculator, choicesFrom, fieldsFrom } from '../Calculator'

/** AP1 Step 2, Scale 2, nothing packaged — the §4.5 golden fixture's setup. */
const GOLDEN: CalculatorChoices = {
  band: {
    classification: 'AP1',
    step: 2,
    annualBase: null,
    fortnightlyGross: null,
  },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'fortnight',
}

const IN_FY_2025_26 = '2026-02-11'

function render(choices: CalculatorChoices, props = {}) {
  return renderToStaticMarkup(
    <Calculator
      initialChoices={choices}
      startAtSetup={false}
      payDate={IN_FY_2025_26}
      {...props}
    />,
  )
}

describe('Calculator', () => {
  it('starts at setup on a device with nothing stored', () => {
    const html = renderToStaticMarkup(
      <Calculator startAtSetup payDate={IN_FY_2025_26} />,
    )
    expect(html).toContain('Set your pay band')
    expect(html).not.toContain('Overtime shifts')
  })

  it('shows the fortnight, not the setup screen, once a band is known', () => {
    const html = render(GOLDEN)
    expect(html).not.toContain('Set your pay band')
    expect(html).toContain('Your fortnight')
  })

  it('puts the golden fortnight on screen before any overtime', () => {
    const html = render(GOLDEN)

    // $4,908.32 gross, $1,208 PAYG, $3,700.32 take-home — the §4.5 figures,
    // reached through the real UI rather than through the engine directly.
    expect(html).toContain('4,908.32')
    expect(html).toContain('1,208.00')
    expect(html).toContain('$3,700.32')
  })

  it('leaves out the lines that did not move the figure', () => {
    const html = render(GOLDEN)
    // Nothing packaged and no study debt: those rows would be zeroes claiming
    // to be disclosure. Matched as table rows — "Pre-tax deductions" is also
    // the heading of the settings panel, which is always present.
    expect(html).not.toContain('>Pre-tax deductions</th>')
    expect(html).not.toContain('>Study loan</th>')
    // And there is no overtime yet, so no overtime line and no loud headline.
    expect(html).not.toContain('Your OT adds')
  })

  it('summarises the settings on the collapsed disclosures', () => {
    const html = render({
      ...GOLDEN,
      tax: { claimsTaxFreeThreshold: true, hasStudyDebt: true },
      deductions: { fixedPerFortnight: 611, percentOfGross: 0.05 },
    })

    expect(html).toContain('AP1 Step 2 · $95,698')
    expect(html).toContain('Deductions: $611.00 + 5% · Study debt on')
  })

  it('shows the deductions arithmetic against the fortnight gross', () => {
    const html = render({
      ...GOLDEN,
      deductions: { fixedPerFortnight: 611, percentOfGross: 0.05 },
    })

    // 4,908.32 − 611.00 − 245.42 = 4,051.90, and the panel shows every step.
    expect(html).toContain('5% of gross')
    expect(html).toContain('245.42')
    expect(html).toContain('4,051.90')
  })

  it('warns where packaging and a study debt meet', () => {
    const withBoth = render({
      ...GOLDEN,
      tax: { claimsTaxFreeThreshold: true, hasStudyDebt: true },
      deductions: { fixedPerFortnight: 611, percentOfGross: 0 },
    })
    expect(withBoth).toContain('not what you owe at tax time')

    const withoutDebt = render({
      ...GOLDEN,
      deductions: { fixedPerFortnight: 611, percentOfGross: 0 },
    })
    expect(withoutDebt).not.toContain('not what you owe at tax time')
  })

  it('captions a stale tax schedule where the figures are', () => {
    const html = render(GOLDEN, { payDate: '2026-08-08' })
    expect(html).toContain('Using 2025–26 tax rates')
  })

  it('offers both pathways and shows the one selected', () => {
    const quick = render({ ...GOLDEN, pathway: 'quick' })
    expect(quick).toContain('How many hours?')
    expect(quick).not.toContain('No shifts added yet.')

    const fortnight = render(GOLDEN)
    expect(fortnight).toContain('No shifts added yet.')
    expect(fortnight).not.toContain('How many hours?')
  })

  it('states the quick pathway assumptions on the same screen as the field', () => {
    const html = render({ ...GOLDEN, pathway: 'quick' })

    // Mon-Fri, not the brief's Mon-Sat: N34 overrides C9.12 and puts Saturday
    // at double time from the first minute, so a Saturday is understated by
    // the 1.5x opening tier rather than described by it.
    expect(html).toContain('Assumes one Mon–Fri shift')
    expect(html).toContain('4-hour minimum')
    expect(html).toContain('every one of those pays more')
  })

  it('shows the fortnight, not a zero, until hours are entered', () => {
    const html = render({ ...GOLDEN, pathway: 'quick' })
    expect(html).not.toContain('Adds about')
    expect(html).toContain('Your fortnight')
  })

  it('falls back to the setup screen when a stored band no longer exists', () => {
    const html = render({
      ...GOLDEN,
      band: { ...GOLDEN.band, classification: 'ICP2', step: 9 },
    })
    // Sanitised to the default band rather than showing someone else's pay.
    expect(html).toContain('AP1 Step 1')
  })
})

describe('choices round trip', () => {
  it('survives the trip through the field strings unchanged', () => {
    const choices: CalculatorChoices = {
      band: {
        classification: 'ICP1',
        step: 3,
        annualBase: null,
        fortnightlyGross: null,
      },
      tax: { claimsTaxFreeThreshold: false, hasStudyDebt: true },
      deductions: { fixedPerFortnight: 611, percentOfGross: 0.05 },
      pathway: 'quick',
    }

    expect(choicesFrom(fieldsFrom(choices))).toEqual(choices)
  })

  it('keeps overrides through the trip, and drops them when cleared', () => {
    const overridden: CalculatorChoices = {
      ...DEFAULT_CHOICES,
      band: {
        classification: 'AP1',
        step: 2,
        annualBase: 96_000,
        fortnightlyGross: 4950.5,
      },
    }
    expect(choicesFrom(fieldsFrom(overridden))).toEqual(overridden)

    const cleared = choicesFrom({
      ...fieldsFrom(overridden),
      baseAnnualInput: '',
      fortnightlyInput: '',
    })
    // An emptied field is "I haven't said", not "I earn nothing" — the app
    // goes back to deriving from the table.
    expect(cleared.band.annualBase).toBeNull()
    expect(cleared.band.fortnightlyGross).toBeNull()
  })

  it('sanitises a band that has outlived its pay table', () => {
    const stale: CalculatorChoices = {
      ...DEFAULT_CHOICES,
      band: { ...DEFAULT_CHOICES.band, classification: 'AM1', step: 1 },
    }
    expect(choicesFrom(fieldsFrom(stale)).band.classification).toBe('AP1')
  })
})
