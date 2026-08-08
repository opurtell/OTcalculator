import { describe, expect, it } from 'vitest'
import { calculateOvertime } from '../../engine/attendance'
import { AP1_STEP_2, HOLIDAYS_2026 } from '../../engine/__tests__/fixtures'
import type { OtShift } from '../../engine/types'
import {
  describeAttendance,
  draftDuration,
  draftEndsNextDay,
  draftFrom,
  duplicateDraft,
  emptyDraft,
  inferKind,
  removeShifts,
  toShift,
  upsertShift,
  withInferredKind,
} from '../shifts'

function draft(over: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return { ...emptyDraft(), date: '2026-08-15', start: '09:00', end: '19:00', ...over }
}

function priced(shifts: OtShift[]) {
  return calculateOvertime(shifts, AP1_STEP_2, HOLIDAYS_2026).attendances
}

describe('draft duration', () => {
  it('measures a same-day shift', () => {
    expect(draftDuration(draft())).toBe(600)
    expect(draftEndsNextDay(draft())).toBe(false)
  })

  it('derives the next day rather than asking for it', () => {
    const overnight = draft({ start: '22:00', end: '06:00' })
    expect(draftDuration(overnight)).toBe(480)
    expect(draftEndsNextDay(overnight)).toBe(true)
  })

  it('has no opinion until both times are there', () => {
    expect(draftDuration(draft({ end: '' }))).toBeNull()
    expect(draftDuration(draft({ start: '9' }))).toBeNull()
  })
})

describe('the C9.5 default', () => {
  it('reads short overtime as an overrun and long overtime as a pickup', () => {
    // You do not accidentally overrun by eight hours, and most short overtime
    // is the tail of a rostered shift (§3.6).
    expect(inferKind(120)).toBe('overrun')
    expect(inferKind(239)).toBe('overrun')
    expect(inferKind(240)).toBe('separate')
    expect(inferKind(600)).toBe('separate')
  })

  it('keeps re-deciding as the times change, until the user says otherwise', () => {
    const short = withInferredKind(draft({ end: '11:00' }))
    expect(short.kind).toBe('overrun')

    const long = withInferredKind({ ...short, end: '19:00' })
    expect(long.kind).toBe('separate')
  })

  it('stops deciding once the user has picked', () => {
    // Overruling someone about their own shift is how a calculator loses
    // trust, so a touched kind survives any later change to the times.
    const chosen = { ...draft({ end: '11:00' }), kind: 'separate' as const, kindTouched: true }
    expect(withInferredKind(chosen).kind).toBe('separate')
  })

  it('treats an edited shift as already settled', () => {
    const shift = toShift(draft({ end: '11:00', kind: 'separate', kindTouched: true }))!
    expect(draftFrom(shift).kindTouched).toBe(true)
  })
})

describe('toShift', () => {
  it('refuses a draft that is not a shift yet', () => {
    expect(toShift(draft({ date: '' }))).toBeNull()
    expect(toShift(draft({ start: '' }))).toBeNull()
    expect(toShift(draft({ date: '2026-02-31' }))).toBeNull()
    // Same minute both ends is a typo, not a 24-hour attendance.
    expect(toShift(draft({ start: '09:00', end: '09:00' }))).toBeNull()
  })

  it('gives a duplicate a new identity so it does not overwrite its original', () => {
    const original = toShift(draft())!
    const copy = duplicateDraft(original)
    expect(copy.id).toBeNull()
    expect(copy.date).toBe(original.date)
    expect(toShift(copy)!.id).not.toBe(original.id)
  })
})

describe('describeAttendance', () => {
  it('names the rate and the hours on a single-rate shift', () => {
    // Saturday 15 August 2026, 09:00–19:00. Double time from the first minute
    // — N34 overrides C9.12 for this cohort.
    const [attendance] = priced([
      {
        id: 'a',
        date: '2026-08-15',
        startMin: 9 * 60,
        endMin: 19 * 60,
        endsNextDay: false,
        kind: 'separate',
      },
    ])

    expect(describeAttendance(attendance).breakdown).toBe(
      '10h · all at 2× (Saturday)',
    )
    expect(describeAttendance(attendance).assumption).toBe(false)
  })

  it('spells out the two Mon–Fri tiers', () => {
    const [attendance] = priced([
      {
        id: 'a',
        date: '2026-08-19',
        startMin: 18 * 60,
        endMin: 23 * 60,
        endsNextDay: false,
        kind: 'overrun',
      },
    ])

    expect(describeAttendance(attendance).breakdown).toBe(
      '5h · 2h at 1.5×, 3h at 2×',
    )
  })

  it('explains a payment larger than the hours worked', () => {
    // Never an unexplained number bigger than the hours (§3.6).
    const [attendance] = priced([
      {
        id: 'a',
        date: '2026-08-19',
        startMin: 18 * 60,
        endMin: 20 * 60,
        endsNextDay: false,
        kind: 'separate',
      },
    ])

    const { breakdown, assumption } = describeAttendance(attendance)
    expect(breakdown).toBe('2h worked → 4h paid · 4-hour minimum (C9.5)')
    expect(assumption).toBe(true)
  })

  it('says when a weekend rate carried past midnight', () => {
    // Sunday 22:00 → Monday 06:00 stays Sunday rate for all eight hours. The
    // money is right either way; this line is what stops the user reconciling
    // it against their payslip by hand.
    const [attendance] = priced([
      {
        id: 'a',
        date: '2026-08-16',
        startMin: 22 * 60,
        endMin: 6 * 60,
        endsNextDay: true,
        kind: 'separate',
      },
    ])

    const { breakdown, assumption } = describeAttendance(attendance)
    expect(breakdown).toContain('all at 2× (Sunday)')
    expect(breakdown).toContain('Sunday rate carried past midnight')
    expect(assumption).toBe(true)
  })

  it('says nothing about a weekday carrying past midnight', () => {
    // True, but it tells nobody anything they did not already assume.
    const [attendance] = priced([
      {
        id: 'a',
        date: '2026-08-19',
        startMin: 22 * 60,
        endMin: 2 * 60,
        endsNextDay: true,
        kind: 'separate',
      },
    ])

    expect(describeAttendance(attendance).breakdown).not.toContain(
      'carried past midnight',
    )
  })
})

describe('the shift list', () => {
  const saturday = toShift(draft())!
  const wednesday = toShift(
    draft({ date: '2026-08-19', start: '18:00', end: '20:00' }),
  )!

  it('appends a new shift and replaces an edited one', () => {
    const added = upsertShift([saturday], wednesday)
    expect(added.map((s) => s.id)).toEqual([saturday.id, wednesday.id])

    const edited = upsertShift(added, { ...saturday, endMin: 21 * 60 })
    expect(edited).toHaveLength(2)
    expect(edited[0].endMin).toBe(21 * 60)
    // Position is held: an edit must not make a row jump out from under the
    // finger that was about to tap it.
    expect(edited.map((s) => s.id)).toEqual([saturday.id, wednesday.id])
  })

  it('hands back what it removed, whole, so undo can put it straight back', () => {
    const { kept, removed } = removeShifts([saturday, wednesday], [saturday.id])
    expect(kept).toEqual([wednesday])
    // Whole, not reconstructed: the C9.5 kind is a decision the user made and
    // re-deriving it from the duration would quietly overturn it.
    expect(removed).toEqual([saturday])
  })

  it('removes every entry of a joined attendance at once', () => {
    const { kept, removed } = removeShifts(
      [saturday, wednesday],
      [saturday.id, wednesday.id],
    )
    expect(kept).toEqual([])
    expect(removed).toHaveLength(2)
  })

  it('does nothing when asked to remove a shift that is not there', () => {
    const { kept, removed } = removeShifts([saturday], ['gone'])
    expect(kept).toEqual([saturday])
    expect(removed).toEqual([])
  })
})
