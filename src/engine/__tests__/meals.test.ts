/**
 * The overtime meal allowance — EBA N36, and the four N36.3 windows.
 *
 * Every case here is a statement about the rule rather than about a dollar
 * figure, so the rate is a round $10 wherever the total is what is being
 * checked: three occasions being $30 says "three occasions" more plainly than
 * $106.14 does. The Annex C figure itself is `data/`'s business and is asserted
 * in `reference-data.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import { calculateOvertime, priceAttendance } from '../attendance'
import { MEAL_PERIODS, mealAllowanceFor, mealOccasionsFor } from '../meals'
import type { Attendance } from '../attendance'
import type { OtShift, ShiftKind } from '../types'
import { AP1_STEP_2, HOLIDAYS_2026, NO_HOLIDAYS, shift } from './fixtures'

const RATE = 10

/** One shift, grouped and priced, ready for the N36 test. */
function attendance(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind = 'separate',
): Attendance {
  return priceAttendance([shift(date, start, end, kind)], AP1_STEP_2, HOLIDAYS_2026)
}

/** The windows an attendance earned, as `'12:00–14:00'` strings. */
function windows(...shifts: OtShift[]): string[] {
  const clock = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  const priced = calculateOvertime(shifts, AP1_STEP_2, HOLIDAYS_2026).attendances
  return mealAllowanceFor(priced, RATE).occasions.map(
    (occasion) => `${clock(occasion.startMin)}–${clock(occasion.endMin)}`,
  )
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

  it('is in clock order, which is the order occasions come out in', () => {
    const starts = MEAL_PERIODS.map((period) => period.startMin)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
  })
})

describe('mealOccasionsFor — what qualifies', () => {
  it('pays for overtime worked past the end of a meal period', () => {
    // Wednesday 17:00–20:00: through the 18:00–19:00 window and out the far
    // side, no break.
    expect(windows(shift('2026-08-19', '17:00', '20:00', 'overrun'))).toEqual([
      '18:00–19:00',
    ])
  })

  it('pays for overtime that finishes exactly as the meal period closes', () => {
    // "to the completion of ... a meal period" — reaching the end is enough.
    // The whole window was worked, so there was no chance to eat in it.
    expect(windows(shift('2026-08-19', '17:00', '19:00', 'overrun'))).toEqual([
      '18:00–19:00',
    ])
  })

  it('pays nothing when the overtime stops part-way through the window', () => {
    // Knocking off at 18:30 leaves half the dinner window free.
    expect(windows(shift('2026-08-19', '17:00', '18:30', 'overrun'))).toEqual([])
  })

  it('pays nothing for overtime that never reaches a window', () => {
    // The §4.5 Wednesday overrun: 09:00–11:00 starts as the 07:00–09:00 window
    // closes and ends before noon.
    expect(windows(shift('2026-08-19', '09:00', '11:00', 'overrun'))).toEqual([])
  })

  it('pays nothing for overtime that starts after the window has closed', () => {
    expect(windows(shift('2026-08-19', '14:00', '17:00', 'overrun'))).toEqual([])
  })

  it('pays one for each subsequent meal period, not one per attendance', () => {
    // A fourteen-hour Saturday pickup across all three daytime windows.
    expect(windows(shift('2026-08-15', '06:00', '20:00'))).toEqual([
      '07:00–09:00',
      '12:00–14:00',
      '18:00–19:00',
    ])
  })

  it('counts the midnight window on the day it falls, not the day the shift started', () => {
    // A night pickup, Saturday 21:00 to Sunday 07:00. It works through
    // Sunday's midnight–01:00 window and finishes exactly as Sunday's
    // 07:00–09:00 window opens, so only the first is earned.
    const night = calculateOvertime(
      [shift('2026-08-15', '21:00', '07:00')],
      AP1_STEP_2,
      HOLIDAYS_2026,
    ).attendances[0]

    const occasions = mealOccasionsFor(night, RATE)
    expect(occasions).toHaveLength(1)
    expect(occasions[0].date).toBe('2026-08-16')
    expect(occasions[0].startMin).toBe(0)
    expect(occasions[0].endMin).toBe(60)
  })

  it('does not care which shift kind it was', () => {
    // N36.2 covers the overrun; N37.2 lets a full overtime shift claim the same
    // entitlement. So unlike the C9.5 minimum, `kind` changes nothing here.
    const overrun = mealOccasionsFor(
      attendance('2026-08-19', '17:00', '20:00', 'overrun'),
      RATE,
    )
    const pickup = mealOccasionsFor(
      attendance('2026-08-19', '17:00', '20:00', 'separate'),
      RATE,
    )
    expect(overrun).toHaveLength(1)
    expect(pickup.map((o) => o.startMin)).toEqual(overrun.map((o) => o.startMin))
  })

  it('pays nothing on the four-hour minimum top-up, only on hours worked', () => {
    // A 17:30–18:15 call-in pays four hours under C9.5, but the overtime
    // *worked* stopped inside the dinner window. The top-up is money, not time
    // on the road, so it cannot carry the attendance through to 19:00.
    const short = attendance('2026-08-19', '17:30', '18:15', 'separate')
    expect(short.minimumApplied).toBe(true)
    expect(mealOccasionsFor(short, RATE)).toEqual([])
  })
})

describe('mealOccasionsFor — "without a break for a meal"', () => {
  it('pays nothing for a window an unpaid break fell in', () => {
    // Two entries an hour apart are one attendance under C9.7, and that hour is
    // unpaid — which is exactly the break N36.2 excludes. 12:30–13:30 sits
    // inside the lunch window, so lunch pays nothing while dinner still does.
    expect(
      windows(
        shift('2026-08-19', '11:00', '12:30', 'overrun'),
        shift('2026-08-19', '13:30', '20:00', 'overrun'),
      ),
    ).toEqual(['18:00–19:00'])
  })

  it('still pays when the break falls outside every window', () => {
    // Same two entries, break moved to 15:30–16:30. Lunch was worked through.
    expect(
      windows(
        shift('2026-08-19', '11:00', '15:30', 'overrun'),
        shift('2026-08-19', '16:30', '20:00', 'overrun'),
      ),
    ).toEqual(['12:00–14:00', '18:00–19:00'])
  })

  it('treats a gap over an hour as two attendances, each judged on its own', () => {
    // Over 60 minutes and the engine starts a new attendance, so there is no
    // break *inside* either one. The second attendance works dinner through.
    expect(
      windows(
        shift('2026-08-19', '11:00', '12:30', 'overrun'),
        shift('2026-08-19', '14:00', '20:00', 'separate'),
      ),
    ).toEqual(['18:00–19:00'])
  })
})

describe('mealAllowanceFor', () => {
  const shifts = [
    shift('2026-08-15', '09:00', '19:00'),
    shift('2026-08-19', '18:00', '20:00', 'overrun'),
  ]
  const priced = calculateOvertime(shifts, AP1_STEP_2, HOLIDAYS_2026).attendances

  it('multiplies the rate by the occasions and reports both', () => {
    const result = mealAllowanceFor(priced, RATE)
    expect(result.occasions).toHaveLength(3)
    expect(result.total).toBe(30)
    expect(result.ratePerOccasion).toBe(RATE)
  })

  it('tags each occasion with the attendance that earned it', () => {
    const result = mealAllowanceFor(priced, RATE)
    expect(result.occasions.map((o) => o.shiftIds)).toEqual([
      [shifts[0].id],
      [shifts[0].id],
      [shifts[1].id],
    ])
  })

  it('is zero for a fortnight with no overtime at all', () => {
    const result = mealAllowanceFor([], RATE)
    expect(result.occasions).toEqual([])
    expect(result.total).toBe(0)
  })

  it('is unaffected by the holiday calendar', () => {
    // A public holiday pays 2.5× and changes the categories, but N36 turns on
    // the clock alone — there is no weekend or holiday variant of the windows.
    const holiday = calculateOvertime(
      [shift('2026-08-15', '06:00', '20:00')],
      AP1_STEP_2,
      NO_HOLIDAYS,
    ).attendances
    expect(mealAllowanceFor(holiday, RATE).total).toBe(
      mealAllowanceFor(
        calculateOvertime([shift('2026-08-15', '06:00', '20:00')], AP1_STEP_2, HOLIDAYS_2026)
          .attendances,
        RATE,
      ).total,
    )
  })
})
