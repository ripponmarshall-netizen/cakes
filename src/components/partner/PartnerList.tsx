import { useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLedger } from '../../hooks/usePartnerData'
import { drawsDueSoon, summarizePartner, toCents, type PartnerSummary } from '../../lib/calc'
import { downloadFile } from '../../lib/csv'
import { formatDate, formatMoney, formatMoneyShort, periodLabel, plural, todayIso } from '../../lib/format'
import { firstName } from '../../lib/whatsapp'
import { fetchAll } from '../../lib/fetchAll'
import type { Partner } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Icon, type IconName } from '../ui/Icon'
import { AnimatedMoney } from '../ui/AnimatedMoney'
import { Skeleton } from '../ui/Skeleton'
import { PartnerForm } from './PartnerForm'
import { Avatar } from './shared'

interface Row {
  partner: Partner
  summary: PartnerSummary
}

const statusRank: Record<PartnerSummary['status'], number> = { active: 0, upcoming: 1, complete: 2 }

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function PartnerList({ onOpen }: { onOpen: (id: string) => void }) {
  const ledger = useLedger()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [allOwing, setAllOwing] = useState(false)

  const rows: Row[] = useMemo(
    () =>
      ledger.partners
        .map((partner) => {
          const mine = <T extends { partner_id: string }>(xs: T[]) => xs.filter((x) => x.partner_id === partner.id)
          return {
            partner,
            summary: summarizePartner(partner, mine(ledger.members), mine(ledger.contributions), mine(ledger.payouts)),
          }
        })
        // Running partners first, then the ones still to start, finished ones last.
        .sort((a, b) => statusRank[a.summary.status] - statusRank[b.summary.status] || a.partner.start_date.localeCompare(b.partner.start_date)),
    [ledger.partners, ledger.members, ledger.contributions, ledger.payouts],
  )

  // Summed in cents so many partners don't add up to J$0.30000000004.
  const sum = (pick: (s: PartnerSummary) => number) => rows.reduce((n, r) => n + toCents(pick(r.summary)), 0) / 100
  const totals = {
    pot: sum((s) => s.pot),
    potIfPaidUp: sum((s) => s.potIfPaidUp),
    behind: sum((s) => s.behind),
    exposure: sum((s) => s.exposure),
    feesEarned: sum((s) => s.feesEarned),
    feesProjected: sum((s) => s.feesProjected),
  }
  const running = rows.filter((r) => r.summary.status === 'active').length

  const dueSoon = rows
    .flatMap(({ partner, summary }) =>
      drawsDueSoon(partner, summary).map((share) => ({
        partner,
        share,
        member: summary.members.find((m) => m.member.id === share.memberId)?.member,
        overdue: share.period < summary.rawPeriod,
      })),
    )
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.share.period - b.share.period)

  const owing = rows
    .flatMap(({ partner, summary }) => summary.members.filter((m) => m.behind > 0).map((m) => ({ partner, m })))
    .sort((a, b) => (b.m.risk === 'high' ? 1 : 0) - (a.m.risk === 'high' ? 1 : 0) || b.m.behind - a.m.behind)

  async function backup() {
    setBackingUp(true)
    const [audit, reminders, cashCounts] = await Promise.all([fetchAll('audit_log'), fetchAll('reminders', 'created_at'), fetchAll('cash_counts', 'created_at')])
    setBackingUp(false)
    if (audit.error) toast(`Backup saved without history: ${audit.error}`, 'error')
    const payload = {
      app: 'partner-ledger',
      exported_at: new Date().toISOString(),
      partners: ledger.partners,
      members: ledger.members,
      contributions: ledger.contributions,
      payouts: ledger.payouts,
      cash_counts: cashCounts.data,
      reminders: reminders.data,
      audit_log: audit.data,
    }
    downloadFile(`partner-ledger-backup-${todayIso()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  const name = profile?.display_name ? firstName(profile.display_name) : null
  const loading = ledger.loading && rows.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-1 font-display text-[1.9rem] font-semibold leading-[1.15] text-ink-900 sm:text-4xl">
            {greeting()}
            {name && (
              <>
                <span className="text-ink-400">,</span> <span className="text-ink-400">{name}</span>
              </>
            )}
          </h1>
        </div>
        {rows.length > 0 && (
          <Button onClick={() => setCreating(true)} className="max-sm:h-11 max-sm:w-11 max-sm:px-0" aria-label="New partner">
            <Icon name="plus" size={19} /> <span className="hidden sm:inline">New partner</span>
          </Button>
        )}
      </div>

      {ledger.error && (
        <p className="flex items-start gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200/70">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {ledger.error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-60 rounded-4xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-40 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
          </div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Start your first partner"
          action={
            <Button onClick={() => setCreating(true)}>
              <Icon name="plus" /> New partner
            </Button>
          }
        >
          Set the hand, how many months it runs and your fee. Then add members and start ticking off payments.
        </EmptyState>
      ) : (
        <>
          {/* Across every partner */}
          <section className="theme-light relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-6 text-white shadow-lift sm:p-7">
            <HeroRings />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold-200/90">
                Cash in hand · {plural(rows.length, 'partner')}
                {running > 0 && running !== rows.length && <> · {running} running</>}
              </p>
              <AnimatedMoney value={totals.pot} className="mt-2 block font-display text-[2.6rem] font-semibold leading-none sm:text-5xl" />
              <p className="num mt-3 text-sm text-brand-100/85">
                {totals.pot < 0 || rows.some((r) => r.summary.pot < 0) ? (
                  <span className="inline-flex items-start gap-1.5 font-semibold text-rose-200">
                    <Icon name="alert" size={14} className="mt-0.5 shrink-0 text-rose-300" />
                    {plural(rows.filter((r) => r.summary.pot < 0).length, 'pot is', 'pots are')} below zero — more paid out than collected
                  </span>
                ) : totals.behind > 0 ? (
                  <>
                    Should be <span className="font-semibold text-gold-200">{formatMoney(totals.potIfPaidUp)}</span> · {formatMoney(totals.behind)} still owed
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="check" size={14} className="text-brand-300" /> Everyone is paid up
                  </span>
                )}
              </p>
            </div>
            <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              <HeroStat label="Owed now" value={totals.behind} tone={totals.behind > 0 ? 'warn' : undefined} />
              <HeroStat label="At risk" value={totals.exposure} tone={totals.exposure > 0 ? 'bad' : undefined} />
              <HeroStat label="Your fees" value={totals.feesEarned} sub={`+${formatMoney(totals.feesProjected - totals.feesEarned)}`} />
            </div>
          </section>

          {/* What needs doing */}
          {(dueSoon.length > 0 || owing.length > 0) && (
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-1 pt-5">
                <h2 className="font-display text-lg font-semibold text-ink-900">Needs attention</h2>
                <span className="num text-xs font-semibold text-ink-400">{dueSoon.length + owing.length}</span>
              </div>

              {dueSoon.length > 0 && (
                <AttentionGroup icon="gift" title="Draws due" tone="gold">
                  {dueSoon.map(({ partner, share, member, overdue }) => (
                    <AttentionRow
                      key={`${partner.id}-${share.slotIndex}-${share.memberId}`}
                      onClick={() => onOpen(partner.id)}
                      id={share.memberId}
                      name={member?.name ?? '—'}
                      sub={
                        <>
                          {overdue && <span className="font-semibold text-rose-600">Overdue · </span>}
                          {periodLabel(partner.start_date, share.period)}
                          {share.half ? ' · ½ hand' : ''} · {partner.name}
                        </>
                      }
                      right={<span className="num text-sm font-bold text-brand-700">{formatMoney(share.net)}</span>}
                    />
                  ))}
                </AttentionGroup>
              )}

              {owing.length > 0 && (
                <AttentionGroup icon="alert" title="Behind on payments" tone="rose">
                  {(allOwing ? owing : owing.slice(0, 8)).map(({ partner, m }) => (
                    <AttentionRow
                      key={m.member.id}
                      onClick={() => onOpen(partner.id)}
                      id={m.member.id}
                      name={m.member.name}
                      sub={
                        <>
                          {m.risk === 'high' && <span className="font-semibold text-rose-600">Drew already · </span>}
                          {partner.name}
                        </>
                      }
                      right={<span className="num text-sm font-bold text-rose-700">{formatMoney(m.behind)}</span>}
                    />
                  ))}
                  {owing.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setAllOwing((v) => !v)}
                      className="mx-5 mt-1 rounded-lg px-1 py-1.5 text-xs font-bold text-brand-700 hover:underline"
                    >
                      {allOwing ? 'Show fewer' : `Show all ${owing.length}`}
                    </button>
                  )}
                </AttentionGroup>
              )}
              <div className="h-3" />
            </section>
          )}

          <section>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="font-display text-lg font-semibold text-ink-900">Partners</h2>
              <span className="text-xs font-semibold text-ink-400">{rows.length}</span>
            </div>
            <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((r, i) => (
                <PartnerCard key={r.partner.id} row={r} index={i} onOpen={() => onOpen(r.partner.id)} />
              ))}
            </div>
          </section>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={backup} loading={backingUp}>
              <Icon name="download" size={15} /> Back up everything (JSON)
            </Button>
          </div>
        </>
      )}

      <PartnerForm open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
    </div>
  )
}

/** Decorative brass rings behind the hero numbers. */
export function HeroRings() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[22px] border-gold-300/[0.09]" />
      <div className="absolute -right-6 -top-10 h-44 w-44 rounded-full border border-gold-200/15" />
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand-400/10 blur-3xl" />
    </div>
  )
}

function HeroStat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: 'warn' | 'bad' }) {
  const dot = tone === 'bad' ? 'bg-rose-400' : tone === 'warn' ? 'bg-gold-300' : 'bg-brand-300/60'
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-200/80">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </p>
      <AnimatedMoney value={value} className="mt-1 block truncate text-[15px] font-bold max-[359px]:hidden sm:text-lg" />
      <span className="num mt-1 block truncate text-[15px] font-bold min-[360px]:hidden">{formatMoneyShort(value)}</span>
      {sub && <p className="num truncate text-[11px] text-brand-100/60">{sub}</p>}
    </div>
  )
}

function AttentionGroup({ icon, title, tone, children }: { icon: IconName; title: string; tone: 'gold' | 'rose'; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 px-5 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">
        <Icon name={icon} size={13} className={tone === 'gold' ? 'text-gold-500' : 'text-rose-500'} />
        {title}
      </p>
      <ul>{children}</ul>
    </div>
  )
}

function AttentionRow({ id, name, sub, right, onClick }: { id: string; name: string; sub: React.ReactNode; right: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-ink-50/80 active:bg-ink-100/60">
        <Avatar name={name} id={id} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink-900">{name}</span>
          <span className="block truncate text-xs text-ink-500">{sub}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">{right}</span>
        <Icon name="chevron-right" size={16} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-500" />
      </button>
    </li>
  )
}

function PartnerCard({ row, index, onOpen }: { row: Row; index: number; onOpen: () => void }) {
  const { partner, summary: s } = row
  const progress = Math.max(0, Math.min(1, s.rawPeriod / partner.term_months))
  const status =
    s.status === 'upcoming' ? (
      <Badge tone="blue">Starts {formatDate(partner.start_date)}</Badge>
    ) : s.status === 'complete' ? (
      <Badge tone="gray">Finished</Badge>
    ) : (
      <Badge tone="green">
        Month {s.period} of {partner.term_months}
      </Badge>
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ ['--i' as string]: index }}
      className="card group relative flex flex-col p-5 text-left transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-float active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-display text-lg font-semibold text-ink-900">{partner.name}</h3>
        {status}
      </div>
      <p className="num mt-0.5 text-[13px] text-ink-500">
        {formatMoney(partner.hand_amount)} a hand · {plural(partner.term_months, 'month')}
      </p>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">In the pot</p>
          <p className={`num mt-0.5 text-2xl font-extrabold tracking-tight ${s.pot < 0 ? 'text-rose-700' : 'text-ink-900'}`}>{formatMoney(s.pot)}</p>
        </div>
        <Icon name="arrow-right" size={18} className="mb-1.5 text-ink-300 transition duration-300 group-hover:translate-x-1 group-hover:text-brand-600" />
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-[width] duration-700 ease-out" style={{ width: `${progress * 100}%` }} />
      </div>

      {(s.behind > 0 || s.exposure > 0 || s.pot < 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.pot < 0 && <Badge tone="red">Pot below zero</Badge>}
          {s.behind > 0 && <Badge tone="amber">Owed {formatMoney(s.behind)}</Badge>}
          {s.exposure > 0 && (
            <Badge tone={s.atRisk > 0 ? 'red' : 'amber'}>
              <Icon name="shield" size={11} /> {formatMoney(s.exposure)} at risk
            </Badge>
          )}
        </div>
      )}
    </button>
  )
}
