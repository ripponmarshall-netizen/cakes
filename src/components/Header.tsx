import { useAuth } from '../context/AuthContext'
import { Button } from './ui/Button'

export function Header() {
  const { profile, session, signOut } = useAuth()
  const name = profile?.display_name ?? session?.user.email ?? 'You'

  return (
    <header className="sticky top-0 z-30 border-b border-blush-100 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush-100 text-xl shadow-card">
            🧁
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-bold text-cocoa-800">Sweet Sales</h1>
            <span className="flex items-center gap-1.5 text-xs text-cocoa-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live sync on
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-cocoa-400">Signed in as</p>
            <p className="text-sm font-semibold text-cocoa-700">{name}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-500 text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
          <Button variant="secondary" size="sm" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
