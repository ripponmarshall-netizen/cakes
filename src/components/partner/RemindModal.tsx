import { useState } from 'react'
import { arrearsByPeriod } from '../../lib/calc'
import { formatMoney, monthsLabel } from '../../lib/format'
import { normalizePhone, reminderMessage, waLink } from '../../lib/whatsapp'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../ui/Modal'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import { Avatar, type PartnerCtx } from './shared'

/** Steps through everyone who's behind: one tap opens WhatsApp with their reminder ready. */
export function RemindModal({ ctx, open, onClose }: { ctx: PartnerCtx; open: boolean; onClose: () => void }) {
  const { partner, members, contributions, summary } = ctx
  const { profile } = useAuth()
  const [sent, setSent] = useState<Set<string>>(new Set())
  if (!open) return null

  const behind = summary.members
    .filter((m) => m.behind > 0)
    .sort((a, b) => (b.risk === 'high' ? 1 : 0) - (a.risk === 'high' ? 1 : 0) || b.behind - a.behind)

  return (
    <Modal open onClose={onClose} title="Send reminders" subtitle={`${behind.length} behind · ${formatMoney(summary.behind)} owed`}>
      {behind.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Everyone is paid up. Nothing to send.</p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
            {behind.map((m) => {
              const months = arrearsByPeriod(partner, members, contributions, m.member.id, summary.period).map((a) => a.period)
              const hasPhone = !!normalizePhone(m.member.phone)
              const done = sent.has(m.member.id)
              return (
                <li key={m.member.id} className="flex items-center gap-3 px-3.5 py-3">
                  <Avatar name={m.member.name} id={m.member.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink-900">
                      {m.member.name} {m.risk === 'high' && <Badge tone="red">drew already</Badge>}
                    </p>
                    <p className="num text-xs text-ink-500">
                      {formatMoney(m.behind)} · {monthsLabel(months).toLowerCase()}
                      {!hasPhone && <span className="text-amber-600"> · no phone saved</span>}
                    </p>
                  </div>
                  <a
                    href={waLink(m.member.phone, reminderMessage(partner, m, months, profile?.display_name))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setSent((s) => new Set(s).add(m.member.id))}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${
                      done ? 'bg-brand-50 text-brand-700' : 'bg-brand-700 text-white hover:bg-brand-800'
                    }`}
                  >
                    <Icon name={done ? 'check' : 'message'} size={15} /> {done ? 'Sent' : 'Send'}
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-400">
            Opens WhatsApp with the message typed out — you still press send. Members without a number: WhatsApp asks you to pick the chat.
          </p>
        </>
      )}
    </Modal>
  )
}
