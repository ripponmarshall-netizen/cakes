import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { Logo } from './Logo'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/Button'
import { useConfirm } from './ui/Confirm'
import { useTheme, type ThemePref } from '../hooks/useTheme'
import type { IconName } from './ui/Icon'

const themeCycle: Record<ThemePref, { next: ThemePref; icon: IconName; label: string }> = {
  system: { next: 'light', icon: 'monitor', label: 'Theme: follows your phone' },
  light: { next: 'dark', icon: 'sun', label: 'Theme: light' },
  dark: { next: 'system', icon: 'moon', label: 'Theme: dark' },
}

export function Header({ onHome }: { onHome?: () => void }) {
  const { profile, session, signOut } = useAuth()
  const confirm = useConfirm()
  const theme = useTheme()
  const themeState = themeCycle[theme.pref]
  const name = profile?.display_name ?? session?.user.email ?? 'You'

  async function askSignOut() {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'The copy of the ledger saved on this device for offline use is cleared too.',
      confirmLabel: 'Sign out',
    })
    if (ok) signOut()
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-ink-900/[0.06] bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            className="group -ml-2 flex items-center gap-1 rounded-xl py-1.5 pl-1 pr-3 text-sm font-semibold text-ink-600 transition hover:bg-ink-900/[0.05] hover:text-ink-900 active:scale-[0.97]"
          >
            <Icon name="chevron-left" size={20} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Partners
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-display text-[17px] font-semibold text-ink-900">Partner Ledger</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {onHome && (
            <span className="mr-1 hidden sm:block">
              <Logo size={28} />
            </span>
          )}
          <IconButton label={`${themeState.label} — tap to change`} onClick={() => theme.choose(themeState.next)}>
            <span key={theme.pref} className="animate-pop-in">
              <Icon name={themeState.icon} size={17} />
            </span>
          </IconButton>
          <div
            className="theme-light ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-200 to-gold-400 text-[11px] font-bold text-ink-900 ring-2 ring-surface"
            title={`Signed in as ${name}`}
          >
            {initials(name)}
          </div>
          <IconButton label="Sign out" onClick={askSignOut}>
            <Icon name="logout" size={17} />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
