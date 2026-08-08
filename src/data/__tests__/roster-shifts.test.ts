import { describe, expect, it } from 'vitest'
import { ROSTER_SHIFTS, rosterShift } from '../roster-shifts'
import { MINUTES_PER_DAY } from '../../engine/types'

/** How long a pattern runs, allowing for the one that crosses midnight. */
function durationMinutes(code: 'AM' | 'D' | 'PM' | 'N'): number {
  const { startMin, endMin } = rosterShift(code)
  return endMin <= startMin ? endMin + MINUTES_PER_DAY - startMin : endMin - startMin
}

describe('the 44-hour roster patterns', () => {
  it('carries the four shifts in roster order', () => {
    expect(ROSTER_SHIFTS.map((shift) => shift.code)).toEqual(['AM', 'D', 'PM', 'N'])
  })

  it('holds the times Oscar gave', () => {
    expect(rosterShift('AM')).toEqual({ code: 'AM', startMin: 390, endMin: 990 })
    expect(rosterShift('D')).toEqual({ code: 'D', startMin: 540, endMin: 1260 })
    expect(rosterShift('PM')).toEqual({ code: 'PM', startMin: 660, endMin: 1380 })
    expect(rosterShift('N')).toEqual({ code: 'N', startMin: 1260, endMin: 420 })
  })

  it('sums to the 44 hours the roster is named for', () => {
    // The one checkable property of the transcription: 10 + 12 + 12 + 10. A
    // mistyped time fails here rather than quietly pre-filling wrong hours.
    expect(durationMinutes('AM')).toBe(10 * 60)
    expect(durationMinutes('D')).toBe(12 * 60)
    expect(durationMinutes('PM')).toBe(12 * 60)
    expect(durationMinutes('N')).toBe(10 * 60)

    const total = ROSTER_SHIFTS.reduce(
      (sum, shift) => sum + durationMinutes(shift.code),
      0,
    )
    expect(total).toBe(44 * 60)
  })

  it('records the night shift as ending before it starts', () => {
    // 07:00 is on the next day's clock, and the app derives that from the
    // ordering rather than storing a flag — see `draftEndsNextDay`.
    const night = rosterShift('N')
    expect(night.endMin).toBeLessThan(night.startMin)
  })
})
