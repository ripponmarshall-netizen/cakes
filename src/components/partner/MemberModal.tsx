import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { MemberSummary } from '../../lib/calc'
import { formatMoney, formatShortDate, periodLabel, plural } from '../../lib/format'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Badge'
import { StandingBadge } from './MembersTab'
import { Stat, type PartnerCtx } from './shared'

/** Add a member (summary = null) or view / edit one. */
export function MemberModal({
  ctx,
  open,
  summary,
  onClose,
}: {
  ctx: PartnerCtx
  open: boolean
  summary: MemberSummary | null
  onClose: () => void
}) {
  const { partner, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const member = summary?.member ?? null
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hands, setHands] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEditing(!member)
    setName(member?.name ?? '')
    setPhone(member?.phone ?? '')
    setHands(String(member?.hands ?? 1))
    setNotes(member?.notes ?? '')
    // Only reset when opening or switching member.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id])

  const handsN = Math.floor(Number(hands) || 0)
  const valid = name.trim().length > 0 && handsN >= 1 && handsN <= 50

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    const values = { name: name.trim(), phone: phone.trim() || null, hands: handsN, notes: notes.trim() || null }
    const { error } = member
      ? await supabase.from('members').update(values).eq('id', member.id)
      : await supabase.from('members').insert({ ...values, partner_id: partner.id })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(member ? 'Member updated' : `${values.name} added`)
    if (member) setEditing(false)
    else onClose()
  }

  async function remove() {
    if (!summary || !member) return
    if (summary.paid > 0 || summary.received > 0) {
      toast('This member has payments or payouts recorded. Remove those first.', 'error')
      return
    }
    const ok = await confirm({
      title: `Remove ${member.name}?`,
      message: 'They have no payments recorded. Their draw slots go to the remaining members.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('members').delete().eq('id', member.id)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(`${member.name} removed`, 'info')
    onClose()
  }

  if (!open) return null

  const form = (
    <form onSubmit={save} className="space-y-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={80} autoFocus={!member} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hands" hint={handsN > 0 ? `${formatMoney(partner.hand_amount * handsN)} a month` : undefined}>
          <Input type="number" inputMode="numeric" min={1} max={50} value={hands} onChange={(e) => setHands(e.target.value)} className="num" required />
        </Field>
        <Field label="Phone (optional)">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="876-555-0123" />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Wants to draw in December…" />
      </Field>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={member ? () => setEditing(false) : onClose}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={saving} disabled={!valid}>
          {member ? 'Save' : 'Add member'}
        </Button>
      </div>
    </form>
  )

  if (!summary || !member || editing) {
    return (
      <Modal open onClose={onClose} title={member ? `Edit ${member.name}` : 'Add member'}>
        {form}
      </Modal>
    )
  }

  const s = summary
  return (
    <Modal open onClose={onClose} title={member.name} subtitle={<>{plural(member.hands, 'hand')} · {formatMoney(s.monthlyDue)} a month</>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StandingBadge m={s} />
        {member.phone && (
          <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <Icon name="phone" size={13} /> {member.phone}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Paid in" value={formatMoney(s.paid)} sub={`of ${formatMoney(s.dueToDate)} due so far`} />
        <Stat label="Still to pay" value={formatMoney(s.stillToPay)} sub={`of ${formatMoney(s.termTotal)} total`} />
        <Stat label="Gets in total" value={formatMoney(s.entitlementNet)} tone="good" sub={s.entitlementFees > 0 ? `${formatMoney(s.entitlementGross)} − ${formatMoney(s.entitlementFees)} fee` : undefined} />
        <Stat label="Received" value={formatMoney(s.received)} sub={`${formatMoney(s.toReceive)} to come`} />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Draws</h3>
      <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
        {s.slots.map((slot) => (
          <li key={slot.index} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
            <span className="font-semibold text-ink-800">
              {periodLabel(partner.start_date, slot.period)}
            </span>
            {slot.payout ? (
              <Badge tone="green">
                <Icon name="check" size={12} /> {formatMoney(slot.payout.net)} · {formatShortDate(slot.payout.paid_on)}
              </Badge>
            ) : (
              <Badge tone={slot.period < ctx.summary.period ? 'red' : 'gray'}>{slot.period < ctx.summary.period ? 'Overdue' : 'Upcoming'}</Badge>
            )}
          </li>
        ))}
      </ul>

      {member.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-ink-50 px-3.5 py-2.5 text-sm text-ink-600">{member.notes}</p>}

      <div className="mt-6 flex gap-2">
        <Button variant="danger" onClick={remove}>
          <Icon name="trash" size={16} />
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
          Edit member
        </Button>
      </div>
    </Modal>
  )
}
