/**
 * Annex C allowance rates — ACT Public Sector ACT Ambulance Service Enterprise
 * Agreement 2023–2026.
 *
 * Only one allowance in Annex C is reachable from what this app asks the user,
 * and it is the overtime meal allowance: everything else in there is a
 * qualification, a per-day or a per-annum figure that no amount of shift times
 * can imply. See the note at the bottom for the three meal allowances that
 * exist in the agreement but **not** for this cohort.
 *
 * Transcribed from the Annex C "Overtime Meal" table (page 223 of the
 * agreement), via the ACTAS Pay Tracker's copy of the EBA. The eight columns
 * are the eight pay-rate steps in C20.2 — the same increases that move Annex A
 * move every Annex C figure, "unless the contrary intention is stated for a
 * specific allowance", and for this one it is not.
 *
 * The whole progression is kept rather than just the current figure, for the
 * same reason `tax-scales.ts` keeps a year: an allowance is looked up by the
 * date it was earned, so a fortnight worked in June still prices against the
 * rate that was current in June.
 *
 * **The increases compound on the unrounded figure, not on the printed one.**
 * C20.2's percentages applied to each published dollar amount in turn give
 * $33.06 where Annex C prints $33.05, and the cent carries forward through
 * every later column. Whoever adds the next row should apply the percentage to
 * the running unrounded figure, round once, and then check the result against
 * Annex C rather than trusting it. `reference-data.test.ts` holds the whole
 * chain to that rule.
 */

import type { IsoDate } from '../engine/types'

export interface AllowanceRate {
  /** First day of the first full pay period the rate applies to. */
  effectiveFrom: IsoDate
  amount: number
}

/**
 * Overtime meal allowance, **per occasion** — Annex C, EBA N36.1.
 *
 * Oldest first. The effective dates are Annex C's own column headers rather
 * than C20.2's "on or after" dates: C20.2.7 says "the first full pay period on
 * or after 1 December 2025" and Annex C prints that as 04/12/2025, which is the
 * Thursday the pay fortnight starts. Same figure, but the date that can be
 * compared against a shift is the one Annex C prints.
 */
export const OT_MEAL_ALLOWANCE_RATES: readonly AllowanceRate[] = [
  { effectiveFrom: '2022-06-09', amount: 31.6 },
  { effectiveFrom: '2023-01-05', amount: 32.17 },
  { effectiveFrom: '2023-06-08', amount: 32.49 },
  { effectiveFrom: '2023-12-07', amount: 33.05 },
  { effectiveFrom: '2024-06-06', amount: 33.55 },
  { effectiveFrom: '2024-12-05', amount: 34.37 },
  { effectiveFrom: '2025-06-05', amount: 34.71 },
  { effectiveFrom: '2025-12-04', amount: 35.38 },
]

/**
 * The rate in force on a date.
 *
 * A date before the first row falls back to the first row rather than throwing
 * or returning zero. The agreement's own first column is a rate "at 9/6/22" and
 * this app cannot price a fortnight from before the agreement anyway — the pay
 * tables only carry the current step — so the earliest row is the only honest
 * answer for an out-of-range date, and silently paying nothing would be the
 * one answer that is definitely wrong.
 */
export function otMealAllowanceFor(date: IsoDate): AllowanceRate {
  let current = OT_MEAL_ALLOWANCE_RATES[0]
  for (const rate of OT_MEAL_ALLOWANCE_RATES) {
    if (rate.effectiveFrom <= date) current = rate
  }
  return current
}

// ---------------------------------------------------------------------------
// The meal allowances this cohort does *not* get
// ---------------------------------------------------------------------------
//
// Three other meal allowances appear in the agreement, and none of them reaches
// a 44-hour roster paramedic. Recording that here so nobody adds them from a
// table of contents:
//
// - **Late meal allowance** (O13, P15) — 60% of the overtime meal rate where a
//   meal break has not started within five hours of commencing duty. Section O
//   is Patient Transport and Section P is the Ambulance Support cohort. The
//   44-hour roster's meal-break clause is N35, which has no late-meal
//   provision, and N43.1 lists exactly which general clauses the 44-hour roster
//   substitutes.
// - **Spoilt meal allowance** (O14, P16) — also 60%, where a meal break is
//   interrupted to respond to an incident. Same sections, same reason. The word
//   "spoilt" does not appear anywhere in Section N.
// - **Meal allowance following recall to duty** (N37) — this one *is* Section N,
//   but it is not a separate allowance. N37.1 obliges ACTAS to try to provide a
//   break on a short-notice recall, and N37.2 says a full overtime shift "may
//   claim an entitlement under clause N36, and in Annex C if eligible" — i.e.
//   the same overtime meal allowance above, which is why a picked-up shift is
//   priced for it here the same way an overrun is.
