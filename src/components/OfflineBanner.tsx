import { useSyncExternalStore } from 'react'
import { useOnline } from '../hooks/useOnline'
import { outbox } from '../lib/outbox'
import { plural } from '../lib/format'
import { Icon } from './ui/Icon'

export function OfflineBanner() {
  const online = useOnline()
  const queue = useSyncExternalStore(outbox.subscribe, outbox.snapshot)
  const waiting = queue.filter((e) => e.state === 'pending').length
  if (online && waiting === 0) return null
  if (online) {
    return (
      <button
        type="button"
        onClick={() => void outbox.flush()}
        className="animate-fade block w-full border-t border-sky-200/70 bg-sky-50 px-4 py-2 text-center text-xs font-semibold text-sky-900"
      >
        <Icon name="clock" size={14} className="mr-1.5 inline -translate-y-px" />
        Syncing {plural(waiting, 'change')}… tap to retry now
      </button>
    )
  }
  return (
    <div className="animate-fade border-t border-amber-200/70 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
      <Icon name="wifi-off" size={14} className="mr-1.5 inline -translate-y-px" />
      Offline — payments, payouts and voids are saved on this phone
      {waiting > 0 ? ` (${waiting} waiting)` : ''} and sync when you’re back. Other changes need a signal.
    </div>
  )
}
