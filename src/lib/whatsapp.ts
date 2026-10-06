import type { MemberSummary } from './calc'
import { formatDate, formatHands, formatMoney, monthsLabel, periodLabel } from './format'
import type { Partner } from './types'

/**
 * Turns what people type into the digits wa.me wants (country code, no "+").
 * Jamaican numbers are the default: 7 digits get 1-876, 10 digits get a 1.
 * Anything already in international form is kept. Returns null if unusable.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+') && digits.length >= 8) return digits
  if (digits.length === 7) return `1876${digits}`
  if (digits.length === 10) return `1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length >= 11 && digits.length <= 15) return digits
  return null
}

/** Opens WhatsApp with the message ready to send. Without a number, WhatsApp asks who to send it to. */
export function waLink(phone: string | null | undefined, text: string): string {
  const n = normalizePhone(phone)
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(text)}`
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function drawLine(partner: Partner, m: MemberSummary): string | null {
  const next = m.shares.find((s) => !s.payout)
  if (!next) return null
  return `Your ${next.half ? 'half-hand ' : ''}draw: ${periodLabel(partner.start_date, next.period)} (${formatMoney(next.net)}).`
}

export function reminderMessage(partner: Partner, m: MemberSummary, owedMonths: number[], signOff?: string): string {
  const lines = [
    `Hi ${firstName(m.member.name)}, friendly reminder from ${partner.name}.`,
    `You owe ${formatMoney(m.behind)}${owedMonths.length ? ` (${monthsLabel(owedMonths).toLowerCase()})` : ''}.`,
    `Your hand is ${formatMoney(m.monthlyDue)} a month (${formatHands(m.hands)}).`,
  ]
  const draw = drawLine(partner, m)
  if (draw) lines.push(draw)
  if (partner.pay_details?.trim()) lines.push(`Pay by: ${partner.pay_details.trim()}`)
  lines.push(signOff ? `Thanks! – ${signOff}` : 'Thanks!')
  return lines.join('\n')
}

/** Confirms a payment just received, and where the member stands now. */
export function receiptMessage(
  partner: Partner,
  name: string,
  payment: { amount: number; period: number; paid_on: string },
  standing: { monthSettled: boolean; behind: number } | null,
  signOff?: string,
): string {
  const lines = [
    `Hi ${firstName(name)}, received ${formatMoney(payment.amount)} for ${periodLabel(partner.start_date, payment.period)} (${partner.name}) on ${formatDate(payment.paid_on)}.`,
  ]
  if (standing) {
    if (standing.behind > 0) lines.push(`Still owing overall: ${formatMoney(standing.behind)}.`)
    else if (standing.monthSettled) lines.push('You’re up to date ✅')
  }
  lines.push(signOff ? `Thanks! – ${signOff}` : 'Thanks!')
  return lines.join('\n')
}

/** Confirms a draw handed over, showing how the amount was worked out. */
export function payoutReceiptMessage(
  partner: Partner,
  name: string,
  p: { period: number; gross: number; fee: number; arrears: number; handed: number; paid_on: string },
  signOff?: string,
): string {
  const lines = [
    `Hi ${firstName(name)}, your ${partner.name} draw for ${periodLabel(partner.start_date, p.period)} was paid on ${formatDate(p.paid_on)}.`,
    `Draw: ${formatMoney(p.gross)}`,
  ]
  if (p.fee > 0) lines.push(`Banker fee: −${formatMoney(p.fee)}`)
  if (p.arrears > 0) lines.push(`Arrears taken out: −${formatMoney(p.arrears)}`)
  lines.push(`You received: ${formatMoney(p.handed)}`)
  lines.push(signOff ? `Congrats! – ${signOff}` : 'Congrats!')
  return lines.join('\n')
}

export function statementMessage(partner: Partner, m: MemberSummary, link: string | null): string {
  const lines = [
    `${partner.name} – statement for ${m.member.name}`,
    `${formatHands(m.hands)} · ${formatMoney(m.monthlyDue)} a month`,
    `Paid in: ${formatMoney(m.paid)} of ${formatMoney(m.termTotal)}`,
    m.behind > 0 ? `Owing now: ${formatMoney(m.behind)}` : m.ahead > 0 ? `Paid ahead: ${formatMoney(m.ahead)}` : 'Up to date ✅',
  ]
  const draw = drawLine(partner, m)
  if (draw) lines.push(draw)
  if (m.received > 0) lines.push(`Received so far: ${formatMoney(m.received)}`)
  if (m.behind > 0 && partner.pay_details?.trim()) lines.push(`Pay by: ${partner.pay_details.trim()}`)
  if (link) lines.push('', `See your full record any time: ${link}`)
  return lines.join('\n')
}
