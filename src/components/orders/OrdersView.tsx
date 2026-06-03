import { useState } from 'react'
import type { Order } from '../../lib/types'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { OrderRow } from './OrderRow'
import { OrderForm } from './OrderForm'

export function OrdersView({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const [formOpen, setFormOpen] = useState(false)

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cocoa-800">Sales & Orders</h2>
          <p className="text-sm text-cocoa-500">Every order you and your teammate record, in real time.</p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm">
          + Record sale
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/60" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState emoji="🧾" title="No sales yet">
          Record your first sale and it will appear here for both of you instantly.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}

      {formOpen && <OrderForm open={formOpen} onClose={() => setFormOpen(false)} />}
    </section>
  )
}
