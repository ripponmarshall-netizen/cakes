import { periodStartDate } from './calc'

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
