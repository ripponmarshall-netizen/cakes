import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { CakeItem } from '../../lib/types'
import { useCakeItems } from '../../hooks/useCakeItems'
import { useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { CakeCard } from './CakeCard'
import { CakeForm } from './CakeForm'

export function CakeMenu() {
  const { items, loading } = useCakeItems()
  const { toast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CakeItem | null>(null)

  const nextSortOrder = items.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1

  function openAdd() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(cake: CakeItem) {
    setEditing(cake)
    setFormOpen(true)
  }

  async function remove(cake: CakeItem) {
    if (!confirm(`Remove "${cake.name}" from the menu?`)) return
    const { error } = await supabase.from('cake_items').delete().eq('id', cake.id)
    toast(error ? error.message : 'Cake removed.', error ? 'error' : 'success')
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cocoa-800">Our Cakes</h2>
          <p className="text-sm text-cocoa-500">The menu you sell from. Add, edit, or remove anytime.</p>
        </div>
        <Button onClick={openAdd} size="sm">
          + Add cake
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-white/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState emoji="🎂" title="No cakes yet">
          Add your first cake so you can start taking orders.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((cake) => (
            <CakeCard
              key={cake.id}
              cake={cake}
              onEdit={() => openEdit(cake)}
              onDelete={() => remove(cake)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <CakeForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          cake={editing}
          nextSortOrder={nextSortOrder}
        />
      )}
    </section>
  )
}
