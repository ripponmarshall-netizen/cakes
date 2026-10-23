import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { Logo } from './Logo'
import { Icon } from './ui/Icon'
import { IconButton } from './ui/Button'
import { useConfirm } from './ui/Confirm'
import { useTheme, type ThemePref } from '../hooks/useTheme'
import type { IconName } from './ui/Icon'
import { OfflineBanner } from './OfflineBanner'
import { outbox } from '../lib/outbox'
import { BankersModal } from './BankersModal'

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
  const ref = useRef<HTMLElement>(null)
  const [showBankers, setShowBankers] = useState(false)
  // The hairline under the header only shows once the page has scrolled.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sticky bits further down (the partner tab bar) sit under the header. Its
  // height changes with the notch (safe area) and the offline banner, so it's
  // published as --header-h rather than hard-coded.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--header-h', `${el.offsetHeight}px`)
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--header-h')
    }
  }, [])

  async function askSignOut() {
    const waiting = outbox.pendingCount()
    const ok = await confirm({
      title: 'Sign out?',
      message: waiting
        ? `${waiting === 1 ? '1 change hasn’t' : `${waiting} changes haven’t`} reached the server yet and will be lost. Get a signal and let them sync first.`
        : 'The copy of the ledger saved on this device for offline use is cleared too.',
      confirmLabel: waiting ? 'Sign out anyway' : 'Sign out',
      danger: waiting > 0,
    })
    if (ok) signOut()
  }

  return (
    // Fades in only (no movement): the loading screen measures where its logo
    // and title land on this header while it's still hidden. Solid, not
    // frosted glass, as in the calculator: it runs up under the status bar
    // and Dynamic Island, where a backdrop blur smeared whatever scrolled
    // beneath it.
    <header
      ref={ref}
      className={`pt-safe px-safe sticky top-0 z-30 animate-[fade_0.45s_ease-out_backwards] border-b bg-canvas transition-[border-color,box-shadow] duration-200 ${
        scrolled ? 'border-line-soft shadow-[0_10px_24px_-22px_rgba(0,0,0,0.9)]' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6 lg:max-w-6xl">
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            className="group -ml-2 flex items-center gap-1 rounded-xl py-1.5 pl-1 pr-3 text-sm font-semibold text-ink-700 tap hover:bg-fill hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          >
            <Icon name="chevron-left" size={20} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Partners
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            {/* The loading screen's logo and title fly onto these two (index.html). */}
            <span data-splash-target="logo" className="block shrink-0">
              <Logo size={28} />
            </span>
            <h1 data-splash-target="title" className="truncate text-[clamp(15px,4.6vw,17px)] font-semibold tracking-[-0.01em] text-ink-900">
              Partner Ledger
            </h1>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {onHome && (
            <span data-splash-target="logo" className="mr-1 hidden sm:block">
              <Logo size={28} />
            </span>
          )}
          <IconButton label={`${themeState.label} — tap to change`} onClick={() => theme.choose(themeState.next)}>
            <span key={theme.pref} className="animate-pop">
              <Icon name={themeState.icon} size={17} />
            </span>
          </IconButton>
          <button
            type="button"
            onClick={() => setShowBankers(true)}
            aria-label={`Signed in as ${name} — bankers`}
            title={`Signed in as ${name} — tap to manage bankers`}
            className="tap mx-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent-600 text-[12px] font-bold text-accent-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {initials(name)}
          </button>
          <IconButton label="Sign out" onClick={askSignOut}>
            <Icon name="logout" size={17} />
          </IconButton>
        </div>
      </div>
      <OfflineBanner />
      <BankersModal open={showBankers} onClose={() => setShowBankers(false)} />
    </header>
  )
}
