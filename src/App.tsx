import { useAuth } from './context/AuthContext'
import { useAdmin } from './hooks/useAdmin'
import { useHashRoute } from './hooks/useHashRoute'
import { AuthScreen } from './components/AuthScreen'
import { AccessGate } from './components/AccessGate'
import { Header } from './components/Header'
import { PartnerList } from './components/partner/PartnerList'
import { PartnerView } from './components/partner/PartnerView'
import { Spinner } from './components/ui/Spinner'

export default function App() {
  const { session, loading } = useAuth()
  const admin = useAdmin(session?.user.id)
  const { route, navigate } = useHashRoute()

  if (loading || (session && admin.state === 'checking')) return <Spinner fullScreen />
  if (!session) return <AuthScreen />
  if (admin.state !== 'admin') return <AccessGate admin={admin} />

  return (
    <div className="min-h-screen pb-20">
      <Header onHome={route.name === 'partner' ? () => navigate({ name: 'home' }) : undefined} />
      <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        {route.name === 'partner' ? (
          <PartnerView key={route.id} partnerId={route.id} onGone={() => navigate({ name: 'home' })} />
        ) : (
          <PartnerList onOpen={(id) => navigate({ name: 'partner', id })} />
        )}
      </main>
    </div>
  )
}
