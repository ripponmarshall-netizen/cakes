import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { moveSlot, scheduleOrder, shuffleUnpaid, type DrawShare } from '../../lib/calc'
import { formatDate, formatMoney, formatShortDate, periodLabel, plural } from '../../lib/format'
import type { Member, Payout } from '../../lib/types'
import { useToast } from '../ui/Toast'
import { useConfirm } from '../ui/Confirm'
import { Badge } from '../ui/Badge'
import { Button, IconButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Icon } from '../ui/Icon'
import { VoidDialog } from './VoidDialog'
import { Avatar, type PartnerCtx } from './shared'

export function DrawsTab({ ctx, onPay }: { ctx: PartnerCtx; onPay: (share: DrawShare) => void }) {
  const { partner, members, summary, refresh } = ctx
  const { toast } = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState<Payout | null>(null)
  const { schedule, terms } = summary
  const memberById = new Map(members.map((m) => [m.id, m]))

  if (schedule.length === 0) {
    return (
      <EmptyState icon="gift" title="No draws yet">
        Each hand gets one draw; two half hands share one. Add members and the draw order appears here.
      </EmptyState>
    )
  }

  async function saveOrder(order: string[], message: string) {
    setSaving(true)
    const { error } = await supabase.from('partners').update({ draw_order: order }).eq('id', partner.id)
    setSaving(false)
    if (error) return toast(error.message, 'error')
    refresh()
    toast(message)
  }

  const order = scheduleOrder(schedule)
  const canSwap = (a: number, b: number) => b >= 0 && b < schedule.length && !schedule[a].locked && !schedule[b].locked

  async function shuffle() {
    const ok = await confirm({
      title: 'Draw lots?',
      message: 'Randomly re-orders every draw that hasn’t been paid out yet. Draws already paid stay where they are; half hands keep their partner.',
      confirmLabel: 'Shuffle',
    })
    if (ok) saveOrder(shuffleUnpaid(schedule), 'Draw order shuffled')
  }

  async function voidPayout(reason: string): Promise<boolean> {
    if (!voiding) return false
    const { error } = await supabase
      .from('payouts')
      .update({ voided_at: new Date().toISOString(), void_reason: reason })
      .eq('id', voiding.id)
    if (error) {
      toast(error.message, 'error')
      return false
    }
    refresh()
    toast('Payout voided', 'info')
    return true
  }

  const perMonth = schedule.length / partner.term_months

  const paidCount = schedule.filter((x) => x.done).length

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="eyebrow">Each draw</p>
          <p className="num mt-0.5 text-lg font-extrabold text-ink-900">
            {formatMoney(terms.netPerDraw)}
            {terms.feePerDraw > 0 && (
              <span className="ml-1.5 text-xs font-medium text-ink-400">
                {formatMoney(terms.grossPerDraw)} − {formatMoney(terms.feePerDraw)} fee
              </span>
            )}
          </p>
          <p className="num text-xs text-ink-500">
            {paidCount} of {plural(schedule.length, 'draw')} paid
            {perMonth !== 1 && (
              <> · {Number.isInteger(perMonth) ? `${perMonth} a month` : `over ${partner.term_months} months`}</>
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={shuffle} loading={saving} disabled={schedule.every((s) => s.locked)}>
          <Icon name="shuffle" size={15} /> Draw lots
        </Button>
      </div>

      <ol className="card stagger divide-y divide-ink-100/80 overflow-hidden">
        {schedule.map((slot, i) => {
          const isNow = !slot.done && slot.period === summary.rawPeriod
          const overdue = !slot.done && slot.period < summary.rawPeriod
          const [mon, yr] = periodLabel(partner.start_date, slot.period).split(' ')
          return (
            <li
              key={slot.index}
              style={{ ['--i' as string]: i }}
              className={`relative flex items-center gap-3 px-3 py-3.5 transition-colors sm:px-4 ${isNow ? 'bg-gradient-to-r from-gold-50 to-transparent' : overdue ? 'bg-rose-50/40' : ''}`}
            >
              {(isNow || overdue) && (
                <span className={`absolute inset-y-0 left-0 w-1 ${overdue ? 'bg-rose-400' : 'bg-gradient-to-b from-gold-300 to-gold-500'}`} aria-hidden />
              )}
              <div
                className={`flex w-12 shrink-0 flex-col items-center self-start rounded-2xl py-1.5 text-center ring-1 ring-inset ${
                  slot.done
                    ? 'bg-brand-50 text-brand-700 ring-brand-600/10'
                    : isNow
                      ? 'bg-white text-gold-700 ring-gold-400/40'
                      : 'bg-ink-50 text-ink-600 ring-ink-900/[0.05]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{mon}</span>
                <span className="num text-base font-extrabold leading-tight">{slot.period}</span>
                <span className="text-[9px] font-semibold opacity-50">{yr}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5">
                {slot.shares.map((share) => (
                  <ShareRow
                    key={share.memberId}
                    share={share}
                    member={memberById.get(share.memberId)}
                    lone={slot.half && slot.shares.length === 1}
                    status={overdue ? 'overdue' : isNow ? 'now' : null}
                    onPay={() => onPay(share)}
                    onVoid={() => share.payout && setVoiding(share.payout)}
                  />
                ))}
              </div>
              {!slot.locked ? (
                <div className="flex flex-col self-center">
                  <ReorderButtons
                    up={canSwap(i, i - 1) ? () => saveOrder(moveSlot(order, i, i - 1), 'Order updated') : undefined}
                    down={canSwap(i, i + 1) ? () => saveOrder(moveSlot(order, i, i + 1), 'Order updated') : undefined}
                    disabled={saving}
                  />
                </div>
              ) : (
                <span className="flex w-7 justify-center self-center text-ink-300" title="Paid draws are locked">
                  <Icon name="lock" size={13} />
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="px-4 text-center text-xs leading-relaxed text-ink-400">
        Use the arrows to swap who draws when. Paid draws are locked. Two half hands share one draw and move together.
      </p>

      <VoidDialog open={!!voiding} title="Void this payout?" confirmLabel="Void payout" onClose={() => setVoiding(null)} onConfirm={voidPayout}>
        {voiding && (
          <>
            The record of {formatMoney(voiding.net)} paid to {memberById.get(voiding.member_id)?.name ?? 'this member'} on{' '}
            {formatDate(voiding.paid_on)} stops counting, and the draw opens again.
          </>
        )}
      </VoidDialog>
    </div>
  )
}

function ShareRow({
  share,
  member,
  lone,
  status,
  onPay,
  onVoid,
}: {
  share: DrawShare
  member: Member | undefined
  lone: boolean
  status: 'overdue' | 'now' | null
  onPay: () => void
  onVoid: () => void
}) {
  if (!member) return null
  const multi = Number(member.hands) > 1
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.name} id={member.id} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-bold text-ink-900">
          <span className="truncate">{member.name}</span>
          {share.half && <Badge tone="blue">½</Badge>}
          {multi && !share.half && <span className="shrink-0 text-xs font-medium text-ink-400">hand {share.handNo}</span>}
        </p>
        <p className="text-xs text-ink-500">
          {share.payout ? (
            <span className="num inline-flex items-center gap-1 font-semibold text-brand-700">
              <Icon name="check" size={12} /> {formatMoney(share.payout.net)} · {formatShortDate(share.payout.paid_on)}
            </span>
          ) : (
            <>
              <span className="num">{formatMoney(share.net)}</span>
              {status === 'overdue' && <span className="font-semibold text-rose-600"> · overdue</span>}
              {status === 'now' && <span className="font-semibold text-gold-700"> · this month</span>}
              {lone && <span className="text-ink-400"> · waiting for a half-hand partner</span>}
            </>
          )}
        </p>
      </div>
      {share.payout ? (
        <IconButton label="Void payout" onClick={onVoid} className="hover:bg-rose-50 hover:text-rose-600">
          <Icon name="undo" size={16} />
        </IconButton>
      ) : (
        <Button size="sm" variant={status ? 'gold' : 'secondary'} onClick={onPay}>
          Pay
        </Button>
      )}
    </div>
  )
}

function ReorderButtons({ up, down, disabled }: { up?: () => void; down?: () => void; disabled: boolean }) {
  const cls =
    'flex h-6 w-7 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-900/[0.05] hover:text-ink-800 active:scale-90 disabled:pointer-events-none disabled:opacity-20'
  return (
    <>
      <button type="button" aria-label="Move earlier" onClick={up} disabled={!up || disabled} className={cls}>
        <Icon name="arrow-up" size={15} />
      </button>
      <button type="button" aria-label="Move later" onClick={down} disabled={!down || disabled} className={cls}>
        <Icon name="arrow-down" size={15} />
      </button>
    </>
  )
}
