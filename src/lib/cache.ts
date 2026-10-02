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

/** Forget everything cached — called on sign-out so ledger data doesn't linger on the device. */
export function clearCache() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('pl:')) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
