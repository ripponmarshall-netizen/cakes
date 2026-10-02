import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { partnerTerms } from '../../lib/calc'
import { formatHands, formatMoney, plural, todayIso } from '../../lib/format'
import type { FeeType, Partner } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput, Segmented, Textarea, Toggle } from '../ui/Input'
import { Icon } from '../ui/Icon'

interface Props {
  open: boolean
  onClose: () => void
  /** Edit mode when given. */
  partner?: Partner
  totalHands?: number
  hasActivity?: boolean
  onCreated?: (id: string) => void
  onSaved?: () => void
  onDeleted?: () => void
}

export function PartnerForm({ open, onClose, partner, totalHands = 0, hasActivity = false, onCreated, onSaved, onDeleted }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [hand, setHand] = useState('')
  const [start, setStart] = useState(todayIso())
  const [term, setTerm] = useState('12')
  const [feeType, setFeeType] = useState<FeeType>('flat')
  const [fee, setFee] = useState('0')
  const [notes, setNotes] = useState('')
  const [shareSchedule, setShareSchedule] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(partner?.name ?? '')
    setHand(partner ? String(partner.hand_amount) : '')
    setStart(partner?.start_date ?? todayIso())
    setTerm(String(partner?.term_months ?? 12))
    setFeeType(partner?.fee_type ?? 'flat')
    setFee(String(partner?.fee_value ?? 0))
    setNotes(partner?.notes ?? '')
    setShareSchedule(partner?.share_schedule ?? false)
    // Reset only when opening (or switching partner): a live update to the
    // partner mustn't wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, partner?.id])

  const termN = Math.max(0, Math.floor(Number(term) || 0))
  const handN = Number(hand) || 0
  const feeN = Number(fee) || 0
  const valid = name.trim() && handN > 0 && termN >= 1 && termN <= 120 && feeN >= 0 && (feeType === 'flat' || feeN <= 100)
  const preview = partnerTerms({ hand_amount: handN, term_months: termN || 1, fee_type: feeType, fee_value: feeN })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    const values = {
      name: name.trim(),
      hand_amount: handN,
      start_date: start,
      term_months: termN,
      fee_type: feeType,
      fee_value: feeN,
      notes: notes.trim() || null,
      share_schedule: shareSchedule,
    }
    if (partner) {
      const { error } = await supabase.from('partners').update(values).eq('id', partner.id)
      setSaving(false)
      if (error) return toast(error.message, 'error')
      onSaved?.()
      toast('Partner updated')
      onClose()
    } else {
      const { data, error } = await supabase.from('partners').insert(values).select('id').single()
      setSaving(false)
      if (error) return toast(error.message, 'error')
      toast('Partner created')
      onClose()
      onCreated?.(data.id)
    }
  }

  async function onDelete() {
    if (!partner) return
    const ok = await confirm({
      title: `Delete “${partner.name}”?`,
      message: 'This permanently deletes the partner with all its members, payments and payouts. It can’t be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('partners').delete().eq('id', partner.id)
    if (error) return toast(error.message, 'error')
    toast('Partner deleted', 'info')
    onClose()
    onDeleted?.()
  }

  const formId = partner ? `partner-form-${partner.id}` : 'partner-form-new'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={partner ? 'Partner settings' : 'New partner'}
      subtitle={partner ? partner.name : 'One savings circle with its own hands and draws.'}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={!valid} className="flex-1">
            {partner ? 'Save changes' : 'Create partner'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4 pb-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fire Station Partner 2026" required maxLength={80} autoFocus={!partner} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hand (per month)">
            <MoneyInput value={hand} onChange={(e) => setHand(e.target.value)} placeholder="10000" required />
          </Field>
          <Field label="Length (months)">
            <Input type="number" inputMode="numeric" min={1} max={120} value={term} onChange={(e) => setTerm(e.target.value)} className="num font-semibold" required />
          </Field>
        </div>

        {totalHands > 0 && termN !== Math.ceil(totalHands) && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900 ring-1 ring-inset ring-sky-200/60">
            <Icon name="info" size={16} className="mt-px shrink-0" />
            <span className="flex-1">
              {formatHands(totalHands)} over {plural(termN, 'month')} — draws will be spread out so the pot always covers
              them.{' '}
              <button type="button" className="font-bold underline underline-offset-2" onClick={() => setTerm(String(Math.ceil(totalHands)))}>
                Match hands ({Math.ceil(totalHands)})
              </button>
            </span>
          </div>
        )}

        <Field label="First month starts" hint="Payments are due monthly from this date. A new month begins on the same day each month.">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>

        <Field label="Banker fee (taken from each draw)">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            {feeType === 'flat' ? (
              <MoneyInput value={fee} onChange={(e) => setFee(e.target.value)} />
            ) : (
              <div className="relative">
                <Input type="number" inputMode="decimal" min={0} max={100} step="0.1" value={fee} onChange={(e) => setFee(e.target.value)} className="num pr-9 font-semibold" />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-bold text-ink-400">%</span>
              </div>
            )}
            <div className="flex w-28 [&>*]:flex-1">
              <Segmented
                value={feeType}
                onChange={setFeeType}
                options={[
                  { value: 'flat', label: 'J$' },
                  { value: 'percent', label: '%' },
                ]}
              />
            </div>
          </div>
        </Field>

        {handN > 0 && termN > 0 && (
          <div className="animate-fade rounded-2xl bg-gradient-to-br from-brand-50 to-gold-50/60 p-4 text-sm ring-1 ring-inset ring-brand-600/10">
            <Row label={`Each hand pays ${formatMoney(handN)} × ${termN}`} value={formatMoney(preview.grossPerDraw)} />
            <Row label="Banker fee per draw" value={`− ${formatMoney(preview.feePerDraw)}`} />
            <div className="my-2 border-t border-brand-600/15" />
            <Row label="Member receives per hand" value={formatMoney(preview.netPerDraw)} strong />
          </div>
        )}

        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Rules, where the box is kept…" />
        </Field>

        <Toggle checked={shareSchedule} onChange={setShareSchedule} title="Show the draw order on members’ links">
          Off: a member’s link shows only their own payments and draws. On: it also lists everyone’s draw month by name (not what anyone
          else has paid).
        </Toggle>

        {partner && hasActivity && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200/70">
            <Icon name="alert" size={16} className="mt-px shrink-0" />
            Payments are already recorded. Changing the hand, length or start date changes what everyone owes and when they draw.
          </p>
        )}

        {partner && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onDelete}
              className="mx-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
            >
              <Icon name="trash" size={15} /> Delete partner
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 ${strong ? 'text-[15px] font-bold text-brand-800' : 'text-ink-600'}`}>
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  )
}
