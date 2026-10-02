import { useMemo, useState } from 'react'
import { useLast } from '../../hooks/usePresence'
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

  // Arrears are worked out month by month, so only while the sheet is open;
  // the last list stays on screen while it slides away.
  const live = useMemo(
    () =>
      open
        ? summary.members
            .filter((m) => m.behind > 0)
            .sort((a, b) => (b.risk === 'high' ? 1 : 0) - (a.risk === 'high' ? 1 : 0) || b.behind - a.behind)
            .map((m) => ({ m, months: arrearsByPeriod(partner, members, contributions, m.member.id, summary.period).map((a) => a.period) }))
        : null,
    [open, summary, partner, members, contributions],
  )
  const behind = useLast(live) ?? []

  return (
    <Modal open={open} onClose={onClose} title="Send reminders" subtitle={`${behind.length} behind · ${formatMoney(summary.behind)} owed`}>
      {behind.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Icon name="check" size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-800">Everyone is paid up</p>
          <p className="text-sm text-ink-500">Nothing to send.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-inset ring-ink-200/70">
            {behind.map(({ m, months }) => {
              const hasPhone = !!normalizePhone(m.member.phone)
              const done = sent.has(m.member.id)
              return (
                <li key={m.member.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.member.name} id={m.member.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 font-bold text-ink-900">
                      <span className="truncate">{m.member.name}</span> {m.risk === 'high' && <Badge tone="red">Drew already</Badge>}
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
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition duration-200 active:scale-95 ${
                      done ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/15' : 'bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-sm hover:to-brand-800'
                    }`}
                  >
                    <Icon name={done ? 'check' : 'message'} size={15} /> {done ? 'Sent' : 'Send'}
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 pb-2 text-xs leading-relaxed text-ink-400">
            Opens WhatsApp with the message typed out — you still press send. Members without a number: WhatsApp asks you to pick the chat.
          </p>
        </>
      )}
    </Modal>
  )
}
