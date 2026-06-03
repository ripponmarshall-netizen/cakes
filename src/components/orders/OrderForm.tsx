import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useCakeItems } from '../../hooks/useCakeItems'
import type { PaymentStatus } from '../../lib/types'
import { PAYMENT_LABELS } from '../../lib/types'
import { formatMoney } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Input'

const STATUS_ORDER: PaymentStatus[] = ['unpaid', 'deposit', 'paid_in_full']

export function OrderForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items } = useCakeItems()
  const { session } = useAuth()
  const { toast } = useToast()

  const [cakeId, setCakeId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [status, setStatus] = useState<PaymentStatus>('unpaid')
  const [deposit, setDeposit] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCake = useMemo(() => items.find((c) => c.id === cakeId) ?? null, [items, cakeId])
  const total = selectedCake?.price ?? 0
  const depositValue = status === 'deposit' ? Number(deposit) || 0 : 0
  const balance = status === 'paid_in_full' ? 0 : Math.max(total - depositValue, 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedCake) {
      toast('Please choose a cake.', 'error')
      return
    }
    if (status === 'deposit' && depositValue <= 0) {
      toast('Enter the deposit amount.', 'error')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('orders').insert({
      cake_item_id: selectedCake.id,
      cake_name_snapshot: selectedCake.name,
      customer_name: customerName.trim(),
      payment_status: status,
      deposit_amount: depositValue,
      total_amount: total,
      notes: notes.trim() || null,
      created_by: session?.user.id ?? null,
    })
    setSaving(false)

    if (error) {
      toast(error.message, 'error')
      return
    }
    toast('Sale recorded! 🎉', 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Record a sale">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Cake">
          <Select value={cakeId} onChange={(e) => setCakeId(e.target.value)} required>
            <option value="" disabled>
              Choose a cake…
            </option>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {formatMoney(c.price)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Customer name">
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Aunt Carol"
            required
          />
        </Field>

        <Field label="Payment">
          <div className="grid grid-cols-3 gap-2">
            {STATUS_ORDER.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-xl px-2 py-2.5 text-sm font-semibold ring-1 ring-inset transition ${
                  status === s
                    ? 'bg-blush-500 text-white ring-blush-500'
                    : 'bg-white text-cocoa-600 ring-cocoa-200 hover:bg-blush-50'
                }`}
              >
                {PAYMENT_LABELS[s]}
              </button>
            ))}
          </div>
        </Field>

        {status === 'deposit' && (
          <Field label="Deposit amount (JMD)">
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="2000"
              autoFocus
            />
          </Field>
        )}

        <Field label="Notes (optional)">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Pickup Friday, write 'Happy Birthday Sam'…"
            rows={2}
          />
        </Field>

        {selectedCake && (
          <div className="rounded-2xl bg-blush-50 p-4 text-sm">
            <div className="flex justify-between text-cocoa-600">
              <span>Total</span>
              <span className="font-semibold text-cocoa-800">{formatMoney(total)}</span>
            </div>
            {status === 'deposit' && (
              <div className="mt-1 flex justify-between text-cocoa-600">
                <span>Deposit paid</span>
                <span className="font-semibold text-emerald-600">{formatMoney(depositValue)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between text-cocoa-600">
              <span>Balance due</span>
              <span className={`font-bold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {formatMoney(balance)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            Record sale
          </Button>
        </div>
      </form>
    </Modal>
  )
}
