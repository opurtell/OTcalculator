import { StationLedger, Toggle } from 'actas-ot-ui'

const noop = () => {}

/** The common case — the threshold is claimed with your main employer. */
export const ThresholdClaimed = () => (
  <StationLedger>
    <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
  </StationLedger>
)

/** Off, and the description says what turning it on would do. */
export const StudyLoanOff = () => (
  <StationLedger>
    <Toggle
      label="Study or training loan"
      checked={false}
      onChange={noop}
      description="Adds a compulsory repayment to the tax withheld each fortnight."
    />
  </StationLedger>
)

/** On, with the consequence stated rather than the label restated. */
export const StudyLoanOn = () => (
  <StationLedger>
    <Toggle
      label="Study or training loan"
      checked
      onChange={noop}
      description="Packaging lowers what is withheld each pay, but not what you owe at tax time."
    />
  </StationLedger>
)

/** Both settings as they appear together on the deductions screen. */
export const TaxSettings = () => (
  <StationLedger>
    <div className="sl-stack">
      <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
      <Toggle
        label="Study or training loan"
        checked={false}
        onChange={noop}
        description="Adds a compulsory repayment to the tax withheld each fortnight."
      />
    </div>
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <div className="sl-stack">
      <Toggle label="Tax-free threshold claimed" checked onChange={noop} />
      <Toggle
        label="Study or training loan"
        checked={false}
        onChange={noop}
        description="Adds a compulsory repayment to the tax withheld each fortnight."
      />
    </div>
  </StationLedger>
)
