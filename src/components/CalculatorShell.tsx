import { useId } from 'react'
import type { ReactNode } from 'react'
import type { Pathway } from '../app/settings'
import {
  CalculatorLayout,
  Disclaimer,
  Disclosure,
  Panel,
  Tabs,
  tabId,
  tabPanelId,
} from '../ui/index'
import { ClearSettings } from './ClearSettings'

export interface CalculatorShellProps {
  pathway: Pathway
  onPathwayChange: (pathway: Pathway) => void
  /** The result panel. First in the DOM in both layouts — see CalculatorLayout. */
  result: ReactNode
  /** What is currently set, shown on the collapsed disclosure (§7). */
  bandSummary: string
  payBand: ReactNode
  deductionsSummary: string
  deductionsTax: ReactNode
  onClearSettings: () => void
  /** The pathway's own body — the hours field, or the shift list. */
  children: ReactNode
}

/**
 * The app frame: pathway switcher, result, inputs, settings, disclaimer.
 *
 * Deliberately knows nothing about pay. Everything it renders arrives as a
 * node, which is what lets the quick and fortnight pathways be two different
 * bodies inside one unchanging frame — and lets this file be read in one sitting.
 *
 * Settings live in disclosures rather than on a separate screen, and each one
 * says what is currently set while collapsed. `Advanced ▸` tells the user
 * nothing; `AP1 Step 2 · $95,698` tells them whether they need to open it.
 */
export function CalculatorShell({
  pathway,
  onPathwayChange,
  result,
  bandSummary,
  payBand,
  deductionsSummary,
  deductionsTax,
  onClearSettings,
  children,
}: CalculatorShellProps) {
  // The tabs sit above the layout and the body they control sits inside it, so
  // the two halves of the relationship are wired through a shared id base
  // rather than through a ref that would have to cross the layout.
  const idBase = useId()

  return (
    <main className="sl-stack sl-app">
      <h1 className="sl-heading">ACTAS OT Calculator</h1>

      <Tabs
        label="Calculation pathway"
        value={pathway}
        onChange={(value) => onPathwayChange(value as Pathway)}
        idBase={idBase}
        items={[
          { value: 'quick', label: 'Quick' },
          { value: 'fortnight', label: 'Fortnight' },
        ]}
      />

      <CalculatorLayout result={result}>
        <div className="sl-stack">
          <div
            role="tabpanel"
            id={tabPanelId(idBase, pathway)}
            aria-labelledby={tabId(idBase, pathway)}
            // The panel itself is a tab stop: arrowing to a tab and pressing
            // Tab should land in the body that tab just revealed.
            tabIndex={0}
          >
            {children}
          </div>

          <Panel flush>
            <Disclosure title="Pay band" summary={bandSummary}>
              <div className="sl-stack">{payBand}</div>
            </Disclosure>
          </Panel>

          <Panel flush>
            <Disclosure title="Deductions & tax" summary={deductionsSummary}>
              {deductionsTax}
            </Disclosure>
          </Panel>

          <ClearSettings onClear={onClearSettings} />
        </div>
      </CalculatorLayout>

      <Disclaimer />
    </main>
  )
}
