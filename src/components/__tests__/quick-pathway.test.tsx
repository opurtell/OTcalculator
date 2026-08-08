import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolveSettings } from '../../app/settings'
import type { CalculatorChoices } from '../../app/settings'
import { comparePay } from '../../engine/fortnight'
import { quickOvertime } from '../../engine/overtime'
import { QuickResult } from '../QuickPathway'

const GOLDEN: CalculatorChoices = {
  band: {
    classification: 'AP1',
    step: 2,
    annualBase: null,
    fortnightlyGross: null,
  },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'quick',
}

function renderQuick(hours: number) {
  const resolved = resolveSettings(GOLDEN, '2026-02-11')
  if (resolved === null) throw new Error('AP1 Step 2 should resolve')

  const overtime = quickOvertime(hours, resolved.settings.band.annualBase)
  const comparison = comparePay(overtime.gross, resolved.settings)

  return renderToStaticMarkup(
    <QuickResult comparison={comparison} overtime={overtime} />,
  )
}

describe('QuickResult', () => {
  const html = renderQuick(10)

  it('leads with what the hours add in the hand', () => {
    // Ten hours on AP1 Step 2: $917.23 before tax, $579.23 after.
    expect(html).toContain('$579.23')
    expect(html).toContain('from $917.23 before tax')
  })

  it('frames retention as kept, never as lost', () => {
    expect(html).toContain('63% kept')
    expect(html).not.toContain('lost')
  })

  it('hedges the figure, because the figure is a simplification', () => {
    expect(html).toContain('Adds about')
  })

  it('shows the split that produced it', () => {
    // Never an unexplained figure: the two tiers and their hourly rates are on
    // the same panel as the total they add up to.
    expect(html).toContain('2h at 1.5×')
    expect(html).toContain('8h at 2×')
    expect(html).toContain('$72.41 an hour')
    expect(html).toContain('$96.55 an hour')
    expect(html).toContain('917.23')
  })

  it('drops the second tier on a shift that never reaches it', () => {
    const short = renderQuick(1.5)
    expect(short).toContain('1h 30m at 1.5×')
    expect(short).not.toContain('at 2×')
  })
})
