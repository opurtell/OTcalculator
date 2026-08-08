import { describe, expect, it } from 'vitest'
import {
  calculateOvertime,
  groupIntoAttendances,
  priceAttendance,
  shiftDuration,
} from '../attendance'
import { AP1_STEP_2, HOLIDAYS_2026, cents, shift } from './fixtures'

const price = (shifts: Parameters<typeof priceAttendance>[0]) =>
  priceAttendance(shifts, AP1_STEP_2, HOLIDAYS_2026)

describe('shiftDuration', () => {
  it('measures a same-day shift', () => {
    expect(shiftDuration(shift('2026-08-15', '09:00', '19:00'))).toBe(600)
  })

  it('measures a shift that runs past midnight', () => {
    expect(shiftDuration(shift('2026-08-16', '22:00', '06:00'))).toBe(480)
  })

  it('rejects a shift that ends before it starts without endsNextDay', () => {
    // Coercing this would invent fourteen hours of pay out of an unticked box.
    const broken = { ...shift('2026-08-15', '19:00', '09:00'), endsNextDay: false }
    expect(() => shiftDuration(broken)).toThrow(/ends at or before it starts/)
  })

  it('rejects a zero-length shift', () => {
    const empty = { ...shift('2026-08-15', '09:00', '09:00'), endsNextDay: false }
    expect(() => shiftDuration(empty)).toThrow(RangeError)
  })
})

describe('groupIntoAttendances', () => {
  const gapOf = (minutes: number) => {
    const start = 11 * 60 + minutes
    return [
      shift('2026-08-19', '09:00', '11:00'),
      shift(
        '2026-08-19',
        `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
        '23:00',
      ),
    ]
  }

  it.each([
    [30, 1],
    [60, 1],
    [90, 2],
    [120, 2],
  ])('a %i-minute gap yields %i attendance(s)', (gap, expected) => {
    // The line is at 60 minutes: meal breaks do not break continuity (C9.7),
    // anything longer starts a fresh attendance and resets the ratchet.
    expect(groupIntoAttendances(gapOf(gap))).toHaveLength(expected)
  })

  it('orders shifts entered out of sequence', () => {
    const groups = groupIntoAttendances([
      shift('2026-08-19', '09:00', '11:00'),
      shift('2026-08-15', '09:00', '19:00'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0][0].date).toBe('2026-08-15')
  })

  it('joins across midnight when the gap is short', () => {
    const groups = groupIntoAttendances([
      shift('2026-08-16', '22:00', '23:30'),
      shift('2026-08-17', '00:00', '03:00'),
    ])
    expect(groups).toHaveLength(1)
  })

  it('returns nothing for no shifts', () => {
    expect(groupIntoAttendances([])).toEqual([])
  })
})

describe('the C9.5 four-hour minimum', () => {
  it('tops a short separate shift up to four hours', () => {
    const attendance = price([shift('2026-08-19', '09:00', '11:00', 'separate')])

    expect(attendance.workedMinutes).toBe(120)
    expect(attendance.paidMinutes).toBe(240)
    expect(attendance.minimumApplied).toBe(true)
    expect(attendance.topUpMinutes).toBe(120)
  })

  it('never applies to a shift overrun, however short', () => {
    // Oscar's rule, and the reason the toggle exists: an overrun follows a
    // rostered shift that has already been worked, so the overtime is paid at
    // its actual duration. Topping it up would invent two hours of pay.
    const attendance = price([shift('2026-08-19', '09:00', '11:00', 'overrun')])

    expect(attendance.workedMinutes).toBe(120)
    expect(attendance.paidMinutes).toBe(120)
    expect(attendance.minimumApplied).toBe(false)
    expect(attendance.topUpMinutes).toBe(0)
  })

  it('leaves a separate shift of four hours or more alone', () => {
    const exactly = price([shift('2026-08-19', '09:00', '13:00', 'separate')])
    const longer = price([shift('2026-08-19', '09:00', '14:00', 'separate')])

    expect(exactly.paidMinutes).toBe(240)
    expect(exactly.minimumApplied).toBe(false)
    expect(longer.paidMinutes).toBe(300)
    expect(longer.minimumApplied).toBe(false)
  })

  it('pays the top-up at the rate of the first hour', () => {
    // A two-hour Wednesday call-in sits entirely in the 1.5× tier, so the two
    // top-up hours are 1.5× too — not the 2× the clock would have reached.
    const attendance = price([shift('2026-08-19', '09:00', '11:00', 'separate')])

    expect(attendance.topUpCategory).toBe('mf_1_5x')
    expect(cents(attendance.pay)).toBe(cents(4 * 72.41314987))
  })

  it('pays a Sunday top-up at the Sunday rate', () => {
    const attendance = price([shift('2026-08-16', '09:00', '11:00', 'separate')])

    expect(attendance.topUpCategory).toBe('sun_2x')
    expect(cents(attendance.pay)).toBe(cents(4 * 96.55086598))
  })

  it('does not apply when an overrun is grouped with a separate shift', () => {
    // Continuity with ordinary duty is a property of the whole attendance: if
    // any part of it ran on from the rostered shift, none of it is standalone.
    const attendance = price([
      shift('2026-08-19', '09:00', '10:00', 'overrun'),
      shift('2026-08-19', '10:30', '11:00', 'separate'),
    ])

    expect(attendance.kind).toBe('overrun')
    expect(attendance.workedMinutes).toBe(90)
    expect(attendance.paidMinutes).toBe(90)
    expect(attendance.minimumApplied).toBe(false)
  })

  it('measures the minimum against worked time, not elapsed time', () => {
    // Two hours on, half an hour off, one hour on is three hours worked, so the
    // minimum still bites — the unpaid break does not count toward it.
    const attendance = price([
      shift('2026-08-19', '09:00', '11:00', 'separate'),
      shift('2026-08-19', '11:30', '12:30', 'separate'),
    ])

    expect(attendance.workedMinutes).toBe(180)
    expect(attendance.paidMinutes).toBe(240)
    expect(attendance.minimumApplied).toBe(true)
  })
})

describe('overlapping shifts', () => {
  it('does not pay the overlap twice', () => {
    const attendance = price([
      shift('2026-08-15', '09:00', '13:00'),
      shift('2026-08-15', '11:00', '15:00'),
    ])
    expect(attendance.workedMinutes).toBe(6 * 60)
  })

  it('ignores a shift entirely contained in another', () => {
    const attendance = price([
      shift('2026-08-15', '09:00', '19:00'),
      shift('2026-08-15', '11:00', '13:00'),
    ])
    expect(attendance.workedMinutes).toBe(10 * 60)
  })
})

describe('flags', () => {
  it('flags a gap in the uncertain band', () => {
    const attendance = price([
      shift('2026-08-19', '09:00', '11:00'),
      shift('2026-08-19', '11:45', '15:00'),
    ])
    expect(attendance.flags).toContainEqual({ kind: 'grouping-uncertain', gapMinutes: 45 })
  })

  it('does not flag a short gap', () => {
    const attendance = price([
      shift('2026-08-19', '09:00', '11:00'),
      shift('2026-08-19', '11:15', '15:00'),
    ])
    expect(attendance.flags).toEqual([])
  })

  it('warns rather than underpaying past the end of the holiday list', () => {
    const attendance = price([shift('2027-06-16', '09:00', '13:00')])
    expect(attendance.flags).toContainEqual({
      kind: 'beyond-holiday-data',
      date: '2027-06-16',
    })
  })

  it('flags a daylight-saving transition', () => {
    const attendance = price([shift('2026-10-04', '00:00', '08:00')])
    expect(attendance.flags).toContainEqual({
      kind: 'dst-transition',
      date: '2026-10-04',
    })
  })

  it('flags the second date of an attendance that crosses midnight in one segment', () => {
    // Sunday 22:00 → Monday 01:00 is a single carried sun_2x segment dated
    // Sunday. The Monday is only visible through the span, and this is the
    // regression guard for that.
    const attendance = price([shift('2027-06-20', '22:00', '01:00')])
    expect(attendance.crossesMidnight).toBe(true)
    expect(attendance.flags).toContainEqual({
      kind: 'beyond-holiday-data',
      date: '2027-06-21',
    })
  })
})

describe('calculateOvertime', () => {
  it('is zero for no shifts', () => {
    const result = calculateOvertime([], AP1_STEP_2, HOLIDAYS_2026)
    expect(result).toMatchObject({ gross: 0, workedMinutes: 0, paidMinutes: 0 })
    expect(result.attendances).toEqual([])
  })

  it('sums independent attendances', () => {
    const result = calculateOvertime(
      [
        shift('2026-08-15', '09:00', '19:00', 'separate'),
        shift('2026-08-19', '09:00', '11:00', 'overrun'),
      ],
      AP1_STEP_2,
      HOLIDAYS_2026,
    )

    expect(result.attendances).toHaveLength(2)
    expect(result.gross).toBeCloseTo(
      result.attendances[0].pay + result.attendances[1].pay,
      10,
    )
  })

  it('is monotonic in hours worked', () => {
    // Property: a longer shift never pays less. Guards the ratchet against a
    // category switch that loses minutes.
    let previous = 0
    for (let hours = 1; hours <= 12; hours += 1) {
      const end = 9 + hours
      const result = calculateOvertime(
        [shift('2026-08-19', '09:00', `${String(end).padStart(2, '0')}:00`, 'overrun')],
        AP1_STEP_2,
        HOLIDAYS_2026,
      )
      expect(result.gross).toBeGreaterThan(previous)
      previous = result.gross
    }
  })

  it('pays every worked minute exactly once across a split attendance', () => {
    const result = calculateOvertime(
      [
        shift('2026-08-19', '09:00', '11:00', 'overrun'),
        shift('2026-08-19', '11:30', '14:00', 'overrun'),
        shift('2026-08-19', '16:00', '18:00', 'overrun'),
      ],
      AP1_STEP_2,
      HOLIDAYS_2026,
    )

    // 09:00–14:00 is one attendance (30-minute break), 16:00–18:00 another.
    expect(result.attendances).toHaveLength(2)
    expect(result.workedMinutes).toBe(4.5 * 60 + 2 * 60)
  })
})
