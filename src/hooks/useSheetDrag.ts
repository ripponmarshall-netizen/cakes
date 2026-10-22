import { useEffect, useRef, useState, type RefObject } from 'react'

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Moves a value to `to` as a mass on a damped spring, starting at `from` with
 * `velocity` (units per second), calling onUpdate each frame until it comes to
 * rest. Returns a function that stops it. The defaults (stiffness 520,
 * damping 34: a damping ratio of about 0.75) settle in about a third of a
 * second with one small overshoot. The calculator's springTo.
 */
export function springTo({
  from,
  to,
  velocity = 0,
  stiffness = 520,
  damping = 34,
  onUpdate,
  onDone,
}: {
  from: number
  to: number
  velocity?: number
  stiffness?: number
  damping?: number
  onUpdate: (x: number) => void
  onDone?: () => void
}): () => void {
  let x = from
  let v = velocity
  let last: number | null = null
  let raf = 0
  const step = (now: number) => {
    // Fixed small steps (semi-implicit Euler) keep it stable on a slow frame.
    let dt = last == null ? 1 / 60 : Math.min(0.064, (now - last) / 1000)
    last = now
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      v += (-stiffness * (x - to) - damping * v) * h
      x += v * h
      dt -= h
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 8) {
      onUpdate(to)
      onDone?.()
      return
    }
    onUpdate(x)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

/**
 * Pull a bottom sheet down to close it, as on iOS (the calculator's
 * useSheetDrag). Only on the phone layout, and only when the touch starts
 * outside the scrolling body or the body is scrolled to its top, with the
 * finger moving mostly down; otherwise the sheet scrolls as normal. The sheet
 * follows the finger (with rubber-band resistance if pulled up), the backdrop
 * lightens with it, and on release it reads the finger's speed: a quick flick
 * or a pull past a third of its height flings it away at that speed; anything
 * less springs it back into place, carrying the release velocity into the
 * spring. Touch events, not pointer events: only a non-passive touchmove can
 * stop the page scrolling once the sheet has taken the gesture.
 *
 * Returns whether the sheet has been flung (the modal then skips its exit
 * keyframes). If the owner doesn't close after all, the sheet comes back.
 */
export function useSheetDrag(
  open: boolean,
  sheetRef: RefObject<HTMLElement>,
  scrollRef: RefObject<HTMLElement>,
  backdropRef: RefObject<HTMLElement>,
  close: () => void,
): boolean {
  const [flung, setFlung] = useState(false)
  const closeRef = useRef(close)
  closeRef.current = close
  const restoreRef = useRef<() => void>(() => {})

  useEffect(() => {
    const el = sheetRef.current
    if (!open || !el) return
    setFlung(false)
    let start: { x: number; y: number; base: number; scroller: HTMLElement | null } | null = null
    let dragging = false
    let offset = 0
    let samples: { y: number; t: number }[] = []
    let stopSpring: (() => void) | null = null
    let done = false
    const phone = window.matchMedia('(max-width: 639px)')

    const setY = (y: number) => {
      offset = y
      el.style.transform = y ? `translateY(${y}px)` : ''
      const bd = backdropRef.current
      if (bd) bd.style.opacity = y > 0 ? String(Math.max(0.25, 1 - y / (el.offsetHeight * 1.4))) : ''
    }
    const scrolled = () => (start?.scroller?.scrollTop ?? 0) > 0

    const onStart = (e: TouchEvent) => {
      if (done || e.touches.length !== 1 || !phone.matches) {
        start = null
        return
      }
      stopSpring?.()
      stopSpring = null
      const t = e.touches[0]
      const body = scrollRef.current
      start = { x: t.clientX, y: t.clientY, base: offset, scroller: body && body.contains(e.target as Node) ? body : null }
      dragging = false
      samples = [{ y: t.clientY, t: e.timeStamp }]
    }
    const onMove = (e: TouchEvent) => {
      if (!start || done) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!dragging) {
        // At the top, a downward move would only rubber-band the body's own
        // scroll. Claim it from the first move: iOS won't let a scroll that
        // has already started be cancelled.
        if (!scrolled() && dy > 0 && e.cancelable) e.preventDefault()
        // Take the gesture only from the top of the content, moving down; a
        // sideways drag (a long label, a text selection) is left alone.
        if (scrolled() || dy < 8 || Math.abs(dy) < Math.abs(dx) * 1.2) {
          if (Math.abs(dx) > 10 || dy < -8 || scrolled()) start = null
          return
        }
        dragging = true
        start.y = t.clientY // no jump by the slop distance
        // An unfinished entrance would fight the finger: skip to its end.
        el.getAnimations?.().forEach((an) => {
          try {
            an.finish()
          } catch {
            // an infinite or already-cancelled animation
          }
        })
      }
      e.preventDefault()
      const raw = start.base + (t.clientY - start.y)
      // Pulled up past its resting place, the sheet resists more the further it goes.
      setY(raw >= 0 ? raw : -(1 - 1 / (1 + (-raw * 0.55) / 120)) * 120)
      samples.push({ y: t.clientY, t: e.timeStamp })
      while (samples.length > 2 && e.timeStamp - samples[0].t > 90) samples.shift()
    }
    const onEnd = (e: TouchEvent) => {
      if (!start) return
      start = null
      if (!dragging) return
      dragging = false
      const a = samples[0]
      const b = samples[samples.length - 1]
      const ms = Math.max(1, b.t - a.t)
      // Lifted after holding still: no fling left in it.
      const stale = e.timeStamp - b.t > 80
      const v = stale ? 0 : (b.y - a.y) / ms // px per ms
      const h = el.offsetHeight
      if (offset > 0 && (v > 0.5 || offset > h / 3)) {
        done = true
        setFlung(true)
        // Leave at (at least) the finger's speed: the sheet keeps the
        // momentum it was given instead of starting from rest.
        const dist = h + 140 - offset
        const dur = Math.round(Math.max(110, Math.min(180, dist / Math.max(v, 1.6))))
        el.style.transition = `transform ${dur}ms cubic-bezier(0.3, 0.7, 0.6, 1)`
        const bd = backdropRef.current
        if (bd) {
          bd.style.transition = `opacity ${dur + 40}ms ease-out`
          bd.style.opacity = '0'
        }
        requestAnimationFrame(() => {
          el.style.transform = `translateY(${h + 140}px)`
        })
        closeRef.current()
        return
      }
      if (reduceMotion()) {
        setY(0)
        return
      }
      stopSpring = springTo({ from: offset, to: 0, velocity: v * 1000, onUpdate: setY, onDone: () => (stopSpring = null) })
    }
    // The owner kept the sheet open (e.g. a save in progress): bring it back.
    restoreRef.current = () => {
      done = false
      el.style.transition = ''
      const bd = backdropRef.current
      if (bd) bd.style.transition = ''
      stopSpring = springTo({ from: el.offsetHeight + 140, to: 0, onUpdate: setY, onDone: () => (stopSpring = null) })
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      stopSpring?.()
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      // Styles stay as they are: a flung sheet is still flying out while it unmounts.
    }
  }, [open, sheetRef, scrollRef, backdropRef])

  useEffect(() => {
    if (!flung || !open) return
    const t = setTimeout(() => {
      setFlung(false)
      restoreRef.current()
    }, 400)
    return () => clearTimeout(t)
  }, [flung, open])

  return flung
}
