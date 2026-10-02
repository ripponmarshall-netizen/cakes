import type { Contribution, Member, Partner, Payout } from './types'

/*
 * All partner maths lives here as pure functions so it can be unit-tested.
 * Money is summed in integer cents to avoid floating-point drift, then returned
 * in dollars. Hands are counted internally in halves (1 hand = 2 halves).
 *
 * Model (rotating draw):
 *   - Each hand pays `hand_amount` every month for `term_months` months; a half
 *     hand pays half.
 *   - Each hand draws once. A draw is worth hand_amount × term_months (gross);
 *     the banker's fee comes out of that, the member receives the rest (net).
 *     Two half hands share one draw slot and each get half of it.
 *   - Draw slots are spaced by cumulative weight: the slot that brings the
 *     running total to W halves (out of H) draws in month ceil(W·T/H). With
 *     T = hands that's one draw a month (the classic partner), and collections
 *     always cover the draws due, as long as everyone pays.
 *   - Voided records are ignored everywhere. A replaced member's money counts
 *     toward whoever bought their hand ("buyout"); after a "refund" the new
 *     member starts from scratch.
 */

export const toCents = (n: number | string | null | undefined): number => {
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v * 100) : 0
}
const dollars = (cents: number): number => cents / 100

// ─── Records ────────────────────────────────────────────────────────────────

export const isLive = (r: { voided_at?: string | null }): boolean => !r.voided_at
export const isDraw = (p: Pick<Payout, 'kind'>): boolean => p.kind !== 'refund'
export const isActive = (m: Pick<Member, 'replaced_by'>): boolean => !m.replaced_by
export const handsOf = (m: Pick<Member, 'hands'>): number => Number(m.hands) || 0
const halvesOf = (m: Pick<Member, 'hands'>): number => Math.max(0, Math.round(handsOf(m) * 2))

const byCreated = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at)

/**
 * Who holds each member's money now: follows "bought the hand" replacements to
 * the current holder. Members who left with a refund (or never left) own themselves.
 */
export function ownerResolver(members: Member[]): (memberId: string) => string {
  const byId = new Map(members.map((m) => [m.id, m]))
  const cache = new Map<string, string>()
  return (id) => {
    const hit = cache.get(id)
    if (hit) return hit
    let cur = id
    const seen = new Set<string>()
    for (;;) {
      const m = byId.get(cur)
      if (!m || !m.replaced_by || m.transfer_mode !== 'buyout' || seen.has(cur)) break
      seen.add(cur)
      cur = m.replaced_by
    }
    cache.set(id, cur)
    return cur
  }
}

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

/** A half hand's draw is half the gross and half the fee. */
function shareCents(t: ReturnType<typeof termsCents>, half: boolean) {
  if (!half) return { gross: t.gross, fee: t.fee, net: t.net }
  const gross = Math.round(t.gross / 2)
  const fee = Math.round(t.fee / 2)
  return { gross, fee, net: gross - fee }
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

/** Monthly amount for a number of hands, in dollars (half hands round to the cent). */
export function monthlyFor(p: Pick<Partner, 'hand_amount'>, hands: number): number {
  return dollars(Math.round((toCents(p.hand_amount) * Math.round(hands * 2)) / 2))
}

// ─── Draw order ─────────────────────────────────────────────────────────────

/** One draw slot: a full hand (one id) or a shared slot of up to two half hands. */
export interface SlotSpec {
  ids: string[]
  half: boolean
}

export function parseEntry(entry: string): SlotSpec {
  if (!entry.includes('|')) return { ids: [entry], half: false }
  return { ids: entry.split('|').filter(Boolean).slice(0, 2), half: true }
}

export function serializeSpec(s: SlotSpec): string {
  if (!s.half) return s.ids[0]
  return s.ids.length >= 2 ? `${s.ids[0]}|${s.ids[1]}` : `${s.ids[0]}|`
}

/**
 * The stored draw order, reconciled with the current (active) members and their
 * hands: stale ids and surplus hands are dropped, missing hands are appended in
 * the order members joined, and half hands are paired into shared slots.
 */
export function effectiveDrawOrder(members: Member[], stored: string[]): SlotSpec[] {
  const active = members.filter(isActive)
  const remaining = new Map(active.map((m) => [m.id, halvesOf(m)]))
  const left = (id: string) => remaining.get(id) ?? 0
  const specs: SlotSpec[] = []

  for (const raw of stored ?? []) {
    const parsed = parseEntry(raw)
    // Ids of members who left or were removed drop out first.
    const s = { ...parsed, ids: parsed.ids.filter((id) => remaining.has(id)) }
    if (s.ids.length === 0) continue
    if (!s.half) {
      const id = s.ids[0]
      const r = left(id)
      if (r >= 2) {
        specs.push({ ids: [id], half: false })
        remaining.set(id, r - 2)
      } else if (r === 1) {
        specs.push({ ids: [id], half: true }) // went down to a half hand
        remaining.set(id, 0)
      }
      continue
    }
    if (s.ids.length === 1) {
      const id = s.ids[0]
      const r = left(id)
      if (r % 2 === 1) {
        specs.push({ ids: [id], half: true })
        remaining.set(id, r - 1)
      } else if (r >= 2) {
        specs.push({ ids: [id], half: false }) // went up to a whole hand
        remaining.set(id, r - 2)
      }
      continue
    }
    const kept: string[] = []
    for (const id of s.ids) {
      const r = left(id)
      if (r % 2 === 1) {
        kept.push(id)
        remaining.set(id, r - 1)
      }
    }
    if (kept.length) specs.push({ ids: kept, half: true })
  }

  // Two lone halves always share one draw: merge strays left by members who changed or left.
  for (;;) {
    const lones = specs.filter((s) => s.half && s.ids.length === 1)
    if (lones.length < 2) break
    lones[0].ids.push(lones[1].ids[0])
    specs.splice(specs.indexOf(lones[1]), 1)
  }

  // Append missing hands in join order; a new half pairs with any waiting half.
  for (const m of [...active].sort(byCreated)) {
    let r = left(m.id)
    for (; r >= 2; r -= 2) specs.push({ ids: [m.id], half: false })
    if (r === 1) {
      const lone = specs.find((s) => s.half && s.ids.length === 1 && s.ids[0] !== m.id)
      if (lone) lone.ids.push(m.id)
      else specs.push({ ids: [m.id], half: true })
    }
  }
  return specs
}

// ─── Draw schedule ──────────────────────────────────────────────────────────

export interface DrawShare {
  slotIndex: number
  period: number
  memberId: string
  half: boolean
  handNo: number // 1 for a member's first draw, 2 for their second, …
  gross: number
  fee: number
  net: number
  payout: Payout | null
}

export interface DrawSlot {
  index: number // 0-based position in the draw order
  period: number // month this slot draws
  half: boolean // a shared slot of half hands
  shares: DrawShare[]
  done: boolean // every share paid
  locked: boolean // any share paid — can't be moved
}

/** Month (1-based) in which the slot that brings the running total to `cumulative` (out of `total`) draws. */
export function drawPeriod(cumulative: number, total: number, termMonths: number): number {
  return Math.max(1, Math.ceil((cumulative * termMonths) / total))
}

export function buildSchedule(partner: Partner, members: Member[], payouts: Payout[]): DrawSlot[] {
  const specs = effectiveDrawOrder(members, partner.draw_order ?? [])
  const t = termsCents(partner)
  const weight = (s: SlotSpec) => (s.half ? s.ids.length : 2)
  const total = specs.reduce((n, s) => n + weight(s), 0)
  const handCount = new Map<string, number>()
  let cumulative = 0

  const slots: DrawSlot[] = specs.map((spec, index) => {
    cumulative += weight(spec)
    const period = drawPeriod(cumulative, total, partner.term_months)
    const amounts = shareCents(t, spec.half)
    const shares = spec.ids.map((memberId): DrawShare => {
      const handNo = (handCount.get(memberId) ?? 0) + 1
      handCount.set(memberId, handNo)
      return {
        slotIndex: index,
        period,
        memberId,
        half: spec.half,
        handNo,
        gross: dollars(amounts.gross),
        fee: dollars(amounts.fee),
        net: dollars(amounts.net),
        payout: null,
      }
    })
    return { index, period, half: spec.half, shares, done: false, locked: false }
  })

  // Attach payouts: first to a share of the same holder in the same month, then
  // any leftovers to that holder's earliest open shares.
  const owner = ownerResolver(members)
  const allShares = slots.flatMap((s) => s.shares)
  const leftovers: Payout[] = []
  const draws = payouts.filter((p) => isLive(p) && isDraw(p)).sort((a, b) => a.period - b.period || byCreated(a, b))
  for (const p of draws) {
    const who = owner(p.member_id)
    const share = allShares.find((s) => !s.payout && s.memberId === who && s.period === p.period)
    if (share) share.payout = p
    else leftovers.push(p)
  }
  for (const p of leftovers) {
    const who = owner(p.member_id)
    const share = allShares.find((s) => !s.payout && s.memberId === who)
    if (share) share.payout = p
  }
  for (const slot of slots) {
    slot.done = slot.shares.every((s) => s.payout)
    slot.locked = slot.shares.some((s) => s.payout)
  }
  return slots
}

/** The draw order as stored, from a built schedule. */
export function scheduleOrder(schedule: DrawSlot[]): string[] {
  return schedule.map((s) => serializeSpec({ ids: s.shares.map((x) => x.memberId), half: s.half }))
}

// ─── Summaries ──────────────────────────────────────────────────────────────

/** high = has drawn and is behind; watch = has drawn and still owes for later months. */
export type Risk = 'high' | 'watch' | null

export interface MemberSummary {
  member: Member
  hands: number
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
  receivedGross: number
  received: number // net
  toReceive: number
  /** Money the group loses if they stop paying now: drawn (gross) minus paid in, never below 0. */
  exposure: number
  risk: Risk
  shares: DrawShare[]
}

export interface FormerMember {
  member: Member
  replacedBy: Member | null
  paid: number
  received: number
  refunded: number
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
  paidOutGross: number // draws + refunds
  paidOutNet: number // draws only, what members received
  refunds: number
  payoutsCount: number // draw shares paid
  drawsCount: number // draw shares in the cycle
  feesEarned: number
  feesProjected: number
  pot: number // cash that should physically be in the box right now
  potIfPaidUp: number // what the pot would hold if nobody were behind
  behind: number
  ahead: number
  exposure: number
  atRisk: number // members with risk 'high'
  schedule: DrawSlot[]
  nextDraw: DrawSlot | null
  members: MemberSummary[]
  former: FormerMember[]
}

const sumCents = <T>(items: T[], pick: (x: T) => number | string) =>
  items.reduce((acc, x) => acc + toCents(pick(x)), 0)

export function summarizePartner(
  partner: Partner,
  members: Member[],
  allContributions: Contribution[],
  allPayouts: Payout[],
  today: Date = new Date(),
): PartnerSummary {
  const contributions = allContributions.filter(isLive)
  const payouts = allPayouts.filter(isLive)
  const draws = payouts.filter(isDraw)
  const refunds = payouts.filter((p) => !isDraw(p))
  const T = partner.term_months
  const rawPeriod = rawCurrentPeriod(partner.start_date, today)
  const status: PartnerStatus = rawPeriod < 1 ? 'upcoming' : rawPeriod > T ? 'complete' : 'active'
  const period = Math.max(0, Math.min(rawPeriod, T))

  const t = termsCents(partner)
  const active = members.filter(isActive)
  const totalHalves = active.reduce((n, m) => n + halvesOf(m), 0)
  const schedule = buildSchedule(partner, members, payouts)
  const allShares = schedule.flatMap((s) => s.shares)
  const owner = ownerResolver(members)

  const memberSummaries: MemberSummary[] = [...active].sort(byCreated).map((member) => {
    const monthly = Math.round((t.hand * halvesOf(member)) / 2)
    const due = monthly * period
    const paid = sumCents(contributions.filter((c) => owner(c.member_id) === member.id), (c) => c.amount)
    const mine = draws.filter((p) => owner(p.member_id) === member.id)
    const receivedGross = sumCents(mine, (p) => p.gross)
    const received = sumCents(mine, (p) => p.net)
    const shares = allShares.filter((s) => s.memberId === member.id)
    const entGross = sumCents(shares, (s) => s.gross)
    const entFee = sumCents(shares, (s) => s.fee)
    const behind = Math.max(0, due - paid)
    const exposure = Math.max(0, receivedGross - paid)
    return {
      member,
      hands: halvesOf(member) / 2,
      monthlyDue: dollars(monthly),
      termTotal: dollars(monthly * T),
      paid: dollars(paid),
      dueToDate: dollars(due),
      behind: dollars(behind),
      ahead: dollars(Math.max(0, paid - due)),
      stillToPay: dollars(Math.max(0, monthly * T - paid)),
      entitlementGross: dollars(entGross),
      entitlementFees: dollars(entFee),
      entitlementNet: dollars(entGross - entFee),
      receivedGross: dollars(receivedGross),
      received: dollars(received),
      toReceive: dollars(Math.max(0, entGross - entFee - received)),
      exposure: dollars(exposure),
      risk: exposure > 0 ? (behind > 0 ? 'high' : 'watch') : null,
      shares,
    }
  })

  const byId = new Map(members.map((m) => [m.id, m]))
  const former: FormerMember[] = members
    .filter((m) => !isActive(m))
    .sort(byCreated)
    .map((member) => ({
      member,
      replacedBy: byId.get(member.replaced_by ?? '') ?? null,
      paid: dollars(sumCents(contributions.filter((c) => c.member_id === member.id), (c) => c.amount)),
      received: dollars(sumCents(draws.filter((p) => p.member_id === member.id), (p) => p.net)),
      refunded: dollars(sumCents(refunds.filter((p) => p.member_id === member.id), (p) => p.gross)),
    }))

  const collected = sumCents(contributions, (c) => c.amount)
  const paidGross = sumCents(payouts, (p) => p.gross)
  const monthlyAll = Math.round((t.hand * totalHalves) / 2)
  const behind = memberSummaries.reduce((acc, m) => acc + toCents(m.behind), 0)
  const ahead = memberSummaries.reduce((acc, m) => acc + toCents(m.ahead), 0)

  return {
    status,
    period,
    rawPeriod,
    totalHands: totalHalves / 2,
    terms: partnerTerms(partner),
    monthlyCollection: dollars(monthlyAll),
    cycleTotal: dollars(monthlyAll * T),
    collected: dollars(collected),
    dueToDate: dollars(monthlyAll * period),
    paidOutGross: dollars(paidGross),
    paidOutNet: dollars(sumCents(draws, (p) => p.net)),
    refunds: dollars(sumCents(refunds, (p) => p.gross)),
    payoutsCount: allShares.filter((s) => s.payout).length,
    drawsCount: allShares.length,
    feesEarned: dollars(sumCents(payouts, (p) => p.fee)),
    feesProjected: dollars(sumCents(allShares, (s) => s.fee)),
    pot: dollars(collected - paidGross),
    potIfPaidUp: dollars(collected - paidGross + behind),
    behind: dollars(behind),
    ahead: dollars(ahead),
    exposure: dollars(memberSummaries.reduce((acc, m) => acc + toCents(m.exposure), 0)),
    atRisk: memberSummaries.filter((m) => m.risk === 'high').length,
    schedule,
    nextDraw: schedule.find((s) => !s.done) ?? null,
    members: memberSummaries,
    former,
  }
}

/** Open draw shares that start on or before `today + days` (includes overdue ones). */
export function drawsDueSoon(partner: Partner, summary: PartnerSummary, today: Date = new Date(), days = 7): DrawShare[] {
  const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
  return summary.schedule
    .flatMap((s) => s.shares)
    .filter((s) => !s.payout && periodStartDate(partner.start_date, s.period) <= horizon)
}

// ─── One month at a time ────────────────────────────────────────────────────

export type PeriodStatus = 'paid' | 'partial' | 'unpaid'

export interface PeriodRow {
  member: Member
  due: number
  paid: number
  remaining: number
  status: PeriodStatus
  entries: Contribution[] // live payments, including any made before a buy-out
  voided: Contribution[]
}

export function periodRows(
  partner: Partner,
  members: Member[],
  contributions: Contribution[],
  period: number,
): PeriodRow[] {
  const hand = toCents(partner.hand_amount)
  const owner = ownerResolver(members)
  return members
    .filter(isActive)
    .sort(byCreated)
    .map((member) => {
      const all = contributions
        .filter((c) => c.period === period && owner(c.member_id) === member.id)
        .sort(byCreated)
      const entries = all.filter(isLive)
      const due = Math.round((hand * halvesOf(member)) / 2)
      const paid = sumCents(entries, (c) => c.amount)
      return {
        member,
        due: dollars(due),
        paid: dollars(paid),
        remaining: dollars(Math.max(0, due - paid)),
        status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        entries,
        voided: all.filter((c) => !isLive(c)),
      }
    })
}

/**
 * What a member owes, month by month, for months already started — oldest
 * first, capped at their overall arrears (so paying ahead in a later month
 * still counts). Used to take arrears out of a draw.
 */
export function arrearsByPeriod(
  partner: Partner,
  members: Member[],
  contributions: Contribution[],
  memberId: string,
  upToPeriod: number,
): { period: number; amount: number }[] {
  const T = Math.min(upToPeriod, partner.term_months)
  const owner = ownerResolver(members)
  const months: { period: number; cents: number }[] = []
  let dueTotal = 0
  for (let p = 1; p <= T; p++) {
    const row = periodRows(partner, members, contributions, p).find((r) => r.member.id === memberId)
    if (!row) return []
    dueTotal += toCents(row.due)
    const gap = toCents(row.remaining)
    if (gap > 0) months.push({ period: p, cents: gap })
  }
  // Payments for any month (including ahead) count against the arrears.
  const paidTotal = sumCents(
    contributions.filter((c) => isLive(c) && owner(c.member_id) === memberId),
    (c) => c.amount,
  )
  let budget = Math.max(0, dueTotal - paidTotal)
  if (budget === 0) return []
  const out: { period: number; amount: number }[] = []
  for (const m of months) {
    if (budget <= 0) break
    const take = Math.min(m.cents, budget)
    out.push({ period: m.period, amount: dollars(take) })
    budget -= take
  }
  return out
}

// ─── Reordering ─────────────────────────────────────────────────────────────

/** Moves entry `from` to `to` and returns the new draw order. */
export function moveSlot(order: string[], from: number, to: number): string[] {
  const next = [...order]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Shuffles only the slots nobody has drawn from yet, keeping paid draws where they are. */
export function shuffleUnpaid(schedule: DrawSlot[], random: () => number = Math.random): string[] {
  const order = scheduleOrder(schedule)
  const open = schedule.filter((s) => !s.locked).map((s) => s.index)
  const entries = open.map((i) => order[i])
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  open.forEach((slotIndex, k) => {
    order[slotIndex] = entries[k]
  })
  return order
}
