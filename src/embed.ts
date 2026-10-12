/**
 * The surface the ACTAS Pay Tracker embeds (vendored as a built bundle at a
 * pinned commit — see that repo's vendor/otcalculator/VENDOR.md). Changing a
 * prop or export here is a breaking change for it.
 *
 * The stylesheets are the standalone app's minus its page-ground sheet: the
 * host owns its own <html>, <body> and page ground. Vite library mode inlines
 * the two IBM Plex Mono weights into embed.css as data: URIs, so there is no
 * fonts/ directory to ship.
 */
import './ui/styles.css'
import './styles/calculator.css'

export { Calculator } from './components/Calculator'
export type { CalculatorProps } from './components/Calculator'
export { StationLedger } from './ui/index'
export { payFortnightFor } from './app/pay-period'
export type { PayFortnight } from './app/pay-period'
export { DEFAULT_CHOICES, DEFAULT_ADVANCED_DEDUCTIONS } from './app/settings'
export type { CalculatorChoices, AdvancedDeductionChoice } from './app/settings'
export { calculateOvertime } from './engine/attendance'
export type { Attendance } from './engine/attendance'
export type { OtShift, ShiftKind, Segment, OtCategory, EmploymentType } from './engine/types'
export { payBandFor } from './data/pay-rates'
export type { Classification } from './data/pay-rates'
export { ACT_HOLIDAY_CALENDAR } from './data/public-holidays'
