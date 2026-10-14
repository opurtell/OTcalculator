/**
 * Level 2 shifts: a shift marked `level2` is priced at Level 2 of the user's
 * qualification (AP1 → AP2, ICP1 → ICP2), step 1, never below their own band.
 */

import { describe, expect, it } from 'vitest'
import { attendanceBand, calculateOvertime } from '../attendance'
import { calculateCasual } from '../casual'
import { calculateFortnight } from '../fortnight'
import { otHourlyRate } from '../overtime'
import { LEVEL2_STEP, level2BandFor, payBandFor } from '../../data/pay-rates'
import { DEFAULT_CHOICES, resolveSettings } from '../../app/settings'
import { describeAttendance } from '../../app/shifts'
import { fortnightWarnings } from '../../app/warnings'
import { parseStoredShift, readShifts, saveShifts } from '../../storage/shifts'
import type { PreferenceStore } from '../../storage/preferences'
import { AP1_STEP_2, HOLIDAYS_2026, cents, shift } from './fixtures'

const AP2_STEP_1 = payBandFor('AP2', 1)!

/** Saturday 8 August 2026, 09:00–19:00, picked up: 10h at 2×. */
const saturday = (level2?: boolean) => ({
  ...shift('2026-08-08', '09:00', '19:00'),
  ...(level2 === undefined ? {} : { level2 }),
})

describe('level2BandFor', () => {
  it('maps each qualification to step 1 of its Level 2 scale', () => {
    expect(LEVEL2_STEP).toBe(1)
    expect(level2BandFor('AP1', 4)).toEqual(payBandFor('AP2', 1))
    expect(level2BandFor('ICP1', 2)).toEqual(payBandFor('ICP2', 1))
  })

  it('keeps someone already on Level 2 at their own step', () => {
    expect(level2BandFor('AP2', 3)).toEqual(payBandFor('AP2', 3))
    expect(level2BandFor('ICP2', 2)).toEqual(payBandFor('ICP2', 2))
  })

  it('knows nothing about a classification outside the table', () => {
    expect(level2BandFor('AM1', 1)).toBeUndefined()
  })
})

describe('Level 2 overtime pricing', () => {
  it('prices a marked shift on the Level 2 base (N34.1, base only)', () => {
    const result = calculateOvertime([saturday(true)], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    const [attendance] = result.attendances
    expect(attendance.level2).toBe(true)
    expect(cents(result.gross)).toBe(cents(10 * otHourlyRate(108_457, 2)))
  })

  it('leaves an unmarked shift at the user’s own band', () => {
    const result = calculateOvertime([saturday()], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    expect(result.attendances[0].level2).toBe(false)
    expect(cents(result.gross)).toBe(cents(10 * otHourlyRate(95_698, 2)))
  })

  it('prices a marked shift at the own band when no Level 2 band is supplied', () => {
    const result = calculateOvertime([saturday(true)], AP1_STEP_2, HOLIDAYS_2026)
    expect(result.attendances[0].level2).toBe(false)
    expect(cents(result.gross)).toBe(cents(10 * otHourlyRate(95_698, 2)))
  })

  it('never prices below the user’s own band (C7.1, C7.6)', () => {
    const high = { ...AP1_STEP_2, annualBase: 120_000 }
    expect(attendanceBand([saturday(true)], high, AP2_STEP_1)).toEqual({
      band: high,
      level2: false,
      partial: false,
    })
  })

  it('pays the C9.5 top-up at the Level 2 rate too', () => {
    // Wednesday 2h call-in: 2h worked, 4h paid, all on the Level 2 base.
    const callIn = { ...shift('2026-08-12', '09:00', '11:00'), level2: true }
    const result = calculateOvertime([callIn], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    expect(result.attendances[0].minimumApplied).toBe(true)
    expect(cents(result.gross)).toBe(
      cents(2 * otHourlyRate(108_457, 1.5) + 2 * otHourlyRate(108_457, 2)),
    )
  })

  it('prices a part-marked attendance at the lower rate and flags it', () => {
    const first = { ...shift('2026-08-12', '09:00', '11:00'), level2: true }
    const second = shift('2026-08-12', '11:30', '15:00')
    const result = calculateOvertime([first, second], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    expect(result.attendances).toHaveLength(1)
    expect(result.attendances[0].level2).toBe(false)
    expect(result.flags).toContainEqual({ kind: 'level2-partial', date: '2026-08-12' })
    const warnings = fortnightWarnings([first, second], result.flags, HOLIDAYS_2026)
    expect(warnings.some((w) => w.text.includes('Level 2'))).toBe(true)
  })

  it('prices a casual Level 2 engagement from the Level 2 base throughout', () => {
    const own = calculateCasual([saturday()], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    const l2 = calculateCasual([saturday(true)], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    expect(l2.attendances[0].level2).toBe(true)
    const ratio = 108_457 / 95_698
    expect(cents(l2.ordinaryGross)).toBe(cents(own.ordinaryGross * ratio))
    expect(cents(l2.gross)).toBe(cents(own.gross * ratio))
  })

  it('says so on the breakdown line', () => {
    const result = calculateOvertime([saturday(true)], AP1_STEP_2, HOLIDAYS_2026, AP2_STEP_1)
    expect(describeAttendance(result.attendances[0]).breakdown).toBe(
      '10h · all at 2× (Saturday) · Level 2 rate',
    )
  })
})

describe('Level 2 through the settings seam', () => {
  it('resolves the Level 2 band from the chosen band', () => {
    const resolved = resolveSettings(
      { ...DEFAULT_CHOICES, band: { ...DEFAULT_CHOICES.band, classification: 'ICP1', step: 3 } },
      '2026-08-13',
    )
    expect(resolved?.settings.level2Band).toEqual(payBandFor('ICP2', 1))
  })

  it('moves the take-home figure for a marked shift', () => {
    const resolved = resolveSettings(
      { ...DEFAULT_CHOICES, band: { ...DEFAULT_CHOICES.band, step: 2 } },
      '2026-08-13',
    )!
    const own = calculateFortnight([saturday()], resolved.settings)
    const l2 = calculateFortnight([saturday(true)], resolved.settings)
    expect(l2.overtimeGross).toBeGreaterThan(own.overtimeGross)
    expect(l2.ordinaryGross).toBe(own.ordinaryGross)
  })
})

describe('Level 2 in storage', () => {
  const memory = (): PreferenceStore => {
    const data = new Map<string, string>()
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }
  }

  it('round-trips the mark and omits it when unset', () => {
    const store = memory()
    const marked = saturday(true)
    const plain = { ...saturday(), id: 'other' }
    expect(saveShifts('2026-08-12', [marked, plain], store)).toBe(true)
    const read = readShifts('2026-08-12', store)
    expect(read.shifts.find((s) => s.id === marked.id)?.level2).toBe(true)
    expect(read.shifts.find((s) => s.id === 'other')).not.toHaveProperty('level2')
  })

  it('reads anything but true as unmarked', () => {
    const stored = { id: 'a', date: '2026-08-08', startMin: 540, endMin: 1140, kind: 'separate', level2: 'yes' }
    expect(parseStoredShift(stored)).not.toHaveProperty('level2')
  })
})
