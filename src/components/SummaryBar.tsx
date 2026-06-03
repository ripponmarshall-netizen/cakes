import { useMemo } from 'react'
import type { Order } from '../lib/types'
import { amountPaid, balanceDue, formatMoney } from '../lib/format'

export function SummaryBar({ orders }: { orders: Order[] }) {
  const stats = useMemo(() => {
    let collected = 0
    let outstanding = 0
    for (const o of orders) {
      collected += amountPaid(o)
      outstanding += balanceDue(o)
    }
    return { count: orders.length, collected, outstanding }
  }, [orders])

  const cards = [
    { label: 'Sales recorded', value: String(stats.count), accent: 'text-cocoa-800' },
    { label: 'Collected', value: formatMoney(stats.collected), accent: 'text-emerald-600' },
    { label: 'Outstanding', value: formatMoney(stats.outstanding), accent: 'text-amber-600' },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{c.label}</p>
          <p className={`mt-1 text-2xl font-bold ${c.accent}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
