import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { useAdmin } from '../hooks/useAdmin'
import { AuthShell } from './AuthScreen'
import { Icon } from './ui/Icon'
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
    <AuthShell>
      <div className="card p-7 text-center">
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
            admin.state === 'error' ? 'bg-rose-50 text-rose-600' : admin.state === 'claimable' ? 'bg-gold-50 text-gold-600' : 'bg-ink-100 text-ink-500'
          }`}
        >
          <Icon name={admin.state === 'error' ? 'alert' : admin.state === 'claimable' ? 'sparkle' : 'lock'} size={22} />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">{content.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{content.body}</p>
        <p className="mt-4 inline-flex rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-500 ring-1 ring-inset ring-ink-900/[0.05]">
          Signed in as {session?.user.email}
        </p>
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
    </AuthShell>
  )
}
