import { useCallback, useMemo } from 'react'
import { useLiveTable } from './useLiveTable'
import type { Contribution, Member, Partner, Payout } from '../lib/types'

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

  const partner = partners.rows[0] ?? null
  const loading = partners.loading || members.loading || contributions.loading || payouts.loading
  const error = partners.error || members.error || contributions.error || payouts.error

  const refresh = useCallback(() => {
    partners.reload()
    members.reload()
    contributions.reload()
    payouts.reload()
  }, [partners.reload, members.reload, contributions.reload, payouts.reload])

  return useMemo(
    () => ({
      refresh,
      partner,
      members: members.rows,
      contributions: contributions.rows,
      payouts: payouts.rows,
      loading,
      error,
    }),
    [refresh, partner, members.rows, contributions.rows, payouts.rows, loading, error],
  )
}
