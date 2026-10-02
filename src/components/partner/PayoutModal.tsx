import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { DrawSlot } from '../../lib/calc'
import { formatMoney, periodLabel, todayIso } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput } from '../ui/Input'
import { Icon } from '../ui/Icon'
import type { PartnerCtx } from './shared'

/** Records a draw being handed over. Gross and fee are pre-filled from the partner's terms. */
export function PayoutModal({ ctx, slot, onClose }: { ctx: PartnerCtx; slot: DrawSlot | null; onClose: () => void }) {
  const { partner, members, summary, refresh } = ctx
  const { toast } = useToast()
  const [gross, setGross] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!slot) return
    setGross(String(summary.terms.grossPerDraw))
    setFee(String(summary.terms.feePerDraw))
    setDate(todayIso())
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot?.index])

  if (!slot) return null
  const member = members.find((m) => m.id === slot.memberId)
  if (!member) return null

  const grossN = Number(gross) || 0
  const feeN = Number(fee) || 0
  const net = Math.round((grossN - feeN) * 100) / 100
  const valid = grossN > 0 && feeN >= 0 && feeN <= grossN
  const short = grossN - summary.pot

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !slot || !member) return
    setSaving(true)
    const { error } = await supabase.from('payouts').insert({
      partner_id: partner.id,
      member_id: member.id,
      period: slot.period,
      gross: grossN,
      fee: feeN,
      paid_on: date,
      note: note.trim() || null,
    })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(`${formatMoney(net)} paid to ${member.name}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pay out ${member.name}`}
      subtitle={`Month ${slot.period} · ${periodLabel(partner.start_date, slot.period)}${member.hands > 1 ? ` · hand ${slot.handNo} of ${member.hands}` : ''}`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Draw amount">
            <MoneyInput value={gross} onChange={(e) => setGross(e.target.value)} required />
          </Field>
          <Field label="Banker fee">
            <MoneyInput value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3">
          <span className="text-sm font-semibold text-brand-800">{member.name} receives</span>
          <span className="num text-xl font-extrabold text-brand-800">{formatMoney(net)}</span>
        </div>

        {short > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <Icon name="alert" size={16} className="mt-px shrink-0" />
            <span>
              The pot only holds <strong className="num">{formatMoney(summary.pot)}</strong> — {formatMoney(short)} short of this draw.
              {summary.behind > 0 && <> Members owe {formatMoney(summary.behind)}.</>}
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cash / transfer" />
          </Field>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" className="flex-1" loading={saving} disabled={!valid}>
            Record payout
          </Button>
        </div>
      </form>
    </Modal>
  )
}
