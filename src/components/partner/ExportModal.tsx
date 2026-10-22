import { downloadFile, membersCsv, slug, transactionsCsv } from '../../lib/csv'
import { todayIso } from '../../lib/format'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'
import type { PartnerCtx } from './shared'

export function ExportModal({ ctx, open, onClose }: { ctx: PartnerCtx; open: boolean; onClose: () => void }) {
  const { partner, members, contributions, payouts, summary } = ctx
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
    <Modal open={open} onClose={onClose} title="Export" subtitle="CSV files open in Excel, Google Sheets or Numbers.">
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.title}
            type="button"
            onClick={o.run}
            className="group flex w-full items-center gap-3.5 rounded-2xl bg-ink-50 p-4 text-left ring-1 ring-inset ring-line tap tap-soft hover:ring-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          >
            <span className="hero flex h-11 w-11 shrink-0 items-center justify-center !rounded-2xl text-accent-600">
              <Icon name="file" size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-900">{o.title}</span>
              <span className="block text-xs text-ink-500">{o.body}</span>
            </span>
            <Icon name="download" size={17} className="shrink-0 text-ink-300 transition group-hover:text-accent-600" />
          </button>
        ))}
      </div>
      <p className="mt-4 pb-2 text-xs text-ink-400">For a backup of every partner at once, use “Back up everything” on the home screen.</p>
    </Modal>
  )
}
