import { describe, expect, it } from 'vitest'
import {
  amountInputFor,
  formatIsoDateAu,
  parseAmount,
  parsePercent,
  percentInputFor,
} from '../inputs'

describe('parseAmount', () => {
  it('reads what people actually type', () => {
    expect(parseAmount('611')).toBe(611)
    expect(parseAmount('$611.00')).toBe(611)
    expect(parseAmount('4,908.32')).toBe(4908.32)
    expect(parseAmount(' 611 ')).toBe(611)
  })

  it('returns null for anything that is not a figure', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('  ')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    // Mid-edit states. The field keeps the string; only the engine sees null.
    expect(parseAmount('$')).toBeNull()
    expect(parseAmount('-50')).toBeNull()
  })

  it('keeps a partly typed decimal usable', () => {
    // '5.' parses as 5 rather than NaN, so the arithmetic panel does not blank
    // out between the point and the digit after it.
    expect(parseAmount('5.')).toBe(5)
  })
})

describe('parsePercent', () => {
  it('converts whole percents to the fraction the engine wants', () => {
    expect(parsePercent('5')).toBe(0.05)
    expect(parsePercent('5%')).toBe(0.05)
    expect(parsePercent('12.5')).toBe(0.125)
    expect(parsePercent('')).toBeNull()
  })

  it('round-trips through percentInputFor', () => {
    expect(percentInputFor(0.05)).toBe('5')
    expect(percentInputFor(0.125)).toBe('12.5')
    // Nothing packaged reads as an empty field, not as a typed zero.
    expect(percentInputFor(0)).toBe('')
    expect(parsePercent(percentInputFor(0.075))).toBe(0.075)
  })
})

describe('amountInputFor', () => {
  it('seeds a field without the affixes the field already draws', () => {
    expect(amountInputFor(95_698)).toBe('95698')
    expect(amountInputFor(4908.32)).toBe('4908.32')
    expect(amountInputFor(null)).toBe('')
    expect(amountInputFor(0)).toBe('')
  })
})

describe('formatIsoDateAu', () => {
  it('puts the day first', () => {
    expect(formatIsoDateAu('2025-12-04')).toBe('04/12/2025')
  })
})
