import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import { Icon } from '../ui/Icon'
import { useLast } from '../../hooks/usePresence'

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

  // Keep the explanation on screen while the dialog animates out.
  const body = useLast(open ? children : null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="void-form" variant="danger" className="flex-1" loading={saving} disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <form id="void-form" onSubmit={submit} className="space-y-4 pb-2">
        <div className="flex items-start gap-3 rounded-2xl bg-rose-50/80 p-4 text-sm leading-relaxed text-rose-900 ring-1 ring-inset ring-rose-200/70">
          <Icon name="ban" size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <div>{body}</div>
        </div>
        <Field label="Reason" hint="Kept in the history. The record stays visible, crossed out.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded twice, wrong member…" autoFocus required maxLength={200} />
        </Field>
      </form>
    </Modal>
  )
}
