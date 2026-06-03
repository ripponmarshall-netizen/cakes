import type { Order, PaymentStatus } from './types'

const currency = new Intl.NumberFormat('en-JM', {
  style: 'currency',
  currency: 'JMD',
  currencyDisplay: 'narrowSymbol',
})

/** Format a number as Jamaican dollars, e.g. 3500 -> "J$3,500.00". */
export function formatMoney(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  // en-JM narrowSymbol renders "$"; prefix with J for clarity.
  return `J${currency.format(value)}`
}

/** Friendly date + time, e.g. "Jun 3, 2026 · 2:14 PM". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const d = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const t = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${d} · ${t}`
}

/** Amount already collected for an order. */
export function amountPaid(order: Pick<Order, 'payment_status' | 'deposit_amount' | 'total_amount'>): number {
  switch (order.payment_status) {
    case 'paid_in_full':
      return order.total_amount
    case 'deposit':
      return order.deposit_amount
    case 'unpaid':
    default:
      return 0
  }
}

/** Outstanding balance for an order. */
export function balanceDue(order: Pick<Order, 'payment_status' | 'deposit_amount' | 'total_amount'>): number {
  return Math.max(order.total_amount - amountPaid(order), 0)
}

export const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid_in_full: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  deposit: 'bg-amber-100 text-amber-700 ring-amber-200',
  unpaid: 'bg-rose-100 text-rose-700 ring-rose-200',
}
