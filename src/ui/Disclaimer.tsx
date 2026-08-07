/**
 * Permanent, in the footer of every screen. Not a modal, not dismissible, not
 * styled to be ignored — but not shouting either.
 *
 * The wording is fixed by the copy deck (§6). It is a prop-less component on
 * purpose: there is one disclaimer and it does not get edited per screen.
 */
export function Disclaimer() {
  return (
    <p className="sl-disclaimer">
      Estimate only, based on the ACTAS Enterprise Agreement 2023–2026 and ATO
      withholding schedules. Not payroll advice. Check your payslip.
    </p>
  )
}
