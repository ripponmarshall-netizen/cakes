import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { MemberSummary } from '../../lib/calc'
import { formatHands, formatMoney, todayIso } from '../../lib/format'
import type { PayoutMethod, TransferMode } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { MethodPicker } from './MethodPicker'
import { scheduleOrder } from '../../lib/calc'
import { useLast } from '../../hooks/usePresence'
import type { PartnerCtx } from './shared'

/**
 * Someone drops out and someone else takes their hand. The old member's record
 * stays (marked "left"); the new member takes their place in the draw order.
 */
export function ReplaceMemberModal({
  ctx,
  m: liveM,
  onClose,
  onDone,
}: {
  ctx: PartnerCtx
  m: MemberSummary | null
  onClose: () => void
  onDone: () => void
}) {
  const { partner, summary, refresh } = ctx
  const m = useLast(liveM)
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(todayIso())
  const [mode, setMode] = useState<TransferMode>('buyout')
  const [refund, setRefund] = useState('')
  const [method, setMethod] = useState<PayoutMethod>('cash')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!liveM) return
    setName('')
    setPhone('')
    setDate(todayIso())
    setMode('buyout')
    setRefund(String(liveM.paid))
    setMethod('cash')
    setReference('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveM?.member.id])

  if (!m) return null
  const old = m.member
  const hasDrawn = m.receivedGross > 0
  const refundN = Number(refund) || 0
  const valid = name.trim().length > 0 && (mode === 'buyout' || (!hasDrawn && refundN >= 0 && refundN <= m.paid))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || !m) return
    setSaving(true)
    // replace_member hands over the slots in the saved draw order. Save the
    // order as shown first, so a never-reordered partner keeps everyone's seat.
    const shown = scheduleOrder(summary.schedule)
    if (JSON.stringify(shown) !== JSON.stringify(partner.draw_order ?? [])) {
      const { error: orderError } = await supabase.from('partners').update({ draw_order: shown }).eq('id', partner.id)
      if (orderError) {
        setSaving(false)
        return toast(orderError.message, 'error')
      }
    }
    const { error } = await supabase.rpc('replace_member', {
      p_member: old.id,
      p_name: name.trim(),
      p_phone: phone.trim() || null,
      p_mode: mode,
      p_left_on: date,
      p_refund: mode === 'refund' ? refundN : 0,
      p_refund_period: Math.max(1, summary.period),
      p_method: method,
      p_ref: reference.trim() || null,
    })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(`${name.trim()} took over from ${old.name}`)
    onDone()
  }

  return (
    <Modal
      open={!!liveM}
      onClose={onClose}
      title={`Replace ${old.name}`}
      subtitle={`${formatHands(m.hands)} · paid in ${formatMoney(m.paid)}`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="replace-form" className="flex-1" loading={saving} disabled={!valid}>
            <Icon name="swap" size={16} /> Replace
          </Button>
        </div>
      }
    >
      <form id="replace-form" onSubmit={submit} className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="New member">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={80} autoFocus />
          </Field>
          <Field label="Phone (optional)">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="876-555-0123" />
          </Field>
        </div>

        <Field label="How is it settled?">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'buyout', label: 'They buy the hand' },
              { value: 'refund', label: 'Refund from pot' },
            ]}
          />
        </Field>

        {mode === 'buyout' ? (
          <p className="rounded-2xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900 ring-1 ring-inset ring-sky-200/60">
            {name.trim() || 'The new member'} pays {old.name} back privately. The {formatMoney(m.paid)} already paid
            {hasDrawn && <> and the {formatMoney(m.received)} already drawn</>} carry over to the new member, who continues
            at {formatMoney(m.monthlyDue)} a month in the same draw position.
          </p>
        ) : hasDrawn ? (
          <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-200/70">
            <Icon name="alert" size={16} className="mt-px shrink-0" />
            {old.name} has already drawn, so a refund doesn’t make sense. Use a buy-out — the new member takes on what’s still owed.
          </p>
        ) : (
          <>
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900 ring-1 ring-inset ring-sky-200/60">
              {old.name} gets money back from the pot. {name.trim() || 'The new member'} starts from month 1 and must catch up (
              {formatMoney(m.dueToDate)} due so far).
            </p>
            <Field label="Refund to old member" hint={`They paid in ${formatMoney(m.paid)}. Enter 0 if you’ll settle it later.`}>
              <MoneyInput value={refund} onChange={(e) => setRefund(e.target.value)} />
            </Field>
            {refundN > 0 && <MethodPicker method={method} onMethod={setMethod} reference={reference} onReference={setReference} />}
          </>
        )}

        <Field label="Date of change">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>

      </form>
    </Modal>
  )
}
