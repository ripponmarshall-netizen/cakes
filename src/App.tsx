import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useOrders } from './hooks/useOrders'
import { AuthScreen } from './components/AuthScreen'
import { Header } from './components/Header'
import { SummaryBar } from './components/SummaryBar'
import { CakeMenu } from './components/cakes/CakeMenu'
import { OrdersView } from './components/orders/OrdersView'

type Tab = 'orders' | 'menu'

export default function App() {
  const { session, loading } = useAuth()
  const { orders, loading: ordersLoading } = useOrders()
  const [tab, setTab] = useState<Tab>('orders')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blush-200 border-t-blush-500" />
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  return (
    <div className="min-h-screen pb-16">
      <Header />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <SummaryBar orders={orders} />

        <div className="inline-flex rounded-xl bg-white p-1 shadow-card">
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>
            Sales
          </TabButton>
          <TabButton active={tab === 'menu'} onClick={() => setTab('menu')}>
            Cakes
          </TabButton>
        </div>

        {tab === 'orders' ? (
          <OrdersView orders={orders} loading={ordersLoading} />
        ) : (
          <CakeMenu />
        )}
      </main>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
        active ? 'bg-blush-500 text-white shadow-sm' : 'text-cocoa-500 hover:text-cocoa-700'
      }`}
    >
      {children}
    </button>
  )
}
