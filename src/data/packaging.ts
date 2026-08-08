/**
 * FBT-exempt salary packaging caps (§3.10).
 *
 * ACTAS is a public health employer, so staff can package up to the living
 * expenses cap plus a separate meal entertainment cap, both free of fringe
 * benefits tax. The app **warns rather than blocks** when an annualised
 * packaged amount exceeds a cap — the user may be packaging elsewhere too, and
 * a calculator that refuses to compute is worse than one that cautions.
 *
 * The gross-up factor is the FBT Type 2 rate, used for the reportable fringe
 * benefit that lands on the annual HELP assessment (§3.9).
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
