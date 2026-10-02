import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { MemberSummary } from '../../lib/calc'
import { formatHands, formatMoney, formatShortDate, monthsLabel, periodLabel } from '../../lib/format'
import { arrearsByPeriod } from '../../lib/calc'
import { normalizePhone, reminderMessage, waLink } from '../../lib/whatsapp'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Badge'
import { RiskBadge, StandingBadge } from './MembersTab'
import { StatementModal } from './StatementModal'
import { ReplaceMemberModal } from './ReplaceMemberModal'
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
  const { partner, members, contributions, payouts, refresh } = ctx
  const { profile } = useAuth()
  const { toast } = useToast()
  const confirm = useConfirm()
  const member = summary?.member ?? null
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [hands, setHands] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showStatement, setShowStatement] = useState(false)
  const [replacing, setReplacing] = useState(false)

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

  const handsN = Number(hands) || 0
  const halfSteps = Math.abs(handsN * 2 - Math.round(handsN * 2)) < 1e-9
  const valid = name.trim().length > 0 && handsN >= 0.5 && handsN <= 50 && halfSteps

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
    const hasHistory = [...contributions, ...payouts].some((r) => r.member_id === member.id)
    if (hasHistory) {
      toast('This member has money recorded (even if voided). Use “Replace” if someone is taking over their hand.', 'error')
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
        <Field
          label="Hands"
          hint={valid || handsN > 0 ? (halfSteps ? `${formatMoney(partner.hand_amount * handsN)} a month` : 'Whole or half hands only') : undefined}
        >
          <Input type="number" inputMode="decimal" min={0.5} max={50} step={0.5} value={hands} onChange={(e) => setHands(e.target.value)} className="num" required />
          <span className="mt-1.5 flex gap-1">
            {['0.5', '1', '1.5', '2'].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHands(h)}
                className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${Number(hands) === Number(h) ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
              >
                {formatHands(Number(h)).split(' ')[0]}
              </button>
            ))}
          </span>
        </Field>
        <Field label="Phone (optional)">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="876-555-0123" />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Wants to draw in December…" />
      </Field>
      {handsN % 1 !== 0 && halfSteps && (
        <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
          A half hand pays {formatMoney(partner.hand_amount / 2)} a month and shares one draw with another half hand — each gets half.
        </p>
      )}
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
  const owedMonths = s.behind > 0 ? arrearsByPeriod(partner, members, contributions, member.id, ctx.summary.period).map((a) => a.period) : []
  const remindHref = waLink(member.phone, reminderMessage(partner, s, owedMonths, profile?.display_name))

  if (showStatement) return <StatementModal ctx={ctx} m={s} onClose={() => setShowStatement(false)} />
  if (replacing) return <ReplaceMemberModal ctx={ctx} m={s} onClose={() => setReplacing(false)} onDone={onClose} />

  return (
    <Modal open onClose={onClose} title={member.name} subtitle={<>{formatHands(s.hands)} · {formatMoney(s.monthlyDue)} a month</>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StandingBadge m={s} />
        <RiskBadge m={s} />
        {member.phone && (
          <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <Icon name="phone" size={13} /> {member.phone}
          </a>
        )}
      </div>

      {s.risk && (
        <p className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${s.risk === 'high' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
          <Icon name="shield" size={16} className="mt-px shrink-0" />
          <span>
            Has drawn {formatMoney(s.receivedGross)} but paid in {formatMoney(s.paid)}. If they stop paying, the group is short{' '}
            <strong className="num">{formatMoney(s.exposure)}</strong>.
            {s.risk === 'high' && owedMonths.length > 0 && <> Already behind for {monthsLabel(owedMonths).toLowerCase()}.</>}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Paid in" value={formatMoney(s.paid)} sub={`of ${formatMoney(s.dueToDate)} due so far`} />
        <Stat label="Still to pay" value={formatMoney(s.stillToPay)} sub={`of ${formatMoney(s.termTotal)} total`} />
        <Stat label="Gets in total" value={formatMoney(s.entitlementNet)} tone="good" sub={s.entitlementFees > 0 ? `${formatMoney(s.entitlementGross)} − ${formatMoney(s.entitlementFees)} fee` : undefined} />
        <Stat label="Received" value={formatMoney(s.received)} sub={`${formatMoney(s.toReceive)} to come`} />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-ink-400">Draws</h3>
      <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
        {s.shares.map((slot) => (
          <li key={`${slot.slotIndex}-${slot.handNo}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
            <span className="font-semibold text-ink-800">
              {periodLabel(partner.start_date, slot.period)}
              {slot.half && <span className="font-normal text-ink-400"> · ½ hand</span>}
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

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setShowStatement(true)}>
          <Icon name="file" size={16} /> Statement
        </Button>
        <a
          href={remindHref}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
            s.behind > 0 ? 'bg-brand-700 text-white hover:bg-brand-800' : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50'
          }`}
          title={normalizePhone(member.phone) ? undefined : 'No usable phone number — WhatsApp will ask who to send it to'}
        >
          <Icon name="message" size={16} /> {s.behind > 0 ? 'Remind' : 'Message'}
        </a>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="danger" onClick={remove} aria-label="Remove member">
          <Icon name="trash" size={16} />
        </Button>
        <Button variant="secondary" onClick={() => setReplacing(true)}>
          <Icon name="swap" size={16} /> Replace
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    </Modal>
  )
}
