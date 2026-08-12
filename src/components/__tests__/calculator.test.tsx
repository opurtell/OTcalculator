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
import { payFortnightFor } from '../../app/pay-period'
import { DEFAULT_CHOICES } from '../../app/settings'
import type { CalculatorChoices } from '../../app/settings'
import {
  Calculator,
  choicesFrom,
  fieldsFrom,
  shiftStorageNote,
} from '../Calculator'

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

/**
 * Advanced mode as a user would leave it: super at 5%, and the three value-only
 * categories filled in. $4,908.32 gross ⇒ $245.42 super + $800 + $100 + $30.
 */
const ADVANCED: CalculatorChoices = {
  ...GOLDEN,
  deductions: {
    fixedPerFortnight: 0,
    percentOfGross: 0,
    advanced: {
      enabled: true,
      superMode: 'percent',
      superPercentOfGross: 0.05,
      superPerFortnight: 0,
      livingExpenses: 800,
      mealsAndEntertainment: 100,
      unionFees: 30,
    },
  },
}

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
    expect(html).toContain('5% of pay before tax')
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

  it('offers the advanced split, and shows the simple fields until it is on', () => {
    const simple = render(GOLDEN)
    expect(simple).toContain('Set amount per fortnight')
    expect(simple).not.toContain('Living expenses per fortnight')

    const advanced = render(ADVANCED)
    expect(advanced).not.toContain('Set amount per fortnight')
    expect(advanced).toContain('Super, percentage of pay before tax')
    expect(advanced).toContain('Living expenses per fortnight')
    expect(advanced).toContain('Meals and entertainment per fortnight')
    expect(advanced).toContain('Union fees per fortnight')
  })

  it('offers super two ways and shows only the one selected', () => {
    // Both figures are kept so the switch is not destructive, but only one is
    // ever a field — and only one is ever applied.
    const asPercent = render(ADVANCED)
    expect(asPercent).toContain('Super, percentage of pay before tax')
    expect(asPercent).not.toContain('Super, set amount per fortnight')

    const asAmount = render({
      ...ADVANCED,
      deductions: {
        ...ADVANCED.deductions,
        advanced: {
          ...ADVANCED.deductions.advanced!,
          superMode: 'amount',
          superPerFortnight: 400,
        },
      },
    })
    expect(asAmount).toContain('Super, set amount per fortnight')
    expect(asAmount).not.toContain('Super, percentage of pay before tax')
    // $400, not 5% of gross — the remembered percentage reaches nothing.
    expect(asAmount).toContain('Deductions (advanced): $1,330.00')
  })

  it('takes the super percentage on the whole fortnight before tax', () => {
    // 5% of $4,908.32 is $245.42, not 5% of what is left after the other three.
    // The split has to keep the rule the single percentage field always had.
    const html = render(ADVANCED)
    expect(html).toContain('245.42')
    expect(html).toContain('5% of pay before tax')
    // 4,908.32 − 245.42 − 800 − 100 − 30 = 3,732.90
    expect(html).toContain('3,732.90')
  })

  it('shows what the split leaves to spend, and what it leaves out', () => {
    const html = render(ADVANCED)

    // Take-home is the wrong figure for someone who packages: the living
    // expenses and meals money comes out of the payslip and gets spent anyway.
    expect(html).toContain('Where your money goes')
    expect(html).toContain('Spendable')
    expect(html).toContain('spendable')
    expect(html).toContain(
      'Super and union fees are not in this — one is locked away, the other is already spent',
    )
  })

  it('says nothing about spendable money in simple mode', () => {
    // One field over several unrelated things cannot tell packaged living
    // expenses from sacrificed super, so there is no honest figure to show.
    const html = render(GOLDEN)
    expect(html).not.toContain('Where your money goes')
    expect(html).not.toContain('Spendable')
  })

  it('summarises the figures it is actually calculating on', () => {
    // $245.42 of super + $930 fixed. A collapsed summary naming the two simple
    // fields while the app calculated on four categories would be worse than
    // no summary at all.
    expect(render(ADVANCED)).toContain('Deductions (advanced): $930.00 + 5%')
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

/**
 * What the markup owes a screen reader (§8).
 *
 * These are assertions about structure rather than about pay, and they are
 * here rather than in the library's own tests because three of them are only
 * true once the app has composed the pieces: the tabs know their panel, the
 * live region is the headline alone, and the warnings have somewhere to be
 * announced from.
 */
describe('Calculator accessibility', () => {
  it('ties each tab to the panel it controls', () => {
    const html = render(GOLDEN)

    const panel = /<div role="tabpanel" id="([^"]+)" aria-labelledby="([^"]+)"/.exec(html)
    expect(panel, 'no tabpanel in the markup').not.toBeNull()
    const [, panelId, labelledBy] = panel!

    // The selected tab carries both ends of the relationship, and is the only
    // tab in the tab order — the strip is one control, not two stops.
    expect(html).toContain(
      `id="${labelledBy}" aria-controls="${panelId}" aria-selected="true" tabindex="0"`,
    )
    expect(html).toContain('aria-selected="false" tabindex="-1"')
  })

  it('announces the take-home figure, and only the figure', () => {
    const html = render(GOLDEN)

    // Exactly one live region on the screen. Every keystroke in the app moves
    // these figures, so a second one — or one wrapped around the breakdown —
    // turns a helpful announcement into something you switch off.
    expect(html.match(/aria-live/g)).toHaveLength(1)
    expect(html).toContain('<p class="sl-summary__figure" aria-live="polite">')
  })

  it('leaves the warnings somewhere to be announced from', () => {
    // Empty on a fortnight with no shifts, and present all the same: a live
    // region has to be in the DOM before its content arrives.
    expect(render(GOLDEN)).toContain('role="status"')
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

  it('keeps the advanced split through the trip, both super figures included', () => {
    const both: CalculatorChoices = {
      ...ADVANCED,
      deductions: {
        fixedPerFortnight: 611,
        percentOfGross: 0.02,
        advanced: {
          enabled: true,
          superMode: 'amount',
          superPercentOfGross: 0.05,
          superPerFortnight: 400,
          livingExpenses: 800,
          mealsAndEntertainment: 100,
          unionFees: 30,
        },
      },
    }

    // The simple fields survive advanced mode and the unselected super figure
    // survives the switch — turning something on is not an instruction to
    // forget what was already there.
    expect(choicesFrom(fieldsFrom(both))).toEqual(both)
  })

  it('stores no split for someone who has never opened it', () => {
    // Absent, not a block of zeroes: an untouched record keeps the shape it
    // had before advanced mode existed. See `Preferences.deductions`.
    expect(choicesFrom(fieldsFrom(GOLDEN)).deductions).toEqual({
      fixedPerFortnight: 0,
      percentOfGross: 0,
    })
    expect(choicesFrom(fieldsFrom(GOLDEN)).deductions.advanced).toBeUndefined()
  })

  it('keeps a filled-in split that has been switched back off', () => {
    const parked: CalculatorChoices = {
      ...ADVANCED,
      deductions: {
        ...ADVANCED.deductions,
        advanced: { ...ADVANCED.deductions.advanced!, enabled: false },
      },
    }
    expect(choicesFrom(fieldsFrom(parked))).toEqual(parked)
  })

  it('sanitises a band that has outlived its pay table', () => {
    const stale: CalculatorChoices = {
      ...DEFAULT_CHOICES,
      band: { ...DEFAULT_CHOICES.band, classification: 'AM1', step: 1 },
    }
    expect(choicesFrom(fieldsFrom(stale)).band.classification).toBe('AP1')
  })
})

describe('what the app says about saved shifts', () => {
  const FORTNIGHT = payFortnightFor('2026-08-10')

  it('names the fortnight the list is being kept for', () => {
    // Never an unexplained figure, and by the same token never a silent
    // persistence: a list that survived a reload says why it did.
    expect(
      shiftStorageNote({
        hasShifts: true,
        canRemember: true,
        expired: false,
        fortnight: FORTNIGHT,
      }),
    ).toBe(
      'Saved on this device for the pay fortnight Thu 30 Jul – Wed 12 Aug. ' +
        'They clear themselves when the next one starts.',
    )
  })

  it('explains a list that emptied itself between visits', () => {
    const note = shiftStorageNote({
      hasShifts: false,
      canRemember: true,
      expired: true,
      fortnight: FORTNIGHT,
    })
    expect(note).toContain('last pay fortnight were cleared')
    expect(note).toContain('Thu 30 Jul')
  })

  it('says nothing on an ordinary empty list', () => {
    // A first visit is not an event.
    expect(
      shiftStorageNote({
        hasShifts: false,
        canRemember: true,
        expired: false,
        fortnight: FORTNIGHT,
      }),
    ).toBeUndefined()
  })

  it('claims nothing when the browser has no storage', () => {
    // Nothing is being saved, so nothing is promised — in either state.
    for (const expired of [false, true]) {
      expect(
        shiftStorageNote({
          hasShifts: true,
          canRemember: false,
          expired,
          fortnight: FORTNIGHT,
        }),
      ).toBeUndefined()
    }
  })
})
