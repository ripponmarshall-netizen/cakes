import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="animate-rise w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blush-100 text-3xl shadow-card">
            🧁
          </div>
          <h1 className="text-3xl font-bold text-cocoa-800">Sweet Sales</h1>
          <p className="mt-1 text-cocoa-500">Cake orders & sales for your team of two.</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex rounded-xl bg-blush-50 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'signin' ? 'bg-white text-cocoa-800 shadow-sm' : 'text-cocoa-500'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-cocoa-800 shadow-sm' : 'text-cocoa-500'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Your name">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya"
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
              <Field label="Invite code" hint="Ask your teammate for the shared code.">
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Team invite code"
                />
              </Field>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-cocoa-400">
          A cozy little tool for managing cake orders. 🎂
        </p>
      </div>
    </div>
  )
}
