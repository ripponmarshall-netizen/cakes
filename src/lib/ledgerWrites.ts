import { outbox, uid, type Outcome } from './outbox'
import type { PaymentMethod, PayoutMethod, ReminderKind } from './types'

/*
 * The money writes, all through the outbox (see outbox.ts): ids are made here,
 * the rows show at once, and they sync when there's a signal.
 */

export interface NewPayment {
  partner_id: string
  member_id: string
  period: number
  amount: number
  paid_on: string
  method: PaymentMethod
  ref?: string | null
  note?: string | null
}

export interface Written {
  key: string
  ids: string[]
  done: Promise<Outcome>
}

export function recordPayments(payments: NewPayment[], label: string): Written {
  const rows = payments.map((p) => ({ id: uid(), ref: null, note: null, ...p }))
  const { key, done } = outbox.enqueue({ kind: 'insert', table: 'contributions', rows }, label)
  return { key, ids: rows.map((r) => r.id), done }
}

export function voidRow(table: 'contributions' | 'payouts', id: string, reason: string, label: string): Promise<Outcome> {
  // Only touches rows not voided yet: sending the same void twice (a retry, or a
  // second tab) must not trip the database's "can't un-void" guard.
  return outbox.enqueue(
    { kind: 'update', table, id, patch: { voided_at: new Date().toISOString(), void_reason: reason }, onlyIfNull: 'voided_at' },
    label,
  ).done
}

/** Takes back payments just recorded: drops them if they haven't been sent, else voids them. */
export function undoPayments(w: Written, label: string) {
  if (outbox.cancel(w.key)) return
  for (const id of w.ids) void voidRow('contributions', id, 'Undone right after recording', label)
}

export interface NewPayout {
  partner_id: string
  member_id: string
  period: number
  gross: number
  fee: number
  paid_on: string
  method: PayoutMethod
  ref: string | null
  note: string | null
}

/** A draw handed over, plus any arrears taken out of it, saved together. */
export function recordPayout(payout: NewPayout, deductions: { period: number; amount: number; note: string }[], label: string): Written {
  const p = { id: uid(), ...payout }
  const ds = deductions.map((d) => ({ id: uid(), ...d }))
  const net = Math.round(p.gross * 100 - p.fee * 100) / 100
  const { key, done } = outbox.enqueue(
    {
      kind: 'rpc',
      fn: 'record_payout',
      args: { p_payout: p, p_deductions: ds },
      shows: [
        { table: 'payouts', rows: [{ ...p, net, kind: 'draw' }] },
        {
          table: 'contributions',
          rows: ds.map((d) => ({
            id: d.id,
            partner_id: p.partner_id,
            member_id: p.member_id,
            period: d.period,
            amount: d.amount,
            paid_on: p.paid_on,
            method: 'deduction',
            ref: null,
            note: d.note,
          })),
        },
      ],
    },
    label,
  )
  return { key, ids: [p.id, ...ds.map((d) => d.id)], done }
}

/** Notes that a WhatsApp message was opened for a member. Best effort: never bothers the banker if it fails. */
export function logMessage(partner_id: string, member_id: string, kind: ReminderKind) {
  outbox.enqueue({ kind: 'insert', table: 'reminders', rows: [{ id: uid(), partner_id, member_id, kind }] }, 'Reminder log', { quiet: true })
}

export function recordCashCount(row: { partner_id: string; counted_on: string; counted: number; expected: number; note: string | null }): Promise<Outcome> {
  return outbox.enqueue({ kind: 'insert', table: 'cash_counts', rows: [{ id: uid(), ...row }] }, 'Cash count').done
}

/** What to tell the banker once a write settles. Returns null when there's nothing to add. */
export function outcomeMessage(o: Outcome): { text: string; tone: 'info' | 'error' } | null {
  if (o === 'saved') return null
  if (o === 'queued') return { text: 'Saved on this phone — it will sync when you’re back online.', tone: 'info' }
  if (o.failed === 'Cancelled') return null
  return { text: `Not saved: ${o.failed}`, tone: 'error' }
}
