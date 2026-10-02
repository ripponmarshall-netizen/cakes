import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'

/**
 * Voiding replaces deleting: the record stays (crossed out) with who voided it,
 * when and why, so the history can always be explained.
 */
export function VoidDialog({
  open,
  title,
  children,
  confirmLabel = 'Void',
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel?: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSaving(true)
    const ok = await onConfirm(reason.trim())
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="text-sm text-ink-600">{children}</div>
        <Field label="Reason" hint="Kept in the history. The record stays visible, crossed out.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded twice, wrong member…" autoFocus required maxLength={200} />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" className="flex-1" loading={saving} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
