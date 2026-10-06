import { useEffect, useState, type FormEvent } from 'react'
import { formatDate, formatMoney, todayIso } from '../../lib/format'
import { outcomeMessage, recordCashCount } from '../../lib/ledgerWrites'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, MoneyInput } from '../ui/Input'
import { Badge } from '../ui/Badge'
import type { PartnerCtx } from './shared'

/**
 * Count the box: what's physically there against what the ledger says should
 * be. Each count is kept, so a gap shows up the day it appears rather than at
 * the end of the cycle.
 */
export function CashCountModal({ ctx, open, onClose }: { ctx: PartnerCtx; open: boolean; onClose: () => void }) {
  const { partner, summary, cashCounts } = ctx
  const { toast } = useToast()
  const [counted, setCounted] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setCounted('')
    setDate(todayIso())
    setNote('')
  }, [open])

  const expected = summary.pot
  const countedN = counted.trim() === '' ? null : Number(counted)
  const diff = countedN === null || !Number.isFinite(countedN) ? null : Math.round((countedN - expected) * 100) / 100
  const past = [...cashCounts].sort((a, b) => b.created_at.localeCompare(a.created_at))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (countedN === null || !Number.isFinite(countedN) || countedN < 0) return
    const done = recordCashCount({ partner_id: partner.id, counted_on: date, counted: countedN, expected, note: note.trim() || null })
    toast(diff === 0 ? 'Count saved — it matches' : `Count saved — ${formatMoney(Math.abs(diff ?? 0))} ${(diff ?? 0) > 0 ? 'over' : 'short'}`, diff === 0 ? 'success' : 'info')
    onClose()
    const msg = outcomeMessage(await done)
    if (msg) toast(msg.text, msg.tone)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Count the cash"
      subtitle={partner.name}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cash-count-form" className="flex-1" disabled={diff === null || (countedN ?? -1) < 0}>
            Save count
          </Button>
        </div>
      }
    >
      <form id="cash-count-form" onSubmit={save} className="space-y-4 pb-2">
        <div className="rounded-2xl bg-ink-50/80 p-4 ring-1 ring-inset ring-ink-900/[0.04]">
          <p className="eyebrow">The ledger says the pot holds</p>
          <p className="num mt-1 text-2xl font-extrabold text-ink-900">{formatMoney(expected)}</p>
          <p className="mt-0.5 text-xs text-ink-500">Everything collected, minus every draw and refund paid out in full. Your fees count as already taken.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cash counted">
            <MoneyInput value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0" autoFocus required />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>

        {diff !== null && (
          <p
            className={`animate-fade rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-inset ${
              diff === 0
                ? 'bg-brand-50 text-brand-800 ring-brand-600/15'
                : diff > 0
                  ? 'bg-sky-50 text-sky-900 ring-sky-200/70'
                  : 'bg-rose-50 text-rose-900 ring-rose-200/70'
            }`}
          >
            {diff === 0
              ? 'Matches the ledger.'
              : diff > 0
                ? `${formatMoney(diff)} more than the ledger — a payment not recorded yet?`
                : `${formatMoney(-diff)} short — a draw or refund not recorded, or cash missing?`}
          </p>
        )}

        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Counted with Devon at the station…" />
        </Field>

        {past.length > 0 && (
          <section>
            <p className="eyebrow mb-2 mt-2 px-1">Earlier counts</p>
            <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-inset ring-ink-200/70">
              {past.map((c) => {
                const d = Math.round((Number(c.counted) - Number(c.expected)) * 100) / 100
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="num block font-semibold text-ink-800">{formatMoney(c.counted)}</span>
                      <span className="block truncate text-xs text-ink-400">
                        {formatDate(c.counted_on)}
                        {c.note && <> · {c.note}</>}
                      </span>
                    </span>
                    <Badge tone={d === 0 ? 'green' : d > 0 ? 'blue' : 'red'}>
                      {d === 0 ? 'Matched' : `${formatMoney(Math.abs(d))} ${d > 0 ? 'over' : 'short'}`}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </form>
    </Modal>
  )
}
