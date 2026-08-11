/**
 * The overtime meal allowance — EBA N36, as ACTAS applies it.
 *
 * **A 10-hour shift that runs an hour or more over earns one allowance.** That
 * is the whole rule, so the cases here are organised around its three edges: the
 * shift length, the hour, and whether the shift can be placed at all. Nothing
 * turns on the N36.3 meal periods or on whether a break was taken — the two
 * readings that did are in `IMPLEMENTATION_PLAN.md` §3.11 and both disagreed
 * with payroll.
 *
 * The roster patterns are the real table, because the boundary is placed from
 * them and a hand-written stand-in would test a roster nobody works:
 *
 *   AM 06:30–16:30 (10h)   D 09:00–21:00 (12h)
 *   PM 11:00–23:00 (12h)   N 21:00–07:00 (10h)
 */

import { describe, expect, it } from 'vitest'
import { calculateOvertime } from '../attendance'
import {
  MEAL_ALLOWANCE_OVERRUN_MINUTES,
  MEAL_ALLOWANCE_SHIFT_MINUTES,
  MEAL_PERIODS,
  dutyFor,
  mealAllowanceFor,
  rosterDuration,
} from '../meals'
import type { MealAllowanceSettings } from '../meals'
import type { OtShift, ShiftKind } from '../types'
import {
  AP1_STEP_2,
  HOLIDAYS_2026,
  MEAL_SETTINGS,
  NO_HOLIDAYS,
  NO_ROSTER,
  shift,
} from './fixtures'

const RATE: MealAllowanceSettings = { ...MEAL_SETTINGS, ratePerOccasion: 10 }

/** Wednesday 19 August 2026 and the Thursday after it — ordinary weekdays. */
const WED = '2026-08-19'
const THU = '2026-08-20'

function priced(...shifts: OtShift[]) {
  return calculateOvertime(shifts, AP1_STEP_2, HOLIDAYS_2026).attendances
}

/** What one entry earns, in dollars, at $10 an occasion. */
function earns(
  date: string,
  start: string,
  end: string,
  kind: ShiftKind,
  settings: MealAllowanceSettings = RATE,
): number {
  return mealAllowanceFor(priced(shift(date, start, end, kind)), settings).total
}

describe('the thresholds', () => {
  it('are ten hours and one hour', () => {
    // Operational, not clause text — the same footing as the midnight ratchet.
    // N35.7 gives a 10-hour shift one Window of Opportunity, so a second break
    // falls due once it passes eleven hours.
    expect(MEAL_ALLOWANCE_SHIFT_MINUTES).toBe(600)
    expect(MEAL_ALLOWANCE_OVERRUN_MINUTES).toBe(60)
  })

  it('match the two 10-hour roster patterns', () => {
    const byLength = MEAL_SETTINGS.rosterShifts.map((p) => [
      p.code,
      rosterDuration(p),
    ])
    expect(byLength).toEqual([
      ['AM', 600],
      ['D', 720],
      ['PM', 720],
      ['N', 600],
    ])
  })
})

describe('MEAL_PERIODS', () => {
  // Kept as transcribed source with nothing reading it, like `PACKAGING_CAPS`.
  // The tests stay because they guard the transcription, not the money.
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
    // (1700–1900) against its second meal period (1800–1900) is the near-miss
    // that makes these two easy to conflate.
    expect(MEAL_PERIODS).not.toContainEqual({ startMin: 17 * 60, endMin: 19 * 60 })
    expect(MEAL_PERIODS).toContainEqual({ startMin: 18 * 60, endMin: 19 * 60 })
  })

  it('does not change the answer', () => {
    // The load-bearing property, since two earlier readings turned on these
    // windows. A 16:30–17:30 AM overrun crosses none of them and still earns;
    // a 12-hour D pickup crosses two of them and earns nothing.
    expect(earns(WED, '16:30', '17:30', 'overrun')).toBe(10)
    expect(earns(WED, '09:00', '22:00', 'separate')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// The hour
// ---------------------------------------------------------------------------

describe('the overrun has to reach an hour', () => {
  it.each([
    ['30 minutes', '17:00', 0],
    ['59 minutes', '17:29', 0],
    ['exactly an hour', '17:30', 10],
    ['an hour and a half', '18:00', 10],
    ['four hours', '20:30', 10],
  ])('%s past an AM shift earns %s', (_label, end, expected) => {
    expect(earns(WED, '16:30', end, 'overrun')).toBe(expected)
  })

  it('pays once and only once, however far over', () => {
    // "You only get a single allowance" — the count does not scale with the
    // overrun, and it does not scale with how many meal periods were crossed.
    const long = mealAllowanceFor(priced(shift(WED, '16:30', '23:30', 'overrun')), RATE)
    expect(long.occasions).toHaveLength(1)
    expect(long.total).toBe(10)
  })

  it('counts minutes worked, not elapsed', () => {
    // Two entries with an unpaid hour between them: 16:30–16:55 and 17:55–18:20
    // is nearly two hours on the clock but only fifty minutes of duty. The gap
    // is not time on the road, and C9.7 keeps it one attendance.
    const split = priced(
      shift(WED, '16:30', '16:55', 'overrun'),
      shift(WED, '17:55', '18:20', 'overrun'),
    )
    expect(split).toHaveLength(1)
    expect(split[0].workedMinutes).toBe(50)
    expect(mealAllowanceFor(split, RATE).total).toBe(0)
  })

  it('is not bought by the C9.5 four-hour minimum', () => {
    // A 30-minute call-in from the AM start pays four hours and still only kept
    // you there for thirty minutes. Pricing off `paidMinutes` would invent an
    // allowance out of a minimum payment.
    const [attendance] = priced(shift(WED, '06:30', '07:00', 'separate'))
    expect(attendance.minimumApplied).toBe(true)
    expect(attendance.paidMinutes).toBe(240)
    expect(mealAllowanceFor([attendance], RATE).total).toBe(0)
  })
})

describe('a shift worked to time earns nothing', () => {
  it.each([
    ['AM', '06:30', '16:30'],
    ['D', '09:00', '21:00'],
    ['PM', '11:00', '23:00'],
    ['N', '21:00', '07:00'],
  ])('%s finished on time pays no allowance', (_code, start, end) => {
    // Break or no break: the system takes the break you were due as given, so
    // there is nothing owed until a second one falls due.
    expect(earns(WED, start, end, 'separate')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// The shift length
// ---------------------------------------------------------------------------

describe('only 10-hour shifts are in the rule', () => {
  it('pays on an AM overrun and an N overrun', () => {
    expect(earns(WED, '16:30', '17:30', 'overrun')).toBe(10)
    expect(earns(THU, '07:00', '08:00', 'overrun')).toBe(10)
  })

  it('pays nothing on a D or PM overrun, however long', () => {
    // A 12-hour pattern gets two Windows of Opportunity under N35.7, so a
    // second break is not owed at the same point. See §3.11 — this is the one
    // part of the rule Phase 10 still has to confirm.
    expect(earns(WED, '21:00', '22:00', 'overrun')).toBe(0)
    expect(earns(WED, '21:00', '02:00', 'overrun')).toBe(0)
    expect(earns(WED, '23:00', '03:00', 'overrun')).toBe(0)
  })

  it('pays nothing on a picked-up 12-hour shift that ran over', () => {
    expect(earns(WED, '09:00', '23:00', 'separate')).toBe(0)
    expect(earns(WED, '11:00', '01:00', 'separate')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Placing the shift
// ---------------------------------------------------------------------------

describe('a picked-up shift is treated as a normal one', () => {
  it('pays when an AM entered whole runs an hour over', () => {
    // Oscar's case: the shift and its run-on typed as one period.
    expect(earns(WED, '06:30', '17:30', 'separate')).toBe(10)
  })

  it('pays when an N entered whole runs an hour over', () => {
    expect(earns(WED, '21:00', '08:00', 'separate')).toBe(10)
  })

  it('needs the full hour, same as an overrun', () => {
    expect(earns(WED, '06:30', '17:29', 'separate')).toBe(0)
  })

  it('reaches the same answer as the equivalent overrun', () => {
    // 06:30–17:30 entered whole versus a 16:30–17:30 overrun with the shift
    // inferred. Same duty, so the same allowance — the two routes must not
    // disagree about a shift a user could reasonably enter either way.
    expect(earns(WED, '06:30', '17:30', 'separate')).toBe(
      earns(WED, '16:30', '17:30', 'overrun'),
    )
  })
})

describe('times that match no roster pattern', () => {
  it('are dropped silently rather than guessed at', () => {
    // Guessing a boundary from an unrecognised time would invent the one fact
    // the rule turns on. Oscar's call: no allowance, no warning.
    expect(earns(WED, '07:15', '19:00', 'separate')).toBe(0)
    expect(earns(WED, '18:00', '20:00', 'overrun')).toBe(0)
    expect(earns(WED, '16:00', '18:00', 'overrun')).toBe(0)
  })

  it('drop everything when the roster table is empty', () => {
    expect(earns(WED, '16:30', '18:00', 'overrun', NO_ROSTER)).toBe(0)
  })

  it('do not let a pickup borrow a shift by its end time', () => {
    // 16:30 is the AM shift's *end*. A standalone attendance starting there is a
    // late pickup with no ordinary duty before it, not an AM shift.
    expect(earns(WED, '16:30', '22:00', 'separate')).toBe(0)
  })
})

describe('the C9.5 kind disambiguates 21:00', () => {
  // 21:00 is both the D shift's end and the N shift's start, and it is the only
  // collision in the table. The kind is what tells them apart — and here it
  // decides the money, because D is 12 hours and N is 10.
  it('reads an overrun at 21:00 as running on from the D shift', () => {
    const [attendance] = priced(shift(WED, '21:00', '22:00', 'overrun'))
    const duty = dutyFor(attendance, MEAL_SETTINGS.rosterShifts)
    expect(duty?.rosterCode).toBe('D')
    expect(duty?.rosteredMinutes).toBe(720)
    expect(duty?.shiftInferred).toBe(true)
  })

  it('reads a separate attendance at 21:00 as a picked-up N shift', () => {
    const [attendance] = priced(shift(WED, '21:00', '08:00', 'separate'))
    const duty = dutyFor(attendance, MEAL_SETTINGS.rosterShifts)
    expect(duty?.rosterCode).toBe('N')
    expect(duty?.rosteredMinutes).toBe(600)
    expect(duty?.shiftInferred).toBe(false)
    expect(duty?.overrunMinutes).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// The aggregate
// ---------------------------------------------------------------------------

describe('mealAllowanceFor', () => {
  const shifts = [
    shift(WED, '06:30', '18:00', 'separate'),
    shift(THU, '07:00', '09:00', 'overrun'),
  ]

  it('pays one per qualifying attendance and reports the rate', () => {
    const result = mealAllowanceFor(priced(...shifts), RATE)
    expect(result.occasions).toHaveLength(2)
    expect(result.total).toBe(20)
    expect(result.ratePerOccasion).toBe(10)
  })

  it('tags each occasion with the attendance and the shift behind it', () => {
    const result = mealAllowanceFor(priced(...shifts), RATE)
    expect(
      result.occasions.map((o) => [
        o.shiftIds[0],
        o.rosterCode,
        o.shiftInferred,
        o.rosteredMinutes,
        o.overrunMinutes,
      ]),
    ).toEqual([
      [shifts[0].id, 'AM', false, 600, 90],
      [shifts[1].id, 'N', true, 600, 120],
    ])
  })

  it('dates the occasion where the overtime was worked', () => {
    // The N overrun is entered on the Thursday even though its shift began on
    // the Wednesday, because the Thursday is where the extra hours happened —
    // and it is what a payslip's date-prefixed sub-row would carry.
    const result = mealAllowanceFor(priced(shifts[1]), RATE)
    expect(result.occasions[0].date).toBe(THU)
  })

  it('is zero for a fortnight with no overtime at all', () => {
    const result = mealAllowanceFor([], RATE)
    expect(result.occasions).toEqual([])
    expect(result.total).toBe(0)
  })

  it('is unaffected by the holiday calendar', () => {
    // A public holiday pays 2.5× and changes the categories, but the allowance
    // turns on the roster and the clock alone.
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
    expect(withHolidays.total).toBe(10)
  })
})
