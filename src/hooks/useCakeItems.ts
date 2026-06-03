import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CakeItem } from '../lib/types'

export function useCakeItems() {
  const [items, setItems] = useState<CakeItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('cake_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (!error && data) setItems(data as CakeItem[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('cake_items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cake_items' },
        () => load(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { items, loading, reload: load }
}
