import { downloadFile, membersCsv, slug, transactionsCsv } from '../../lib/csv'
import { todayIso } from '../../lib/format'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import type { PartnerCtx } from './shared'

export function ExportModal({ ctx, open, onClose }: { ctx: PartnerCtx; open: boolean; onClose: () => void }) {
  const { partner, members, contributions, payouts, summary } = ctx
  if (!open) return null
  const base = `${slug(partner.name)}-${todayIso()}`

  const options = [
    {
      title: 'Transactions',
      body: 'Every payment, draw and refund with method, reference and who voided what.',
      run: () => downloadFile(`${base}-transactions.csv`, transactionsCsv(members, contributions, payouts)),
    },
    {
      title: 'Members',
      body: 'One row per member: paid, owing, what they get, draw months, amount at risk.',
      run: () => downloadFile(`${base}-members.csv`, membersCsv(partner, summary)),
    },
  ]

  return (
    <Modal open onClose={onClose} title="Export" subtitle="CSV files open in Excel, Google Sheets or Numbers.">
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={o.run}
            className="flex w-full items-center gap-3 rounded-2xl p-3.5 text-left ring-1 ring-ink-100 transition hover:bg-ink-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name="download" size={18} />
            </span>
            <span>
              <span className="block font-bold text-ink-900">{o.title}</span>
              <span className="block text-xs text-ink-500">{o.body}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-400">For a backup of every partner at once, use “Backup” on the home screen.</p>
    </Modal>
  )
}
