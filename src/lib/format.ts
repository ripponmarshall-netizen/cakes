import { periodStartDate } from './calc'
import type { PaymentMethod, PayoutMethod } from './types'

const whole = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Jamaican dollars. Drops ".00" on whole amounts: 12000 -> "J$12,000", 12.5 -> "J$12.50". */
export function formatMoney(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  const abs = Math.abs(value)
  const body = Number.isInteger(Math.round(abs * 100) / 100) ? whole.format(abs) : cents.format(abs)
  return `${value < 0 ? '−' : ''}J$${body}`
}

/** "Mar 2026" for the month a period starts in. */
export function periodLabel(startIso: string, period: number): string {
  return periodStartDate(startIso, period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** "Mar 15" — short date for a period's start. */
export function periodDay(startIso: string, period: number): string {
  return periodStartDate(startIso, period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Jun 3, 2026" from a YYYY-MM-DD string, read as a local date. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Jun 3" from a YYYY-MM-DD string. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`
}

/** "½ hand", "1 hand", "1½ hands", "2 hands". */
export function formatHands(hands: number): string {
  const n = Math.round((Number(hands) || 0) * 2) / 2
  const whole = Math.floor(n)
  const half = n - whole === 0.5
  const body = whole === 0 ? (half ? '½' : '0') : `${whole}${half ? '½' : ''}`
  return `${body} ${n <= 1 ? 'hand' : 'hands'}`
}

export const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  transfer: 'Bank transfer',
  lynk: 'Lynk',
  deduction: 'Taken from draw',
  other: 'Other',
}

/** Methods the banker can pick when recording money ("deduction" is set by the app). */
export const pickableMethods: PayoutMethod[] = ['cash', 'transfer', 'lynk', 'other']

/** Read-only statement link for a member. Works on GitHub Pages' sub-path. */
export function statementUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/s/${token}`
}

/** "Months 2–4" / "Month 3" / "Months 1, 3". */
export function monthsLabel(periods: number[]): string {
  if (periods.length === 0) return ''
  if (periods.length === 1) return `Month ${periods[0]}`
  const contiguous = periods.every((p, i) => i === 0 || p === periods[i - 1] + 1)
  return contiguous ? `Months ${periods[0]}–${periods[periods.length - 1]}` : `Months ${periods.join(', ')}`
}
