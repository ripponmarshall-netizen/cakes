import type { MemberSummary, PartnerSummary } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, methodLabels, periodLabel } from '../../lib/format'
import type { Contribution, Partner } from '../../lib/types'

/**
 * A member's statement: plain, print-friendly, and the same whether the banker
 * prints it or the member opens their link.
 */
export function StatementView({
  partner,
  summary,
  m,
  payments,
  names,
  showSchedule,
}: {
  partner: Partner
  summary: PartnerSummary
  m: MemberSummary
  payments: Contribution[]
  names: Map<string, string>
  showSchedule: boolean
}) {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const sorted = [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at))

  return (
    <div className="space-y-5 text-ink-800">
      <div className="border-b border-ink-100 pb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{partner.name}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">{m.member.name}</h2>
        <p className="num mt-1 text-sm text-ink-500">
          {formatHands(m.hands)} · {formatMoney(m.monthlyDue)} a month · {partner.term_months} months from {formatDate(partner.start_date)}
        </p>
        <p className="mt-0.5 text-xs text-ink-400">Statement as of {today}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Box label="Paid in" value={formatMoney(m.paid)} sub={`of ${formatMoney(m.termTotal)}`} />
        <Box
          label={m.behind > 0 ? 'Owing now' : m.ahead > 0 ? 'Paid ahead' : 'Standing'}
          value={m.behind > 0 ? formatMoney(m.behind) : m.ahead > 0 ? formatMoney(m.ahead) : 'Up to date'}
          tone={m.behind > 0 ? 'bad' : 'good'}
        />
        <Box label="Gets in total" value={formatMoney(m.entitlementNet)} sub={m.entitlementFees > 0 ? `after ${formatMoney(m.entitlementFees)} fee` : undefined} />
        <Box label="Received" value={formatMoney(m.received)} sub={m.toReceive > 0 ? `${formatMoney(m.toReceive)} to come` : undefined} />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Draws</h3>
        <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-ink-100">
          {m.shares.map((s) => (
            <li key={`${s.slotIndex}-${s.handNo}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
              <span className="font-semibold">
                Month {s.period} · {periodLabel(partner.start_date, s.period)}
                {s.half && <span className="font-normal text-ink-400"> · ½ hand</span>}
              </span>
              <span className="num text-right">
                {s.payout ? (
                  <span className="font-semibold text-brand-700">
                    ✓ {formatMoney(s.payout.net)} on {formatDate(s.payout.paid_on)}
                  </span>
                ) : (
                  <span className="text-ink-500">{formatMoney(s.net)} · {s.period < summary.rawPeriod ? 'due' : 'upcoming'}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Payments ({sorted.length})</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-400">No payments recorded yet.</p>
        ) : (
          <table className="num w-full text-left text-sm">
            <thead className="text-xs text-ink-400">
              <tr>
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">For</th>
                <th className="py-1.5 font-semibold">How</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5">{formatDate(c.paid_on)}</td>
                  <td className="py-1.5">Month {c.period}</td>
                  <td className="py-1.5 text-ink-500">{methodLabels[c.method] ?? c.method}</td>
                  <td className="py-1.5 text-right font-semibold">{formatMoney(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showSchedule && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-400">Full draw order</h3>
          <ol className="divide-y divide-ink-100 rounded-2xl text-sm ring-1 ring-ink-100">
            {summary.schedule.map((slot) => (
              <li key={slot.index} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <span>
                  <span className="num font-semibold">Month {slot.period}</span>{' '}
                  <span className="text-ink-600">
                    {slot.shares.map((s) => `${names.get(s.memberId) ?? 'Member'}${s.half ? ' (½)' : ''}`).join(' & ')}
                  </span>
                </span>
                <span className="text-xs text-ink-400">{slot.done ? '✓ paid' : periodLabel(partner.start_date, slot.period)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function Box({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-700' : tone === 'good' ? 'text-brand-700' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-ink-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`num mt-0.5 font-extrabold ${color}`}>{value}</p>
      {sub && <p className="num text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
