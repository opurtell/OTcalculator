/**
 * The §4.5 golden fixture, rendered as the user would enter it.
 *
 * One Saturday 10h pickup and one Wednesday 2h overrun — the same two shifts
 * the engine's golden test uses, put through the shift list and the result
 * panel so the figures are checked where they are actually read.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveSettings } from '../../app/settings'
import type { CalculatorChoices } from '../../app/settings'
import { fortnightWarnings } from '../../app/warnings'
import { emptyDraft, withInferredKind } from '../../app/shifts'
import { calculateFortnight } from '../../engine/fortnight'
import type { OtShift } from '../../engine/types'
import { FortnightPathway } from '../FortnightPathway'
import { FortnightResultPanel } from '../FortnightResultPanel'
import { ShiftSheet } from '../ShiftSheet'

const CHOICES: CalculatorChoices = {
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

const resolved = resolveSettings(CHOICES, '2026-02-11')
if (resolved === null) throw new Error('AP1 Step 2 should resolve')
const { settings } = resolved

/** Saturday 15 August 2026, 09:00–19:00, picked up. */
const SATURDAY: OtShift = {
  id: 'sat',
  date: '2026-08-15',
  startMin: 9 * 60,
  endMin: 19 * 60,
  endsNextDay: false,
  kind: 'separate',
}

/** Wednesday 19 August 2026, 18:00–20:00, ran on from the rostered shift. */
const WEDNESDAY: OtShift = {
  id: 'wed',
  date: '2026-08-19',
  startMin: 18 * 60,
  endMin: 20 * 60,
  endsNextDay: false,
  kind: 'overrun',
}

/** An AM shift picked up and entered as one period that ran to 18:00 — a 10-hour
 * shift taken to 11.5, which earns the one N36 occasion the §4.5 pair does not. */
const AM_RUN_ON: OtShift = {
  id: 'am-run-on',
  date: '2026-08-19',
  startMin: 6 * 60 + 30,
  endMin: 18 * 60,
  endsNextDay: false,
  kind: 'separate',
}

function renderPathway(shifts: OtShift[], storageNote?: string) {
  const result = calculateFortnight(shifts, settings)
  return renderToStaticMarkup(
    <FortnightPathway
      attendances={result.attendances}
      mealOccasions={result.mealAllowance.occasions}
      shifts={shifts}
      warnings={fortnightWarnings(shifts, result.flags, settings.holidays)}
      storageNote={storageNote}
      onAdd={() => {}}
      onEdit={() => {}}
      onDuplicate={() => {}}
      onDelete={() => {}}
      onClearAll={() => {}}
      pendingDelete={null}
      onUndoDelete={() => {}}
      onExpireDelete={() => {}}
    />,
  )
}

describe('the fortnight list', () => {
  const html = renderPathway([SATURDAY, WEDNESDAY])

  it('shows one row per shift, in date order', () => {
    expect(html.indexOf('Sat 15 Aug')).toBeGreaterThan(-1)
    expect(html.indexOf('Sat 15 Aug')).toBeLessThan(html.indexOf('Wed 19 Aug'))
    expect(html).toContain('09:00–19:00')
    expect(html).toContain('18:00–20:00')
  })

  it('prices the Saturday at double time from the first minute', () => {
    // N34 overrides C9.12 for Emergency Operations. A 1.5× opening tier here
    // would cost about $48 on this shift alone.
    expect(html).toContain('10h · all at 2× (Saturday)')
    expect(html).toContain('$965.51')
  })

  it('prices the overrun at its actual hours, with no minimum', () => {
    // A shift overrun never attracts C9.5: the rostered hours were already
    // worked, so short overtime is paid short.
    expect(html).toContain('2h · all at 1.5×')
    expect(html).toContain('$144.83')
    expect(html).not.toContain('4-hour minimum')
  })

  it('says nothing about a meal allowance on rows that earned none', () => {
    // The Saturday pickup finishes before the D shift's rostered end and the
    // Wednesday overrun starts at a time no roster shift ends at, so neither is
    // placed. Silent by design — see §3.11.
    expect(html).not.toContain('meal allowance')
  })

  it('names the meal allowance on the row that earned it', () => {
    // Beside the rate breakdown rather than folded into the row's amount: the
    // amount is overtime pay and the payslip lists the allowance on its own
    // line, so adding $35.38 into $1,062.06 would make the row disagree with
    // payroll.
    const withMeal = renderPathway([AM_RUN_ON])
    expect(withMeal).toContain('+ $35.38 meal allowance')
  })

  it('names the C9.5 kind in the collapsed row, because it changes the money', () => {
    expect(html).toContain('Separate shift')
    expect(html).toContain('Shift overrun')
  })

  it('offers a way in when there is nothing yet', () => {
    const empty = renderPathway([])
    expect(empty).toContain('No shifts added yet.')
    expect(empty).toContain('+ Add OT shift')
  })

  it('shows warnings as notes, never as a blocked button', () => {
    const long = renderPathway([
      { ...SATURDAY, startMin: 5 * 60, endMin: 23 * 60 },
    ])
    expect(long).toContain('runs 18h')
    expect(long).toContain('+ Add OT shift')
    expect(long).not.toContain('disabled')
  })
})

describe('the result once shifts are in', () => {
  const result = calculateFortnight([SATURDAY, WEDNESDAY], settings)
  const html = renderToStaticMarkup(
    <FortnightResultPanel
      result={result}
      bandSummary="AP1 Step 2"
      settings={settings}
    />,
  )

  it('leads with what the overtime added to take-home', () => {
    // §4.5: $1,110.33 of overtime, $698.33 in the hand, 63% kept. The plan
    // prints $1,110.34 by summing two already-rounded lines; §3.13 says full
    // precision until display, which gives the figure asserted here.
    expect(html).toContain('Your OT adds')
    expect(html).toContain('$698.33')
    expect(html).toContain('from $1,110.33 before tax')
    expect(html).toContain('63% kept')
    // PAYG moves from $1,208 to $1,620 — the reason the delta is not the
    // overtime's marginal rate.
    expect(html).toContain('1,620.00')
  })

  it('shows the fortnight both with and without overtime', () => {
    expect(html).toContain('Without OT')
    expect(html).toContain('With OT')
    // PAYG before the overtime, in the without-OT column.
    expect(html).toContain('1,208.00')
  })

  it('puts the per-shift breakdown behind the overtime line', () => {
    // The Overtime label is the inspect trigger; its per-attendance derivation
    // expands on tap rather than cluttering the comparison.
    expect(html).toContain('Overtime')
    expect(html).toContain('how this was worked out')
  })

  it('announces the headline without re-reading the working', () => {
    // The live region stops at the rule: the label, the figure and the two
    // support lines. Below it sit the comparison, the captions and the §5.7
    // derivation, which are there to be read rather than re-announced on
    // every keystroke (§8).
    expect(html.match(/aria-live/g)).toHaveLength(1)
    expect(html).toContain('<div class="sl-result__headline" aria-live="polite">')

    const announced = html.slice(
      html.indexOf('sl-result__headline'),
      html.indexOf('sl-result__divider'),
    )
    expect(announced).toContain('$698.33')
    expect(announced).not.toContain('Without OT')
  })

  it('exposes the full derivation with its clause references', () => {
    expect(html).toContain('How this was worked out')
    expect(html).toContain('EBA N34.1')
    expect(html).toContain('EBA N44')
    expect(html).toContain('ATO NAT 1004')
  })
})

describe('the add/edit sheet', () => {
  function renderSheet(over: Partial<ReturnType<typeof emptyDraft>>) {
    return renderToStaticMarkup(
      <ShiftSheet
        draft={withInferredKind({ ...emptyDraft(), ...over })}
        onDraftChange={() => {}}
        onCommit={() => {}}
        onClose={() => {}}
        band={settings.band}
        holidays={settings.holidays}
        meals={settings.meals}
      />,
    )
  }

  it('previews what the shift pays before it is committed', () => {
    const html = renderSheet({ date: '2026-08-15', start: '09:00', end: '19:00' })
    expect(html).toContain('10h · all at 2× (Saturday)')
    expect(html).toContain('$965.51')
    expect(html).toContain('Add shift')
  })

  it('previews the meal allowance while the times are still being chosen', () => {
    // An AM picked up and entered whole, running to 18:00.
    const html = renderSheet({ date: '2026-08-19', start: '06:30', end: '18:00' })
    expect(html).toContain('+ $35.38 meal allowance, not taxed')
    expect(html).toContain('1h 30m past the 10h AM shift')
    expect(html).toContain('EBA N36')
  })

  it('names the shift an overrun was worked out from, since it was never entered', () => {
    const html = renderSheet({
      date: '2026-08-19',
      start: '16:30',
      end: '18:00',
      kind: 'overrun',
      kindTouched: true,
    })
    expect(html).toContain('past the 10h AM shift this ran on from')
  })

  it('says nothing about a meal allowance the shift did not earn', () => {
    const html = renderSheet({ date: '2026-08-19', start: '09:00', end: '11:00' })
    expect(html).toContain('2h · all at 1.5×')
    expect(html).not.toContain('meal allowance')
  })

  it('says nothing on a 12-hour shift that ran over — outside the rule', () => {
    const html = renderSheet({
      date: '2026-08-19',
      start: '21:00',
      end: '23:00',
      kind: 'overrun',
      kindTouched: true,
    })
    expect(html).not.toContain('meal allowance')
  })

  it('confirms the next day rather than asking about it', () => {
    const html = renderSheet({ date: '2026-08-16', start: '22:00', end: '06:00' })
    expect(html).toContain('Ends next day · Mon 17 Aug')
    expect(html).toContain('Sunday rate carried past midnight')
  })

  it('explains a payment larger than the hours worked', () => {
    const html = renderSheet({
      date: '2026-08-19',
      start: '18:00',
      end: '20:00',
      kind: 'separate',
      kindTouched: true,
    })
    expect(html).toContain('2h worked → 4h paid · 4-hour minimum (C9.5)')
    expect(html).toContain('EBA C9.5')
  })

  it('offers the four roster shifts, with none picked on a blank draft', () => {
    const html = renderSheet({ date: '2026-08-15' })
    expect(html).toContain('Roster shift')
    expect(html).toContain('06:30–\n16:30')
    expect(html).toContain('21:00–\n07:00')
    // Nothing selected is a real state here — the quick-fill is optional, so
    // every one of the four renders unchecked rather than one being a default.
    for (const code of ['AM', 'D', 'PM', 'N']) {
      expect(html).toMatch(new RegExp(`aria-checked="false"[^>]*>${code}<`))
    }
  })

  it('shows the roster shift the times already are', () => {
    // Derived from the fields, so it also lights up for a shift typed by hand
    // and goes dark the moment a time is edited.
    const night = renderSheet({ date: '2026-08-15', start: '21:00', end: '07:00' })
    expect(night).toMatch(/aria-checked="true"[^>]*>N</)

    const edited = renderSheet({ date: '2026-08-15', start: '21:00', end: '07:40' })
    expect(edited).not.toMatch(/aria-checked="true"[^>]*>N</)
  })

  it('waits for a shift before showing a figure', () => {
    const html = renderSheet({ date: '2026-08-15' })
    expect(html).toContain('to see what this shift pays')
    expect(html).not.toContain('sl-preview')
  })
})
