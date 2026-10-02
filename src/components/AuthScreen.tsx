import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { Logo } from './Logo'

const INVITE_CODE = import.meta.env.VITE_SIGNUP_INVITE_CODE as string

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setError('Please enter your name.')
        return
      }
      if (inviteCode.trim() !== INVITE_CODE) {
        setError('That invite code is not correct.')
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        const { needsConfirmation } = await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        })
        if (needsConfirmation) {
          toast('Account created — check your email to confirm, then sign in.', 'info')
          setMode('signin')
        } else {
          toast('Welcome! Your account is ready.', 'success')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m)
        setError(null)
      }}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        mode === m ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="animate-rise w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mb-4 flex justify-center">
            <Logo size={56} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Partner Ledger</h1>
          <p className="mt-1.5 text-ink-500">Hands, payments, the pot and every draw — in one place.</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <div className="mb-6 flex rounded-xl bg-ink-100 p-1">
            {tab('signin', 'Sign in')}
            {tab('signup', 'Create account')}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Your name">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Miss Pearl"
                  autoComplete="name"
                />
              </Field>
            )}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
              />
            </Field>

            {mode === 'signup' && (
              <Field label="Invite code" hint="Ask the banker for the code.">
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Invite code" />
              </Field>
            )}

            {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{error}</p>}

            <Button type="submit" loading={submitting} className="w-full">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">For bankers only. Members don’t need an account.</p>
      </div>
    </div>
  )
}
