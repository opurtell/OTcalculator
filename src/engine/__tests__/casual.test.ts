/**
 * Casual pay — EBA B14, priced shift by shift.
 *
 * AP1 Step 2: base $95,698, so the base hourly rate is
 * 95,698 × 12 ÷ 313 ÷ 76 = $48.2754. Every expected figure below is that rate
 * worked by hand, not read back off the engine.
 *
 * Built to the EBA text; **not yet checked against a casual payslip.**
 */

import { describe, expect, it } from 'vitest'
import {
  calculateCasual,
  priceCasualAttendance,
  quickCasual,
  splitIntervals,
} from '../casual'
import { calculateFortnight } from '../fortnight'
import { NO_DEDUCTIONS } from '../packaging'
import { taxScaleFor } from '../../data/tax-scales'
import { categoriseAttendance, C9_12_RULES } from '../overtime'
import { AP1_STEP_2, HOLIDAYS_2026, MEAL_SETTINGS, cents, shift } from './fixtures'

function price(...shifts: ReturnType<typeof shift>[]) {
  return priceCasualAttendance(shifts, AP1_STEP_2, HOLIDAYS_2026)
}

const penaltyMinutes = (attendance: ReturnType<typeof price>) =>
  Object.fromEntries(
    (attendance.casual?.penalties ?? []).map((p) => [p.category, p.minutes]),
  )

describe('casual ordinary hours (B14.2, B14.3)', () => {
  it('pays a weekday daytime shift at base plus 25% loading — 6h, $362.07', () => {
    const a = price(shift('2026-08-19', '09:00', '15:00'))
    expect(a.casual?.workedMinutes).toBe(360)
    expect(a.casual?.penalties).toEqual([])
    expect(cents(a.casual!.loading)).toBe(cents(a.casual!.basePay * 0.25))
    expect(cents(a.casual!.pay)).toBe(362.07)
    expect(a.segments).toEqual([])
    expect(a.pay).toBe(0)
  })

  it('takes the loading off base only — never the composite', () => {
    const a = price(shift('2026-08-19', '09:00', '10:00'))
    expect(a.casual!.hourlyRate).toBeCloseTo(48.2754, 4)
  })

  it('pays the Saturday penalty on Saturday ordinary minutes, and no night (C8.3)', () => {
    const a = price(shift('2026-08-15', '09:00', '19:00'))
    expect(penaltyMinutes(a)).toEqual({ saturday: 456 })
    expect(cents(a.casual!.pay)).toBe(642.06)
  })

  it('splits a Friday night into Saturday by the minute, with no night penalty', () => {
    // Fri 22:00 → Sat 06:00. Ordinary runs to Sat 05:36: 2h Friday, 5.6h
    // Saturday. A Saturday penalty is paid, so C8.3 withholds the night one.
    const a = price(shift('2026-08-14', '22:00', '06:00'))
    expect(penaltyMinutes(a)).toEqual({ saturday: 336 })
    expect(cents(a.casual!.pay)).toBe(593.79)
  })

  it('pays night 15% on every ordinary minute of a weekday night shift', () => {
    const a = price(shift('2026-08-18', '21:00', '07:00'))
    expect(penaltyMinutes(a)).toEqual({ night: 456 })
    expect(cents(a.casual!.pay)).toBe(513.65)
  })

  it('pays night when only the overtime reaches 6 pm — "any part of" the shift', () => {
    const a = price(shift('2026-08-19', '09:00', '19:00'))
    expect(penaltyMinutes(a)).toEqual({ night: 456 })
  })

  it('pays no night penalty on a shift starting at 06:30 and ending before 18:00', () => {
    const a = price(shift('2026-08-19', '06:30', '17:30'))
    expect(a.casual?.penalties).toEqual([])
  })

  it('pays the public holiday penalty at 150% (C8.7)', () => {
    // Labour Day, 5 October 2026.
    const a = price(shift('2026-10-05', '08:00', '16:00'))
    expect(penaltyMinutes(a)).toEqual({ 'public-holiday': 456 })
    expect(cents(a.casual!.pay)).toBe(1008.96)
    expect(a.categories).toEqual(['ph_2_5x'])
    expect(cents(a.pay)).toBe(48.28)
  })
})

describe('the three-hour minimum (B14.1)', () => {
  it('pays a one-hour Sunday attendance three hours, penalty included', () => {
    const a = price(shift('2026-08-16', '10:00', '11:00'))
    expect(a.casual?.minimumApplied).toBe(true)
    expect(a.casual?.topUpMinutes).toBe(120)
    expect(a.casual?.paidMinutes).toBe(180)
    expect(penaltyMinutes(a)).toEqual({ sunday: 180 })
    expect(cents(a.casual!.pay)).toBe(325.86)
  })

  it('does not apply at three hours', () => {
    const a = price(shift('2026-08-19', '09:00', '12:00'))
    expect(a.casual?.minimumApplied).toBe(false)
    expect(a.casual?.paidMinutes).toBe(180)
  })
})

describe('casual overtime past 7h36 (B14.6, B14.7)', () => {
  it('splits an 11-hour weekday at 7h36 — 3.4h overtime, $280.00', () => {
    const a = price(shift('2026-08-19', '06:30', '17:30'))
    expect(a.casual?.workedMinutes).toBe(456)
    expect(a.workedMinutes).toBe(204)
    expect(a.categories).toEqual(['mf_1_5x', 'mf_2x'])
    expect(a.segments[0].startMin).toBe(14 * 60 + 6)
    expect(cents(a.pay)).toBe(280)
    expect(cents(a.casual!.pay)).toBe(458.62)
  })

  it('pays Saturday overtime at 1.5× for two hours under C9.12, not 2× under N34', () => {
    const a = price(shift('2026-08-15', '09:00', '19:00'))
    expect(a.categories).toEqual(['sat_1_5x', 'sat_2x'])
    expect(cents(a.pay)).toBe(183.45)
  })

  it('carries no loading on the overtime and never the C9.5 minimum', () => {
    // 7h50 worked: 14 minutes of overtime, paid as 14 minutes at 1.5×.
    const a = price(shift('2026-08-19', '09:00', '16:50'))
    expect(a.workedMinutes).toBe(14)
    expect(a.minimumApplied).toBe(false)
    expect(a.pay).toBeCloseTo((14 / 60) * 48.27543 * 1.5, 4)
  })

  it('keeps the N36 boundary at the start of the whole engagement', () => {
    const a = price(shift('2026-08-19', '06:30', '17:30'))
    expect(a.kind).toBe('separate')
    expect(a.startMin).toBe(6 * 60 + 30)
    expect(a.intervals).toHaveLength(1)
  })
})

describe('splitIntervals', () => {
  it('splits across an unpaid gap by worked minutes, not clock time', () => {
    const { before, after } = splitIntervals(
      [
        { date: '2026-08-19', startMin: 0, durationMinutes: 300 },
        { date: '2026-08-19', startMin: 330, durationMinutes: 300 },
      ],
      456,
    )
    expect(before).toEqual([
      { date: '2026-08-19', startMin: 0, durationMinutes: 300 },
      { date: '2026-08-19', startMin: 330, durationMinutes: 156 },
    ])
    expect(after).toEqual([{ date: '2026-08-19', startMin: 486, durationMinutes: 144 }])
  })
})

describe('C9.12 ratchet across Friday into Saturday', () => {
  it('ties go to the calendar, so the Saturday first-tier minutes read as Saturday', () => {
    const segments = categoriseAttendance(
      [{ date: '2026-08-14', startMin: 23 * 60, durationMinutes: 240 }],
      HOLIDAYS_2026,
      C9_12_RULES,
    )
    expect(segments.map((s) => [s.category, s.minutes])).toEqual([
      ['mf_1_5x', 60],
      ['sat_1_5x', 60],
      ['sat_2x', 120],
    ])
  })
})

describe('a casual fortnight end to end', () => {
  const settings = {
    band: AP1_STEP_2,
    taxScale: taxScaleFor('2026-27', 2).scale,
    helpSchedule: null,
    deductions: NO_DEDUCTIONS,
    holidays: HOLIDAYS_2026,
    meals: MEAL_SETTINGS,
    employment: 'casual' as const,
  }
  const shifts = [
    shift('2026-08-15', '09:00', '19:00'),
    shift('2026-08-19', '06:30', '17:30'),
  ]
  const result = calculateFortnight(shifts, settings)
  const priced = calculateCasual(shifts, AP1_STEP_2, HOLIDAYS_2026)

  it('uses the shifts as ordinary pay — no salary, no composite', () => {
    expect(result.employment).toBe('casual')
    expect(result.ordinaryGross).toBeCloseTo(642.06 + 458.62, 1)
    expect(result.withoutOt.gross).toBe(priced.ordinaryGross)
  })

  it('puts only the hours past 7h36 into the overtime delta', () => {
    expect(result.overtimeGross).toBeCloseTo(183.45 + 280, 1)
    expect(result.otGrossDelta).toBeCloseTo(priced.gross, 9)
  })

  it('ignores the full-time gross override', () => {
    const overridden = calculateFortnight(shifts, {
      ...settings,
      ordinaryGrossOverride: 9_999,
    })
    expect(overridden.ordinaryGross).toBe(result.ordinaryGross)
  })

  it('pays the meal allowance on the AM taken an hour over (B14.8)', () => {
    expect(result.mealAllowance.occasions).toHaveLength(1)
    expect(result.mealAllowance.occasions[0].rosterCode).toBe('AM')
  })

  it('is full-time when employment is absent', () => {
    const { employment: _omit, ...fullTime } = settings
    expect(calculateFortnight(shifts, fullTime).employment).toBe('full-time')
  })
})

describe('quickCasual', () => {
  it('pays 7h36 at the casual rate and the rest as two-tier overtime', () => {
    const quick = quickCasual(10, AP1_STEP_2.annualBase)
    expect(quick.tiers.map((t) => [t.category, Math.round(t.hours * 60)])).toEqual([
      [null, 456],
      ['mf_1_5x', 120],
      ['mf_2x', 24],
    ])
    // Matches the shift engine on the same weekday daytime hours.
    const a = price(shift('2026-08-19', '07:00', '17:00'))
    expect(quick.gross).toBeCloseTo(a.casual!.pay + a.pay, 9)
  })

  it('pays the three-hour minimum on a short shift', () => {
    const quick = quickCasual(1, AP1_STEP_2.annualBase)
    expect(quick.tiers).toHaveLength(1)
    expect(quick.tiers[0].hours).toBe(3)
  })

  it('is nothing for no hours', () => {
    expect(quickCasual(0, AP1_STEP_2.annualBase)).toEqual({ gross: 0, tiers: [] })
  })
})
