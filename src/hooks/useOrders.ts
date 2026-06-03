import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, created_by_profile:profiles!orders_created_by_fkey(display_name)')
      .order('created_at', { ascending: false })
    if (!error && data) setOrders(data as unknown as Order[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => load(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  return { orders, loading, reload: load }
}
