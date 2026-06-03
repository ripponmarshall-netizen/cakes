import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { CakeItem } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Input, Textarea } from '../ui/Input'

interface CakeFormProps {
  open: boolean
  onClose: () => void
  cake: CakeItem | null
  nextSortOrder: number
}

export function CakeForm({ open, onClose, cake, nextSortOrder }: CakeFormProps) {
  const { toast } = useToast()
  const isEdit = !!cake
  const [name, setName] = useState(cake?.name ?? '')
  const [description, setDescription] = useState(cake?.description ?? '')
  // One "comes with" item per line for easy editing.
  const [includes, setIncludes] = useState((cake?.includes ?? []).join('\n'))
  const [price, setPrice] = useState(cake ? String(cake.price) : '')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      includes: includes
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      price: Number(price) || 0,
    }

    const { error } = isEdit
      ? await supabase.from('cake_items').update(payload).eq('id', cake!.id)
      : await supabase.from('cake_items').insert({ ...payload, sort_order: nextSortOrder })

    setSaving(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    toast(isEdit ? 'Cake updated.' : 'Cake added to the menu.', 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit cake' : 'Add a cake'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red Velvet Delight"
            required
            autoFocus
          />
        </Field>

        <Field label="Description" hint="What is it? Keep it short and sweet.">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A velvety red sponge with cream cheese frosting."
            rows={2}
          />
        </Field>

        <Field label="What it comes with" hint="One item per line.">
          <Textarea
            value={includes}
            onChange={(e) => setIncludes(e.target.value)}
            placeholder={'8-inch round cake\nCream cheese frosting\nServes 10–12'}
            rows={4}
          />
        </Field>

        <Field label="Price (JMD)">
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5000"
            required
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            {isEdit ? 'Save changes' : 'Add cake'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
