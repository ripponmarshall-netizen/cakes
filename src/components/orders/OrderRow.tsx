import { supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'
import { PAYMENT_LABELS } from '../../lib/types'
import { amountPaid, balanceDue, formatDateTime, formatMoney, STATUS_STYLES } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { Badge } from '../ui/Badge'

export function OrderRow({ order }: { order: Order }) {
  const { toast } = useToast()
  const cakeName = order.cake_name_snapshot ?? 'Cake'
  const seller = order.created_by_profile?.display_name ?? 'Unknown'
  const balance = balanceDue(order)
  const paid = amountPaid(order)

  async function remove() {
    if (!confirm(`Delete the order for ${order.customer_name}?`)) return
    const { error } = await supabase.from('orders').delete().eq('id', order.id)
    toast(error ? error.message : 'Order deleted.', error ? 'error' : 'success')
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-cocoa-800">{order.customer_name}</p>
          <p className="truncate text-sm text-cocoa-500">{cakeName}</p>
        </div>
        <Badge className={STATUS_STYLES[order.payment_status]}>
          {PAYMENT_LABELS[order.payment_status]}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-cocoa-500">
          Total <span className="font-semibold text-cocoa-800">{formatMoney(order.total_amount)}</span>
        </span>
        <span className="text-cocoa-500">
          Paid <span className="font-semibold text-emerald-600">{formatMoney(paid)}</span>
        </span>
        {balance > 0 && (
          <span className="text-cocoa-500">
            Balance <span className="font-semibold text-amber-600">{formatMoney(balance)}</span>
          </span>
        )}
      </div>

      {order.notes && (
        <p className="mt-2 rounded-lg bg-cream px-3 py-1.5 text-sm text-cocoa-500">{order.notes}</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-blush-50 pt-2.5 text-xs text-cocoa-400">
        <span>
          Logged by <span className="font-semibold text-cocoa-500">{seller}</span> ·{' '}
          {formatDateTime(order.created_at)}
        </span>
        <button onClick={remove} className="font-semibold text-rose-400 transition hover:text-rose-600">
          Delete
        </button>
      </div>
    </div>
  )
}
