import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { summarizePartner } from '../lib/calc'
import type { Contribution, Member, Partner, Payout } from '../lib/types'
import { StatementView } from './partner/StatementView'
import { Logo } from './Logo'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Skeleton } from './ui/Skeleton'

interface StatementPayload {
  member_id: string
  partner: Omit<Partner, 'notes'>
  members: Pick<Member, 'id' | 'partner_id' | 'name' | 'hands' | 'created_at' | 'replaced_by' | 'transfer_mode' | 'left_on'>[]
  contributions: Pick<Contribution, 'id' | 'partner_id' | 'member_id' | 'period' | 'amount' | 'paid_on' | 'method' | 'created_at'>[]
  payouts: Pick<Payout, 'id' | 'partner_id' | 'member_id' | 'period' | 'gross' | 'fee' | 'net' | 'kind' | 'paid_on' | 'created_at'>[]
}

const noVoid = { voided_at: null, voided_by: null, void_reason: null }

/**
 * What a member sees when they open the link the banker sent: their own record,
 * read-only, no sign-in. The server decides what's included (member_statement).
 */
export function PublicStatement({ token }: { token: string }) {
  const [data, setData] = useState<StatementPayload | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.rpc('member_statement', { p_token: token }).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      setData((data as StatementPayload | null) ?? null)
    })
    return () => {
      active = false
    }
  }, [token])

  const view = useMemo(() => {
    if (!data) return null
    const partner: Partner = { ...data.partner, notes: null }
    const members: Member[] = data.members.map((m) => ({ ...m, phone: null, notes: null, share_token: '' }))
    const contributions: Contribution[] = data.contributions.map((c) => ({ ...c, ref: null, note: null, ...noVoid }))
    const payouts: Payout[] = data.payouts.map((p) => ({ ...p, method: 'cash', ref: null, note: null, ...noVoid }))
    const summary = summarizePartner(partner, members, contributions, payouts)
    const m = summary.members.find((x) => x.member.id === data.member_id)
    return m ? { partner, summary, m, contributions, names: new Map(members.map((x) => [x.id, x.name])) } : null
  }, [data])

  return (
    <div className="min-h-screen pb-16">
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-900/[0.06] bg-canvas/75 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-[17px] font-semibold text-ink-900">Your statement</span>
          </span>
          {view && (
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Icon name="printer" size={15} /> Print
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {data === undefined ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-28 rounded-3xl" />
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        ) : !view ? (
          <div className="card animate-rise p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
              <Icon name="link" size={22} />
            </span>
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink-900">This link doesn’t work</h1>
            <p className="mt-1.5 text-sm text-ink-500">{error ?? 'It may have been reset. Ask your banker to send you a new one.'}</p>
          </div>
        ) : (
          <div className="print-area card animate-rise p-5 sm:p-8 print:shadow-none print:ring-0">
            <StatementView
              partner={view.partner}
              summary={view.summary}
              m={view.m}
              payments={view.contributions}
              names={view.names}
              showSchedule={view.partner.share_schedule}
            />
            <p className="mt-6 flex items-center gap-1.5 border-t border-ink-100 pt-4 text-xs text-ink-400">
              <Icon name="lock" size={12} className="shrink-0" />
              Read-only copy of the banker’s ledger. Something look wrong? Message your banker.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
