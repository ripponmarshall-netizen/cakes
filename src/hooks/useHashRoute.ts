import { useCallback, useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'partner'; id: string } | { name: 'statement'; token: string }

function parse(hash: string): Route {
  const s = hash.match(/^#\/s\/([0-9a-f-]{36})/i)
  if (s) return { name: 'statement', token: s[1] }
  const m = hash.match(/^#\/p\/([0-9a-f-]{36})/i)
  return m ? { name: 'partner', id: m[1] } : { name: 'home' }
}

/** Tiny hash router so a refresh keeps you on the same partner (works on GitHub Pages). */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((to: Route) => {
    window.location.hash = to.name === 'partner' ? `/p/${to.id}` : to.name === 'statement' ? `/s/${to.token}` : '/'
  }, [])

  return { route, navigate }
}
