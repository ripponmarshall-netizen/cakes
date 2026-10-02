import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatHands, formatMoney, methodLabels } from '../../lib/format'
import type { AuditEntry, PaymentMethod, Profile } from '../../lib/types'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { Icon, type IconName } from '../ui/Icon'
import type { PartnerCtx } from './shared'

type Row = Record<string, unknown>
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const money = (v: unknown) => formatMoney(Number(v))

/** Who did what, when — read from the audit log the database writes on every change. */
export function HistoryModal({ ctx, open, onClose }: { ctx: PartnerCtx; open: boolean; onClose: () => void }) {
  const { partner, members } = ctx
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [people, setPeople] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setEntries(null)
    Promise.all([
      supabase.from('audit_log').select('*').eq('partner_id', partner.id).order('at', { ascending: false }).limit(300),
      supabase.from('profiles').select('id, display_name'),
    ]).then(([log, profiles]) => {
      if (!active) return
      if (log.error) return setError(log.error.message)
      setError(null)
      setEntries((log.data ?? []) as AuditEntry[])
      setPeople(new Map(((profiles.data ?? []) as Pick<Profile, 'id' | 'display_name'>[]).map((p) => [p.id, p.display_name])))
    })
    return () => {
      active = false
    }
  }, [open, partner.id])

  if (!open) return null
  const memberName = (id: unknown) => members.find((m) => m.id === id)?.name ?? 'a former member'

  function describe(e: AuditEntry): { icon: IconName; text: string; detail?: string; tone?: 'bad' } | null {
    const n = (e.new_row ?? {}) as Row
    const o = (e.old_row ?? {}) as Row
    const row = e.action === 'delete' ? o : n
    switch (e.table_name) {
      case 'contributions': {
        const what = `${money(row.amount)} from ${memberName(row.member_id)} · month ${str(row.period)}`
        if (e.action === 'insert') return { icon: 'wallet', text: `Payment ${what}`, detail: [methodLabels[row.method as PaymentMethod] ?? str(row.method), str(row.ref)].filter(Boolean).join(' · ') }
        if (e.action === 'void') return { icon: 'ban', text: `Voided payment ${what}`, detail: str(n.void_reason), tone: 'bad' }
        if (e.action === 'delete') return { icon: 'trash', text: `Deleted payment ${what}`, tone: 'bad' }
        return { icon: 'wallet', text: `Edited payment details · ${what}` }
      }
      case 'payouts': {
        const refund = row.kind === 'refund'
        const what = refund
          ? `refund ${money(row.gross)} to ${memberName(row.member_id)}`
          : `draw ${money(row.net ?? Number(row.gross) - Number(row.fee))} to ${memberName(row.member_id)} · month ${str(row.period)}`
        if (e.action === 'insert') return { icon: refund ? 'undo' : 'gift', text: what[0].toUpperCase() + what.slice(1), detail: Number(row.fee) > 0 ? `fee ${money(row.fee)}` : undefined }
        if (e.action === 'void') return { icon: 'ban', text: `Voided ${what}`, detail: str(n.void_reason), tone: 'bad' }
        if (e.action === 'delete') return { icon: 'trash', text: `Deleted ${what}`, tone: 'bad' }
        return { icon: 'gift', text: `Edited ${what}` }
      }
      case 'members': {
        if (e.action === 'insert') return { icon: 'users', text: `Added ${str(n.name)}`, detail: formatHands(Number(n.hands)) }
        if (e.action === 'delete') return { icon: 'trash', text: `Removed ${str(o.name)}`, tone: 'bad' }
        const changes: string[] = []
        if (o.name !== n.name) changes.push(`name ${str(o.name)} → ${str(n.name)}`)
        if (Number(o.hands) !== Number(n.hands)) changes.push(`${formatHands(Number(o.hands))} → ${formatHands(Number(n.hands))}`)
        if (o.phone !== n.phone) changes.push('phone')
        if (o.notes !== n.notes) changes.push('notes')
        if (o.share_token !== n.share_token) changes.push('reset statement link')
        if (!o.replaced_by && n.replaced_by) {
          return { icon: 'swap', text: `${str(n.name)} left — ${n.transfer_mode === 'buyout' ? 'hand bought by' : 'refunded, replaced by'} ${memberName(n.replaced_by)}` }
        }
        return changes.length ? { icon: 'users', text: `Updated ${str(n.name)}`, detail: changes.join(' · ') } : null
      }
      case 'partners': {
        if (e.action === 'insert') return { icon: 'plus', text: 'Partner created' }
        if (e.action === 'delete') return { icon: 'trash', text: 'Partner deleted', tone: 'bad' }
        const labels: Record<string, string> = {
          name: 'name',
          hand_amount: 'hand',
          term_months: 'length',
          start_date: 'start date',
          fee_type: 'fee type',
          fee_value: 'fee',
          notes: 'notes',
          share_schedule: 'statement sharing',
        }
        const changed = Object.keys(labels).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
        if (JSON.stringify(o.draw_order) !== JSON.stringify(n.draw_order) && changed.length === 0) return { icon: 'shuffle', text: 'Changed the draw order' }
        return changed.length ? { icon: 'settings', text: 'Changed settings', detail: changed.map((k) => labels[k]).join(', ') } : null
      }
    }
    return null
  }

  return (
    <Modal open onClose={onClose} title="History" subtitle="Every change, newest first. Kept by the database — it can’t be edited.">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !entries ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Nothing recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const d = describe(e)
            if (!d) return null
            return (
              <li key={e.id} className="flex gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${d.tone === 'bad' ? 'bg-rose-50 text-rose-600' : 'bg-ink-100 text-ink-500'}`}>
                  <Icon name={d.icon} size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="num text-sm font-semibold text-ink-800">{d.text}</p>
                  {d.detail && <p className="truncate text-xs text-ink-500">{d.detail}</p>}
                  <p className="text-[11px] text-ink-400">
                    {new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {e.actor && <> · {people.get(e.actor) ?? 'a banker'}</>}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
