/**
 * The §3.8/§3.9 caption, in one place so the two schedules stay worded in
 * parallel.
 *
 * A fallback can happen in either direction and the two mean different things.
 * Asking for a year *after* the one held is the ordinary case — the ATO has
 * not reissued yet, and the figures are last year's. Asking for a year
 * *before* it means the app never held that year's schedule at all, which is
 * the case for anything the repo has not sourced. Saying "not yet published"
 * about a year that has already been and gone would be the app describing its
 * own gap as the ATO's delay.
 *
 * Both wordings name the year actually applied first, because that is the fact
 * that changes what the figures on screen mean.
 */

import type { FinancialYear } from '../engine/types'

/** `'2026-27'` → `2026`. The label is the whole ordering. */
function startYearOf(year: FinancialYear): number {
  return Number(year.slice(0, 4))
}

/** `'2026-27'` → `'2026–27'`, an en dash for prose. */
function inProse(year: FinancialYear): string {
  return year.replace('-', '–')
}

/**
 * `what` names the schedule in the user's terms — "tax rates", "study loan
 * thresholds" — not the NAT number, which means nothing on a payslip.
 */
export function fallbackNotice(
  what: string,
  held: FinancialYear,
  requested: FinancialYear,
): string {
  const applied = `Using ${inProse(held)} ${what}`
  return startYearOf(requested) > startYearOf(held)
    ? `${applied} — ${inProse(requested)} schedule not yet published.`
    : `${applied} — no ${inProse(requested)} schedule is held.`
}
