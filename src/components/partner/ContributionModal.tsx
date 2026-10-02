import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { PeriodRow } from '../../lib/calc'
import { readCache, writeCache } from '../../lib/cache'
import { formatDate, formatMoney, methodLabels, periodLabel, todayIso } from '../../lib/format'
import type { Contribution, PayoutMethod } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button, IconButton } from '../ui/Button'
import { Field, Input, MoneyInput } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Badge'
import { MethodPicker } from './MethodPicker'
import { VoidDialog } from './VoidDialog'
import type { PartnerCtx } from './shared'

/**
 * The method used last on this device, so "Mark paid" matches how you usually
 * collect. Payments and payouts are remembered separately — collecting by Lynk
 * doesn't mean you hand draws over by Lynk.
 */
type MethodFor = 'payment' | 'payout'
export const lastMethod = (kind: MethodFor = 'payment'): PayoutMethod => readCache<PayoutMethod>(`pref:method:${kind}`) ?? 'cash'
export const rememberMethod = (m: PayoutMethod, kind: MethodFor = 'payment') => writeCache(`pref:method:${kind}`, m)

/** A member's payments for one month: history, void, and add (part or full). */
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
  const { partner, members, refresh } = ctx
  const { toast } = useToast()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [method, setMethod] = useState<PayoutMethod>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState<Contribution | null>(null)
  const memberId = row?.member.id

  useEffect(() => {
    if (!row) return
    setAmount(row.remaining > 0 ? String(row.remaining) : '')
    setDate(todayIso())
    setMethod(lastMethod())
    setReference('')
    setNote('')
    // Reset only when a different member/month is opened, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, period])

  if (!row) return null
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name

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
      method,
      ref: reference.trim() || null,
      note: note.trim() || null,
    })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    rememberMethod(method)
    refresh()
    toast(`${formatMoney(value)} recorded`)
    setAmount('')
    setReference('')
    setNote('')
  }

  async function voidEntry(reason: string): Promise<boolean> {
    if (!voiding) return false
    const { error } = await supabase
      .from('contributions')
      .update({ voided_at: new Date().toISOString(), void_reason: reason })
      .eq('id', voiding.id)
    if (error) {
      toast(error.message, 'error')
      return false
    }
    refresh()
    toast('Payment voided', 'info')
    return true
  }

  const entry = (c: Contribution, voided: boolean) => (
    <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className={`num font-bold ${voided ? 'text-ink-400 line-through' : 'text-ink-800'}`}>
          {formatMoney(c.amount)}{' '}
          <Badge tone={c.method === 'deduction' ? 'gold' : 'gray'} className="ml-1 align-middle no-underline">
            {methodLabels[c.method] ?? c.method}
          </Badge>
        </p>
        <p className="truncate text-xs text-ink-400">
          {formatDate(c.paid_on)}
          {c.ref && <> · ref {c.ref}</>}
          {c.member_id !== row.member.id && <> · paid by {nameOf(c.member_id) ?? 'previous member'}</>}
          {c.note && <> · {c.note}</>}
        </p>
        {voided && <p className="truncate text-xs font-semibold text-rose-600">Voided · {c.void_reason}</p>}
      </div>
      {!voided && (
        <IconButton label="Void payment" onClick={() => setVoiding(c)} className="hover:bg-rose-50 hover:text-rose-600">
          <Icon name="ban" size={16} />
        </IconButton>
      )}
    </li>
  )

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

      {row.entries.length + row.voided.length > 0 && (
        <ul className="mb-5 divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
          {row.entries.map((c) => entry(c, false))}
          {row.voided.map((c) => entry(c, true))}
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
        <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid at the station…" maxLength={200} />
        </Field>
        <Button type="submit" loading={saving} disabled={!(Number(amount) > 0)} className="w-full">
          <Icon name="plus" size={16} /> Record payment
        </Button>
      </form>

      <VoidDialog open={!!voiding} title="Void this payment?" confirmLabel="Void payment" onClose={() => setVoiding(null)} onConfirm={voidEntry}>
        {voiding && (
          <>
            {formatMoney(voiding.amount)} from {row.member.name} on {formatDate(voiding.paid_on)} will stop counting. If the amount was
            wrong, void it and record the right one.
          </>
        )}
      </VoidDialog>
    </Modal>
  )
}
