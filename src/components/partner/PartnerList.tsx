import { useMemo, useState } from 'react'
import { useLedger } from '../../hooks/usePartnerData'
import { drawsDueSoon, summarizePartner, type PartnerSummary } from '../../lib/calc'
import { downloadFile } from '../../lib/csv'
import { formatDate, formatMoney, periodLabel, todayIso } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { PartnerForm } from './PartnerForm'

interface Row {
  partner: Partner
  summary: PartnerSummary
}

export function PartnerList({ onOpen }: { onOpen: (id: string) => void }) {
  const ledger = useLedger()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  const rows: Row[] = useMemo(
    () =>
      ledger.partners.map((partner) => {
        const mine = <T extends { partner_id: string }>(xs: T[]) => xs.filter((x) => x.partner_id === partner.id)
        return {
          partner,
          summary: summarizePartner(partner, mine(ledger.members), mine(ledger.contributions), mine(ledger.payouts)),
        }
      }),
    [ledger.partners, ledger.members, ledger.contributions, ledger.payouts],
  )

  const totals = rows.reduce(
    (t, { summary: s }) => ({
      pot: t.pot + s.pot,
      behind: t.behind + s.behind,
      exposure: t.exposure + s.exposure,
      feesEarned: t.feesEarned + s.feesEarned,
      feesProjected: t.feesProjected + s.feesProjected,
    }),
    { pot: 0, behind: 0, exposure: 0, feesEarned: 0, feesProjected: 0 },
  )

  const dueSoon = rows
    .flatMap(({ partner, summary }) =>
      drawsDueSoon(partner, summary).map((share) => ({
        partner,
        share,
        name: summary.members.find((m) => m.member.id === share.memberId)?.member.name ?? '—',
        overdue: share.period < summary.rawPeriod,
      })),
    )
    .sort((a, b) => Number(b.overdue) - Number(a.overdue))

  const owing = rows
    .flatMap(({ partner, summary }) => summary.members.filter((m) => m.behind > 0).map((m) => ({ partner, m })))
    .sort((a, b) => (b.m.risk === 'high' ? 1 : 0) - (a.m.risk === 'high' ? 1 : 0) || b.m.behind - a.m.behind)

  async function backup() {
    setBackingUp(true)
    const { data: audit, error } = await supabase.from('audit_log').select('*').order('id')
    setBackingUp(false)
    if (error) toast(`Backup saved without history: ${error.message}`, 'error')
    const payload = {
      app: 'partner-ledger',
      exported_at: new Date().toISOString(),
      partners: ledger.partners,
      members: ledger.members,
      contributions: ledger.contributions,
      payouts: ledger.payouts,
      audit_log: audit ?? [],
    }
    downloadFile(`partner-ledger-backup-${todayIso()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Your partners</h1>
          <p className="mt-0.5 text-sm text-ink-500">Each partner is one savings circle with its own hands and draws.</p>
        </div>
        {rows.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" /> <span className="hidden sm:inline">New partner</span>
          </Button>
        )}
      </div>

      {ledger.error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{ledger.error}</p>}

      {ledger.loading && rows.length === 0 ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="No partners yet"
          action={
            <Button onClick={() => setCreating(true)}>
              <Icon name="plus" /> Start a partner
            </Button>
          }
        >
          Set the hand, how many months it runs and your fee. Then add members and start recording payments.
        </EmptyState>
      ) : (
        <>
          {/* Across every partner */}
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="In the pots" value={formatMoney(totals.pot)} />
            <Tile label="Owed now" value={formatMoney(totals.behind)} tone={totals.behind > 0 ? 'warn' : undefined} />
            <Tile label="At risk" value={formatMoney(totals.exposure)} tone={totals.exposure > 0 ? 'bad' : undefined} sub="drawn, not yet paid back" />
            <Tile label="Your fees" value={formatMoney(totals.feesEarned)} sub={`${formatMoney(totals.feesProjected - totals.feesEarned)} to come`} />
          </section>

          {dueSoon.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-card">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                <Icon name="gift" size={14} className="text-gold-500" /> Draws due this week
              </h2>
              <ul className="divide-y divide-ink-100">
                {dueSoon.map(({ partner, share, name, overdue }) => (
                  <li key={`${partner.id}-${share.slotIndex}-${share.memberId}`}>
                    <button type="button" onClick={() => onOpen(partner.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">
                          {name}
                          {share.half && <span className="font-normal text-ink-400"> · ½</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {partner.name} · {periodLabel(partner.start_date, share.period)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="num text-sm font-bold text-brand-700">{formatMoney(share.net)}</span>
                        {overdue && <Badge tone="red">overdue</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {owing.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-card">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                <Icon name="alert" size={14} className="text-amber-500" /> Behind on payments
              </h2>
              <ul className="divide-y divide-ink-100">
                {owing.slice(0, 8).map(({ partner, m }) => (
                  <li key={m.member.id}>
                    <button type="button" onClick={() => onOpen(partner.id)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">{m.member.name}</span>
                        <span className="block truncate text-xs text-ink-500">{partner.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {m.risk === 'high' && <Badge tone="red">drew already</Badge>}
                        <span className="num text-sm font-bold text-rose-700">{formatMoney(m.behind)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {owing.length > 8 && <p className="mt-1 text-xs text-ink-400">+ {owing.length - 8} more — open a partner and tap Remind.</p>}
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <PartnerCard key={r.partner.id} row={r} onOpen={() => onOpen(r.partner.id)} />
            ))}
          </div>

          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={backup} loading={backingUp}>
              <Icon name="download" size={16} /> Backup everything (JSON)
            </Button>
          </div>
        </>
      )}

      <PartnerForm open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-600' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`num mt-1 text-lg font-extrabold ${color}`}>{value}</p>
      {sub && <p className="num mt-0.5 truncate text-[11px] text-ink-400">{sub}</p>}
    </div>
  )
}

function PartnerCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { partner, summary: s } = row
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
  const progress = Math.max(0, Math.min(1, s.rawPeriod / partner.term_months))

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-2xl bg-white p-5 text-left shadow-card ring-1 ring-transparent transition hover:-translate-y-0.5 hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-ink-900">{partner.name}</h2>
        <Icon name="chevron-right" className="mt-0.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
      <p className="num mt-1 text-sm text-ink-500">
        {formatMoney(partner.hand_amount)} a hand · {partner.term_months} months · pot {formatMoney(s.pot)}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.behind > 0 && <Badge tone="amber">Owed {formatMoney(s.behind)}</Badge>}
        {s.exposure > 0 && (
          <Badge tone={s.atRisk > 0 ? 'red' : 'amber'}>
            <Icon name="shield" size={12} /> {formatMoney(s.exposure)} at risk
          </Badge>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        {status}
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </button>
  )
}
