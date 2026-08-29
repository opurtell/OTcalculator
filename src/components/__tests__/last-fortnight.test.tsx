/**
 * The fortnight that just ended, shown once more.
 *
 * `renderToStaticMarkup` runs no effects, which suits this feature: whether the
 * banner is on screen is decided at render time by the same test the effect
 * uses to clear the record, precisely so a load never flashes a banner it is
 * about to withdraw. What cannot be driven here is the tap — the dismiss button
 * and the first shift of the new fortnight are state transitions, and the
 * closest this file gets is asserting that the control is offered and that a
 * fortnight with shifts in it never shows the banner at all.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { payFortnightFor } from '../../app/pay-period'
import { DEFAULT_CHOICES } from '../../app/settings'
import type { CalculatorChoices } from '../../app/settings'
import type { OtShift } from '../../engine/types'
import { Calculator } from '../Calculator'

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

/**
 * The Thursday after the golden fixture's fortnight closed. The shifts below
 * fall in the period ending Wed 26 Aug; today is in the one after it, which is
 * exactly the visit this feature exists for.
 */
const THE_MORNING_AFTER = '2026-08-27'
const CARRIED = payFortnightFor('2026-08-26')

/** The §4.5 pair: a Saturday 10-hour pickup and a Wednesday 2-hour overrun. */
const GOLDEN_SHIFTS: OtShift[] = [
  {
    id: 'shift-1',
    date: '2026-08-15',
    startMin: 9 * 60,
    endMin: 19 * 60,
    endsNextDay: false,
    kind: 'separate',
  },
  {
    id: 'shift-2',
    date: '2026-08-19',
    startMin: 9 * 60,
    endMin: 11 * 60,
    endsNextDay: false,
    kind: 'overrun',
  },
]

const LAST_FORTNIGHT = {
  fortnight: CARRIED,
  shifts: GOLDEN_SHIFTS,
  choices: GOLDEN,
}

function render(props = {}) {
  return renderToStaticMarkup(
    <Calculator
      initialChoices={GOLDEN}
      startAtSetup={false}
      payDate={THE_MORNING_AFTER}
      lastFortnight={LAST_FORTNIGHT}
      {...props}
    />,
  )
}

describe('the carried fortnight', () => {
  it('shows last fortnight’s take-home above the new one', () => {
    const html = render()

    expect(html).toContain('Last pay fortnight')
    // $4,398.66 — the §4.5 take-home, recomputed from the shifts that earned it
    // rather than read back from a stored figure.
    expect(html).toContain('$4,398.66')
  })

  it('names the fortnight, the band and the shift count it is speaking for', () => {
    // The list is gone and the band may since have been edited, so the figure
    // has to say what produced it or it is an unexplained number (§7).
    expect(render()).toContain('Thu 13 Aug – Wed 26 Aug · AP1 Step 2 · 2 shifts')
  })

  it('says what the overtime added, before and after tax', () => {
    const html = render()
    expect(html).toContain('Your overtime added $698.33 of that, from $1,110.33')
  })

  it('offers the same working the live result offers', () => {
    const html = render()

    expect(html).toContain('What made up that fortnight')
    // The comparison table, with the per-shift derivation hung off its
    // Overtime row — the same rows `comparisonRows` builds for the result.
    expect(html).toContain('Your fortnight Thu 13 Aug – Wed 26 Aug')
    expect(html).toContain('Overtime — how this was worked out')
    expect(html).toContain('1,620.00')
  })

  it('says how it leaves, and offers to do it now', () => {
    const html = render()
    expect(html).toContain('This goes when you add a shift for the new fortnight')
    expect(html).toContain('Dismiss')
  })

  it('is worked out on the settings it was worked out on at the time', () => {
    // The live panel is AP1 Step 1 and the carried fortnight AP1 Step 2. A
    // banner that followed today's band would restate a figure the user was
    // already shown — silently, and with no way to notice.
    const html = render({ initialChoices: DEFAULT_CHOICES })

    expect(html).toContain('Thu 13 Aug – Wed 26 Aug · AP1 Step 2 · 2 shifts')
    expect(html).toContain('$4,398.66')
    // And the live figures are still AP1 Step 1's, unchanged by its presence.
    expect(html).toContain('AP1 Step 1 · $91,571')
  })

  it('is not the result panel, and does not announce itself', () => {
    // §8: exactly one `aria-live` region on screen, and it is the headline. A
    // second one here would re-read a historical figure every time the live one
    // moved, which is how a helpful announcement becomes one you switch off.
    const html = render()
    expect(html.match(/aria-live/g)).toHaveLength(1)
    expect(html).not.toContain('Your OT adds')
  })

  it('stays out of the way once this fortnight has a shift in it', () => {
    const html = render({ initialShifts: [{ ...GOLDEN_SHIFTS[0], date: '2026-08-29' }] })
    expect(html).not.toContain('Last pay fortnight')
  })

  it('is absent on an ordinary visit', () => {
    const html = render({ lastFortnight: null })
    expect(html).not.toContain('Last pay fortnight')
    expect(html).not.toContain('What made up that fortnight')
  })

  it('says nothing about a fortnight it can no longer price', () => {
    // A band that has left the pay tables. Elsewhere this sends the user to the
    // setup screen; here there is nothing to ask them, so the banner is simply
    // not shown rather than shown against a defaulted band.
    const html = render({
      lastFortnight: {
        ...LAST_FORTNIGHT,
        choices: {
          ...GOLDEN,
          band: { ...GOLDEN.band, classification: 'AM1' },
        },
      },
    })
    expect(html).not.toContain('Last pay fortnight')
  })
})
