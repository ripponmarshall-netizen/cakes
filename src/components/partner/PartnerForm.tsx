import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { noDrawMonths, partnerTerms, projectedShortfall, type DrawSlot } from '../../lib/calc'
import { formatHands, formatMoney, periodLabel, plural, todayIso } from '../../lib/format'
import type { FeeType, Member, Partner } from '../../lib/types'
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
  /** Edit mode: for the no-draw preview (does the pot cover every draw?). */
  members?: Member[]
  /** Edit mode: months holding a paid draw can't become no-draw months. */
  schedule?: DrawSlot[]
  hasActivity?: boolean
  onCreated?: (id: string) => void
  onSaved?: () => void
  onDeleted?: () => void
  /** Offers "Start the next round" (edit mode). */
  onNextRound?: () => void
}

export function PartnerForm({ open, onClose, partner, totalHands = 0, members = [], schedule = [], hasActivity = false, onCreated, onSaved, onDeleted, onNextRound }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [hand, setHand] = useState('')
  const [start, setStart] = useState(todayIso())
  const [term, setTerm] = useState('12')
  const [feeType, setFeeType] = useState<FeeType>('flat')
  const [fee, setFee] = useState('0')
  const [notes, setNotes] = useState('')
  const [payDetails, setPayDetails] = useState('')
  const [shareSchedule, setShareSchedule] = useState(false)
  const [noDraw, setNoDraw] = useState<number[]>([])
  const [pickingMonths, setPickingMonths] = useState(false)
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
    setPayDetails(partner?.pay_details ?? '')
    setShareSchedule(partner?.share_schedule ?? false)
    const saved = partner ? noDrawMonths(partner) : []
    setNoDraw(saved)
    setPickingMonths(saved.length > 0)
    // Reset only when opening (or switching partner): a live update to the
    // partner mustn't wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, partner?.id])

  const termN = Math.max(0, Math.floor(Number(term) || 0))
  const handN = Number(hand) || 0
  const feeN = Number(fee) || 0
  const valid = name.trim() && handN > 0 && termN >= 1 && termN <= 120 && feeN >= 0 && (feeType === 'flat' || feeN <= 100)
  const preview = partnerTerms({ hand_amount: handN, term_months: termN || 1, fee_type: feeType, fee_value: feeN })
  // Months past a shortened length drop out; at least one month has to draw.
  const skips = noDrawMonths({ term_months: termN, no_draw_months: noDraw })
  const paidMonths = new Set(schedule.filter((s) => s.locked).map((s) => s.period))
  const shortfall =
    partner && members.length > 0 && handN > 0 && termN >= 1 && termN <= 120
      ? projectedShortfall({ ...partner, hand_amount: handN, term_months: termN, no_draw_months: skips }, members)
      : null
  const draws = schedule.length

  function toggleMonth(m: number) {
    setNoDraw((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m].sort((a, b) => a - b)))
  }

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
      pay_details: payDetails.trim() || null,
      share_schedule: shareSchedule,
      // Sent only when it's in use, so a database without the v4 migration can still save settings.
      ...(skips.length > 0 || (partner && noDrawMonths(partner).length > 0) ? { no_draw_months: skips } : {}),
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
          <Field label="Length (months)" hint={termN > 120 ? <span className="font-semibold text-rose-600">Up to 120 months</span> : undefined}>
            <Input type="number" inputMode="numeric" min={1} max={120} value={term} onChange={(e) => setTerm(e.target.value)} className="num font-semibold" required />
          </Field>
        </div>

        {totalHands > 0 && termN !== Math.ceil(totalHands) && skips.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900 ring-1 ring-inset ring-sky-200/60">
            <Icon name="info" size={16} className="mt-px shrink-0" />
            <span className="flex-1">
              {formatHands(totalHands)} over {plural(termN, 'month')} — draws will be spread out so the pot always covers
              them{termN > totalHands ? ', or pick the months with no draw below' : ''}.{' '}
              <button type="button" className="font-bold underline underline-offset-2" onClick={() => setTerm(String(Math.ceil(totalHands)))}>
                Match hands ({Math.ceil(totalHands)})
              </button>
            </span>
          </div>
        )}

        <Field label="First month starts" hint="Payments are due monthly from this date. A new month begins on the same day each month.">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>

        <Field
          label="Banker fee (taken from each draw)"
          hint={feeType === 'percent' && feeN > 100 ? <span className="font-semibold text-rose-600">A percentage fee can’t be over 100%</span> : undefined}
        >
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
                label="Fee type"
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
          <div className="hero animate-fade !rounded-2xl p-4 text-sm">
            <Row label={`Each hand pays ${formatMoney(handN)} × ${termN}`} value={formatMoney(preview.grossPerDraw)} />
            <Row label="Banker fee per draw" value={`− ${formatMoney(preview.feePerDraw)}`} />
            <div className="my-2 border-t border-dashed border-accent-500/30" />
            <Row label="Member receives per hand" value={formatMoney(preview.netPerDraw)} strong />
          </div>
        )}

        {termN >= 2 && termN <= 120 && (
          <div className="rounded-2xl bg-ink-50/60 p-3.5 ring-1 ring-inset ring-line-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">Months with no draw</p>
                <p className="text-xs leading-relaxed text-ink-500">
                  {skips.length === 0
                    ? 'Everyone still pays; nobody draws that month.'
                    : `${plural(skips.length, 'month')} · ${draws ? `${plural(draws, 'draw')} over ${plural(termN - skips.length, 'month')}` : 'everyone still pays'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickingMonths((v) => !v)}
                aria-expanded={pickingMonths}
                className="shrink-0 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-accent-700 transition hover:bg-accent-500/10"
              >
                {pickingMonths ? 'Done' : skips.length ? 'Change' : 'Choose'}
              </button>
            </div>
            {pickingMonths && (
              <div className="animate-fade mt-3">
                <div role="group" aria-label="Months with no draw" className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {Array.from({ length: termN }, (_, i) => i + 1).map((m) => {
                    const on = skips.includes(m)
                    const paid = !on && paidMonths.has(m)
                    const last = !on && skips.length >= termN - 1
                    const [mon, yr] = start ? periodLabel(start, m).split(' ') : ['', '']
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMonth(m)}
                        disabled={paid || last}
                        aria-pressed={on}
                        aria-label={`Month ${m}${mon ? `, ${mon} ${yr}` : ''}${paid ? ': a draw is already paid' : on ? ': no draw' : ''}`}
                        title={paid ? 'A draw is already paid this month' : undefined}
                        className={`flex flex-col items-center rounded-xl py-1.5 ring-1 ring-inset transition disabled:opacity-40 ${
                          on ? 'bg-ink-900 text-canvas ring-ink-900' : 'bg-surface text-ink-700 ring-line hover:ring-ink-300'
                        }`}
                      >
                        <span className="mono text-sm font-semibold leading-tight">{m}</span>
                        {mon && (
                          <span className="whitespace-nowrap text-[10px] font-medium opacity-70">
                            {mon} ’{yr.slice(-2)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
                  Each draw stays {formatMoney(preview.grossPerDraw)} (the hand × {termN}). The draws move to the other months
                  {draws > termN - skips.length ? ', some sharing a month' : ''}.
                </p>
              </div>
            )}
            {shortfall && (
              <p className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200/70">
                <Icon name="alert" size={15} className="mt-px shrink-0" />
                <span>
                  Even with everyone paid up, the pot is short for the month {shortfall.period} draw (up to{' '}
                  <strong className="num">{formatMoney(shortfall.short)}</strong>). Put a no-draw month earlier — month 1 is the
                  usual one — or plan to front the difference.
                </span>
              </p>
            )}
          </div>
        )}

        <Field label="How members pay you (optional)" hint="Shown on members’ statements and added to reminders.">
          <Textarea
            value={payDetails}
            onChange={(e) => setPayDetails(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Lynk @yourname · NCB savings 123456789"
          />
        </Field>

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
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {onNextRound && (
              <button
                type="button"
                onClick={onNextRound}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-accent-700 transition hover:bg-accent-500/10"
              >
                <Icon name="sparkle" size={15} /> Start the next round
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
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
    <div className={`relative flex justify-between gap-3 py-0.5 ${strong ? 'text-[15px] font-semibold text-ink-900' : 'text-ink-500'}`}>
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  )
}
