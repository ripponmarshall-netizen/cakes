import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'

interface Options {
  /** Only rows where `column = value`. Skipped (no fetch) when value is null. */
  filter?: { column: string; value: string | null }
  orderBy?: string
}

/**
 * Loads a table and keeps it fresh with Supabase Realtime. Any change refetches
 * the (small) result set, which keeps ordering and joins trivially correct.
 * The last good result is cached on the device, so the app opens offline and
 * shows the saved copy until the network is back.
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
    let query = supabase.from(table).select('*').order(orderBy, { ascending: true })
    if (column && value) query = query.eq(column, value)
    const { data, error } = await query
    if (id !== requestId.current) return // a newer load superseded this one
    if (error) {
      // Offline with a cached copy: keep showing it; the banner explains why.
      if (!(navigator.onLine === false && readCache(cacheKey))) setError(error.message)
    } else {
      setError(null)
      setRows((data ?? []) as T[])
      writeCache(cacheKey, data ?? [])
    }
    setLoading(false)
  }, [table, orderBy, column, value, skip, cacheKey])

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
    window.addEventListener('online', load)
    const channel = supabase
      .channel(`${table}:${column ?? 'all'}:${value ?? ''}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(column && value ? { filter: `${column}=eq.${value}` } : {}) },
        () => load(),
      )
      .subscribe()
    return () => {
      window.removeEventListener('online', load)
      supabase.removeChannel(channel)
    }
  }, [load, table, column, value, skip, cacheKey])

  return { rows, loading, error, reload: load }
}
