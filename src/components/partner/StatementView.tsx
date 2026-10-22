import { noDrawMonths, type MemberSummary, type PartnerSummary } from '../../lib/calc'
import { formatDate, formatHands, formatMoney, methodLabels, monthsLabel, periodLabel } from '../../lib/format'
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
  const noDraw = noDrawMonths(partner)
  const sorted = [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at))

  return (
    <div className="space-y-5 text-ink-800">
      <div className="border-b border-line-soft pb-5">
        <p className="text-[13px] font-medium text-accent-600">{partner.name}</p>
        <h2 className="mt-1 font-display text-[1.65rem] font-semibold text-ink-900">{m.member.name}</h2>
        <p className="num mt-1 text-sm text-ink-500">
          {formatHands(m.hands)} · {formatMoney(m.monthlyDue)} a month · {partner.term_months} months from {formatDate(partner.start_date)}
        </p>
        {noDraw.length > 0 && <p className="mt-0.5 text-xs text-ink-500">No draw in {monthsLabel(noDraw).toLowerCase()} — everyone still pays</p>}
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

      {partner.pay_details?.trim() && (
        <section className="rounded-2xl bg-accent-500/10 px-4 py-3 ring-1 ring-inset ring-accent-500/25">
          <h3 className="eyebrow mb-1 !text-accent-700">How to pay</h3>
          <p className="whitespace-pre-line text-sm font-semibold text-ink-800">{partner.pay_details.trim()}</p>
        </section>
      )}

      <section>
        <h3 className="eyebrow mb-2">Draws</h3>
        <ul className="divide-y divide-line-soft rounded-2xl ring-1 ring-inset ring-line">
          {m.shares.map((s) => (
            <li key={`${s.slotIndex}-${s.handNo}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 font-semibold">
                Month {s.period} · {periodLabel(partner.start_date, s.period)}
                {s.half && <span className="font-normal text-ink-400"> · ½ hand</span>}
              </span>
              <span className="num shrink-0 whitespace-nowrap text-right">
                {s.payout ? (
                  <span className="font-semibold text-brand-700">
                    ✓ {formatMoney(s.payout.net)} on {formatDate(s.payout.paid_on)}
                  </span>
                ) : (
                  <span className="text-ink-500">
                    {formatMoney(s.net)} · {s.period < summary.rawPeriod ? 'due' : s.period === summary.rawPeriod ? 'this month' : 'upcoming'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="eyebrow mb-2">Payments ({sorted.length})</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-ink-400">No payments recorded yet.</p>
        ) : (
          <table className="num w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-medium text-ink-500">
              <tr>
                <th className="py-1.5 font-semibold">Date</th>
                <th className="py-1.5 font-semibold">For</th>
                <th className="py-1.5 font-semibold">How</th>
                <th className="py-1.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">{formatDate(c.paid_on)}</td>
                  <td className="py-2">Month {c.period}</td>
                  <td className="py-2 text-ink-500">{methodLabels[c.method] ?? c.method}</td>
                  <td className="py-2 text-right font-semibold">{formatMoney(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showSchedule && (
        <section>
          <h3 className="eyebrow mb-2">Full draw order</h3>
          <ol className="divide-y divide-line-soft overflow-hidden rounded-2xl text-sm ring-1 ring-inset ring-line">
            {summary.schedule.map((slot) => {
              // The reader's own draws stand out in the list.
              const mine = slot.shares.some((s) => s.memberId === m.member.id)
              return (
                <li key={slot.index} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${mine ? 'bg-accent-500/10 print:bg-transparent' : ''}`}>
                  <span className="min-w-0">
                    <span className="num font-semibold">Month {slot.period}</span>{' '}
                    <span className={mine ? 'font-semibold text-ink-900' : 'text-ink-600'}>
                      {slot.shares.map((s) => `${names.get(s.memberId) ?? 'Member'}${s.half ? ' (½)' : ''}`).join(' & ')}
                    </span>
                    {mine && <span className="ml-1.5 text-xs font-semibold text-accent-600">· you</span>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-ink-400">{slot.done ? '✓ paid' : periodLabel(partner.start_date, slot.period)}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

function Box({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'bad' ? 'text-rose-700' : tone === 'good' ? 'text-brand-700' : 'text-ink-900'
  return (
    <div className="rounded-2xl bg-ink-50 p-3.5 ring-1 ring-inset ring-line-soft print:ring-ink-200">
      <p className="eyebrow">{label}</p>
      <p className={`mono mt-1 text-[17px] font-semibold ${color}`}>{value}</p>
      {sub && <p className="num text-xs text-ink-500">{sub}</p>}
    </div>
  )
}
