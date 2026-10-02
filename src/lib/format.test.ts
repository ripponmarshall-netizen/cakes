import { describe, expect, it } from 'vitest'
import { formatHands, formatMoney, monthsLabel } from './format'

describe('formatHands', () => {
  it('uses the singular only for a half or one hand', () => {
    expect(formatHands(0)).toBe('0 hands')
    expect(formatHands(0.5)).toBe('½ hand')
    expect(formatHands(1)).toBe('1 hand')
    expect(formatHands(1.5)).toBe('1½ hands')
    expect(formatHands(2)).toBe('2 hands')
  })
})

describe('formatMoney', () => {
  it('drops .00 on whole amounts and uses a real minus sign', () => {
    expect(formatMoney(12000)).toBe('J$12,000')
    expect(formatMoney(12.5)).toBe('J$12.50')
    expect(formatMoney(-26000)).toBe('−J$26,000')
    expect(formatMoney(Number.NaN)).toBe('J$0')
  })
})

describe('monthsLabel', () => {
  it('collapses runs of months', () => {
    expect(monthsLabel([3])).toBe('Month 3')
    expect(monthsLabel([3, 4, 5])).toBe('Months 3–5')
    expect(monthsLabel([1, 3])).toBe('Months 1, 3')
  })
})
