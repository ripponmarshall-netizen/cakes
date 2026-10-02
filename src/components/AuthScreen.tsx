import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { Field, Input, Segmented } from './ui/Input'
import { Icon } from './ui/Icon'
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

  return (
    <AuthShell>
      <div className="card p-6 sm:p-8">
        <div className="mb-6">
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m)
              setError(null)
            }}
            options={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="animate-rise">
              <Field label="Your name">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Miss Pearl" autoComplete="name" />
              </Field>
            </div>
          )}

          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
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
            <div className="animate-rise">
              <Field label="Invite code" hint="Ask the banker for the code.">
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Invite code" />
              </Field>
            </div>
          )}

          {error && (
            <p className="animate-fade flex items-start gap-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200/70">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="w-full">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
        <Icon name="lock" size={12} /> For bankers only. Members don’t need an account.
      </p>
    </AuthShell>
  )
}

/** Emerald band with the brand, and the content card rising over it. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[46vh] overflow-hidden rounded-b-[3rem] bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950" aria-hidden>
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[26px] border-gold-300/[0.08]" />
        <div className="absolute -left-20 bottom-[-6rem] h-72 w-72 rounded-full bg-brand-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="animate-rise mb-7 text-center text-white">
          <div className="mb-4 flex justify-center">
            <Logo size={60} />
          </div>
          <h1 className="font-display text-4xl font-semibold">Partner Ledger</h1>
          <p className="mt-2 text-brand-100/80">Hands, payments, the pot and every draw — in one place.</p>
        </div>
        <div className="animate-rise [animation-delay:80ms]">{children}</div>
      </div>
    </div>
  )
}
