import { describe, expect, it } from 'vitest'
import {
  arrearsByPeriod,
  buildSchedule,
  drawPeriod,
  drawsDueSoon,
  effectiveDrawOrder,
  moveSlot,
  partnerTerms,
  periodRows,
  rawCurrentPeriod,
  scheduleOrder,
  serializeSpec,
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
  share_schedule: false,
  pay_details: null,
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
  share_token: `t-${id}`,
  replaced_by: null,
  left_on: null,
  transfer_mode: null,
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
  method: 'cash',
  ref: null,
  note: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
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
  kind: 'draw',
  method: 'cash',
  ref: null,
  paid_on: '2026-01-15',
  note: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
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
        const drawsByM = Array.from({ length: H }, (_, i) => drawPeriod(i + 1, H, T)).filter((p) => p <= m).length
        expect(drawsByM * T).toBeLessThanOrEqual(m * H) // draws × (A·T) ≤ collections (A·H·m)
      }
      expect(drawPeriod(H, H, T)).toBe(T)
    }
  })

  it('reconciles the stored order with members and hands', () => {
    const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
    expect(effectiveDrawOrder(members, ['c', 'gone', 'a', 'c']).map(serializeSpec)).toEqual(['c', 'a', 'a', 'b'])
  })

  it('matches payouts to the slot in the same month first', () => {
    const members = [member('a', 2, 1), member('b', 1, 2), member('c', 1, 3)]
    const p = partner({ draw_order: ['b', 'a', 'c', 'a'] })
    const sched = buildSchedule(p, members, [payout('a', 4, 40000, 2000)])
    expect(sched.map((s) => [s.shares[0].memberId, s.period, !!s.shares[0].payout])).toEqual([
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

describe('half hands', () => {
  it('pairs two half hands into one shared draw', () => {
    const members = [member('a', 1, 1), member('b', 0.5, 2), member('c', 1, 3), member('d', 0.5, 4)]
    const p = partner({ term_months: 3 })
    const sched = buildSchedule(p, members, [])
    expect(scheduleOrder(sched)).toEqual(['a', 'b|d', 'c'])
    expect(sched.map((s) => s.period)).toEqual([1, 2, 3])
    const shared = sched[1]
    expect(shared.half).toBe(true)
    expect(shared.shares.map((s) => [s.memberId, s.gross, s.fee, s.net])).toEqual([
      ['b', 15000, 1000, 14000],
      ['d', 15000, 1000, 14000],
    ])
  })

  it('charges and pays a half hand half', () => {
    const members = [member('a', 1, 1), member('b', 0.5, 2), member('c', 1.5, 3)]
    const s = summarizePartner(partner({ term_months: 3 }), members, [], [], new Date(2026, 0, 20))
    expect(s.totalHands).toBe(3)
    expect(s.monthlyCollection).toBe(30000)
    const b = s.members.find((m) => m.member.id === 'b')!
    const c = s.members.find((m) => m.member.id === 'c')!
    expect(b.monthlyDue).toBe(5000)
    expect(b.entitlementGross).toBe(15000)
    expect(c.monthlyDue).toBe(15000)
    expect(c.entitlementGross).toBe(45000)
    expect(c.entitlementNet).toBe(45000 - 3000)
    expect(s.feesProjected).toBe(6000) // 3 hands × J$2,000
    expect(s.drawsCount).toBe(4) // a, c (full), b|c (shared)
  })

  it('keeps collections ahead of draws with an odd half', () => {
    // 2.5 hands over 3 months: the lone half draws last.
    const members = [member('a', 1, 1), member('b', 1, 2), member('c', 0.5, 3)]
    const sched = buildSchedule(partner({ term_months: 3 }), members, [])
    expect(scheduleOrder(sched)).toEqual(['a', 'b', 'c|'])
    const T = 3
    for (let m = 1; m <= T; m++) {
      const drawnHalves = sched.filter((s) => s.period <= m).reduce((n, s) => n + (s.half ? s.shares.length : 2), 0)
      expect(drawnHalves * T).toBeLessThanOrEqual(m * 5)
    }
  })

  it('reconciles when hands go up or down by a half', () => {
    // b went from ½ to 1, d left: b's lone half becomes a whole draw in place.
    const members = [member('a', 1, 1), member('b', 1, 2)]
    expect(effectiveDrawOrder(members, ['b|d', 'a']).map(serializeSpec)).toEqual(['b', 'a'])
    // a went from 1 to ½: keeps the position as a half, waits for a partner.
    const m2 = [member('a', 0.5, 1), member('b', 1, 2), member('c', 0.5, 3)]
    expect(effectiveDrawOrder(m2, ['b', 'a']).map(serializeSpec)).toEqual(['b', 'a|c'])
    // two strays merge into one shared draw
    const m3 = [member('a', 0.5, 1), member('b', 0.5, 2)]
    expect(effectiveDrawOrder(m3, ['a|x', 'b|y']).map(serializeSpec)).toEqual(['a|b'])
  })

  it('attaches payouts to the right half share', () => {
    const members = [member('a', 0.5, 1), member('b', 0.5, 2)]
    const sched = buildSchedule(partner({ term_months: 1 }), members, [payout('b', 1, 5000, 1000)])
    expect(sched[0].shares.map((s) => !!s.payout)).toEqual([false, true])
    expect(sched[0].locked).toBe(true)
    expect(sched[0].done).toBe(false)
  })

  it('moves and shuffles shared slots as one unit', () => {
    const members = [member('a', 1, 1), member('b', 0.5, 2), member('c', 0.5, 3), member('d', 1, 4)]
    const sched = buildSchedule(partner({ term_months: 3 }), members, [])
    expect(moveSlot(scheduleOrder(sched), 1, 0)).toEqual(['b|c', 'a', 'd'])
    expect([...shuffleUnpaid(sched, () => 0)].sort()).toEqual(['a', 'b|c', 'd'])
  })
})

describe('voids, replacements and risk', () => {
  const today = new Date(2026, 1, 20) // period 2

  it('ignores voided payments and payouts', () => {
    const members = [member('a', 1, 1), member('b', 1, 2)]
    const c = { ...contribution('a', 1, 10000), voided_at: '2026-01-16T00:00:00Z' }
    const po = { ...payout('a', 1, 20000, 0), voided_at: '2026-01-16T00:00:00Z' }
    const s = summarizePartner(partner({ term_months: 2, fee_value: 0 }), members, [c], [po], today)
    expect(s.collected).toBe(0)
    expect(s.paidOutGross).toBe(0)
    expect(s.nextDraw?.index).toBe(0)
    const rows = periodRows(partner(), members, [c], 1)
    expect(rows[0].entries).toHaveLength(0)
    expect(rows[0].voided).toHaveLength(1)
  })

  it('credits a buy-out to the new member', () => {
    const a = { ...member('a', 1, 1), replaced_by: 'n', transfer_mode: 'buyout' as const }
    const members = [a, member('b', 1, 2), member('n', 1, 5)]
    const p = partner({ term_months: 2, draw_order: ['n', 'b'] })
    const contributions = [contribution('a', 1, 10000), contribution('b', 1, 10000), contribution('n', 2, 10000)]
    const s = summarizePartner(p, members, contributions, [payout('a', 1, 20000, 2000)], today)
    expect(s.members.map((m) => m.member.id)).toEqual(['b', 'n'])
    const n = s.members.find((m) => m.member.id === 'n')!
    expect(n.paid).toBe(20000)
    expect(n.behind).toBe(0)
    expect(n.received).toBe(18000)
    expect(s.schedule[0].shares[0].payout).not.toBeNull()
    expect(s.former).toHaveLength(1)
    expect(s.former[0].paid).toBe(10000)
    expect(periodRows(p, members, contributions, 1).find((r) => r.member.id === 'n')!.status).toBe('paid')
  })

  it('starts a refund replacement from scratch and takes the refund out of the pot', () => {
    const a = { ...member('a', 1, 1), replaced_by: 'n', transfer_mode: 'refund' as const }
    const members = [a, member('b', 1, 2), member('n', 1, 5)]
    const refund = { ...payout('a', 2, 10000, 0), kind: 'refund' as const }
    const contributions = [contribution('a', 1, 10000), contribution('b', 1, 10000), contribution('b', 2, 10000)]
    const s = summarizePartner(partner({ term_months: 2 }), members, contributions, [refund], today)
    const n = s.members.find((m) => m.member.id === 'n')!
    expect(n.paid).toBe(0)
    expect(n.behind).toBe(20000)
    expect(s.refunds).toBe(10000)
    expect(s.pot).toBe(20000)
    expect(s.feesEarned).toBe(0)
    expect(s.former[0].refunded).toBe(10000)
  })

  it('keeps a replacement in the old member’s draw seat when the order was never saved', () => {
    const a = { ...member('a', 1, 1), replaced_by: 'n', transfer_mode: 'buyout' as const }
    const members = [a, member('b', 1, 2), member('c', 1, 3), member('n', 1, 5)]
    const order = effectiveDrawOrder(members, []).map((s) => s.ids.join('|'))
    expect(order).toEqual(['n', 'b', 'c'])
  })

  it('reads a stale id in the saved order as the member who took the seat', () => {
    const a = { ...member('a', 1, 1), replaced_by: 'n', transfer_mode: 'refund' as const }
    const members = [a, member('b', 1, 2), member('c', 1, 3), member('n', 1, 5)]
    const order = effectiveDrawOrder(members, ['c', 'a', 'b']).map((s) => s.ids.join('|'))
    expect(order).toEqual(['c', 'n', 'b'])
  })

  it('flags members who drew and still owe', () => {
    const members = [member('a', 1, 1), member('b', 1, 2), member('c', 1, 3), member('d', 1, 4)]
    const contributions = [
      contribution('a', 1, 10000),
      contribution('b', 1, 10000),
      contribution('b', 2, 10000),
      contribution('c', 1, 10000),
      contribution('c', 2, 10000),
    ]
    const s = summarizePartner(partner(), members, contributions, [payout('a', 1, 40000, 2000)], today)
    const a = s.members.find((m) => m.member.id === 'a')!
    expect(a.exposure).toBe(30000) // drew 40k gross, paid in 10k
    expect(a.risk).toBe('high') // and missed month 2
    expect(s.members.find((m) => m.member.id === 'b')!.risk).toBeNull()
    expect(s.exposure).toBe(30000)
    expect(s.atRisk).toBe(1)
  })

  it('works out arrears month by month, net of paying ahead', () => {
    const members = [member('a', 1, 1)]
    const p = partner({ term_months: 6 })
    expect(arrearsByPeriod(p, members, [contribution('a', 1, 4000)], 'a', 3)).toEqual([
      { period: 1, amount: 6000 },
      { period: 2, amount: 10000 },
      { period: 3, amount: 10000 },
    ])
    // Paid month 5 ahead: only 16k of the 26k gap is really owed.
    expect(arrearsByPeriod(p, members, [contribution('a', 1, 4000), contribution('a', 5, 10000)], 'a', 3)).toEqual([
      { period: 1, amount: 6000 },
      { period: 2, amount: 10000 },
    ])
  })

  it('lists draws due within a week, including overdue', () => {
    const members = [member('a', 1, 1), member('b', 1, 2), member('c', 1, 3), member('d', 1, 4)]
    const p = partner()
    const s = summarizePartner(p, members, [], [payout('a', 1, 40000, 2000)], new Date(2026, 2, 10))
    // Month 2 (Feb 15) is overdue, month 3 starts Mar 15 — within 7 days of Mar 10.
    expect(drawsDueSoon(p, s, new Date(2026, 2, 10)).map((d) => d.memberId)).toEqual(['b', 'c'])
  })
})
