import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

const { classify, mergeRows } = await import('./outbox')
type Entry = import('./outbox').Entry

const entry = (op: Entry['op'], state: Entry['state'] = 'pending'): Entry => ({
  key: Math.random().toString(36),
  op,
  label: 'x',
  at: '2026-10-06T12:00:00.000Z',
  state,
})

const server = [
  { id: 'a', partner_id: 'p1', amount: 10, voided_at: null, created_at: '2026-10-01T00:00:00Z' },
  { id: 'b', partner_id: 'p1', amount: 20, voided_at: null, created_at: '2026-10-02T00:00:00Z' },
]
const inP1 = (r: Record<string, unknown>) => r.partner_id === 'p1'

describe('mergeRows', () => {
  it('returns the server rows untouched when nothing is queued', () => {
    expect(mergeRows('contributions', inP1, server, [])).toBe(server)
  })

  it('shows a queued insert straight away, with the usual empty fields', () => {
    const out = mergeRows('contributions', inP1, server, [entry({ kind: 'insert', table: 'contributions', rows: [{ id: 'c', partner_id: 'p1', amount: 5 }] })])
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(out[2]).toMatchObject({ voided_at: null, created_at: '2026-10-06T12:00:00.000Z' })
  })

  it('never shows a row twice once the server has it', () => {
    const out = mergeRows('contributions', inP1, server, [entry({ kind: 'insert', table: 'contributions', rows: [{ id: 'a', partner_id: 'p1', amount: 99 }] }, 'done')])
    expect(out).toBe(server)
  })

  it('ignores other tables and other partners', () => {
    const q = [
      entry({ kind: 'insert', table: 'payouts', rows: [{ id: 'z', partner_id: 'p1' }] }),
      entry({ kind: 'insert', table: 'contributions', rows: [{ id: 'y', partner_id: 'p2' }] }),
    ]
    expect(mergeRows('contributions', inP1, server, q)).toBe(server)
  })

  it('applies a queued void until the server has it', () => {
    const out = mergeRows('contributions', inP1, server, [entry({ kind: 'update', table: 'contributions', id: 'b', patch: { voided_at: 'now', void_reason: 'dup' } })])
    expect(out[1]).toMatchObject({ id: 'b', voided_at: 'now', void_reason: 'dup' })
    expect(server[1].voided_at).toBeNull()
  })

  it('shows the rows an RPC will create (a draw and the arrears taken from it)', () => {
    const q = [
      entry({
        kind: 'rpc',
        fn: 'record_payout',
        args: {},
        shows: [
          { table: 'payouts', rows: [{ id: 'po', partner_id: 'p1', gross: 100 }] },
          { table: 'contributions', rows: [{ id: 'd1', partner_id: 'p1', amount: 10, method: 'deduction' }] },
        ],
      }),
    ]
    expect(mergeRows('contributions', inP1, server, q).map((r) => r.id)).toEqual(['a', 'b', 'd1'])
    expect(mergeRows('payouts', inP1, [], q).map((r) => (r as { id: string }).id)).toEqual(['po'])
  })
})

describe('classify', () => {
  it('retries what a signal or a moment fixes', () => {
    for (const status of [0, 401, 408, 429, 500, 503]) expect(classify(status, 'x')).toMatchObject({ retry: true })
  })
  it('drops what the server refuses outright', () => {
    for (const status of [400, 403, 404, 409]) expect(classify(status, 'x')).toMatchObject({ retry: false })
  })
})
