import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { logMessage, outcomeMessage, recordPayout } from '../../lib/ledgerWrites'
import { normalizePhone, payoutReceiptMessage, waLink } from '../../lib/whatsapp'
import { useAuth } from '../../context/AuthContext'
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
import { useLast } from '../../hooks/usePresence'

/**
 * Records a draw being handed over. Gross and fee are pre-filled from the
 * partner's terms. If the member is behind, their arrears can be taken out of
 * the draw: that records the missing payments (method "Taken from draw") and
 * they get the rest in hand.
 */
export function PayoutModal({ ctx, share: liveShare, onClose }: { ctx: PartnerCtx; share: DrawShare | null; onClose: () => void }) {
  const { partner, members, contributions, summary } = ctx
  const { toast } = useToast()
  const { profile } = useAuth()
  const [gross, setGross] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(todayIso())
  const [method, setMethod] = useState<PayoutMethod>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [deduct, setDeduct] = useState(true)
  const share = useLast(liveShare)
  const shareKey = liveShare ? `${liveShare.slotIndex}:${liveShare.memberId}` : null

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
    // One transaction on the server: the draw and the arrears taken out of it
    // are saved together or not at all, and a retry can't save them twice.
    const handed = handOverC / 100
    const written = recordPayout(
      {
        partner_id: partner.id,
        member_id: member.id,
        period: share.period,
        gross: grossN,
        fee: feeN,
        paid_on: date,
        method,
        ref: reference.trim() || null,
        note: note.trim() || null,
      },
      deductions.map((d) => ({ period: d.period, amount: d.cents / 100, note: `Taken from month ${share.period} draw` })),
      `Draw for ${member.name}`,
    )
    rememberMethod(method, 'payout')
    const receipt = payoutReceiptMessage(
      partner,
      member.name,
      { period: share.period, gross: grossN, fee: feeN, arrears: deductC / 100, handed, paid_on: date },
      profile?.display_name,
    )
    const phone = member.phone
    toast(`${formatMoney(handed)} paid to ${member.name}`, 'success', {
      actions: normalizePhone(phone)
        ? [
            {
              label: 'Receipt',
              onClick: () => {
                window.open(waLink(phone, receipt), '_blank', 'noreferrer')
                logMessage(partner.id, member.id, 'receipt')
              },
            },
          ]
        : [],
    })
    onClose()
    const msg = outcomeMessage(await written.done)
    if (msg) toast(msg.text, msg.tone)
  }

  const handLabel = share.half ? ' · ½ hand' : Number(member.hands) > 1 ? ` · hand ${share.handNo}` : ''

  return (
    <Modal
      open={!!liveShare}
      onClose={onClose}
      title={`Pay out ${member.name}`}
      subtitle={`Month ${share.period} · ${periodLabel(partner.start_date, share.period)}${handLabel}`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payout-form" variant="gold" className="flex-1" disabled={!valid}>
            Record payout
          </Button>
        </div>
      }
    >
      <form id="payout-form" onSubmit={submit} className="space-y-4 pb-2">
        {/* What they walk away with */}
        <div className="theme-light relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full border-[14px] border-gold-300/10" aria-hidden />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-gold-200/90">{member.name} receives</p>
          <p className="num relative mt-1 font-display text-4xl font-semibold">{formatMoney(handOverC / 100)}</p>
          <div className="num relative mt-3 space-y-0.5 border-t border-white/10 pt-3 text-[13px] text-brand-100/85">
            <Line label="Draw" value={formatMoney(grossN)} />
            {feeN > 0 && <Line label="Banker fee" value={`− ${formatMoney(feeN)}`} />}
            {deductC > 0 && <Line label="Arrears taken out" value={`− ${formatMoney(deductC / 100)}`} />}
          </div>
        </div>

        {owedC > 0 && (
          <div className="rounded-2xl bg-rose-50/90 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200/70">
            <p className="flex items-start gap-2.5 leading-relaxed">
              <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-rose-500" />
              <span>
                <strong>{member.name}</strong> is behind <strong className="num">{formatMoney(owedC / 100)}</strong> (
                {monthsLabel(arrears.map((a) => a.period)).toLowerCase()}). Once they draw, anything unpaid is money the group can lose.
              </span>
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl bg-surface/70 px-3 py-2.5 font-semibold ring-1 ring-inset ring-rose-200/60">
              <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className="h-4 w-4 rounded accent-brand-700" />
              Take it out of this draw
            </label>
          </div>
        )}

        {short > 0 && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200/70">
            <Icon name="alert" size={16} className="mt-px shrink-0" />
            <span>
              The pot only holds <strong className="num">{formatMoney(summary.pot)}</strong> — {formatMoney(short)} short of this draw.
              {summary.behind > 0 && <> Members owe {formatMoney(summary.behind)}.</>}
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Draw amount">
            <MoneyInput value={gross} onChange={(e) => setGross(e.target.value)} required />
          </Field>
          <Field label="Banker fee">
            <MoneyInput value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>
        {!valid && grossN > 0 && <p className="-mt-2 text-xs font-semibold text-rose-600">The fee can’t be more than the draw.</p>}

        <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
