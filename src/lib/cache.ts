/*
 * Last-loaded data, kept on this device so the ledger still opens (read-only)
 * without a signal. Every access is guarded: storage can be full, blocked or
 * missing (private mode), and the app must work the same without it.
 */
const PREFIX = 'pl:v2:'

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota or privacy mode: offline copy just won't be there.
  }
}

/** Latest value per key, waiting for an idle moment to be saved (only the newest is kept). */
const pending = new Map<string, unknown>()
let scheduled = false

function flushPending() {
  scheduled = false
  for (const [k, v] of pending) writeCache(k, v)
  pending.clear()
}

/**
 * writeCache, when the phone is idle: serialising a whole table on every
 * refresh would hold up the screen being drawn. Saved at once if the app is
 * hidden or closed first.
 */
export function writeCacheLater(key: string, value: unknown) {
  pending.set(key, value)
  if (scheduled) return
  scheduled = true
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(flushPending, { timeout: 2000 })
  else setTimeout(flushPending, 300)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending()
  })
  window.addEventListener('pagehide', flushPending)
}

/**
 * Forget everything cached — called on sign-out so ledger data doesn't linger
 * on the device. Display preferences (theme, last payment method) are kept.
 */
export function clearCache() {
  // Nothing waiting may land after the wipe.
  pending.clear()
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('pl:') && !key.startsWith(`${PREFIX}pref:`)) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
