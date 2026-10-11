import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../../lib/format'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Runs `fn` once the loading screen has lifted (index.html drops .pl-booting
 * from <html>). A count started under the splash would finish before anyone
 * sees it. Returns a cancel function.
 */
function afterSplash(fn: () => void): () => void {
  const root = document.documentElement
  if (!root.classList.contains('pl-booting')) {
    fn()
    return () => {}
  }
  const mo = new MutationObserver(() => {
    if (root.classList.contains('pl-booting')) return
    mo.disconnect()
    fn()
  })
  mo.observe(root, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

/**
 * A money amount that counts to its new value instead of jumping, in Geist
 * Mono. Pass `from={0}` for a hero total that counts up when it first shows.
 */
export function AnimatedMoney({ value, className = '', duration = 750, from: start0 }: { value: number; className?: string; duration?: number; from?: number }) {
  const [shown, setShown] = useState(start0 ?? value)
  const from = useRef(start0 ?? value)
  const frame = useRef(0)

  useEffect(() => {
    const start = from.current
    if (start === value || reduceMotion()) {
      from.current = value
      setShown(value)
      return
    }
    let t0 = 0
    const tick = (now: number) => {
      t0 ||= now
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = p === 1 ? value : Math.round((start + (value - start) * eased) * 100) / 100
      from.current = v
      setShown(v)
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    const cancelWait = afterSplash(() => {
      frame.current = requestAnimationFrame(tick)
    })
    return () => {
      cancelWait()
      cancelAnimationFrame(frame.current)
    }
  }, [value, duration])

  return <span className={`mono ${className}`}>{formatMoney(p2(shown, value))}</span>
}

// While counting, drop cents so the digits don't flicker; land on the exact value.
const p2 = (shown: number, target: number) => (shown === target ? target : Math.round(shown))
