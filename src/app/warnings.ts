/**
 * Everything the app wants to say about a fortnight without refusing to
 * calculate it.
 *
 * All of these are warnings and none of them block (§7). The user knows their
 * roster better than the app does: a 17-hour attendance is unusual, not
 * impossible, and a calculator that greys out its own button because it
 * doubts you is worse than one that computes and says what it noticed.
 *
 * Two sources feed in. The engine raises flags it found while pricing —
 * grouping it was unsure about, dates past the holiday data, daylight saving.
 * This module adds the ones that are about the *list* rather than the pay.
 */

import { shiftDuration } from '../engine/attendance'
import { daysSinceEpoch } from '../engine/calendar'
import type { FortnightFlag } from '../engine/packaging'
import type { HolidayCalendar, OtShift } from '../engine/types'
import { formatHours } from '../ui/format'
import { formatDayAndMonth, formatShortDate } from './dates'

export interface Warning {
  /** Stable within a render, for React keys. */
  id: string
  text: string
}

/** Longer than this and the app asks whether the times are right. */
const LONG_SHIFT_MINUTES = 16 * 60

/** A fortnight is fourteen days. Anything wider is probably two of them. */
const FORTNIGHT_DAYS = 14

export function fortnightWarnings(
  shifts: readonly OtShift[],
  flags: readonly FortnightFlag[],
  holidays: HolidayCalendar,
): Warning[] {
  return [
    ...longShiftWarnings(shifts),
    ...overlapWarnings(shifts),
    ...spanWarnings(shifts),
    ...flagWarnings(flags, holidays),
  ]
}

function longShiftWarnings(shifts: readonly OtShift[]): Warning[] {
  return shifts
    .filter((shift) => shiftDuration(shift) > LONG_SHIFT_MINUTES)
    .map((shift) => ({
      id: `long-${shift.id}`,
      text: `${formatShortDate(shift.date)} runs ${formatHours(
        shiftDuration(shift) / 60,
      )}. Worth checking the start and end times.`,
    }))
}

/**
 * Overlapping shifts are priced once, not twice — the engine merges them into
 * the enclosing span. That is the right answer and also a silent one, so it
 * gets said out loud: someone who entered the same pickup twice would
 * otherwise see a total that did not match their arithmetic.
 */
function overlapWarnings(shifts: readonly OtShift[]): Warning[] {
  const spans = shifts
    .map((shift) => {
      const start = daysSinceEpoch(shift.date) * 1440 + shift.startMin
      return { shift, start, end: start + shiftDuration(shift) }
    })
    .sort((a, b) => a.start - b.start)

  const warnings: Warning[] = []
  for (let i = 1; i < spans.length; i += 1) {
    const previous = spans[i - 1]
    const current = spans[i]
    if (current.start < previous.end) {
      warnings.push({
        id: `overlap-${previous.shift.id}-${current.shift.id}`,
        text: `${formatShortDate(previous.shift.date)} and ${formatShortDate(
          current.shift.date,
        )} overlap. The overlapping time is paid once, not twice.`,
      })
    }
  }

  return warnings
}

function spanWarnings(shifts: readonly OtShift[]): Warning[] {
  if (shifts.length < 2) return []

  const days = shifts.map((shift) => daysSinceEpoch(shift.date))
  const span = Math.max(...days) - Math.min(...days) + 1
  if (span <= FORTNIGHT_DAYS) return []

  return [
    {
      id: 'span',
      text: `These shifts span ${span} days. A fortnight is ${FORTNIGHT_DAYS}, and tax is worked out one fortnight at a time — the figures will be off if this is two pay periods.`,
    },
  ]
}

function flagWarnings(
  flags: readonly FortnightFlag[],
  holidays: HolidayCalendar,
): Warning[] {
  const warnings: Warning[] = []

  flags.forEach((flag, index) => {
    switch (flag.kind) {
      case 'grouping-uncertain':
        warnings.push({
          id: `grouping-${index}`,
          text: `Two shifts ${formatHours(
            flag.gapMinutes / 60,
          )} apart are treated as one attendance, so the rate carries across the break. If they were separate call-outs, the second one may earn a 4-hour minimum of its own.`,
        })
        break

      case 'beyond-holiday-data':
        warnings.push({
          id: `holidays-${flag.date}`,
          text: `Public holidays are only known through ${formatDayAndMonth(
            holidays.coversThrough,
          )}, so ${formatShortDate(
            flag.date,
          )} is priced as an ordinary day. If it is a holiday, the real figure is higher.`,
        })
        break

      case 'dst-transition':
        warnings.push({
          id: `dst-${flag.date}`,
          text: `${formatShortDate(
            flag.date,
          )} is a daylight saving change, so the clock and the hours worked disagree by one. Overtime is paid on hours actually worked — check the total.`,
        })
        break

      // Packaging flags are shown beside the deductions they belong to rather
      // than in the fortnight's warning list, where they would be adrift from
      // the fields that caused them.
      default:
        break
    }
  })

  return warnings
}
