import type { MemberSummary } from './calc'
import { formatHands, formatMoney, monthsLabel, periodLabel } from './format'
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
  lines.push(signOff ? `Thanks! – ${signOff}` : 'Thanks!')
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
  if (link) lines.push('', `See your full record any time: ${link}`)
  return lines.join('\n')
}
