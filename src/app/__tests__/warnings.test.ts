import { describe, expect, it } from 'vitest'
import { AP1_STEP_2, HOLIDAYS_2026 } from '../../engine/__tests__/fixtures'
import { calculateFortnight } from '../../engine/fortnight'
import { NO_DEDUCTIONS } from '../../engine/packaging'
import type { FortnightSettings, OtShift } from '../../engine'
import { helpScheduleFor, taxScaleFor } from '../../data'
import { fortnightWarnings } from '../warnings'

const SETTINGS: FortnightSettings = {
  band: AP1_STEP_2,
  taxScale: taxScaleFor('2025-26', 2).scale,
  helpSchedule: null,
  deductions: NO_DEDUCTIONS,
  holidays: HOLIDAYS_2026,
}

function shift(over: Partial<OtShift> & Pick<OtShift, 'id' | 'date'>): OtShift {
  return {
    startMin: 9 * 60,
    endMin: 17 * 60,
    endsNextDay: false,
    kind: 'separate',
    ...over,
  }
}

function warn(shifts: OtShift[]) {
  const result = calculateFortnight(shifts, SETTINGS)
  return fortnightWarnings(shifts, result.flags, HOLIDAYS_2026).map((w) => w.text)
}

describe('fortnightWarnings', () => {
  it('says nothing about an ordinary fortnight', () => {
    expect(warn([shift({ id: 'a', date: '2026-08-19' })])).toEqual([])
  })

  it('questions a shift longer than sixteen hours', () => {
    // A warning, never a block: the user knows their roster better than the
    // app does, and 17 hours is unusual rather than impossible.
    const [text] = warn([
      shift({ id: 'a', date: '2026-08-19', startMin: 6 * 60, endMin: 23 * 60 }),
    ])
    expect(text).toContain('runs 17h')
    expect(text).toContain('Wed 19 Aug')
  })

  it('says out loud that overlapping time is paid once', () => {
    // The engine merges the overlap into the enclosing span, which is right
    // and also silent — someone who entered the same pickup twice would
    // otherwise see a total that did not match their own arithmetic.
    const [text] = warn([
      shift({ id: 'a', date: '2026-08-19', startMin: 9 * 60, endMin: 17 * 60 }),
      shift({ id: 'b', date: '2026-08-19', startMin: 15 * 60, endMin: 19 * 60 }),
    ])
    expect(text).toContain('paid once, not twice')
  })

  it('notices a list that is wider than a fortnight', () => {
    const [text] = warn([
      shift({ id: 'a', date: '2026-08-01' }),
      shift({ id: 'b', date: '2026-08-25' }),
    ])
    expect(text).toContain('span 25 days')
    expect(text).toContain('two pay periods')
  })

  it('warns rather than under-paying past the holiday horizon', () => {
    // §3.7: the list ends, and a date past the end must say so rather than be
    // silently priced as an ordinary weekday.
    const [text] = warn([shift({ id: 'a', date: '2027-08-02' })])
    expect(text).toContain('Public holidays are only known through')
    expect(text).toContain('the real figure is higher')
  })

  it('flags a daylight saving transition', () => {
    // First Sunday in April 2026. Wall-clock hours and worked hours disagree
    // by one, and only the person who worked them knows which is right.
    const [text] = warn([shift({ id: 'a', date: '2026-04-05' })])
    expect(text).toContain('daylight saving change')
  })

  it('flags grouping it was unsure about', () => {
    // A 45-minute gap groups per the ≤60 rule, but 60 minutes is an engine
    // convention rather than an EBA one, so the user gets to disagree.
    const [text] = warn([
      shift({ id: 'a', date: '2026-08-19', startMin: 9 * 60, endMin: 13 * 60 }),
      shift({
        id: 'b',
        date: '2026-08-19',
        startMin: 13 * 60 + 45,
        endMin: 18 * 60,
      }),
    ])
    expect(text).toContain('45m apart are treated as one attendance')
  })

  it('leaves packaging flags to the panel that caused them', () => {
    // A note beside the shift list would be adrift from the field it is about.
    const packaged = calculateFortnight([shift({ id: 'a', date: '2026-08-19' })], {
      ...SETTINGS,
      helpSchedule: helpScheduleFor('2025-26').schedule,
      deductions: { fixedPerFortnight: 900, percentOfGross: 0 },
    })
    const texts = fortnightWarnings(
      [shift({ id: 'a', date: '2026-08-19' })],
      packaged.flags,
      HOLIDAYS_2026,
    ).map((w) => w.text)

    expect(packaged.flags.some((f) => f.kind === 'packaging-help-interaction')).toBe(
      true,
    )
    expect(texts).toEqual([])
  })
})
