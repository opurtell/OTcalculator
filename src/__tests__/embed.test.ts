import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as embed from '../embed'

describe('embed entry', () => {
  it('exports the host surface', () => {
    for (const name of [
      'Calculator', 'StationLedger', 'payFortnightFor', 'DEFAULT_CHOICES',
      'DEFAULT_ADVANCED_DEDUCTIONS', 'calculateOvertime', 'payBandFor', 'ACT_HOLIDAY_CALENDAR',
    ]) {
      expect(embed, name).toHaveProperty(name)
    }
  })
  it('agrees with the standalone pay calendar anchor', () => {
    expect(embed.payFortnightFor('2026-07-29')).toEqual({ start: '2026-07-16', end: '2026-07-29' })
  })
  it("ships the calculator's own styles but not the standalone page ground", () => {
    // The host owns <html>, <body> and #root. The calculator's component rules
    // (the sheet, the warnings, the setup screen) still have to come along.
    const source = readFileSync(join(__dirname, '..', 'embed.ts'), 'utf8')
    expect(source).toContain("import './ui/styles.css'")
    expect(source).toContain("import './styles/calculator.css'")
    expect(source).not.toContain('app.css')
    const calculator = readFileSync(join(__dirname, '..', 'styles', 'calculator.css'), 'utf8')
    expect(calculator).toMatch(/\.sl-sheet__times\s*\{/)
    expect(calculator).not.toMatch(/^(html|body|#root)\b/m)
  })
})
