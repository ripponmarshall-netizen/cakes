import { describe, expect, it } from 'vitest'
import {
  buildSchedule,
  drawPeriod,
  effectiveDrawOrder,
  partnerTerms,
  periodRows,
  rawCurrentPeriod,
  shuffleUnpaid,
  summarizePartner,
} from './calc'
import type { Contribution, Member, Partner, Payout } from './types'

const partner = (over: Partial<Partner> = {}): Partner => ({
  id: 'p1',
  name: 'Test',
  hand_amount: 10000,
  start_date: '2026-01-15',
  term_months: 4,
  fee_type: 'flat',
  fee_value: 2000,
  draw_order: [],
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
})

const member = (id: string, hands = 1, n = 0): Member => ({
  id,
  partner_id: 'p1',
  name: id.toUpperCase(),
  phone: null,
  hands,
  notes: null,
  created_at: `2026-01-01T00:00:0${n}Z`,
})

let seq = 0
const contribution = (member_id: string, period: number, amount: number): Contribution => ({
  id: `c${++seq}`,
  partner_id: 'p1',
  member_id,
  period,
  amount,
  paid_on: '2026-01-15',
  note: null,
  created_at: `2026-01-15T00:00:${String(seq).padStart(2, '0')}Z`,
})

const payout = (member_id: string, period: number, gross: number, fee: number): Payout => ({
  id: `po${++seq}`,
  partner_id: 'p1',
  member_id,
  period,
  gross,
  fee,
  net: gross - fee,
  paid_on: '2026-01-15',
  note: null,
  created_at: `2026-01-15T00:00:${String(seq).padStart(2, '0')}Z`,
})

describe('partnerTerms', () => {
  it('computes a flat fee draw', () => {
    expect(partnerTerms(partner())).toEqual({ hand: 10000, grossPerDraw: 40000, feePerDraw: 2000, netPerDraw: 38000 })
  })
  it('computes a percent fee draw, rounded to cents', () => {
    const t = partnerTerms(partner({ hand_amount: 333.33, term_months: 3, fee_type: 'percent', fee_value: 2.5 }))
    expect(t.grossPerDraw).toBe(999.99)
    expect(t.feePerDraw).toBe(25) // 24.99975 -> 25.00
    expect(t.netPerDraw).toBe(974.99)
  })
  it('caps a flat fee at the draw amount', () => {
    expect(partnerTerms(partner({ fee_value: 999999 })).netPerDraw).toBe(0)
  })
})

describe('rawCurrentPeriod', () => {
  it('counts months from the start day', () => {
    expect(rawCurrentPeriod('2026-01-15', new Date(2026, 0, 14))).toBe(0)
    expect(rawCurrentPeriod('2026-01-15', new Date(2026, 0, 15))).toBe(1)
    expect(rawCurrentPeriod('2026-01-15', new Date(2026, 1, 14))).toBe(1)
    expect(rawCurrentPeriod('2026-01-15', new Date(2026, 1, 15))).toBe(2)
    expect(rawCurrentPeriod('2026-01-15', new Date(2027, 0, 20))).toBe(13)
  })
  it('clamps the start day in short months', () => {
    expect(rawCurrentPeriod('2026-01-31', new Date(2026, 1, 27))).toBe(1)
    expect(rawCurrentPeriod('2026-01-31', new Date(2026, 1, 28))).toBe(2)
  })
})

describe('draw schedule', () => {
  it('spreads draws so collections always cover them', () => {
    for (const [H, T] of [
      [12, 12],
      [12, 6],
      [6, 12],
      [7, 5],
      [5, 7],
    ]) {
      for (let m = 1; m <= T; m++) {
        const drawsByM = Array.from({ length: H }, (_, i) => drawPeriod(i, H, T)).filter((p) => p <= m).length
        expect(drawsByM * T).toBeLessThanOrEqual(m * H) // draws × (A·T) ≤ collections (A·H·m)
      }
      expect(drawPeriod(H - 1, H, T)).toBe(T)
    }
  })

  it('reconciles the stored order with members and hands', () => {
    const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
    expect(effectiveDrawOrder(members, ['c', 'gone', 'a', 'c'])).toEqual(['c', 'a', 'a', 'b'])
  })

  it('matches payouts to the slot in the same month first', () => {
    const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
    const p = partner({ draw_order: ['b', 'a', 'c', 'a'] })
    const sched = buildSchedule(p, members, [payout('a', 4, 40000, 2000)])
    expect(sched.map((s) => [s.memberId, s.period, !!s.payout])).toEqual([
      ['b', 1, false],
      ['a', 2, false],
      ['c', 3, false],
      ['a', 4, true],
    ])
  })

  it('shuffles only open draws', () => {
    const members = [member('a', 1, 1), member('b', 1, 2), member('c', 1, 3), member('d', 1, 4)]
    const sched = buildSchedule(partner(), members, [payout('a', 1, 40000, 2000)])
    const order = shuffleUnpaid(sched, () => 0)
    expect(order[0]).toBe('a')
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('summarizePartner', () => {
  const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
  const today = new Date(2026, 1, 20) // period 2

  it('tracks pot, arrears and entitlements', () => {
    const contributions = [
      contribution('a', 1, 20000),
      contribution('b', 1, 10000),
      contribution('c', 1, 10000),
      contribution('a', 2, 20000),
      contribution('b', 2, 5000),
      contribution('c', 2, 10000),
      contribution('c', 3, 10000), // paid ahead
    ]
    const payouts = [payout('a', 1, 40000, 2000)]
    const s = summarizePartner(partner(), members, contributions, payouts, today)

    expect(s.status).toBe('active')
    expect(s.period).toBe(2)
    expect(s.totalHands).toBe(4)
    expect(s.monthlyCollection).toBe(40000)
    expect(s.cycleTotal).toBe(160000)
    expect(s.collected).toBe(85000)
    expect(s.paidOutGross).toBe(40000)
    expect(s.feesEarned).toBe(2000)
    expect(s.pot).toBe(45000)
    expect(s.behind).toBe(5000)
    expect(s.ahead).toBe(10000)
    expect(s.potIfPaidUp).toBe(50000)
    expect(s.feesProjected).toBe(8000)

    const a = s.members.find((m) => m.member.id === 'a')!
    expect(a.entitlementGross).toBe(80000)
    expect(a.entitlementNet).toBe(76000)
    expect(a.received).toBe(38000)
    expect(a.toReceive).toBe(38000)
    expect(a.stillToPay).toBe(40000)
    expect(s.nextDraw?.index).toBe(1)
  })

  it('reports status before and after the cycle', () => {
    expect(summarizePartner(partner(), members, [], [], new Date(2025, 11, 1)).status).toBe('upcoming')
    const done = summarizePartner(partner(), members, [], [], new Date(2026, 6, 1))
    expect(done.status).toBe('complete')
    expect(done.period).toBe(4)
    expect(done.dueToDate).toBe(160000)
  })
})

describe('periodRows', () => {
  it('flags paid, partial and unpaid', () => {
    const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
    const rows = periodRows(partner(), members, [contribution('a', 1, 20000), contribution('b', 1, 4000)], 1)
    expect(rows.map((r) => [r.member.id, r.status, r.remaining])).toEqual([
      ['a', 'paid', 0],
      ['b', 'partial', 6000],
      ['c', 'unpaid', 10000],
    ])
  })
})
