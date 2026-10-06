import { describe, expect, it } from 'vitest'
import { nextRoundName, nextRoundStart } from './rounds'

describe('nextRoundName', () => {
  it('counts up an existing round number', () => {
    expect(nextRoundName('Station partner (round 2)')).toBe('Station partner (round 3)')
  })
  it('moves the last year in the name on by one', () => {
    expect(nextRoundName('Fire Station Partner 2026')).toBe('Fire Station Partner 2027')
    expect(nextRoundName('2025–2026 Circle')).toBe('2025–2027 Circle')
  })
  it('otherwise starts round 2', () => {
    expect(nextRoundName('Church Sister Circle')).toBe('Church Sister Circle (round 2)')
  })
})

describe('nextRoundStart', () => {
  it('starts the month after the last one, on the same day', () => {
    expect(nextRoundStart('2026-03-15', 12)).toBe('2027-03-15')
    expect(nextRoundStart('2026-01-31', 1)).toBe('2026-02-28')
  })
})
