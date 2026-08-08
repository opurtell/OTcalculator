import { describe, expect, it } from 'vitest'
import {
  attendanceSpan,
  categoriesWorked,
  categoriseAttendance,
  categoryHourlyRate,
  otHourlyRate,
  totalMinutes,
} from '../overtime'
import type { Interval, Segment } from '../types'
import { AP1_STEP_2, HOLIDAYS_2026, NO_HOLIDAYS } from './fixtures'

/** `[category, hours]` — how the assertions below read a segment list. */
function shape(segments: readonly Segment[]): [string, number][] {
  return segments.map((s) => [s.category, s.minutes / 60])
}

function hours(date: string, startHour: number, count: number): Interval {
  return { date, startMin: startHour * 60, durationMinutes: count * 60 }
}

describe('otHourlyRate', () => {
  // §4.5 quotes these truncated to four decimals rather than rounded — the
  // 2× rate is 96.550866 and the plan prints 96.5508 — so the comparison is to
  // three places. The engine carries full precision; only the display rounds.
  it.each([
    [1.5, 72.4131],
    [2, 96.5508],
    [2.5, 120.6885],
  ])('at %s× is about $%s/h', (multiplier, expected) => {
    expect(otHourlyRate(AP1_STEP_2.annualBase, multiplier)).toBeCloseTo(expected, 3)
  })

  it('matches the ordinary hourly rate in §4.5 at 1×', () => {
    expect(otHourlyRate(AP1_STEP_2.annualBase, 1)).toBeCloseTo(48.2754, 3)
  })

  it('uses the base salary, never the Annex A composite', () => {
    // The single most expensive mistake available in this codebase: the
    // composite is 34% higher and every downstream figure inherits the error.
    const correct = otHourlyRate(AP1_STEP_2.annualBase, 2)
    const wrong = otHourlyRate(AP1_STEP_2.annexATotal, 2)

    expect(correct).toBeCloseTo(96.5508, 3)
    expect(wrong / correct).toBeCloseTo(1.3158, 3)
    expect(categoryHourlyRate(AP1_STEP_2.annualBase, 'sat_2x')).toBe(correct)
  })

  it('scales linearly with the multiplier', () => {
    const base = otHourlyRate(AP1_STEP_2.annualBase, 1)
    expect(otHourlyRate(AP1_STEP_2.annualBase, 2)).toBeCloseTo(base * 2, 10)
  })
})

describe('categoriseAttendance — single day', () => {
  it('pays Saturday at 2× throughout', () => {
    // N34, not C9.12: Saturday is double time for all hours, with no 1.5× tier.
    const segments = categoriseAttendance([hours('2026-08-15', 9, 10)], HOLIDAYS_2026)
    expect(shape(segments)).toEqual([['sat_2x', 10]])
  })

  it('pays Sunday at 2× throughout', () => {
    const segments = categoriseAttendance([hours('2026-08-16', 9, 8)], HOLIDAYS_2026)
    expect(shape(segments)).toEqual([['sun_2x', 8]])
  })

  it('pays a public holiday at 2.5× for all hours', () => {
    const segments = categoriseAttendance([hours('2026-03-09', 9, 10)], HOLIDAYS_2026)
    expect(shape(segments)).toEqual([['ph_2_5x', 10]])
  })

  it('splits a weekday at two hours', () => {
    const segments = categoriseAttendance([hours('2026-08-19', 9, 5)], HOLIDAYS_2026)
    expect(shape(segments)).toEqual([
      ['mf_1_5x', 2],
      ['mf_2x', 3],
    ])
  })

  it('stays entirely at 1.5× for a short weekday attendance', () => {
    const segments = categoriseAttendance([hours('2026-08-19', 9, 2)], HOLIDAYS_2026)
    expect(shape(segments)).toEqual([['mf_1_5x', 2]])
  })

  it('treats the same Monday as a weekday when it is not a holiday', () => {
    expect(shape(categoriseAttendance([hours('2026-03-09', 9, 3)], NO_HOLIDAYS))).toEqual([
      ['mf_1_5x', 2],
      ['mf_2x', 1],
    ])
  })
})

describe('the midnight ratchet', () => {
  // Both examples are quoted verbatim in IMPLEMENTATION_PLAN.md §3.4. The
  // other five worked examples live in the sibling project's crossover doc and
  // should be added when that repo is to hand.

  it('carries Sunday 2× straight through into Monday', () => {
    // Sun 22:00 → Mon 06:00 pays all 8 hours at 2×, never dropping to 1.5×.
    const segments = categoriseAttendance(
      [{ date: '2026-08-16', startMin: 22 * 60, durationMinutes: 8 * 60 }],
      HOLIDAYS_2026,
    )

    expect(totalMinutes(segments)).toBe(8 * 60)
    expect(segments.every((s) => s.category === 'sun_2x' || s.category === 'mf_2x')).toBe(
      true,
    )
    expect(segments.some((s) => s.category === 'mf_1_5x')).toBe(false)
  })

  it('labels the carried Monday hours honestly once the weekday tier catches up', () => {
    // The rate is 2× for the whole attendance either way; the label switches at
    // Monday 02:00 because mf_2x ties the high-water mark and is the truthful
    // description of a Monday.
    const segments = categoriseAttendance(
      [{ date: '2026-08-16', startMin: 22 * 60, durationMinutes: 8 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['sun_2x', 4],
      ['mf_2x', 4],
    ])
  })

  it('does not reset the Mon–Fri two-hour counter at midnight', () => {
    // Mon 19:00 → Tue 03:00 is 2h at 1.5× then 6h at 2×. If the counter reset,
    // Tuesday would wrongly open with another two hours at 1.5×.
    const segments = categoriseAttendance(
      [{ date: '2026-08-17', startMin: 19 * 60, durationMinutes: 8 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['mf_1_5x', 2],
      ['mf_2x', 6],
    ])
  })

  it('carries a public holiday rate into the following weekday', () => {
    // Canberra Day 22:00 → Tuesday 06:00: 2.5× for all 8 hours.
    const segments = categoriseAttendance(
      [{ date: '2026-03-09', startMin: 22 * 60, durationMinutes: 8 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([['ph_2_5x', 8]])
  })

  it('lets the rate rise on the way into a public holiday', () => {
    // The ratchet is a floor, not a freeze — Sunday 22:00 into Canberra Day
    // 06:00 steps up to 2.5× at midnight.
    const segments = categoriseAttendance(
      [{ date: '2026-03-08', startMin: 22 * 60, durationMinutes: 8 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['sun_2x', 2],
      ['ph_2_5x', 6],
    ])
  })

  it('carries Saturday 2× into Sunday without a dip', () => {
    const segments = categoriseAttendance(
      [{ date: '2026-08-15', startMin: 22 * 60, durationMinutes: 6 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['sat_2x', 2],
      ['sun_2x', 4],
    ])
  })

  it('steps up from a weekday into Saturday', () => {
    // Fri 22:00 → Sat 04:00. Friday's first two hours are 1.5×, then 2×, and
    // Saturday cannot drop below that.
    const segments = categoriseAttendance(
      [{ date: '2026-08-14', startMin: 22 * 60, durationMinutes: 6 * 60 }],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['mf_1_5x', 2],
      ['sat_2x', 4],
    ])
  })
})

describe('categoriseAttendance — meal breaks', () => {
  it('emits no segments for an unpaid gap but carries the counter across it', () => {
    // Two hours, 30 minutes off, two more hours on a weekday. The counter is at
    // 120 when the second interval opens, so all of it is 2× — the break does
    // not buy a second helping of 1.5×.
    const segments = categoriseAttendance(
      [hours('2026-08-19', 9, 2), { date: '2026-08-19', startMin: 11 * 60 + 30, durationMinutes: 120 }],
      HOLIDAYS_2026,
    )

    expect(totalMinutes(segments)).toBe(4 * 60)
    expect(shape(segments)).toEqual([
      ['mf_1_5x', 2],
      ['mf_2x', 2],
    ])
  })

  it('does not run the counter during the break itself', () => {
    // 90 minutes on, 30 off, 90 on. Only worked minutes count toward the first
    // two hours, so 30 minutes of the second interval are still at 1.5×.
    const segments = categoriseAttendance(
      [
        { date: '2026-08-19', startMin: 9 * 60, durationMinutes: 90 },
        { date: '2026-08-19', startMin: 11 * 60, durationMinutes: 90 },
      ],
      HOLIDAYS_2026,
    )
    expect(shape(segments)).toEqual([
      ['mf_1_5x', 1.5],
      ['mf_1_5x', 0.5],
      ['mf_2x', 1],
    ])
  })
})

describe('categoriesWorked', () => {
  it('lists categories once, in the order first worked', () => {
    const segments = categoriseAttendance([hours('2026-08-19', 9, 5)], HOLIDAYS_2026)
    expect(categoriesWorked(segments)).toEqual(['mf_1_5x', 'mf_2x'])
  })
})

describe('attendanceSpan', () => {
  it('reports a same-day attendance', () => {
    const span = attendanceSpan([hours('2026-08-15', 9, 10)])
    expect(span).toMatchObject({
      startDate: '2026-08-15',
      endDate: '2026-08-15',
      endMin: 19 * 60,
      crossesMidnight: false,
    })
    expect(span.dates).toEqual(['2026-08-15'])
  })

  it('reports an attendance that crosses midnight inside one segment', () => {
    // The case the segment list alone cannot answer: Sunday 22:00 → Monday
    // 01:00 is a single carried sun_2x segment dated Sunday, but it touches
    // two days and the flags need both.
    const span = attendanceSpan([
      { date: '2026-08-16', startMin: 22 * 60, durationMinutes: 3 * 60 },
    ])
    expect(span.crossesMidnight).toBe(true)
    expect(span.dates).toEqual(['2026-08-16', '2026-08-17'])
    expect(span.endDate).toBe('2026-08-17')
    expect(span.endMin).toBe(60)
  })

  it('treats an attendance ending at midnight as belonging to the day worked', () => {
    const span = attendanceSpan([
      { date: '2026-08-16', startMin: 20 * 60, durationMinutes: 4 * 60 },
    ])
    expect(span.crossesMidnight).toBe(false)
    expect(span.dates).toEqual(['2026-08-16'])
  })
})
