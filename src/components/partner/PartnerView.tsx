import { useMemo, useState } from 'react'
import { usePartnerData } from '../../hooks/usePartnerData'
import { summarizePartner, type DrawShare } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, periodLabel } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon, type IconName } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { PartnerForm } from './PartnerForm'
import { PaymentsTab } from './PaymentsTab'
import { MembersTab } from './MembersTab'
import { DrawsTab } from './DrawsTab'
import { PayoutModal } from './PayoutModal'
import { RemindModal } from './RemindModal'
import { HistoryModal } from './HistoryModal'
import { ExportModal } from './ExportModal'
import { Avatar, type PartnerCtx } from './shared'

type Tab = 'payments' | 'members' | 'draws'

export function PartnerView({ partnerId, onGone }: { partnerId: string; onGone: () => void }) {
  const data = usePartnerData(partnerId)
  const { partner, members, contributions, payouts, loading, error, refresh } = data
  const [tab, setTab] = useState<Tab | null>(null)
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState<DrawShare | null>(null)
  const [panel, setPanel] = useState<'remind' | 'export' | 'history' | null>(null)

  const summary = useMemo(
    () => (partner ? summarizePartner(partner, members, contributions, payouts) : null),
    [partner, members, contributions, payouts],
  )

  if (loading && !partner) return <Spinner />
  if (!partner || !summary) {
    return (
      <EmptyState icon="alert" title={error ? 'Couldn’t load this partner' : 'Partner not found'} action={<Button onClick={onGone}>Back to partners</Button>}>
        {error ?? 'It may have been deleted.'}
      </EmptyState>
    )
  }

  const ctx: PartnerCtx = { partner, members, contributions, payouts, summary, refresh }
  const activeTab: Tab = tab ?? (members.length ? 'payments' : 'members')
  const { status, period, terms } = summary
  const next = summary.nextDraw
  const nextShares = next ? next.shares.filter((s) => !s.payout) : []
  const behindCount = summary.members.filter((m) => m.behind > 0).length

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-5 text-white shadow-lift sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[18px] border-gold-400/15" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{partner.name}</h1>
            <p className="num mt-0.5 text-sm text-brand-100/80">
              {formatMoney(terms.hand)} a hand · {formatHands(summary.totalHands)} · {partner.term_months} months
            </p>
          </div>
          <IconButton label="Partner settings" onClick={() => setEditing(true)} className="-mr-1 text-brand-100 hover:bg-white/10 hover:text-white">
            <Icon name="settings" size={20} />
          </IconButton>
        </div>

        <div className="relative mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-200">In the pot now</p>
          <p className="num mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatMoney(summary.pot)}</p>
          <p className="num mt-1.5 text-sm text-brand-100/90">
            {summary.behind > 0 ? (
              <>
                Should be <strong className="text-gold-300">{formatMoney(summary.potIfPaidUp)}</strong> — {formatMoney(summary.behind)} still owed
              </>
            ) : status === 'upcoming' ? (
              <>Starts {formatDate(partner.start_date)}</>
            ) : (
              <>Everyone is paid up</>
            )}
          </p>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <HeroStat label="Collected" value={formatMoney(summary.collected)} sub={`of ${formatMoney(summary.dueToDate)} due`} />
          <HeroStat label="Paid out" value={formatMoney(summary.paidOutNet)} sub={`${summary.payoutsCount} of ${summary.drawsCount} draws`} />
          <HeroStat label="Your fees" value={formatMoney(summary.feesEarned)} sub={`of ${formatMoney(summary.feesProjected)}`} />
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          {status === 'active' && <Badge tone="gold">Month {period} of {partner.term_months} · {periodLabel(partner.start_date, period)}</Badge>}
          {status === 'upcoming' && <Badge tone="blue">Not started</Badge>}
          {status === 'complete' && <Badge tone="gray">Cycle finished</Badge>}
        </div>
      </section>

      {/* Money at risk: members who have drawn more than they've paid in. */}
      {summary.exposure > 0 && (
        <button
          type="button"
          onClick={() => setTab('members')}
          className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-1 ${
            summary.atRisk > 0 ? 'bg-rose-50 text-rose-900 ring-rose-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
          }`}
        >
          <Icon name="shield" size={20} className="mt-0.5 shrink-0" />
          <span className="text-sm">
            <strong className="num">{formatMoney(summary.exposure)}</strong> at risk — members who already drew still owe that much.
            {summary.atRisk > 0 && (
              <>
                {' '}
                <strong>{summary.atRisk}</strong> of them {summary.atRisk === 1 ? 'is' : 'are'} behind right now.
              </>
            )}
          </span>
        </button>
      )}

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2">
        <ActionButton icon="message" label="Remind" badge={behindCount || undefined} onClick={() => setPanel('remind')} />
        <ActionButton icon="download" label="Export" onClick={() => setPanel('export')} />
        <ActionButton icon="clock" label="History" onClick={() => setPanel('history')} />
      </div>

      {/* Next draw */}
      {next && nextShares.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <p className="text-xs font-semibold text-ink-400">
            Next draw · {periodLabel(partner.start_date, next.period)}
            {next.period < period && <span className="text-rose-600"> · overdue</span>}
            {next.half && next.shares.length > 1 && <span> · shared by two half hands</span>}
          </p>
          <ul className="mt-2 space-y-3">
            {nextShares.map((share) => {
              const m = summary.members.find((x) => x.member.id === share.memberId)
              if (!m) return null
              return (
                <li key={share.memberId} className="flex items-center gap-3">
                  <Avatar name={m.member.name} id={m.member.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink-900">
                      {m.member.name}
                      {share.half ? (
                        <span className="font-medium text-ink-400"> · ½ hand</span>
                      ) : (
                        m.hands > 1 && <span className="font-medium text-ink-400"> · hand {share.handNo}</span>
                      )}
                    </p>
                    <p className="num text-sm text-ink-500">
                      gets <strong className="text-brand-700">{formatMoney(share.net)}</strong>
                      {share.fee > 0 && <> after {formatMoney(share.fee)} fee</>}
                      {m.behind > 0 && <span className="font-semibold text-rose-600"> · owes {formatMoney(m.behind)}</span>}
                    </p>
                  </div>
                  <Button variant="gold" size="sm" onClick={() => setPaying(share)}>
                    Pay out
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Tabs */}
      <div className="sticky top-16 z-20 -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur-md sm:mx-0 sm:px-0">
        <div className="flex rounded-xl bg-ink-100 p-1">
          {(
            [
              ['payments', 'Payments', 'wallet'],
              ['members', 'Members', 'users'],
              ['draws', 'Draws', 'gift'],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition ${
                activeTab === key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'payments' && <PaymentsTab ctx={ctx} onAddMembers={() => setTab('members')} />}
      {activeTab === 'members' && <MembersTab ctx={ctx} />}
      {activeTab === 'draws' && <DrawsTab ctx={ctx} onPay={setPaying} />}

      {partner.notes && (
        <p className="whitespace-pre-line rounded-2xl bg-white/60 px-4 py-3 text-sm text-ink-500 ring-1 ring-ink-100">{partner.notes}</p>
      )}

      <PartnerForm
        open={editing}
        onClose={() => setEditing(false)}
        partner={partner}
        totalHands={summary.totalHands}
        hasActivity={contributions.length + payouts.length > 0}
        onDeleted={onGone}
      />
      <PayoutModal ctx={ctx} share={paying} onClose={() => setPaying(null)} />
      <RemindModal ctx={ctx} open={panel === 'remind'} onClose={() => setPanel(null)} />
      <ExportModal ctx={ctx} open={panel === 'export'} onClose={() => setPanel(null)} />
      <HistoryModal ctx={ctx} open={panel === 'history'} onClose={() => setPanel(null)} />
    </div>
  )
}

function ActionButton({ icon, label, badge, onClick }: { icon: IconName; label: string; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 rounded-2xl bg-white py-3 text-xs font-bold text-ink-600 shadow-card transition hover:text-brand-700"
    >
      <Icon name={icon} size={18} />
      {label}
      {badge !== undefined && (
        <span className="num absolute right-3 top-2 min-w-[1.25rem] rounded-full bg-rose-500 px-1.5 text-[11px] leading-5 text-white">{badge}</span>
      )}
    </button>
  )
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-200">{label}</p>
      <p className="num mt-0.5 truncate font-extrabold sm:text-lg">{value}</p>
      <p className="num truncate text-[11px] text-brand-100/70">{sub}</p>
    </div>
  )
}
