import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { arrearsByPeriod, type MemberSummary } from '../../lib/calc'
import { formatHands, formatMoney, formatShortDate, monthsLabel, periodLabel } from '../../lib/format'
import { normalizePhone, reminderMessage, waLink } from '../../lib/whatsapp'
import { useAuth } from '../../context/AuthContext'
import { useLast } from '../../hooks/usePresence'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button, LinkButton } from '../ui/Button'
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
  summary: liveSummary,
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
  // What was on screen when last open, so closing animates the same content out.
  const view = useLast(open ? { summary: liveSummary } : null)
  const summary = view?.summary ?? null
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
    setShowStatement(false)
    setReplacing(false)
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
    // Deleting a replacement would clear the old member's "replaced by" and
    // quietly bring them back as active.
    const predecessor = members.find((x) => x.replaced_by === member.id)
    if (predecessor) {
      toast(`${member.name} took over from ${predecessor.name}, so they can’t be removed. Use “Replace” instead.`, 'error')
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

  if (!view) return null
  const formId = `member-form-${member?.id ?? 'new'}`

  const form = (
    <form id={formId} onSubmit={save} className="space-y-4 pb-2">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={80} autoFocus={!member} />
      </Field>
      <Field label="Hands" hint={handsN > 0 ? (halfSteps ? `${formatMoney(partner.hand_amount * handsN)} a month` : 'Whole or half hands only') : undefined}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input type="number" inputMode="decimal" min={0.5} max={50} step={0.5} value={hands} onChange={(e) => setHands(e.target.value)} className="num font-semibold" required />
          <span className="flex gap-1 rounded-2xl bg-ink-900/[0.05] p-1">
            {['0.5', '1', '1.5', '2'].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHands(h)}
                className={`min-w-[2.5rem] rounded-xl px-2 text-sm font-bold transition duration-200 ${
                  Number(hands) === Number(h) ? 'bg-raised text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                {formatHands(Number(h)).split(' ')[0]}
              </button>
            ))}
          </span>
        </div>
      </Field>
      <Field label="Phone (optional)" hint="Used for WhatsApp reminders. Local numbers get 1-876 added.">
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="876-555-0123" />
      </Field>
      <Field label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Wants to draw in December…" />
      </Field>
      {handsN % 1 !== 0 && halfSteps && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900 ring-1 ring-inset ring-sky-200/60">
          <Icon name="info" size={16} className="mt-px shrink-0" />
          A half hand pays {formatMoney(partner.hand_amount / 2)} a month and shares one draw with another half hand — each gets half.
        </p>
      )}
    </form>
  )

  const formFooter = (
    <div className="flex gap-2.5">
      <Button variant="secondary" className="flex-1" onClick={member ? () => setEditing(false) : onClose}>
        Cancel
      </Button>
      <Button type="submit" form={formId} className="flex-1" loading={saving} disabled={!valid}>
        {member ? 'Save' : 'Add member'}
      </Button>
    </div>
  )

  if (!summary || !member) {
    return (
      <Modal open={open} onClose={onClose} title="Add member" subtitle={partner.name} footer={formFooter}>
        {form}
      </Modal>
    )
  }

  const s = summary
  const owedMonths = s.behind > 0 ? arrearsByPeriod(partner, members, contributions, member.id, ctx.summary.period).map((a) => a.period) : []
  const remindHref = waLink(member.phone, reminderMessage(partner, s, owedMonths, profile?.display_name))
  const hasPhone = !!normalizePhone(member.phone)

  const detailFooter = (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={() => setShowStatement(true)}>
          <Icon name="file" size={16} /> Statement
        </Button>
        <LinkButton
          href={remindHref}
          target="_blank"
          rel="noreferrer"
          variant={s.behind > 0 ? 'primary' : 'secondary'}
          title={hasPhone ? undefined : 'No usable phone number — WhatsApp will ask who to send it to'}
        >
          <Icon name="message" size={16} /> {s.behind > 0 ? 'Remind' : 'Message'}
        </LinkButton>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Icon name="settings" size={15} /> Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setReplacing(true)}>
          <Icon name="swap" size={15} /> Replace
        </Button>
        <Button variant="ghost" size="sm" onClick={remove} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
          <Icon name="trash" size={15} /> Remove
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={editing ? `Edit ${member.name}` : member.name}
        subtitle={editing ? partner.name : <>{formatHands(s.hands)} · {formatMoney(s.monthlyDue)} a month</>}
        footer={editing ? formFooter : detailFooter}
      >
        {editing ? (
          form
        ) : (
          <div key="detail" className="animate-fade pb-2">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StandingBadge m={s} />
              <RiskBadge m={s} />
              {member.phone && (
                <a
                  href={`tel:${member.phone}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                >
                  <Icon name="phone" size={12} /> {member.phone}
                </a>
              )}
            </div>

            {s.risk && (
              <p
                className={`mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-xs leading-relaxed ring-1 ring-inset ${
                  s.risk === 'high' ? 'bg-rose-50 text-rose-900 ring-rose-200/70' : 'bg-amber-50 text-amber-900 ring-amber-200/70'
                }`}
              >
                <Icon name="shield" size={16} className="mt-px shrink-0" />
                <span>
                  Has drawn {formatMoney(s.receivedGross)} but paid in {formatMoney(s.paid)}. If they stop paying, the group is short{' '}
                  <strong className="num">{formatMoney(s.exposure)}</strong>.
                  {s.risk === 'high' && owedMonths.length > 0 && <> Already behind for {monthsLabel(owedMonths).toLowerCase()}.</>}
                </span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Paid in" value={formatMoney(s.paid)} sub={`of ${formatMoney(s.dueToDate)} due so far`} tone={s.behind > 0 ? 'bad' : 'default'} />
              <Stat label="Still to pay" value={formatMoney(s.stillToPay)} sub={`of ${formatMoney(s.termTotal)} total`} />
              <Stat
                label="Gets in total"
                value={formatMoney(s.entitlementNet)}
                tone="good"
                sub={s.entitlementFees > 0 ? `${formatMoney(s.entitlementGross)} − ${formatMoney(s.entitlementFees)} fee` : undefined}
              />
              <Stat label="Received" value={formatMoney(s.received)} sub={`${formatMoney(s.toReceive)} to come`} />
            </div>

            <p className="eyebrow mb-2 mt-6 px-1">Draws</p>
            <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-inset ring-ink-200/70">
              {s.shares.map((slot) => {
                const overdue = !slot.payout && slot.period < ctx.summary.rawPeriod
                return (
                  <li key={`${slot.slotIndex}-${slot.handNo}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex items-center gap-2.5 font-semibold text-ink-800">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          slot.payout ? 'bg-brand-50 text-brand-600' : overdue ? 'bg-rose-50 text-rose-500' : 'bg-gold-50 text-gold-600'
                        }`}
                      >
                        <Icon name={slot.payout ? 'check' : 'gift'} size={15} />
                      </span>
                      <span>
                        {periodLabel(partner.start_date, slot.period)}
                        <span className="block text-xs font-normal text-ink-400">
                          Month {slot.period}
                          {slot.half && <> · ½ hand</>}
                        </span>
                      </span>
                    </span>
                    {slot.payout ? (
                      <Badge tone="green">
                        <Icon name="check" size={11} /> {formatMoney(slot.payout.net)} · {formatShortDate(slot.payout.paid_on)}
                      </Badge>
                    ) : (
                      <Badge tone={overdue ? 'red' : 'gray'}>{overdue ? 'Overdue' : `${formatMoney(slot.net)} · upcoming`}</Badge>
                    )}
                  </li>
                )
              })}
            </ul>

            {member.notes && (
              <>
                <p className="eyebrow mb-2 mt-6 px-1">Notes</p>
                <p className="whitespace-pre-line rounded-2xl bg-ink-50/80 px-4 py-3 text-sm leading-relaxed text-ink-600">{member.notes}</p>
              </>
            )}
          </div>
        )}
      </Modal>
      <StatementModal ctx={ctx} m={open && showStatement ? s : null} onClose={() => setShowStatement(false)} />
      <ReplaceMemberModal ctx={ctx} m={open && replacing ? s : null} onClose={() => setReplacing(false)} onDone={onClose} />
    </>
  )
}
