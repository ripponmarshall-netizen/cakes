import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '../../lib/format'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A money amount that counts to its new value instead of jumping. */
export function AnimatedMoney({ value, className = '', duration = 750 }: { value: number; className?: string; duration?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const frame = useRef(0)

  useEffect(() => {
    const start = from.current
    if (start === value || reduceMotion()) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = p === 1 ? value : Math.round((start + (value - start) * eased) * 100) / 100
      from.current = v
      setShown(v)
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, duration])

  return <span className={`num ${className}`}>{formatMoney(p2(shown, value))}</span>
}

// While counting, drop cents so the digits don't flicker; land on the exact value.
const p2 = (shown: number, target: number) => (shown === target ? target : Math.round(shown))
