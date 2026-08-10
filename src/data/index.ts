/**
 * Reference data — every rate, table and threshold the engine needs, and none
 * of the logic that uses them.
 *
 * The dependency runs one way: `data/` imports types from `engine/`, and
 * `engine/` imports nothing from here. The engine takes all of this as
 * parameters, which is what lets an older fortnight keep computing against the
 * figures that were current when it was worked.
 *
 * Everything here has a provenance comment naming its source. Nothing in this
 * directory should ever acquire a figure without one.
 */

export * from './pay-rates'
export * from './pay-periods'
export * from './public-holidays'
export * from './packaging'
export * from './roster-shifts'
export {
  taxScaleFor,
  fallbackCaption,
  LATEST_VERIFIED_FINANCIAL_YEAR as LATEST_VERIFIED_TAX_YEAR,
} from './tax-scales'
export type { TaxScaleSelection } from './tax-scales'
export {
  helpScheduleFor,
  helpFallbackCaption,
  LATEST_VERIFIED_FINANCIAL_YEAR as LATEST_VERIFIED_HELP_YEAR,
} from './help-thresholds'
export type { HelpScheduleSelection } from './help-thresholds'
