import { useEffect, useRef, useState } from 'react'

/**
 * Keeps something mounted for `ms` after it's switched off, so it can play an
 * exit animation. Returns whether to render it and whether it's leaving.
 */
export function usePresence(open: boolean, ms = 240): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])
  return { mounted: open || mounted, leaving: !open && mounted }
}

/** The last non-null value, so a closing dialog can keep showing what it showed. */
export function useLast<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(value ?? null)
  if (value !== null && value !== undefined) ref.current = value
  return ref.current
}
