import type { Contribution, Member, Partner, Payout } from './types'

/*
 * All partner maths lives here as pure functions so it can be unit-tested.
 * Money is summed in integer cents to avoid floating-point drift, then returned
 * in dollars.
 *
 * Model (rotating draw):
 *   - Each hand pays `hand_amount` every month for `term_months` months.
 *   - Each hand draws once. A draw is worth hand_amount × term_months (gross);
 *     the banker's fee comes out of that, the member receives the rest (net).
 *   - With H hands over T months, hand #i (0-based) draws in month ceil((i+1)·T/H).
 *     When T = H that's one draw a month (the classic partner). This spacing
 *     guarantees the money collected by any month always covers the draws due,
 *     as long as everyone pays.
 */

export const toCents = (n: number | string | null | undefined): number => {
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v * 100) : 0
}
const dollars = (cents: number): number => cents / 100

// ─── Dates & periods ────────────────────────────────────────────────────────

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

/** Calendar date on which a period (1-based) starts. Day is clamped for short months. */
export function periodStartDate(startIso: string, period: number): Date {
  const { y, m, d } = parseIsoDate(startIso)
  const monthIndex = m + (period - 1)
  const year = y + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  return new Date(year, month, Math.min(d, daysInMonth(year, month)))
}

/**
 * Which period `today` falls in. 1 = first month. Can be ≤ 0 (not started) or
 * > term (finished) — callers clamp as needed.
 */
export function rawCurrentPeriod(startIso: string, today: Date = new Date()): number {
  const { y, m } = parseIsoDate(startIso)
  let period = (today.getFullYear() - y) * 12 + (today.getMonth() - m) + 1
  if (today < periodStartDate(startIso, period)) period -= 1
  return period
}

export type PartnerStatus = 'upcoming' | 'active' | 'complete'

// ─── Partner terms ──────────────────────────────────────────────────────────

export interface Terms {
  hand: number // per hand, per month
  grossPerDraw: number
  feePerDraw: number
  netPerDraw: number
}

type TermsInput = Pick<Partner, 'hand_amount' | 'term_months' | 'fee_type' | 'fee_value'>

function termsCents(p: TermsInput) {
  const hand = toCents(p.hand_amount)
  const gross = hand * p.term_months
  const fee =
    p.fee_type === 'percent'
      ? Math.round((gross * Math.min(Number(p.fee_value) || 0, 100)) / 100)
      : Math.min(toCents(p.fee_value), gross)
  return { hand, gross, fee, net: gross - fee }
}

export function partnerTerms(p: TermsInput): Terms {
  const c = termsCents(p)
  return {
    hand: dollars(c.hand),
    grossPerDraw: dollars(c.gross),
    feePerDraw: dollars(c.fee),
    netPerDraw: dollars(c.net),
  }
}

// ─── Draw schedule ──────────────────────────────────────────────────────────

export interface DrawSlot {
  index: number // 0-based position in the draw order
  memberId: string
  period: number // month this hand draws
  handNo: number // 1 for a member's first hand, 2 for their second, …
  payout: Payout | null
}

const byCreated = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at)

/**
 * The stored draw order, reconciled with the current members and their hands:
 * stale ids and surplus hands are dropped, missing hands are appended in the
 * order members joined. Returns one member id per hand.
 */
export function effectiveDrawOrder(members: Member[], stored: string[]): string[] {
  const remaining = new Map(members.map((m) => [m.id, m.hands]))
  const order: string[] = []
  for (const id of stored) {
    const left = remaining.get(id) ?? 0
    if (left > 0) {
      order.push(id)
      remaining.set(id, left - 1)
    }
  }
  for (const m of [...members].sort(byCreated)) {
    for (let left = remaining.get(m.id) ?? 0; left > 0; left--) order.push(m.id)
  }
  return order
}

/** Month (1-based) in which the hand at `index` draws. */
export function drawPeriod(index: number, totalHands: number, termMonths: number): number {
  return Math.ceil(((index + 1) * termMonths) / totalHands)
}

export function buildSchedule(partner: Partner, members: Member[], payouts: Payout[]): DrawSlot[] {
  const order = effectiveDrawOrder(members, partner.draw_order ?? [])
  const total = order.length
  const handCount = new Map<string, number>()

  const slots: DrawSlot[] = order.map((memberId, index) => {
    const handNo = (handCount.get(memberId) ?? 0) + 1
    handCount.set(memberId, handNo)
    return { index, memberId, period: drawPeriod(index, total, partner.term_months), handNo, payout: null }
  })

  // Attach payouts: first to a slot of the same member in the same month, then
  // any leftovers to that member's earliest open slots.
  const leftovers: Payout[] = []
  for (const p of [...payouts].sort((a, b) => a.period - b.period || byCreated(a, b))) {
    const slot = slots.find((s) => !s.payout && s.memberId === p.member_id && s.period === p.period)
    if (slot) slot.payout = p
    else leftovers.push(p)
  }
  for (const p of leftovers) {
    const slot = slots.find((s) => !s.payout && s.memberId === p.member_id)
    if (slot) slot.payout = p
  }
  return slots
}

// ─── Summaries ──────────────────────────────────────────────────────────────

export interface MemberSummary {
  member: Member
  monthlyDue: number
  termTotal: number // everything they'll pay over the cycle
  paid: number
  dueToDate: number
  behind: number // > 0 when they owe for months already started
  ahead: number // > 0 when they've paid in advance
  stillToPay: number
  entitlementGross: number
  entitlementFees: number
  entitlementNet: number // what they should receive in total
  received: number
  toReceive: number
  slots: DrawSlot[]
}

export interface PartnerSummary {
  status: PartnerStatus
  period: number // current month, clamped to 1..term (0 if not started)
  rawPeriod: number
  totalHands: number
  terms: Terms
  monthlyCollection: number
  cycleTotal: number
  collected: number
  dueToDate: number
  paidOutGross: number
  paidOutNet: number
  payoutsCount: number
  feesEarned: number
  feesProjected: number
  pot: number // cash that should physically be in the box right now
  potIfPaidUp: number // what the pot would hold if nobody were behind
  behind: number
  ahead: number
  schedule: DrawSlot[]
  nextDraw: DrawSlot | null
  members: MemberSummary[]
}

const sumCents = <T>(items: T[], pick: (x: T) => number | string) =>
  items.reduce((acc, x) => acc + toCents(pick(x)), 0)

export function summarizePartner(
  partner: Partner,
  members: Member[],
  contributions: Contribution[],
  payouts: Payout[],
  today: Date = new Date(),
): PartnerSummary {
  const T = partner.term_months
  const rawPeriod = rawCurrentPeriod(partner.start_date, today)
  const status: PartnerStatus = rawPeriod < 1 ? 'upcoming' : rawPeriod > T ? 'complete' : 'active'
  const period = Math.max(0, Math.min(rawPeriod, T))

  const t = termsCents(partner)
  const totalHands = members.reduce((n, m) => n + m.hands, 0)
  const schedule = buildSchedule(partner, members, payouts)

  const memberSummaries: MemberSummary[] = [...members].sort(byCreated).map((member) => {
    const monthly = t.hand * member.hands
    const due = monthly * period
    const paid = sumCents(contributions.filter((c) => c.member_id === member.id), (c) => c.amount)
    const received = sumCents(payouts.filter((p) => p.member_id === member.id), (p) => p.net)
    const net = t.net * member.hands
    return {
      member,
      monthlyDue: dollars(monthly),
      termTotal: dollars(monthly * T),
      paid: dollars(paid),
      dueToDate: dollars(due),
      behind: dollars(Math.max(0, due - paid)),
      ahead: dollars(Math.max(0, paid - due)),
      stillToPay: dollars(Math.max(0, monthly * T - paid)),
      entitlementGross: dollars(t.gross * member.hands),
      entitlementFees: dollars(t.fee * member.hands),
      entitlementNet: dollars(net),
      received: dollars(received),
      toReceive: dollars(Math.max(0, net - received)),
      slots: schedule.filter((s) => s.memberId === member.id),
    }
  })

  const collected = sumCents(contributions, (c) => c.amount)
  const paidGross = sumCents(payouts, (p) => p.gross)
  const dueToDate = t.hand * totalHands * period
  const behind = memberSummaries.reduce((acc, m) => acc + toCents(m.behind), 0)
  const ahead = memberSummaries.reduce((acc, m) => acc + toCents(m.ahead), 0)

  return {
    status,
    period,
    rawPeriod,
    totalHands,
    terms: partnerTerms(partner),
    monthlyCollection: dollars(t.hand * totalHands),
    cycleTotal: dollars(t.hand * totalHands * T),
    collected: dollars(collected),
    dueToDate: dollars(dueToDate),
    paidOutGross: dollars(paidGross),
    paidOutNet: dollars(sumCents(payouts, (p) => p.net)),
    payoutsCount: payouts.length,
    feesEarned: dollars(sumCents(payouts, (p) => p.fee)),
    feesProjected: dollars(t.fee * totalHands),
    pot: dollars(collected - paidGross),
    potIfPaidUp: dollars(collected - paidGross + behind),
    behind: dollars(behind),
    ahead: dollars(ahead),
    schedule,
    nextDraw: schedule.find((s) => !s.payout) ?? null,
    members: memberSummaries,
  }
}

// ─── One month at a time ────────────────────────────────────────────────────

export type PeriodStatus = 'paid' | 'partial' | 'unpaid'

export interface PeriodRow {
  member: Member
  due: number
  paid: number
  remaining: number
  status: PeriodStatus
  entries: Contribution[]
}

export function periodRows(
  partner: Partner,
  members: Member[],
  contributions: Contribution[],
  period: number,
): PeriodRow[] {
  const hand = toCents(partner.hand_amount)
  return [...members].sort(byCreated).map((member) => {
    const entries = contributions
      .filter((c) => c.member_id === member.id && c.period === period)
      .sort(byCreated)
    const due = hand * member.hands
    const paid = sumCents(entries, (c) => c.amount)
    return {
      member,
      due: dollars(due),
      paid: dollars(paid),
      remaining: dollars(Math.max(0, due - paid)),
      status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      entries,
    }
  })
}

/** Moves slot `from` to `to` and returns the new draw order (one id per hand). */
export function moveSlot(order: string[], from: number, to: number): string[] {
  const next = [...order]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Shuffles only the hands that haven't drawn yet, keeping paid draws where they are. */
export function shuffleUnpaid(schedule: DrawSlot[], random: () => number = Math.random): string[] {
  const order = schedule.map((s) => s.memberId)
  const open = schedule.filter((s) => !s.payout).map((s) => s.index)
  const ids = open.map((i) => order[i])
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  open.forEach((slotIndex, k) => {
    order[slotIndex] = ids[k]
  })
  return order
}
