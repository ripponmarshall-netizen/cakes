import { useEffect, useMemo, useRef, useState } from 'react'
import { usePartnerData } from '../../hooks/usePartnerData'
import { summarizePartner, toCents, type DrawShare } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, formatMoneyShort, periodLabel, timeAgo } from '../../lib/format'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon, type IconName } from '../ui/Icon'
import { Segmented } from '../ui/Input'
import { AnimatedMoney } from '../ui/AnimatedMoney'
import { PageSkeleton } from '../ui/Skeleton'
import { PartnerForm } from './PartnerForm'
import { PaymentsTab } from './PaymentsTab'
import { MembersTab } from './MembersTab'
import { DrawsTab } from './DrawsTab'
import { PayoutModal } from './PayoutModal'
import { RemindModal } from './RemindModal'
import { HistoryModal } from './HistoryModal'
import { ExportModal } from './ExportModal'
import { CashCountModal } from './CashCountModal'
import { NextRoundModal } from './NextRoundModal'
import { Avatar, type PartnerCtx } from './shared'

type Tab = 'payments' | 'draws' | 'members'

export function PartnerView({ partnerId, onGone, onOpen }: { partnerId: string; onGone: () => void; onOpen: (id: string) => void }) {
  const data = usePartnerData(partnerId)
  const { partner, members, contributions, payouts, reminders, cashCounts, loading, error, refresh } = data
  const [tab, setTab] = useState<Tab | null>(null)
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState<DrawShare | null>(null)
  const [panel, setPanel] = useState<'remind' | 'export' | 'history' | 'count' | 'next' | null>(null)
  const tabBar = useRef<HTMLDivElement>(null)

  const summary = useMemo(
    () => (partner ? summarizePartner(partner, members, contributions, payouts) : null),
    [partner, members, contributions, payouts],
  )

  // The partner's name in the browser tab and the app switcher.
  const name = partner?.name
  useEffect(() => {
    if (!name) return
    const before = document.title
    document.title = `${name} · Partner Ledger`
    return () => {
      document.title = before
    }
  }, [name])

  if (loading && !partner) return <PageSkeleton />
  if (!partner || !summary) {
    return (
      <EmptyState icon="alert" title={error ? 'Couldn’t load this partner' : 'Partner not found'} action={<Button onClick={onGone}>Back to partners</Button>}>
        {error ?? 'It may have been deleted.'}
      </EmptyState>
    )
  }

  const ctx: PartnerCtx = { partner, members, contributions, payouts, reminders, cashCounts, summary, refresh }
  const activeTab: Tab = tab ?? (summary.members.length ? 'payments' : 'members')
  const { status, period, terms } = summary
  const next = summary.nextDraw
  const nextShares = next ? next.shares.filter((s) => !s.payout) : []
  const behindCount = summary.members.filter((m) => m.behind > 0).length
  const progress = Math.max(0, Math.min(1, summary.rawPeriod / partner.term_months))
  // Counted in draw slots (two half hands share one), matching the Draws tab.
  const drawsDone = summary.schedule.filter((s) => s.done).length
  const lastCount = cashCounts.reduce<(typeof cashCounts)[number] | null>((a, c) => (!a || c.created_at > a.created_at ? c : a), null)
  const lastGap = lastCount ? Math.round((Number(lastCount.counted) - Number(lastCount.expected)) * 100) / 100 : 0
  // Offer the next round in the last month, and once the cycle is over.
  const nearEnd = status === 'complete' || (status === 'active' && period >= partner.term_months)

  function openTab(t: Tab) {
    setTab(t)
    // If the tab bar is pinned under the header, bring the new tab's top into view.
    const el = tabBar.current
    if (!el) return
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64
    if (el.getBoundingClientRect().top <= header + 8) {
      window.scrollTo({ top: el.offsetTop - header, behavior: 'smooth' })
    }
  }

  return (
    <div className="view space-y-4">
      {/* Hero */}
      <section className="hero p-5 sm:p-6">
        <span key={toCents(summary.pot)} className="sheen" aria-hidden />
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-accent-600">
            {status === 'active' && (
              <>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-600" />
                </span>
                Month {period} of {partner.term_months} · {periodLabel(partner.start_date, period)}
              </>
            )}
            {status === 'upcoming' && <>Starts {formatDate(partner.start_date)}</>}
            {status === 'complete' && <>Cycle finished</>}
          </span>
          <IconButton label="Partner settings" onClick={() => setEditing(true)} className="-mr-1.5 text-ink-700">
            <Icon name="settings" size={19} />
          </IconButton>
        </div>

        <div className="relative mt-4">
          <h1 className="font-display text-[1.5rem] font-semibold leading-tight text-ink-900 sm:text-[1.75rem]">{partner.name}</h1>
          <p className="num mt-1 text-[13px] text-ink-500">
            {formatMoney(terms.hand)} a hand · {formatHands(summary.totalHands)} · {partner.term_months} months
          </p>
        </div>

        <div className="relative mt-5">
          <p className="text-[13px] font-medium text-ink-500">In the pot now</p>
          {/* Scales down on narrow phones, so a seven-figure pot stays inside the card. */}
          <AnimatedMoney value={summary.pot} from={0} duration={900} className="mt-1 block text-[clamp(28px,9vw,40px)] font-bold leading-none text-ink-900" />
          <p className="num mt-2.5 text-[13px] text-ink-500">
            {summary.pot < 0 ? (
              <span className="inline-flex items-start gap-1.5 font-semibold text-rose-600">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" /> More has gone out than came in — check for a missing
                payment or a draw paid early
              </span>
            ) : summary.behind > 0 ? (
              <>
                Should be <span className="font-semibold text-ink-900">{formatMoney(summary.potIfPaidUp)}</span> · {formatMoney(summary.behind)} still owed
              </>
            ) : status === 'upcoming' ? (
              <>Nothing due yet</>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" size={14} className="text-brand-600" /> Everyone is paid up
              </span>
            )}
          </p>
        </div>

        <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-accent-500/15" aria-hidden>
          <div className="h-full origin-left animate-grow-x rounded-full bg-accent-600 transition-[width] duration-1000 ease-out" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <HeroStat label="Collected" value={summary.collected} sub={`of ${formatMoney(summary.dueToDate)}`} subShort={`of ${formatMoneyShort(summary.dueToDate)}`} />
          <HeroStat label="Paid out" value={summary.paidOutNet} sub={`${drawsDone} of ${summary.schedule.length} draws`} subShort={`${drawsDone}/${summary.schedule.length} draws`} />
          <HeroStat label="Fees" value={summary.feesEarned} sub={`of ${formatMoney(summary.feesProjected)}`} subShort={`of ${formatMoneyShort(summary.feesProjected)}`} />
        </div>
      </section>

      {/* Actions */}
      <div className="grid grid-cols-4 gap-2">
        <ActionButton icon="message" label="Remind" badge={behindCount || undefined} onClick={() => setPanel('remind')} />
        <ActionButton icon="coins" label="Count" onClick={() => setPanel('count')} />
        <ActionButton icon="download" label="Export" onClick={() => setPanel('export')} />
        <ActionButton icon="clock" label="History" onClick={() => setPanel('history')} />
      </div>
      {lastCount && (
        <p className="-mt-2 px-1 text-xs text-ink-500">
          Cash last counted {timeAgo(lastCount.created_at)}:{' '}
          {lastGap === 0 ? (
            <span className="font-semibold text-brand-700">matched</span>
          ) : (
            <span className={`mono font-semibold ${lastGap < 0 ? 'text-rose-600' : 'text-sky-700'}`}>
              {formatMoney(Math.abs(lastGap))} {lastGap < 0 ? 'short' : 'over'}
            </span>
          )}
        </p>
      )}

      {nearEnd && (
        <button
          type="button"
          onClick={() => setPanel('next')}
          className="pressable flex w-full items-center gap-3 rounded-3xl bg-accent-50 p-4 text-left text-accent-900 ring-1 ring-inset ring-accent-500/25"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
            <Icon name="sparkle" size={18} />
          </span>
          <span className="min-w-0 flex-1 text-sm leading-relaxed">
            <strong>{status === 'complete' ? 'This round is finished.' : 'Last month of this round.'}</strong> Start the next one with the same
            members and settings.
          </span>
          <Icon name="chevron-right" size={18} className="shrink-0 opacity-50" />
        </button>
      )}

      {/* Money at risk: members who have drawn more than they've paid in. */}
      {summary.exposure > 0 && (
        <button
          type="button"
          onClick={() => openTab('members')}
          className={`pressable flex w-full items-start gap-3 rounded-3xl p-4 text-left ring-1 ring-inset ${
            summary.atRisk > 0 ? 'bg-rose-50 text-rose-900 ring-rose-200/80' : 'bg-amber-50 text-amber-900 ring-amber-200/80'
          }`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${summary.atRisk > 0 ? 'bg-rose-100' : 'bg-amber-100'}`}>
            <Icon name="shield" size={18} />
          </span>
          <span className="min-w-0 flex-1 text-sm leading-relaxed">
            <strong className="num">{formatMoney(summary.exposure)} at risk</strong> — members who already drew still owe that much.
            {summary.atRisk > 0 && (
              <>
                {' '}
                <strong>{summary.atRisk}</strong> of them {summary.atRisk === 1 ? 'is' : 'are'} behind right now.
              </>
            )}
          </span>
          <Icon name="chevron-right" size={18} className="mt-2 shrink-0 opacity-50" />
        </button>
      )}

      {/* Next draw */}
      {next && nextShares.length > 0 && (
        <section className="card relative overflow-hidden p-[18px]">
          <div className="absolute inset-y-0 left-0 w-1 bg-accent-600" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-900">
              <Icon name="gift" size={15} className="text-accent-600" /> Next draw
            </p>
            <span className="text-xs font-semibold text-ink-500">
              {periodLabel(partner.start_date, next.period)}
              {next.period < summary.rawPeriod && <span className="text-rose-600"> · overdue</span>}
              {next.half && next.shares.length > 1 && <span> · shared</span>}
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {nextShares.map((share) => {
              const m = summary.members.find((x) => x.member.id === share.memberId)
              if (!m) return null
              return (
                <li key={share.memberId} className="flex items-center gap-3">
                  <Avatar name={m.member.name} id={m.member.id} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-ink-900">
                      {m.member.name}
                      {share.half ? (
                        <span className="font-medium text-ink-400"> · ½ hand</span>
                      ) : (
                        m.hands > 1 && <span className="font-medium text-ink-400"> · hand {share.handNo}</span>
                      )}
                    </p>
                    <p className="num text-[13px] text-ink-500">
                      gets <strong className="text-brand-700">{formatMoney(share.net)}</strong>
                      {share.fee > 0 && <> after {formatMoney(share.fee)} fee</>}
                      {m.behind > 0 && <span className="font-semibold text-rose-600"> · owes {formatMoney(m.behind)}</span>}
                    </p>
                  </div>
                  <Button variant="accent" size="sm" onClick={() => setPaying(share)}>
                    Pay out
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Tabs */}
      <div ref={tabBar} className="sticky top-[var(--header-h,4rem)] z-20 -mx-4 px-4 py-2.5 sm:-mx-6 sm:px-6">
        <Segmented
          size="lg"
          label="Partner sections"
          value={activeTab}
          onChange={openTab}
          options={[
            { value: 'payments', label: 'Payments', icon: 'wallet' },
            { value: 'draws', label: 'Draws', icon: 'gift' },
            { value: 'members', label: 'Members', icon: 'users' },
          ]}
        />
      </div>

      <div key={activeTab} className="animate-rise">
        {activeTab === 'payments' && <PaymentsTab ctx={ctx} onAddMembers={() => openTab('members')} />}
        {activeTab === 'members' && <MembersTab ctx={ctx} />}
        {activeTab === 'draws' && <DrawsTab ctx={ctx} onPay={setPaying} />}
      </div>

      {partner.notes && (
        <section className="rounded-3xl bg-surface/60 p-4 ring-1 ring-inset ring-line-soft">
          <p className="eyebrow mb-1.5">Notes</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{partner.notes}</p>
        </section>
      )}

      <PartnerForm
        open={editing}
        onClose={() => setEditing(false)}
        partner={partner}
        totalHands={summary.totalHands}
        hasActivity={contributions.length + payouts.length > 0}
        onSaved={refresh}
        onDeleted={onGone}
        onNextRound={() => {
          setEditing(false)
          setPanel('next')
        }}
      />
      <CashCountModal ctx={ctx} open={panel === 'count'} onClose={() => setPanel(null)} />
      <NextRoundModal ctx={ctx} open={panel === 'next'} onClose={() => setPanel(null)} onCreated={onOpen} />
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
      aria-label={badge ? `${label} (${badge} behind)` : undefined}
      className="card group relative flex flex-col items-center justify-center gap-1 py-3 text-[12.5px] font-semibold text-ink-700 transition duration-200 hover:text-ink-900 hover:ring-line active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 sm:flex-row sm:gap-2 sm:py-3.5 sm:text-[13px]"
    >
      <Icon name={icon} size={17} className="text-ink-400 transition group-hover:text-accent-600" />
      {label}
      {badge !== undefined && (
        // Keyed by the count, so it pops when it changes.
        <span key={badge} className="num absolute -right-1 -top-1 min-w-[1.3rem] animate-pop rounded-full bg-rose-500 px-1.5 text-center text-[11px] font-bold leading-[1.3rem] text-white ring-2 ring-canvas">
          {badge}
        </span>
      )}
    </button>
  )
}

function HeroStat({ label, value, sub, subShort }: { label: string; value: number; sub: string; subShort?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface/70 px-2 py-2.5 ring-1 ring-inset ring-accent-500/15 sm:px-3.5">
      <p className="truncate text-xs font-medium text-ink-500">{label}</p>
      {/* The narrowest phones get short amounts (J$710k) rather than cut-off ones. */}
      <AnimatedMoney value={value} className="mt-0.5 block truncate text-[13.5px] font-semibold text-ink-900 max-[359px]:hidden sm:text-lg" />
      <span className="mono mt-0.5 block truncate text-[13.5px] font-semibold text-ink-900 min-[360px]:hidden">{formatMoneyShort(value)}</span>
      <p className="num truncate text-[10.5px] tracking-tight text-ink-400 sm:text-[11px] sm:tracking-normal">
        <span className={subShort ? 'max-[359px]:hidden' : ''}>{sub}</span>
        {subShort && <span className="min-[360px]:hidden">{subShort}</span>}
      </p>
    </div>
  )
}
