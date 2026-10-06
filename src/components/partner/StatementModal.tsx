import { supabase } from '../../lib/supabase'
import { isLive, ownerResolver, type MemberSummary } from '../../lib/calc'
import { statementUrl } from '../../lib/format'
import { statementMessage, waLink } from '../../lib/whatsapp'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button, LinkButton } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { StatementView } from './StatementView'
import { PrintRoot } from '../ui/PrintRoot'
import type { PartnerCtx } from './shared'
import { useLast } from '../../hooks/usePresence'

/** Printable statement plus the member's read-only link: share, copy or reset it. */
export function StatementModal({ ctx, m: liveM, onClose }: { ctx: PartnerCtx; m: MemberSummary | null; onClose: () => void }) {
  const { partner, members, contributions, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const m = useLast(liveM)
  if (!m) return null

  const owner = ownerResolver(members)
  const payments = contributions.filter((c) => isLive(c) && owner(c.member_id) === m.member.id)
  const names = new Map(members.map((x) => [x.id, x.name]))
  const link = statementUrl(m.member.share_token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copied')
    } catch {
      window.prompt('Copy this link', link)
    }
  }

  async function resetLink() {
    const ok = await confirm({
      title: 'Reset this link?',
      message: `The link you sent ${m!.member.name} stops working. You’ll need to send them the new one.`,
      confirmLabel: 'Reset link',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('members').update({ share_token: crypto.randomUUID() }).eq('id', m!.member.id)
    if (error) return toast(error.message, 'error')
    refresh()
    toast('New link created')
  }

  return (
    <Modal open={!!liveM} onClose={onClose} title="Statement" subtitle={m.member.name}>
      <StatementView partner={partner} summary={summary} m={m} payments={payments} names={names} showSchedule={partner.share_schedule} />
      {liveM && (
        <PrintRoot>
          <StatementView partner={partner} summary={summary} m={m} payments={payments} names={names} showSchedule={partner.share_schedule} />
        </PrintRoot>
      )}

      <div className="mt-6 space-y-3 border-t border-ink-100 pb-2 pt-5">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="printer" size={16} /> Print / PDF
          </Button>
          <LinkButton variant="primary" href={waLink(m.member.phone, statementMessage(partner, m, link))} target="_blank" rel="noreferrer">
            <Icon name="message" size={16} /> WhatsApp
          </LinkButton>
        </div>
        <div className="rounded-2xl bg-ink-50/80 p-4 ring-1 ring-inset ring-ink-900/[0.04]">
          <p className="eyebrow flex items-center gap-1.5">
            <Icon name="link" size={13} /> Their read-only link
          </p>
          <p className="mt-2 break-all rounded-xl bg-surface px-3 py-2 font-mono text-[11px] text-ink-600 ring-1 ring-inset ring-ink-200/70">{link}</p>
          <p className="mt-1.5 text-xs text-ink-400">
            Shows only their own payments and draws
            {partner.share_schedule ? ', plus the full draw order with names' : ''}. Change that in partner settings.
          </p>
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" variant="secondary" onClick={copy}>
              <Icon name="copy" size={15} /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={resetLink}>
              Reset link
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
