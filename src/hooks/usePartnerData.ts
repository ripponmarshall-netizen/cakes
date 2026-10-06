import { useCallback, useMemo } from 'react'
import { useLiveTable } from './useLiveTable'
import type { CashCount, Contribution, Member, Partner, Payout, Reminder } from '../lib/types'

/** Every partner with all its rows — for the home dashboard and full backups. */
export function useLedger() {
  const partners = useLiveTable<Partner>('partners')
  const members = useLiveTable<Member>('members')
  const contributions = useLiveTable<Contribution>('contributions')
  const payouts = useLiveTable<Payout>('payouts')
  return {
    partners: partners.rows,
    members: members.rows,
    contributions: contributions.rows,
    payouts: payouts.rows,
    loading: partners.loading || members.loading || contributions.loading || payouts.loading,
    error: partners.error || members.error || contributions.error || payouts.error,
  }
}

/** Everything needed to render one partner, all kept live. */
export function usePartnerData(partnerId: string | null) {
  const partners = useLiveTable<Partner>('partners', { filter: { column: 'id', value: partnerId } })
  const filter = { column: 'partner_id', value: partnerId }
  const members = useLiveTable<Member>('members', { filter })
  const contributions = useLiveTable<Contribution>('contributions', { filter })
  const payouts = useLiveTable<Payout>('payouts', { filter })
  // Extras: an older database without these tables just shows no reminders or counts.
  const reminders = useLiveTable<Reminder>('reminders', { filter })
  const cashCounts = useLiveTable<CashCount>('cash_counts', { filter })

  const partner = partners.rows[0] ?? null
  const loading = partners.loading || members.loading || contributions.loading || payouts.loading
  const error = partners.error || members.error || contributions.error || payouts.error

  /** Reloads everything; resolves once the fresh rows are in. */
  const refresh = useCallback(async () => {
    await Promise.all([partners.reload(), members.reload(), contributions.reload(), payouts.reload(), reminders.reload(), cashCounts.reload()])
  }, [partners.reload, members.reload, contributions.reload, payouts.reload, reminders.reload, cashCounts.reload])

  return useMemo(
    () => ({
      refresh,
      partner,
      members: members.rows,
      contributions: contributions.rows,
      payouts: payouts.rows,
      reminders: reminders.rows,
      cashCounts: cashCounts.rows,
      loading,
      error,
    }),
    [refresh, partner, members.rows, contributions.rows, payouts.rows, reminders.rows, cashCounts.rows, loading, error],
  )
}
