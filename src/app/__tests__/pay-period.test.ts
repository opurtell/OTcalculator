/**
 * The pay calendar decides how long the app holds on to a fortnight of shifts,
 * so the boundary is the whole test: one day either side of it is the
 * difference between a list that survives the night and one that empties
 * itself while the user is still working the fortnight.
 */

import { describe, expect, it } from 'vitest'
import { PAY_PERIOD_ANCHOR_END, PAY_PERIOD_DAYS } from '../../data/pay-periods'
import { dayOfWeek } from '../../engine/calendar'
import type { IsoDate } from '../../engine/types'
import { formatPayFortnight, payFortnightFor } from '../pay-period'

/** 0 = Sunday … 3 = Wednesday, 4 = Thursday. */
const THURSDAY = 4
const WEDNESDAY = 3

describe('the anchor', () => {
  it('is the Wednesday it is documented to be', () => {
    // The whole calendar is counted off this date. A transcription error here
    // shifts every period by a day and nothing else would notice.
    expect(PAY_PERIOD_ANCHOR_END).toBe('2026-07-29')
    expect(dayOfWeek(PAY_PERIOD_ANCHOR_END)).toBe(WEDNESDAY)
  })

  it('closes the period containing its own date', () => {
    // The end is inclusive: pay day's Wednesday is in the period it ends.
    expect(payFortnightFor(PAY_PERIOD_ANCHOR_END).end).toBe(PAY_PERIOD_ANCHOR_END)
  })
})

describe('payFortnightFor', () => {
  it('runs Thursday to Wednesday, fourteen days inclusive', () => {
    const { start, end } = payFortnightFor('2026-08-10')
    expect(start).toBe('2026-07-30')
    expect(end).toBe('2026-08-12')
    expect(dayOfWeek(start)).toBe(THURSDAY)
    expect(dayOfWeek(end)).toBe(WEDNESDAY)
  })

  it('rolls over on the Thursday, not before it', () => {
    // The day the shifts a user has entered stop being this fortnight's.
    expect(payFortnightFor('2026-07-29').end).toBe('2026-07-29')
    expect(payFortnightFor('2026-07-30').end).toBe('2026-08-12')
  })

  it('gives every day of a fortnight the same answer', () => {
    const expected = payFortnightFor('2026-07-30')
    const days: IsoDate[] = [
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-05',
      '2026-08-11',
      '2026-08-12',
    ]
    for (const day of days) {
      expect(payFortnightFor(day), day).toEqual(expected)
    }
  })

  it('counts backwards from the anchor as readily as forwards', () => {
    // Nothing in the app asks about a past fortnight today, but the arithmetic
    // having a special case for "before the anchor" would be a trap waiting
    // for the day the anchor is corrected to a later period.
    expect(payFortnightFor('2026-07-16')).toEqual({
      start: '2026-07-16',
      end: '2026-07-29',
    })
    expect(payFortnightFor('2026-07-15').end).toBe('2026-07-15')
    expect(payFortnightFor('2025-01-05')).toEqual({
      start: '2025-01-02',
      end: '2025-01-15',
    })
  })

  it('closes a period on a Wednesday that happens to be New Year\'s Day', () => {
    // Nothing here is month or year arithmetic — it is all day counting — but
    // this is where that would show if it ever stopped being true.
    expect(payFortnightFor('2025-01-01')).toEqual({
      start: '2024-12-19',
      end: '2025-01-01',
    })
  })

  it('holds across a leap day', () => {
    const leap = payFortnightFor('2028-02-29')
    expect(dayOfWeek(leap.start)).toBe(THURSDAY)
    expect(dayOfWeek(leap.end)).toBe(WEDNESDAY)
    expect(leap.start <= '2028-02-29' && '2028-02-29' <= leap.end).toBe(true)
  })

  it('never returns a period that is not a fortnight long', () => {
    const dates: IsoDate[] = ['2026-07-29', '2026-07-30', '2026-12-31', '2027-03-01']
    for (const date of dates) {
      const { start, end } = payFortnightFor(date)
      const days =
        (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
      expect(days, date).toBe(PAY_PERIOD_DAYS - 1)
    }
  })
})

describe('formatPayFortnight', () => {
  it('reads as a range of two dates', () => {
    expect(formatPayFortnight(payFortnightFor('2026-08-10'))).toBe(
      'Thu 30 Jul – Wed 12 Aug',
    )
  })
})
