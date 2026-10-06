import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { mergeRows, outbox } from '../lib/outbox'
import { supabase } from '../lib/supabase'

interface Options {
  /** Only rows where `column = value`. Skipped (no fetch) when value is null. */
  filter?: { column: string; value: string | null }
  orderBy?: string
}

/** Supabase hands back at most this many rows per request (its default "Max rows"). */
const PAGE = 1000

/**
 * Loads a table and keeps it fresh with Supabase Realtime. Any change refetches
 * the (small) result set, which keeps ordering and joins trivially correct.
 * Rows are fetched a page at a time, so nothing is cut off past the server's
 * row limit. The last good result is cached on the device, so the app opens
 * offline and shows the saved copy until the network is back. Writes still
 * waiting in the outbox are shown on top.
 */
export function useLiveTable<T>(table: string, { filter, orderBy = 'created_at' }: Options = {}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const column = filter?.column
  const value = filter?.value
  const skip = filter !== undefined && !value
  const requestId = useRef(0)
  const cacheKey = `${table}:${column ?? 'all'}:${value ?? ''}`

  const load = useCallback(async () => {
    if (skip) return
    const id = ++requestId.current
    const all: T[] = []
    let failure: string | null = null
    for (let from = 0; ; from += PAGE) {
      // Ordered on id as well, so pages split rows with the same timestamp consistently.
      let query = supabase
        .from(table)
        .select('*')
        .order(orderBy, { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (column && value) query = query.eq(column, value)
      const { data, error } = await query
      if (id !== requestId.current) return // a newer load superseded this one
      if (error) {
        failure = error.message
        break
      }
      all.push(...((data ?? []) as T[]))
      if (!data || data.length < PAGE) break
    }
    if (failure) {
      // Offline with a cached copy: keep showing it; the banner explains why.
      if (!(navigator.onLine === false && readCache(cacheKey))) setError(failure)
    } else {
      setError(null)
      setRows(all)
      writeCache(cacheKey, all)
    }
    setLoading(false)
  }, [table, orderBy, column, value, skip, cacheKey])

  // Many changes arrive together ("Mark all paid" is one event per row): reload once.
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const loadSoon = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void load(), 250)
  }, [load])

  useEffect(() => {
    if (skip) {
      setRows([])
      setLoading(false)
      return
    }
    const cached = readCache<T[]>(cacheKey)
    if (cached) setRows(cached)
    setLoading(!cached)
    load()
    window.addEventListener('online', loadSoon)
    const offSaved = outbox.onSaved((tables) => {
      if (tables.includes(table)) loadSoon()
    })
    const channel = supabase
      .channel(`${table}:${column ?? 'all'}:${value ?? ''}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(column && value ? { filter: `${column}=eq.${value}` } : {}) },
        loadSoon,
      )
      .subscribe()
    return () => {
      clearTimeout(timer.current)
      window.removeEventListener('online', loadSoon)
      offSaved()
      supabase.removeChannel(channel)
    }
  }, [load, loadSoon, table, column, value, skip, cacheKey])

  const queue = useSyncExternalStore(outbox.subscribe, outbox.snapshot)
  const merged = useMemo(
    () => (skip ? rows : mergeRows(table, (r) => !column || !value || String(r[column]) === value, rows, queue)),
    [rows, queue, table, column, value, skip],
  )

  return { rows: merged, loading, error, reload: load }
}
