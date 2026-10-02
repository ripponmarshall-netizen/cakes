import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { useAdmin } from '../hooks/useAdmin'
import { Logo } from './Logo'
import { Button } from './ui/Button'

export function AccessGate({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  const { session, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const content = {
    claimable: {
      title: 'Set up your ledger',
      body: 'No banker has been set yet. Claim banker access to start tracking partners. Anyone else who signs up later will need you to add them.',
    },
    denied: {
      title: 'Waiting for access',
      body: 'Your account is created, but only the banker can open the ledger. Ask them to add you as a co-banker.',
    },
    error: {
      title: 'Couldn’t check access',
      body: admin.message ?? 'Something went wrong talking to the server.',
    },
    checking: { title: '', body: '' },
    admin: { title: '', body: '' },
  }[admin.state]

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="animate-rise w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-card">
        <div className="mb-4 flex justify-center">
          <Logo size={48} />
        </div>
        <h1 className="text-xl font-extrabold text-ink-900">{content.title}</h1>
        <p className="mt-2 text-sm text-ink-500">{content.body}</p>
        <p className="mt-3 text-xs text-ink-400">Signed in as {session?.user.email}</p>
        <div className="mt-6 flex flex-col gap-2">
          {admin.state === 'claimable' && (
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await admin.claim()
                setBusy(false)
              }}
            >
              Claim banker access
            </Button>
          )}
          {admin.state !== 'claimable' && (
            <Button variant="secondary" onClick={() => admin.recheck()}>
              Check again
            </Button>
          )}
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
