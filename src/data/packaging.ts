/**
 * FBT-exempt salary packaging caps (§3.10).
 *
 * ACTAS is a public health employer, so staff can package up to the living
 * expenses cap plus a separate meal entertainment cap, both free of fringe
 * benefits tax.
 *
 * **Nothing in the app consults these figures.** They are kept as transcribed
 * reference data, not as a live input: the app's one "pre-tax deductions" field
 * covers packaging and salary-sacrificed super alike, and only the first counts
 * towards a cap — so a cap check on that figure would be confidently wrong for
 * the commonest entry. See the note on `packagingFlags` in
 * `src/engine/packaging.ts` before wiring them to anything.
 *
 * The gross-up factor is the FBT Type 2 rate, which would be needed for the
 * reportable fringe benefit that lands on the annual HELP assessment (§3.9).
 *
 * Source: the ACTAS Pay Tracker's `packaging.json`, which flags the caps as
 * needing a currency check each financial year. They have been stable since
 * 2017-18, but they are indexed in principle — worth re-checking each July.
 */

import type { PackagingCaps } from '../engine/types'

export const PACKAGING_CAPS: PackagingCaps = {
  effectiveFrom: '2017-04-01',
  livingExpensesCap: 9_010,
  mealEntertainmentCap: 2_650,
  grossUpFactor: 1.8868,
}
