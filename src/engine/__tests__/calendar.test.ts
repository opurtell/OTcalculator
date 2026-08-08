import { describe, expect, it } from 'vitest'
import {
  absoluteMinutes,
  addDays,
  dayKind,
  dayOfWeek,
  isBeyondHolidayData,
  isDstTransition,
  parseIsoDate,
  toIsoDate,
} from '../calendar'
import { HOLIDAYS_2026 } from './fixtures'

describe('parseIsoDate', () => {
  it('accepts a well-formed date', () => {
    expect(parseIsoDate('2026-08-15')).toEqual({ year: 2026, month: 8, day: 15 })
  })

  it.each(['2026-8-15', '15/08/2026', '2026-08-15T00:00', ''])(
    'rejects malformed input %j',
    (input) => {
      expect(() => parseIsoDate(input)).toThrow(RangeError)
    },
  )

  it('rejects a date that does not exist rather than rolling it over', () => {
    // The bug this guards: Date would silently make this 2 March, and the
    // engine would price a different day's rate without saying so.
    expect(() => parseIsoDate('2026-02-30')).toThrow(/No such date/)
  })

  it('accepts 29 February in a leap year', () => {
    expect(() => parseIsoDate('2028-02-29')).not.toThrow()
    expect(() => parseIsoDate('2026-02-29')).toThrow(/No such date/)
  })
})

describe('dayOfWeek', () => {
  // The UTC-parsing trap: `new Date('2026-08-15')` is midnight UTC, which is
  // still the 14th in Canberra. Everything here is built from components.
  it.each([
    ['2026-08-15', 6],
    ['2026-08-16', 0],
    ['2026-08-17', 1],
    ['2026-08-19', 3],
  ])('%s', (date, expected) => {
    expect(dayOfWeek(date)).toBe(expected)
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('goes backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('round-trips through toIsoDate', () => {
    expect(toIsoDate(parseIsoDate('2026-08-15'))).toBe('2026-08-15')
  })

  it('is unaffected by the daylight-saving transitions', () => {
    // Local-time date arithmetic drifts across these two days; UTC-based
    // day-counting does not.
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05')
    expect(addDays('2026-10-03', 1)).toBe('2026-10-04')
  })
})

describe('absoluteMinutes', () => {
  it('orders two times on different dates', () => {
    const sundayNight = absoluteMinutes('2026-08-16', 22 * 60)
    const mondayMorning = absoluteMinutes('2026-08-17', 6 * 60)
    expect(mondayMorning - sundayNight).toBe(8 * 60)
  })
})

describe('dayKind', () => {
  it('reads a public holiday ahead of the day of week', () => {
    // Canberra Day 2026 is a Monday. The holiday must win.
    expect(dayKind('2026-03-09', HOLIDAYS_2026)).toBe('public-holiday')
  })

  it.each([
    ['2026-08-15', 'saturday'],
    ['2026-08-16', 'sunday'],
    ['2026-08-19', 'weekday'],
  ])('%s is %s', (date, expected) => {
    expect(dayKind(date, HOLIDAYS_2026)).toBe(expected)
  })
})

describe('isBeyondHolidayData', () => {
  it('is false inside the horizon and true past it', () => {
    // The ACT list currently runs to King's Birthday, 14 June 2027.
    expect(isBeyondHolidayData('2027-06-14', HOLIDAYS_2026)).toBe(false)
    expect(isBeyondHolidayData('2027-06-15', HOLIDAYS_2026)).toBe(true)
  })
})

describe('isDstTransition', () => {
  it('finds both 2026 transitions', () => {
    expect(isDstTransition('2026-04-05')).toBe(true)
    expect(isDstTransition('2026-10-04')).toBe(true)
  })

  it('is false on an ordinary Sunday', () => {
    expect(isDstTransition('2026-08-16')).toBe(false)
  })
})
