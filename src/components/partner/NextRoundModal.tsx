import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { formatHands, formatMoney, plural } from '../../lib/format'
import { nextRoundName, nextRoundStart } from '../../lib/rounds'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'
import type { PartnerCtx } from './shared'

/** Starts a new partner with the same settings and the current members. This one is left as it is. */
export function NextRoundModal({ ctx, open, onClose, onCreated }: { ctx: PartnerCtx; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { partner, summary } = ctx
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(nextRoundName(partner.name))
    setStart(nextRoundStart(partner.start_date, partner.term_months))
  }, [open, partner.name, partner.start_date, partner.term_months])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !start) return
    setSaving(true)
    const { data, error } = await supabase.rpc('start_next_round', { p_partner: partner.id, p_name: name.trim(), p_start: start })
    setSaving(false)
    if (error) return toast(error.message, 'error')
    toast(`${name.trim()} is set up`)
    onClose()
    onCreated(data as string)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start the next round"
      subtitle={`Same settings, same ${plural(summary.members.length, 'member')}`}
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="next-round-form" className="flex-1" loading={saving} disabled={!name.trim() || !start}>
            Start round
          </Button>
        </div>
      }
    >
      <form id="next-round-form" onSubmit={submit} className="space-y-4 pb-2">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </Field>
        <Field label="First month starts" hint="Defaults to the day after this round’s last month.">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <div className="rounded-2xl bg-ink-50/80 px-4 py-3 text-sm leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-900/[0.04]">
          Copies the hand ({formatMoney(partner.hand_amount)}), length ({plural(partner.term_months, 'month')}), fee, payment details and
          notes, and everyone still in this round with their hands ({formatHands(summary.totalHands)}). Payments, draws and the draw
          order start fresh — use <strong>Draw lots</strong> once it’s set up. This round stays as it is.
        </div>
      </form>
    </Modal>
  )
}
