import { useMemo, useState } from 'react'
import { usePartnerData } from '../../hooks/usePartnerData'
import { summarizePartner, type DrawSlot } from '../../lib/calc'
import { formatDate, formatMoney, periodLabel, plural } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { PartnerForm } from './PartnerForm'
import { PaymentsTab } from './PaymentsTab'
import { MembersTab } from './MembersTab'
import { DrawsTab } from './DrawsTab'
import { PayoutModal } from './PayoutModal'
import { Avatar, type PartnerCtx } from './shared'

type Tab = 'payments' | 'members' | 'draws'

export function PartnerView({ partnerId, onGone }: { partnerId: string; onGone: () => void }) {
  const data = usePartnerData(partnerId)
  const { partner, members, contributions, payouts, loading, error, refresh } = data
  const [tab, setTab] = useState<Tab | null>(null)
  const [editing, setEditing] = useState(false)
  const [payingSlot, setPayingSlot] = useState<DrawSlot | null>(null)

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
  const nextMember = next ? members.find((m) => m.id === next.memberId) : null

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-5 text-white shadow-lift sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[18px] border-gold-400/15" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{partner.name}</h1>
            <p className="num mt-0.5 text-sm text-brand-100/80">
              {formatMoney(terms.hand)} a hand · {plural(summary.totalHands, 'hand')} · {partner.term_months} months
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
          <HeroStat label="Paid out" value={formatMoney(summary.paidOutNet)} sub={`${summary.payoutsCount} of ${summary.totalHands} draws`} />
          <HeroStat label="Your fees" value={formatMoney(summary.feesEarned)} sub={`of ${formatMoney(summary.feesProjected)}`} />
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          {status === 'active' && <Badge tone="gold">Month {period} of {partner.term_months} · {periodLabel(partner.start_date, period)}</Badge>}
          {status === 'upcoming' && <Badge tone="blue">Not started</Badge>}
          {status === 'complete' && <Badge tone="gray">Cycle finished</Badge>}
        </div>
      </section>

      {/* Next draw */}
      {next && nextMember && (
        <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
          <Avatar name={nextMember.name} id={nextMember.id} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-400">
              Next draw · {periodLabel(partner.start_date, next.period)}
              {next.period < period && <span className="text-rose-600"> · overdue</span>}
            </p>
            <p className="truncate font-bold text-ink-900">
              {nextMember.name}
              {nextMember.hands > 1 && <span className="font-medium text-ink-400"> · hand {next.handNo}</span>}
            </p>
            <p className="num text-sm text-ink-500">
              gets <strong className="text-brand-700">{formatMoney(terms.netPerDraw)}</strong>
              {terms.feePerDraw > 0 && <> after {formatMoney(terms.feePerDraw)} fee</>}
            </p>
          </div>
          <Button variant="gold" size="sm" onClick={() => setPayingSlot(next)}>
            Pay out
          </Button>
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
      {activeTab === 'draws' && <DrawsTab ctx={ctx} onPay={setPayingSlot} />}

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
      <PayoutModal ctx={ctx} slot={payingSlot} onClose={() => setPayingSlot(null)} />
    </div>
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
