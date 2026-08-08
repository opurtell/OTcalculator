/**
 * Annex A pay tables — ACT Public Sector ACT Ambulance Service Enterprise
 * Agreement 2023–2026, rates effective **4 December 2025** (1% + $1,000,
 * clause C2.2.7).
 *
 * Transcribed from the ACTAS Pay Tracker's `reference-sources/
 * actas_pay_rates.json`, itself taken from Annex A.
 *
 * Two figures per step, and they are not interchangeable:
 *
 * - `annualBase` is the base salary. **Overtime is calculated on this**
 *   (EBA N34.1) and on nothing else.
 * - `annexATotal` is the published composite — base + penalties (29.71%) +
 *   rostered overtime (1.87%). It drives *ordinary* pay only. Using it for
 *   overtime overstates every result by about 34%.
 *
 * The totals are the EBA's own published figures rather than `base × 1.3158`
 * recomputed: the tables are rounded to whole dollars and recomputation drifts
 * by a few dollars a year (§3.1).
 *
 * Ambulance Manager classifications are deliberately absent. The EBA publishes
 * no penalty or overtime loading for them, so there is no Annex A total to
 * quote, and C9.4 makes AM1 and above ineligible for overtime without the head
 * of service's approval. This app is for the paramedic cohort.
 */

import type { PayBand } from '../engine/types'

/** The date these rates took effect. Shown in the UI beside the band. */
export const RATES_EFFECTIVE_FROM = '2025-12-04'

export type Classification = 'AP1' | 'AP2' | 'ICP1' | 'ICP2'

export const CLASSIFICATION_LABEL: Readonly<Record<Classification, string>> = {
  AP1: 'Ambulance Paramedic 1',
  AP2: 'Ambulance Paramedic 2',
  ICP1: 'Intensive Care Paramedic 1',
  ICP2: 'Intensive Care Paramedic 2',
}

/** `[step, annualBase, annexATotal]`, straight off Annex A. */
const TABLE: Readonly<Record<Classification, readonly [number, number, number][]>> = {
  AP1: [
    [1, 91_571, 120_489],
    [2, 95_698, 125_920],
    [3, 98_997, 130_260],
    [4, 102_237, 134_524],
  ],
  AP2: [
    [1, 108_457, 142_708],
    [2, 114_753, 150_992],
    [3, 121_052, 159_281],
  ],
  ICP1: [
    [1, 105_361, 138_634],
    [2, 109_649, 144_276],
    [3, 112_859, 148_499],
    [4, 116_074, 152_731],
  ],
  ICP2: [
    [1, 122_317, 160_944],
    [2, 128_615, 169_232],
    [3, 134_914, 177_520],
  ],
}

export const PAY_BANDS: readonly PayBand[] = Object.entries(TABLE).flatMap(
  ([classification, steps]) =>
    steps.map(([step, annualBase, annexATotal]) => ({
      classification,
      step,
      annualBase,
      annexATotal,
    })),
)

export function stepsFor(classification: Classification): number[] {
  return TABLE[classification].map(([step]) => step)
}

/** `undefined` rather than a throw — the caller may be reading stale settings. */
export function payBandFor(
  classification: string,
  step: number,
): PayBand | undefined {
  return PAY_BANDS.find(
    (band) => band.classification === classification && band.step === step,
  )
}
