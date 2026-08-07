import { Disclaimer, StationLedger } from 'actas-ot-ui'

/**
 * Permanent, in the footer of every screen. Prop-less on purpose — there is
 * one disclaimer and it does not get edited per screen.
 */
export const Default = () => (
  <StationLedger>
    <Disclaimer />
  </StationLedger>
)

export const Dark = () => (
  <StationLedger theme="dark">
    <Disclaimer />
  </StationLedger>
)
