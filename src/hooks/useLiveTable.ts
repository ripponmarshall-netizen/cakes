import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Options {
  /** Only rows where `column = value`. Skipped (no fetch) when value is null. */
  filter?: { column: string; value: string | null }
  orderBy?: string
}

/**
 * Loads a table and keeps it fresh with Supabase Realtime. Any change refetches
 * the (small) result set, which keeps ordering and joins trivially correct.
 */
export function useLiveTable<T>(table: string, { filter, orderBy = 'created_at' }: Options = {}) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const column = filter?.column
  const value = filter?.value
  const skip = filter !== undefined && !value
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (skip) return
    const id = ++requestId.current
    let query = supabase.from(table).select('*').order(orderBy, { ascending: true })
    if (column && value) query = query.eq(column, value)
    const { data, error } = await query
    if (id !== requestId.current) return // a newer load superseded this one
    if (error) setError(error.message)
    else {
      setError(null)
      setRows((data ?? []) as T[])
    }
    setLoading(false)
  }, [table, orderBy, column, value, skip])

  useEffect(() => {
    if (skip) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    load()
    const channel = supabase
      .channel(`${table}:${column ?? 'all'}:${value ?? ''}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(column && value ? { filter: `${column}=eq.${value}` } : {}) },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, table, column, value, skip])

  return { rows, loading, error, reload: load }
}
