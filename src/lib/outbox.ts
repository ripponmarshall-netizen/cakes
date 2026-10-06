import { supabase } from './supabase'
import { readCache, writeCache } from './cache'

/*
 * Money writes go through this queue instead of straight to Supabase.
 *
 *  - Each row gets its id on the phone, and inserts ignore ids the server
 *    already has, so a retry (or a second tap) can't record a payment twice.
 *  - Queued rows show up in the ledger at once (useLiveTable merges them in),
 *    so "Mark paid" flips to Paid on the tap, not after the round trip.
 *  - Without a signal the queue is kept on the phone and sent when the
 *    connection is back.
 *
 * Settings, members and the draw order still save directly and need a signal.
 */

type Row = Record<string, unknown>

export type Op =
  | { kind: 'insert'; table: string; rows: Row[] }
  | { kind: 'update'; table: string; id: string; patch: Row }
  /** An RPC; `shows` are the rows it will create, displayed while it's queued. */
  | { kind: 'rpc'; fn: string; args: Row; shows: { table: string; rows: Row[] }[] }

export interface Entry {
  key: string
  op: Op
  /** For messages: "J$10,000 from Andre". */
  label: string
  /** Don't tell the banker if the server refuses it (nice-to-have records like the reminder log). */
  quiet?: boolean
  at: string
  state: 'pending' | 'done'
  doneAt?: number
}

export type SendResult = { ok: true } | { ok: false; retry: boolean; message: string }
export type Outcome = 'saved' | 'queued' | { failed: string }

const KEY = 'outbox'
/** Saved entries keep showing until the reload that includes them has had time to land. */
const KEEP_DONE_MS = 90_000

let entries: Entry[] = (readCache<Entry[]>(KEY) ?? []).filter((e) => e.state === 'pending')
let enabled = false
let flushing = false
let inFlight: string | null = null
const listeners = new Set<() => void>()
const savedListeners = new Set<(tables: string[]) => void>()
const failListeners = new Set<(entry: Entry, message: string) => void>()
const waiters = new Map<string, (o: Outcome) => void>()

function emit() {
  writeCache(
    KEY,
    entries.filter((e) => e.state === 'pending'),
  )
  for (const l of listeners) l()
}

export const outbox = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  snapshot: () => entries,
  pendingCount: () => entries.filter((e) => e.state === 'pending').length,
  /** Called with the tables a write touched, once the server has it. */
  onSaved(l: (tables: string[]) => void) {
    savedListeners.add(l)
    return () => {
      savedListeners.delete(l)
    }
  },
  /** Called when the server refused a queued write nobody is waiting on any more (it is dropped). */
  onFailed(l: (entry: Entry, message: string) => void) {
    failListeners.add(l)
    return () => {
      failListeners.delete(l)
    }
  },
  /** Only sends while someone is signed in, so a queued write never goes out without a session. */
  setEnabled(on: boolean) {
    enabled = on
    if (on) void flush()
  },
  /**
   * Queues a write and starts sending it. Resolves once it is saved, parked
   * for later (no signal), or refused by the server.
   */
  enqueue(op: Op, label: string, opts: { quiet?: boolean } = {}): { key: string; done: Promise<Outcome> } {
    const key = uid()
    entries = [...entries, { key, op, label, quiet: opts.quiet, at: new Date().toISOString(), state: 'pending' }]
    emit()
    const done = new Promise<Outcome>((resolve) => waiters.set(key, resolve))
    void flush()
    return { key, done }
  },
  /**
   * Takes back a write: drops it if it hasn't been sent yet (returns true),
   * otherwise returns false and the caller voids the saved rows.
   */
  cancel(key: string): boolean {
    const e = entries.find((x) => x.key === key)
    if (!e || e.state !== 'pending' || inFlight === key) return false
    entries = entries.filter((x) => x.key !== key)
    emit()
    waiters.get(key)?.({ failed: 'Cancelled' })
    waiters.delete(key)
    return true
  },
  flush: () => flush(),
  /** Forget everything queued (signing out). */
  clear() {
    entries = []
    emit()
  },
}

/** A v4 UUID, from crypto when the browser has it. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function tablesOf(op: Op): string[] {
  if (op.kind === 'rpc') return op.shows.map((s) => s.table)
  return [op.table]
}

/** No signal, timeouts, rate limits, an expired session and server errors are worth retrying; anything else won't fix itself. */
export function classify(status: number, message: string): SendResult {
  const retry = status === 0 || status === 401 || status === 408 || status === 429 || status >= 500
  return { ok: false, retry, message }
}

async function send(op: Op): Promise<SendResult> {
  const res =
    op.kind === 'insert'
      ? await supabase.from(op.table).upsert(op.rows, { onConflict: 'id', ignoreDuplicates: true })
      : op.kind === 'update'
        ? await supabase.from(op.table).update(op.patch).eq('id', op.id)
        : await supabase.rpc(op.fn, op.args)
  if (!res.error) return { ok: true }
  return classify(res.status, res.error.message)
}

let retryTimer: ReturnType<typeof setTimeout> | undefined

async function flush() {
  if (flushing || !enabled) return
  flushing = true
  clearTimeout(retryTimer)
  try {
    for (;;) {
      const next = entries.find((e) => e.state === 'pending')
      if (!next) break
      inFlight = next.key
      let result: SendResult
      try {
        result = await send(next.op)
      } catch (err) {
        result = { ok: false, retry: true, message: err instanceof Error ? err.message : String(err) }
      }
      inFlight = null
      if (result.ok) {
        entries = entries.map((e) => (e.key === next.key ? { ...e, state: 'done', doneAt: Date.now() } : e))
        emit()
        waiters.get(next.key)?.('saved')
        waiters.delete(next.key)
        for (const l of savedListeners) l(tablesOf(next.op))
        setTimeout(prune, KEEP_DONE_MS + 100)
      } else if (result.retry) {
        // Leave it (and everything after it, to keep the order) for later.
        for (const e of entries) {
          if (e.state === 'pending') {
            waiters.get(e.key)?.('queued')
            waiters.delete(e.key)
          }
        }
        retryTimer = setTimeout(() => void flush(), 20_000)
        break
      } else {
        entries = entries.filter((e) => e.key !== next.key)
        emit()
        const waiter = waiters.get(next.key)
        waiters.delete(next.key)
        // Whoever is still waiting reports it; otherwise (e.g. queued before a reload) tell the app.
        if (waiter) waiter({ failed: result.message })
        else if (!next.quiet) for (const l of failListeners) l(next, result.message)
      }
    }
  } finally {
    inFlight = null
    flushing = false
  }
}

function prune() {
  const cutoff = Date.now() - KEEP_DONE_MS
  const kept = entries.filter((e) => e.state === 'pending' || (e.doneAt ?? 0) > cutoff)
  if (kept.length !== entries.length) {
    entries = kept
    emit()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush())
}

/** Fields every ledger row has, for showing a row before the server has filled them in. */
const defaults = (at: string): Row => ({ created_at: at, voided_at: null, voided_by: null, void_reason: null })

/**
 * The server's rows with queued (and just-saved) writes laid over them:
 * inserts the server doesn't have yet are added, updates are applied.
 * The server's copy wins once it has a row.
 */
export function mergeRows<T>(table: string, match: (row: Row) => boolean, server: T[], queue: Entry[]): T[] {
  if (queue.length === 0) return server
  const byId = new Map<string, Row>()
  for (const r of server as Row[]) byId.set(String(r.id), r)
  const added: Row[] = []
  let touched = false
  const add = (rows: Row[], at: string) => {
    for (const r of rows) {
      if (!match(r) || byId.has(String(r.id))) continue
      const row = { ...defaults(at), ...r }
      byId.set(String(r.id), row)
      added.push(row)
      touched = true
    }
  }
  for (const e of queue) {
    const op = e.op
    if (op.kind === 'insert' && op.table === table) add(op.rows, e.at)
    else if (op.kind === 'rpc') for (const s of op.shows) if (s.table === table) add(s.rows, e.at)
  }
  // Updates only matter until the server has them; after that its copy is current.
  const patches = queue.filter((e) => e.state === 'pending' && e.op.kind === 'update' && e.op.table === table)
  for (const e of patches) {
    const op = e.op as Extract<Op, { kind: 'update' }>
    const row = byId.get(op.id)
    if (row) {
      byId.set(op.id, { ...row, ...op.patch })
      touched = true
    }
  }
  if (!touched) return server
  const out = (server as Row[]).map((r) => byId.get(String(r.id)) ?? r)
  return [...out, ...added.map((r) => byId.get(String(r.id)) ?? r)] as T[]
}
