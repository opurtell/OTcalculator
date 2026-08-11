/**
 * The result-panel row builders (§5.4, §5.7), as pure data.
 *
 * Same golden fortnight as the engine and pathway tests — AP1 Step 2, one
 * Saturday 10h pickup and one Wednesday 2h overrun — fed through the real
 * engine, then asserted at the row level where the comparison, the per-shift
 * breakdown and the derivation live. No rendering here: that is the pathway
 * test's job.
 */

import { describe, expect, it } from 'vitest'
import { resolveSettings } from '../settings'
import type { CalculatorChoices } from '../settings'
import { calculateFortnight } from '../../engine/fortnight'
import type { OtShift } from '../../engine/types'
import {
  breakdownRows,
  comparisonRows,
  mealAllowanceRows,
  mealDerivationRows,
  mealRuleSentence,
  ordinaryPayRows,
  overtimeDerivationRows,
  overtimeRateRows,
  paygRows,
} from '../breakdown'

const CHOICES: CalculatorChoices = {
  band: { classification: 'AP1', step: 2, annualBase: null, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  pathway: 'fortnight',
}

const resolved = resolveSettings(CHOICES, '2026-02-11')
if (resolved === null) throw new Error('AP1 Step 2 should resolve')
const { settings } = resolved

/** Round to cents the way the display layer will, for readable assertions. */
const cents = (value: number) => Math.round(value * 100) / 100

const SATURDAY: OtShift = {
  id: 'sat',
  date: '2026-08-15',
  startMin: 9 * 60,
  endMin: 19 * 60,
  endsNextDay: false,
  kind: 'separate',
}
const WEDNESDAY: OtShift = {
  id: 'wed',
  date: '2026-08-19',
  startMin: 9 * 60,
  endMin: 11 * 60,
  endsNextDay: false,
  kind: 'overrun',
}

const result = calculateFortnight([SATURDAY, WEDNESDAY], settings)

describe('comparisonRows', () => {
  const { columns, rows } = comparisonRows(result)
  const by = (label: string) => rows.find((r) => r.label === label)!

  it('uses Without OT and With OT columns', () => {
    expect(columns).toEqual(['Without OT', 'With OT'])
  })

  it('anchors on a base pay identical either side — overtime does not change it', () => {
    const base = by('Base pay')
    expect(base.values[0]).toBe(base.values[1])
    expect(cents(base.values[0] as number)).toBe(4908.32)
  })

  it('shows overtime only on the with side, and hangs the per-shift rows off it', () => {
    const ot = by('Overtime')
    expect(ot.values[0]).toBe('—')
    expect(cents(ot.values[1] as number)).toBe(1110.33)
    expect(ot.derivation).toHaveLength(2)
  })

  it('carries PAYG both ways — why the delta is not the marginal rate', () => {
    const payg = by('PAYG tax')
    expect(cents(payg.values[0] as number)).toBe(1208.0)
    expect(cents(payg.values[1] as number)).toBe(1620.0)
  })

  it('totals take-home both ways', () => {
    const net = by('Take-home')
    // Still the table's total row here, because neither §4.5 shift earns a meal
    // allowance — see `mealFortnight` below for the shape when one does.
    expect(net.total).toBe(true)
    expect(net.tone).toBe('net')
    expect(cents(net.values[0] as number)).toBe(3700.32)
    expect(cents(net.values[1] as number)).toBe(4398.66)
  })

  it('leaves out the rows that did not move the figure', () => {
    expect(rows.some((r) => r.label === 'Pre-tax deductions')).toBe(false)
    expect(rows.some((r) => r.label === 'Study loan')).toBe(false)
    // No N36 occasion, so no untaxed line and no second bottom line.
    expect(rows.some((r) => r.label === 'Meal allowance')).toBe(false)
    expect(rows.some((r) => r.label === 'Total in the hand')).toBe(false)
  })
})

/**
 * The same band with a shift that does earn the allowance: an AM picked up and
 * entered as one period that ran to 18:00 — a 10-hour shift taken to 11.5. One
 * occasion, $35.38 untaxed.
 */
const mealFortnight = calculateFortnight(
  [
    {
      id: 'am-run-on',
      date: '2026-08-19',
      startMin: 6 * 60 + 30,
      endMin: 18 * 60,
      endsNextDay: false,
      kind: 'separate',
    },
  ],
  settings,
)

describe('comparisonRows with a meal allowance', () => {
  const { rows } = comparisonRows(mealFortnight)
  const by = (label: string) => rows.find((r) => r.label === label)!

  it('puts the tax-free meal allowance below the tax lines, not above them', () => {
    // Above PAYG it would read as an amount PAYG took a cut of.
    const meal = by('Meal allowance')
    expect(meal.values[0]).toBe('—')
    expect(cents(meal.values[1] as number)).toBe(35.38)
    expect(meal.note).toContain('Tax free')
    expect(meal.note).toContain('EBA N36')
    expect(meal.derivation).toHaveLength(1)

    const order = rows.map((r) => r.label)
    expect(order.indexOf('Meal allowance')).toBeGreaterThan(order.indexOf('PAYG tax'))
    expect(order.indexOf('Meal allowance')).toBeGreaterThan(order.indexOf('Take-home'))
  })

  it('demotes take-home to a sub-total and ends on what reaches the account', () => {
    expect(by('Take-home').total).toBe(false)

    const total = rows[rows.length - 1]
    expect(total.label).toBe('Total in the hand')
    expect(total.total).toBe(true)
    // Untaxed, so the without-OT column is unchanged: no overtime, no N36.
    expect(cents(total.values[0] as number)).toBe(
      cents(mealFortnight.withoutOt.net),
    )
    expect(cents(total.values[1] as number)).toBe(cents(mealFortnight.netTotal))
    expect(
      cents((total.values[1] as number) - (by('Take-home').values[1] as number)),
    ).toBe(35.38)
  })
})

describe('mealDerivationRows', () => {
  const rows = mealDerivationRows(mealFortnight.mealAllowance.occasions)

  it('names the date and the shift it was earned on', () => {
    expect(rows.map((r) => r.label)).toEqual(['Wed 19 Aug AM shift'])
    // `FigureTable` keys its rows on the label, so a collision here would drop a
    // row rather than merely reading badly.
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length)
  })

  it('shows the arithmetic behind it — how far over, on what shift', () => {
    expect(rows[0].note).toContain('1h 30m past the 10h AM shift')
    expect(rows[0].note).toContain('second meal break is owed')
    expect(cents(rows[0].values[0] as number)).toBe(35.38)
    // Entered whole, so it does not claim the shift was inferred.
    expect(rows[0].note).not.toContain('ran on from')
  })

  it('says when the shift was inferred rather than entered', () => {
    // An AM overrun: the shift itself was never typed in, so the working has to
    // name the assumption before anyone can agree with the figure.
    const overrun = calculateFortnight(
      [
        {
          id: 'am-overrun',
          date: '2026-08-19',
          startMin: 16 * 60 + 30,
          endMin: 18 * 60,
          endsNextDay: false,
          kind: 'overrun',
        },
      ],
      settings,
    )
    const note = mealDerivationRows(overrun.mealAllowance.occasions)[0].note!
    expect(note).toContain('AM shift it ran on from')
  })
})

describe('mealAllowanceRows', () => {
  it('names the rate, the count and the fact that it is not taxed', () => {
    const rows = mealAllowanceRows(mealFortnight)
    expect(cents(rows[0].values[0] as number)).toBe(35.38)
    expect(rows[0].note).toContain('Annex C')
    expect(rows[1].values[0]).toBe('1')
    expect(rows[1].note).toContain('10-hour shift')
    expect(cents(rows[2].values[0] as number)).toBe(35.38)
    expect(rows[2].note).toContain('after tax')
  })

  it('reports zero occasions rather than disappearing', () => {
    // The §5.7 section is how someone checks whether payroll owed them one, and
    // a working that only appears once the app already agrees is no use for it.
    // It matters more under this reading than it would under a looser one: a
    // shift the app cannot place earns nothing and says nothing on its own row.
    const rows = mealAllowanceRows(result)
    expect(rows[1].values[0]).toBe('0')
    expect(rows[1].note).toContain('No 10-hour shift')
    expect(rows[2].values[0]).toBe(0)
  })
})

describe('mealRuleSentence', () => {
  it("states the rule using the engine's own thresholds", () => {
    // Built from the constants rather than written out, so the sentence cannot
    // drift away from what the engine actually does.
    expect(mealRuleSentence()).toBe(
      'A 10h shift that runs 1h or more over earns one allowance (EBA N36). Worked to time it earns nothing, whether or not you got a break.',
    )
  })
})

describe('overtimeDerivationRows', () => {
  const rows = overtimeDerivationRows(result.attendances)

  it('is one row per attendance, in calendar order, labelled by date', () => {
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe('Sat 15 Aug')
    expect(rows[1].label).toBe('Wed 19 Aug')
  })

  it('carries the rate breakdown as the note — the same line the shift row shows', () => {
    expect(rows[0].note).toBe('10h · all at 2× (Saturday)')
    expect(rows[1].note).toBe('2h · all at 1.5×')
  })

  it('values each attendance at its pay', () => {
    expect(cents(rows[0].values[0] as number)).toBe(965.51)
    expect(cents(rows[1].values[0] as number)).toBe(144.83)
  })
})

describe('ordinaryPayRows', () => {
  const rows = ordinaryPayRows(settings)

  it('builds from base up to the fortnightly figure', () => {
    expect(rows.map((r) => r.label)).toEqual([
      'Base salary',
      'Composite penalties',
      'Roster adjustment',
      'Fortnightly ordinary pay',
    ])
  })

  it('starts from base salary and cites the clauses behind each component', () => {
    expect(cents(rows[0].values[0] as number)).toBe(95698.0)
    expect(rows[1].note).toContain('31.58%')
    expect(rows[1].note).toContain('(EBA N25.1)')
    expect(rows[2].note).toContain('2.20%')
    expect(rows[2].note).toContain('(EBA N44)')
  })

  it('derives the fortnightly total via 12 ÷ 313', () => {
    const total = rows[3]
    expect(total.total).toBe(true)
    expect(total.note).toContain('× 12 ÷ 313')
    expect(cents(total.values[0] as number)).toBe(4908.32)
  })
})

describe('overtimeRateRows', () => {
  const rows = overtimeRateRows(settings)

  it('cites N34.1 and derives every multiplier from base only', () => {
    expect(rows[0].note).toContain('EBA N34.1')
    expect(rows.map((r) => r.values[0])).toEqual([
      '$48.28/h',
      '$72.41/h',
      '$96.55/h',
      '$120.69/h',
    ])
  })
})

describe('paygRows', () => {
  const rows = paygRows(settings, result)

  it('names the NAT 1004 scale', () => {
    expect(rows[1].note).toContain('ATO NAT 1004')
    expect(rows[1].note).toContain('Scale 2')
  })

  it('shows what tax was worked out on, and the tax itself', () => {
    expect(rows[0].label).toBe('Taxed on')
    expect(cents(rows[0].values[0] as number)).toBe(6018.66)
    expect(rows[1].label).toBe('PAYG tax')
    expect(cents(rows[1].values[0] as number)).toBe(1620.0)
  })
})

describe('breakdownRows (no-overtime single column)', () => {
  const empty = calculateFortnight([], settings)
  const rows = breakdownRows(empty)

  it('is one column — base, PAYG, take-home — with nothing that did not move', () => {
    expect(rows.map((r) => r.label)).toEqual(['Base pay', 'PAYG tax', 'Take-home'])
    expect(rows.every((r) => r.values.length === 1)).toBe(true)
  })
})
