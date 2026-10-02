import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { arrearsByPeriod, toCents, type DrawShare } from '../../lib/calc'
import { formatMoney, monthsLabel, periodLabel, todayIso } from '../../lib/format'
import type { PayoutMethod } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { MethodPicker } from './MethodPicker'
import { lastMethod, rememberMethod } from './ContributionModal'
import type { PartnerCtx } from './shared'

/**
 * Records a draw being handed over. Gross and fee are pre-filled from the
 * partner's terms. If the member is behind, their arrears can be taken out of
 * the draw: that records the missing payments (method "Taken from draw") and
 * they get the rest in hand.
 */
export function PayoutModal({ ctx, share, onClose }: { ctx: PartnerCtx; share: DrawShare | null; onClose: () => void }) {
  const { partner, members, contributions, summary, refresh } = ctx
  const { toast } = useToast()
  const [gross, setGross] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(todayIso())
  const [method, setMethod] = useState<PayoutMethod>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [deduct, setDeduct] = useState(true)
  const [saving, setSaving] = useState(false)
  const shareKey = share ? `${share.slotIndex}:${share.memberId}` : null

  useEffect(() => {
    if (!share) return
    setGross(String(share.gross))
    setFee(String(share.fee))
    setDate(todayIso())
    setMethod(lastMethod('payout'))
    setReference('')
    setNote('')
    setDeduct(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey])

  const arrears = useMemo(
    () => (share ? arrearsByPeriod(partner, members, contributions, share.memberId, summary.period) : []),
    [share, partner, members, contributions, summary.period],
  )

  if (!share) return null
  const member = members.find((m) => m.id === share.memberId)
  if (!member) return null

  const grossN = Number(gross) || 0
  const feeN = Number(fee) || 0
  const netC = toCents(grossN) - toCents(feeN)
  const valid = grossN > 0 && feeN >= 0 && feeN <= grossN

  // Take arrears oldest-first, never more than the member would receive.
  let budget = Math.max(0, netC)
  const deductions = deduct
    ? arrears
        .map((a) => {
          const take = Math.min(toCents(a.amount), budget)
          budget -= take
          return { period: a.period, cents: take }
        })
        .filter((a) => a.cents > 0)
    : []
  const owedC = arrears.reduce((n, a) => n + toCents(a.amount), 0)
  const deductC = deductions.reduce((n, a) => n + a.cents, 0)
  const handOverC = netC - deductC
  const short = grossN - (summary.pot + deductC / 100)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !share || !member) return
    setSaving(true)
    const { error } = await supabase.from('payouts').insert({
      partner_id: partner.id,
      member_id: member.id,
      period: share.period,
      gross: grossN,
      fee: feeN,
      paid_on: date,
      method,
      ref: reference.trim() || null,
      note: note.trim() || null,
    })
    if (error) {
      setSaving(false)
      return toast(error.message, 'error')
    }
    if (deductions.length) {
      const { error: err2 } = await supabase.from('contributions').insert(
        deductions.map((d) => ({
          partner_id: partner.id,
          member_id: member.id,
          period: d.period,
          amount: d.cents / 100,
          paid_on: date,
          method: 'deduction',
          note: `Taken from month ${share.period} draw`,
        })),
      )
      if (err2) {
        setSaving(false)
        refresh()
        return toast(`Draw recorded, but the arrears weren’t: ${err2.message}. Record them in Payments.`, 'error')
      }
    }
    setSaving(false)
    rememberMethod(method, 'payout')
    refresh()
    toast(`${formatMoney(handOverC / 100)} paid to ${member.name}`)
    onClose()
  }

  const handLabel = share.half ? ' · ½ hand' : Number(member.hands) > 1 ? ` · hand ${share.handNo}` : ''

  return (
    <Modal open onClose={onClose} title={`Pay out ${member.name}`} subtitle={`Month ${share.period} · ${periodLabel(partner.start_date, share.period)}${handLabel}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Draw amount">
            <MoneyInput value={gross} onChange={(e) => setGross(e.target.value)} required />
          </Field>
          <Field label="Banker fee">
            <MoneyInput value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>

        {owedC > 0 && (
          <div className="rounded-2xl bg-rose-50 p-3.5 text-sm text-rose-800 ring-1 ring-rose-100">
            <p className="flex items-start gap-2">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>{member.name}</strong> is behind <strong className="num">{formatMoney(owedC / 100)}</strong> (
                {monthsLabel(arrears.map((a) => a.period)).toLowerCase()}). Once they draw, anything unpaid is money the group can lose.
              </span>
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 font-semibold">
              <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
              Take it out of this draw
            </label>
          </div>
        )}

        <div className="space-y-1 rounded-2xl bg-brand-50 px-4 py-3">
          {deductC > 0 && (
            <>
              <div className="num flex justify-between text-sm text-brand-800">
                <span>Draw after fee</span>
                <span>{formatMoney(netC / 100)}</span>
              </div>
              <div className="num flex justify-between text-sm text-brand-800">
                <span>Arrears taken out</span>
                <span>− {formatMoney(deductC / 100)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-brand-800">{member.name} receives</span>
            <span className="num text-xl font-extrabold text-brand-800">{formatMoney(handOverC / 100)}</span>
          </div>
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

        <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
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
