import { supabase } from './supabase'

/** Every row of a table, fetched a page at a time (Supabase returns at most 1,000 per request). */
export async function fetchAll<T>(table: string, orderBy = 'id'): Promise<{ data: T[]; error: string | null }> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { data: out, error: error.message }
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return { data: out, error: null }
  }
}
