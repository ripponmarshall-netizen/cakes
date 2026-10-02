import { useCallback, useEffect, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'pref:theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Applies a preference to <html>. The same logic runs inline in index.html before first paint. */
function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0e100e' : '#f3f0e8')
}

/** Light, dark, or follow the phone. Remembered on this device. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => readCache<ThemePref>(KEY) ?? 'system')

  useEffect(() => {
    apply(pref)
    if (pref !== 'system') return
    const mq = media()
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const choose = useCallback((next: ThemePref) => {
    writeCache(KEY, next)
    setPref(next)
  }, [])

  return { pref, choose }
}
