import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatMoney, formatMoneyShort } from '../../lib/format'

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

const SETTLED = 1 - 8 * Math.exp(-7)

/**
 * A money amount that counts to its new value instead of jumping, in tabular
 * figures. Pass `from={0}` for a hero total that counts up when it first shows.
 */
export function AnimatedMoney({
  value,
  className = '',
  duration = 750,
  from: start0,
  fit = false,
}: {
  value: number
  className?: string
  duration?: number
  from?: number
  /** Switch to the short form (J$12.8M) when the full amount doesn't fit the box, rather than cutting it off. */
  fit?: boolean
}) {
  const [shown, setShown] = useState(start0 ?? value)
  const from = useRef(start0 ?? value)
  const frame = useRef(0)
  const box = useRef<HTMLSpanElement>(null)
  const probeFull = useRef<HTMLSpanElement>(null)
  const probeShort = useRef<HTMLSpanElement>(null)
  // 0: the full amount fits; 1: the short form; 2: the short form, smaller.
  const [squeeze, setSqueeze] = useState(0)

  // Measures the final amount (not each counting frame) against the room it has.
  useLayoutEffect(() => {
    if (!fit) return
    const el = box.current
    const full = probeFull.current
    const short = probeShort.current
    if (!el || !full || !short) return
    const measure = () => {
      const room = el.clientWidth + 0.5
      setSqueeze(full.offsetWidth <= room ? 0 : short.offsetWidth <= room ? 1 : 2)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit, value])

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
      // A critically damped spring, as the calculator counts: fastest at the
      // start, easing onto the value without passing it (an overshoot would
      // flash a wrong amount of money). Scaled to land exactly at p = 1.
      const eased = (1 - (1 + 7 * p) * Math.exp(-7 * p)) / SETTLED
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

  const amount = p2(shown, value)
  if (!fit) return <span className={`mono ${className}`}>{formatMoney(amount)}</span>
  const probe = 'pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap'
  return (
    <span ref={box} className={`mono relative overflow-hidden whitespace-nowrap ${className}`} title={squeeze ? formatMoney(value) : undefined}>
      <span style={squeeze === 2 ? { fontSize: '0.82em' } : undefined}>{squeeze ? formatMoneyShort(amount) : formatMoney(amount)}</span>
      {/* The final amount in both forms, invisible, to measure against. */}
      <span ref={probeFull} aria-hidden className={probe}>
        {formatMoney(value)}
      </span>
      <span ref={probeShort} aria-hidden className={probe}>
        {formatMoneyShort(value)}
      </span>
    </span>
  )
}

// While counting, drop cents so the digits don't flicker; land on the exact value.
const p2 = (shown: number, target: number) => (shown === target ? target : Math.round(shown))
