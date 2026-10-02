import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { Logo } from './Logo'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/Button'

export function Header({ onHome }: { onHome?: () => void }) {
  const { profile, session, signOut } = useAuth()
  const name = profile?.display_name ?? session?.user.email ?? 'You'

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onHome && (
            <IconButton label="All partners" onClick={onHome} className="-ml-2">
              <Icon name="chevron-left" size={20} />
            </IconButton>
          )}
          <button type="button" onClick={onHome} className="flex items-center gap-2.5" disabled={!onHome}>
            <Logo size={32} />
            <span className="text-[15px] font-extrabold tracking-tight text-ink-900">Partner Ledger</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
            title={`Signed in as ${name}`}
          >
            {initials(name)}
          </div>
          <IconButton label="Sign out" onClick={() => signOut()}>
            <Icon name="logout" />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
