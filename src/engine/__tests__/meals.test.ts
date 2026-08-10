/**
 * The overtime meal allowance — EBA N36, and the two phrases that decide it.
 *
 * The cases are organised around the two gates rather than around figures, so
 * the rate is a round $10 wherever a total is what is being checked: three
 * occasions being $30 says "three occasions" more plainly than $106.14 does. The
 * Annex C figure itself is `data/`'s business and is asserted in
 * `reference-data.test.ts`.
 *
 * The roster patterns are the real AM/D/PM/N table, because N36.2's boundary is
 * placed from them and a hand-written stand-in would test a roster nobody works:
 *
 *   AM 06:30–16:30   D 09:00–21:00   PM 11:00–23:00   N 21:00–07:00
 */

import { describe, expect, it } from 'vitest'
import { calculateOvertime } from '../attendance'
import { MEAL_PERIODS, dutyFor, mealAllowanceFor, rosterDuration } from '../meals'
import type { MealAllowanceSettings } from '../meals'
import type { OtShift, ShiftKind } from '../types'
import {
  AP1_STEP_2,
  HOLIDAYS_2026,
  MEAL_SETTINGS,
  NO_ROSTER,
  NO_HOLIDAYS,
  shift,
} from './fixtures'

const RATE: MealAllowanceSettings = { ...MEAL_SETTINGS, ratePerOccasion: 10 }

/** Wednesday 19 August 2026 and the Thursday after it — ordinary weekdays. */
const WED = '2026-08-19'
const THU = '2026-08-20'

function priced(...shifts: OtShift[]) {
  return calculateOvertime(shifts, AP1_STEP_2, HOLIDAYS_2026).attendances
}

/** The windows an entry earned, as `'12:00–14:00'` strings. */
function windows(
  shifts: OtShift[],
  settings: MealAllowanceSettings = RATE,
): string[] {
  const clock = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  return mealAllowanceFor(priced(...shifts), settings).occasions.map(
    (o) => `${clock(o.startMin)}–${clock(o.endMin)}`,
  )
}

/** One entry, priced and asked for its windows. */
function one(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind,
  settings?: MealAllowanceSettings,
): string[] {
  return windows([shift(date, start, end, kind)], settings)
}

describe('MEAL_PERIODS', () => {
  it('is N36.3 verbatim — midnight–1am, 7–9am, noon–2pm, 6–7pm', () => {
    expect(MEAL_PERIODS).toEqual([
      { startMin: 0, endMin: 60 },
      { startMin: 7 * 60, endMin: 9 * 60 },
      { startMin: 12 * 60, endMin: 14 * 60 },
      { startMin: 18 * 60, endMin: 19 * 60 },
    ])
  })

  it('is not N35.7 — the break windows are a different set of times', () => {
    // N35.7's Windows of Opportunity are AM 0930–1130, D 1200–1400 & 1700–1900,
    // PM 1400–1600 & 1900–2200, N 0000–0200. The D shift's second break window
    // (1700–1900) and its second meal period (1800–1900) are the near-miss that
    // makes these two easy to conflate, so the difference is pinned here.
    expect(MEAL_PERIODS).not.toContainEqual({ startMin: 17 * 60, endMin: 19 * 60 })
    expect(MEAL_PERIODS).toContainEqual({ startMin: 18 * 60, endMin: 19 * 60 })
  })
})

describe('rosterDuration', () => {
  it('handles the overnight pattern', () => {
    expect(rosterDuration({ code: 'AM', startMin: 390, endMin: 990 })).toBe(600)
    expect(rosterDuration({ code: 'N', startMin: 1260, endMin: 420 })).toBe(600)
  })
})

// ---------------------------------------------------------------------------
// Gate 1 — "after the end of ordinary duty for the day"
// ---------------------------------------------------------------------------

describe('a bare pickup earns nothing', () => {
  it.each([
    ['AM', '06:30', '16:30'],
    ['D', '09:00', '21:00'],
    ['PM', '11:00', '23:00'],
    ['N', '21:00', '07:00'],
  ])('%s worked to its rostered end pays no allowance', (_code, start, end) => {
    // The whole shift is overtime, but none of it is overtime worked *after* the
    // end of ordinary duty for the day — you knocked off on time. N36.2 cannot
    // reach it, and Annex C needs an unpaid meal break this cohort does not take.
    expect(one(WED, start, end, 'separate')).toEqual([])
  })

  it('pays nothing for a pickup that finishes early', () => {
    expect(one(WED, '09:00', '19:00', 'separate')).toEqual([])
  })

  it('pays nothing on the C9.5 four-hour minimum', () => {
    // A 90-minute call-in from the AM start pays four hours, and still never
    // reaches the end of the shift it started. The top-up is money, not time on
    // the road, so it cannot carry the duty past a boundary.
    const [attendance] = priced(shift(WED, '06:30', '08:00', 'separate'))
    expect(attendance.minimumApplied).toBe(true)
    expect(one(WED, '06:30', '08:00', 'separate')).toEqual([])
  })
})

describe('an overrun earns one, however short', () => {
  it.each([
    ['AM', '16:30', ['07:00–09:00', '12:00–14:00']],
    ['D', '21:00', ['12:00–14:00', '18:00–19:00']],
    ['PM', '23:00', ['12:00–14:00', '18:00–19:00']],
  ])(
    'a one-hour overrun on the %s shift pays for the periods the shift worked through',
    (_code, start, expected) => {
      // The shift itself is never entered — only the overtime is — so the duty is
      // reconstructed backwards from the boundary. That is what puts the shift's
      // own meal periods inside it, and is the whole reason an hour qualifies.
      const end = start === '23:00' ? '00:00' : addHour(start)
      expect(one(WED, start, end, 'overrun')).toEqual(expected)
    },
  )

  it('credits the night shift its midnight period, on the day it fell', () => {
    // N runs 21:00 Wednesday to 07:00 Thursday, so the overrun is entered on the
    // Thursday and the duty reaches back into the Wednesday.
    const occasions = mealAllowanceFor(
      priced(shift(THU, '07:00', '08:00', 'overrun')),
      RATE,
    ).occasions

    expect(occasions).toHaveLength(1)
    expect(occasions[0].date).toBe(THU)
    expect(occasions[0].startMin).toBe(0)
    expect(occasions[0].endMin).toBe(60)
    // 07:00–09:00 is not earned: the duty stopped at 08:00, inside the window.
  })

  it('does not pay for a period the duty stopped part-way through', () => {
    // An AM overrun to 18:30 has worked half of the 18:00–19:00 period and can
    // still eat in the other half.
    expect(one(WED, '16:30', '18:30', 'overrun')).toEqual([
      '07:00–09:00',
      '12:00–14:00',
    ])
  })

  it('pays for a period the duty was still running as it closed', () => {
    expect(one(WED, '16:30', '19:00', 'overrun')).toEqual([
      '07:00–09:00',
      '12:00–14:00',
      '18:00–19:00',
    ])
  })
})

describe('a pickup that ran on, entered as one period', () => {
  it('pays once it runs past the end of the shift it was', () => {
    // Oscar's case: an AM picked up and entered as 06:30–18:00. Every minute is
    // overtime, but N36.2 still needs an end-of-ordinary-duty to sit after, and
    // the shift's own 16:30 is the only candidate.
    expect(one(WED, '06:30', '18:00', 'separate')).toEqual([
      '07:00–09:00',
      '12:00–14:00',
    ])
  })

  it('picks up the evening period when it runs far enough', () => {
    expect(one(WED, '06:30', '19:00', 'separate')).toEqual([
      '07:00–09:00',
      '12:00–14:00',
      '18:00–19:00',
    ])
  })

  it('needs only a minute past the boundary', () => {
    expect(one(WED, '06:30', '16:31', 'separate')).toEqual([
      '07:00–09:00',
      '12:00–14:00',
    ])
  })

  it('reaches the same answer as the equivalent overrun', () => {
    // 06:30–18:00 entered whole, versus a 16:30–18:00 overrun with the shift
    // inferred. Same duty, so the same allowance — the two routes must not
    // disagree about a shift a user could reasonably enter either way.
    expect(one(WED, '06:30', '18:00', 'separate')).toEqual(
      one(WED, '16:30', '18:00', 'overrun'),
    )
  })
})

describe('times that match no roster pattern', () => {
  it('are dropped silently rather than guessed at', () => {
    // Guessing a boundary from an unrecognised time would be inventing the one
    // fact the clause turns on. Oscar's call: no allowance, no warning.
    expect(one(WED, '07:15', '19:00', 'separate')).toEqual([])
    expect(one(WED, '18:00', '20:00', 'overrun')).toEqual([])
    expect(one(WED, '16:00', '18:00', 'overrun')).toEqual([])
  })

  it('drop everything when the roster table is empty', () => {
    expect(one(WED, '16:30', '18:00', 'overrun', NO_ROSTER)).toEqual([])
  })

  it('do not let a pickup borrow a shift by its end time', () => {
    // 16:30 is the AM shift's *end*. A standalone attendance starting there is a
    // late pickup with no ordinary duty before it, not an AM shift.
    expect(one(WED, '16:30', '22:00', 'separate')).toEqual([])
  })
})

describe('the C9.5 kind disambiguates 21:00', () => {
  // 21:00 is both the D shift's end and the N shift's start, and it is the only
  // collision in the table. The kind is what tells them apart.
  it('reads an overrun at 21:00 as running on from the D shift', () => {
    const [duty] = priced(shift(WED, '21:00', '22:00', 'overrun'))
    expect(dutyFor(duty, MEAL_SETTINGS.rosterShifts)?.rosterCode).toBe('D')
  })

  it('reads a separate attendance at 21:00 as a picked-up N shift', () => {
    const [duty] = priced(shift(WED, '21:00', '08:00', 'separate'))
    const placed = dutyFor(duty, MEAL_SETTINGS.rosterShifts)
    expect(placed?.rosterCode).toBe('N')
    expect(placed?.shiftInferred).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Gate 2 — "without a break for a meal"
// ---------------------------------------------------------------------------

describe('a break the app can see suppresses its own period', () => {
  it('drops the period an unpaid gap fell in, and no other', () => {
    // Two entries an hour apart are one attendance under C9.7, and that hour is
    // unpaid — the break N36.2 excludes. 12:30–13:30 sits inside lunch, so lunch
    // pays nothing while breakfast still does.
    expect(
      windows([
        shift(WED, '06:30', '12:30', 'separate'),
        shift(WED, '13:30', '18:00', 'separate'),
      ]),
    ).toEqual(['07:00–09:00'])
  })

  it('leaves both periods when the break falls outside them', () => {
    expect(
      windows([
        shift(WED, '06:30', '15:00', 'separate'),
        shift(WED, '16:00', '18:00', 'separate'),
      ]),
    ).toEqual(['07:00–09:00', '12:00–14:00'])
  })

  it('drops a period a break in the overtime fell in', () => {
    // An AM overrun taken in two pieces with the gap over dinner.
    expect(
      windows([
        shift(WED, '16:30', '17:30', 'overrun'),
        shift(WED, '18:30', '20:00', 'overrun'),
      ]),
    ).toEqual(['07:00–09:00', '12:00–14:00'])
  })
})

// ---------------------------------------------------------------------------
// The aggregate
// ---------------------------------------------------------------------------

describe('mealAllowanceFor', () => {
  const shifts = [
    shift(WED, '06:30', '18:00', 'separate'),
    shift(THU, '21:00', '22:00', 'overrun'),
  ]

  it('multiplies the rate by the occasions and reports both', () => {
    const result = mealAllowanceFor(priced(...shifts), RATE)
    expect(result.occasions).toHaveLength(4)
    expect(result.total).toBe(40)
    expect(result.ratePerOccasion).toBe(10)
  })

  it('tags each occasion with the attendance and the shift behind it', () => {
    const result = mealAllowanceFor(priced(...shifts), RATE)
    expect(
      result.occasions.map((o) => [o.shiftIds[0], o.rosterCode, o.shiftInferred]),
    ).toEqual([
      [shifts[0].id, 'AM', false],
      [shifts[0].id, 'AM', false],
      [shifts[1].id, 'D', true],
      [shifts[1].id, 'D', true],
    ])
  })

  it('is zero for a fortnight with no overtime at all', () => {
    const result = mealAllowanceFor([], RATE)
    expect(result.occasions).toEqual([])
    expect(result.total).toBe(0)
  })

  it('is unaffected by the holiday calendar', () => {
    // A public holiday pays 2.5× and changes the categories, but N36 turns on the
    // clock and the roster alone — there is no weekend or holiday variant of the
    // windows, and no Saturday threshold of the kind Annex C carries.
    const entry = [shift('2026-08-15', '06:30', '18:00', 'separate')]
    const withHolidays = mealAllowanceFor(
      calculateOvertime(entry, AP1_STEP_2, HOLIDAYS_2026).attendances,
      RATE,
    )
    const without = mealAllowanceFor(
      calculateOvertime(entry, AP1_STEP_2, NO_HOLIDAYS).attendances,
      RATE,
    )
    expect(withHolidays.total).toBe(without.total)
    expect(withHolidays.total).toBe(20)
  })
})

/** `'16:30'` → `'17:30'`. Only used for the whole-hour overrun cases. */
function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
