import { useState } from 'react'
import { usePartners } from '../../hooks/usePartnerData'
import { rawCurrentPeriod } from '../../lib/calc'
import { formatDate, formatMoney } from '../../lib/format'
import type { Partner } from '../../lib/types'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { Spinner } from '../ui/Spinner'
import { PartnerForm } from './PartnerForm'

export function PartnerList({ onOpen }: { onOpen: (id: string) => void }) {
  const { rows, loading, error } = usePartners()
  const [creating, setCreating] = useState(false)

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

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {loading ? (
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
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((p) => (
            <PartnerCard key={p.id} partner={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}

      <PartnerForm open={creating} onClose={() => setCreating(false)} onCreated={onOpen} />
    </div>
  )
}

function PartnerCard({ partner, onOpen }: { partner: Partner; onOpen: () => void }) {
  const raw = rawCurrentPeriod(partner.start_date)
  const status =
    raw < 1 ? (
      <Badge tone="blue">Starts {formatDate(partner.start_date)}</Badge>
    ) : raw > partner.term_months ? (
      <Badge tone="gray">Finished</Badge>
    ) : (
      <Badge tone="green">
        Month {raw} of {partner.term_months}
      </Badge>
    )
  const progress = Math.max(0, Math.min(1, raw / partner.term_months))

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
        {formatMoney(partner.hand_amount)} a hand · {partner.term_months} months
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        {status}
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </button>
  )
}
