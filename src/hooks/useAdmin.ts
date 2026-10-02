import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'

export type AdminState = 'checking' | 'admin' | 'claimable' | 'denied' | 'error'

/**
 * Only users in app_admins can see data. claim_admin() makes the first caller
 * the banker when nobody holds the role yet, otherwise just reports access.
 */
export function useAdmin(userId: string | undefined) {
  const [result, setResult] = useState<{ userId?: string; state: AdminState }>({ state: 'checking' })
  const [message, setMessage] = useState<string | null>(null)
  // Results belong to the user they were checked for; a new sign-in starts as 'checking'.
  const state: AdminState = result.userId === userId ? result.state : 'checking'
  const setState = useCallback((s: AdminState) => setResult({ userId, state: s }), [userId])

  const check = useCallback(async () => {
    if (!userId) return
    setState('checking')
    const { data: isAdmin, error } = await supabase.rpc('is_admin')
    if (error) {
      // Offline: trust this device's last successful check so the cached
      // ledger still opens. The server keeps enforcing access on every request.
      if (readCache<boolean>(`admin:${userId}`)) {
        setState('admin')
        return
      }
      setMessage(error.message)
      setState('error')
      return
    }
    writeCache(`admin:${userId}`, !!isAdmin)
    if (isAdmin) {
      setState('admin')
      return
    }
    const { data: hasAdmins, error: err2 } = await supabase.rpc('has_admins')
    if (err2) {
      setMessage(err2.message)
      setState('error')
      return
    }
    setState(hasAdmins ? 'denied' : 'claimable')
  }, [userId, setState])

  useEffect(() => {
    check()
  }, [check])

  const claim = useCallback(async () => {
    const { data, error } = await supabase.rpc('claim_admin')
    if (error) {
      setMessage(error.message)
      setState('error')
      return
    }
    if (data) writeCache(`admin:${userId}`, true)
    setState(data ? 'admin' : 'denied')
  }, [setState, userId])

  return { state, message, claim, recheck: check }
}
