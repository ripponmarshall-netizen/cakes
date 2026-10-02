import { useAuth } from './context/AuthContext'
import { useAdmin } from './hooks/useAdmin'
import { useHashRoute } from './hooks/useHashRoute'
import { AuthScreen } from './components/AuthScreen'
import { AccessGate } from './components/AccessGate'
import { Header } from './components/Header'
import { PartnerList } from './components/partner/PartnerList'
import { PartnerView } from './components/partner/PartnerView'
import { PublicStatement } from './components/PublicStatement'
import { OfflineBanner } from './components/OfflineBanner'
import { Spinner } from './components/ui/Spinner'

export default function App() {
  const { session, loading } = useAuth()
  const admin = useAdmin(session?.user.id)
  const { route, navigate } = useHashRoute()

  // Members' statement links work without an account.
  if (route.name === 'statement') return <PublicStatement token={route.token} />
  if (loading || (session && admin.state === 'checking')) return <Spinner fullScreen />
  if (!session) return <AuthScreen />
  if (admin.state !== 'admin') return <AccessGate admin={admin} />

  const isPartner = route.name === 'partner'

  return (
    <div className="min-h-screen pb-24">
      <Header onHome={isPartner ? () => navigate({ name: 'home' }) : undefined} />
      <OfflineBanner />
      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Keyed so each page fades in when you move between them. */}
        <div key={isPartner ? route.id : 'home'} className="animate-rise">
          {isPartner ? (
            <PartnerView partnerId={route.id} onGone={() => navigate({ name: 'home' })} />
          ) : (
            <PartnerList onOpen={(id) => navigate({ name: 'partner', id })} />
          )}
        </div>
      </main>
    </div>
  )
}
