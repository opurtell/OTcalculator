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

/** `[date, category, hours]`, for the cases where the day carries meaning. */
function dated(segments: readonly Segment[]): [string, string, number][] {
  return segments.map((s) => [s.date, s.category, s.minutes / 60])
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

/**
 * All seven worked examples from the ACTAS Pay Tracker's crossover doc,
 * `main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md` §4.1–§4.7 — the
 * authoritative statement of the ratchet, since the EBA itself is silent.
 *
 * Assertions carry the date as well as the category: in several of these the
 * money is identical under a naive reading and only the labelling differs, and
 * the labelling is what has to match a payslip line item in Phase 10.
 */
describe('the midnight ratchet — crossover doc §4', () => {
  const run = (date: string, startHour: number, hours: number) =>
    dated(
      categoriseAttendance(
        [{ date, startMin: startHour * 60, durationMinutes: hours * 60 }],
        HOLIDAYS_2026,
      ),
    )

  it('§4.1 Sat→Sun — ties go to the calendar, so Sunday keeps its own label', () => {
    // 2× either side, so no money moves. The Sunday hours are still tagged
    // sun_2x rather than carrying the Saturday label forward.
    expect(run('2026-08-15', 22, 8)).toEqual([
      ['2026-08-15', 'sat_2x', 2],
      ['2026-08-16', 'sun_2x', 6],
    ])
  })

  it('§4.2 Sun→Mon — all 8h at 2×, Monday carried as sun_2x, never mf', () => {
    // The case the engine must get right. A plain EBA reading would pay 2h at
    // 1.5× in the middle; the ratchet suppresses that. And because the carried
    // minutes are not weekday-rate minutes, the two-hour counter never starts,
    // so the Monday hours never become mf_2x either.
    expect(run('2026-08-16', 22, 8)).toEqual([
      ['2026-08-16', 'sun_2x', 2],
      ['2026-08-17', 'sun_2x', 6],
    ])
  })

  it('§4.3 PH→weekday — all 8h at 2.5×', () => {
    // Canberra Day 2026 is Monday the 9th of March.
    expect(run('2026-03-09', 22, 8)).toEqual([
      ['2026-03-09', 'ph_2_5x', 2],
      ['2026-03-10', 'ph_2_5x', 6],
    ])
  })

  it('§4.4 PH→Sunday — the Sunday hours carry at 2.5×, not 2×', () => {
    // Easter Saturday 2027 is a public holiday falling on the 27th of March,
    // running into the Sunday. Boxing Day 2026 would not do: it lands on a
    // Saturday and is observed on the Monday instead.
    expect(run('2027-03-27', 22, 8)).toEqual([
      ['2027-03-27', 'ph_2_5x', 2],
      ['2027-03-28', 'ph_2_5x', 6],
    ])
  })

  it('§4.5 Sat→Sun→Mon — implausible but it pins the state machine', () => {
    expect(run('2026-08-15', 20, 34)).toEqual([
      ['2026-08-15', 'sat_2x', 4],
      ['2026-08-16', 'sun_2x', 24],
      ['2026-08-17', 'sun_2x', 6],
    ])
  })

  it('§4.6 within Mon–Fri across midnight — the counter does not reset', () => {
    // Mon 19:00 → Tue 03:00. If the counter reset at midnight, Tuesday would
    // wrongly open with another two hours at 1.5×.
    expect(run('2026-08-17', 19, 8)).toEqual([
      ['2026-08-17', 'mf_1_5x', 2],
      ['2026-08-17', 'mf_2x', 3],
      ['2026-08-18', 'mf_2x', 3],
    ])
  })

  it('§4.7 Mon→Tue starting close to midnight — the counter is cumulative', () => {
    // Mon 23:00 → Tue 03:00 splits 2h/2h, with the 1.5× tier straddling
    // midnight rather than restarting on the Tuesday.
    expect(run('2026-08-17', 23, 4)).toEqual([
      ['2026-08-17', 'mf_1_5x', 1],
      ['2026-08-18', 'mf_1_5x', 1],
      ['2026-08-18', 'mf_2x', 2],
    ])
  })

  it('lets the rate rise on the way into a public holiday', () => {
    // Not from the doc: the ratchet is a floor, not a freeze. Sunday 22:00 into
    // Canberra Day steps up to 2.5× at midnight.
    expect(run('2026-03-08', 22, 8)).toEqual([
      ['2026-03-08', 'sun_2x', 2],
      ['2026-03-09', 'ph_2_5x', 6],
    ])
  })

  it('steps up from a weekday into Saturday', () => {
    expect(run('2026-08-14', 22, 6)).toEqual([
      ['2026-08-14', 'mf_1_5x', 2],
      ['2026-08-15', 'sat_2x', 4],
    ])
  })

  it('pays every minute exactly once in all of the above', () => {
    for (const [date, startHour, hours] of [
      ['2026-08-15', 22, 8],
      ['2026-08-16', 22, 8],
      ['2026-08-15', 20, 34],
      ['2026-08-17', 23, 4],
    ] as const) {
      const segments = categoriseAttendance(
        [{ date, startMin: startHour * 60, durationMinutes: hours * 60 }],
        HOLIDAYS_2026,
      )
      expect(totalMinutes(segments)).toBe(hours * 60)
    }
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

  it('reports an attendance that crosses midnight', () => {
    // Sunday 22:00 → Monday 01:00 carries at 2× throughout, so the category
    // never changes; the span is what knows it touched two days.
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
