import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/Confirm'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Input'
import { Spinner } from './ui/Spinner'
import { Avatar } from './partner/shared'

interface Banker {
  user_id: string
  display_name: string
  email: string
  added_at: string
}

/** Who can open the ledger. Co-bankers sign up first, then get added here by email. */
export function BankersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [bankers, setBankers] = useState<Banker[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_admins')
    if (error) setError(error.message)
    else {
      setError(null)
      setBankers((data ?? []) as Banker[])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setBankers(null)
    setEmail('')
    void load()
  }, [open, load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    const { error } = await supabase.rpc('add_admin', { p_email: email.trim() })
    setAdding(false)
    if (error) return toast(error.message, 'error')
    toast(`${email.trim()} can now open the ledger`)
    setEmail('')
    void load()
  }

  async function remove(b: Banker) {
    const you = b.user_id === session?.user.id
    const ok = await confirm({
      title: you ? 'Remove yourself?' : `Remove ${b.display_name}?`,
      message: you
        ? 'You’ll lose access to the ledger straight away. Another banker can add you back.'
        : `${b.display_name} can’t open the ledger any more. Everything they recorded stays, with their name on it.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.rpc('remove_admin', { p_user: b.user_id })
    if (error) return toast(error.message, 'error')
    toast(`${b.display_name} removed`, 'info')
    if (you) window.location.reload()
    else void load()
  }

  return (
    <Modal open={open} onClose={onClose} title="Bankers" subtitle="Everyone who can open and change this ledger.">
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : !bankers ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-ink-100 rounded-2xl ring-1 ring-inset ring-ink-200/70">
          {bankers.map((b) => (
            <li key={b.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={b.display_name} id={b.user_id} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink-900">
                  {b.display_name}
                  {b.user_id === session?.user.id && <span className="font-medium text-ink-400"> · you</span>}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {b.email} · since {formatDate(b.added_at.slice(0, 10))}
                </p>
              </div>
              {bankers.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => remove(b)} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-5 space-y-3 pb-2">
        <Field label="Add a co-banker" hint="They create an account first (with the invite code), then you add their email here.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cobanker@example.com" autoComplete="off" />
        </Field>
        <Button type="submit" className="w-full" loading={adding} disabled={!email.trim()}>
          Add banker
        </Button>
      </form>
    </Modal>
  )
}
