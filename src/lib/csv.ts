import type { PartnerSummary } from './calc'
import { methodLabels } from './format'
import type { Contribution, Member, Partner, Payout } from './types'

type Cell = string | number | null | undefined

/** RFC 4180 CSV. Cells that a spreadsheet would run as a formula are prefixed with '. */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return ''
    let s = String(v)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function downloadFile(filename: string, contents: string, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens UTF-8 (names with accents, "½") correctly.
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' : '', contents], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'partner'
}

/** Every payment, draw and refund, voided ones included and marked. */
export function transactionsCsv(members: Member[], contributions: Contribution[], payouts: Payout[]): string {
  const names = new Map(members.map((m) => [m.id, m.name]))
  const rows: { sort: string; cells: Cell[] }[] = [
    ...contributions.map((c) => ({
      sort: `${c.paid_on}${c.created_at}`,
      cells: [c.paid_on, 'Payment', names.get(c.member_id) ?? '', c.period, c.amount, '', c.amount, methodLabels[c.method] ?? c.method, c.ref, c.note, c.voided_at, c.void_reason, c.created_at, c.id],
    })),
    ...payouts.map((p) => ({
      sort: `${p.paid_on}${p.created_at}`,
      cells: [p.paid_on, p.kind === 'refund' ? 'Refund' : 'Draw', names.get(p.member_id) ?? '', p.period, p.gross, p.fee, p.net, methodLabels[p.method] ?? p.method, p.ref, p.note, p.voided_at, p.void_reason, p.created_at, p.id],
    })),
  ].sort((a, b) => a.sort.localeCompare(b.sort))
  return toCsv([
    ['Date', 'Type', 'Member', 'Month', 'Amount', 'Fee', 'Net', 'Method', 'Reference', 'Note', 'Voided at', 'Void reason', 'Recorded at', 'Id'],
    ...rows.map((r) => r.cells),
  ])
}

/** One row per member: what they owe, what they've had, and where they stand. */
export function membersCsv(partner: Partner, summary: PartnerSummary): string {
  const rows: Cell[][] = summary.members.map((m) => [
    m.member.name,
    m.member.phone,
    m.hands,
    m.monthlyDue,
    m.paid,
    m.dueToDate,
    m.behind,
    m.ahead,
    m.stillToPay,
    m.entitlementNet,
    m.received,
    m.exposure,
    m.shares.map((s) => `${s.period}${s.half ? ' (½)' : ''}${s.payout ? ' ✓' : ''}`).join('; '),
    'Active',
  ])
  for (const f of summary.former) {
    rows.push([
      f.member.name,
      f.member.phone,
      Number(f.member.hands),
      '',
      f.paid,
      '',
      '',
      '',
      '',
      '',
      f.received,
      '',
      '',
      `Left ${f.member.left_on ?? ''} – ${f.member.transfer_mode === 'buyout' ? 'bought out by' : 'refunded, replaced by'} ${f.replacedBy?.name ?? ''}`,
    ])
  }
  return toCsv([
    [`${partner.name} — ${partner.term_months} months from ${partner.start_date}, hand ${partner.hand_amount}`],
    ['Name', 'Phone', 'Hands', 'Monthly', 'Paid in', 'Due to date', 'Behind', 'Ahead', 'Still to pay', 'Gets (net)', 'Received', 'At risk', 'Draw months', 'Status'],
    ...rows,
  ])
}

