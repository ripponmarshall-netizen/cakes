import { useOnline } from '../hooks/useOnline'
import { Icon } from './ui/Icon'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="animate-fade border-t border-amber-200/70 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900">
      <Icon name="wifi-off" size={14} className="mr-1.5 inline -translate-y-px" />
      Offline — showing what was last loaded on this phone. Changes won’t save until you’re back online.
    </div>
  )
}
