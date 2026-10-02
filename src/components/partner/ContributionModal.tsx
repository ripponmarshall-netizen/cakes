import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { PeriodRow } from '../../lib/calc'
import { formatDate, formatMoney, periodLabel, todayIso } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button, IconButton } from '../ui/Button'
import { Field, Input, MoneyInput } from '../ui/Input'
import { Icon } from '../ui/Icon'
import type { PartnerCtx } from './shared'

/** A member's payments for one month: history, delete, and add (part or full). */
export function ContributionModal({
  ctx,
  row,
  period,
  onClose,
}: {
  ctx: PartnerCtx
  row: PeriodRow | null
  period: number
  onClose: () => void
}) {
  const { partner, refresh } = ctx
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const memberId = row?.member.id

  useEffect(() => {
    if (!row) return
    setAmount(row.remaining > 0 ? String(row.remaining) : '')
    setDate(todayIso())
    setNote('')
    // Reset only when a different member/month is opened, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, period])

  if (!row) return null

  async function add(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!(value > 0) || !row) return
    setSaving(true)
    const { error } = await supabase.from('contributions').insert({
      partner_id: partner.id,
      member_id: row.member.id,
      period,
      amount: value,
      paid_on: date,
      note: note.trim() || null,
    })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(`${formatMoney(value)} recorded`)
    setAmount('')
    setNote('')
  }

  async function remove(id: string) {
    const { error } = await supabase.from('contributions').delete().eq('id', id)
    if (error) return toast(error.message, 'error')
    refresh()
    toast('Payment removed', 'info')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row.member.name}
      subtitle={`Month ${period} · ${periodLabel(partner.start_date, period)} · ${formatMoney(row.due)} due`}
    >
      <div className="mb-5 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-brand-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Paid</p>
          <p className="num text-lg font-extrabold text-brand-800">{formatMoney(row.paid)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${row.remaining > 0 ? 'bg-amber-50' : 'bg-ink-50'}`}>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${row.remaining > 0 ? 'text-amber-600' : 'text-ink-400'}`}>Remaining</p>
          <p className={`num text-lg font-extrabold ${row.remaining > 0 ? 'text-amber-700' : 'text-ink-400'}`}>{formatMoney(row.remaining)}</p>
        </div>
      </div>

      {row.entries.length > 0 && (
        <ul className="mb-5 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
          {row.entries.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="num font-bold text-ink-800">{formatMoney(c.amount)}</p>
                <p className="truncate text-xs text-ink-400">
                  {formatDate(c.paid_on)}
                  {c.note && <> · {c.note}</>}
                </p>
              </div>
              <IconButton label="Remove payment" onClick={() => remove(c.id)} className="hover:bg-rose-50 hover:text-rose-600">
                <Icon name="trash" size={16} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
          </Field>
          <Field label="Date paid">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cash, bank transfer…" />
        </Field>
        <Button type="submit" loading={saving} disabled={!(Number(amount) > 0)} className="w-full">
          <Icon name="plus" size={16} /> Record payment
        </Button>
      </form>
    </Modal>
  )
}
